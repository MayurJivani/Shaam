import assert from "node:assert/strict"
import { test } from "node:test"
import * as U from "../shared/undercover.js"

/** A game of n players with roles dealt in seat order: the given roles first, Civilians after; everyone has looked. */
function game(n, roles) {
  const names = Array.from({ length: n }, (_, i) => `P${i}`)
  const config = { undercovers: roles.filter((r) => r === "undercover").length, mrWhites: roles.filter((r) => r === "mrwhite").length }
  const g = U.deal(names, config, (a) => [...roles, ...a.filter((x) => x === "civilian")])
  for (let i = 0; i < n; i++) U.seen(g)
  U.openVote(g)
  return g
}

test("setup refuses bad line-ups", () => {
  assert.match(U.setupError(["a", "b"], { undercovers: 1, mrWhites: 0 }), /at least 3/)
  assert.match(U.setupError(["a", "b", "c", "d"], { undercovers: 1, mrWhites: 1 }), /Too many impostors/)
  assert.match(U.setupError(["Ana", "ana", "b", "c"], { undercovers: 1, mrWhites: 0 }), /different name/)
  assert.equal(U.setupError(["a", "b", "c", "d", "e"], { undercovers: 1, mrWhites: 1 }), null)
})

test("the phone goes round once, then Mr White never speaks first", () => {
  const g = U.deal(["a", "b", "c", "d", "e"], { undercovers: 1, mrWhites: 1 }, (a) => ["mrwhite", "undercover", "civilian", "civilian", "civilian"])
  assert.equal(U.wordOf(g, 0), null)
  assert.equal(U.wordOf(g, 1), g.words.undercover)
  assert.equal(U.wordOf(g, 2), g.words.civilian)
  assert.notEqual(g.words.civilian, g.words.undercover)
  for (let i = 0; i < 4; i++) U.seen(g)
  assert.equal(g.phase, "pass")
  U.seen(g)
  assert.equal(g.phase, "describe")
  assert.notEqual(g.order[0], 0)
})

test("civilians win by voting out every impostor, 2 points each", () => {
  const g = game(5, ["undercover"])
  assert.equal(U.eliminate(g, 0), null)
  assert.equal(g.winner, "civilian")
  assert.deepEqual(g.players.map((p) => p.score), [0, 2, 2, 2, 2])
})

test("impostors win once one civilian is left", () => {
  const g = game(4, ["undercover"])
  U.eliminate(g, 1)
  assert.equal(g.phase, "describe", "three left, the game goes on")
  assert.match(U.eliminate(g, 2), /Not the time/)
  U.openVote(g)
  assert.match(U.eliminate(g, 1), /still in/)
  U.eliminate(g, 2)
  assert.equal(g.winner, "undercover")
  assert.equal(g.players[0].score, U.POINTS.undercover)
})

test("caught Mr White wins alone with the right word, game goes on with a wrong one", () => {
  const g = game(5, ["mrwhite", "undercover"])
  U.eliminate(g, 0)
  assert.equal(g.phase, "guess")
  U.guessWord(g, ` ${g.words.civilian.toUpperCase()}!`)
  assert.equal(g.winner, "mrwhite")
  assert.deepEqual(g.players.map((p) => p.score), [6, 0, 0, 0, 0])

  const b = game(5, ["mrwhite", "undercover"])
  U.eliminate(b, 0)
  U.guessWord(b, "definitely not it")
  assert.equal(b.phase, "describe")
})
