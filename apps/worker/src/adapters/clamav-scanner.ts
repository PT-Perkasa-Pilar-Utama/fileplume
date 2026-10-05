import type { MalwareScanner } from "@archiva/enrichment";
import type { Socket } from "bun";

export type ClamAvScannerOptions = {
  host: string;
  port: number;
  /** Timeout in ms. Default 60,000 ms (60 s). technical-specs/12-document-processing-pipeline.md 12.4. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Production ClamAV adapter communicating with clamd over TCP using the INSTREAM protocol.
 * technical-specs/10-integration-points.md 10.3, 12-document-processing-pipeline.md 12.4.
 *
 * Protocol contract:
 * 1. Send "zINSTREAM\0".
 * 2. Stream data chunks prefixed with 4-byte big-endian chunk length.
 * 3. Send 4 zero bytes (0x00000000) to terminate the stream.
 * 4. Read response: "stream: OK" (clean) or "stream: <virus> FOUND" (infected).
 */
export class ClamAvScanner implements MalwareScanner {
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(options: ClamAvScannerOptions) {
    this.host = options.host;
    this.port = options.port;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async scan(stream: ReadableStream): Promise<{ infected: boolean; signature?: string }> {
    const host = this.host;
    const port = this.port;
    const timeoutMs = this.timeoutMs;

    return await new Promise<{ infected: boolean; signature?: string }>((resolve, reject) => {
      let settled = false;
      let responseText = "";
      let pending: Uint8Array = new Uint8Array(0);
      let onDrained: (() => void) | undefined;

      const finish = (result: { infected: boolean; signature?: string }): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        onDrained?.();
        onDrained = undefined;
        resolve(result);
      };

      const fail = (err: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        onDrained?.();
        onDrained = undefined;
        reject(err);
      };

      const timer = setTimeout(() => {
        fail(new Error(`ClamAV scan timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const flushPending = (socket: Socket<undefined>): void => {
        while (pending.byteLength > 0) {
          const written = socket.write(pending);
          if (written <= 0) break;
          pending = pending.subarray(written);
        }
        if (pending.byteLength === 0 && onDrained) {
          const resume = onDrained;
          onDrained = undefined;
          resume();
        }
      };

      const writeAll = async (socket: Socket<undefined>, bytes: Uint8Array): Promise<void> => {
        if (settled) return;
        pending = bytes;
        flushPending(socket);
        while (pending.byteLength > 0 && !settled) {
          await new Promise<void>((resume) => {
            onDrained = resume;
          });
        }
      };

      Bun.connect({
        hostname: host,
        port: port,
        socket: {
          drain(socket) {
            flushPending(socket);
          },

          async open(socket) {
            try {
              // Initiate INSTREAM command per clamd protocol spec
              socket.write("zINSTREAM\0");

              const reader = stream.getReader();
              try {
                while (true) {
                  if (settled) break;
                  const { done, value } = await reader.read();
                  if (done) break;

                  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
                  if (bytes.byteLength === 0) continue;

                  const header = new Uint8Array(4);
                  new DataView(header.buffer).setUint32(0, bytes.byteLength, false);
                  await writeAll(socket, header);
                  await writeAll(socket, bytes);
                }

                if (!settled) {
                  // 4-byte zero length indicates end of stream
                  const terminator = new Uint8Array(4);
                  await writeAll(socket, terminator);
                }
              } finally {
                reader.releaseLock();
              }
            } catch (streamErr) {
              socket.end();
              fail(streamErr instanceof Error ? streamErr : new Error(String(streamErr)));
            }
          },

          data(socket, data) {
            responseText += Buffer.from(data).toString("utf8");

            if (responseText.includes("\0") || responseText.includes("\n")) {
              const trimmed = responseText.replace(/[\0\r\n]/g, "").trim();

              if (trimmed === "stream: OK") {
                finish({ infected: false });
                socket.end();
                return;
              }

              const foundMatch = trimmed.match(/^stream:\s+(.+)\s+FOUND$/);
              if (foundMatch?.[1]) {
                finish({ infected: true, signature: foundMatch[1] });
                socket.end();
                return;
              }

              fail(new Error(`ClamAV daemon error: ${trimmed}`));
              socket.end();
            }
          },

          error(socket) {
            socket.end();
            fail(new Error("ClamAV socket communication error"));
          },

          connectError(_socket) {
            fail(new Error(`ClamAV connection refused at ${host}:${port}`));
          },

          close() {
            if (!settled) {
              fail(new Error("ClamAV socket closed before scan completed"));
            }
          },
        },
      }).catch((connectErr) => {
        fail(connectErr instanceof Error ? connectErr : new Error(String(connectErr)));
      });
    });
  }
}

export function createClamAvScanner(options: ClamAvScannerOptions): ClamAvScanner {
  return new ClamAvScanner(options);
}
