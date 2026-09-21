interface ExpiredAlertInput {
  expired: boolean | undefined;
  sessionExpiredMessage: string | null;
  serverError: string | null;
}

export function shouldShowExpiredAlert(input: ExpiredAlertInput): boolean {
  // A failed login attempt replaces the expired-session notice, so the user
  // sees the error matching their last action. AC-40.02, AC-40.04.
  return Boolean(input.expired || input.sessionExpiredMessage) && input.serverError === null;
}
