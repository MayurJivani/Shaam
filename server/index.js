/**
 * Shaam relay, one process on one port:
 *   HTTP  GET  /api/net                      LAN addresses, so a TV on localhost prints a QR a phone can open
 *         POST /api/parties/:code/results    an outside game reporting standings (GAMES.md)
 *         everything else                    the built site in dist/
 *   WS    /ws                                parties and built-in game rooms
 *
 * The relay is the referee: clients send intent, the engines decide, and every
 * screen gets back only the view it is allowed to see.
 */
import { createHash, randomBytes, randomInt } from "node:crypto"
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { networkInterfaces } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { WebSocketServer } from "ws"

import { gameBySlug } from "../shared/games.js"
import * as reverie from "./games/reverie.js"
import * as P from "./party.js"

const PORT = Number(process.env.SHAAM_PORT ?? 4401)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIST = path.resolve(process.env.SHAAM_DIST_DIR ?? path.join(ROOT, "dist"))
const ROOM_IDLE_MS = 30 * 60_000
const ENGINES = { reverie } // built-in games by slug; each follows the contract in GAMES.md

P.loadParties(path.resolve(process.env.SHAAM_DATA_DIR ?? path.join(ROOT, "data")))

const log = (msg, extra = {}) => process.stdout.write(JSON.stringify({ time: new Date().toISOString(), msg, ...extra }) + "\n")
const hash = (t) => createHash("sha256").update(t).digest("hex")

/** code -> { engine, state, keyHash, reported, emptySince } */
const rooms = new Map()
const conns = new Set()

const LETTERS = "BCDFGHJKLMNPQRSTVWXZ" // no vowels, so no code spells a word
function newCode() {
  for (;;) {
    const code = Array.from({ length: 4 }, () => LETTERS[randomInt(LETTERS.length)]).join("")
    if (!rooms.has(code) && !P.parties.has(code)) return code
  }
}

const send = (ws, obj) => ws.readyState === 1 && ws.send(JSON.stringify(obj))

function pushParty(code) {
  const party = P.parties.get(code)
  if (!party) return
  const body = P.publicParty(party)
  for (const c of conns) if (c.party === code) send(c.ws, { t: "party", party: body, host: !!c.partyHost })
}

function pushRoom(code) {
  const room = rooms.get(code)
  if (!room) return
  const now = Date.now()
  for (const c of conns) if (c.room === code) send(c.ws, { t: "game", view: room.engine.view(room.state, c.playerId ?? null, now), host: !!c.host })
  // A finished game reports to its party once, then the party shelf comes back on every screen.
  const standings = !room.reported && room.state.party && room.engine.standings(room.state)
  if (standings) {
    room.reported = true
    const party = P.parties.get(room.state.party)
    if (party && P.recordResult(party, room.engine.slug, standings) === null) {
      P.saveSoon(party)
      pushParty(party.code)
    }
  }
}

function newRoom(engine, partyCode) {
  const code = newCode()
  const key = randomBytes(18).toString("base64url")
  rooms.set(code, { engine, state: engine.createRoom({ code, party: partyCode }), keyHash: hash(key), reported: false, emptySince: null })
  log("room created", { code, game: engine.slug, party: partyCode })
  return { code, key }
}

/** Point a party at a fresh built-in room and hand its TV the host key. */
function launchBuiltIn(party, engine) {
  const { code, key } = newRoom(engine, party.code)
  party.current = { game: engine.slug, room: code }
  P.saveSoon(party)
  return { code, key }
}

const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "")

