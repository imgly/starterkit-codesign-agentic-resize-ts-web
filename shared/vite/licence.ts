// The build's licence: a key in the page, or a service's short-lived grants, never both.

/** Throws when both are set: every `VITE_*` reaches the page, so a key beside the grants would ship anyway. */
export function checkLicenceEnv(env: Record<string, string>): void {
  if (env.VITE_BILLING_PROXY_URL && env.VITE_CESDK_LICENSE) {
    throw new Error(
      'Set VITE_BILLING_PROXY_URL or VITE_CESDK_LICENSE, not both: with grants, the license key stays off the page.'
    );
  }
}
