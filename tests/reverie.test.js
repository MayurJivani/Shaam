import assert from "node:assert/strict"
import { test } from "node:test"
import * as R from "../server/games/reverie.js"

function room(n = 4, config = {}) {
  const r = R.createRoom({ code: "TEST", config: { discussSecs: 0, ...config } })
  const tokens = []
  for (let i = 0; i < n; i++) tokens.push(R.join(r, { name: `P${i}`, avatar: i }).token)
  return { r, tokens }
}
const teller = (r) => r.players[r.teller]
const others = (r) => r.players.filter((p) => p !== teller(r))

test("scoring: some found it", () => {
  const { deltas, outcome } = R.scoreRound({
    teller: "t",
    tellerCard: 1,
    subs: { t: 1, a: 2, b: 3, c: 4 },
    votes: { a: 1, b: 2, c: 2 },
    playerIds: ["t", "a", "b", "c"],
  })
  assert.equal(outcome, "some")
  assert.deepEqual(deltas, { t: 3, a: 3 + 2, b: 0, c: 0 })
})

test("scoring: everyone or nobody found it", () => {
  const all = R.scoreRound({ teller: "t", tellerCard: 1, subs: { t: 1, a: 2, b: 3 }, votes: { a: 1, b: 1 }, playerIds: ["t", "a", "b"] })
  assert.equal(all.outcome, "all")
  assert.deepEqual(all.deltas, { t: 0, a: 2, b: 2 })
  const none = R.scoreRound({ teller: "t", tellerCard: 1, subs: { t: 1, a: 2, b: 3 }, votes: { a: 3, b: 2 }, playerIds: ["t", "a", "b"] })
  assert.equal(none.outcome, "none")
  assert.deepEqual(none.deltas, { t: 0, a: 3, b: 3 })
})

test("scoring: vote bonus caps at 3", () => {
  const ids = ["t", "a", "b", "c", "d", "e"]
  const { deltas } = R.scoreRound({
    teller: "t",
    tellerCard: 1,
    subs: { t: 1, a: 2, b: 3, c: 4, d: 5, e: 6 },
    votes: { a: 1, b: 2, c: 2, d: 2, e: 2 },
    playerIds: ids,
  })
  assert.equal(deltas.a, 3 + 3) // correct guess + capped bonus from four votes
})

test("a full round, private until the reveal", () => {
  const { r } = room(4)
  assert.equal(R.act(r, "host", { a: "start" }, 0), null)
  assert.equal(r.phase, "telling")
  for (const p of r.players) assert.equal(p.hand.length, 6)

  const t = teller(r)
  const tv = R.view(r, null, 0)
  assert.equal(tv.me, null)
  assert.ok(!JSON.stringify(tv).includes('"hand"'), "TV never sees a hand")
  assert.ok(R.act(r, others(r)[0].id, { a: "tell", card: others(r)[0].hand[0], clue: "x" }, 0), "only the storyteller tells")
  assert.equal(R.act(r, t.id, { a: "tell", card: t.hand[0], clue: "  Homesick  " }, 0), null)
  assert.equal(r.clue, "Homesick")

  const [a, b, c] = others(r)
  assert.equal(R.act(r, a.id, { a: "submit", card: a.hand[0] }, 1), null)
  assert.ok(R.act(r, a.id, { a: "submit", card: a.hand[0] }, 1), "no second submission")
  R.act(r, b.id, { a: "submit", card: b.hand[0] }, 1)
  R.act(r, c.id, { a: "submit", card: c.hand[0] }, 1)
  assert.equal(r.phase, "voting")
  assert.equal(r.table.length, 4)
  assert.equal(R.view(r, null, 1).last, null, "owners stay hidden while voting")

  assert.ok(R.act(r, a.id, { a: "vote", card: r.subs[a.id] }, 2), "no voting for your own card")
  assert.ok(R.act(r, t.id, { a: "vote", card: r.subs[a.id] }, 2), "storyteller does not vote")
  R.act(r, a.id, { a: "vote", card: r.subs[t.id] }, 2)
  assert.ok(R.act(r, a.id, { a: "vote", card: r.subs[b.id] }, 2), "no second vote")
  R.act(r, b.id, { a: "vote", card: r.subs[a.id] }, 2)
  R.act(r, c.id, { a: "vote", card: r.subs[a.id] }, 2)
  assert.equal(r.phase, "reveal")
  assert.equal(t.score, 3)
  assert.equal(a.score, 3 + 2)
  assert.equal(R.view(r, null, 2).last.cards.length, 4)
})

