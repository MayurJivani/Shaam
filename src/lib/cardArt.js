/**
 * Reverie's deck, drawn in code. Each card id maps to one scene: a palette, a
 * sky, a ground, one dreamlike centrepiece and a scatter of small things. The
 * same id always draws the same picture, so the server only ever sends numbers
 * and a card means the same thing on every screen.
 *
 * 24 centrepieces x 10 palettes = 240 cards (DECK_SIZE in server/games/reverie.js),
 * with sky, ground and accents varied by a seeded generator on top.
 */
export const DECK_SIZE = 240

const PALETTES = [
  // top, bottom, far, near, accent, glow, ink
  ["#1b1640", "#e07a8b", "#5b3a73", "#2a1b45", "#ffd27a", "#fff1c9", "#140f2b"], // rose dusk
  ["#06283d", "#47b5a7", "#1d5c63", "#0b3140", "#f6e3a1", "#e9fff7", "#04161f"], // teal night
  ["#3a1f0e", "#f2a541", "#b8642a", "#6e3416", "#fff3b0", "#fff8e0", "#22110a"], // saffron
  ["#2b2d5c", "#c9b6e4", "#7c6aa8", "#3f3a72", "#ffd9ec", "#ffffff", "#1a1838"], // lilac fog
  ["#021024", "#1f6f8b", "#0f3d5c", "#062236", "#9ef0d8", "#e0fffb", "#010913"], // deep sea
  ["#10331f", "#9ad1a4", "#4f8a63", "#1f4f34", "#ffd6a5", "#fffbe8", "#0a2014"], // mint dawn
  ["#1a0508", "#c2262e", "#6a1018", "#300810", "#ffcf5c", "#ffe9c2", "#0d0204"], // eclipse
  ["#24160a", "#d9b77e", "#9a7546", "#5a3f22", "#6fa3c4", "#fff3da", "#160d05"], // ochre
  ["#0b0b2e", "#3d3dbf", "#22227a", "#121247", "#ff9b71", "#ffe2d1", "#05051a"], // indigo
  ["#4a1d33", "#ffc2a1", "#d27c7c", "#7a3450", "#fff0b3", "#fffaf0", "#2a0f1d"], // peach
].map(([top, bot, far, near, acc, glow, ink]) => ({ top, bot, far, near, acc, glow, ink }))

const G = 205 // horizon

function rng(seed) {
  let a = seed * 2654435761 + 1013904223
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n) => Math.round(n * 10) / 10

/** A small standing person, feet at (x, y). */
const person = (x, y, s, c) =>
  `<g fill="${c}"><circle cx="${x}" cy="${f(y - 15 * s)}" r="${f(2.6 * s)}"/><path d="M${f(x - 3 * s)} ${y}L${f(x - 2.6 * s)} ${f(y - 12 * s)}Q${x} ${f(y - 13.5 * s)} ${f(x + 2.6 * s)} ${f(y - 12 * s)}L${f(x + 3 * s)} ${y}Z"/></g>`

// ---- skies ----------------------------------------------------------------

