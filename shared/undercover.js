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
  // food and drink
  ["Coffee", "Tea"], ["Pizza", "Burger"], ["Apple", "Pear"], ["Butter", "Cheese"], ["Honey", "Jam"],
  ["Lemon", "Lime"], ["Ketchup", "Mustard"], ["Ice cream", "Frozen yogurt"], ["Breakfast", "Brunch"], ["Pancake", "Waffle"],
  ["Popcorn", "Crisps"], ["Cake", "Pie"], ["Wine", "Beer"], ["Sushi", "Sashimi"], ["Croissant", "Bagel"],
  ["Noodles", "Spaghetti"], ["Curry", "Stew"], ["Taco", "Burrito"], ["Muffin", "Cupcake"], ["Orange", "Mandarin"],
  ["Smoothie", "Milkshake"], ["Garlic", "Onion"], ["Salt", "Pepper"], ["Biryani", "Pulao"], ["Samosa", "Spring roll"],
  ["Hummus", "Guacamole"], ["Chocolate", "Caramel"], ["Strawberry", "Raspberry"], ["Cucumber", "Courgette"], ["Cola", "Lemonade"],
  // animals
  ["Cat", "Dog"], ["Lion", "Tiger"], ["Shark", "Dolphin"], ["Owl", "Eagle"], ["Bee", "Wasp"],
  ["Frog", "Toad"], ["Horse", "Donkey"], ["Rabbit", "Hamster"], ["Wolf", "Fox"], ["Penguin", "Puffin"],
  ["Butterfly", "Moth"], ["Octopus", "Squid"], ["Cheetah", "Leopard"], ["Camel", "Llama"], ["Seal", "Walrus"],
  ["Crow", "Raven"], ["Tortoise", "Turtle"], ["Mouse", "Rat"], ["Goat", "Sheep"], ["Parrot", "Peacock"],
  // places
  ["Beach", "Pool"], ["Castle", "Palace"], ["Library", "Bookshop"], ["Mountain", "Hill"], ["Hotel", "Hostel"],
  ["River", "Lake"], ["Desert", "Jungle"], ["Paris", "Rome"], ["London", "Dublin"], ["Mumbai", "Delhi"],
  ["Tokyo", "Seoul"], ["Airport", "Train station"], ["Hospital", "Pharmacy"], ["Supermarket", "Market"], ["Museum", "Gallery"],
  ["Island", "Peninsula"], ["Zoo", "Aquarium"], ["Church", "Temple"], ["Garden", "Park"], ["Berlin", "Munich"],
  // sports and games
  ["Football", "Rugby"], ["Chess", "Draughts"], ["Gym", "Yoga"], ["Tennis", "Badminton"], ["Cricket", "Baseball"],
  ["Basketball", "Volleyball"], ["Boxing", "Wrestling"], ["Skiing", "Snowboarding"], ["Golf", "Mini golf"], ["Swimming", "Diving"],
  ["Marathon", "Sprint"], ["Surfing", "Sailing"], ["Darts", "Archery"], ["Poker", "Blackjack"], ["Bowling", "Billiards"],
  ["Olympics", "World Cup"], ["Cycling", "Running"], ["Karate", "Judo"], ["Hockey", "Lacrosse"], ["Sudoku", "Crossword"],
  // music
  ["Guitar", "Violin"], ["Piano", "Keyboard"], ["Drums", "Tambourine"], ["Trumpet", "Saxophone"], ["Concert", "Festival"],
  ["Rap", "Rock"], ["Karaoke", "Open mic"], ["DJ", "MC"], ["Opera", "Musical"], ["Headphones", "Speaker"],
  ["Choir", "Band"], ["Vinyl", "Cassette"], ["Lullaby", "Anthem"], ["Ukulele", "Banjo"], ["Bollywood", "K-pop"],
  // film and TV
  ["Cinema", "Theatre"], ["Vampire", "Zombie"], ["Ghost", "Witch"], ["Pirate", "Viking"], ["Netflix", "YouTube"],
  ["Superman", "Batman"], ["Harry Potter", "Lord of the Rings"], ["Star Wars", "Star Trek"], ["Cartoon", "Anime"], ["Sitcom", "Soap opera"],
  ["Horror", "Thriller"], ["Documentary", "Biopic"], ["Sequel", "Remake"], ["Director", "Producer"], ["Oscar", "Grammy"],
  ["Mermaid", "Fairy"], ["Dragon", "Dinosaur"], ["Robot", "Alien"], ["Ninja", "Samurai"], ["Detective", "Spy"],
  // pop culture and everyday life
  ["Wedding", "Birthday"], ["Christmas", "New Year"], ["Halloween", "Carnival"], ["Diwali", "Holi"], ["Instagram", "TikTok"],
  ["Selfie", "Portrait"], ["Influencer", "Celebrity"], ["Meme", "Emoji"], ["Podcast", "Radio"], ["Tattoo", "Piercing"],
  ["King", "President"], ["Doctor", "Nurse"], ["Teacher", "Professor"], ["Chef", "Waiter"], ["Pilot", "Astronaut"],
  ["Police officer", "Firefighter"], ["Lawyer", "Judge"], ["Barber", "Hairdresser"], ["Magician", "Clown"], ["Santa", "Easter Bunny"],
  // things and tech
  ["Pen", "Pencil"], ["Spoon", "Fork"], ["Knife", "Scissors"], ["Clock", "Watch"], ["Socks", "Gloves"],
  ["Sofa", "Bed"], ["Jeans", "Leggings"], ["Umbrella", "Raincoat"], ["Mirror", "Window"], ["Camera", "Phone"],
  ["Laptop", "Tablet"], ["iPhone", "Android"], ["WhatsApp", "Telegram"], ["Google", "Wikipedia"], ["Email", "Text message"],
  ["Wi-Fi", "Bluetooth"], ["Password", "PIN"], ["Touchscreen", "Trackpad"], ["Printer", "Scanner"], ["Alexa", "Siri"],
  ["PlayStation", "Xbox"], ["Minecraft", "Lego"], ["Fridge", "Freezer"], ["Kettle", "Toaster"], ["Candle", "Torch"],
  // getting around
  ["Train", "Bus"], ["Bicycle", "Motorbike"], ["Rocket", "Plane"], ["Taxi", "Uber"], ["Car", "Van"],
  ["Ship", "Submarine"], ["Helicopter", "Drone"], ["Tram", "Metro"], ["Scooter", "Skateboard"], ["Passport", "Visa"],
  // nature and weather
  ["Moon", "Sun"], ["Snow", "Rain"], ["Volcano", "Earthquake"], ["Rose", "Tulip"], ["Storm", "Hurricane"],
  ["Fog", "Smoke"], ["Star", "Planet"], ["Rainbow", "Sunset"], ["Tree", "Bush"], ["Sand", "Dust"],
  // ideas and feelings
  ["Love", "Crush"], ["Fear", "Anxiety"], ["Dream", "Nightmare"], ["Luck", "Fate"], ["Lie", "Secret"],
  ["Hope", "Wish"], ["Boredom", "Laziness"], ["Pride", "Ego"], ["Memory", "Nostalgia"], ["Friend", "Neighbour"],
  ["Gossip", "Rumour"], ["Promise", "Contract"], ["Holiday", "Weekend"], ["Morning", "Evening"], ["Silence", "Whisper"],
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
