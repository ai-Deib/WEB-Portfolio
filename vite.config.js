import { defineConfig, loadEnv } from "vite";
import { handleApiRequest } from "./server/api.js";

function localApiPlugin() {
  return {
    name: "xairo-local-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/")) {
          next();
          return;
        }

        try {
          if (!["GET", "HEAD"].includes(request.method || "GET")) {
            const body = await new Promise((resolve, reject) => {
              const chunks = [];
              let size = 0;
              request.on("data", (chunk) => {
                size += chunk.length;
                if (size > 64 * 1024) {
                  reject(Object.assign(new Error("API JSON request is too large."), { status: 413 }));
                  return;
                }
                chunks.push(chunk);
              });
              request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
              request.on("error", reject);
            });
            request.body = body;
          }

          const apiResponse = {
            setHeader: (...args) => response.setHeader(...args),
            status(status) {
              response.statusCode = status;
              return this;
            },
            json(payload) {
              response.end(JSON.stringify(payload));
              return this;
            },
          };
          await handleApiRequest(request, apiResponse);
        } catch (error) {
          response.statusCode = error.status || 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: error.message || "The local API request failed." }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  for (const [name, value] of Object.entries(environment)) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
  return { plugins: [localApiPlugin()] };
});
