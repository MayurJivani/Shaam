import { useEffect, useState } from "react"
import { param, setParams, shareOrigin, store, useCountdown, useRelay } from "../../lib/relay.js"
import { Avatar, Offline, Qr } from "../ui.jsx"
import { Card } from "./Card.jsx"

const HOW = [
  ["Tell", "The storyteller picks one of their cards and gives a clue: a word, a line, a sound."],
  ["Match", "Everyone else plays the card from their hand that fits the clue best."],
  ["Guess", "All the cards land here, shuffled. Talk, then vote for the storyteller's card."],
  ["Score", "Too obvious or too obscure and the storyteller gets nothing. Fool people to earn more."],
]

/** The board: everything public happens here, nothing private ever does. */
export default function ReverieTV() {
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
      return { t: "game.host", game: "reverie", code, key: store.get(`shaam.room.${code}`), party, partyKey: ph && ph.code === party ? ph.key : undefined }
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
  const secs = useCountdown(v?.left, v?.paused)
  const act = (a, extra = {}) => send({ t: "game.act", a, ...extra })

  if (!v) return <main className="tv center"><Offline status={status} /><p className="hint">Setting the table…</p></main>
  const teller = v.players.find((p) => p.id === v.tellerId)
  const byId = Object.fromEntries(v.players.map((p) => [p.id, p]))
  const joinUrl = `${origin}/reverie/play?code=${v.code}`

  return (
    <main className={`tv reverie phase-${v.phase}`}>
      <Offline status={status} />
      <header className="rv-head">
        <h1 className="brand">Reverie</h1>
        {v.phase !== "lobby" && v.phase !== "over" && <span className="round">Round {v.round} of {v.config.rounds}</span>}
        <span className="code-tag">Join · <b>{v.code}</b></span>
        {secs != null && <Timer secs={secs} paused={v.paused} />}
      </header>

      <section className="stage">
        {v.phase === "lobby" && <Lobby v={v} joinUrl={joinUrl} origin={origin} act={act} host={host} />}
        {v.phase === "telling" && teller && (
          <div className="moment">
            <Avatar i={teller.avatar} size={120} ring />
            <h2 className="display">{teller.name} is the storyteller</h2>
            <p className="lede">They are choosing a card and thinking of a clue. Everyone else: look through your hand.</p>
          </div>
        )}
        {v.phase === "submitting" && (
          <div className="moment">
            <Clue text={v.clue} by={teller} />
            <p className="lede">Everyone else, play the card from your hand that best fits the clue.</p>
            <div className="backs">
              {Array.from({ length: v.players.length }, (_, i) => <Card key={i} id={null} className={i < v.played ? "in" : "waiting"} />)}
            </div>
          </div>
        )}
        {(v.phase === "discussing" || v.phase === "voting") && (
          <>
            <Clue text={v.clue} by={teller} small />
            <Table cards={v.table} />
            <p className="lede">
              {v.phase === "discussing" ? `Talk it over. Which one is ${teller?.name}'s? Voting opens when the clock runs out.` : `Vote on your phone. ${teller?.name}, keep a straight face.`}
            </p>
          </>
        )}
        {v.phase === "reveal" && v.last && <Reveal last={v.last} byId={byId} />}
        {v.phase === "over" && <Final players={v.players} party={v.party} />}
      </section>

      <footer className="rv-players">
        {v.players.map((p) => {
          const delta = v.phase === "reveal" ? v.last?.deltas[p.id] : null
          return (
            <div key={p.id} className={`seat${p.id === v.tellerId && v.phase !== "lobby" ? " teller" : ""}${p.done ? " done" : ""}${p.connected ? "" : " gone"}`}>
              <Avatar i={p.avatar} size={44} dim={!p.connected} />
              <span className="seat-name">{p.name}</span>
              <span className="seat-score">{p.score}</span>
              {delta > 0 && <span className="delta">+{delta}</span>}
              {p.done && <span className="tick" aria-label="ready">✓</span>}
            </div>
          )
        })}
      </footer>

      {host && v.phase !== "lobby" && v.phase !== "over" && (
        <nav className="host-bar" aria-label="Host controls">
          {v.paused ? <button className="btn" onClick={() => act("resume")}>Resume</button> : <button className="btn" onClick={() => act("pause")}>❚❚ Pause</button>}
          <button className="btn" onClick={() => act("advance")}>{v.phase === "telling" ? "Skip storyteller" : "Next"}</button>
          <button className="btn ghost" onClick={() => confirm("End the game now? Scores so far count.") && act("end")}>End</button>
        </nav>
      )}
      {error && <p className="toast" role="alert" onAnimationEnd={() => setError("")}>{error}</p>}
    </main>
  )
}

