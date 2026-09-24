import { asTenantId, asUserId, ok } from "@archiva/shared";
import type {
  AuditPort,
  JobQueue,
  QuotaPort,
  QuotaReservationToken,
  SessionPort,
} from "../ports.ts";
import { createCatalogService } from "../service.ts";
import { inMemoryBlobStore } from "./in-memory-blob-store.ts";
import { inMemoryCatalogRepository } from "./in-memory-repository.ts";

export const TENANT_ID = asTenantId("11111111-1111-4111-8111-111111111111");
export const USER_ID = asUserId("22222222-2222-4222-8222-222222222222");

/**
 * Mirrors the production ledger. Source of truth:
 * `packages/tenancy/src/internal/reservation-ttl.ts`.
 */
const RESERVATION_TTL_MS = 15 * 60 * 1000;

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
  sessionValid?: boolean;
  session?: SessionPort;
}) {
  const repository = inMemoryCatalogRepository();
  const blobStore = inMemoryBlobStore();
  let now = new Date("2026-09-14T08:00:00.000Z");
  const clock = { now: () => now };
  const committedReservations: QuotaReservationToken[] = [];
  const releasedReservations: QuotaReservationToken[] = [];
  const revertedReservations: QuotaReservationToken[] = [];
  const enqueuedJobs: string[] = [];
  const auditEvents: unknown[] = [];
  let usedBytes = 0;
  // Outstanding reservations carry their expiry so a slow batch is modelled
  // the way the Drizzle ledger counts it: an expired reservation stops
  // counting. `tryReserve` filters on `expiresAt > now`.
  const outstanding = new Map<string, { bytes: number; expiresAt: Date }>();

  const quota: QuotaPort = {
    async getMaxFileSizeMb() {
      return options?.maxFileSizeMb ?? 20;
    },
    async reserveQuota(tenantId, bytes) {
      if (options?.quotaAvailable === false) {
        return { ok: false, error: { kind: "QuotaExceeded" } };
      }
      if (options?.quotaBytes !== undefined) {
        const live = [...outstanding.values()]
          .filter((r) => r.expiresAt > now)
          .reduce((sum, r) => sum + r.bytes, 0);
        if (usedBytes + live + bytes > options.quotaBytes) {
          return { ok: false, error: { kind: "QuotaExceeded" } };
        }
        const token = { id: crypto.randomUUID(), tenantId, bytes };
        outstanding.set(token.id, {
          bytes,
          expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
        });
        return ok(token);
      }
      return ok({ id: crypto.randomUUID(), tenantId, bytes });
    },
    async commitQuota(res) {
      outstanding.delete(res.id);
      if (options?.quotaBytes !== undefined) usedBytes += res.bytes;
      committedReservations.push(res);
    },
    async revertCommit(res) {
      outstanding.delete(res.id);
      if (options?.quotaBytes !== undefined) {
        if (usedBytes < res.bytes) {
          throw new Error(`revertCommit: used bytes ${usedBytes} below ${res.bytes}`);
        }
        usedBytes -= res.bytes;
      }
      revertedReservations.push(res);
    },
    async releaseQuota(res) {
      outstanding.delete(res.id);
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

  const session: SessionPort = options?.session ?? {
    async validateSession() {
      return options?.sessionValid ?? true;
    },
  };

  const service = createCatalogService({
    repository,
    blobStore,
    clock,
    quota,
    queue,
    audit,
    session,
  });

  return {
    service,
    repository,
    blobStore,
    committedReservations,
    releasedReservations,
    revertedReservations,
    enqueuedJobs,
    auditEvents,
    session,
    advanceTime(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    get usedBytes() {
      return usedBytes;
    },
  };
}
