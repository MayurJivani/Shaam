/**
 * Undercover: most players are Civilians and share one word, the Undercovers
 * get a close cousin of it, and Mr White gets nothing. Each round everyone says
 * one clue out loud, then the room votes someone out. Rules and points follow
 * the common Undercover rules: Civilians 2 each, Undercovers 10, Mr White 6.
 *
 * Plain functions over one room object, per the built-in game contract in GAMES.md.
 * Clues are spoken in the room; the phones only hold your word and your vote.
 */
import { createHash, randomBytes, randomInt } from "node:crypto"
import { cleanText } from "../party.js"

export const slug = "undercover"
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 20
export const POINTS = { civilian: 2, undercover: 10, mrwhite: 6 }
const NAME_MAX = 18

// [civilian word, undercover word]; which side gets which is flipped at random each game.
export const PAIRS = [
  ["Coffee", "Tea"], ["Cat", "Dog"], ["Beach", "Pool"], ["Pizza", "Burger"], ["Guitar", "Violin"],
  ["Train", "Bus"], ["Moon", "Sun"], ["Apple", "Pear"], ["Lion", "Tiger"], ["Doctor", "Nurse"],
  ["Football", "Rugby"], ["Wine", "Beer"], ["Piano", "Keyboard"], ["Snow", "Rain"], ["Castle", "Palace"],
  ["Butter", "Cheese"], ["Shark", "Dolphin"], ["Cinema", "Theatre"], ["Wedding", "Birthday"], ["Pen", "Pencil"],
  ["Bicycle", "Motorbike"], ["Library", "Bookshop"], ["Mountain", "Hill"], ["Honey", "Jam"], ["Spoon", "Fork"],
  ["Pirate", "Viking"], ["Vampire", "Zombie"], ["Rose", "Tulip"], ["Chess", "Draughts"], ["Lemon", "Lime"],
  ["Ketchup", "Mustard"], ["Hotel", "Hostel"], ["Owl", "Eagle"], ["Sofa", "Bed"], ["Jeans", "Leggings"],
  ["Rocket", "Plane"], ["Ice cream", "Frozen yogurt"], ["Teacher", "Professor"], ["River", "Lake"], ["Clock", "Watch"],
  ["Instagram", "TikTok"], ["Netflix", "YouTube"], ["Breakfast", "Brunch"], ["Socks", "Gloves"], ["Bee", "Wasp"],
  ["Volcano", "Earthquake"], ["Pancake", "Waffle"], ["Taxi", "Uber"], ["Ghost", "Witch"], ["Camera", "Phone"],
  ["Desert", "Jungle"], ["Popcorn", "Crisps"], ["King", "President"], ["Umbrella", "Raincoat"], ["Cake", "Pie"],
  ["Gym", "Yoga"], ["Frog", "Toad"], ["Knife", "Scissors"], ["Christmas", "New Year"], ["Mirror", "Window"],
]

const hash = (t) => createHash("sha256").update(t).digest("hex")
const norm = (s) => cleanText(s, 40).toLowerCase().replace(/[^a-z0-9]/g, "")

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cleanConfig(c = {}) {
  const int = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d)
  return { undercovers: int(c.undercovers, 1, 6, 1), mrWhites: int(c.mrWhites, 0, 3, 1) }
}

export function createRoom({ code, party = null, config = {} }) {
  return {
    code,
    party,
    config: cleanConfig(config),
    phase: "lobby", // lobby | describe | vote | guess | over
    players: [],
    words: null, // { civilian, undercover }
    round: 0,
    order: [], // speaking order this round, player ids
    votes: {}, // voter id -> target id
    runoff: null, // ids in a tied re-vote, or null
    last: null, // { out, role, tally } of the latest vote, or { tie } when nobody left
    winner: null, // "civilian" | "undercover" | "mrwhite"
    guess: null, // Mr White's guess, once made
  }
}

const alive = (room) => room.players.filter((p) => p.alive)
const impostor = (p) => p.role !== "civilian"