function onMessage(c, msg) {
  switch (msg.t) {
    // ---- party ----------------------------------------------------------
    case "party.host": {
      let party = P.parties.get(str(msg.code))
      let key = str(msg.key)
      if (!party || !P.isHost(party, key)) ({ party, key } = P.createParty(newCode()))
      Object.assign(c, { party: party.code, partyHost: true })
      P.saveSoon(party)
      send(c.ws, { t: "party.hosted", code: party.code, key })
      return pushParty(party.code)
    }
    case "party.join": {
      const party = P.parties.get(str(msg.code).toUpperCase())
      if (!party) return send(c.ws, { t: "error", msg: "No party with that code", fatal: true })
      const r = P.joinParty(party, { name: msg.name, avatar: msg.avatar, token: str(msg.token) })
      if (r.error) return send(c.ws, { t: "error", msg: r.error, fatal: true })
      Object.assign(c, { party: party.code, partyHost: false })
      P.saveSoon(party)
      send(c.ws, { t: "party.joined", code: party.code, token: r.token, me: { id: r.player.id, name: r.player.name, avatar: r.player.avatar } })
      return pushParty(party.code)
    }
    case "party.games":
    case "party.room":
    case "party.launch":
    case "party.record":
    case "party.clear": {
      const party = c.partyHost && P.parties.get(c.party)
      if (!party) return send(c.ws, { t: "error", msg: "Only the party TV can do that" })
      if (msg.t === "party.clear") party.current = null
      if (msg.t === "party.room" && party.current && !party.current.room) party.current.code = str(msg.code, 16).toUpperCase().replace(/[^A-Z0-9-]/g, "") || null
      if (msg.t === "party.games") party.games = (Array.isArray(msg.games) ? msg.games : []).map((s) => str(s, 40)).filter(gameBySlug)
      if (msg.t === "party.launch") {
        const g = gameBySlug(str(msg.game))
        if (!g || !P.inParty(party, g.slug)) return send(c.ws, { t: "error", msg: "That game is not in tonight's line-up" })
        if (g.builtIn) {
          const { code, key } = launchBuiltIn(party, ENGINES[g.slug])
          send(c.ws, { t: "party.launched", game: g.slug, room: code, key })
        } else party.current = { game: g.slug, url: g.url }
      }
      if (msg.t === "party.record") {
        const g = gameBySlug(str(msg.game))
        const scores = Array.isArray(msg.scores) ? msg.scores.slice(0, 64) : []
        const standings = scores.map((s) => ({ partyId: str(s?.playerId, 40), score: s?.score }))
        const err = g ? P.recordResult(party, g.slug, standings) : "Unknown game"
        if (err) return send(c.ws, { t: "error", msg: err })
      }
      P.saveSoon(party)
      return pushParty(party.code)
    }

    // ---- built-in game rooms -------------------------------------------
    case "game.host": {
      const engine = ENGINES[str(msg.game)]
      if (!engine) return send(c.ws, { t: "error", msg: "Unknown game", fatal: true })
      let code = str(msg.code).toUpperCase()
      let key = str(msg.key)
      const room = rooms.get(code)
      if (!room || room.engine !== engine || room.keyHash !== hash(key)) {
        // No room to resume (new night, or the relay restarted): start one, still under the party if the TV is its host.
        const party = P.parties.get(str(msg.party))
        ;({ code, key } = party && P.isHost(party, str(msg.partyKey)) ? launchBuiltIn(party, engine) : newRoom(engine, null))
        if (party) pushParty(party.code)
      }
      Object.assign(c, { room: code, host: true, playerId: null })
      send(c.ws, { t: "game.hosted", code, key })
      return pushRoom(code)
    }
    case "game.join": {
      const code = str(msg.code).toUpperCase()
      const room = rooms.get(code)
      if (!room) return send(c.ws, { t: "error", msg: "No game with that code", fatal: true })
      // A verified party member plays as themselves, which is how their result reaches the party.
      const party = room.state.party && P.parties.get(room.state.party)
      const member = party && P.findPlayer(party, str(msg.partyToken))
      const who = member ? { name: member.name, avatar: member.avatar, partyId: member.id } : { name: msg.name, avatar: msg.avatar }
      const r = room.engine.join(room.state, { ...who, token: str(msg.token) })
      if (r.error) return send(c.ws, { t: "error", msg: r.error, fatal: true })
      Object.assign(c, { room: code, host: false, playerId: r.player.id })
      send(c.ws, { t: "game.joined", code, token: r.token })
      return pushRoom(code)
    }
    case "game.act": {
      const room = rooms.get(c.room)
      if (!room || (!c.host && !c.playerId)) return send(c.ws, { t: "error", msg: "Join a game first" })
      const err = room.engine.act(room.state, c.host ? "host" : c.playerId, msg, Date.now())
      if (err) send(c.ws, { t: "error", msg: err })
      return pushRoom(c.room)
    }
  }
}

// ---- HTTP -----------------------------------------------------------------

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".json": "application/json" }

function lanIps() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address)
}

