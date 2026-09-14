import { expect, test } from "@playwright/test";

/**
 * The seam this harness exists for: a browser reaches the SPA, and the SPA's
 * origin reaches the API container and its database. Acceptance-criterion
 * specs belong to the wiring cards.
 */
test("liveness answers from the API container", async ({ request }) => {
  const res = await request.get("/health/live");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("an unseeded tenant subdomain is refused by the API, not the proxy", async ({ request }) => {
  // The JSON envelope is the API's own 404, so the request crossed the preview proxy.
  const res = await request.get("/api/v1/auth/me");
  expect(res.status()).toBe(404);
  expect(res.headers()["content-type"]).toContain("application/json");
});

test("the SPA shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Archiva" })).toBeVisible();
});
