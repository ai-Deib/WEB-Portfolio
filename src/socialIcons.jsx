import React from "react";

export const SOCIAL_PRESETS = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X / Twitter" },
  { id: "tiktok", label: "TikTok" },
  { id: "discord", label: "Discord" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "behance", label: "Behance" },
  { id: "github", label: "GitHub" },
  { id: "spotify", label: "Spotify" },
  { id: "email", label: "Email" },
  { id: "website", label: "Website" },
];

export const DEFAULT_SOCIALS = [
  {
    id: "social-instagram",
    name: "Instagram",
    handle: "@xairo.studio",
    url: "https://instagram.com/",
    logoPreset: "instagram",
    order: 0,
  },
  {
    id: "social-youtube",
    name: "YouTube",
    handle: "youtube.com/@xairo",
    url: "https://youtube.com/",
    logoPreset: "youtube",
    order: 1,
  },
  {
    id: "social-x",
    name: "X / Twitter",
    handle: "@xairo",
    url: "https://x.com/",
    logoPreset: "x",
    order: 2,
  },
  {
    id: "social-email",
    name: "Email",
    handle: "hello@xairo.studio",
    url: "mailto:hello@xairo.studio",
    logoPreset: "email",
    order: 3,
  },
];

export function sanitizeLinkUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/|$)/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return "";
}

export function formatDirectoryLabel(url) {
  if (!url) return "";
  if (url.startsWith("mailto:")) {
    return url.slice("mailto:".length);
  }
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

export function SocialPresetIcon({ preset }) {
  switch (preset) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2.5" y="5" width="19" height="14" rx="4" />
          <polygon points="10 9.2 15.5 12 10 14.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 3H21l-6.52 7.45L22 21h-5.88l-4.61-6.03L6.23 21H3.47l6.97-7.97L3 3h6.03l4.16 5.51L18.244 3zm-1.03 16.24h1.53L7.86 4.67H6.22l10.994 14.57z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 4v10.5a3.5 3.5 0 1 1-3-3.46" />
          <path d="M14 4c.8 2.4 2.6 4 5 4.3" />
        </svg>
      );
    case "discord":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8.5 6.5a12 12 0 0 1 7 0l1.5.7c1.6 2.5 2.3 5.4 2 8.8-1.5 1.1-3.1 1.7-4.7 2l-.9-1.5M15.5 18.5c-2.3.5-4.7.5-7 0m2.1-2-1 1.5c-1.6-.3-3.2-.9-4.7-2-.3-3.4.4-6.3 2-8.8l1.6-.7" />
          <circle cx="9.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 11v5M8 8v.01M12 16v-5m0 2a2.5 2.5 0 0 1 5 0v3" />
        </svg>
      );
    case "behance":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h4.5a2.2 2.2 0 0 1 0 4.4H4V7zm0 4.4h5a2.4 2.4 0 0 1 0 4.8H4v-4.8z" />
          <path d="M14.5 7.5h4.5M14 13.5h6a3 3 0 1 0-1.1 2.4" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
        </svg>
      );
    case "spotify":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 9.8c2.8-.8 5.8-.6 8.3.6M8.7 12.8c2.2-.6 4.7-.4 6.7.5M9.5 15.7c1.7-.4 3.5-.3 5 .4" />
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "website":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
  }
}

export function SocialLogo({ social, className = "" }) {
  if (social.logoUrl) {
    return (
      <span className={`social-logo-badge has-image ${className}`.trim()}>
        <img src={social.logoUrl} alt="" />
      </span>
    );
  }
  return (
    <span className={`social-logo-badge ${className}`.trim()}>
      <SocialPresetIcon preset={social.logoPreset || "website"} />
    </span>
  );
}