const SKIES = [
  (r, p) => {
    const x = 40 + r() * 120, y = 45 + r() * 40, s = 14 + r() * 10
    // The bite is a disc of sky laid over the moon; the gradient is in user space, so it matches.
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 2.2)}" fill="${p.glow}" opacity=".12"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="${p.glow}"/><circle cx="${f(x + s * 0.45)}" cy="${f(y - s * 0.3)}" r="${f(s * 0.9)}" fill="url(#sky)"/>`
  },
  (r, p) => {
    const x = 50 + r() * 100, y = 60 + r() * 30
    return `<circle cx="${f(x)}" cy="${f(y)}" r="20" fill="${p.acc}" opacity=".9"/>${[30, 40, 52].map((rad) => `<circle cx="${f(x)}" cy="${f(y)}" r="${rad}" fill="none" stroke="${p.acc}" stroke-width=".8" opacity=".35"/>`).join("")}`
  },
  (r, p) => {
    const x = 50 + r() * 100, y = 55 + r() * 30
    return `<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="${p.far}"/><circle cx="${f(x - 5)}" cy="${f(y - 5)}" r="16" fill="${p.acc}" opacity=".35"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="32" ry="6" fill="none" stroke="${p.glow}" stroke-width="1.6" opacity=".7" transform="rotate(-18 ${f(x)} ${f(y)})"/>`
  },
  (r, p) => {
    const y = 55 + r() * 25
    return `<path d="M60 ${f(y)}Q100 ${f(y - 26)} 140 ${f(y)}Q100 ${f(y + 26)} 60 ${f(y)}Z" fill="${p.glow}" opacity=".85"/><circle cx="100" cy="${f(y)}" r="11" fill="${p.acc}"/><circle cx="100" cy="${f(y)}" r="5" fill="${p.ink}"/><circle cx="103" cy="${f(y - 3)}" r="2" fill="${p.glow}"/>`
  },
  (r, p) => {
    const a = 40 + r() * 40, b = 120 + r() * 40
    return `<circle cx="${f(a)}" cy="60" r="12" fill="${p.glow}" opacity=".9"/><circle cx="${f(b)}" cy="${f(40 + r() * 30)}" r="7" fill="${p.acc}" opacity=".9"/>`
  },
  (r, p) => {
    const x = 60 + r() * 80, y = 70
    let d = `M${x} ${y}`
    for (let t = 0; t < 22; t += 0.4) d += `L${f(x + Math.cos(t) * t * 2.1)} ${f(y + Math.sin(t) * t * 1.6)}`
    return `<path d="${d}" fill="none" stroke="${p.glow}" stroke-width="1.2" opacity=".55"/>`
  },
]

// ---- grounds --------------------------------------------------------------

const GROUNDS = [
  (r, p) =>
    `<rect y="${G}" width="200" height="${300 - G}" fill="${p.near}"/>` +
    Array.from({ length: 9 }, (_, i) => {
      const y = G + 6 + i * i * 1.3, x = r() * 160
      return `<path d="M${f(x)} ${f(y)}q6 -3 12 0t12 0" fill="none" stroke="${p.glow}" stroke-width=".8" opacity=".3"/>`
    }).join(""),
  (r, p) =>
    `<path d="M0 ${G + 10}Q50 ${G - 18} 110 ${G + 4}T200 ${G - 4}V300H0Z" fill="${p.far}"/><path d="M0 ${G + 36}Q70 ${G + 8} 130 ${G + 30}T200 ${G + 24}V300H0Z" fill="${p.near}"/>`,
  (r, p) => {
    let s = `<rect y="${G}" width="200" height="${300 - G}" fill="${p.near}"/>`
    for (let i = -10; i <= 10; i++) s += `<line x1="100" y1="${G}" x2="${100 + i * 28}" y2="300" stroke="${p.glow}" stroke-width=".6" opacity=".25"/>`
    for (let i = 1; i < 8; i++) s += `<line x1="0" x2="200" y1="${f(G + i * i * 1.6)}" y2="${f(G + i * i * 1.6)}" stroke="${p.glow}" stroke-width=".6" opacity=".25"/>`
    return s
  },
  (r, p) => {
    let s = `<rect y="${G + 14}" width="200" height="${300 - G}" fill="${p.glow}" opacity=".85"/>`
    for (let i = 0; i < 9; i++) s += `<circle cx="${f(i * 25 + r() * 10)}" cy="${f(G + 14 + r() * 6)}" r="${f(14 + r() * 10)}" fill="${p.glow}" opacity=".85"/>`
    return s + `<rect y="${G + 30}" width="200" height="80" fill="${p.bot}" opacity=".25"/>`
  },
  (r, p) => `<path d="M0 ${G}C40 ${G - 30} 70 ${G - 30} 100 ${G}S160 ${G - 22} 200 ${G - 6}V300H0Z" fill="${p.near}"/><circle cx="${f(30 + r() * 140)}" cy="${G - 4}" r="3" fill="${p.acc}"/>`,
  (r, p) => `<ellipse cx="100" cy="${G + 40}" rx="70" ry="9" fill="${p.ink}" opacity=".35"/>`, // void, a shadow on nothing
]

