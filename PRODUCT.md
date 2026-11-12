# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Friends playing party games at home. One host puts Shaam on a TV in the living room; everyone else
joins on their own phone and watches the TV from the sofa a few metres away. Mixed groups: some
play games often, some never do.

## Product Purpose
Shaam is the evening around the games: one party code, one guest list, and one leaderboard across
every game played that night. Success is a group that joins once, plays several games without
re-joining, and ends the night knowing who did best overall.

## Positioning
A neighbouring party game is one game. Shaam is the shelf and the scoreboard for many, including
games that live on their own sites (Noggin, Chorusify, Croon, Katze, Consensus, Dabber) and stay
unchanged; their results are typed in on the party TV. Ranking is by placement, so games scored on
different scales count the same.

## Operating Context
- TV: landscape, read from across a room, the only shared screen. The host drives it with a mouse or
  remote; it shows the join QR code and code, guests, the game shelf, and the leaderboard.
- Phones: portrait, private, used briefly (join, wait, follow into the next game). People should be
  looking at each other and the TV, not their phones.
- Built-in games (Reverie today) run at `/<slug>` on the same relay; phones follow the TV in and back.

## Capabilities and Constraints
- Party pages: `/` (landing), `/tv` (party TV), `/join` (party phone), 404.
- Each built-in game keeps its own name and visual identity inside Shaam. Shaam's look applies to the
  party pages, not to a game's own screens.
- Reverie's card theme is undecided: the owner will supply reference images later.
- Adding games follows GAMES.md.

## Brand Commitments
- Name: Shaam, at shaam.futile.studio.
- Party-page visual references were supplied by the owner (street stickers, die-cut sticker borders,
  zine collage, graffiti marker and spray, signage, halftone, Y2K transparent plastic, black grounds
  with loud accents). Binding for the party pages.

## Evidence on Hand
- Live game list in `shared/games.js`. No testimonials, player counts or press exist; do not invent them.

## Product Principles
- The TV is the stage; phones are a remote.
- Join once, play everything.
- Every game counts the same at the end of the night.
- Old games keep working exactly as they do.

## Accessibility & Inclusion
TV text must read from a sofa; phone controls must work one-handed with large targets. Respect
reduced motion.
