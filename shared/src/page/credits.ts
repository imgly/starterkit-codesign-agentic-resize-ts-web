// Whether a failed model or image call says the credits are used up.

/** The SDK's words, the gateway's code, or a bare 402 from the model call. */
export function outOfCredits(message: string): boolean {
  return /out of credits|insufficient[_ ]credits|^402\b|\b402 status/i.test(
    message
  );
}
