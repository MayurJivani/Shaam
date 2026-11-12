import { useEffect, useState } from "react"
import { GAMES, gameBySlug } from "../../../shared/games.js"
import { param, setParams, shareOrigin, store, useRelay } from "../../lib/relay.js"
import { Avatar, Offline, Qr } from "../ui.jsx"

/**
 * The party's big screen: the code to join, who is here, the game shelf and
 * the running leaderboard. Launching a built-in game hands this TV over to it;
 * an outside game opens in a new tab and its result is typed in here after.
 */
export default function PartyTV() {
  const [party, setParty] = useState(null)
  const [error, setError] = useState("")
  const [origin, setOrigin] = useState("")
  useEffect(() => void shareOrigin().then(setOrigin), [])

  const { status, send } = useRelay(
    () => {
      const saved = store.get("shaam.host")
      const code = param("code") || saved?.code
      return { t: "party.host", code, key: saved && saved.code === code ? saved.key : undefined }
    },
    (m) => {
      if (m.t === "party.hosted") {
        store.set("shaam.host", { code: m.code, key: m.key })
        setParams({ code: m.code })
      } else if (m.t === "party") setParty(m.party)
      else if (m.t === "party.launched") {
        store.set(`shaam.room.${m.room}`, m.key)
        location.href = `/${m.game}?code=${m.room}&party=${store.get("shaam.host").code}`
      } else if (m.t === "error") setError(m.msg)
    },
  )

  if (!party) return <main className="tv center"><Offline status={status} /><p className="hint">Opening Shaam…</p></main>
  const joinUrl = `${origin}/join?code=${party.code}`
  const current = party.current && gameBySlug(party.current.game)

  return (
    <main className="tv party-tv">
      <Offline status={status} />
      <header className="tv-head">
        <h1 className="brand">Shaam</h1>
        <p className="tagline">One party, every game. Whoever does best across the night wins it.</p>
      </header>

      <section className="panel join-panel">
        <Qr url={origin && joinUrl} size={200} />
        <div>
          <p className="big-code">{party.code}</p>
          <p className="hint">Scan, or go to {joinUrl.replace(/^https?:\/\//, "")}</p>
          <p className="scribble">join on your phone!</p>
        </div>
        <ul className="chips">
          {party.players.map((p) => (
            <li key={p.id} className="chip"><Avatar i={p.avatar} size={30} /> {p.name}</li>
          ))}
          {!party.players.length && <li className="hint">Nobody yet. Scan the code.</li>}
        </ul>
      </section>

      {current ? (
        <NowPlaying party={party} game={current} send={send} />
      ) : (
        <section className="shelf" aria-label="Games">
          {GAMES.map((g) => {
            const lineup = party.games ?? GAMES.map((x) => x.slug)
            const on = lineup.includes(g.slug)
            const toggle = () => send({ t: "party.games", games: on ? lineup.filter((s) => s !== g.slug) : [...lineup, g.slug] })
            return (
              <div key={g.slug} className={`shelf-slot${on ? "" : " out"}`}>
                <button className="shelf-card" disabled={!on} onClick={() => send({ t: "party.launch", game: g.slug })}>
                  <span className="shelf-name">{g.name}</span>
                  <span className="shelf-blurb">{g.blurb}</span>
                  <span className="shelf-meta">{g.players} players · {g.builtIn ? "plays here" : "opens its own site"}</span>
                </button>
                <button className="lineup-toggle" aria-pressed={on} onClick={toggle} aria-label={`${on ? "Remove" : "Add"} ${g.name} ${on ? "from" : "to"} tonight`}>
                  {on ? "In tonight" : "Left out"}
                </button>
              </div>
            )
          })}
        </section>
      )}

      <Leaderboard party={party} />
      {error && <p className="toast" role="alert" onAnimationEnd={() => setError("")}>{error}</p>}
    </main>
  )
}

function NowPlaying({ party, game, send }) {
  const [scores, setScores] = useState({})
  if (game.builtIn) {
    return (
      <section className="panel now">
        <h2>{game.name}</h2>
        <p className="scribble">now playing</p>
        <div className="row">
          <a className="btn primary" href={`/${game.slug}?code=${party.current.room}&party=${party.code}`}>Back to {game.name}</a>
          <button className="btn ghost" onClick={() => send({ t: "party.clear" })}>Abandon it</button>
        </div>
      </section>
    )
  }
  const record = (e) => {
    e.preventDefault()
    send({ t: "party.record", game: game.slug, scores: party.players.filter((p) => scores[p.id] !== undefined && scores[p.id] !== "").map((p) => ({ playerId: p.id, score: Number(scores[p.id]) })) })
  }
  return (
    <section className="panel now">
      <h2>{game.name}</h2>
      <p className="scribble">now playing</p>
      <p className="hint">Open it and create a room. Type its room code here and every phone gets a button that joins it under their party name. Afterwards, type in everyone's final score.</p>
      <div className="row">
        <a className="btn" href={game.url} target="_blank" rel="noopener">Open {game.name}</a>
        <form className="row" onSubmit={(e) => { e.preventDefault(); send({ t: "party.room", code: new FormData(e.target).get("code") }) }}>
          <input name="code" className="code-input room-code" defaultValue={party.current.code ?? ""} placeholder="ROOM" maxLength={16} autoComplete="off" aria-label={`${game.name} room code`} />
          <button className="btn primary">{party.current.code ? "Update" : "Send to phones"}</button>
        </form>
      </div>
      <form className="score-entry" onSubmit={record}>
        {party.players.map((p) => (
          <label key={p.id}>
            <Avatar i={p.avatar} size={26} /> {p.name}
            <input type="number" inputMode="numeric" value={scores[p.id] ?? ""} onChange={(e) => setScores({ ...scores, [p.id]: e.target.value })} />
          </label>
        ))}
        <div className="row">
          <button className="btn primary">Record result</button>
          <button type="button" className="btn ghost" onClick={() => send({ t: "party.clear" })}>Skip it</button>
        </div>
      </form>
    </section>
  )
}

function Leaderboard({ party }) {
  if (!party.results.length) return null
  return (
    <section className="panel board">
      <h2>The night so far <span className="hint">{party.results.length} game{party.results.length > 1 ? "s" : ""}</span></h2>
      <ol className="ranks">
        {party.leaderboard.map((r) => (
          <li key={r.key} className={r.points === party.leaderboard[0].points ? "lead" : ""}>
            <span className="rank">{1 + party.leaderboard.filter((o) => o.points > r.points).length}</span>
            <Avatar i={r.avatar} size={34} />
            <span className="name">{r.name}</span>
            <span className="meta">{r.wins ? `${r.wins} win${r.wins > 1 ? "s" : ""} · ` : ""}{r.played} played</span>
            <span className="pts">{r.points}</span>
          </li>
        ))}
      </ol>
      <p className="hint">One point for every player you beat in a game.</p>
      <ul className="history">
        {party.results.map((r, i) => {
          const top = [...r.standings].sort((a, b) => b.score - a.score)[0]
          return <li key={i}>{gameBySlug(r.game)?.name ?? r.game}: {top?.name} won</li>
        })}
      </ul>
    </section>
  )
}
