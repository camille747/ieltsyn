import { spawn } from "node:child_process";
import { createServer } from "vite";
import electron from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({ root, server: { port: 5176, strictPort: true, host: "127.0.0.1" } });
try {
  await server.listen();
} catch (error) {
  await server.close();
  console.error(error.message);
  process.exit(1);
}
const origin = server.resolvedUrls.local[0];
server.printUrls();
const env = { ...process.env, IELTS_DEV_URL: origin };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [root, ...process.argv.slice(2)], { cwd: root, env, stdio: "inherit" });
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.once("exit", (code) => { void stop(code ?? 0); });
child.once("error", (error) => { console.error(error); void stop(1); });
process.once("SIGINT", () => { void stop(); });
process.once("SIGTERM", () => { void stop(); });
