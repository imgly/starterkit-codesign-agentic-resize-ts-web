// The gateway, the routes that add the CoDesign licence key, and where the engine loads its assets.

export const GATEWAY_ORIGIN = 'https://gateway.img.ly';

/** Where `@cesdk/engine` 1.83.0 loads its WASM and fonts from: the engine's own default for that version. */
export const ENGINE_BASE_URL =
  'https://cdn.img.ly/packages/imgly/cesdk-engine/1.83.0/assets';

/** The bearer the page sends to the key-adding routes, which replace it with the key. Not a secret. */
export const PROXY_BEARER = 'proxy-replaces-this';

/** The route that forwards to the gateway with the key: the dev server's in development, your backend's in production. */
export const gatewayProxyURL = (origin: string) => `${origin}/gateway`;

/** The route that forwards to IMG.LY's Metering with the key, beside the gateway's. */
export const meteringProxyURL = (origin: string) => `${origin}/metering`;
