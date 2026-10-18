import createClient from "openapi-fetch";

import type { components, paths } from "./api-schema";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Typed client generated from the backend's OpenAPI schema. Sends the session cookie. */
export const api = createClient<paths>({ baseUrl: API_URL, credentials: "include" });

export type Schemas = components["schemas"];

/** Every backend error has the shape {error: {code, message}}; validation errors are FastAPI's. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type ValidationDetail = { loc: (string | number)[]; msg: string };

export function toApiError(status: number, body: unknown): ApiError {
  const b = body as { error?: { code: string; message: string }; detail?: ValidationDetail[] };
  if (b?.error) return new ApiError(status, b.error.code, b.error.message);
  if (Array.isArray(b?.detail)) {
    // 422 from FastAPI: map each problem to the field it belongs to, for inline errors.
    const fields: Record<string, string> = {};
    for (const d of b.detail) fields[String(d.loc.at(-1))] = d.msg.replace(/^Value error, /, "");
    return new ApiError(status, "validation_error", Object.values(fields)[0] ?? "Invalid input", fields);
  }
  return new ApiError(status, "unknown", "Something went wrong. Try again.");
}

/** Unwrap an openapi-fetch result: return data or throw ApiError. */
export async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result;
  try {
    result = await promise;
  } catch {
    throw new ApiError(0, "network", "Can't reach the server. Check your connection.");
  }
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response.status, result.error);
  }
  return result.data as T;
}
