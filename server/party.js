/**
 * A party is one code the whole evening hangs off: who is here, which game is on
 * now, and how everyone did in every game so far. Games do not know about it
 * beyond reporting standings at the end (GAMES.md), so an old game that never
 * reports still works: the host types its result in on the party TV.
 *
 * Parties are small, so they live in memory and are written to one JSON file
 * after each change, which is enough to survive a restart mid-evening.
 */
import { createHash, randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { cleanText } from "./games/reverie.js"

const MAX_PLAYERS = 24
const TTL_MS = 48 * 60 * 60_000
const hash = (t) => createHash("sha256").update(t).digest("hex")
const secret = () => randomBytes(18).toString("base64url")

export const parties = new Map()

export function createParty(code) {
  const key = secret()
  const party = { code, keyHash: hash(key), touched: Date.now(), players: [], current: null, results: [] }
  parties.set(code, party)
  return { party, key }
}

export const isHost = (party, key) => typeof key === "string" && hash(key) === party.keyHash

export function findPlayer(party, token) {
  return typeof token === "string" ? party.players.find((p) => p.tokenHash === hash(token)) : undefined
}

export function joinParty(party, { name, avatar, token }) {
  const known = findPlayer(party, token)
  if (known) return { player: known, token }
  name = cleanText(name, 18)
  if (!name) return { error: "Pick a name first" }
  if (party.players.length >= MAX_PLAYERS) return { error: "The party is full" }
  if (party.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return { error: "That name is taken" }
  token = secret()
  const n = Number(avatar)
  const player = { id: randomBytes(6).toString("hex"), name, avatar: n >= 0 && n <= 15 ? Math.round(n) : 0, tokenHash: hash(token) }
  party.players.push(player)
  return { player, token }
}

/**
 * Store one finished game. Standings come as { partyId?, name, score }; a row
 * is matched to a party player by id first, then by name, and kept by name if
 * neither matches (a guest who never joined the party still shows up).
 */
export function recordResult(party, game, standings) {
  const rows = []
  for (const s of standings ?? []) {
    const score = Number(s?.score)
    if (!Number.isFinite(score)) continue
    const name = cleanText(s.name, 18)
    const p =
      party.players.find((x) => x.id === s.partyId) ??
      party.players.find((x) => x.name.toLowerCase() === name.toLowerCase())
    if (!p && !name) continue
    rows.push({ playerId: p?.id ?? null, name: p?.name ?? name, score })
  }
  if (!rows.length) return "No standings to record"
  party.results.push({ game: cleanText(game, 40), at: Date.now(), standings: rows.slice(0, 64) })
  party.current = null
  return null
}

/**
 * Games score on different scales (Noggin in hundreds, Reverie in tens), so the
 * party ranks by placement: each game is worth one point per player you beat.
 * Ties beat nobody they tie with.
 */
export function leaderboard(party) {
  const rows = new Map(party.players.map((p) => [p.id, { key: p.id, name: p.name, avatar: p.avatar, points: 0, wins: 0, played: 0 }]))
  for (const r of party.results) {
    const top = Math.max(...r.standings.map((s) => s.score))
    for (const s of r.standings) {
      const key = s.playerId ?? `guest:${s.name}`
      if (!rows.has(key)) rows.set(key, { key, name: s.name, avatar: null, points: 0, wins: 0, played: 0 })
      const row = rows.get(key)
      row.points += r.standings.filter((o) => o.score < s.score).length
      row.wins += s.score === top ? 1 : 0
      row.played++
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name))
}

export function publicParty(party) {
  return {
    code: party.code,
    players: party.players.map(({ id, name, avatar }) => ({ id, name, avatar })),
    current: party.current,
    results: party.results,
    leaderboard: leaderboard(party),
  }
}

// --- persistence -----------------------------------------------------------

let file = null
let timer = null

export function loadParties(dir) {
  file = path.join(dir, "parties.json")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(file)) return
  const cutoff = Date.now() - TTL_MS
  for (const p of JSON.parse(readFileSync(file, "utf8"))) if (p.touched > cutoff) parties.set(p.code, p)
}

/** Debounced write, via a temp file so a crash mid-write never leaves half a JSON. */
export function saveSoon(party) {
  if (party) party.touched = Date.now()
  if (!file || timer) return
  timer = setTimeout(() => {
    timer = null
    const cutoff = Date.now() - TTL_MS
    for (const [code, p] of parties) if (p.touched < cutoff) parties.delete(code)
    writeFileSync(`${file}.tmp`, JSON.stringify([...parties.values()]))
    renameSync(`${file}.tmp`, file)
  }, 1000)
  timer.unref?.()
}
