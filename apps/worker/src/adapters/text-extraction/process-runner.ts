import { spawn } from "node:child_process";

/** The child did not finish inside its budget. Transient: the caller may retry. */
export class ProcessTimeoutError extends Error {}

/** The child ran and exited non-zero. For a parser, that means the input is bad. */
export class ProcessFailedError extends Error {}

export type ProcessOutput = { stdout: Uint8Array; stderr: string };

const MAX_STDERR_BYTES = 8 * 1024;
const MAX_STDOUT_BYTES = 200 * 1024 * 1024;

/**
 * Runs one bounded child process. technical-specs/10-integration-points.md 10.8
 * rule 1: no external call is unbounded.
 */
export function runProcess(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Uint8Array[] = [];
    const stderr: Uint8Array[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const settle = (error: Error | null, output?: ProcessOutput): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (output) resolve(output);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(new ProcessTimeoutError(`${command} timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Uint8Array) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        child.kill("SIGKILL");
        settle(new ProcessFailedError(`${command} exceeded its output limit`));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Uint8Array) => {
      if (stderrBytes >= MAX_STDERR_BYTES) return;
      const remaining = MAX_STDERR_BYTES - stderrBytes;
      const bounded = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
      stderrBytes += bounded.byteLength;
      stderr.push(bounded);
    });
    child.once("error", (error: Error) => {
      settle(error);
    });
    child.once("exit", (code, signal) => {
      if (code !== 0) {
        settle(
          new ProcessFailedError(
            `${command} exited with ${signal ?? `code ${code}`}: ${new TextDecoder()
              .decode(concat(stderr))
              .trim()
              .slice(0, 500)}`,
          ),
        );
        return;
      }
      settle(null, { stdout: concat(stdout), stderr: new TextDecoder().decode(concat(stderr)) });
    });
  });
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
