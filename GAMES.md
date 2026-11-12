# Adding a game to Shaam

Shaam is the party around the games: one code for the evening, one list of
who is here, and one leaderboard across every game played. A game joins the
party in one of two ways, and neither changes how the game itself plays.

| | Built-in game | Outside game |
| --- | --- | --- |
| Lives at | `shaam.futile.studio/<slug>` (this repo) | its own host, e.g. `noggin.futile.studio` |
| Runs on | this relay, `server/games/<slug>.js` | its own server |
| Players arrive | phones follow the party TV in automatically | phones get an "Open <game>" button |
| Result reaches the party | automatically at game over | typed in on the party TV, or POSTed (below) |
| Example | Reverie | Noggin, Chorusify, Croon |

## Step 1, always: the shelf

Add one line to [`shared/games.js`](shared/games.js). The relay refuses any
slug not listed there, and the party TV draws its shelf from it.

```js
{ slug: "mygame", name: "My Game", builtIn: true, players: "3 to 8", blurb: "One line a guest can read from the sofa." },
// or, for an existing game on its own host:
{ slug: "mygame", name: "My Game", url: "https://mygame.futile.studio/host", join: "https://mygame.futile.studio/play?code={code}&name={name}", players: "any", blurb: "..." },
```

For an outside game that is the whole job. Launch it from the party TV, open
its room, and type the room code into the TV. Every phone then gets a button to
the `join` link with `{code}` and the player's party name filled in.

To make that one tap, the game's player page should join on its own when the
URL carries both the code and `?name=`: prefill the name, submit once, and fall
back to the normal form if the join fails. Without `?name=` it behaves as before.
Noggin, Chorusify, Croon, Katze, Consensus and Dabber all do this.

After the game, type everyone's final score into the form the TV shows. The host
can leave any game out of the night with its "In tonight" toggle on the shelf.

## Built-in game: the engine contract

`server/games/<slug>.js` is plain functions over one room object: no sockets,
no timers, no I/O. The relay owns connections and the clock, calls these, and
sends each screen its `view`. Register the module in `ENGINES` in
`server/index.js`. Reverie (`server/games/reverie.js`) is the reference.

```js
export const slug = "mygame"
export function createRoom({ code, party })            // -> room state; keep `party` on it as `room.party`
export function join(room, { name, avatar, token, partyId }) // -> { player: { id }, token } | { error }
export function setConnected(room, playerId, connected)
export function act(room, actor, msg, now)             // actor is "host" (the TV) or a player id; -> error string | null
export function tick(room, now)                        // -> true when the state changed (a clock ran out)
export function view(room, playerId, now)              // playerId null = the TV. Only what that screen may see.
export function standings(room)                        // -> null until game over, then [{ partyId, name, score }]
```

Rules every engine keeps:

- **Server decides.** Clients send intent (`{ t: "game.act", a: "vote", card: 3 }`);
  the engine validates every field and rejects duplicates. Never trust a
  client's idea of whose turn it is or what scored.
- **Views are redacted.** Hands, secret picks and votes go only to their
  owner until the reveal. Write a test that the TV view does not contain them.
- **Clocks are `left` in ms**, not timestamps, so phone clock skew does not matter.
  Pause stores what is left; resume re-arms from now.
- **Seats survive reconnects.** `join` with a known `token`, or a known
  `partyId`, returns the same seat. A player who drops is marked, not removed,
  and the game carries on without waiting for them.
- **`standings` once.** The relay reports it to the party the first time it is
  non-null and never again. Scores can be on any scale: the party ranks by
  placement (one point per player beaten), so 900 Noggin points and 30
  Reverie points weigh the same.

Pages go in `src/pages/<slug>/index.astro` (TV) and `src/pages/<slug>/play.astro`
(phone). The TV sends `game.host` with `code`, `key`, `party` and `partyKey`
(from the URL and localStorage, see `ReverieTV.jsx`). The phone sends `game.join`
with its seat token and the party token in `shaam.me`, so a party guest
never types their name twice. When `view.phase` is over and `view.party` is
set, send the phone back to `/join?code=<party>`; that is how it follows the
TV into the next game. Reuse `src/lib/relay.js` (`useRelay`, `useCountdown`) and
`src/components/ui.jsx` (`Avatar`, `JoinForm`, `Qr`).

## Outside game: reporting a result (optional)

An outside game that wants to skip the typing can post its final standings
from the host's browser. The party TV would have to hand it the party code and
host key (for example as `#party=CODE&key=KEY` on the launch link; the hash
never reaches a server log). Nothing launches games that way yet, so this is
the contract for when one adopts it.

```
POST https://shaam.futile.studio/api/parties/CODE/results
Authorization: Bearer <party host key>
Content-Type: application/json

{ "game": "noggin", "standings": [ { "name": "Ana", "score": 900 }, { "name": "Bo", "score": 400 } ] }
```

- `204` stored and every party screen updated; `400` bad body or unknown
  slug; `401` unknown party or wrong key.
- Names match party guests case-insensitively. Anyone unmatched is kept as a
  guest row, so nothing is dropped.
- CORS answers `https://*.futile.studio` and `https://chorusify.com` only.
  Body limit 16 KB, 64 rows.
