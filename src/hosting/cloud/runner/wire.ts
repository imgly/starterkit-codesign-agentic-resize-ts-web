// The runner's messages over HTTP, for the page and the server alike: one line of JSON each, an ArrayBuffer as base64.

interface Bytes {
  $bytes: string;
}

const isBytes = (value: unknown): value is Bytes =>
  typeof (value as Bytes | null)?.$bytes === 'string';

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(text);
}

export const encode = (message: unknown): string =>
  JSON.stringify(message, (_key, value: unknown) =>
    value instanceof ArrayBuffer ? { $bytes: base64(value) } : value
  );

export const decode = (line: string): unknown =>
  JSON.parse(line, (_key, value: unknown) =>
    isBytes(value)
      ? Uint8Array.from(atob(value.$bytes), (c) => c.charCodeAt(0)).buffer
      : value
  );
