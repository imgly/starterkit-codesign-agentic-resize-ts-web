/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CESDK_LICENSE?: string;
  /** Where the page gets short-lived CE.SDK grants instead of a licence key in the build. */
  readonly VITE_BILLING_PROXY_URL?: string;
}
