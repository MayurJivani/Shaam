/**
 * Runs the relay and Astro together, both on 0.0.0.0, so phones on the wifi can
 * reach the pages the TV is showing. Trimmed from Noggin's scripts/dev.js.
 */
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const astroBin = path.join(path.dirname(require.resolve("astro/package.json")), "bin/astro.mjs")
const children = []

function run(cmd, args) {
  const child = spawn(cmd, args, { stdio: "inherit" })
  child.on("exit", (code) => code && shutdown(code))
  children.push(child)
}

function shutdown(code = 0) {
  for (const c of children) if (!c.killed) c.kill("SIGTERM")
  process.exit(code)
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

// --watch restarts the relay on rule changes; live rooms are lost, which is fine in dev.
run(process.execPath, ["--watch", "server/index.js"])
run(process.execPath, [astroBin, "dev", "--host"])
