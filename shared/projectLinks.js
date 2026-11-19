const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const TIKTOK_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const PROVIDER_DOMAINS = [
  ["youtube.com", "YouTube"],
  ["youtu.be", "YouTube"],
  ["youtube-nocookie.com", "YouTube"],
  ["tiktok.com", "TikTok"],
  ["vimeo.com", "Vimeo"],
  ["instagram.com", "Instagram"],
  ["facebook.com", "Facebook"],
  ["fb.watch", "Facebook"],
  ["x.com", "X"],
  ["twitter.com", "X"],
  ["linkedin.com", "LinkedIn"],
  ["twitch.tv", "Twitch"],
  ["behance.net", "Behance"],
  ["soundcloud.com", "SoundCloud"],
  ["threads.net", "Threads"],
];
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function isSubdomainOf(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function getProvider(host) {
  const knownProvider = PROVIDER_DOMAINS.find(([domain]) => isSubdomainOf(host, domain));
  return knownProvider?.[1] || host.replace(/^www\./, "");
}

function getYouTubeVideoId(url) {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host === "www.youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }
  const queryId = url.searchParams.get("v");
  if (queryId) return queryId;
  return url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1] || "";
}

export function parseProjectUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return null;

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const provider = getProvider(host);
  let embedUrl = "";

  if (YOUTUBE_HOSTS.has(host)) {
    const videoId = getYouTubeVideoId(url);
    if (YOUTUBE_ID.test(videoId)) {
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
  } else if (TIKTOK_HOSTS.has(host)) {
    const videoId = url.pathname.match(/\/video\/(\d+)(?:\/|$)/)?.[1];
    if (videoId) embedUrl = `https://www.tiktok.com/player/v1/${videoId}`;
  } else if (VIMEO_HOSTS.has(host)) {
    const videoId = url.pathname.match(/\/(?:video\/)?(\d+)(?:\/|$)/)?.[1];
    if (videoId) embedUrl = `https://player.vimeo.com/video/${videoId}`;
  }

  return { url: url.href, provider, embedUrl };
}
