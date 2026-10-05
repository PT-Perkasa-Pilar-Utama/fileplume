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

function createByteStream(bytes: Uint8Array): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
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

  test("streams chunk larger than socket send buffer without dropping bytes", async () => {
    // 2 MB chunk exceeds the socket send buffer (~320 KB on loopback)
    const chunkSize = 2 * 1024 * 1024;
    const chunkData = new Uint8Array(chunkSize);
    chunkData.fill(0x5a);

    const receivedChunks: Buffer[] = [];
    let totalReceived = 0;
    const expectedTotal = 10 + 4 + chunkSize + 4; // zINSTREAM\0 + length + data + terminator

    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data(socket, data) {
          const buf = Buffer.from(data);
          receivedChunks.push(buf);
          totalReceived += buf.length;

          if (totalReceived >= expectedTotal) {
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
      const result = await scanner.scan(createByteStream(chunkData));
      expect(result).toEqual({ infected: false });

      const allBytes = Buffer.concat(receivedChunks);
      expect(allBytes.length).toBe(expectedTotal);
      expect(allBytes.toString("utf8", 0, 10)).toBe("zINSTREAM\0");
      expect(allBytes.readUInt32BE(10)).toBe(chunkSize);
      expect(allBytes.subarray(14, 14 + chunkSize).equals(Buffer.from(chunkData))).toBe(true);
      expect(allBytes.readUInt32BE(14 + chunkSize)).toBe(0);
    } finally {
      server.stop();
    }
  });
});
