import assert from "node:assert/strict";
import test from "node:test";
import { parseProjectUrl } from "../shared/projectLinks.js";

test("YouTube share links resolve to privacy-enhanced embeds", () => {
  const result = parseProjectUrl("https://youtu.be/Abcdef12345?t=15");
  assert.equal(result.provider, "YouTube");
  assert.equal(result.embedUrl, "https://www.youtube-nocookie.com/embed/Abcdef12345");
});

test("TikTok video links resolve to the official player", () => {
  const result = parseProjectUrl("https://www.tiktok.com/@creator/video/7489012345678901234");
  assert.equal(result.provider, "TikTok");
  assert.equal(result.embedUrl, "https://www.tiktok.com/player/v1/7489012345678901234");
});

test("other social URLs are kept as links rather than embedded", () => {
  const result = parseProjectUrl("https://www.instagram.com/p/example/");
  assert.equal(result.provider, "Instagram");
  assert.equal(result.embedUrl, "");
});

test("unsafe and malformed URLs are rejected", () => {
  assert.equal(parseProjectUrl("javascript:alert(1)"), null);
  assert.equal(parseProjectUrl("http://youtube.com/watch?v=Abcdef12345"), null);
  assert.equal(parseProjectUrl("https://user:pass@example.com/project"), null);
  assert.equal(parseProjectUrl("https://youtube.com.evil.test/watch?v=Abcdef12345").embedUrl, "");
});
