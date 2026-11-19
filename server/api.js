import { randomUUID } from "node:crypto";
import { parseProjectUrl } from "../shared/projectLinks.js";
import {
  HttpError,
  readJsonBody,
  requireMethod,
  requireSameOrigin,
  sendJson,
} from "./http.js";
import {
  getAdminClient,
  getPublicFileUrl,
  STORAGE_BUCKET,
  throwIfSupabaseError,
} from "./supabase.js";
import {
  clearStudioSession,
  getRateLimitKey,
  isStudioSessionValid,
  requireStudioSession,
  startStudioSession,
  verifyStudioAccessCode,
} from "./studioAuth.js";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const FILE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
  ["video/mp4", "mp4"],
]);
const SOCIAL_PRESETS = new Set([
  "instagram", "youtube", "x", "tiktok", "discord", "linkedin",
  "behance", "github", "spotify", "email", "website",
]);
const ALL_WORK = "All work";

function requireText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${label} is required and must be no longer than ${maxLength} characters.`);
  }
  return value.trim();
}

function requireObjectPath(value, prefix, label) {
  if (typeof value !== "string" || !value.startsWith(`${prefix}/`) || value.includes("..")) {
    throw new HttpError(400, `${label} is not a valid uploaded file.`);
  }
  return value;
}

function projectFromRow(client, row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    client: row.client,
    year: row.year,
    fileType: row.file_type,
    mediaPath: row.media_path,
    mediaUrl: getPublicFileUrl(client, row.media_path),
    externalUrl: row.external_url || "",
    posterPath: row.poster_path || "",
    posterUrl: getPublicFileUrl(client, row.poster_path),
    archived: row.archived,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function socialFromRow(client, row) {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle || "",
    url: row.url,
    logoPreset: row.logo_preset,
    logoPath: row.logo_path || "",
    logoUrl: getPublicFileUrl(client, row.logo_path),
    order: row.display_order,
  };
}

function socialToRow(value) {
  const name = requireText(value.name, "Platform name", 40);
  const url = requireText(value.url, "Link URL", 240);
  if (!/^(https?:\/\/|mailto:|\/|#)/i.test(url)) {
    throw new HttpError(400, "Enter a valid http, https, mailto, relative, or anchor link.");
  }
  const preset = SOCIAL_PRESETS.has(value.logoPreset) ? value.logoPreset : "website";
  return {
    id: requireText(value.id, "Social link ID", 100),
    name,
    handle: typeof value.handle === "string" ? value.handle.trim().slice(0, 80) : "",
    url,
    logo_preset: preset,
    logo_path: value.logoPath ? requireObjectPath(value.logoPath, "socials", "Logo") : null,
    display_order: Number.isInteger(value.order) && value.order >= 0 ? value.order : 0,
  };
}

function ensureNoSupabaseError(result, message) {
  return throwIfSupabaseError(result, message);
}

async function handlePublicPortfolio(response) {
  const client = getAdminClient();
  const [projectsResult, groupsResult, socialsResult] = await Promise.all([
    client.from("portfolio_projects").select("*").eq("archived", false).order("created_at", { ascending: false }),
    client.from("portfolio_groups").select("name").order("display_order", { ascending: true }),
    client.from("portfolio_socials").select("*").order("display_order", { ascending: true }),
  ]);
  const projects = ensureNoSupabaseError(projectsResult, "Could not load public projects.");
  const groups = ensureNoSupabaseError(groupsResult, "Could not load portfolio groups.");
  const socials = ensureNoSupabaseError(socialsResult, "Could not load public social links.");
  return sendJson(response, 200, {
    projects: projects.map((project) => projectFromRow(client, project)),
    groups: groups.map((group) => group.name),
    socials: socials.map((social) => socialFromRow(client, social)),
  });
}

async function handleStudioSession(request, response) {
  requireMethod(request, ["GET", "POST", "DELETE"]);
  if (request.method === "GET") {
    if (isStudioSessionValid(request)) return sendJson(response, 200, { authenticated: true });
    clearStudioSession(request, response);
    return sendJson(response, 401, { error: "Enter the studio access code to continue." });
  }

  requireSameOrigin(request);
  if (request.method === "DELETE") {
    clearStudioSession(request, response);
    return sendJson(response, 200, { authenticated: false });
  }

  const body = readJsonBody(request);
  const client = getAdminClient();
  const rateLimitKey = getRateLimitKey(request);
  if (!verifyStudioAccessCode(body.code)) {
    const attempt = await client.rpc("record_studio_failed_login", { p_ip_hash: rateLimitKey });
    const attemptCount = ensureNoSupabaseError(attempt, "Could not check the access-code rate limit.");
    if (attemptCount >= 10) {
      throw new HttpError(429, "Too many incorrect codes. Wait 15 minutes before trying again.");
    }
    throw new HttpError(401, "That access code is not correct.");
  }
  const clearedAttempts = await client.rpc("clear_studio_failed_logins", { p_ip_hash: rateLimitKey });
  ensureNoSupabaseError(clearedAttempts, "Could not reset the access-code rate limit.");
  startStudioSession(request, response);
  return sendJson(response, 200, { authenticated: true });
}

async function handleProjects(request, response) {
  requireMethod(request, ["GET", "POST", "DELETE"]);
  if (request.method !== "GET") requireSameOrigin(request);
  requireStudioSession(request);
  const client = getAdminClient();

  if (request.method === "GET") {
    const result = await client.from("portfolio_projects").select("*").order("created_at", { ascending: false });
    return sendJson(response, 200, ensureNoSupabaseError(result, "Could not load studio projects.").map((row) => projectFromRow(client, row)));
  }

  if (request.method === "DELETE") {
    const body = readJsonBody(request);
    const id = requireText(body.id, "Project ID", 100);
    const existing = await client.from("portfolio_projects").select("media_path, poster_path").eq("id", id).maybeSingle();
    const row = ensureNoSupabaseError(existing, "Could not find that project.");
    if (!row) throw new HttpError(404, "That project no longer exists.");
    const deleted = await client.from("portfolio_projects").delete().eq("id", id);
    ensureNoSupabaseError(deleted, "Could not remove the project.");
    const paths = [row.media_path, row.poster_path].filter(Boolean);
    let warning = "";
    if (paths.length) {
      const cleanup = await client.storage.from(STORAGE_BUCKET).remove(paths);
      if (cleanup.error) {
        console.error("Project removed but its media cleanup failed.", cleanup.error);
        warning = "The project was deleted, but its media could not be removed from storage.";
      }
    }
    return sendJson(response, 200, { deleted: true, warning });
  }

  const body = readJsonBody(request);
  const id = requireText(body.id, "Project ID", 100);
  const fileType = requireText(body.fileType, "Media type", 80);
  let mediaPath = null;
  let posterPath = null;
  let externalUrl = null;
  if (fileType === "external") {
    const projectLink = parseProjectUrl(body.externalUrl);
    if (!projectLink) throw new HttpError(400, "Enter a valid HTTPS social or project URL.");
    externalUrl = projectLink.url;
    if (body.mediaPath || body.posterPath) {
      throw new HttpError(400, "External projects cannot include uploaded media paths.");
    }
  } else {
    if (!FILE_EXTENSIONS.has(fileType)) {
      throw new HttpError(400, "Choose a supported image or video file.");
    }
    mediaPath = requireObjectPath(body.mediaPath, "projects", "Project media");
    if (fileType === "video/mp4" && !mediaPath.toLocaleLowerCase().endsWith(".mp4")) {
      throw new HttpError(400, "Uploaded videos must be encoded as MP4.");
    }
    posterPath = body.posterPath ? requireObjectPath(body.posterPath, "posters", "Poster") : null;
  }
  const category = requireText(body.category, "Portfolio group", 40);
  const timestamp = Number(body.createdAt);
  const requestedDate = new Date(timestamp);
  const createdAt = Number.isFinite(requestedDate.getTime()) ? requestedDate.toISOString() : new Date().toISOString();
  const record = {
    id,
    title: requireText(body.title, "Project name", 80),
    category,
    description: typeof body.description === "string" ? body.description.trim().slice(0, 240) : "",
    client: typeof body.client === "string" ? body.client.trim().slice(0, 60) : "",
    year: typeof body.year === "string" ? body.year.slice(0, 4) : String(new Date().getFullYear()),
    file_type: fileType,
    media_path: mediaPath,
    external_url: externalUrl,
    poster_path: posterPath,
    archived: body.archived === true,
    created_at: createdAt,
  };
  const result = await client.from("portfolio_projects").upsert(record).select("*").single();
  const saved = ensureNoSupabaseError(result, "Could not save the project.");
  return sendJson(response, 200, projectFromRow(client, saved));
}

async function handleGroups(request, response) {
  requireMethod(request, ["GET", "POST", "DELETE"]);
  if (request.method !== "GET") requireSameOrigin(request);
  requireStudioSession(request);
  const client = getAdminClient();

  if (request.method === "GET") {
    const result = await client.from("portfolio_groups").select("name").order("display_order", { ascending: true });
    return sendJson(response, 200, ensureNoSupabaseError(result, "Could not load portfolio groups.").map((group) => group.name));
  }

  const body = readJsonBody(request);
  if (request.method === "POST") {
    const name = requireText(body.name, "Group name", 40);
    if (name.toLocaleLowerCase() === ALL_WORK.toLocaleLowerCase()) {
      throw new HttpError(400, `“${ALL_WORK}” is reserved for the public filter.`);
    }
    const existing = await client.from("portfolio_groups").select("name, display_order");
    const groups = ensureNoSupabaseError(existing, "Could not check existing portfolio groups.");
    if (groups.some((group) => group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new HttpError(409, "A group with that name already exists.");
    }
    const displayOrder = groups.reduce((max, group) => Math.max(max, group.display_order), -1) + 1;
    const result = await client.from("portfolio_groups").insert({ name, display_order: displayOrder });
    ensureNoSupabaseError(result, "Could not save the new portfolio group.");
    return sendJson(response, 201, { name });
  }

  const name = requireText(body.name, "Group name", 40);
  const reassignTo = body.reassignTo ? requireText(body.reassignTo, "Destination group", 40) : null;
  const result = await client.rpc("delete_portfolio_group", {
    group_name: name,
    reassign_to: reassignTo,
  });
  if (result.error) {
    const message = result.error.message || "Could not remove the portfolio group.";
    throw new HttpError(400, message);
  }
  return sendJson(response, 200, { deleted: name });
}

async function handleSocials(request, response) {
  requireMethod(request, ["GET", "POST", "DELETE", "PUT"]);
  if (request.method !== "GET") requireSameOrigin(request);
  requireStudioSession(request);
  const client = getAdminClient();

  if (request.method === "GET") {
    const result = await client.from("portfolio_socials").select("*").order("display_order", { ascending: true });
    return sendJson(response, 200, ensureNoSupabaseError(result, "Could not load social links.").map((row) => socialFromRow(client, row)));
  }

  const body = readJsonBody(request);
  if (request.method === "POST") {
    const record = socialToRow(body);
    const existing = await client.from("portfolio_socials").select("logo_path").eq("id", record.id).maybeSingle();
    const old = ensureNoSupabaseError(existing, "Could not check the existing social link.");
    const result = await client.from("portfolio_socials").upsert(record).select("*").single();
    const saved = ensureNoSupabaseError(result, "Could not save the social link.");
    let warning = "";
    if (old?.logo_path && old.logo_path !== saved.logo_path) {
      const cleanup = await client.storage.from(STORAGE_BUCKET).remove([old.logo_path]);
      if (cleanup.error) {
        console.error("Social link saved but its previous logo cleanup failed.", cleanup.error);
        warning = "The link was saved, but its previous logo could not be removed.";
      }
    }
    return sendJson(response, 200, { ...socialFromRow(client, saved), warning });
  }

  if (request.method === "DELETE") {
    const id = requireText(body.id, "Social link ID", 100);
    const existing = await client.from("portfolio_socials").select("logo_path").eq("id", id).maybeSingle();
    const row = ensureNoSupabaseError(existing, "Could not find that social link.");
    if (!row) throw new HttpError(404, "That social link no longer exists.");
    const deleted = await client.from("portfolio_socials").delete().eq("id", id);
    ensureNoSupabaseError(deleted, "Could not remove the social link.");
    let warning = "";
    if (row.logo_path) {
      const cleanup = await client.storage.from(STORAGE_BUCKET).remove([row.logo_path]);
      if (cleanup.error) {
        console.error("Social link removed but its logo cleanup failed.", cleanup.error);
        warning = "The link was deleted, but its logo could not be removed from storage.";
      }
    }
    return sendJson(response, 200, { deleted: true, warning });
  }

  if (!Array.isArray(body.socials)) throw new HttpError(400, "A list of social links is required.");
  const records = body.socials.map(socialToRow);
  const oldRows = await client.from("portfolio_socials").select("logo_path");
  const oldPaths = ensureNoSupabaseError(oldRows, "Could not load existing social logos.")
    .map((row) => row.logo_path).filter(Boolean);
  const result = await client.rpc("reset_portfolio_socials", { social_items: records });
  if (result.error) {
    console.error("Could not restore default social links.", result.error);
    throw new HttpError(500, "Could not restore default social links.");
  }
  let cleanupWarning = false;
  if (oldPaths.length) {
    const cleanup = await client.storage.from(STORAGE_BUCKET).remove(oldPaths);
    if (cleanup.error) {
      console.error("Social links reset but some logos could not be removed.", cleanup.error);
      cleanupWarning = true;
    }
  }
  const refreshed = await client.from("portfolio_socials").select("*").order("display_order", { ascending: true });
  return sendJson(response, 200, {
    socials: ensureNoSupabaseError(refreshed, "Could not reload social links.").map((row) => socialFromRow(client, row)),
    warning: cleanupWarning ? "Default links were restored, but some old logos may remain in storage." : "",
  });
}

async function handleUpload(request, response) {
  requireMethod(request, ["POST", "DELETE"]);
  requireSameOrigin(request);
  requireStudioSession(request);
  const client = getAdminClient();
  const body = readJsonBody(request);

  if (request.method === "DELETE") {
    if (!Array.isArray(body.paths) || body.paths.length === 0 || body.paths.length > 3) {
      throw new HttpError(400, "Provide one to three uploaded file paths to remove.");
    }
    const paths = body.paths.map((path) => {
      if (typeof path !== "string" || !/^(projects|posters|socials)\/[a-zA-Z0-9._-]+$/.test(path)) {
        throw new HttpError(400, "One of the uploaded file paths is invalid.");
      }
      return path;
    });
    const result = await client.storage.from(STORAGE_BUCKET).remove(paths);
    if (result.error) throw new HttpError(500, "Could not remove the uploaded files.");
    return sendJson(response, 200, { deleted: paths.length });
  }

  const { kind, fileType, size } = body;
  const extension = FILE_EXTENSIONS.get(fileType);
  const isImage = typeof fileType === "string" && fileType.startsWith("image/");
  if (!["project", "poster", "social-logo"].includes(kind) || !extension || (!isImage && kind !== "project")) {
    throw new HttpError(400, "Choose a supported image or video file.");
  }
  const fileSize = Number(size);
  const maxBytes = kind === "social-logo" ? 5 * 1024 * 1024 : MAX_UPLOAD_BYTES;
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxBytes) {
    throw new HttpError(413, `The selected file must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller.`);
  }

  const directory = kind === "project" ? "projects" : kind === "poster" ? "posters" : "socials";
  const path = `${directory}/${randomUUID()}.${extension}`;
  const result = await client.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
  const signedUpload = ensureNoSupabaseError(result, "Could not prepare the media upload.");
  return sendJson(response, 200, {
    bucket: STORAGE_BUCKET,
    path,
    token: signedUpload.token,
  });
}

export async function handleApiRequest(request, response) {
  try {
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const route = url.searchParams.get("__route") || url.pathname.replace(/^\/api\/?/, "");
    if (route === "public") {
      requireMethod(request, ["GET"]);
      return await handlePublicPortfolio(response);
    }
    if (route === "studio/session") return await handleStudioSession(request, response);

    const handlers = {
      "studio/projects": handleProjects,
      "studio/groups": handleGroups,
      "studio/socials": handleSocials,
      "studio/uploads": handleUpload,
    };
    const handler = handlers[route];
    if (!handler) throw new HttpError(404, "This API route does not exist.");
    return await handler(request, response);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error("XAIRO API request failed.", error);
    const message = error instanceof HttpError ? error.message : "The backend request failed. Check the server logs and Supabase setup.";
    return sendJson(response, status, { error: message });
  }
}
