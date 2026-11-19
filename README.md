# XAIRO portfolio

A React portfolio with a public page, a shared Supabase content backend, and a code-protected studio.

## Backend setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). This creates the portfolio tables, seeds the starter groups and social links, enables row-level security, and creates the public media bucket.
3. Copy the project URL, public anon/publishable key, and service-role/secret key from the Supabase API settings. The service-role key is server-only and must never be given a `VITE_` name or committed.
4. Create local secrets with Node, running the command twice to get two different values:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

5. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the server functions.
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for signed browser uploads. The anon/publishable key is public; database writes still go through the protected server API.
   - `STUDIO_ACCESS_CODE` with a long random code, and `STUDIO_SESSION_SECRET` with the other generated value.

## Run locally

```sh
npm install
npm run dev
```

Open `/` for the public page and `/studio` to manage projects, archive status, groups, and social links. The local Vite server runs the same API handlers as Vercel; Supabase environment variables must be configured first. `npm test` runs the focused studio access-control tests.

If this browser contains content from the old IndexedDB version, unlock `/studio` in that same browser and use the offered import action to move its projects, groups, and socials into Supabase. The original browser data is not deleted.

## Access and publishing

The public portfolio and its media are readable without login. Studio writes are protected by a server-verified shared access code and a signed, HttpOnly cookie; the session expires after 12 hours. Ten incorrect codes from the same IP in 15 minutes are rate-limited. Changing `STUDIO_ACCESS_CODE` stops new access; rotate `STUDIO_SESSION_SECRET` as well to invalidate existing sessions.

Uploaded media is stored in the public `portfolio-media` Supabase bucket so visitors can view it. Project media and posters are limited to 50 MB each; custom social logos are limited to 5 MB. Do not upload private files.

## Deploy to Vercel

1. Push the project to a Git provider supported by Vercel and import the repository.
2. Select the Vite framework preset, use `npm run build` as the build command, and set `dist` as the output directory. Vercel detects the API function in `api/` and the `/studio` rewrite in `vercel.json`.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STUDIO_ACCESS_CODE`, and `STUDIO_SESSION_SECRET` as Vercel server environment variables. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the build. Configure them for Production; use a separate Supabase project for Preview deployments if you enable the backend there.
4. Deploy and verify `/`, `/studio`, and `/api/public`. Enter the access code at `/studio`; no login is required for public visitors.

Never expose or commit `SUPABASE_SERVICE_ROLE_KEY`, `STUDIO_ACCESS_CODE`, or `STUDIO_SESSION_SECRET`. The repository ignores local `.env` files; use Vercel's encrypted environment-variable settings for deployment.

## Fonts

Archivo is used for display headings as a Google Fonts alternative to Coolvetica; its grotesque sans-serif letterforms are a close fit for the original display style. DM Sans remains in use for descriptions and navigation, and Manrope for the XAIRO logo.
