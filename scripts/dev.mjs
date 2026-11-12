// Starts the local API server and the Vite dev server together.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const procs = [];

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
run(path.join(root, "node_modules", ".bin", "vite"), [], "web");

process.on("SIGINT", () => {
  for (const p of procs) p.kill();
  process.exit(0);
});
