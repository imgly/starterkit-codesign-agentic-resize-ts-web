// Tells missing from invalid gateway credentials before the first turn, as the AI editor starter kit does.

export type GatewayProbe =
  | { status: 'ok' }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'unreachable'; message: string };

export async function probeGateway(
  gatewayBaseURL: string,
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<GatewayProbe> {
  let res: Response;
  try {
    res = await fetchFn(`${gatewayBaseURL}/v1/models`, {
      headers: { authorization: `Bearer ${token}` }
    });
  } catch (error) {
    return {
      status: 'unreachable',
      message: error instanceof Error ? error.message : String(error)
    };
  }
  if (res.headers.get('x-gateway-dev-proxy') === 'no-key') {
    return { status: 'missing' };
  }
  if (res.status === 401 || res.status === 403) return { status: 'invalid' };
  if (!res.ok) {
    return {
      status: 'unreachable',
      message: `the gateway answered ${res.status}`
    };
  }
  return { status: 'ok' };
}
