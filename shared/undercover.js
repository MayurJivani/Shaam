/**
 * Undercover rules for one phone passed round the room. Most players are
 * Civilians and share a word, the Undercovers get a close cousin of it, and
 * Mr White gets nothing. Clues are spoken, the room agrees who goes, and the
 * phone records it. Points follow the common rules: Civilians 2, Undercovers 10,
 * Mr White 6.
 *
 * Plain functions over one game object, so the screen stays thin and the rules
 * stay testable with a fixed shuffle.
 */
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 20
export const POINTS = { civilian: 2, undercover: 10, mrwhite: 6 }
export const ROLE = { civilian: "Civilian", undercover: "Undercover", mrwhite: "Mr White" }

// [one word, its close cousin]; which side gets which is flipped at random each game.
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

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
const alive = (g) => g.players.filter((p) => p.alive)

/** Why this line-up cannot start, or null. */
export function setupError(names, { undercovers, mrWhites }) {
  const n = names.length
  if (n < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players`
  if (n > MAX_PLAYERS) return `At most ${MAX_PLAYERS} players`
  if (new Set(names.map(norm)).size !== n || names.some((x) => !norm(x))) return "Every player needs a different name"
  if (undercovers < 1) return "Need at least one Undercover"
  // Civilians must start as the majority, or the impostors have already won.
  if (n - undercovers - mrWhites <= undercovers + mrWhites) return `Too many impostors for ${n} players`
  return null
}

/** Deal a new game. Starts in "pass": the phone goes round so each player sees their word. */
export function deal(names, config, rand = shuffle) {
  const [a, b] = PAIRS[Math.floor(Math.random() * PAIRS.length)]
  const words = Math.random() < 0.5 ? { civilian: a, undercover: b } : { civilian: b, undercover: a }
  const roles = [...Array(config.undercovers).fill("undercover"), ...Array(config.mrWhites).fill("mrwhite")]
  while (roles.length < names.length) roles.push("civilian")
  const dealt = rand(roles)
  const g = {
    phase: "pass", // pass | describe | vote | guess | over
    players: names.map((name, i) => ({ name, role: dealt[i], alive: true, score: 0 })),
    words,
    seen: 0, // how many players have looked at their word
    round: 0,
    order: [], // speaking order, player indexes
    last: null, // index of the player voted out most recently
    guess: null,
    winner: null,
  }
  return g
}

/** The word player i sees, or null for Mr White. */
export const wordOf = (g, i) => (g.players[i].role === "mrwhite" ? null : g.words[g.players[i].role])

/** One more player has seen their word; after the last, the first round starts. */
export function seen(g) {
  if (g.phase !== "pass") return
  if (++g.seen >= g.players.length) nextRound(g)
}

function nextRound(g) {
  g.round++
  g.phase = "describe"
  // Random order, but Mr White never speaks first: they need something to go on.
  const order = shuffle(g.players.map((_, i) => i).filter((i) => g.players[i].alive))
  const first = order.findIndex((i) => g.players[i].role !== "mrwhite")
  if (first > 0) order.push(...order.splice(0, first))
  g.order = order
}

export function openVote(g) {
  if (g.phase === "describe") g.phase = "vote"
}

/** The room has agreed who goes. Returns an error string or null. */
export function eliminate(g, i) {
  if (g.phase !== "vote") return "Not the time to vote"
  const p = g.players[i]
  if (!p?.alive) return "Pick a player who is still in"
  p.alive = false
  g.last = i
  g.guess = null
  if (p.role === "mrwhite") g.phase = "guess"
  else if (!checkWin(g)) nextRound(g)
  return null
}

/** A caught Mr White's one guess at the Civilians' word. Right, and they win alone. */
export function guessWord(g, word) {
  if (g.phase !== "guess") return "Nobody is guessing"
  if (!norm(word)) return "Type a word"
  g.guess = String(word).trim().slice(0, 40)
  if (norm(word) === norm(g.words.civilian)) {
    g.players[g.last].score = POINTS.mrwhite
    g.winner = "mrwhite"
    g.phase = "over"
  } else if (!checkWin(g)) nextRound(g)
  return null
}

/** Civilians win when every impostor is out; impostors win once one Civilian is left. */
function checkWin(g) {
  const left = alive(g)
  let winner = null
  if (!left.some((p) => p.role !== "civilian")) winner = "civilian"
  else if (left.filter((p) => p.role === "civilian").length <= 1) winner = "undercover"
  if (!winner) return false
  g.winner = winner
  g.phase = "over"
  for (const p of g.players) {
    if (winner === "civilian" && p.role === "civilian") p.score = POINTS.civilian
    if (winner === "undercover" && p.role === "undercover") p.score = POINTS.undercover
    if (winner === "undercover" && p.role === "mrwhite" && p.alive) p.score = POINTS.mrwhite
  }
  return true
}
