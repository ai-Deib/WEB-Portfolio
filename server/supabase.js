import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./http.js";

export const STORAGE_BUCKET = "portfolio-media";

let adminClient;

export function getAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new HttpError(503, "Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the backend.");
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

export function getPublicFileUrl(client, path) {
  if (!path) return "";
  return client.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function throwIfSupabaseError(result, message) {
  if (result.error) {
    console.error(message, result.error);
    throw new HttpError(500, message);
  }
  return result.data;
}
