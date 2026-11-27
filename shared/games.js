/**
 * Every game a party can launch. Read by the relay (to refuse anything else)
 * and by the pages (to draw the shelf). Adding a game starts here: GAMES.md.
 *
 * builtIn: lives in this repo at /<slug>, runs on this relay, reports its own result.
 * url:     an existing game on its own host. Launched by link and left unchanged;
 *          the host types the result in afterwards, unless the game reports it (GAMES.md).
 * join:    that game's player link; {code} is the room code the host types on the
 *          party TV and {name} the player's party name, so nobody types either twice.
 */
export const GAMES = [
  { slug: "undercover", name: "Undercover", url: "/undercover", players: "3 to 20", blurb: "Everyone has the same word. Almost. One phone, passed round. Find the Undercovers and Mr White." },
  { slug: "noggin", name: "Noggin", url: "https://noggin.futile.studio/host", join: "https://noggin.futile.studio/play?code={code}&name={name}", players: "2 to 12", blurb: "A quiz-board game show. Buzz from your phone." },
  { slug: "chorusify", name: "Chorusify", url: "https://chorusify.com/multiplayer", join: "https://chorusify.com/room/{code}?name={name}", players: "2 to 8", blurb: "Name the song from the first second of it." },
  { slug: "bleep", name: "Bleep", url: "https://bleep.futile.studio", join: "https://bleep.futile.studio/{code}", players: "4 to 12", blurb: "Two channels, secret keywords. Send clues your team gets and the others don't." },
  { slug: "haggle", name: "Haggle", url: "https://haggle.futile.studio/rooms", join: "https://haggle.futile.studio/room/{code}", players: "any", blurb: "A live stock market for the whole room. Trade and finish richest." },
  { slug: "pressure", name: "Pressure", url: "https://pressure.futile.studio", join: "https://pressure.futile.studio/r/{code}", players: "any", blurb: "One button, one instruction, everyone at once. Last ball standing wins." },
  { slug: "croon", name: "Croon", url: "https://croon.futile.studio/rooms", join: "https://croon.futile.studio/r/{code}?name={name}", players: "any", blurb: "Karaoke lounge. The queue rotates so everybody sings." },
  { slug: "katze", name: "Katze", url: "https://katze.futile.studio", join: "https://katze.futile.studio/?code={code}&name={name}", players: "3 to 6", blurb: "Skull, with Schrodinger's cat. Bluff your boxes." },
  { slug: "consensus", name: "Consensus", url: "https://consensus.futile.studio/host", join: "https://consensus.futile.studio/play?code={code}&name={name}", players: "any", blurb: "Read the room, not the answer key." },
  { slug: "dabber", name: "Dabber", url: "https://dabber.futile.studio", join: "https://dabber.futile.studio/r/{code}?name={name}", players: "any", blurb: "A different daily game every round." },
]

export const gameBySlug = (slug) => GAMES.find((g) => g.slug === slug)

/** The player link for an outside game, or its home page while the host has not typed a room code yet. */
export const joinUrl = (g, code, name) =>
  code && g.join ? g.join.replace("{code}", encodeURIComponent(code)).replace("{name}", encodeURIComponent(name ?? "")) : g.url
