import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http.js";

const COOKIE_NAME = "xairo_studio";
const SESSION_DURATION_SECONDS = 12 * 60 * 60;

function getAuthConfig() {
  const accessCode = process.env.STUDIO_ACCESS_CODE;
  const sessionSecret = process.env.STUDIO_SESSION_SECRET;
  if (!accessCode || accessCode.length < 20 || !sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new HttpError(
      503,
      "Configure STUDIO_ACCESS_CODE (at least 20 characters) and STUDIO_SESSION_SECRET (at least 32 bytes).",
    );
  }
  return { accessCode, sessionSecret };
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createSessionToken(secret) {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : "";
}

function isValidSessionToken(token, secret) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isInteger(data.expiresAt) && data.expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function cookieOptions(request) {
  const host = request.headers.host || "";
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const secure = forwardedProtocol === "https" || (!isLocal && forwardedProtocol !== "http");
  return `Path=/api/studio; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}${secure ? "; Secure" : ""}`;
}

export function startStudioSession(request, response) {
  const { sessionSecret } = getAuthConfig();
  const token = createSessionToken(sessionSecret);
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; ${cookieOptions(request)}`);
}

export function clearStudioSession(request, response) {
  const options = cookieOptions(request).replace(`Max-Age=${SESSION_DURATION_SECONDS}`, "Max-Age=0");
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=; ${options}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

export function isStudioSessionValid(request) {
  const { sessionSecret } = getAuthConfig();
  return isValidSessionToken(getCookie(request, COOKIE_NAME), sessionSecret);
}

export function verifyStudioAccessCode(code) {
  const { accessCode } = getAuthConfig();
  const expected = Buffer.from(accessCode);
  const received = Buffer.from(typeof code === "string" ? code.slice(0, accessCode.length + 1) : "");
  const comparable = Buffer.alloc(expected.length);
  received.copy(comparable, 0, 0, expected.length);
  const matches = timingSafeEqual(expected, comparable);
  return matches && received.length === expected.length;
}

export function getRateLimitKey(request) {
  const { sessionSecret } = getAuthConfig();
  const forwardedAddresses = request.headers["x-forwarded-for"];
  const address = typeof forwardedAddresses === "string"
    ? forwardedAddresses.split(",")[0].trim()
    : request.socket?.remoteAddress || "unknown";
  return createHmac("sha256", sessionSecret).update(address).digest("hex");
}

export function requireStudioSession(request) {
  if (!isStudioSessionValid(request)) {
    throw new HttpError(401, "Studio access has expired. Enter the access code to continue.");
  }
}
