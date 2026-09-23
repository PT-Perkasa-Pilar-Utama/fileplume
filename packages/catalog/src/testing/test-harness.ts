import { asTenantId, asUserId, ok } from "@archiva/shared";
import type { AuditPort, JobQueue, QuotaPort, QuotaReservationToken } from "../ports.ts";
import { createCatalogService } from "../service.ts";
import { inMemoryBlobStore } from "./in-memory-blob-store.ts";
import { inMemoryCatalogRepository } from "./in-memory-repository.ts";

export const TENANT_ID = asTenantId("11111111-1111-4111-8111-111111111111");
export const USER_ID = asUserId("22222222-2222-4222-8222-222222222222");

function streamOf(bytes: Uint8Array<ArrayBuffer>): {
  stream: ReadableStream;
  sizeBytes: number;
} {
  // Allowlisted cast: a Response built from bytes always carries a body.
  const stream = new Response(bytes).body as ReadableStream;
  return { stream, sizeBytes: bytes.byteLength };
}

export function pdfStream(content = "sample pdf content"): {
  stream: ReadableStream;
  sizeBytes: number;
} {
  return streamOf(new TextEncoder().encode(`%PDF-1.4\n${content}`));
}

export function docxStream(content = "sample docx"): { stream: ReadableStream; sizeBytes: number } {
  const prefix = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const marker = new TextEncoder().encode(`word/document.xml:${content}`);
  const combined = new Uint8Array(prefix.length + marker.length);
  combined.set(prefix, 0);
  combined.set(marker, prefix.length);
  return streamOf(combined);
}

export function jpgStream(): { stream: ReadableStream; sizeBytes: number } {
  return streamOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]));
}

/** A PDF whose bytes arrive one at a time, for multi-chunk sniffing. */
export function chunkedPdfStream(content = "chunked content"): {
  stream: ReadableStream;
  sizeBytes: number;
} {
  const bytes = new TextEncoder().encode(`%PDF-1.4\n${content}`);
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + 1));
      offset += 1;
    },
  });
  return { stream, sizeBytes: bytes.length };
}

export function createTestHarness(options?: {
  maxFileSizeMb?: number;
  quotaAvailable?: boolean;
  quotaBytes?: number;
}) {
  const repository = inMemoryCatalogRepository();
  const blobStore = inMemoryBlobStore();
  const clock = { now: () => new Date("2026-09-14T08:00:00.000Z") };
  const committedReservations: QuotaReservationToken[] = [];
  const releasedReservations: QuotaReservationToken[] = [];
  const enqueuedJobs: string[] = [];
  const auditEvents: unknown[] = [];
  let usedBytes = 0;
  const outstandingBytes = new Map<string, number>();

  const quota: QuotaPort = {
    async getMaxFileSizeMb() {
      return options?.maxFileSizeMb ?? 20;
    },
    async reserveQuota(tenantId, bytes) {
      if (options?.quotaAvailable === false) {
        return { ok: false, error: { kind: "QuotaExceeded" } };
      }
      if (options?.quotaBytes !== undefined) {
        const outstanding =
          outstandingBytes.size > 0
            ? [...outstandingBytes.values()].reduce((sum, b) => sum + b, 0)
            : 0;
        if (usedBytes + outstanding + bytes > options.quotaBytes) {
          return { ok: false, error: { kind: "QuotaExceeded" } };
        }
        const token = { id: crypto.randomUUID(), tenantId, bytes };
        outstandingBytes.set(token.id, bytes);
        return ok(token);
      }
      return ok({ id: crypto.randomUUID(), tenantId, bytes });
    },
    async commitQuota(res) {
      outstandingBytes.delete(res.id);
      if (options?.quotaBytes !== undefined) usedBytes += res.bytes;
      committedReservations.push(res);
    },
    async releaseQuota(res) {
      outstandingBytes.delete(res.id);
      releasedReservations.push(res);
    },
  };

  const queue: JobQueue = {
    async enqueue(documentId) {
      enqueuedJobs.push(documentId);
    },
  };

  const audit: AuditPort = {
    async record(event) {
      auditEvents.push(event);
    },
  };

  const service = createCatalogService({
    repository,
    blobStore,
    clock,
    quota,
    queue,
    audit,
  });

  return {
    service,
    repository,
    blobStore,
    committedReservations,
    releasedReservations,
    enqueuedJobs,
    auditEvents,
  };
}
