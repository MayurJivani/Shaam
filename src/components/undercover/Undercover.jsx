import { useState } from "react"
import { store } from "../../lib/relay.js"
import * as U from "../../../shared/undercover.js"

const WINNER = { civilian: "The Civilians win", undercover: "The impostors win", mrwhite: "Mr White guessed it" }
const HOW = "Everyone gets a secret word, passed round on this phone. Most share it, the Undercovers got a close cousin, Mr White got nothing. Take turns saying one clue out loud, then agree who to vote out. Civilians win by clearing every impostor; impostors win once one Civilian is left. A caught Mr White can still win by guessing the word."

/**
 * The whole game on one phone, passed round the room. The game is saved to
 * localStorage after every step, so a reload or a locked screen loses nothing.
 */
export default function Undercover() {
  const [g, setG] = useState(() => store.get("shaam.uc.game"))
  const [setup, setSetup] = useState(() => store.get("shaam.uc.setup") ?? { names: [], undercovers: 1, mrWhites: 1 })
  const save = (next) => {
    store.set("shaam.uc.game", next)
    setG(next)
  }
  /** Apply a rule to a copy, so React sees a new object and the saved game matches the screen. */
  const step = (fn, ...args) => {
    const next = structuredClone(g)
    const err = fn(next, ...args)
    if (!err) save(next)
    return err
  }
  const start = (s) => {
    store.set("shaam.uc.setup", s)
    setSetup(s)
    save(U.deal(s.names, s))
  }

  return (
    <main className="phone uc">
      <h1 className="brand small">Undercover</h1>
      {!g ? <Setup setup={setup} onStart={start} /> : <Game g={g} step={step} again={() => start(setup)} quit={() => save(null)} />}
    </main>
  )
}

function Setup({ setup, onStart }) {
  const [names, setNames] = useState(setup.names)
  const [name, setName] = useState("")
  const [undercovers, setUc] = useState(setup.undercovers)
  const [mrWhites, setMw] = useState(setup.mrWhites)
  const error = U.setupError(names, { undercovers, mrWhites })
  const add = (e) => {
    e.preventDefault()
    const n = name.trim().slice(0, 18)
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase()) && names.length < U.MAX_PLAYERS) setNames([...names, n])
    setName("")
  }
  const count = (label, value, set, opts) => (
    <label>
      {label}
      <select value={value} onChange={(e) => set(Number(e.target.value))}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
  return (
    <>
      <section className="phone-card">
        <h2>Who's playing?</h2>
        <form className="guess" onSubmit={add}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={18} placeholder="Add a name" aria-label="Player name" autoComplete="off" />
          <button className="btn" disabled={!name.trim()}>Add player</button>
        </form>
        <ul className="uc-names">
          {names.map((n) => (
            <li key={n}>
              {n}
              <button className="btn ghost" onClick={() => setNames(names.filter((x) => x !== n))} aria-label={`Remove ${n}`}>✕</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="phone-card settings">
        {count("Undercovers", undercovers, setUc, [1, 2, 3, 4, 5, 6])}
        {count("Mr White", mrWhites, setMw, [0, 1, 2, 3])}
        <span className="hint">{Math.max(0, names.length - undercovers - mrWhites)} Civilians</span>
      </section>
      {error && <p className="hint center-text">{error}</p>}
      <button className="btn primary big" disabled={!!error} onClick={() => onStart({ names, undercovers, mrWhites })}>Deal the words</button>
      <p className="hint">{HOW}</p>
    </>
  )
}

function Game({ g, step, again, quit }) {
  const [peek, setPeek] = useState(false)
  const [pick, setPick] = useState(null)
  const [word, setWord] = useState("")
  const out = g.last != null ? g.players[g.last] : null

  if (g.phase === "pass") {
    const i = g.seen
    const p = g.players[i]
    const w = U.wordOf(g, i)
    return peek ? (
      <section className="phone-card big">
        <span className="hint">{p.name}, your word is</span>
        <span className="word">{w ?? "Mr White"}</span>
        <p>{w ? "Remember it. You might be a Civilian, you might not." : "You have no word. Listen, blend in, and work theirs out."}</p>
        <button className="btn primary big" onClick={() => { setPeek(false); step(U.seen) }}>Hide it and pass on</button>
      </section>
    ) : (
      <section className="phone-card big">
        <span className="hint">Player {i + 1} of {g.players.length}</span>
        <h2>Pass the phone to {p.name}</h2>
        <p>Nobody else look.</p>
        <button className="btn primary big" onClick={() => setPeek(true)}>I'm {p.name}: show my word</button>
      </section>
    )
  }

  if (g.phase === "over") {
    return (
      <>
        <section className="phone-card big">
          <h2>{WINNER[g.winner]}</h2>
          <p>Civilians had <b>{g.words.civilian}</b>, Undercovers had <b>{g.words.undercover}</b>.{g.guess && ` Mr White guessed "${g.guess}".`}</p>
        </section>
        <ol className="ranks">
          {[...g.players].sort((a, b) => b.score - a.score).map((p) => (
            <li key={p.name} className={p.score ? "lead" : ""}>
              <span className="rank">{p.score ? "★" : ""}</span>
              <span />
              <span className="name">{p.name}</span>
              <span className="meta">{U.ROLE[p.role]}</span>
              <span className="pts">{p.score}</span>
            </li>
          ))}
        </ol>
        <button className="btn primary big" onClick={again}>Play again, same players</button>
        <button className="btn big" onClick={quit}>Change players</button>
      </>
    )
  }

  if (g.phase === "guess") {
    return (
      <section className="phone-card big">
        <h2>{out.name} was Mr White!</h2>
        <p>Pass the phone to {out.name}. One guess at the Civilians' word: right, and they win alone.</p>
        <form className="guess" onSubmit={(e) => { e.preventDefault(); if (!step(U.guessWord, word)) setWord("") }}>
          <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={40} placeholder="The Civilians' word" aria-label="Mr White's guess" autoComplete="off" />
          <button className="btn primary big" disabled={!word.trim()}>Guess</button>
        </form>
      </section>
    )
  }

  return (
    <>
      {out && (
        <p className="phone-card">
          <b>{out.name}</b> is out. They were {out.role === "undercover" ? "an Undercover" : out.role === "mrwhite" ? `Mr White, and guessed "${g.guess}": wrong` : "a Civilian"}.
        </p>
      )}
      {g.phase === "describe" ? (
        <section className="phone-card">
          <h2>Round {g.round}: describe</h2>
          <p>One clue each, out loud, in this order.</p>
          <ol className="uc-order">
            {g.order.map((i) => <li key={i}>{g.players[i].name}</li>)}
          </ol>
          <button className="btn primary big" onClick={() => step(U.openVote)}>Everyone has spoken: vote</button>
        </section>
      ) : (
        <section className="phone-card">
          <h2>Who does the room vote out?</h2>
          <p>Talk it over, count hands, then tap them.</p>
          <div className="vote-list">
            {g.players.map((p, i) => p.alive && (
              <button key={p.name} className={`btn${pick === i ? " primary" : ""}`} aria-pressed={pick === i} onClick={() => setPick(i)}>{p.name}</button>
            ))}
          </div>
          <button className="btn primary big" disabled={pick == null} onClick={() => { step(U.eliminate, pick); setPick(null) }}>
            {pick == null ? "Pick a player" : `Vote out ${g.players[pick].name}`}
          </button>
        </section>
      )}
      <button className="btn ghost" onClick={() => confirm("End this game? Nobody scores.") && quit()}>End game</button>
    </>
  )
}
