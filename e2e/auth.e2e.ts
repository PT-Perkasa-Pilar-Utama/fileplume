import { expect, test } from "@playwright/test";

/**
 * FE-S1-05: Wire authentication end to end against the composed stack.
 *
 * Proves the full loop against the live running stack:
 * - AC-40.01: Login dengan kredensial yang valid
 * - AC-40.02: Login dengan kredensial yang salah (Negative Path)
 * - AC-40.03: Logout dari sistem
 * - AC-40.04: Sesi berakhir karena tidak aktif
 *
 * The suite runs on the single seeded tenant, so navigation uses paths
 * relative to the `baseURL` in playwright.config.ts instead of repeating
 * the host. Absolute hosts stay reserved for multi-tenant specs.
 *
 * References:
 * - api-specs/02-authentication.md 2.2 to 2.5
 * - api-specs/01-conventions.md 1.6, 1.8
 * - business/acceptance-criteria-breakdown/acceptance-criteria-sprint-1.md US-40
 */

const VALID_EMAIL = "anggota@archiva-demo.test";
const VALID_PASSWORD = "archiva-dev-2026";
const WRONG_PASSWORD = "wrong-password-2026";
const MEMBER_NAME = "Siti Rahayu";
const MEMBER_ROLE = "MEMBER";
const MEMBER_INITIALS = "SR";

test.describe("Authentication end to end (FE-S1-05)", () => {
  // One seeded user backs every case, and the login form is rate-limited per
  // email (api-specs/01-conventions.md 1.10): run the suite serially so the
  // cases never spend each other's budget.
  test.describe.configure({ mode: "serial" });

  // AC-40.01: Login dengan kredensial yang valid
  test("AC-40.01: valid login renders dashboard and user profile", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill credentials
    await page.locator("#email").fill(VALID_EMAIL);
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    // Verify redirect to dashboard
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Verify user profile details in the header: name, role ("MEMBER"), and avatar
    const header = page.getByRole("banner");
    await expect(header.getByText(MEMBER_NAME)).toBeVisible();
    await expect(header.getByText(MEMBER_ROLE)).toBeVisible();
    await expect(header.getByText(MEMBER_INITIALS)).toBeVisible();
  });

  // AC-40.02: Login dengan kredensial yang salah (Negative Path)
  test("AC-40.02: invalid login shows exact Indonesian error and remains on login page", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill wrong credentials
    await page.locator("#email").fill(VALID_EMAIL);
    await page.locator("#password").fill(WRONG_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    // Verify error banner matches exact copy verbatim
    await expect(page.getByText("Email atau password salah")).toBeVisible();

    // Verify user remains on login page
    expect(page.url()).toContain("/login");
  });

  // AC-40.03: Logout dari sistem
  test("AC-40.03: logout ends the session and returns to login page", async ({ page }) => {
    // 1. Log in first
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("#email").fill(VALID_EMAIL);
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("banner").getByText(MEMBER_NAME)).toBeVisible();

    // 2. Open profile settings menu and click logout
    await page.getByRole("button", { name: "Pengaturan profil" }).click();
    await page.getByRole("menuitem", { name: "Logout" }).click();

    // 3. Verify redirected to login page
    await expect(page).toHaveURL("/login");

    // 4. Verify session is truly ended: navigating to protected route redirects to login
    await page.goto("/documents");
    await expect(page).toHaveURL(/.*\/login.*/);
  });

  // AC-40.04: Sesi berakhir karena tidak aktif
  test("AC-40.04: idle-expired session shows exact Indonesian copy on navigation", async ({
    page,
  }) => {
    // 1. Log in to establish active session
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("#email").fill(VALID_EMAIL);
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // 2. Simulate session expiry / revocation on the server by invalidating the cookie token.
    // The session cookie is `__Host-` prefixed, so it must stay host-only:
    // sending a Domain attribute makes Chromium reject it. CDP sets it
    // without one. The server answers 401 for the unknown token,
    // api-specs/01-conventions.md 1.6.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.setCookie", {
      name: "__Host-archiva_session",
      value: "expired-or-revoked-token",
      url: "http://archiva-demo.localhost:4173/",
      path: "/",
      secure: true,
    });

    // 3. Click any menu item in interface (e.g. "Dokumen")
    await page.getByRole("link", { name: "Dokumen" }).click();

    // 4. Verify redirected to login page with exact Indonesian session expiry notice
    await expect(page).toHaveURL(/.*\/login.*expired=true.*/);
    await expect(page.getByText("Sesi Anda telah berakhir. Silakan login kembali")).toBeVisible();
  });
});
