import { describe, expect, test } from "bun:test";
import { ClamAvScanner } from "./clamav-scanner.ts";

function createStream(content: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  });
}

describe("ClamAvScanner (BE-S2-07)", () => {
  test("AC-46.01: clean stream returns infected: false", async () => {
    let received = Buffer.alloc(0);

    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data(socket, data) {
          received = Buffer.concat([received, Buffer.from(data)]);
          // Check if stream ended with 4 zero bytes
          if (received.length >= 14 && received.readUInt32BE(received.length - 4) === 0) {
            socket.write("stream: OK\0");
            socket.end();
          }
        },
      },
    });

    const scanner = new ClamAvScanner({
      host: "127.0.0.1",
      port: server.port,
      timeoutMs: 5000,
    });

    try {
      const result = await scanner.scan(createStream("clean file content"));
      expect(result).toEqual({ infected: false });
      expect(received.toString("utf8", 0, 10)).toBe("zINSTREAM\0");
    } finally {
      server.stop();
    }
  });

  test("AC-46.02: infected stream returns infected: true with signature", async () => {
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data(socket, data) {
          const str = Buffer.from(data).toString("utf8");
          if (str.includes("EICAR")) {
            socket.write("stream: Eicar-Test-Signature FOUND\0");
            socket.end();
          }
        },
      },
    });

    const scanner = new ClamAvScanner({
      host: "127.0.0.1",
      port: server.port,
      timeoutMs: 5000,
    });

    try {
      const result = await scanner.scan(createStream("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR"));
      expect(result).toEqual({
        infected: true,
        signature: "Eicar-Test-Signature",
      });
    } finally {
      server.stop();
    }
  });

  test("fails closed on clamd error response", async () => {
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data(socket) {
          socket.write("stream: internal scan error ERROR\0");
          socket.end();
        },
      },
    });

    const scanner = new ClamAvScanner({
      host: "127.0.0.1",
      port: server.port,
      timeoutMs: 5000,
    });

    try {
      await expect(scanner.scan(createStream("error test"))).rejects.toThrow("ClamAV daemon error");
    } finally {
      server.stop();
    }
  });

  test("fails closed on connection refused", async () => {
    // Port 59999 has no listener
    const scanner = new ClamAvScanner({
      host: "127.0.0.1",
      port: 59999,
      timeoutMs: 1000,
    });

    await expect(scanner.scan(createStream("data"))).rejects.toThrow();
  });

  test("fails closed on timeout", async () => {
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data() {
          // Intentionally do not respond
        },
      },
    });

    const scanner = new ClamAvScanner({
      host: "127.0.0.1",
      port: server.port,
      timeoutMs: 100, // 100ms short timeout for test
    });

    try {
      await expect(scanner.scan(createStream("hang test"))).rejects.toThrow(
        "ClamAV scan timed out after 100ms",
      );
    } finally {
      server.stop();
    }
  });
});
