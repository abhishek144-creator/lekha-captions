export class RequestValidationError extends Error {}

export function legacyFunctionRetiredResponse(): Response {
  return Response.json(
    { error: 'This legacy endpoint has been retired. Use the authenticated backend API.' },
    { status: 410 },
  );
}

export async function readJsonObject(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  if (req.method !== 'POST') throw new RequestValidationError('Method not allowed');
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) throw new RequestValidationError('Content-Type must be application/json');
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestValidationError('Request body is too large');

  const reader = req.body?.getReader();
  if (!reader) throw new RequestValidationError('JSON body is required');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new RequestValidationError('Request body is too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestValidationError('Invalid JSON body');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('JSON body must be an object');
  }
  return value as Record<string, unknown>;
}

export function boundedString(value: unknown, name: string, maxLength: number, required = true): string {
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null)) return '';
    throw new RequestValidationError(`${name} must be a string`);
  }
  const result = value.trim();
  if (required && !result) throw new RequestValidationError(`${name} is required`);
  if (result.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) {
    throw new RequestValidationError(`${name} is invalid`);
  }
  return result;
}

export function boundedNumber(value: unknown, name: string, min: number, max: number, fallback?: number): number {
  if ((value === undefined || value === null) && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RequestValidationError(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function isPrivateAddress(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function hostMatchesAllowlist(hostname: string): boolean {
  const entries = (Deno.env.get('FILE_URL_ALLOWED_HOSTS') || '')
    .split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  const host = hostname.toLowerCase();
  return entries.some((entry) => entry.startsWith('*.')
    ? host.endsWith(entry.slice(1)) && host !== entry.slice(2)
    : host === entry);
}

export async function assertSafeFileUrl(rawValue: unknown): Promise<URL> {
  const rawUrl = boundedString(rawValue, 'file_url', 2048);
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RequestValidationError('file_url is invalid');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
    throw new RequestValidationError('file_url must be an https URL on port 443 without embedded credentials');
  }
  if (!hostMatchesAllowlist(parsed.hostname)) {
    throw new RequestValidationError('file_url host is not an approved storage host');
  }
  const addresses = new Set<string>();
  for (const type of ['A', 'AAAA'] as const) {
    try {
      for (const address of await Deno.resolveDns(parsed.hostname, type)) addresses.add(address);
    } catch {
      // A host need not publish both record types.
    }
  }
  if (addresses.size === 0 || [...addresses].some(isPrivateAddress)) {
    throw new RequestValidationError('file_url host does not resolve to a public address');
  }
  return parsed;
}

export async function readResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestValidationError('Remote file is too large');
  const reader = response.body?.getReader();
  if (!reader) throw new RequestValidationError('Remote file has no body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new RequestValidationError('Remote file is too large');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function validationResponse(error: unknown): Response | null {
  if (!(error instanceof RequestValidationError)) return null;
  const status = error.message === 'Method not allowed' ? 405 : 400;
  return Response.json({ error: error.message }, { status });
}
