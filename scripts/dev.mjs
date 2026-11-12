// Starts the local API server and the Vite dev server together.
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const apiPort = Number(process.env.API_PORT ?? 8787);
const procs = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function apiIsUp() {
  return new Promise((resolve) => {
    const sock = createConnection({ port: apiPort, host: "127.0.0.1" });
    sock.setTimeout(300);
    sock.once("connect", () => (sock.destroy(), resolve(true)));
    const down = () => (sock.destroy(), resolve(false));
    sock.once("timeout", down);
    sock.once("error", down);
  });
}

// Vite's /api proxy answers 500 while its target port has nothing behind it,
// so the browser's first (automatic) search could fail on a cold start.
async function waitForApi() {
  for (let i = 0; i < 100; i++) {
    if (await apiIsUp()) return true;
    await sleep(100);
  }
  return false;
}

function run(cmd, args, label) {
  const p = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: false });
  p.on("exit", (code) => {
    console.log(`[${label}] exited (${code})`);
    for (const q of procs) if (q !== p) q.kill();
    process.exit(code ?? 0);
  });
  procs.push(p);
}

run(process.execPath, [path.join(root, "server", "server.ts")], "api");
if (!(await waitForApi())) {
  console.error(`[api] not accepting connections on :${apiPort} after 10s — starting Vite anyway`);
}
run(path.join(root, "node_modules", ".bin", "vite"), [], "web");

process.on("SIGINT", () => {
  for (const p of procs) p.kill();
  process.exit(0);
});
