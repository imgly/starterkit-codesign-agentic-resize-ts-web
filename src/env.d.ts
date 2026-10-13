/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CESDK_LICENSE?: string;
  /** The runner server the page calls, on the cloud hosting. */
  readonly VITE_RUNNER_URL?: string;
  readonly VITE_MODEL?: string;
}
