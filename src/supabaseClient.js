import { createClient } from "@supabase/supabase-js";

let storageClient;

export function getStorageClient() {
  if (storageClient) return storageClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before uploading media.");
  }

  storageClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return storageClient;
}
