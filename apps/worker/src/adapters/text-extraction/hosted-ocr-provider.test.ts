import { describe, expect, test } from "bun:test";
import { HostedOcrProvider } from "./hosted-ocr-provider.ts";

const image = new Uint8Array([1]);

describe("HostedOcrProvider (10-integration-points 10.7)", () => {
  test("passes the page, languages and key to the injected transport", async () => {
    const calls: unknown[] = [];
    const ocr = new HostedOcrProvider({
      apiKey: "secret",
      async recognizeImage(request) {
        calls.push({ image: request.image, languages: request.languages, apiKey: request.apiKey });
        return { text: "Kontrak", confidence: 0.9 };
      },
    });

    expect(await ocr.recognize(image, ["ind", "eng"])).toEqual({
      text: "Kontrak",
      confidence: 0.9,
    });
    expect(calls).toEqual([{ image, languages: ["ind", "eng"], apiKey: "secret" }]);
  });

  test("aborts the transport after the per-page budget", async () => {
    let aborted = false;
    const ocr = new HostedOcrProvider({
      apiKey: "secret",
      timeoutMs: 5,
      recognizeImage: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    });

    await expect(ocr.recognize(image, ["ind", "eng"])).rejects.toThrow("aborted");
    expect(aborted).toBe(true);
  });

  test("refuses an empty page image", async () => {
    const ocr = new HostedOcrProvider({
      apiKey: "secret",
      recognizeImage: async () => ({ text: "", confidence: 0 }),
    });
    await expect(ocr.recognize(new Uint8Array(), ["ind", "eng"])).rejects.toThrow(
      "received an empty page image",
    );
  });
});
