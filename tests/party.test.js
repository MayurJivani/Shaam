import assert from "node:assert/strict"
import { test } from "node:test"
import * as P from "../server/party.js"

test("party host key and player tokens are checked", () => {
  const { party, key } = P.createParty("ABCD")
  assert.equal(P.isHost(party, key), true)
  assert.equal(P.isHost(party, "nope"), false)
  const a = P.joinParty(party, { name: "Ana", avatar: 3 })
  assert.equal(P.findPlayer(party, a.token), a.player)
  assert.equal(P.joinParty(party, { token: a.token }).player, a.player)
  assert.match(P.joinParty(party, { name: "ana" }).error, /taken/)
  assert.ok(!JSON.stringify(P.publicParty(party)).includes("Hash"))
})

test("line-up: no list means every game, a list limits it", () => {
  const { party } = P.createParty("LINE")
  assert.equal(P.inParty(party, "noggin"), true)
  party.games = ["reverie"]
  assert.equal(P.inParty(party, "noggin"), false)
  assert.equal(P.inParty(party, "reverie"), true)
  assert.deepEqual(P.publicParty(party).games, ["reverie"])
})

test("outside game link carries room code and name, falls back to the game's page", async () => {
  const { gameBySlug, joinUrl } = await import("../shared/games.js")
  const n = gameBySlug("noggin")
  assert.equal(joinUrl(n, "AB12", "Ana Bo"), "https://noggin.futile.studio/play?code=AB12&name=Ana%20Bo")
  assert.equal(joinUrl(n, null, "Ana"), n.url)
})

test("leaderboard ranks by placement across games", () => {
  const { party } = P.createParty("EFGH")
  const ana = P.joinParty(party, { name: "Ana" }).player
  const bo = P.joinParty(party, { name: "Bo" }).player
  P.recordResult(party, "reverie", [
    { partyId: ana.id, score: 30 },
    { partyId: bo.id, score: 12 },
    { name: "Guest", score: 12 },
  ])
  P.recordResult(party, "noggin", [
    { name: "bo", score: 900 },
    { name: "Ana", score: 100 },
  ])
  const [first, second] = P.leaderboard(party)
  assert.equal(first.name, "Ana") // 2 + 0 points
  assert.equal(first.points, 2)
  assert.equal(second.name, "Bo") // 0 + 1 points, one win
  assert.equal(second.wins, 1)
  assert.ok(P.leaderboard(party).some((r) => r.name === "Guest"))
  assert.equal(P.recordResult(party, "x", []), "No standings to record")
})
