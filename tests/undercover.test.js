import assert from "node:assert/strict"
import { test } from "node:test"
import * as U from "../server/games/undercover.js"

/** A room of n players with roles dealt in seat order: the given roles first, Civilians after. */
function room(n, roles, config = {}) {
  const r = U.createRoom({ code: "TEST", config })
  const ids = Array.from({ length: n }, (_, i) => U.join(r, { name: `P${i}`, avatar: i }).player.id)
  assert.equal(U.deal(r, (a) => [...roles, ...a.filter((x) => x === "civilian")].slice(0, n)), null)
  return { r, ids }
}
const voteAll = (r, target) => {
  for (const p of r.players.filter((p) => p.alive && p.id !== target)) U.act(r, p.id, { a: "vote", target })
  // the target votes for somebody else so the count closes
  if (r.phase === "vote") U.act(r, target, { a: "vote", target: r.players.find((p) => p.alive && p.id !== target).id })
}

test("deal refuses too many impostors and gives Mr White no word", () => {
  const r = U.createRoom({ code: "X", config: { undercovers: 1, mrWhites: 1 } })
  for (let i = 0; i < 4; i++) U.join(r, { name: `P${i}` })
  assert.match(U.deal(r), /Too many impostors/)
  U.join(r, { name: "P4" })
  assert.equal(U.deal(r), null)
  const mw = r.players.find((p) => p.role === "mrwhite")
  assert.equal(U.view(r, mw.id).me.word, null)
  assert.equal(U.view(r, mw.id).me.mrWhite, true)
  assert.notEqual(r.words.civilian, r.words.undercover)
  assert.notEqual(r.order[0], mw.id, "Mr White never speaks first")
})

test("TV view leaks no roles or words until someone is out", () => {
  const { r } = room(5, ["undercover", "mrwhite"])
  const tv = JSON.stringify(U.view(r, null))
  assert.ok(!tv.includes(r.words.civilian) && !tv.includes(r.words.undercover))
  assert.ok(U.view(r, null).players.every((p) => p.role === null))
})

test("civilians win by voting out every impostor, 2 points each", () => {
  const { r, ids } = room(5, ["undercover"], { undercovers: 1, mrWhites: 0 })
  U.act(r, "host", { a: "vote" })
  voteAll(r, ids[0])
  assert.equal(r.phase, "over")
  assert.equal(r.winner, "civilian")
  assert.deepEqual(U.standings(r).map((s) => s.score), [0, 2, 2, 2, 2])
})

test("impostors win when one civilian is left; a tie re-votes first", () => {
  const { r, ids } = room(4, ["undercover"], { undercovers: 1, mrWhites: 0 })
  U.act(r, "host", { a: "vote" })
  voteAll(r, ids[1]) // a Civilian goes; three left, the game carries on
  assert.equal(r.players[1].alive, false)
  assert.equal(r.phase, "describe")
  U.act(r, "host", { a: "vote" })
  U.act(r, ids[0], { a: "vote", target: ids[2] })
  U.act(r, ids[2], { a: "vote", target: ids[3] })
  U.act(r, ids[3], { a: "vote", target: ids[0] })
  assert.deepEqual(r.runoff?.length, 3, "three-way tie goes to a re-vote")
  assert.match(U.act(r, ids[0], { a: "vote", target: ids[0] }), /another player/)
  U.act(r, ids[0], { a: "vote", target: ids[2] })
  U.act(r, ids[3], { a: "vote", target: ids[2] })
  U.act(r, ids[2], { a: "vote", target: ids[3] })
  assert.equal(r.winner, "undercover")
  assert.equal(U.standings(r)[0].score, U.POINTS.undercover)
})

test("caught Mr White wins alone with the right word, game goes on with a wrong one", () => {
  const { r, ids } = room(5, ["mrwhite"], { undercovers: 0, mrWhites: 1 })
  U.act(r, "host", { a: "vote" })
  voteAll(r, ids[0])
  assert.equal(r.phase, "guess")
  assert.match(U.act(r, ids[1], { a: "guess", word: "x" }), /Not your guess/)
  U.act(r, ids[0], { a: "guess", word: ` ${r.words.civilian.toUpperCase()}!` })
  assert.equal(r.winner, "mrwhite")
  assert.deepEqual(U.standings(r).map((s) => s.score), [6, 0, 0, 0, 0])

  const b = room(5, ["mrwhite", "undercover"], { undercovers: 1, mrWhites: 1 })
  U.act(b.r, "host", { a: "vote" })
  voteAll(b.r, b.ids[0])
  U.act(b.r, b.ids[0], { a: "guess", word: "definitely not it" })
  assert.equal(b.r.phase, "describe")
})

test("seats survive reconnects; nobody new joins mid-game", () => {
  const r = U.createRoom({ code: "X" })
  const a = U.join(r, { name: "Ana" })
  for (const n of ["Bo", "Cy", "Di", "Ed"]) U.join(r, { name: n })
  U.deal(r)
  assert.equal(U.join(r, { token: a.token }).player, a.player)
  assert.match(U.join(r, { name: "Late" }).error, /started/)
})
