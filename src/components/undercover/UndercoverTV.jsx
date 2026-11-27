import { useEffect, useState } from "react"
import { param, setParams, shareOrigin, store, useRelay } from "../../lib/relay.js"
import { Avatar, Offline, Qr } from "../ui.jsx"

const HOW = [
  ["Your word", "Everyone gets a secret word on their phone. Most share it. The Undercovers got a close cousin, and Mr White got nothing."],
  ["Describe", "Go round the order on the TV. Say one word or line about yours. Too vague looks suspicious, too exact helps the impostors."],
  ["Vote", "Vote on your phone for who to throw out. Their role is revealed. A tie goes to a re-vote."],
  ["Win", "Civilians win by clearing every impostor. Impostors win once one Civilian is left. Mr White, caught, can still win by guessing the word."],
]
export const ROLE = { civilian: "Civilian", undercover: "Undercover", mrwhite: "Mr White" }
export const WINNER = { civilian: "The Civilians win", undercover: "The impostors win", mrwhite: "Mr White guessed it" }

export default function UndercoverTV() {
  const [v, setV] = useState(null)
  const [host, setHost] = useState(false)
  const [error, setError] = useState("")
  const [origin, setOrigin] = useState("")
  useEffect(() => void shareOrigin().then(setOrigin), [])

  const { status, send } = useRelay(
    () => {
      const code = param("code")
      const party = param("party")
      const ph = store.get("shaam.host")
      return { t: "game.host", game: "undercover", code, key: store.get(`shaam.room.${code}`), party, partyKey: ph && ph.code === party ? ph.key : undefined }
    },
    (m) => {
      if (m.t === "game.hosted") {
        store.set(`shaam.room.${m.code}`, m.key)
        setParams({ code: m.code })
      } else if (m.t === "game") {
        setV(m.view)
        setHost(m.host)
      } else if (m.t === "error") setError(m.msg)
    },
  )
  const act = (a, extra = {}) => send({ t: "game.act", a, ...extra })

  if (!v) return <main className="tv center"><Offline status={status} /><p className="hint">Handing out words…</p></main>
  const byId = Object.fromEntries(v.players.map((p) => [p.id, p]))
  const joinUrl = `${origin}/undercover/play?code=${v.code}`
  const out = v.last?.out && byId[v.last.out]

  return (
    <main className={`tv game phase-${v.phase}`}>
      <Offline status={status} />
      <header className="game-head">
        <h1 className="brand">Undercover</h1>
        {v.round > 0 && v.phase !== "over" && <span className="round">Round {v.round}</span>}
        <span className="code-tag">Join · <b>{v.code}</b></span>
      </header>

      <section className="stage">
        {v.phase === "lobby" && <Lobby v={v} joinUrl={joinUrl} origin={origin} act={act} host={host} />}
        {v.phase === "describe" && (
          <div className="moment">
            {v.last && <LastVote v={v} byId={byId} />}
            <h2 className="display">Describe your word</h2>
            <p className="lede">One clue each, out loud, in this order. Then vote.</p>
            <ol className="order">
              {v.order.map((id) => byId[id] && <li key={id}><Avatar i={byId[id].avatar} size={40} /> {byId[id].name}</li>)}
            </ol>
            {host && <button className="btn primary big" onClick={() => act("vote")}>Everyone has spoken: vote</button>}
          </div>
        )}
        {v.phase === "vote" && (
          <div className="moment">
            {v.runoff && <LastVote v={v} byId={byId} />}
            <h2 className="display">{v.runoff ? "Re-vote between the tied" : "Vote on your phone"}</h2>
            <p className="lede">{v.players.filter((p) => p.voted).length} of {v.players.filter((p) => p.alive).length} votes in.</p>
            {host && <button className="btn" onClick={() => act("count")}>Count the votes now</button>}
          </div>
        )}
        {v.phase === "guess" && out && (
          <div className="moment">
            <Avatar i={out.avatar} size={120} ring />
            <h2 className="display">{out.name} was Mr White</h2>
            <p className="lede">One last chance: they are typing a guess at the Civilians' word. Right, and they win alone.</p>
          </div>
        )}
        {v.phase === "over" && <Final v={v} host={host} act={act} />}
      </section>

      <footer className="game-players">
        {v.players.map((p) => (
          <div key={p.id} className={`seat${p.alive ? "" : " out"}${p.voted ? " done" : ""}${p.connected ? "" : " gone"}`}>
            <Avatar i={p.avatar} size={44} dim={!p.connected} />
            <span className="seat-name">{p.name}</span>
            {p.role ? <span className="role">{ROLE[p.role]}</span> : <span className="role">{v.phase === "lobby" ? "ready" : "in"}</span>}
            {p.voted && <span className="tick" aria-label="voted">✓</span>}
          </div>
        ))}
      </footer>
      {error && <p className="toast" role="alert" onAnimationEnd={() => setError("")}>{error}</p>}
    </main>
  )
}

