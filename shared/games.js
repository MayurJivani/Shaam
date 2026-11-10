/**
 * Every game a party can launch. Read by the relay (to refuse anything else)
 * and by the pages (to draw the shelf). Adding a game starts here: GAMES.md.
 *
 * builtIn: lives in this repo at /<slug>, runs on this relay, reports its own result.
 * url:     an existing game on its own host. Launched by link and left unchanged;
 *          the host types the result in afterwards, unless the game reports it (GAMES.md).
 */
export const GAMES = [
  { slug: "reverie", name: "Reverie", builtIn: true, players: "3 to 12", blurb: "One clue, a table of strange pictures. Find the storyteller's card." },
  { slug: "noggin", name: "Noggin", url: "https://noggin.futile.studio", players: "2 to 12", blurb: "A quiz-board game show. Buzz from your phone." },
  { slug: "chorusify", name: "Chorusify", url: "https://chorusify.com", players: "2 to 8", blurb: "Name the song from the first second of it." },
  { slug: "croon", name: "Croon", url: "https://croon.futile.studio", players: "any", blurb: "Karaoke lounge. The queue rotates so everybody sings." },
  { slug: "katze", name: "Katze", url: "https://katze.futile.studio", players: "3 to 6", blurb: "Skull, with Schrodinger's cat. Bluff your boxes." },
  { slug: "consensus", name: "Consensus", url: "https://consensus.futile.studio", players: "any", blurb: "Read the room, not the answer key." },
  { slug: "dabber", name: "Dabber", url: "https://dabber.futile.studio", players: "any", blurb: "A different daily game every round." },
]

export const gameBySlug = (slug) => GAMES.find((g) => g.slug === slug)
