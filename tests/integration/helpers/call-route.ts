/**
 * Integration test memanggil route handler langsung dengan Request sungguhan; server Next
 * tidak dijalankan, jadi cookie session dibuat lewat Better Auth server API.
 */
export async function callRoute<Ctx>(
  handler: (request: Request, context: Ctx) => Promise<Response> | Response,
  options: {
    cookie?: string;
    method?: string;
    path?: string;
    body?: unknown;
    params?: unknown;
  } = {},
): Promise<Response> {
  const headers = new Headers({ host: "localhost" });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.body !== undefined)
    headers.set("content-type", "application/json");

  const request = new Request(
    `http://localhost${options.path ?? "/api/test"}`,
    {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    },
  );

  // Bentuk context mengikuti route handler Next: params selalu Promise.
  return handler(request, { params: Promise.resolve(options.params) } as Ctx);
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
