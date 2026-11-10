# Shaam

[![Live](https://img.shields.io/website?url=https%3A%2F%2Fshaam.futile.studio&label=shaam.futile.studio&color=1b1640)](https://shaam.futile.studio)
![Astro](https://img.shields.io/badge/Astro-7-1b1640?logo=astro&logoColor=f4d58d)
![React](https://img.shields.io/badge/React-19-1b1640?logo=react&logoColor=f4d58d)
![WebSockets](https://img.shields.io/badge/realtime-WebSockets-1b1640)
[![Last commit](https://img.shields.io/github/last-commit/MayurJivani/Shaam?color=1b1640)](https://github.com/MayurJivani/Shaam/commits/main)

Party games for one TV and a room full of phones. Start a party on the TV,
everyone joins once with a code, and every game played that night counts
towards one leaderboard.

- **Reverie** is built in: a storytelling and guessing game in the spirit of
  Dixit for 3 to 12 players, with 240 original illustrated cards drawn in code.
- **Noggin, Chorusify, Croon** and the rest launch from the same shelf and play
  exactly as they always have. Their result is typed in on the party TV.

Adding a game, built-in or outside: [GAMES.md](GAMES.md).

## Run it

```bash
npm install
npm run dev      # relay on :4401, pages on :4400 (open /tv on the TV, scan the QR with phones)
npm test
npm run build && npm start   # production: one process serves dist/, /api and /ws on :4401
```

## Layout

| Path | What |
| --- | --- |
| `server/index.js` | relay: static files, `/api`, the WebSocket |
| `server/party.js` | parties, the cross-game leaderboard, JSON persistence in `data/` |
| `server/games/reverie.js` | Reverie's rules, scoring and redacted views |
| `shared/games.js` | the shelf |
| `src/lib/cardArt.js` | the Reverie deck as seeded SVG scenes |
