import assert from "node:assert/strict";
import { after, test } from "node:test";
import { handleApiRequest } from "../server/api.js";
import {
  isStudioSessionValid,
  requireStudioSession,
  startStudioSession,
  verifyStudioAccessCode,
} from "../server/studioAuth.js";

const originalAccessCode = process.env.STUDIO_ACCESS_CODE;
const originalSessionSecret = process.env.STUDIO_SESSION_SECRET;
process.env.STUDIO_ACCESS_CODE = "a-long-random-studio-access-code";
process.env.STUDIO_SESSION_SECRET = "test-only-session-signing-secret-with-enough-bytes";

after(() => {
  if (originalAccessCode === undefined) delete process.env.STUDIO_ACCESS_CODE;
  else process.env.STUDIO_ACCESS_CODE = originalAccessCode;
  if (originalSessionSecret === undefined) delete process.env.STUDIO_SESSION_SECRET;
  else process.env.STUDIO_SESSION_SECRET = originalSessionSecret;
});

test("studio access code comparison accepts only the configured code", () => {
  assert.equal(verifyStudioAccessCode("a-long-random-studio-access-code"), true);
  assert.equal(verifyStudioAccessCode("a-long-random-studio-access-codf"), false);
  assert.equal(verifyStudioAccessCode("a-long-random-studio-access-code-extra"), false);
});

test("studio session cookie is signed, HttpOnly, and expires", () => {
  const request = {
    headers: { host: "xairo.example", "x-forwarded-proto": "https" },
  };
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };

  startStudioSession(request, response);
  const cookie = response.headers["Set-Cookie"];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=43200/);
  request.headers.cookie = cookie.split(";")[0];
  assert.equal(isStudioSessionValid(request), true);
  assert.doesNotThrow(() => requireStudioSession(request));
});

test("studio APIs reject requests without a valid studio session", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await handleApiRequest({
    method: "GET",
    url: "/api/studio/projects",
    headers: { host: "localhost:3000" },
  }, response);
  assert.equal(response.statusCode, 401);
  assert.match(response.payload.error, /access code/i);
});

test("rewritten Vercel API paths dispatch to the requested route", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await handleApiRequest({
    method: "GET",
    url: "/api/router?__route=studio/projects",
    headers: { host: "localhost:3000" },
  }, response);
  assert.equal(response.statusCode, 401);
  assert.match(response.payload.error, /studio access/i);
});

test("studio session endpoint rejects cross-origin unlock attempts", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await handleApiRequest({
    method: "POST",
    url: "/api/studio/session",
    headers: { host: "xairo.example", origin: "https://attacker.example" },
    body: { code: "a-long-random-studio-access-code" },
  }, response);
  assert.equal(response.statusCode, 403);
  assert.match(response.payload.error, /origin/i);
});
