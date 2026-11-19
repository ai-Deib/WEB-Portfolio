export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(response, status, payload) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(payload);
}

export function requireMethod(request, methods) {
  if (!methods.includes(request.method)) {
    throw new HttpError(405, "This request method is not supported.");
  }
}

export function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      throw new HttpError(400, "The request body must be valid JSON.");
    }
  }
  return {};
}

export function requireSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;

  const requestHost = request.headers["x-forwarded-host"] || request.headers.host;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "This request origin is not allowed.");
  }

  if (!requestHost || originHost !== requestHost) {
    throw new HttpError(403, "This request origin is not allowed.");
  }
}
