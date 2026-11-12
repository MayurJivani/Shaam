/**
 * Reverie: a storytelling and guessing game in the spirit of Dixit.
 *
 * The whole game is plain functions over one room object. No sockets and no
 * timers of its own: the relay calls act() and tick() with the time, and sends
 * view() to every screen. That keeps every rule testable with a fake clock, and
 * keeps the server the only place a score is decided.
 *
 * Implements the built-in game contract in GAMES.md.
 */
import { createHash, randomBytes, randomInt } from "node:crypto"
import { packBySlug } from "../../shared/packs.js"

export const slug = "reverie"
export const DECK_SIZE = 240 // must match src/lib/cardArt.js
export const HAND_SIZE = 6
export const MIN_PLAYERS = 3
export const DEFAULTS = { maxPlayers: 8, rounds: 8, submitSecs: 30, discussSecs: 60, voteSecs: 45, customClues: true }
const LIMITS = { maxPlayers: [6, 12], rounds: [1, 24], submitSecs: [10, 180], discussSecs: [0, 300], voteSecs: [10, 180] }
const TELL_SECS = 120 // a storyteller who never answers loses the turn instead of stalling the room
const REVEAL_SECS = 25
const CLUE_MAX = 80
const NAME_MAX = 18

// Offered when custom clues are off: three to choose from, so the storyteller still chooses.
const PROMPTS = [
  "Homesick", "The last train", "Too late", "Secret garden", "Grandmother", "Monday morning",
  "Hide and seek", "Echo", "Before the storm", "First love", "Lost and found", "Lullaby",
  "Ambition", "Hunger", "Paper thin", "Underneath", "The long way round", "Patience",
  "Daydream", "Stage fright", "Gravity", "A promise", "Soft landing", "The other side",
  "Curiosity", "Leftovers", "Overthinking", "Invisible", "Shelter", "Sunday", "Escape",
  "Inheritance", "Low tide", "Static", "Wishful thinking", "Borrowed time", "Sleepwalking",
  "Haunted", "Bloom", "Small talk", "Crowded", "Tiptoe", "Wanderlust", "Fragile", "Rumour",
]

const hash = (t) => createHash("sha256").update(t).digest("hex")
const range = (n) => Array.from({ length: n }, (_, i) => i)

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Strip control characters and collapse whitespace; the result is shown on a TV. */
export function cleanText(s, max) {
  if (typeof s !== "string") return ""
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
}

function clamp(v, [lo, hi], fallback) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

export function cleanConfig(c = {}) {
  const out = {}
  for (const k of Object.keys(LIMITS)) out[k] = clamp(c[k], LIMITS[k], DEFAULTS[k])
  out.customClues = c.customClues === undefined ? DEFAULTS.customClues : c.customClues === true
  out.pack = packBySlug(c.pack).slug
  return out
}

export function createRoom({ code, party = null, config = {} }) {
  return {
    code,
    party, // party code this room reports to, or null
    config: cleanConfig(config),
    phase: "lobby", // lobby | telling | submitting | discussing | voting | reveal | over
    players: [],
    deck: [],
    discard: [],
    round: 0,
    teller: -1, // index into players
    clue: "",
    prompts: [],
    subs: {}, // playerId -> card
    table: [], // shuffled cards on the TV
    votes: {}, // playerId -> card
    deadline: null,
    paused: null, // ms left on the clock while paused
    last: null, // the reveal of the round just played
  }
}

const tellerOf = (room) => room.players[room.teller]
const guessers = (room) => room.players.filter((_, i) => i !== room.teller)

function draw(room) {
  if (!room.deck.length) room.deck = shuffle(room.discard.splice(0))
  return room.deck.pop()
}

function fillHands(room) {
  for (const p of room.players) while (p.hand.length < HAND_SIZE && (room.deck.length || room.discard.length)) p.hand.push(draw(room))
}

/**
 * Take a seat, or get back the one you had. A token proves a seat; a verified
 * party identity is just as good, so a phone that lost its storage still rejoins.
 */
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
  if (room.phase === "over") return { error: "This game has finished" }
  if (room.players.length >= room.config.maxPlayers) return { error: "The room is full" }
  if (room.players.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { error: "That name is taken" }
  token = randomBytes(18).toString("base64url")
  p = {
    id: randomBytes(6).toString("hex"),
    name,
    avatar: clamp(avatar, [0, 15], 0),
    tokenHash: hash(token),
    partyId,
    connected: true,
    score: 0,
    hand: [],
  }
  room.players.push(p)
  if (room.phase !== "lobby") fillHands(room) // a late arrival plays from the next choice they can make
  return { player: p, token }
}

export function setConnected(room, playerId, connected) {
  const p = room.players.find((x) => x.id === playerId)
  if (p) p.connected = connected
}