/** Outside games post results from the host's browser, so the API answers CORS for our own hosts only. */
const allowedOrigin = (o) => typeof o === "string" && /^https:\/\/([a-z0-9-]+\.)*(futile\.studio|chorusify\.com)$/.test(o)

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers })
  res.end(body === undefined ? "" : JSON.stringify(body))
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on("data", (b) => {
      size += b.length
      if (size > max) {
        reject(new Error("too large"))
        req.destroy()
      } else chunks.push(b)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

async function postResults(req, res, code) {
  const cors = allowedOrigin(req.headers.origin) ? { "Access-Control-Allow-Origin": req.headers.origin, Vary: "Origin" } : {}
  if (req.method === "OPTIONS") return json(res, 204, undefined, { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600" })
  if (req.method !== "POST") return json(res, 405, { error: "POST only" }, cors)
  const party = P.parties.get(code)
  const key = (req.headers.authorization ?? "").replace(/^Bearer /, "")
  if (!party || !P.isHost(party, key)) return json(res, 401, { error: "Unknown party or wrong key" }, cors)
  let body
  try {
    body = JSON.parse(await readBody(req, 16_384))
  } catch {
    return json(res, 400, { error: "Body must be JSON under 16 KB" }, cors)
  }
  if (!gameBySlug(body?.game)) return json(res, 400, { error: "Unknown game slug" }, cors)
  const err = P.recordResult(party, body.game, Array.isArray(body.standings) ? body.standings.slice(0, 64) : [])
  if (err) return json(res, 400, { error: err }, cors)
  P.saveSoon(party)
  pushParty(code)
  log("result posted", { party: code, game: body.game })
  return json(res, 204, undefined, cors)
}

function serveStatic(req, res) {
  let rel
  try {
    rel = path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname))
  } catch {
    return json(res, 400, { error: "Bad path" })
  }
  const base = path.join(DIST, rel)
  if (!base.startsWith(DIST)) return json(res, 404, { error: "Not found" })
  const file = [base, path.join(base, "index.html"), `${base}.html`].find((f) => existsSync(f) && statSync(f).isFile())
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
    return existsSync(path.join(DIST, "404.html")) ? createReadStream(path.join(DIST, "404.html")).pipe(res) : res.end("Not found")
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
    // Hashed bundles never change; pages keep their names across deploys, so they must not be cached.
    "Cache-Control": rel.startsWith("/_astro/") ? "public, max-age=31536000, immutable" : "no-cache",
  })
  createReadStream(file).pipe(res)
}

const server = createServer((req, res) => {
  const url = req.url ?? "/"
  if (url === "/api/net") return json(res, 200, { ips: lanIps() })
  const m = url.match(/^\/api\/parties\/([A-Z]{4})\/results$/)
  if (m) return postResults(req, res, m[1]).catch(() => json(res, 500, { error: "Failed" }))
  if (url.startsWith("/api/")) return json(res, 404, { error: "Not found" })
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "GET only" })
  serveStatic(req, res)
})

// ---- WebSocket ------------------------------------------------------------

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 8 * 1024 })

wss.on("connection", (ws) => {
  const c = { ws, alive: true }
  conns.add(c)
  ws.on("pong", () => (c.alive = true))
  ws.on("message", (data) => {
    let msg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }
    if (msg && typeof msg === "object") onMessage(c, msg)
  })
  ws.on("close", () => {
    conns.delete(c)
    const room = c.playerId && rooms.get(c.room)
    // A seat stays a seat while it has any socket: a phone that reconnected first must not be marked gone by its old socket.
    if (room && ![...conns].some((o) => o.room === c.room && o.playerId === c.playerId)) {
      room.engine.setConnected(room.state, c.playerId, false)
      pushRoom(c.room)
    }
  })
})

// Clocks, idle rooms and dead sockets.
setInterval(() => {
  const now = Date.now()
  for (const [code, room] of rooms) {
    if (room.engine.tick(room.state, now)) pushRoom(code)
    const empty = ![...conns].some((c) => c.room === code)
    room.emptySince = empty ? (room.emptySince ?? now) : null
    if (empty && now - room.emptySince > ROOM_IDLE_MS) rooms.delete(code)
  }
}, 250)

setInterval(() => {
  for (const c of conns) {
    if (!c.alive) c.ws.terminate()
    else {
      c.alive = false
      c.ws.ping()
    }
  }
}, 25_000)

server.listen(PORT, () => log("shaam relay listening", { port: PORT, static: existsSync(DIST) }))
