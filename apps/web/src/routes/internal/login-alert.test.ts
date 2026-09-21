import { describe, expect, test } from "bun:test";
import { shouldShowExpiredAlert } from "./login-alert.ts";

describe("shouldShowExpiredAlert", () => {
  test("shows the notice when the expired flag is set", () => {
    // AC-40.04
    expect(
      shouldShowExpiredAlert({ expired: true, sessionExpiredMessage: null, serverError: null }),
    ).toBe(true);
  });

  test("shows the notice when a session-expired message is stored", () => {
    // AC-40.04
    expect(
      shouldShowExpiredAlert({
        expired: false,
        sessionExpiredMessage: "Sesi Anda telah berakhir. Silakan login kembali",
        serverError: null,
      }),
    ).toBe(true);
  });

  test("hides the expired notice while a login error is shown", () => {
    // AC-40.02: the failed attempt owns the banner, not the stale expiry.
    expect(
      shouldShowExpiredAlert({
        expired: true,
        sessionExpiredMessage: "Sesi Anda telah berakhir. Silakan login kembali",
        serverError: "Email atau password salah",
      }),
    ).toBe(false);
  });

  test("hides the notice when the session ended normally", () => {
    expect(
      shouldShowExpiredAlert({ expired: false, sessionExpiredMessage: null, serverError: null }),
    ).toBe(false);
  });
});
