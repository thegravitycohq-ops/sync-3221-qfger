// Hand-drawn scene engine. Pure function of (spec, frame): no randomness, no clock.
// Look: wobbling ink lines (SVG displacement, new seed 6x/second = "boil"), flat watercolour fills, grain.
import React from 'react';
export type Spec = {riverX?: number; smokeX?: number; sky?: string; land?: string; frame?: string; fx?: string[]; things?: any[]; cam?: string; seed?: string | number};
export const W = 1920, H = 1080;
const INK = '#3a2e28';
const ln = {stroke: INK, strokeWidth: 2.3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
const hash = (s: string) => { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; };
const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hex = (v: number[]) => '#' + v.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };

// sky: top, bottom, light colour (sun/moon), ambient multiplier applied to every earth colour
const SKY: Record<string, {t: string; b: string; sun: string; amb: number[]; night?: boolean}> = {
  dawn: {t: '#dcc3b4', b: '#f4e2c4', sun: '#f7dca4', amb: [1, 0.94, 0.9]},
  day: {t: '#cdd6c2', b: '#f1e8c6', sun: '#f6ecae', amb: [1, 1, 0.98]},
  dusk: {t: '#d3a08a', b: '#f1c78e', sun: '#f4c46a', amb: [1, 0.86, 0.74]},
  night: {t: '#1d2848', b: '#46507a', sun: '#ece9d2', amb: [0.42, 0.48, 0.74], night: true},
  overcast: {t: '#b4b8b1', b: '#dcd8c8', sun: '#e8e4d4', amb: [0.94, 0.95, 0.94]},
};
// land: far hill, mid hill, ground, water, trees, extras
const LAND: Record<string, any> = {
  valley: {far: '#a9b08e', mid: '#9ea46a', gnd: '#a3a458', water: 'river', trees: 'broad'},
  plain: {far: '#bdb48c', mid: '#b9a869', gnd: '#c2a85f', water: 'none', trees: 'few', grass: 1},
  coast: {far: '#a8b4a2', mid: '#c6b68a', gnd: '#d3bf90', water: 'sea', trees: 'palm'},
  forest: {far: '#8e9c78', mid: '#728152', gnd: '#6f7a45', water: 'none', trees: 'pine'},
  desert: {far: '#d2b48a', mid: '#cfa66e', gnd: '#d9b27a', water: 'none', trees: 'none', dunes: 1},
  mountains: {far: '#a7b0b8', mid: '#8d9a8a', gnd: '#8f9a6e', water: 'lake', trees: 'pine', peaks: 1},
  snow: {far: '#c8d0d6', mid: '#dfe3e4', gnd: '#eceeec', water: 'none', trees: 'pine'},
  village: {far: '#adb18f', mid: '#a2a86c', gnd: '#b1a95e', water: 'none', trees: 'broad'},
};

type Ctx = {pal: (typeof SKY)['day']; f: number; fps: number; r: () => number; land: any; night: boolean};
const tint = (c: string, x: Ctx) => hex(rgb(c).map((v, i) => v * x.pal.amb[i]));
const ridge = (r: () => number, y0: number, amp: number) => {
  const n = 4, ph = Array.from({length: n}, () => r() * 6.28), fr = Array.from({length: n}, (_, i) => (i + 1) * 0.8 + r() * 0.7);
  return (x: number) => y0 + ph.reduce((s, p, i) => s + (amp / (i + 1.3)) * Math.sin((x / W) * 6.28 * fr[i] * 0.9 + p), 0);
};
const ridgePath = (f: (x: number) => number, close = H + 40) => { let d = `M-80 ${close} L-80 ${f(-80).toFixed(1)}`; for (let x = -56; x <= W + 80; x += 24) d += ` L${x} ${f(x).toFixed(1)}`; return d + ` L${W + 80} ${close}Z`; };

