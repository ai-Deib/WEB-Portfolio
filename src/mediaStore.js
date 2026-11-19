import { DEFAULT_SOCIALS } from "./socialIcons";
import { getStorageClient } from "./supabaseClient";

const PORTFOLIO_UPDATED_KEY = "xairo-portfolio-updated";

export const DEFAULT_GROUPS = ["Documentary", "Longform", "Motion Graphics", "SaaS", "Shortform", "Typography"];

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    if (response.ok) throw new Error("The backend returned an unreadable response.");
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/studio/session") {
      window.dispatchEvent(new Event("xairo:studio-expired"));
    }
    throw new ApiError(response.status, payload.error || `The request failed (${response.status}).`);
  }
  return payload;
}

function announcePortfolioChange() {
  try {
    localStorage.setItem(PORTFOLIO_UPDATED_KEY, String(Date.now()));
  } catch {
    // Same-tab subscribers still receive the event if browser storage is unavailable.
  }
  window.dispatchEvent(new Event("xairo:portfolio-change"));
}

export function subscribeToPortfolioChange(listener) {
  function handleStorage(event) {
    if (event.key === PORTFOLIO_UPDATED_KEY) listener();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener("xairo:portfolio-change", listener);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("xairo:portfolio-change", listener);
  };
}

export function getPublicPortfolio() {
  return request("/api/public");
}

export function getProjects() {
  return request("/api/studio/projects");
}

export async function uploadMediaFile(file, kind, onProgress) {
  let uploadFile = file;
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
  if (kind === "project" && isVideo) {
    const { transcodeVideoToMp4 } = await import("./videoTranscoder.js");
    onProgress?.({ phase: "compressing", progress: 0 });
    uploadFile = await transcodeVideoToMp4(file, (progress) => {
      onProgress?.({ phase: "compressing", progress });
    });
  }

  const signedUpload = await request("/api/studio/uploads", {
    method: "POST",
    body: { kind, fileType: uploadFile.type, size: uploadFile.size },
  });
  onProgress?.({ phase: "uploading" });
  const { error } = await getStorageClient()
    .storage
    .from(signedUpload.bucket)
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, uploadFile, {
      contentType: uploadFile.type,
      cacheControl: "3600",
    });
  if (error) {
    let message = `Could not upload ${file.name || "the selected file"}: ${error.message}`;
    try {
      await deleteUploadedFiles([signedUpload.path]);
    } catch {
      message += " The incomplete file may need to be removed from Supabase Storage.";
    }
    throw new Error(message);
  }
  return { path: signedUpload.path, file: uploadFile };
}

export function deleteUploadedFiles(paths) {
  if (paths.length === 0) return Promise.resolve();
  return request("/api/studio/uploads", { method: "DELETE", body: { paths } });
}

export async function saveProject(project) {
  const record = {
    id: project.id,
    title: project.title,
    category: project.category,
    description: project.description,
    client: project.client,
    year: project.year,
    fileType: project.fileType,
    mediaPath: project.mediaPath,
    posterPath: project.posterPath,
    archived: project.archived,
    createdAt: project.createdAt,
  };
  const saved = await request("/api/studio/projects", { method: "POST", body: record });
  announcePortfolioChange();
  return saved;
}

export async function deleteProject(id) {
  const result = await request("/api/studio/projects", { method: "DELETE", body: { id } });
  announcePortfolioChange();
  return result;
}

export async function getGroups() {
  return request("/api/studio/groups");
}

export async function saveGroup(name) {
  const result = await request("/api/studio/groups", { method: "POST", body: { name } });
  announcePortfolioChange();
  return result.name;
}

export async function deleteGroup(name, reassignTo) {
  const result = await request("/api/studio/groups", {
    method: "DELETE",
    body: { name, reassignTo },
  });
  announcePortfolioChange();
  return result;
}

export function getSocials() {
  return request("/api/studio/socials");
}

export async function saveSocial(social) {
  const record = {
    id: social.id,
    name: social.name,
    handle: social.handle,
    url: social.url,
    logoPreset: social.logoPreset,
    logoPath: social.logoPath,
    order: social.order,
  };
  const saved = await request("/api/studio/socials", { method: "POST", body: record });
  announcePortfolioChange();
  return saved;
}

export async function deleteSocial(id) {
  const result = await request("/api/studio/socials", { method: "DELETE", body: { id } });
  announcePortfolioChange();
  return result;
}

export async function resetSocialsToDefault() {
  const result = await request("/api/studio/socials", {
    method: "PUT",
    body: { socials: DEFAULT_SOCIALS },
  });
  announcePortfolioChange();
  return result;
}
