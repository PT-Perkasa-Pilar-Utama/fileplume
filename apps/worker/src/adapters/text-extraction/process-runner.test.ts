import { expect, test } from "bun:test";
import { runProcess } from "./process-runner.ts";

test("collects all child output before resolving", async () => {
  const output = await runProcess(
    "bun",
    ["-e", "process.stdout.write('x'.repeat(1048576))"],
    10_000,
  );
  expect(output.stdout.byteLength).toBe(1048576);
});
