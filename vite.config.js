import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { startLocalServer } from "./desktop/local-server.mjs";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Use the same resource resolution in browser development and Electron.
function localMaterialsPlugin() {
  return {
    name: "local-study-materials",
    async configureServer(server) {
      const service = await startLocalServer({
        distDirectory: path.join(projectRoot, "public"),
        resourcesDirectory: projectRoot,
        userDataDirectory: path.join(projectRoot, "work", "dev-cache"),
      });
      server.httpServer?.once("close", () => { void service.close(); });
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/api/")) return next();
        const upstream = http.request(new URL(request.url, service.origin), {
          method: request.method,
          headers: request.headers,
        }, (result) => {
          response.writeHead(result.statusCode, result.headers);
          result.pipe(response);
        });
        upstream.on("error", () => {
          if (!response.headersSent) response.writeHead(502);
          response.end("Local materials service unavailable");
        });
        request.pipe(upstream);
      });
    },
  };
}

export default defineConfig({
  cacheDir: path.join(projectRoot, "node_modules/.vite-ielts-main"),
  plugins: [react(), localMaterialsPlugin()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, watch: { usePolling: true, interval: 750, ignored: ["**/speaking-app/dist/**", "**/work/**", "**/release/**"] } },
});