function Timer({ secs, paused }) {
  return <span className={`timer${secs <= 5 && !paused ? " hurry" : ""}${paused ? " paused" : ""}`} role="timer">{paused ? "paused" : `${secs}s`}</span>
}

function Clue({ text, by, small }) {
  return (
    <figure className={`clue${small ? " small" : ""}`}>
      <blockquote>“{text}”</blockquote>
      {by && <figcaption><Avatar i={by.avatar} size={28} /> {by.name}</figcaption>}
    </figure>
  )
}

function Table({ cards }) {
  return (
    <div className={`table${cards.length > 6 ? " two-rows" : ""}`} style={{ "--n": cards.length }}>
      {cards.map((c, i) => (
        <Card key={c} id={c} className="deal" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="num">{i + 1}</span>
        </Card>
      ))}
    </div>
  )
}

function Reveal({ last, byId }) {
  const teller = byId[last.tellerId]
  const info = Object.fromEntries(last.cards.map((c) => [c.card, c]))
  const headline = {
    all: `Everyone found it. Too plain: ${teller?.name} scores nothing, everyone else 2.`,
    none: `Nobody found it. Too obscure: ${teller?.name} scores nothing, everyone else 2.`,
    some: `Some found it. ${teller?.name} and each correct guess score 3.`,
  }[last.outcome]
  return (
    <>
      <Clue text={last.clue} by={teller} small />
      <div className={`table reveal${last.cards.length > 6 ? " two-rows" : ""}`} style={{ "--n": last.cards.length }}>
        {last.cards.map((c, i) => {
          const owner = byId[c.owner]
          return (
            <Card key={c.card} id={c.card} className={c.card === last.tellerCard ? "storyteller" : "decoy"} style={{ animationDelay: `${i * 120}ms` }}>
              <span className="num">{i + 1}</span>
              <span className="owner">{owner && <Avatar i={owner.avatar} size={30} />}{owner?.name}{c.card === last.tellerCard && " ✦"}</span>
              <span className="voters">{info[c.card].voters.map((id) => byId[id] && <Avatar key={id} i={byId[id].avatar} size={26} />)}</span>
            </Card>
          )
        })}
      </div>
      <p className="lede">{headline} Plus 1 for every vote your card drew.</p>
    </>
  )
}

function Final({ players, party }) {
  const ranked = [...players].sort((a, b) => b.score - a.score)
  return (
    <div className="moment final">
      <p className="eyebrow">The dream is over</p>
      <h2 className="display">{ranked[0]?.name} tells the best stories</h2>
      <ol className="ranks">
        {ranked.map((p, i) => (
          <li key={p.id} className={i === 0 ? "lead" : ""}>
            <span className="rank">{i + 1}</span>
            <Avatar i={p.avatar} size={40} />
            <span className="name">{p.name}</span>
            <span className="pts">{p.score}</span>
          </li>
        ))}
      </ol>
      <div className="row">
        {party ? <a className="btn primary big" href={`/tv?code=${party}`}>Back to the party</a> : <a className="btn primary big" href="/reverie">Play again</a>}
      </div>
    </div>
  )
}

function Lobby({ v, joinUrl, origin, act, host }) {
  const c = v.config
  const set = (k, val) => act("config", { config: { [k]: val } })
  const connected = v.players.filter((p) => p.connected).length
  const num = (k, label, opts) => (
    <label>
      {label}
      <select value={c[k]} onChange={(e) => set(k, Number(e.target.value))} disabled={!host}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
  return (
    <div className="lobby">
      <div className="panel join-panel">
        <Qr url={origin && joinUrl} size={210} />
        <div>
          <p className="eyebrow">Scan to join, or go to</p>
          <p className="hint">{joinUrl.replace(/^https?:\/\//, "")}</p>
          <p className="big-code">{v.code}</p>
          <p className="hint">{connected} of {c.maxPlayers} seats taken</p>
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
          {num("maxPlayers", "Seats", [6, 7, 8, 9, 10, 11, 12])}
          {num("rounds", "Rounds", [3, 4, 5, 6, 8, 10, 12])}
          {num("submitSecs", "Card choice (s)", [20, 30, 45, 60])}
          {num("discussSecs", "Discussion (s)", [0, 30, 60, 90, 120])}
          {num("voteSecs", "Voting (s)", [30, 45, 60, 90])}
          <label className="check">
            <input type="checkbox" checked={c.customClues} onChange={(e) => set("customClues", e.target.checked)} />
            Storyteller writes their own clue
          </label>
          <button className="btn primary big" disabled={connected < v.minPlayers} onClick={() => act("start")}>
            {connected < v.minPlayers ? `Waiting for ${v.minPlayers - connected} more` : `Start with ${connected} players`}
          </button>
        </div>
      )}
    </div>
  )
}