function arm(room, now, secs) {
  room.deadline = now + secs * 1000
  room.paused = null
}

function start(room, now) {
  if (room.players.filter((p) => p.connected).length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players`
  room.deck = shuffle(range(packBySlug(room.config.pack).count))
  room.discard = []
  for (const p of room.players) {
    p.score = 0
    p.hand = []
  }
  room.round = 0
  room.teller = -1
  nextRound(room, now)
  return null
}

function nextRound(room, now) {
  if (room.round >= room.config.rounds) return finish(room)
  room.round++
  // Next storyteller in seat order, passing over anyone whose phone is gone.
  const n = room.players.length
  for (let step = 1; step <= n; step++) {
    const i = (room.teller + step) % n
    if (room.players[i].connected || step === n) {
      room.teller = i
      break
    }
  }
  fillHands(room)
  room.clue = ""
  room.subs = {}
  room.votes = {}
  room.table = []
  room.last = null
  room.prompts = room.config.customClues ? [] : shuffle([...PROMPTS]).slice(0, 3)
  room.phase = "telling"
  arm(room, now, TELL_SECS)
}

function finish(room) {
  room.phase = "over"
  room.deadline = null
  room.paused = null
}

function tell(room, p, { card, clue }, now) {
  if (room.phase !== "telling") return "Not the time to tell"
  if (p !== tellerOf(room)) return "You are not the storyteller"
  if (!p.hand.includes(card)) return "That card is not in your hand"
  clue = cleanText(clue, CLUE_MAX)
  if (!clue) return "Give a clue"
  if (!room.config.customClues && !room.prompts.includes(clue)) return "Pick one of the offered clues"
  p.hand.splice(p.hand.indexOf(card), 1)
  room.subs[p.id] = card
  room.clue = clue
  room.phase = "submitting"
  arm(room, now, room.config.submitSecs)
  return null
}

function submit(room, p, { card }, now) {
  if (room.phase !== "submitting") return "Not the time to play a card"
  if (p === tellerOf(room)) return "The storyteller has already played"
  if (room.subs[p.id] !== undefined) return "You already played a card"
  if (!p.hand.includes(card)) return "That card is not in your hand"
  p.hand.splice(p.hand.indexOf(card), 1)
  room.subs[p.id] = card
  if (guessers(room).every((g) => !g.connected || room.subs[g.id] !== undefined)) toTable(room, now)
  return null
}

function toTable(room, now) {
  // Anyone who ran out the clock (or dropped) still has a decoy on the table.
  for (const g of guessers(room)) {
    if (room.subs[g.id] === undefined && g.hand.length) room.subs[g.id] = g.hand.splice(randomInt(g.hand.length), 1)[0]
  }
  room.table = shuffle(Object.values(room.subs))
  if (room.config.discussSecs > 0) {
    room.phase = "discussing"
    arm(room, now, room.config.discussSecs)
  } else toVoting(room, now)
}

function toVoting(room, now) {
  room.phase = "voting"
  arm(room, now, room.config.voteSecs)
}

function vote(room, p, { card }, now) {
  if (room.phase !== "voting") return "Voting is not open"
  if (p === tellerOf(room)) return "The storyteller does not vote"
  if (room.votes[p.id] !== undefined) return "You already voted"
  if (!room.table.includes(card)) return "That card is not on the table"
  if (room.subs[p.id] === card) return "You cannot vote for your own card"
  room.votes[p.id] = card
  if (guessers(room).every((g) => !g.connected || room.votes[g.id] !== undefined)) reveal(room, now)
  return null
}

/**
 * Classic scoring. Everyone or no one finding the storyteller's card means the
 * clue was too plain or too obscure: storyteller 0, everyone else 2. Otherwise
 * storyteller and each correct guesser 3. On top, 1 per vote your own card drew,
 * capped at 3. "Everyone" counts the players who voted.
 */
export function scoreRound({ teller, tellerCard, subs, votes, playerIds }) {
  const d = Object.fromEntries(playerIds.map((id) => [id, 0]))
  const others = playerIds.filter((id) => id !== teller)
  const voters = others.filter((id) => votes[id] !== undefined)
  const correct = voters.filter((id) => votes[id] === tellerCard)
  let outcome = "some"
  if (correct.length === 0 || correct.length === voters.length) {
    outcome = correct.length === 0 ? "none" : "all"
    for (const id of others) d[id] += 2
  } else {
    d[teller] += 3
    for (const id of correct) d[id] += 3
  }
  const ownerOf = Object.fromEntries(Object.entries(subs).map(([id, c]) => [c, id]))
  const bonus = {}
  for (const c of Object.values(votes)) {
    const o = ownerOf[c]
    if (o && o !== teller) bonus[o] = (bonus[o] ?? 0) + 1
  }
  for (const [o, n] of Object.entries(bonus)) if (o in d) d[o] += Math.min(3, n)
  return { deltas: d, outcome }
}

function reveal(room, now) {
  const teller = tellerOf(room)
  const { deltas, outcome } = scoreRound({
    teller: teller.id,
    tellerCard: room.subs[teller.id],
    subs: room.subs,
    votes: room.votes,
    playerIds: room.players.map((p) => p.id),
  })
  for (const p of room.players) p.score += deltas[p.id] ?? 0
  const ownerOf = Object.fromEntries(Object.entries(room.subs).map(([id, c]) => [c, id]))
  room.last = {
    tellerId: teller.id,
    tellerCard: room.subs[teller.id],
    clue: room.clue,
    outcome,
    deltas,
    cards: room.table.map((card) => ({
      card,
      owner: ownerOf[card],
      voters: Object.keys(room.votes).filter((id) => room.votes[id] === card),
    })),
  }
  room.discard.push(...room.table)
  room.phase = "reveal"
  arm(room, now, REVEAL_SECS)
}

/** Move the game on: what the host's Next button does, and what a clock running out does. */
function advance(room, now) {
  switch (room.phase) {
    case "lobby":
      return start(room, now)
    case "telling":
      // Storyteller skipped: the turn passes, the round number does not.
      room.round--
      return nextRound(room, now)
    case "submitting":
      return toTable(room, now)
    case "discussing":
      return toVoting(room, now)
    case "voting":
      return reveal(room, now)
    case "reveal":
      return nextRound(room, now)
  }
  return null
}

/** Called by the relay a few times a second. Returns true when something changed. */
export function tick(room, now) {
  if (room.deadline == null || now < room.deadline) return false
  advance(room, now)
  return true
}

/**
 * Every move, from the host screen (actor "host") or a player (actor = player id).
 * Returns an error to show, or null.
 */
export function act(room, actor, msg, now) {
  if (actor === "host") {
    switch (msg.a) {
      case "config":
        if (room.phase !== "lobby") return "Settings are fixed once the game starts"
        room.config = cleanConfig({ ...room.config, ...msg.config })
        return null
      case "start":
        return room.phase === "lobby" ? start(room, now) : "Already started"
      case "advance":
        return advance(room, now) ?? null
      case "pause":
        if (room.deadline != null) {
          room.paused = Math.max(0, room.deadline - now)
          room.deadline = null
        }
        return null
      case "resume":
        if (room.paused != null) arm(room, now, room.paused / 1000)
        return null
      case "end":
        finish(room)
        return null
    }
    return "Unknown host action"
  }
  const p = room.players.find((x) => x.id === actor)
  if (!p) return "You are not in this game"
  const card = Number(msg.card)
  if (msg.a === "tell") return tell(room, p, { card, clue: msg.clue }, now)
  if (msg.a === "submit") return submit(room, p, { card }, now)
  if (msg.a === "vote") return vote(room, p, { card }, now)
  return "Unknown action"
}

/**
 * What one screen may know. playerId null is the TV. Nothing private leaves the
 * server before the reveal: hands go only to their owner, and who played which
 * card or voted for which stays in room.subs and room.votes until room.last.
 */
export function view(room, playerId, now) {
  const me = playerId ? room.players.find((p) => p.id === playerId) : null
  const teller = tellerOf(room)
  const onTable = ["discussing", "voting", "reveal"].includes(room.phase)
  return {
    game: slug,
    code: room.code,
    party: room.party,
    phase: room.phase,
    round: room.round,
    config: room.config,
    minPlayers: MIN_PLAYERS,
    left: room.deadline != null ? Math.max(0, room.deadline - now) : room.paused,
    paused: room.paused != null,
    tellerId: teller?.id ?? null,
    clue: room.phase === "telling" ? "" : room.clue,
    played: Object.keys(room.subs).length,
    table: onTable ? room.table : [],
    last: room.last,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      connected: p.connected,
      done:
        (room.phase === "submitting" && room.subs[p.id] !== undefined) ||
        (room.phase === "voting" && room.votes[p.id] !== undefined),
    })),
    me: me && {
      id: me.id,
      hand: me.hand,
      played: room.subs[me.id] ?? null,
      vote: room.votes[me.id] ?? null,
      prompts: me === teller ? room.prompts : [],
    },
  }
}

/** Final standings for the party, or null while the game is still going. */
export function standings(room) {
  if (room.phase !== "over" || room.round === 0) return null
  return room.players.map((p) => ({ partyId: p.partyId, name: p.name, score: p.score }))
}

/** True once nobody is connected, so the relay can drop the room after a while. */
export const idle = (room) => room.players.every((p) => !p.connected)