// ---------- things (drawn at 0,0 = their feet; s = scale) ----------
const Flame = ({f, s = 1}: {f: number; s?: number}) => {
  const k = (a: number) => Math.sin(f * a);
  const h = 64 + 8 * k(0.37) + 5 * k(0.91), w = 20 + 3 * k(0.53);
  const fl = (hh: number, ww: number, c: string) => <path d={`M0 0 C${-ww} ${-hh * 0.3} ${-ww * 0.5} ${-hh * 0.7} ${3 * k(0.7)} ${-hh} C${ww * 0.5} ${-hh * 0.7} ${ww} ${-hh * 0.3} 0 0Z`} fill={c} />;
  return <g transform={`scale(${s})`}>{fl(h, w, '#e9822b')}{fl(h * 0.7, w * 0.66, '#f6b83d')}{fl(h * 0.4, w * 0.36, '#fbe58a')}</g>;
};
const Campfire = ({x, y, s, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="6" rx="120" ry="30" fill="#f6b04a" opacity={0.22 + 0.05 * Math.sin(c.f * 0.4)} style={{mixBlendMode: 'screen'}} />
    <ellipse cx="0" cy="4" rx="44" ry="11" fill="#6c6a62" {...ln} />
    {[-24, 0, 24].map((o, i) => <g key={i} transform={`rotate(${(i - 1) * 24} 0 0)`}><rect x="-34" y="-9" width="68" height="14" rx="7" fill={['#7a5638', '#6a4a30', '#85603f'][i]} {...ln} /><ellipse cx="34" cy="-2" rx="3.5" ry="6" fill="#b58a5e" stroke={INK} strokeWidth="1.6" /></g>)}
    <Flame f={c.f} s={1} />
  </g>
);
const Person = ({x, y, s = 1, c, seated, cloth, flip}: any) => {
  const r = rng(hash(`p${x}${y}`));
  const skin = ['#a8734f', '#8d5a3c', '#b98560', '#744732'][Math.floor(r() * 4)];
  const col = cloth ?? ['#b6763c', '#8a5a3a', '#9a6a46', '#6b7a4a', '#a14f3a', '#c8a36a'][Math.floor(r() * 6)];
  const sway = Math.sin(c.f / 40 + x) * 0.8;
  return (
    <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * s} ${s})`}>
      <ellipse cx="0" cy="2" rx={seated ? 30 : 20} ry="6" fill="#000" opacity="0.14" />
      {seated ? <path d={`M-26 0 C-30 -24 -20 -52 -10 -62 L10 -62 C20 -52 30 -24 26 0Z`} fill={col} {...ln} /> : <path d={`M-16 0 L-12 -70 C-8 -86 8 -86 12 -70 L16 0Z`} fill={col} {...ln} />}
      <circle cx="0" cy={seated ? -76 + sway : -98 + sway} r="13" fill={skin} {...ln} />
      <path d={`M-13 ${seated ? -78 : -100} C-12 ${seated ? -96 : -118} 12 ${seated ? -96 : -118} 13 ${seated ? -78 : -100} C6 ${seated ? -86 : -108} -6 ${seated ? -86 : -108} -13 ${seated ? -78 : -100}Z`} fill="#2c211c" {...ln} />
    </g>
  );
};
const Lying = ({x, y, s = 1}: any) => {
  const r = rng(hash(`z${x}`));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="6" rx="70" ry="12" fill="#c9a96a" {...ln} />
      <path d="M-56 0 C-50 -26 40 -30 60 -4 C62 6 -52 8 -56 0Z" fill={['#6a4a30', '#7a5a3e', '#5d4a3a'][Math.floor(r() * 3)]} {...ln} />
      <circle cx="-62" cy="-10" r="12" fill="#a8734f" {...ln} />
      <path d="M-74 -12 C-72 -26 -54 -26 -50 -12" fill="#2c211c" {...ln} />
    </g>
  );
};
const Hut = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-52" y="-62" width="104" height="62" fill={tint('#a98a62', c)} {...ln} />
    <path d="M-76 -58 L0 -150 L76 -58Z" fill={tint('#c9a96a', c)} {...ln} />
    {Array.from({length: 9}, (_, i) => <path key={i} d={`M${-62 + i * 15} -62 L${-10 + i * 7} ${-136}`} stroke={INK} strokeWidth="1.2" opacity="0.5" />)}
    <path d="M-14 0 L-14 -40 C-14 -52 14 -52 14 -40 L14 0Z" fill={c.night ? '#e9a24a' : '#3b2c24'} {...ln} />
  </g>
);
const Cabin = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-80" y="-80" width="160" height="80" fill={tint('#9a6e48', c)} {...ln} />
    {[-60, -40, -20].map((o) => <path key={o} d={`M-80 ${o} L80 ${o}`} stroke={INK} strokeWidth="1.3" opacity="0.5" />)}
    <path d="M-96 -76 L0 -150 L96 -76Z" fill={tint('#7d4f3a', c)} {...ln} />
    <rect x="-52" y="-62" width="34" height="34" fill={c.night ? '#f2b45a' : '#cfd6cc'} {...ln} />
    <path d="M-35 -62 V-28 M-52 -45 H-18" stroke={INK} strokeWidth="2" />
    <rect x="20" y="-52" width="30" height="52" fill="#4a362a" {...ln} />
    {c.night && <ellipse cx="-35" cy="-45" rx="60" ry="46" fill="#f6b04a" opacity="0.18" style={{mixBlendMode: 'screen'}} />}
  </g>
);
const Tent = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-70 0 L0 -140 L70 0Z" fill={tint('#c9a36a', c)} {...ln} />
    <path d="M-14 0 L0 -50 L14 0Z" fill={c.night ? '#e9a24a' : '#3b2c24'} {...ln} />
    <path d="M0 -140 L-14 -168 M0 -140 L14 -168" stroke={INK} strokeWidth="3" />
  </g>
);
const Tree = ({x, y, s = 1, c, k = 'broad', i = 0}: any) => {
  const sw = Math.sin(c.f / 55 + i) * 1.2, lc = [tint('#7f8e4e', c), tint('#6f8244', c), tint('#8f9a52', c)];
  if (k === 'pine') return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-5" y="-22" width="10" height="22" fill={tint('#5d4636', c)} {...ln} />
      {[0, 1, 2].map((j) => <path key={j} d={`M${-46 + j * 8} ${-22 - j * 42} L${sw * (j + 1) * 0.4} ${-92 - j * 42} L${46 - j * 8} ${-22 - j * 42}Z`} fill={tint(['#58704a', '#4f6743', '#466040'][j], c)} {...ln} />)}
    </g>
  );
  if (k === 'palm') return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C10 -60 -8 -120 6 -170" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M0 0 C10 -60 -8 -120 6 -170" fill="none" stroke={tint('#a98a62', c)} strokeWidth="5" strokeLinecap="round" />
      <g transform={`translate(6 -170) rotate(${sw})`}>{[-70, -35, 0, 35, 70].map((a, j) => <path key={j} d="M0 0 C30 -26 70 -14 96 20 C60 -4 30 -4 0 6Z" fill={tint('#6f8f4a', c)} {...ln} transform={`rotate(${a - 90 + 90} 0 0) scale(${a < 0 ? -1 : 1} 1)`} />)}</g>
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-7 0 C-4 -40 -10 -70 -4 -100 L8 -100 C4 -70 10 -40 7 0Z" fill={tint('#6b5040', c)} {...ln} />
      <g transform={`translate(${sw} 0)`}>{[[-34, -118, 40], [24, -124, 38], [-4, -150, 44], [-52, -96, 28], [46, -98, 28]].map(([a, b, rr], j) => <circle key={j} cx={a} cy={b} r={rr} fill={lc[j % 3]} {...ln} />)}</g>
    </g>
  );
};
const Rocks = ({x, y, s = 1, c}: any) => {
  const r = rng(hash(`r${x}${y}`));
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{[0, 1, 2].map((i) => { const w = 30 + r() * 40, h = 20 + r() * 28, ox = (i - 1) * 54 + r() * 16; return <g key={i}><path d={`M${ox - w} 0 C${ox - w} ${-h} ${ox - w * 0.3} ${-h * 1.3} ${ox + w * 0.2} ${-h * 1.2} C${ox + w} ${-h} ${ox + w} -4 ${ox + w} 0Z`} fill={tint('#9b958a', c)} {...ln} /><path d={`M${ox - w * 0.1} ${-h * 1.1} C${ox + w * 0.5} ${-h * 0.8} ${ox + w * 0.9} ${-h * 0.2} ${ox + w} 0 L${ox} 0Z`} fill="url(#hatch)" opacity="0.55" /></g>; })}</g>;
};
const Cairn = ({x, y, s = 1, c}: any) => <g transform={`translate(${x} ${y}) scale(${s})`}>{[[0, 0, 34, 14], [2, -22, 26, 11], [-1, -40, 18, 9], [1, -54, 11, 7]].map(([a, b, w, h], i) => <ellipse key={i} cx={a} cy={b - h / 2} rx={w} ry={h} fill={tint(['#9b958a', '#a8a296', '#8f897e', '#a8a296'][i], c)} {...ln} />)}</g>;
const Pyramid = ({x, y, s = 1, c}: any) => <g transform={`translate(${x} ${y}) scale(${s})`}><path d="M-150 0 L0 -140 L150 0Z" fill={tint('#d9b27a', c)} {...ln} /><path d="M0 -140 L150 0 L40 0Z" fill="url(#hatch)" opacity="0.5" /></g>;
const Lighthouse = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-30 0 L-18 -150 L18 -150 L30 0Z" fill={tint('#e6ddc8', c)} {...ln} />
    <path d="M-26 -50 L26 -50 L24 -80 L-24 -80Z M-21 -110 L21 -110 L19 -130 L-19 -130Z" fill={tint('#a8493a', c)} stroke={INK} strokeWidth="1.5" />
    <rect x="-22" y="-176" width="44" height="26" fill={c.night ? '#f6d27a' : '#cfd6cc'} {...ln} />
    <path d="M-26 -176 L0 -204 L26 -176Z" fill={tint('#7d4f3a', c)} {...ln} />
    {c.night && <path d={`M0 -163 L${Math.cos(c.f / 70) * 520} -163 L${Math.cos(c.f / 70) * 520} -140Z`} fill="#f6e2a0" opacity="0.14" style={{mixBlendMode: 'screen'}} />}
  </g>
);
const Castle = ({x, y, s = 1, c}: any) => <g transform={`translate(${x} ${y}) scale(${s})`}>{[[-90, 80, 110], [-30, 60, 150], [40, 70, 120], [96, 50, 90]].map(([a, w, h], i) => <g key={i}><rect x={a - w / 2} y={-h} width={w} height={h} fill={tint('#b5ab98', c)} {...ln} />{[0, 1, 2].map((j) => <rect key={j} x={a - w / 2 + 4 + j * (w / 3)} y={-h - 12} width={w / 5} height="12" fill={tint('#b5ab98', c)} {...ln} />)}<rect x={a - 5} y={-h + 24} width="10" height="22" fill={c.night ? '#f2b45a' : '#3b2c24'} /></g>)}</g>;
const Boat = ({x, y, s = 1, c}: any) => {
  const bob = Math.sin(c.f / 45 + x) * 3;
  return <g transform={`translate(${x} ${y + bob}) scale(${s})`}><path d="M-70 -18 L70 -18 L48 8 L-48 8Z" fill={tint('#7a5638', c)} {...ln} /><path d="M0 -20 V-130" stroke={INK} strokeWidth="4" /><path d="M4 -126 C50 -90 56 -50 52 -26 L4 -26Z" fill={tint('#e6dcc0', c)} {...ln} /></g>;
};
const Lantern = ({x, y, s = 1, c}: any) => <g transform={`translate(${x} ${y}) scale(${s})`}><path d="M0 -90 V-50" stroke={INK} strokeWidth="2" /><rect x="-12" y="-50" width="24" height="34" rx="5" fill="#f2b45a" {...ln} /><ellipse cx="0" cy="-34" rx={70 + 4 * Math.sin(c.f * 0.3)} ry="70" fill="#f6b04a" opacity="0.2" style={{mixBlendMode: 'screen'}} /></g>;
const Herd = ({x, y, s = 1, c}: any) => <g transform={`translate(${x + Math.sin(c.f / 300) * 14} ${y}) scale(${s})`}>{Array.from({length: 22}, (_, i) => { const r = rng(hash(`h${i}${x}`)); return <path key={i} d={`M${i * 14 + r() * 6} ${r() * 12} q4 -9 12 -7 q5 -3 8 2 l-1 7z`} fill={tint('#4a3a30', c)} />; })}</g>;
const Birds = ({f, n = 14, seed}: any) => { const r = rng(hash('b' + seed)); return <g>{Array.from({length: n}, (_, i) => { const bx = (r() * W + f * (0.5 + r() * 0.4)) % (W + 200) - 100, by = 90 + r() * 260, fl = Math.sin(f / 7 + i * 2) * 5; return <path key={i} d={`M${bx - 11} ${by + fl} Q${bx - 5} ${by - 6} ${bx} ${by} Q${bx + 5} ${by - 6} ${bx + 11} ${by + fl}`} fill="none" stroke={INK} strokeWidth="2" opacity="0.7" />; })}</g>; };
const THINGS: Record<string, any> = {campfire: Campfire, hut: Hut, cabin: Cabin, tent: Tent, tree: Tree, pine: (p: any) => <Tree {...p} k="pine" />, palm: (p: any) => <Tree {...p} k="palm" />, rocks: Rocks, cairn: Cairn, pyramid: Pyramid, lighthouse: Lighthouse, castle: Castle, boat: Boat, lantern: Lantern, herd: Herd, person: Person, lying: Lying};
// group = n seated people in an arc around (x,y), e.g. ["group",0.5,0.8,1,5]
const Group = ({x, y, s = 1, n = 5, c}: any) => <g>{Array.from({length: n}, (_, i) => { const a = Math.PI * (0.15 + (0.7 * i) / Math.max(1, n - 1)); return <Person key={i} x={x + Math.cos(a) * 130 * s * 1.5} y={y + Math.sin(a) * 36 * s + 20 * s} s={s * 0.9} c={c} seated flip={Math.cos(a) > 0} />; })}</g>;

// ---------- sky, land, frames, fx ----------
const Sky = ({c, spec, f}: any) => {
  const r = rng(hash(`sky${spec.seed}`)), p = c.pal;
  const sx = 300 + r() * 1300, sy = c.night ? 190 + r() * 80 : spec.sky === 'dusk' || spec.sky === 'dawn' ? 560 : 250 + r() * 70;
  return (
    <g>
      <rect x="-80" y="-80" width={W + 160} height={H * 0.75} fill="url(#skyg)" />
      {c.night && Array.from({length: 90}, (_, i) => <circle key={i} cx={r() * W} cy={r() * 520} r={0.8 + r() * 1.6} fill="#fff6d8" opacity={0.45 + 0.4 * Math.sin(f / 26 + i * 1.7)} />)}
      {spec.sky !== 'overcast' && <><circle cx={sx} cy={sy} r="260" fill="url(#glow)" /><circle cx={sx} cy={sy} r={c.night ? 46 : 66} fill={p.sun} opacity={c.night ? 0.95 : 0.85} />{c.night && <circle cx={sx + 16} cy={sy - 6} r="42" fill="#1d2848" opacity="0.18" />}</>}
      {Array.from({length: spec.sky === 'overcast' ? 6 : 3}, (_, i) => { const cx = ((r() * (W + 600) + f * (0.18 + r() * 0.2)) % (W + 600)) - 300, cy = 100 + r() * 260; return <g key={i} opacity={c.night ? 0.25 : 0.5}>{[[0, 0, 110, 26], [-90, 10, 80, 20], [90, 12, 90, 20]].map(([a, b, w, h], j) => <ellipse key={j} cx={cx + a} cy={cy + b} rx={w} ry={h} fill={mix(p.b, '#ffffff', 0.55)} />)}</g>; })}
    </g>
  );
};
const Land = ({c, spec, f}: any) => {
  const L = c.land, r = rng(hash(`land${spec.seed}`));
  const horizon = H * (L.water === 'sea' ? 0.46 : 0.5);
  const far = ridge(r, horizon - 40, L.peaks ? 150 : 38), mid = ridge(r, horizon + 40, L.dunes ? 40 : 30), nearR = ridge(r, horizon + 190, 26);
  const farC = mix(tint(L.far, c), c.pal.b, 0.35), midC = tint(L.mid, c), gndC = tint(L.gnd, c);
  const cx = W * (spec.riverX ?? 0.35 + r() * 0.3), ph = r() * 6;
  const river = (k: number) => { let a = '', b = ''; for (let t = 0; t <= 1.001; t += 0.05) { const y = horizon + 70 + t * t * (H - horizon - 70), x = cx + Math.sin(t * 3.2 + ph) * 260 * t, w = 8 + t * t * 260 * k; a += `${t ? 'L' : 'M'}${(x - w).toFixed(0)} ${y.toFixed(0)} `; b = `L${(x + w).toFixed(0)} ${y.toFixed(0)} ` + b; } return a + b + 'Z'; };
  const tufts = Array.from({length: L.grass ? 150 : 70}, (_, i) => ({x: r() * W, y: horizon + 230 + r() * (H - horizon - 200), i}));
  const trees = L.trees === 'none' ? 0 : L.trees === 'few' ? 4 : L.trees === 'palm' ? 3 : L.trees === 'broad' ? 8 : 16;
  return (
    <g>
      <defs>{[['far', farC], ['mid', midC], ['gnd', gndC]].map(([k, col]) => <linearGradient key={k} id={`lg-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={mix(col, c.pal.b, k === 'far' ? 0.3 : 0.22)} /><stop offset="0.6" stopColor={col} /><stop offset="1" stopColor={mix(col, '#3a3320', 0.12)} /></linearGradient>)}</defs>
      <path d={ridgePath(far)} fill="url(#lg-far)" {...ln} strokeWidth={1.4} opacity="0.95" />
      {L.peaks && <path d={ridgePath((x) => far(x) - 60 + 40 * Math.sin(x / 90))} fill="#eef0ee" opacity="0.5" />}
      {L.water === 'sea' && <g><rect x="-80" y={horizon} width={W + 160} height={H - horizon} fill={tint('#8fa9a8', c)} />{Array.from({length: 46}, (_, i) => { const y = horizon + 14 + (i * 11.7) % (H - horizon - 20), x = (i * 331 + f * (0.15 + (i % 5) * 0.05)) % (W + 100) - 50; return <path key={i} d={`M${x} ${y} q14 -8 28 0 q14 8 28 0`} fill="none" stroke={mix('#ffffff', tint('#8fa9a8', c), 0.3)} strokeWidth="2" opacity="0.7" />; })}</g>}
      {L.water !== 'sea' && <path d={ridgePath(mid)} fill="url(#lg-mid)" {...ln} />}
      {L.water === 'lake' && <ellipse cx={W * 0.5} cy={horizon + 120} rx="520" ry="46" fill={tint('#9db5bd', c)} {...ln} />}
      {L.water !== 'sea' && <path d={ridgePath(nearR)} fill="url(#lg-gnd)" {...ln} />}
      {L.water === 'river' && <g><path d={river(1.1)} fill={tint('#9db5b8', c)} {...ln} />{Array.from({length: 26}, (_, i) => { const t = 0.15 + ((i * 0.037 + f / 900) % 0.85), y = horizon + 70 + t * t * (H - horizon - 70), x = cx + Math.sin(t * 3.2 + ph) * 260 * t + Math.sin(i * 9) * t * 120; return <path key={i} d={`M${x - 14 * t * 3} ${y} h${28 * t * 3}`} stroke="#f4f0dc" strokeWidth="2" opacity="0.6" />; })}</g>}
      {L.water === 'sea' && <path d={ridgePath((x) => horizon + 330 + 30 * Math.sin(x / 260), H + 40)} fill="url(#lg-gnd)" {...ln} />}
      {L.trees !== 'none' && Array.from({length: trees}, (_, i) => { const t = r(), x = r() * W, y = L.water === 'sea' ? horizon + 300 + t * 140 : horizon + 70 + t * 150; return <Tree key={i} x={x} y={y} s={L.water === 'sea' ? 0.7 + t * 0.4 : 0.3 + t * 0.5} c={c} k={L.trees === 'few' ? 'broad' : L.trees} i={i} />; })}
      {tufts.map(({x, y, i}) => { const sw = Math.sin(f / 36 + i) * 2.5, col = mix(gndC, '#3a3a20', 0.45); return <path key={i} d={`M${x} ${y} q${-4 + sw} -14 ${-8 + sw} -26 M${x} ${y} q${sw} -18 ${2 + sw} -32 M${x} ${y} q${4 + sw} -12 ${9 + sw} -22`} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" />; })}
    </g>
  );
};
const Frame = ({kind, c, f}: any) => {
  const hole = kind === 'cave' ? 'M330 120 C560 -10 1380 -20 1600 140 C1740 260 1760 520 1540 640 C1280 760 620 770 380 650 C190 540 150 250 330 120Z' : 'M410 90 H1510 V860 H410Z';
  const out = `M-20 -20 H${W + 20} V${H + 20} H-20Z `;
  if (kind === 'cave') return (
    <g>
      <path d={out + hole} fillRule="evenodd" fill={mix('#6b655c', c.pal.t, c.night ? 0.2 : 0)} stroke={INK} strokeWidth="3" />
      <path d={out + hole} fillRule="evenodd" fill="url(#hatch)" opacity="0.5" />
      {Array.from({length: 9}, (_, i) => { const a = (i / 9) * 6.283, x = 960 + Math.cos(a) * 760, y = 380 + Math.sin(a) * 330; return <path key={i} d={`M${x} ${y} q${-Math.cos(a) * 60} ${-Math.sin(a) * 40} ${-Math.cos(a) * 130 + 20} ${-Math.sin(a) * 90}`} fill="none" stroke={INK} strokeWidth="2.4" opacity="0.7" />; })}
      <path d="M-20 790 C400 700 1500 700 1940 790 V1100 H-20Z" fill="#6b6256" stroke={INK} strokeWidth="3" /><path d="M-20 790 C400 700 1500 700 1940 790 V1100 H-20Z" fill="url(#hatch)" opacity="0.3" />
    </g>
  );
  if (kind === 'window') return (
    <g>
      <path d={out + hole} fillRule="evenodd" fill={mix('#4a362a', '#101018', c.night ? 0.5 : 0)} stroke={INK} strokeWidth="3" />
      <path d="M960 90 V860 M410 470 H1510" stroke="#3a2a22" strokeWidth="14" /><path d="M960 90 V860 M410 470 H1510" stroke={INK} strokeWidth="2" fill="none" />
      <path d="M380 860 H1540 V920 H380Z" fill="#6b4c36" {...ln} />
      <path d="M410 60 C560 220 520 560 380 720 L380 -20Z M1510 60 C1360 220 1400 560 1540 720 L1540 -20Z" fill={c.night ? '#4a3a52' : '#b5876a'} {...ln} opacity="0.95" />
      <rect x="0" y="920" width={W} height="170" fill="#3d2d24" /><ellipse cx="1250" cy="880" rx="60" ry="12" fill="#cfd6cc" opacity="0.2" />
    </g>
  );
  return null;
};
const Fx = ({c, spec, f}: any) => {
  const fx: string[] = spec.fx || [], r = rng(hash(`fx${spec.seed}`));
  return (
    <g>
      {fx.includes('mist') && [0, 1, 2].map((i) => <ellipse key={i} cx={((f * (0.3 + i * 0.12) + i * 700) % (W + 1200)) - 500} cy={560 + i * 90} rx="640" ry="70" fill="url(#mist)" />)}
      {fx.includes('smoke') && Array.from({length: 16}, (_, i) => { const t = ((f / 4 + i * 11) % 180) / 180, bx = (spec.smokeX ?? 0.5) * W; return <circle key={i} cx={bx + Math.sin(t * 6 + i) * 30 + t * 60} cy={620 - t * 520} r={14 + t * 70} fill="#d9d4c8" opacity={0.3 * (1 - t)} />; })}
      {fx.includes('rain') && Array.from({length: 160}, (_, i) => { const x = (r() * (W + 200) + f * 5) % (W + 200) - 60, y = (r() * H + f * 22) % (H + 80) - 40; return <path key={i} d={`M${x} ${y} l-6 28`} stroke="#dfe8ee" strokeWidth="1.6" opacity="0.55" />; })}
      {fx.includes('snow') && Array.from({length: 120}, (_, i) => { const x = (r() * W + Math.sin(f / 50 + i) * 20 + f * 0.6) % W, y = (r() * H + f * (1.2 + r())) % H; return <circle key={i} cx={x} cy={y} r={1.8 + r() * 2.4} fill="#fff" opacity="0.8" />; })}
      {fx.includes('fireflies') && Array.from({length: 26}, (_, i) => { const x = r() * W + Math.sin(f / 60 + i * 3) * 40, y = 480 + r() * 420 + Math.cos(f / 70 + i) * 30; return <circle key={i} cx={x} cy={y} r="3" fill="#f6e58a" opacity={0.3 + 0.6 * Math.max(0, Math.sin(f / 30 + i * 2))} style={{mixBlendMode: 'screen'}} />; })}
      {fx.includes('birds') && <Birds f={f} seed={spec.seed} />}
    </g>
  );
};

export const Scene: React.FC<{spec: Spec; frame: number; fps: number; p: number}> = ({spec, frame, fps, p}) => {
  const s = {seed: 'x', sky: 'day', land: 'valley', ...spec};
  const pal = SKY[s.sky] ?? SKY.day, land = LAND[s.land] ?? LAND.valley;
  const c: Ctx = {pal, f: frame, fps, r: rng(hash(String(s.seed))), land, night: !!pal.night};
  const boil = Math.floor((frame * 6) / fps) % 6;
  const cam = s.cam ?? 'in', z = 1.05 + (cam === 'out' ? 0.05 * (1 - p) : cam === 'in' ? 0.05 * p : 0.03), px = cam === 'left' ? (0.5 - p) * 70 : cam === 'right' ? (p - 0.5) * 70 : 0, py = cam === 'up' ? (0.5 - p) * 40 : 0;
  const things = (s.things ?? []).map((t: any[], i: number) => ({k: t[0], x: t[1] * W, y: t[2] * H, s: t[3] ?? 1, n: t[4], i})).sort((a: any, b: any) => a.y - b.y);
  const draw = (a: any[]) => a.map((t) => { const Th = t.k === 'group' ? Group : THINGS[t.k]; return Th ? <Th key={t.i} x={t.x} y={t.y} s={t.s} n={t.n} c={c} i={t.i} /> : null; });
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{display: 'block', background: pal.b}}>
      <defs>
        <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={pal.t} /><stop offset="1" stopColor={pal.b} /></linearGradient>
        <radialGradient id="mist"><stop offset="0" stopColor="#f6f1e4" stopOpacity="0.5" /><stop offset="1" stopColor="#f6f1e4" stopOpacity="0" /></radialGradient>
        <radialGradient id="glow"><stop offset="0" stopColor={pal.sun} stopOpacity="0.55" /><stop offset="1" stopColor={pal.sun} stopOpacity="0" /></radialGradient>
        <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="9" stroke={INK} strokeWidth="1.5" /></pattern>
        <filter id="rough" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.014 0.018" numOctaves="2" seed={boil + 1} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" /></filter>
      </defs>
      <g transform={`translate(${W / 2 + px} ${H / 2 + py}) scale(${z}) translate(${-W / 2} ${-H / 2})`}>
        <g filter="url(#rough)">
          <Sky c={c} spec={s} f={frame} />
          <Land c={c} spec={s} f={frame} />
          {draw(things.filter((t: any) => !s.frame || t.y < H * 0.7))}
          {s.frame && <Frame kind={s.frame} c={c} f={frame} />}
          {draw(things.filter((t: any) => s.frame && t.y >= H * 0.7))}
        </g>
        <Fx c={c} spec={s} f={frame} />
      </g>
      {pal.night && <rect width={W} height={H} fill="#0c1230" opacity="0.18" />}
    </svg>
  );
};