export function join(room, { name, avatar, token, partyId = null }) {
  let p = token && room.players.find((x) => x.tokenHash === hash(token))
  if (!p && partyId) p = room.players.find((x) => x.partyId === partyId)
  if (p) {
    p.connected = true
    if (!token || p.tokenHash !== hash(token)) {
      token = randomBytes(18).toString("base64url")
      p.tokenHash = hash(token)
    }
    return { player: p, token }
  }
  name = cleanText(name, NAME_MAX)
  if (!name) return { error: "Pick a name first" }
  if (room.phase !== "lobby") return { error: "This game has already started" }
  if (room.players.length >= MAX_PLAYERS) return { error: "The room is full" }
  if (room.players.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { error: "That name is taken" }
  token = randomBytes(18).toString("base64url")
  const avatarIdx = Number.isInteger(avatar) ? Math.min(15, Math.max(0, avatar)) : 0
  p = { id: randomBytes(6).toString("hex"), name, avatar: avatarIdx, tokenHash: hash(token), partyId, connected: true, role: null, alive: true, score: 0 }
  room.players.push(p)
  return { player: p, token }
}

export function setConnected(room, playerId, connected) {
  const p = room.players.find((x) => x.id === playerId)
  if (p) p.connected = connected
}

/** Deal roles. Kept separate so a test can deal with a fixed shuffle. */
export function deal(room, rand = shuffle) {
  const { undercovers, mrWhites } = room.config
  const n = room.players.length
  if (n < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players`
  // Civilians must start as the majority, or the impostors win before anyone speaks.
  if (n - undercovers - mrWhites <= undercovers + mrWhites) return `Too many impostors for ${n} players`
  const [a, b] = PAIRS[randomInt(PAIRS.length)]
  room.words = randomInt(2) ? { civilian: a, undercover: b } : { civilian: b, undercover: a }
  const roles = [...Array(undercovers).fill("undercover"), ...Array(mrWhites).fill("mrwhite")]
  while (roles.length < n) roles.push("civilian")
  rand(roles).forEach((r, i) => Object.assign(room.players[i], { role: r, alive: true, score: 0 }))
  Object.assign(room, { round: 0, winner: null, guess: null, last: null })
  nextRound(room)
  return null
}

function nextRound(room) {
  room.round++
  room.votes = {}
  room.runoff = null
  room.phase = "describe"
  // Random order, but Mr White never speaks first: they need something to go on.
  const order = shuffle(alive(room).map((p) => p.id))
  const first = order.findIndex((id) => room.players.find((p) => p.id === id).role !== "mrwhite")
  if (first > 0) order.push(...order.splice(0, first))
  room.order = order
}

/** Civilians win when every impostor is out; impostors win once one Civilian is left. */
function checkWin(room) {
  const left = alive(room)
  if (!left.some(impostor)) return finish(room, "civilian")
  if (left.filter((p) => !impostor(p)).length <= 1) return finish(room, "undercover")
  return false
}

function finish(room, winner) {
  room.winner = winner
  room.phase = "over"
  for (const p of room.players) {
    if (winner === "civilian" && p.role === "civilian") p.score = POINTS.civilian
    if (winner === "undercover" && p.role === "undercover") p.score = POINTS.undercover
    if (winner === "undercover" && p.role === "mrwhite" && p.alive) p.score = POINTS.mrwhite
  }
  return true
}

function count(room) {
  const tally = {}
  for (const t of Object.values(room.votes)) tally[t] = (tally[t] ?? 0) + 1
  const top = Math.max(0, ...Object.values(tally))
  const tied = Object.keys(tally).filter((id) => tally[id] === top)
  if (tied.length !== 1) {
    // First tie: re-vote between the tied. Second tie (or no votes): nobody leaves, talk again.
    if (!room.runoff && tied.length > 1) {
      room.runoff = tied
      room.votes = {}
      room.last = { tie: tied, tally }
      return
    }
    room.last = { tie: tied, tally, nobody: true }
    return nextRound(room)
  }
  const out = room.players.find((p) => p.id === tied[0])
  out.alive = false
  room.last = { out: out.id, role: out.role, tally }
  if (out.role === "mrwhite") {
    room.phase = "guess"
    return
  }
  if (!checkWin(room)) nextRound(room)
}

function vote(room, p, target) {
  if (room.phase !== "vote") return "Voting is not open"
  if (!p.alive) return "You are out of the game"
  if (room.votes[p.id]) return "You already voted"
  const t = room.players.find((x) => x.id === target)
  if (!t || !t.alive || t === p) return "Vote for another player still in"
  if (room.runoff && !room.runoff.includes(t.id)) return "Vote for one of the tied players"
  room.votes[p.id] = t.id
  if (alive(room).every((x) => !x.connected || room.votes[x.id])) count(room)
  return null
}

function guessWord(room, p, word) {
  if (room.phase !== "guess" || room.last?.out !== p.id) return "Not your guess to make"
  const g = cleanText(word, 40)
  if (!g) return "Type a word"
  room.guess = g
  if (norm(g) === norm(room.words.civilian)) {
    room.winner = "mrwhite"
    room.phase = "over"
    p.score = POINTS.mrwhite
    return null
  }
  if (!checkWin(room)) nextRound(room)
  return null
}

export function act(room, actor, msg) {
  if (actor === "host") {
    switch (msg.a) {
      case "config":
        if (room.phase !== "lobby") return "Settings are fixed once the game starts"
        room.config = cleanConfig({ ...room.config, ...msg.config })
        return null
      case "start":
        return room.phase === "lobby" || room.phase === "over" ? deal(room) : "Already started"
      case "vote":
        if (room.phase !== "describe") return "Not the time to vote"
        room.phase = "vote"
        return null
      case "count":
        if (room.phase !== "vote") return "Voting is not open"
        count(room)
        return null
      case "lobby":
        if (room.phase !== "over") return "Finish the game first"
        room.phase = "lobby"
        return null
    }
    return "Unknown host action"
  }
  const p = room.players.find((x) => x.id === actor)
  if (!p) return "You are not in this game"
  if (msg.a === "vote") return vote(room, p, String(msg.target ?? ""))
  if (msg.a === "guess") return guessWord(room, p, msg.word)
  return "Unknown action"
}

export const tick = () => false // no clocks: the room talks at its own pace and the host moves it on

/** Roles and words stay on the server until a player is out or the game ends. */
export function view(room, playerId) {
  const me = playerId ? room.players.find((p) => p.id === playerId) : null
  const over = room.phase === "over"
  return {
    game: slug,
    code: room.code,
    party: room.party,
    phase: room.phase,
    round: room.round,
    config: room.config,
    minPlayers: MIN_PLAYERS,
    order: room.order,
    runoff: room.runoff,
    last: room.last,
    winner: room.winner,
    guess: room.guess,
    words: over ? room.words : null,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      connected: p.connected,
      alive: p.alive,
      role: over || !p.alive ? p.role : null,
      score: p.score,
      voted: room.phase === "vote" && !!room.votes[p.id],
    })),
    me: me && {
      id: me.id,
      // Undercovers are not told they are undercover; only Mr White knows what they are.
      word: room.phase === "lobby" ? null : me.role === "mrwhite" ? null : room.words[me.role],
      mrWhite: room.phase !== "lobby" && me.role === "mrwhite",
      vote: room.votes[me.id] ?? null,
    },
  }
}

export function standings(room) {
  if (room.phase !== "over") return null
  return room.players.map((p) => ({ partyId: p.partyId, name: p.name, score: p.score }))
}