test("clocks: missing players get a decoy, the round moves on", () => {
  const { r } = room(3, { submitSecs: 10, voteSecs: 10 })
  R.act(r, "host", { a: "start" }, 0)
  const t = teller(r)
  R.act(r, t.id, { a: "tell", card: t.hand[0], clue: "x" }, 0)
  assert.equal(R.tick(r, 9_999), false)
  assert.equal(R.tick(r, 10_000), true)
  assert.equal(r.phase, "voting")
  assert.equal(r.table.length, 3)
  R.tick(r, 20_000)
  assert.equal(r.phase, "reveal")
})

test("pause holds the clock", () => {
  const { r } = room(3, { submitSecs: 10 })
  R.act(r, "host", { a: "start" }, 0)
  const t = teller(r)
  R.act(r, t.id, { a: "tell", card: t.hand[0], clue: "x" }, 0)
  R.act(r, "host", { a: "pause" }, 4_000)
  assert.equal(R.tick(r, 60_000), false)
  R.act(r, "host", { a: "resume" }, 60_000)
  assert.equal(R.tick(r, 65_999), false)
  assert.equal(R.tick(r, 66_000), true)
})

test("reconnect by token keeps the seat; disconnected storyteller is passed over", () => {
  const { r, tokens } = room(3)
  R.setConnected(r, r.players[0].id, false)
  R.act(r, "host", { a: "start" }, 0)
  assert.notEqual(r.teller, 0)
  const back = R.join(r, { token: tokens[0] })
  assert.equal(back.player, r.players[0])
  assert.equal(back.player.connected, true)
  assert.equal(r.players.length, 3)
})

test("game ends after the configured rounds with standings", () => {
  const { r } = room(3, { rounds: 1 })
  R.act(r, "host", { a: "start" }, 0)
  assert.equal(R.standings(r), null)
  R.act(r, "host", { a: "advance" }, 0) // skipping a storyteller does not use up a round
  assert.equal(r.round, 1)
  const t = teller(r)
  R.act(r, t.id, { a: "tell", card: t.hand[0], clue: "x" }, 0)
  for (let i = 0; i < 3; i++) R.act(r, "host", { a: "advance" }, i) // submitting, voting, reveal -> over
  assert.equal(r.phase, "over")
  assert.equal(R.standings(r).length, 3)
})

test("joins are validated", () => {
  const { r } = room(6, { maxPlayers: 6 })
  assert.match(R.join(r, { name: "late" }).error, /full/)
  assert.match(R.join(R.createRoom({ code: "X" }), { name: "  " }).error, /name/)
  assert.equal(R.cleanConfig({ maxPlayers: 99, rounds: "x" }).maxPlayers, 12)
  assert.equal(R.cleanConfig({ rounds: "x" }).rounds, 8)
})

test("fixed clues: only an offered prompt is accepted", () => {
  const { r } = room(3, { customClues: false })
  R.act(r, "host", { a: "start" }, 0)
  const t = teller(r)
  assert.ok(R.act(r, t.id, { a: "tell", card: t.hand[0], clue: "anything" }, 0))
  assert.equal(R.act(r, t.id, { a: "tell", card: t.hand[0], clue: r.prompts[1] }, 0), null)
})