// ---- centrepieces ---------------------------------------------------------

const MOTIFS = [
  // floating island with a tree and a waterfall into nowhere
  (r, p) => `<g transform="translate(0 ${f(-20 + r() * 20)})"><path d="M48 140Q100 128 152 140L122 172Q104 206 92 176Z" fill="${p.ink}"/><path d="M60 158l-3 22M140 156l4 18M100 190l1 16" stroke="${p.ink}" stroke-width="1.4"/><ellipse cx="100" cy="140" rx="52" ry="8" fill="${p.far}"/><rect x="96" y="104" width="7" height="36" fill="${p.ink}"/><circle cx="100" cy="96" r="22" fill="${p.near}"/><circle cx="88" cy="104" r="14" fill="${p.near}"/><circle cx="114" cy="102" r="15" fill="${p.near}"/><circle cx="92" cy="92" r="2.5" fill="${p.acc}"/><circle cx="110" cy="98" r="2.5" fill="${p.acc}"/><rect x="138" y="141" width="3" height="80" fill="${p.glow}" opacity=".55"/>${person(70, 140, 0.8, p.ink)}</g>`,
  // a door standing alone, open onto light
  (r, p) => `<path d="M86 ${G + 2}L60 300H160L118 ${G + 2}Z" fill="${p.glow}" opacity=".25"/><rect x="80" y="120" width="40" height="${G - 118}" fill="${p.ink}"/><rect x="85" y="125" width="30" height="${G - 125}" fill="${p.glow}"/><path d="M115 125L134 118V${G + 6}L115 ${G}Z" fill="${p.far}"/><circle cx="129" cy="165" r="1.6" fill="${p.acc}"/>${person(100, G, 1, p.ink)}`,
  // a staircase that climbs into a cloud
  (r, p) => {
    let d = `M40 ${G}`
    for (let i = 0; i < 9; i++) d += `v-${12}h${11}`
    return `<path d="${d}V${G}Z" fill="${p.ink}" opacity=".9"/><circle cx="140" cy="88" r="16" fill="${p.glow}"/><circle cx="158" cy="94" r="12" fill="${p.glow}"/><circle cx="124" cy="96" r="11" fill="${p.glow}"/>${person(84, G - 48, 0.8, p.acc)}`
  },
  // a whale swimming through the sky with a house on its back
  (r, p) => `<g transform="translate(0 ${f(r() * 20)})"><path d="M30 130Q60 92 120 104Q150 110 160 122L182 108L176 132L186 150L160 138Q130 160 80 156Q40 150 30 130Z" fill="${p.far}"/><path d="M40 138Q90 160 150 136" fill="none" stroke="${p.glow}" stroke-width="1" opacity=".5"/><circle cx="50" cy="128" r="2" fill="${p.ink}"/><rect x="86" y="88" width="20" height="16" fill="${p.ink}"/><path d="M83 89L96 78L109 89Z" fill="${p.ink}"/><rect x="93" y="93" width="5" height="5" fill="${p.acc}"/></g>`,
  // a lighthouse throwing its beam across the sky
  (r, p) => `<path d="M104 110L200 76V132Z" fill="${p.glow}" opacity=".3"/><path d="M90 ${G}L95 116H107L112 ${G}Z" fill="${p.glow}"/><path d="M92 170h18v12h-18zM94 140h14v10h-14z" fill="${p.acc}"/><rect x="93" y="104" width="16" height="12" fill="${p.acc}"/><path d="M90 104L101 92L112 104Z" fill="${p.ink}"/>`,
  // a hot-air balloon made of a sleeping moon
  (r, p) => `<g transform="translate(${f(-20 + r() * 40)} 0)"><circle cx="100" cy="100" r="36" fill="${p.acc}"/><path d="M100 64A36 36 0 0 1 100 136A26 36 0 0 0 100 64Z" fill="${p.ink}" opacity=".25"/><path d="M84 104q5 4 10 0M106 104q5 4 10 0" stroke="${p.ink}" stroke-width="1.4" fill="none"/><path d="M78 128L92 158M122 128L108 158" stroke="${p.ink}" stroke-width=".8"/><rect x="90" y="158" width="20" height="13" fill="${p.ink}"/>${person(100, 160, 0.55, p.glow)}</g>`,
  // a figure under an umbrella while fish rain down
  (r, p) => `${Array.from({ length: 14 }, () => { const x = r() * 200, y = 30 + r() * 130; return `<path d="M${f(x)} ${f(y)}q5 -3 10 0q-5 3 -10 0l-3 -3v6z" fill="${p.acc}" opacity=".8" transform="rotate(70 ${f(x)} ${f(y)})"/>` }).join("")}<path d="M74 162Q100 132 126 162Z" fill="${p.ink}"/><path d="M100 162V188" stroke="${p.ink}" stroke-width="1.2"/>${person(100, G, 1.4, p.ink)}`,
  // a clock melting over the branch of a dead tree
  (r, p) => `<path d="M40 ${G}L46 140L80 120M46 150L20 130" stroke="${p.ink}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M60 112Q90 98 118 114Q122 140 108 168Q104 182 100 168Q96 150 78 146Q62 140 60 112Z" fill="${p.glow}"/><path d="M90 124V132L98 138" stroke="${p.ink}" stroke-width="1.6" fill="none"/><circle cx="90" cy="130" r="18" fill="none" stroke="${p.ink}" stroke-width=".8" opacity=".5"/>`,
  // a teacup holding a sea and a little sailboat
  (r, p) => `<path d="M48 140H152Q150 196 100 200Q50 196 48 140Z" fill="${p.glow}"/><path d="M152 150q22 2 18 22q-4 14 -22 12" fill="none" stroke="${p.glow}" stroke-width="6"/><ellipse cx="100" cy="140" rx="52" ry="8" fill="${p.far}"/><path d="M60 140q10 -4 20 0t20 0t20 0t20 0" stroke="${p.acc}" fill="none" stroke-width="1"/><path d="M98 138V112L116 134Z" fill="${p.acc}"/><path d="M88 138h22l-4 4h-14z" fill="${p.ink}"/><path d="M80 120q-6 -12 0 -24M120 110q6 -12 0 -22" stroke="${p.glow}" fill="none" opacity=".5"/><ellipse cx="100" cy="${G}" rx="70" ry="6" fill="${p.ink}" opacity=".35"/>`,
  // a keyhole in a hill, with a day on the other side
  (r, p) => `<path d="M20 ${G}Q100 90 180 ${G}Z" fill="${p.ink}"/><circle cx="100" cy="150" r="14" fill="${p.acc}"/><path d="M92 156L86 ${G}H114L108 156Z" fill="${p.acc}"/><circle cx="100" cy="150" r="30" fill="${p.acc}" opacity=".12"/>${person(100, G + 10, 0.9, p.ink)}`,
  // a house on stilts far too tall
  (r, p) => `<path d="M88 ${G}L92 110M112 ${G}L108 110M96 ${G}L100 110M104 ${G}L100 110" stroke="${p.ink}" stroke-width="1.4"/><rect x="82" y="86" width="36" height="26" fill="${p.ink}"/><path d="M78 88L100 68L122 88Z" fill="${p.far}"/><rect x="95" y="94" width="9" height="9" fill="${p.acc}"/><path d="M114 70V58h5v16" fill="${p.ink}"/><circle cx="122" cy="52" r="3" fill="${p.glow}" opacity=".5"/><circle cx="128" cy="44" r="4" fill="${p.glow}" opacity=".35"/>`,
  // a tall figure in a coat with the head of a bird
  (r, p) => `<path d="M84 ${G}L88 130Q100 120 112 130L116 ${G}Z" fill="${p.ink}"/><circle cx="100" cy="112" r="13" fill="${p.ink}"/><path d="M110 108L146 118L110 118Z" fill="${p.acc}"/><circle cx="104" cy="108" r="2.6" fill="${p.glow}"/><path d="M88 150Q70 160 72 176" stroke="${p.ink}" stroke-width="4" fill="none"/><circle cx="72" cy="180" r="5" fill="${p.glow}"/>`,
  // jellyfish drifting like lanterns
  (r, p) => Array.from({ length: 3 }, (_, i) => {
    const x = 50 + i * 50 + r() * 10, y = 80 + r() * 70, s = 0.8 + r() * 0.5
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><circle r="24" fill="${p.acc}" opacity=".12"/><path d="M-14 0A14 14 0 0 1 14 0Q7 4 0 0Q-7 4 -14 0Z" fill="${p.acc}"/>${[-9, -3, 3, 9].map((t) => `<path d="M${t} 2q4 10 0 20t0 18" stroke="${p.glow}" stroke-width=".8" fill="none" opacity=".7"/>`).join("")}</g>`
  }).join(""),
  // a tower of books reaching the clouds
  (r, p) => {
    let s = "", y = G
    for (let i = 0; i < 14; i++) {
      const w = 40 + r() * 24, h = 6 + r() * 5, x = 100 - w / 2 + (r() - 0.5) * 8
      y -= h
      s += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${[p.acc, p.far, p.glow, p.ink][i % 4]}"/>`
    }
    return s + person(100, y, 0.8, p.ink)
  },
  // a ladder leaning on the moon
  (r, p) => `<circle cx="140" cy="62" r="24" fill="${p.glow}"/><circle cx="130" cy="56" r="4" fill="${p.ink}" opacity=".15"/><path d="M70 ${G}L130 80M86 ${G}L146 84" stroke="${p.ink}" stroke-width="2"/>${Array.from({ length: 11 }, (_, i) => { const t = (i + 0.5) / 11; return `<line x1="${f(70 + 60 * t)}" y1="${f(G - (G - 80) * t)}" x2="${f(86 + 60 * t)}" y2="${f(G - (G - 84) * t)}" stroke="${p.ink}" stroke-width="1.6"/>` }).join("")}${person(110, 128, 0.7, p.ink)}`,
  // a bare tree whose fruit are lightbulbs
  (r, p) => `<path d="M100 ${G}V140M100 150L70 112M100 140L132 104M84 130L70 136M118 120L140 126M100 160L124 146" stroke="${p.ink}" stroke-width="4" stroke-linecap="round" fill="none"/>${[[70, 112], [132, 104], [70, 136], [140, 126], [124, 146], [100, 128]].map(([x, y]) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 8}" stroke="${p.ink}"/><circle cx="${x}" cy="${y + 13}" r="12" fill="${p.acc}" opacity=".16"/><circle cx="${x}" cy="${y + 13}" r="5" fill="${p.acc}"/>`).join("")}`,
  // a person whose head is a fishbowl
  (r, p) => `<path d="M78 ${G}L82 150Q100 138 118 150L122 ${G}Z" fill="${p.ink}"/><circle cx="100" cy="118" r="24" fill="${p.glow}" opacity=".5"/><path d="M76 118a24 24 0 0 0 48 0z" fill="${p.far}" opacity=".7"/><path d="M92 122q6 -6 12 0q-6 6 -12 0l-5 -4v8z" fill="${p.acc}"/><circle cx="108" cy="104" r="2" fill="none" stroke="${p.glow}"/><circle cx="112" cy="96" r="1.4" fill="none" stroke="${p.glow}"/>`,
  // a giant hand rising from water, holding a star
  (r, p) => `<path d="M78 ${G + 6}L82 150Q78 140 74 128Q72 120 80 122L86 136V100Q86 92 92 92Q96 92 96 100V90Q96 82 102 82Q108 82 108 90V96Q108 90 114 90Q120 92 120 100V108Q122 102 128 104Q132 106 130 114L122 150L124 ${G + 6}Z" fill="${p.far}"/><path d="M104 54l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z" fill="${p.acc}"/><circle cx="104" cy="68" r="22" fill="${p.acc}" opacity=".15"/>`,
  // a birdcage hanging from nothing, a cloud inside
  (r, p) => `<line x1="100" y1="0" x2="100" y2="70" stroke="${p.ink}"/><path d="M70 160V110Q70 74 100 72Q130 74 130 110V160Z" fill="none" stroke="${p.ink}" stroke-width="1.6"/>${[80, 90, 100, 110, 120].map((x) => `<path d="M${x} 160V${x === 100 ? 72 : 84}" stroke="${p.ink}" stroke-width=".8"/>`).join("")}<rect x="66" y="158" width="68" height="5" fill="${p.ink}"/><circle cx="92" cy="128" r="11" fill="${p.glow}"/><circle cx="106" cy="124" r="13" fill="${p.glow}"/><circle cx="114" cy="134" r="8" fill="${p.glow}"/><path d="M96 142l-3 8M106 142l-3 8M114 142l-3 8" stroke="${p.acc}" stroke-width="1"/>`,
  // a snail carrying a castle
  (r, p) => `<path d="M40 ${G}Q30 ${G - 12} 44 ${G - 14}L50 ${G - 30}M46 ${G - 14}L40 ${G - 30}" stroke="${p.far}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M38 ${G}H160Q164 ${G - 8} 150 ${G - 8}H50Z" fill="${p.far}"/><circle cx="110" cy="${G - 34}" r="30" fill="${p.acc}"/><path d="M110 ${G - 34}m-20 0a20 20 0 1 1 20 20a12 12 0 1 1 -10 -16" fill="none" stroke="${p.ink}" stroke-width="1.4" opacity=".6"/><path d="M92 ${G - 60}V${G - 96}h6v-6h4v6h6v-6h4v6h6V${G - 60}Z" fill="${p.ink}"/><path d="M104 ${G - 106}L110 ${G - 120}L116 ${G - 106}Z" fill="${p.ink}"/><rect x="108" y="${G - 86}" width="4" height="7" fill="${p.glow}"/>`,
  // a paper boat as big as a house, sailing a cloud sea
  (r, p) => `<path d="M30 160H170L148 190H52Z" fill="${p.glow}"/><path d="M60 160L100 96L140 160Z" fill="${p.glow}" opacity=".85"/><path d="M100 96V160" stroke="${p.ink}" stroke-width=".6" opacity=".4"/><path d="M30 160L52 190" stroke="${p.ink}" stroke-width=".6" opacity=".3"/>${person(124, 160, 0.7, p.ink)}<path d="M100 96l18 -6v10z" fill="${p.acc}"/>`,
  // an hourglass holding a desert under a moon
  (r, p) => `<rect x="60" y="80" width="80" height="6" fill="${p.ink}"/><rect x="60" y="${G - 6}" width="80" height="6" fill="${p.ink}"/><path d="M66 86Q66 128 98 142Q66 156 66 ${G - 6}H134Q134 156 102 142Q134 128 134 86Z" fill="${p.glow}" opacity=".3" stroke="${p.glow}"/><path d="M72 ${G - 6}Q100 160 128 ${G - 6}Z" fill="${p.acc}"/><circle cx="110" cy="104" r="7" fill="${p.glow}"/><path d="M99 142V${G - 30}" stroke="${p.acc}" stroke-dasharray="2 3"/>`,
  // a mountain with a sleeping face
  (r, p) => `<path d="M10 ${G}L84 92Q100 80 116 92L190 ${G}Z" fill="${p.far}"/><path d="M84 92L96 110L104 100L116 92Q100 80 84 92Z" fill="${p.glow}" opacity=".8"/><path d="M80 140q8 6 16 0M106 140q8 6 16 0" stroke="${p.ink}" stroke-width="2" fill="none"/><path d="M100 150v12q-4 2 -6 0" stroke="${p.ink}" stroke-width="1.4" fill="none"/><path d="M92 174q8 3 16 0" stroke="${p.ink}" stroke-width="1.6" fill="none"/><text x="130" y="122" font-size="12" fill="${p.glow}" opacity=".7" font-family="serif">z</text><text x="140" y="108" font-size="9" fill="${p.glow}" opacity=".5" font-family="serif">z</text>`,
  // a chess knight the size of a cathedral, and someone at its foot
  (r, p) => `<path d="M64 ${G}H136L130 ${G - 14}H70ZM76 ${G - 14}Q78 150 96 138Q74 130 74 112L104 74Q118 70 124 84Q136 104 128 ${G - 14}Z" fill="${p.ink}"/><circle cx="106" cy="92" r="3" fill="${p.acc}"/><path d="M104 74l-2 -10 8 8" fill="${p.ink}"/>${person(46, G, 0.8, p.ink)}<rect x="88" y="150" width="6" height="14" fill="${p.acc}" opacity=".9"/>`,
]

// ---- small things ---------------------------------------------------------

const ACCENTS = [
  (r, p) => Array.from({ length: 5 }, () => { const x = r() * 180 + 10, y = 30 + r() * 80; return `<path d="M${f(x)} ${f(y)}q4 -4 7 0q3 -4 7 0" stroke="${p.ink}" stroke-width="1" fill="none"/>` }).join(""),
  (r, p) => Array.from({ length: 4 }, () => { const x = r() * 180 + 10, y = 40 + r() * 120, s = 3 + r() * 6; return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * 0.6)}" fill="${p.ink}"/><ellipse cx="${f(x)}" cy="${f(y - s * 0.3)}" rx="${f(s * 0.8)}" ry="${f(s * 0.25)}" fill="${p.far}"/>` }).join(""),
  (r, p) => Array.from({ length: 9 }, () => `<circle cx="${f(r() * 200)}" cy="${f(20 + r() * 180)}" r="${f(1.5 + r() * 5)}" fill="none" stroke="${p.glow}" stroke-width=".7" opacity=".6"/>`).join(""),
  (r, p) => Array.from({ length: 10 }, () => { const x = r() * 200, y = r() * 220; return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="3" ry="1.4" fill="${p.acc}" opacity=".7" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>` }).join(""),
  () => "",
]

const cache = new Map()

/** The scene for one card, as an SVG document string (2:3, 200x300). */
export function cardSvg(id) {
  const n = ((Number(id) % DECK_SIZE) + DECK_SIZE) % DECK_SIZE
  const r = rng(n + 7)
  const p = PALETTES[Math.floor(n / MOTIFS.length) % PALETTES.length]
  const sky = SKIES[Math.floor(r() * SKIES.length)](r, p)
  const ground = GROUNDS[Math.floor(r() * GROUNDS.length)](r, p)
  const motif = MOTIFS[n % MOTIFS.length](r, p)
  const accent = ACCENTS[Math.floor(r() * ACCENTS.length)](r, p)
  const stars = Array.from({ length: 10 + Math.floor(r() * 30) }, () => `<circle cx="${f(r() * 200)}" cy="${f(r() * 150)}" r="${f(0.3 + r() * 0.9)}" fill="${p.glow}" opacity="${f(0.3 + r() * 0.6)}"/>`).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><defs><linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="225"><stop offset="0" stop-color="${p.top}"/><stop offset="1" stop-color="${p.bot}"/></linearGradient><radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="${p.ink}" stop-opacity="0"/><stop offset="1" stop-color="${p.ink}" stop-opacity=".7"/></radialGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="200" height="300" fill="url(#sky)"/>${stars}${sky}${ground}${accent}${motif}<rect width="200" height="300" fill="url(#vig)"/><rect width="200" height="300" filter="url(#grain)" opacity=".09"/></svg>`
}

// shortcut: one pack per page, set from the room view; pass the pack per card if a screen ever mixes packs.
let pack = "dream"
export const usePack = (slug) => void (pack = slug || "dream")

/** The card's <img> source: a photo from a picture pack, or the drawn scene, cached since it is drawn many times. */
export function cardSrc(id) {
  if (pack !== "dream") return `/packs/${pack}/${id}.jpg`
  let src = cache.get(id)
  if (!src) cache.set(id, (src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg(id))}`))
  return src
}
