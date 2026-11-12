import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createConnection } from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_PORT = Number(process.env.API_PORT ?? 8787);
const API_TARGET = `http://localhost:${API_PORT}`;
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True when something is already accepting connections on the API port. */
function apiIsUp(): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port: API_PORT, host: "127.0.0.1" });
    sock.setTimeout(300);
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    const down = () => {
      sock.destroy();
      resolve(false);
    };
    sock.once("timeout", down);
    sock.once("error", down);
  });
}

/**
 * Boots server/server.ts alongside the dev server.
 *
 * `npm run dev:web` used to start Vite only, so every /api call was proxied to
 * a port with nothing behind it and the browser saw an opaque
 * "500 Internal Server Error" with an empty body. This plugin makes any Vite
 * launch self-sufficient, and waits for the API to accept connections before
 * the browser is allowed to make its first request.
 */
function localApiServer() {
  let child: ReturnType<typeof spawn> | null = null;
  return {
    name: "fuel-finder:local-api-server",
    apply: "serve" as const,
    async configureServer() {
      // Vitest runs the plugin container too — never spawn a server from a test run.
      if (process.env.VITEST) return;
      if (await apiIsUp()) {
        console.log(`[api] reusing API server already listening on ${API_TARGET}`);
        return;
      }
      child = spawn(process.execPath, [path.join(projectRoot, "server", "server.ts")], {
        cwd: projectRoot,
        stdio: "inherit",
      });
      child.on("exit", (code) => {
        child = null;
        console.error(`[api] server exited (${code}) — /api requests will fail until it is restarted`);
      });
      for (let i = 0; i < 100; i++) {
        if (await apiIsUp()) break;
        await sleep(100);
      }
      // NOTE: do NOT kill from server.httpServer "close" — that event also fires
      // on `vite.config.ts changed, restarting server`, where the incoming server
      // has just decided to reuse this same child. Killing there leaves the new
      // proxy pointing at a dead port (the very 502/500 this file prevents).
      const stop = () => child?.kill();
      process.once("exit", stop);
    },
  };
}

export default defineConfig({
  plugins: [react(), localApiServer()],
  server: {
    port: 5173,
    proxy: {
      // All /api calls go through the local Node server (geocoding +
      // Overpass with a proper User-Agent; future price-API keys stay
      // server-side).
      "/api": {
        target: API_TARGET,
        // A dead/unreachable API server must never surface as a bare 500:
        // say what is missing, in the shape src/api.ts already renders.
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            const where = req?.url ?? "/api";
            const msg =
              (err as { code?: string })?.code === "ECONNREFUSED"
                ? `Local API server is not running on ${API_TARGET}. Start it with "npm run dev" or "npm run dev:server".`
                : `Proxy error for ${where}: ${(err as Error)?.message ?? err}`;
            console.error(`[api proxy] ${msg}`);
            // res is an http.ServerResponse or a raw socket, depending on how far
            // the request got.
            const out = res as unknown as {
              headersSent?: boolean;
              writeHead?: (status: number, headers: Record<string, string>) => void;
              end?: (body: string) => void;
              destroy?: () => void;
            };
            if (typeof out?.writeHead === "function" && !out.headersSent) {
              out.writeHead(502, { "Content-Type": "application/json" });
              out.end?.(JSON.stringify({ error: msg }));
            } else if (typeof out?.destroy === "function") {
              out.destroy();
            }
          });
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