function LastVote({ v, byId }) {
  const l = v.last
  if (!l) return null
  const tally = (
    <p className="tally hint">
      {Object.entries(l.tally).map(([id, n]) => <span key={id}>{byId[id]?.name}: {n}</span>)}
    </p>
  )
  if (l.tie) return <div>{<p className="lede">{l.nobody ? "Another tie. Nobody leaves this round." : "A tie. Vote again, only between the tied players."}</p>}{tally}</div>
  const p = byId[l.out]
  return (
    <div>
      <p className="lede"><b>{p?.name}</b> is out. They were {l.role === "undercover" ? "an Undercover" : l.role === "mrwhite" ? "Mr White" : "a Civilian"}.{v.guess && ` Their guess, "${v.guess}", was wrong.`}</p>
      {tally}
    </div>
  )
}

function Final({ v, host, act }) {
  return (
    <div className="moment final">
      <h2 className="display">{WINNER[v.winner]}</h2>
      <p className="lede">Civilians had <b>{v.words.civilian}</b>, Undercovers had <b>{v.words.undercover}</b>.{v.guess && ` Mr White guessed "${v.guess}".`}</p>
      <ol className="ranks">
        {[...v.players].sort((a, b) => b.score - a.score).map((p) => (
          <li key={p.id} className={p.score ? "lead" : ""}>
            <span className="rank">{p.score ? "★" : ""}</span>
            <Avatar i={p.avatar} size={40} />
            <span className="name">{p.name}</span>
            <span className="meta">{ROLE[p.role]}</span>
            <span className="pts">{p.score}</span>
          </li>
        ))}
      </ol>
      <div className="row">
        {host && <button className="btn primary big" onClick={() => act("start")}>Play again, same players</button>}
        {host && <button className="btn big" onClick={() => act("lobby")}>Change settings</button>}
        {v.party && <a className="btn big" href={`/tv?code=${v.party}`}>Back to the party</a>}
      </div>
    </div>
  )
}

function Lobby({ v, joinUrl, origin, act, host }) {
  const c = v.config
  const n = v.players.length
  const civilians = n - c.undercovers - c.mrWhites
  const ok = n >= v.minPlayers && civilians > c.undercovers + c.mrWhites
  const num = (k, label, opts) => (
    <label>
      {label}
      <select value={c[k]} onChange={(e) => act("config", { config: { [k]: Number(e.target.value) } })} disabled={!host}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
  return (
    <div className="lobby">
      <div className="panel join-panel">
        <Qr url={origin && joinUrl} size={210} />
        <div>
          <p className="big-code">{v.code}</p>
          <p className="hint">Scan, or go to {joinUrl.replace(/^https?:\/\//, "")}</p>
          <p className="hint">{n} joined</p>
        </div>
      </div>
      <ol className="how">
        {HOW.map(([h, t], i) => (
          <li key={h}>
            <span className="how-n">{i + 1}</span>
            <b>{h}</b>
            <span>{t}</span>
          </li>
        ))}
      </ol>
      {host && (
        <div className="panel settings">
          {num("undercovers", "Undercovers", [1, 2, 3, 4, 5, 6])}
          {num("mrWhites", "Mr White", [0, 1, 2, 3])}
          <span className="hint">{Math.max(0, civilians)} Civilians</span>
          <button className="btn primary big" disabled={!ok} onClick={() => act("start")}>
            {n < v.minPlayers ? `Waiting for ${v.minPlayers - n} more` : ok ? `Deal words to ${n} players` : "Too many impostors"}
          </button>
        </div>
      )}
    </div>
  )
}
