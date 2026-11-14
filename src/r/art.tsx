// Hand-drawn scene engine. Pure function of (spec, frame): no randomness, no clock.
// Look: wobbling ink lines (SVG displacement, new seed 6x/second = "boil"), flat watercolour fills, grain.
import React from 'react';
export type Spec = {view?: {z?: number; x?: number; y?: number}; riverX?: number; smokeX?: number; sky?: string; land?: string; frame?: string; fx?: string[]; things?: any[]; cam?: string; seed?: string | number};
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
  storm: {t: '#454f63', b: '#878da0', sun: '#d9dee8', amb: [0.55, 0.58, 0.7]},
  radiant: {t: '#e9d194', b: '#f8edc2', sun: '#ffedb0', amb: [1.05, 1.0, 0.92]},
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
  cloudsea: {far: '#cfd4d8', mid: '#dde1e0', gnd: '#eef0ea', water: 'none', trees: 'none', clouds: 1},
  ashfield: {far: '#67676e', mid: '#54545b', gnd: '#46464d', water: 'river', trees: 'none'},
  grove: {far: '#a9b08e', mid: '#99a468', gnd: '#a8a45e', water: 'none', trees: 'olive'},
  isle: {far: '#a8b4a2', mid: '#c6b68a', gnd: '#d3bf90', water: 'sea', trees: 'few', stacks: 1},
  lake: {far: '#a9b08e', mid: '#9db0a0', gnd: '#a3a488', water: 'lake', trees: 'pine'},
  canal: {far: '#adb18f', mid: '#a2a86c', gnd: '#b1a95e', water: 'river', trees: 'few'},
  fjord: {far: '#8fa0b4', mid: '#77897c', gnd: '#8a8f66', water: 'sea', trees: 'pine', peaks: 1},
  frost: {far: '#aebfd0', mid: '#c3d2de', gnd: '#dde7ee', water: 'none', trees: 'none', peaks: 1},
  ember: {far: '#5e4034', mid: '#6e4632', gnd: '#7d4f30', water: 'none', trees: 'none', dunes: 1},
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
  if (k === 'olive') return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-9 0 C-12 -26 -2 -40 -8 -62 L6 -64 C2 -42 10 -24 8 0Z" fill={tint('#5f4c3c', c)} {...ln} />
      <g transform={`translate(${sw} 0)`}>{[[-30, -88, 30], [22, -94, 32], [0, -118, 34], [-48, -70, 22], [44, -72, 22]].map(([a, b, rr], j) => <circle key={j} cx={a} cy={b} r={rr} fill={[tint('#9aa06b', c), tint('#a8ad76', c), tint('#8f9660', c)][j % 3]} {...ln} />)}</g>
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

// ---------- Path C — heights, harbours and market streets (2026-11-12) ----------
// Drawn at 0,0 = feet, s = scale. Motion is SLOW: sin(c.f / N) only. No random, no clock, no faces, no text.
const Temple = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-160" y="-14" width="320" height="14" fill={tint('#b8ab8e', c)} {...ln} />
    <rect x="-140" y="-28" width="280" height="14" fill={tint('#c4b797', c)} {...ln} />
    <rect x="-120" y="-42" width="240" height="14" fill={tint('#cfc2a2', c)} {...ln} />
    {[-100, -50, 0, 50, 100].map((o) => <g key={o}><rect x={o - 9} y="-196" width="18" height="154" fill={tint('#e2d9c2', c)} {...ln} /><rect x={o - 13} y="-208" width="26" height="12" fill={tint('#e2d9c2', c)} {...ln} /><rect x={o - 13} y="-52" width="26" height="10" fill={tint('#e2d9c2', c)} {...ln} /></g>)}
    <rect x="-140" y="-222" width="280" height="16" fill={tint('#cfc2a2', c)} {...ln} />
    <path d="M-150 -222 L0 -282 L150 -222Z" fill={tint('#bfb094', c)} {...ln} />
    <circle cx="0" cy="-240" r="10" fill={tint('#d9cba6', c)} {...ln} />
  </g>
);
const Pillar = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-38" y="-12" width="76" height="12" fill={tint('#b8ab8e', c)} {...ln} />
    <path d="M-15 -12 L-12 -148 L12 -148 L15 -12Z" fill={tint('#ddd3ba', c)} {...ln} />
    {[-110, -76, -42].map((o) => <path key={o} d={`M-14 ${o} L14 ${o}`} stroke={INK} strokeWidth="1.2" opacity="0.45" />)}
    <rect x="-24" y="-164" width="48" height="16" fill={tint('#e2d9c2', c)} {...ln} />
    <rect x="-29" y="-176" width="58" height="12" fill={tint('#cfc2a2', c)} {...ln} />
    <ellipse cx="54" cy="-8" rx="17" ry="10" fill={tint('#cfc6ae', c)} {...ln} />
  </g>
);
const Throne = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-58" y="-14" width="116" height="14" fill={tint('#8a6a42', c)} {...ln} />
    <path d="M-44 0 L-38 -52 L38 -52 L44 0Z" fill={tint('#7a5a34', c)} {...ln} />
    <rect x="-40" y="-96" width="80" height="46" fill={tint('#8e3b30', c)} {...ln} />
    <rect x="-48" y="-208" width="96" height="116" fill={tint('#a8894f', c)} {...ln} />
    <rect x="-36" y="-196" width="72" height="92" fill={tint('#8e3b30', c)} {...ln} />
    <circle cx="0" cy="-226" r="15" fill={tint('#d9b45a', c)} {...ln} />
    {[-48, 48].map((o) => <g key={o}><rect x={o - 8} y="-118" width="16" height="66" fill={tint('#8a6a42', c)} {...ln} /><circle cx={o} cy="-126" r="10" fill={tint('#d9b45a', c)} {...ln} /></g>)}
  </g>
);
const Bolt = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="-92" rx="58" ry="112" fill="#f7d774" opacity="0.16" style={{mixBlendMode: 'screen'}} />
    <path d="M-6 -196 L20 -120 L2 -114 L24 -40 L-14 0 L-2 -70 L-16 -64 L-30 -130Z" fill={tint('#f7d774', c)} {...ln} />
  </g>
);
const Trident = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 0 V-148" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    <path d="M0 0 V-148" stroke={tint('#c8a24a', c)} strokeWidth="5" strokeLinecap="round" />
    <path d="M-27 -146 V-170 M0 -154 V-186 M27 -146 V-170" stroke={tint('#c8a24a', c)} strokeWidth="5" strokeLinecap="round" fill="none" />
    <path d="M-27 -146 H27" stroke={tint('#c8a24a', c)} strokeWidth="5" />
    {[-27, 0, 27].map((o) => <path key={o} d={`M${o - 5} ${o === 0 ? -186 : -170} L${o} ${o === 0 ? -196 : -180} L${o + 5} ${o === 0 ? -186 : -170}Z`} fill={tint('#c8a24a', c)} stroke={INK} strokeWidth="1.4" />)}
  </g>
);
const Serpent = ({x, y, s = 1, c}: any) => {
  const w = Math.sin(c.f / 55 + x) * 3;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={`M-170 0 C-140 ${-26 + w} -110 ${-26 - w} -80 0 C-50 ${-24 + w} -20 ${-24 - w} 10 0 C40 ${-20 + w} 66 -18 92 -6`} fill="none" stroke={tint('#55705f', c)} strokeWidth="17" strokeLinecap="round" />
      <path d="M92 -6 C116 -18 124 -44 118 -72" fill="none" stroke={tint('#55705f', c)} strokeWidth="15" strokeLinecap="round" />
      <g transform={`translate(118 -78) rotate(${w * 2})`}>
        <ellipse cx="8" cy="0" rx="20" ry="12" fill={tint('#5f7d68', c)} {...ln} />
        <circle cx="13" cy="-4" r="2.6" fill={INK} />
        <path d="M26 2 L40 -2 M26 2 L40 6" stroke="#a8493a" strokeWidth="2" fill="none" />
        {[-12, -4, 4].map((o) => <path key={o} d={`M${o} -11 L${o + 3} -20 L${o + 7} -11Z`} fill={tint('#8fae7a', c)} stroke={INK} strokeWidth="1.2" />)}
      </g>
    </g>
  );
};
const Wave = ({x, y, s = 1, c}: any) => {
  const sway = Math.sin(c.f / 70 + x) * 3;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-160 0 C-130 -96 -50 -158 36 -148 C112 -139 148 -72 128 0Z" fill={tint('#7fa3a8', c)} {...ln} />
      <path d="M128 -52 C150 -104 92 -162 22 -146 C-24 -136 -18 -88 14 -84 C38 -81 44 -106 26 -118" fill="none" stroke={tint('#eef2ea', c)} strokeWidth="7" strokeLinecap="round" transform={`translate(${sway} 0)`} />
      {[[96, -120, 9], [126, -88, 7], [64, -136, 6], [140, -40, 5]].map(([a, b, rr], i) => <circle key={i} cx={a + sway} cy={b} r={rr} fill={tint('#eef2ea', c)} opacity="0.85" />)}
      <path d="M-160 0 C-90 -18 -30 -14 40 -8 C90 -4 120 -6 150 0" fill="none" stroke={tint('#5d868c', c)} strokeWidth="4" opacity="0.6" />
    </g>
  );
};
const Chariot = ({x, y, s = 1, c}: any) => {
  const bob = Math.sin(c.f / 48 + x) * 1.6;
  const horse = (o: number, leg: number) => (
    <g key={o} transform={`translate(${o} ${bob})`}>
      <ellipse cx="0" cy="-58" rx="37" ry="16" fill={tint('#5d4636', c)} {...ln} />
      <path d="M28 -64 L44 -82 L50 -74 L38 -54Z" fill={tint('#5d4636', c)} {...ln} />
      <path d="M-34 -62 Q-46 -48 -42 -30" fill="none" stroke={INK} strokeWidth="3.4" />
      {[-24, -10, 12, 26].map((l, i) => <path key={i} d={`M${l} -46 L${l + (i % 2 ? -7 : 7) * leg} -2`} stroke={INK} strokeWidth="3.6" fill="none" />)}
      <path d="M-6 -72 L10 -72 L12 -62 L-8 -62Z" fill={tint('#a8493a', c)} {...ln} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {horse(58, 1)}{horse(112, -1)}
      <path d="M-58 -52 L30 -56 M-58 -40 L30 -44" stroke={INK} strokeWidth="3" />
      <circle cx="-72" cy="-16" r="30" fill="none" stroke={INK} strokeWidth="5" />
      <circle cx="-72" cy="-16" r="6" fill={tint('#8a6a42', c)} {...ln} />
      {[0, 60, 120].map((a) => <path key={a} d={`M-72 -16 L${-72 + 27 * Math.cos(a * Math.PI / 180)} ${-16 + 27 * Math.sin(a * Math.PI / 180)} M-72 -16 L${-72 - 27 * Math.cos(a * Math.PI / 180)} ${-16 - 27 * Math.sin(a * Math.PI / 180)}`} stroke={INK} strokeWidth="2.6" />)}
      <path d="M-104 -16 L-102 -66 C-102 -80 -46 -80 -44 -66 L-40 -16Z" fill={tint('#9a6e48', c)} {...ln} />
      <Person x={-72} y={-64} s={0.82} c={c} cloth="#a8493a" />
    </g>
  );
};
const AuraFigure = ({x, y, s = 1, c}: any) => {
  const bob = Math.sin(c.f / 62 + x) * 6;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s})`}>
      {[168, 128, 94].map((rr, i) => <ellipse key={i} cx="0" cy="-118" rx={rr * 0.78} ry={rr} fill="#f7e3a0" opacity={[0.05, 0.07, 0.1][i]} style={{mixBlendMode: 'screen'}} />)}
      <g transform={`rotate(${c.f / 40} 0 -118)`}>{Array.from({length: 12}, (_, i) => { const a = (i / 12) * Math.PI * 2, long = i % 2 === 0; return <path key={i} d={`M${Math.cos(a) * 138} ${-118 + Math.sin(a) * 138} L${Math.cos(a) * (long ? 178 : 160)} ${-118 + Math.sin(a) * (long ? 178 : 160)}`} stroke="#f7e3a0" strokeWidth="3" opacity="0.35" strokeLinecap="round" />; })}</g>
      <path d="M-31 -14 C-39 -84 -25 -152 -12 -182 L12 -182 C25 -152 39 -84 31 -14 C14 -27 -14 -27 -31 -14Z" fill={tint('#ece2c8', c)} {...ln} />
      <path d="M-31 -14 C-14 -27 14 -27 31 -14 L31 -6 C12 -16 -12 -16 -31 -6Z" fill={tint('#d9cba6', c)} {...ln} />
      {[-1, 1].map((sd) => <path key={sd} d={`M${sd * 14} -168 C${sd * 34} -140 ${sd * 36} -104 ${sd * 27} -76`} fill="none" stroke={tint('#ddd2b4', c)} strokeWidth="9" strokeLinecap="round" />)}
      <circle cx="0" cy="-198" r="14" fill="#c9a189" {...ln} />
      <ellipse cx="0" cy="-222" rx="21" ry="6" fill="none" stroke={tint('#d9b45a', c)} strokeWidth="3" />
    </g>
  );
};
const Winged = ({x, y, s = 1, c}: any) => {
  const flap = Math.sin(c.f / 58 + x) * 4, bob = Math.sin(c.f / 58 + x) * 4;
  const wing = (sd: number) => (
    <g key={sd} transform={`rotate(${sd * flap} 0 -148) scale(${sd} 1)`}>
      <path d="M4 -150 C60 -196 138 -186 178 -122 C128 -118 92 -128 56 -112 C84 -92 84 -66 44 -52 C58 -78 30 -104 4 -96Z" fill={tint('#e6ddc8', c)} {...ln} />
      {[0, 1, 2].map((j) => <path key={j} d={`M${16 + j * 8} ${-138 + j * 16} C${60 + j * 16} ${-158 + j * 18} ${104 + j * 14} ${-140 + j * 16}`} fill="none" stroke={INK} strokeWidth="1.4" opacity="0.45" />)}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s})`}>
      {wing(-1)}{wing(1)}
      <path d="M-15 -6 L-11 -128 C-7 -146 7 -146 11 -128 L15 -6Z" fill={tint('#b6763c', c)} {...ln} />
      <circle cx="0" cy="-160" r="13" fill="#b98560" {...ln} />
      <path d="M-13 -162 C-12 -178 12 -178 13 -162 C6 -170 -6 -170 -13 -162Z" fill="#2c211c" {...ln} />
    </g>
  );
};
const Warrior = ({x, y, s = 1, c, flip}: any) => (
  <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * s} ${s})`}>
    <ellipse cx="0" cy="2" rx="21" ry="6" fill="#000" opacity="0.14" />
    <path d="M30 -168 L40 6" stroke={INK} strokeWidth="4.4" strokeLinecap="round" />
    <path d="M24 -186 L30 -162 L37 -185Z" fill={tint('#c8ccd2', c)} stroke={INK} strokeWidth="1.4" />
    <path d="M-16 0 L-12 -70 C-8 -88 8 -88 12 -70 L16 0Z" fill={tint('#8e3b30', c)} {...ln} />
    <circle cx="-31" cy="-82" r="31" fill={tint('#b08a4a', c)} {...ln} />
    <circle cx="-31" cy="-82" r="12" fill={tint('#8a6a34', c)} {...ln} />
    <circle cx="0" cy="-100" r="13" fill="#a8734f" {...ln} />
    <path d="M-14 -102 A14 14 0 0 1 14 -102 L14 -96 L-14 -96Z" fill={tint('#8f959c', c)} {...ln} />
    <path d="M0 -114 C2 -126 -2 -132 0 -140" stroke="#a8493a" strokeWidth="3.4" fill="none" />
  </g>
);
const Giant = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="3" rx="34" ry="8" fill="#000" opacity="0.16" />
    <path d="M-27 0 L-21 -112 C-16 -138 16 -138 21 -112 L27 0Z" fill={tint('#4c4238', c)} {...ln} />
    {[-1, 1].map((sd) => <path key={sd} d={`M${sd * 19} -118 C${sd * 30} -84 ${sd * 28} -44 ${sd * 24} -8`} fill="none" stroke={tint('#443a30', c)} strokeWidth="11" strokeLinecap="round" />)}
    <circle cx="0" cy="-152" r="16" fill={tint('#6e5138', c)} {...ln} />
    <path d="M-16 -154 C-15 -172 15 -172 16 -154 C8 -162 -8 -162 -16 -154Z" fill="#241c16" {...ln} />
  </g>
);
const Stall = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[-62, 62].map((o) => <rect key={o} x={o - 4} y="-96" width="8" height="96" fill={tint('#6b5040', c)} {...ln} />)}
    <path d="M-84 -92 L0 -124 L84 -92 L76 -80 L0 -106 L-76 -80Z" fill={tint('#a8493a', c)} {...ln} />
    <rect x="-66" y="-52" width="132" height="12" fill={tint('#8a6a42', c)} {...ln} />
    <rect x="-60" y="-40" width="120" height="40" fill={tint('#9a7a4e', c)} {...ln} />
    {[-38, 0, 38].map((o, i) => <ellipse key={i} cx={o} cy="-58" rx="13" ry="10" fill={tint(['#b5854e', '#7a7a4a', '#a87a52'][i], c)} {...ln} />)}
  </g>
);
const ArchBridge = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-150 0 A150 96 0 0 1 150 0 L128 0 A106 62 0 0 0 -128 0Z" fill={tint('#a39a86', c)} {...ln} />
    <path d="M-150 -6 A150 96 0 0 1 150 -6" fill="none" stroke={INK} strokeWidth="3" />
    {[-110, -66, -22, 22, 66, 110].map((o, i) => { const yy = -96 * Math.sqrt(Math.max(0, 1 - (o / 150) * (o / 150))); return <rect key={i} x={o - 3} y={yy - 16} width="6" height="18" fill={tint('#8a8578', c)} stroke={INK} strokeWidth="1.2" />; })}
  </g>
);
const TierTower = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[0, 1, 2].map((j) => { const w = 96 - j * 26, top = -j * 62 - 44; return <g key={j}><rect x={-w / 2 + 10} y={top} width={w - 20} height="44" fill={tint('#c9b18a', c)} {...ln} /><path d={`M${-w / 2 - 12} ${top + 4} L0 ${top - 22} L${w / 2 + 12} ${top + 4} L${w / 2} ${top + 12} L0 ${top - 10} L${-w / 2} ${top + 12}Z`} fill={tint('#7a5a3e', c)} {...ln} /><rect x="-7" y={top + 16} width="14" height="18" fill={c.night ? '#f2b45a' : '#4a362a'} {...ln} /></g>; })}
  </g>
);
const LanternString = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-170 -120 Q0 30 170 -120" fill="none" stroke={INK} strokeWidth="2" />
    {[0.14, 0.3, 0.5, 0.7, 0.86].map((t, i) => { const lx = -170 + 340 * t, yy = (1 - t) * (1 - t) * -120 + 2 * (1 - t) * t * 30 + t * t * -120; return <g key={i} transform={`translate(${lx} ${yy + 16})`}><line x1="0" y1="-16" x2="0" y2="-7" stroke={INK} strokeWidth="1.6" /><circle r="23" fill="#f6b04a" opacity={0.15 + 0.05 * Math.sin(c.f * 0.3 + i * 2)} style={{mixBlendMode: 'screen'}} /><ellipse rx="10" ry="12" fill={tint('#f2b45a', c)} {...ln} /></g>; })}
  </g>
);
const Willow = ({x, y, s = 1, c}: any) => {
  const sw = Math.sin(c.f / 60 + x) * 2;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-8 0 C-4 -44 -12 -76 -2 -108 L10 -108 C4 -76 10 -44 7 0Z" fill={tint('#6b5040', c)} {...ln} />
      {[-64, -40, -18, 4, 28, 52, 72].map((o, i) => <path key={i} d={`M0 -112 C${o * 0.5 + sw} ${-130 - (i % 3) * 8} ${o + sw} -60 ${o * 1.06 + sw} ${-6 - (i % 4) * 9}`} fill="none" stroke={tint(i % 2 ? '#7f9455' : '#8fa45e', c)} strokeWidth="4.4" strokeLinecap="round" />)}
    </g>
  );
};
const Gate = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[-56, 56].map((o) => <g key={o}><rect x={o - 8} y="-118" width="16" height="118" fill={tint('#7a5638', c)} {...ln} /><path d={`M${o - 16} -118 L${o} -138 L${o + 16} -118Z`} fill={tint('#5d4636', c)} {...ln} /></g>)}
    <rect x="-84" y="-142" width="168" height="13" fill={tint('#8a6a42', c)} {...ln} />
    <rect x="-70" y="-118" width="140" height="10" fill={tint('#8a6a42', c)} {...ln} />
  </g>
);
const Shopfront = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-88" y="-104" width="176" height="104" fill={tint('#b59a72', c)} {...ln} />
    <rect x="-64" y="-140" width="128" height="24" fill={tint('#7a4a3a', c)} {...ln} />
    <path d="M-96 -104 L96 -104 L78 -78 L-78 -78Z" fill={tint('#a8493a', c)} {...ln} />
    <rect x="-66" y="-62" width="42" height="40" fill={c.night ? '#f2b45a' : '#cfd6cc'} {...ln} />
    <rect x="14" y="-66" width="34" height="66" fill="#4a362a" {...ln} />
    <rect x="56" y="-62" width="24" height="40" fill={c.night ? '#f2b45a' : '#cfd6cc'} {...ln} />
  </g>
);
const Punt = ({x, y, s = 1, c}: any) => {
  const bob = Math.sin(c.f / 48 + x) * 2.4;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s})`}>
      <path d="M-96 -10 L96 -10 L78 6 L-78 6Z" fill={tint('#7a5638', c)} {...ln} />
      <Person x={34} y={-8} s={0.9} c={c} />
      <path d="M52 -84 L84 14" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
    </g>
  );
};
const Bamboo = ({x, y, s = 1, c}: any) => {
  const r = rng(hash(`ba${x}${y}`));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Array.from({length: 5}, (_, i) => { const o = (i - 2) * 22 + r() * 8, h = 130 + r() * 70; return <g key={i}><rect x={o - 5} y={-h} width="10" height={h} rx="5" fill={tint('#7f9455', c)} {...ln} />{[0.36, 0.62, 0.86].map((t) => <path key={t} d={`M${o - 5} ${-h * t} L${o + 5} ${-h * t}`} stroke={INK} strokeWidth="1.3" opacity="0.6" />)}<path d={`M${o} ${-h + 4} C${o + 16} ${-h - 8} ${o + 26} ${-h + 2} ${o + 30} ${-h + 12} M${o} ${-h + 4} C${o - 14} ${-h - 10} ${o - 24} ${-h} ${o - 28} ${-h + 10}`} fill="none" stroke={tint('#6f8a4a', c)} strokeWidth="3" strokeLinecap="round" /></g>; })}
    </g>
  );
};
const Pavilion = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-96" y="-10" width="192" height="10" fill={tint('#8a8578', c)} {...ln} />
    {[-78, -28, 28, 78].map((o) => <rect key={o} x={o - 4} y="-96" width="8" height="88" fill={tint('#7a4a3a', c)} {...ln} />)}
    <path d="M-30 -96 L30 -96 M-78 -58 L78 -58" stroke={INK} strokeWidth="2" opacity="0.7" />
    <path d="M-118 -92 L0 -138 L118 -92 L100 -80 L0 -120 L-100 -80Z" fill={tint('#5d7a68', c)} {...ln} />
  </g>
);
const Lookout = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[-1, 1].map((sd) => <path key={sd} d={`M${sd * 20} -84 L${sd * 46} 0 M${sd * 46} -84 L${sd * 20} 0`} stroke={tint('#6b5040', c)} strokeWidth="7" strokeLinecap="round" />)}
    <rect x="-52" y="-128" width="104" height="46" fill={tint('#9a7a4e', c)} {...ln} />
    <rect x="-12" y="-114" width="24" height="20" fill={c.night ? '#f2b45a' : '#3b2c24'} {...ln} />
    <path d="M-64 -128 L0 -158 L64 -128Z" fill={tint('#7a4a3a', c)} {...ln} />
  </g>
);

// ---------- Path B — Erie Canal (patched in, 2026-11-11) ----------
// CanalBoat, LockGate, StoneLock, StoneAqueduct, TowpathHorse, Towpath, SaltWorks, PacketCabin
// Drawn at 0,0 = feet, s = scale. Palette: ochre / olive / sienna / dusty rose / stone grey / water green / lantern gold.
// Motion is SLOW: sin(c.f / N) only. No random, no clock, no faces, no text, no close-ups.
const CanalBoat = ({x, y, s = 1, c}: any) => {
  const bob = Math.sin(c.f / 45 + x) * 3;
  const smoke = Math.sin(c.f / 60 + x) * 2;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="92" ry="7" fill={tint('#6a8a7a', c)} opacity={0.45} />
      <path d="M -92 0 L 92 0 L 78 -18 L -78 -18 Z" fill={tint('#8a5a2b', c)} {...ln} />
      <path d="M -80 -6 L 80 -6 M -82 -11 L 82 -11" stroke={INK} strokeWidth="1" opacity="0.55" fill="none" />
      <rect x="-52" y="-46" width="104" height="28" rx="2" fill={tint('#c99a5b', c)} {...ln} />
      <path d="M -56 -46 L 0 -58 L 56 -46" fill={tint('#7a4a22', c)} {...ln} />
      <rect x="-12" y="-38" width="24" height="16" rx="2" fill={c.night ? '#f2b45a' : '#e8b84a'} {...ln} />
      <rect x="34" y="-58" width="7" height="14" fill={tint('#4a3a2a', c)} {...ln} />
      <circle cx={38 + smoke} cy="-64" r="4" fill={tint('#d8d0c8', c)} opacity="0.55" />
      <circle cx={42 + smoke * 1.4} cy="-70" r="5.5" fill={tint('#d8d0c8', c)} opacity="0.35" />
      <circle cx="-38" cy="-30" r="3.5" fill="#f2b45a" stroke={INK} strokeWidth="1.2" />
      <path d="M 92 -8 L 128 -22" stroke={INK} strokeWidth="1.2" fill="none" opacity="0.8" />
      <path d="M -70 -18 L 70 -18" stroke={INK} strokeWidth="1" opacity="0.5" fill="none" />
    </g>
  );
};
const PacketCabin = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-46" y="-34" width="92" height="34" rx="2" fill={tint('#c99a5b', c)} {...ln} />
    <path d="M -50 -34 L 0 -46 L 50 -34" fill={tint('#7a4a22', c)} {...ln} />
    <rect x="-10" y="-26" width="20" height="14" rx="2" fill={c.night ? '#f2b45a' : '#cfd6cc'} {...ln} />
    <rect x="22" y="-24" width="10" height="24" fill="#4a362a" {...ln} />
  </g>
);
const LockGate = ({x, y, s = 1, c}: any) => {
  const waterY = Math.sin(c.f / 90 + x) * 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-92" y="-52" width="34" height="52" fill={tint('#8a8578', c)} {...ln} />
      <path d="M -92 -38 L -58 -38 M -92 -24 L -58 -24 M -75 -52 L -75 0" stroke={INK} strokeWidth="1" opacity="0.5" fill="none" />
      <rect x="58" y="-52" width="34" height="52" fill={tint('#8a8578', c)} {...ln} />
      <path d="M 58 -38 L 92 -38 M 58 -24 L 92 -24 M 75 -52 L 75 0" stroke={INK} strokeWidth="1" opacity="0.5" fill="none" />
      <rect x="-58" y="-38" width="58" height="38" fill={tint('#8a5a2b', c)} {...ln} />
      <path d="M -58 -38 L 0 0 M -40 -38 L -40 0 M -20 -38 L -20 0" stroke={INK} strokeWidth="1.2" opacity="0.6" fill="none" />
      <circle cx="-52" cy="-32" r="2" fill={INK} />
      <circle cx="-52" cy="-6" r="2" fill={INK} />
      <rect x="0" y="-38" width="58" height="38" fill={tint('#7a4a22', c)} {...ln} />
      <path d="M 0 0 L 58 -38 M 20 -38 L 20 0 M 40 -38 L 40 0" stroke={INK} strokeWidth="1.2" opacity="0.6" fill="none" />
      <circle cx="52" cy="-32" r="2" fill={INK} />
      <circle cx="52" cy="-6" r="2" fill={INK} />
      <rect x="-58" y={-6 + waterY} width="116" height="6" fill={tint('#6a8a7a', c)} opacity="0.7" />
      <circle cx="-82" cy="-48" r="5" fill={tint('#7a7a4a', c)} opacity="0.6" />
      <circle cx="82" cy="-48" r="5" fill={tint('#7a7a4a', c)} opacity="0.6" />
      <circle cx="-70" cy="-56" r="3" fill="#f2b45a" stroke={INK} strokeWidth="1" />
    </g>
  );
};
const StoneLock = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-80" y="-48" width="160" height="48" fill={tint('#8a8578', c)} {...ln} />
    <path d="M -80 -32 L 80 -32 M -80 -16 L 80 -16 M -40 -48 L -40 0 M 0 -48 L 0 0 M 40 -48 L 40 0" stroke={INK} strokeWidth="1" opacity="0.5" fill="none" />
    <circle cx="-60" cy="-44" r="5" fill={tint('#7a7a4a', c)} opacity="0.55" />
    <circle cx="60" cy="-44" r="5" fill={tint('#7a7a4a', c)} opacity="0.55" />
  </g>
);
const StoneAqueduct = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-110" y="-58" width="220" height="10" fill={tint('#8a8578', c)} {...ln} />
    <rect x="-110" y="-48" width="220" height="28" fill={tint('#8a8578', c)} {...ln} />
    <path d="M -110 -34 L 110 -34" stroke={INK} strokeWidth="1" opacity="0.5" fill="none" />
    <g fill={tint('#6a8a7a', c)} stroke={INK} strokeWidth="2">
      <path d="M -88 -20 A 18 20 0 0 1 -52 -20 L -52 -20 L -88 -20 Z" />
      <path d="M -18 -20 A 18 20 0 0 1 18 -20 L 18 -20 L -18 -20 Z" />
      <path d="M 52 -20 A 18 20 0 0 1 88 -20 L 88 -20 L 52 -20 Z" />
    </g>
    <rect x="-110" y="-20" width="22" height="20" fill={tint('#7a7568', c)} {...ln} />
    <rect x="-22" y="-20" width="22" height="20" fill={tint('#7a7568', c)} {...ln} />
    <rect x="22" y="-20" width="22" height="20" fill={tint('#7a7568', c)} {...ln} />
    <rect x="88" y="-20" width="22" height="20" fill={tint('#7a7568', c)} {...ln} />
  </g>
);
const TowpathHorse = ({x, y, s = 1, c}: any) => {
  const head = Math.sin(c.f / 55 + x) * 1.2;
  const tail = Math.sin(c.f / 55 + x + 1) * 1.5;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="-18" rx="26" ry="12" fill={tint('#4a3a2a', c)} {...ln} />
      <path d="M 20 -22 L 32 -30 L 36 -24 L 26 -14 Z" fill={tint('#4a3a2a', c)} {...ln} transform={`translate(0 ${head})`} />
      <path d="M -16 -10 L -16 0 M -6 -10 L -6 0 M 8 -10 L 8 0 M 18 -10 L 18 0" stroke={INK} strokeWidth="2" fill="none" />
      <path d="M -26 -20 Q -32 -10 -30 0" stroke={INK} strokeWidth="2" fill="none" transform={`translate(${tail} 0)`} />
      <path d="M -40 0 L 40 0" stroke={INK} strokeWidth="1" opacity="0.4" fill="none" />
    </g>
  );
};
const Towpath = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-110" y="-4" width="220" height="8" fill={tint('#c9b88a', c)} {...ln} />
    <path d="M -110 -4 L 110 -4" stroke={INK} strokeWidth="1" opacity="0.5" fill="none" />
  </g>
);
const SaltWorks = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="-52" cy="-6" rx="26" ry="10" fill={tint('#f2efe6', c)} {...ln} />
    <ellipse cx="0" cy="-8" rx="30" ry="12" fill={tint('#f2efe6', c)} {...ln} />
    <ellipse cx="52" cy="-6" rx="26" ry="10" fill={tint('#f2efe6', c)} {...ln} />
    <rect x="-70" y="-38" width="44" height="28" fill={tint('#8a8578', c)} {...ln} />
    <path d="M -74 -38 L -48 -48 L -22 -38" fill={tint('#5a4a32', c)} {...ln} />
    <path d="M 68 -36 L 78 0" stroke={INK} strokeWidth="1.5" fill="none" />
  </g>
);

const GLOW = '#f6c86a';
const flick = (c: any, k: number) => 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(c.f * 0.4 + k * 2.1));
const stroke = (w: number) => ({stroke: INK, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const});
const PaperLantern = ({ x, y, r = 5, c, k = 0 }: { x: number; y: number; r?: number; c: any; k?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r * 2.4} fill={GLOW} opacity={0.16 * flick(c, k)} />
    <ellipse rx={r} ry={r * 1.15} fill={tint(GLOW, c)} {...stroke(1)} />
    <line x1={0} y1={-r * 1.15} x2={0} y2={-r * 1.15 - 4} {...stroke(1)} />
  </g>
);


// ---------- Northern halls pack (2026-11-13): long halls, long ships, carved stones, shore jetties ----------
// Drawn at 0,0 = feet, s = scale. Motion is SLOW: sin(c.f / N) only. No random, no clock, no faces, no text.
const Longhouse = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-180 0 L-180 -66 Q0 -92 180 -66 L180 0Z" fill={tint('#6e5136', c)} {...ln} />
    <path d="M-198 -60 Q0 -116 198 -60 L170 -34 Q0 -80 -170 -34Z" fill={tint('#5c6e3e', c)} {...ln} />
    <path d="M-190 -62 L-216 -102 M190 -62 L216 -102" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    <path d="M-22 0 L-22 -42 Q0 -54 22 -42 L22 0Z" fill={c.night ? '#e9a24a' : '#2e211a'} {...ln} />
    {[-124, -66, 66, 124].map((wx) => <rect key={wx} x={wx - 9} y="-50" width="18" height="16" fill={c.night ? '#f2c063' : '#4a3a2c'} {...ln} />)}
  </g>
);
const Longship = ({x, y, s = 1, c}: any) => {
  const bob = Math.sin(c.f / 45 + x) * 3;
  return <g transform={`translate(${x} ${y + bob}) scale(${s})`}>
    <path d="M-148 -8 Q-152 -44 -124 -66 Q-116 -38 -102 -24 L102 -24 Q118 -40 124 -68 Q152 -44 148 -8 Q0 12 -148 -8Z" fill={tint('#7a5638', c)} {...ln} />
    <path d="M-146 -34 Q-162 -56 -142 -74 Q-126 -86 -116 -70 Q-110 -58 -122 -52" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
    <path d="M0 -26 V-152" stroke={INK} strokeWidth="5" />
    {Array.from({length: 8}, (_, i) => <rect key={i} x={-64 + i * 16} y="-148" width="16" height="54" fill={tint(i % 2 ? '#e6dcc0' : '#b8493a', c)} />)}
    <rect x="-64" y="-148" width="128" height="54" fill="none" {...ln} />
    {[-100, -60, -20, 20, 60, 100].map((sx, i) => <circle key={sx} cx={sx} cy="-30" r="10" fill={tint(i % 2 ? '#c9a227' : '#8a4a3a', c)} {...ln} />)}
  </g>;
};
const Runestone = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-26 0 L-30 -82 Q0 -106 30 -82 L26 0Z" fill={tint('#9b958a', c)} {...ln} />
    <path d="M-13 -76 Q11 -58 -7 -38 Q-19 -24 -5 -11" fill="none" stroke={tint('#7c766b', c)} strokeWidth="4" strokeLinecap="round" />
    {[-62, -46, -30].map((ry) => <path key={ry} d={`M9 ${ry} l10 -8 M9 ${ry} l10 6`} stroke={tint('#7c766b', c)} strokeWidth="2.6" strokeLinecap="round" fill="none" />)}
  </g>
);
const Jetty = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[-120, -60, 0, 60, 120].map((px) => <path key={px} d={`M${px} -6 V26`} stroke={INK} strokeWidth="6" />)}
    <path d="M-150 -12 H150 V-2 H-150Z" fill={tint('#7a5638', c)} {...ln} />
    <path d="M138 -12 V-42" stroke={INK} strokeWidth="6" /><circle cx="138" cy="-46" r="6" fill={tint('#5c4028', c)} {...ln} />
  </g>
);
// ---------- Mythology pack (2026-11-14): the great tree, the rainbow span, the hall of the slain, the world serpent ----------
// Drawn at 0,0 = feet, s = scale. Motion is SLOW: sin(c.f / N) only. No random, no clock, no faces, no text.
const WorldTree = ({x, y, s = 1, c}: any) => {
  const sway = Math.sin(c.f / 110 + x) * 4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[-190, -96, 0, 96, 190].map((rx, i) => <path key={i} d={`M0 -18 Q${rx * 0.5} ${6 + Math.abs(rx) * 0.04} ${rx} 2`} fill="none" stroke={tint('#5d4630', c)} strokeWidth={13 - Math.abs(i - 2) * 1.6} strokeLinecap="round" />)}
      <path d="M-34 0 C-26 -120 -20 -240 -14 -330 L16 -330 C22 -230 28 -110 34 0Z" fill={tint('#6b4f33', c)} {...ln} />
      {[-150, -88, 96, 158].map((bx, i) => <path key={i} d={`M0 ${-300 - (i % 2) * 26} Q${bx * 0.55} ${-356 - (i % 2) * 20} ${bx + sway} ${-392 - (i % 2) * 26}`} fill="none" stroke={tint('#5d4630', c)} strokeWidth="10" strokeLinecap="round" />)}
      <g transform={`translate(${sway} 0)`}>
        {[[-168, -428, 86], [-84, -462, 104], [10, -478, 118], [104, -452, 100], [172, -416, 78], [-30, -428, 92], [62, -420, 84]].map(([a, b, rr], i) => <circle key={i} cx={a} cy={b} r={rr} fill={tint(['#5d7346', '#546b40', '#667c4c'][i % 3], c)} {...ln} />)}
        {c.night && [[-120, -440], [-30, -486], [70, -452], [140, -408], [0, -420]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="3.2" fill="#f6e58a" opacity={0.35 + 0.3 * Math.sin(c.f / 34 + i * 2)} style={{mixBlendMode: 'screen'}} />)}
      </g>
    </g>
  );
};
const RainbowBridge = ({x, y, s = 1, c}: any) => {
  const cols = ['#c65a4a', '#d98a4a', '#e3c05e', '#7d9a58', '#5d84a8'];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={0.92}>
      {cols.map((col, i) => <path key={i} d={`M-330 0 Q0 ${-330 - i * 17} 330 0 L330 ${-16 - i * 2} Q0 ${-300 - i * 17} -330 ${-16 - i * 2}Z`} fill={tint(col, c)} opacity={0.5 + 0.05 * Math.sin(c.f / 80 + i)} />)}
      {[-330, 330].map((ex, i) => <ellipse key={i} cx={ex} cy="2" rx="42" ry="9" fill={tint('#cfd4d8', c)} opacity="0.7" />)}
    </g>
  );
};
const GreatHall = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-215" y="-118" width="430" height="118" fill={tint('#6e5136', c)} {...ln} />
    <path d="M-248 -108 L0 -268 L248 -108 L216 -84 L0 -226 L-216 -84Z" fill={tint('#54603c', c)} {...ln} />
    {[-196, -98, 98, 196].map((px, i) => <g key={i}><path d={`M${px} -226 L${px} -20`} stroke={INK} strokeWidth="4" opacity="0.55" />{i % 2 === 0 && <path d={`M${px} -232 q${px < 0 ? -20 : 20} -22 ${px < 0 ? -40 : 40} -10`} fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />}</g>)}
    <path d="M-215 -118 H215" stroke={INK} strokeWidth="4" opacity="0.6" />
    <path d="M-34 0 L-34 -104 Q0 -124 34 -104 L34 0Z" fill={c.night ? '#e9a24a' : '#2e211a'} {...ln} />
    <path d="M0 -124 V0" stroke={INK} strokeWidth="3" opacity="0.6" />
    {[-168, -118, 118, 168].map((wx) => <rect key={wx} x={wx - 13} y="-88" width="26" height="30" fill={c.night ? '#f2c063' : '#4a3a2c'} {...ln} />)}
    {[-70, 70].map((fx2) => <g key={fx2} transform={`translate(${fx2} -58)`}><path d="M0 26 V-8" stroke={INK} strokeWidth="3" /><path d={`M0 -8 C-9 -26 -3 -36 0 -48 C3 -36 9 -26 0 -8Z`} fill={tint('#e08a3c', c)} opacity={0.75 + 0.2 * Math.sin(c.f * 0.4 + fx2)} /></g>)}
  </g>
);
const WorldSerpent = ({x, y, s = 1, c}: any) => {
  const bob = Math.sin(c.f / 65 + x) * 4;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s})`}>
      {[-190, 0, 190].map((hx, i) => <path key={i} d={`M${hx - 105} 6 Q${hx} ${-118 - (i === 1 ? 22 : 0)} ${hx + 105} 6 L${hx + 84} 6 Q${hx} ${-84 - (i === 1 ? 18 : 0)} ${hx - 84} 6Z`} fill={tint('#5d7355', c)} {...ln} />)}
      <g transform={`translate(268 ${-58 + Math.sin(c.f / 50) * 3})`}>
        <path d="M-58 58 C-46 6 -16 -34 26 -46 L58 -38 C30 -18 16 8 12 40 C8 62 -30 70 -58 58Z" fill={tint('#5d7355', c)} {...ln} />
        {[-30, -14, 4, 22].map((o, i) => <path key={i} d={`M${o} ${-40 + Math.abs(o) * 0.3} L${o + 6} ${-58 + Math.abs(o) * 0.3} L${o + 12} ${-40 + Math.abs(o) * 0.3}Z`} fill={tint('#8fae7a', c)} stroke={INK} strokeWidth="1.2" />)}
        <circle cx="34" cy="-34" r="4.4" fill={INK} />
        <path d="M44 -22 q14 4 20 14 M44 -22 q16 -2 24 6" stroke={tint('#b8493a', c)} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
      <path d="M-316 4 q-22 -26 -8 -52 q20 14 22 40 q1 12 -14 12Z" fill={tint('#5d7355', c)} {...ln} />
    </g>
  );
};
const Ravens = ({x, y, s = 1, c}: any) => {
  const bird = (bx: number, by: number, flip: number, ph: number) => (
    <g transform={`translate(${bx} ${by}) scale(${flip} 1)`}>
      <ellipse cx="0" cy="-8" rx="17" ry="10" fill={tint('#23242c', c)} {...ln} />
      <g transform={`rotate(${Math.sin(c.f / 80 + ph) * 5} 13 -16)`}><circle cx="14" cy="-17" r="7.5" fill={tint('#23242c', c)} {...ln} /><path d="M20 -18 L32 -14 L20 -11Z" fill={tint('#3a3a40', c)} {...ln} /></g>
      <path d="M-15 -6 L-30 2 L-16 3 L-28 9 L-12 8Z" fill={tint('#23242c', c)} {...ln} />
      <path d="M-3 1 V9 M5 1 V9" stroke={INK} strokeWidth="1.8" />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-84 0 L66 -104" stroke={tint('#4a3a2c', c)} strokeWidth="7" strokeLinecap="round" />
      <path d="M8 -58 L44 -84 M-30 -30 L-58 -52" stroke={tint('#4a3a2c', c)} strokeWidth="4" strokeLinecap="round" />
      {bird(-6, -66, 1, 0)}
      {bird(34, -102, -1, 2.4)}
    </g>
  );
};
const GreatWolf = ({x, y, s = 1, c}: any) => {
  const tail = Math.sin(c.f / 70 + x) * 4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={`M-96 -64 Q-132 ${-78 + tail} -140 ${-52 + tail}`} fill="none" stroke={tint('#5a6470', c)} strokeWidth="13" strokeLinecap="round" />
      <ellipse cx="-8" cy="-72" rx="86" ry="34" fill={tint('#5a6470', c)} {...ln} />
      {[-58, -30, 34, 60].map((lx, i) => <path key={i} d={`M${lx} -52 L${lx + (i % 2 ? 3 : -3)} 0`} stroke={tint('#4c5661', c)} strokeWidth="11" strokeLinecap="round" />)}
      <g transform={`translate(84 -96)`}>
        <path d="M-16 -18 L-10 -44 L4 -20 L20 -40 L24 -12 Q44 2 40 18 L34 30 L-8 28 Q-24 6 -16 -18Z" fill={tint('#5a6470', c)} {...ln} />
        <path d="M30 22 L58 28 L30 32Z" fill={tint('#4c5661', c)} {...ln} />
        <circle cx="18" cy="2" r="3.6" fill={INK} />
        <path d="M-20 26 q30 10 62 2" stroke={tint('#8a4a3a', c)} strokeWidth="3" fill="none" opacity="0.65" />
      </g>
      <path d="M-70 -98 q40 -16 84 -6" stroke={tint('#6c7885', c)} strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.7" />
    </g>
  );
};
const Well = ({x, y, s = 1, c}: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="-6" rx="58" ry="15" fill={tint('#8f897e', c)} {...ln} />
    <ellipse cx="0" cy="-10" rx="44" ry="10" fill={tint('#5d7d8c', c)} opacity="0.9" />
    <ellipse cx={-12 + Math.sin(c.f / 60) * 3} cy="-11" rx="13" ry="3" fill="#eef2ea" opacity="0.5" />
    {[-46, 46].map((px) => <rect key={px} x={px - 4} y="-86" width="8" height="80" fill={tint('#6b5040', c)} {...ln} />)}
    <path d="M-62 -80 L0 -106 L62 -80 L52 -68 L0 -90 L-52 -68Z" fill={tint('#5c6e3e', c)} {...ln} />
    <path d="M0 -88 V-44" stroke={INK} strokeWidth="2.4" />
    <path d="M-11 -44 h22 l-3 20 h-16Z" fill={tint('#7a5638', c)} {...ln} />
    {[-70, 74].map((rx, i) => <ellipse key={i} cx={rx} cy="-2" rx="15" ry="6" fill={tint('#9b958a', c)} {...ln} />)}
  </g>
);
const Stag = ({x, y, s = 1, c}: any) => {
  const bob = Math.sin(c.f / 75 + x) * 1.6;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="-66" rx="56" ry="24" fill={tint('#7d5f42', c)} {...ln} />
      {[-38, -22, 24, 40].map((lx, i) => <path key={i} d={`M${lx} -52 L${lx + (i % 2 ? 2 : -2)} 0`} stroke={tint('#6e5136', c)} strokeWidth="7" strokeLinecap="round" />)}
      <path d="M-54 -72 q-14 4 -12 16 q10 4 16 -4Z" fill={tint('#7d5f42', c)} {...ln} />
      <g transform={`translate(52 ${-96 + bob})`}>
        <path d="M-8 26 C-2 4 8 -12 24 -20 L34 -8 C20 0 12 12 8 30Z" fill={tint('#7d5f42', c)} {...ln} />
        <ellipse cx="36" cy="-12" rx="15" ry="9" fill={tint('#7d5f42', c)} {...ln} transform="rotate(18 36 -12)" />
        <circle cx="40" cy="-14" r="2.8" fill={INK} />
        {[-1, 1].map((sd) => <g key={sd} transform={`translate(${26 + sd * 7} -22) scale(${sd} 1)`}><path d="M0 0 C-2 -16 2 -28 12 -38 M4 -14 C10 -18 16 -18 21 -24 M6 -26 C12 -28 15 -33 17 -39" fill="none" stroke={tint('#5d4630', c)} strokeWidth="3.4" strokeLinecap="round" /></g>)}
      </g>
    </g>
  );
};
const THINGS: Record<string, any> = {campfire: Campfire, hut: Hut, cabin: Cabin, tent: Tent, tree: Tree, pine: (p: any) => <Tree {...p} k="pine" />, palm: (p: any) => <Tree {...p} k="palm" />, rocks: Rocks, cairn: Cairn, pyramid: Pyramid, lighthouse: Lighthouse, castle: Castle, boat: Boat, lantern: Lantern, herd: Herd, person: Person, lying: Lying, CanalBoat: CanalBoat, LockGate: LockGate, StoneLock: StoneLock, StoneAqueduct: StoneAqueduct, TowpathHorse: TowpathHorse, Towpath: Towpath, SaltWorks: SaltWorks, PacketCabin: PacketCabin, temple: Temple, pillar: Pillar, throne: Throne, bolt: Bolt, trident: Trident, serpent: Serpent, wave: Wave, chariot: Chariot, aurafigure: AuraFigure, winged: Winged, warrior: Warrior, giant: Giant, stall: Stall, archbridge: ArchBridge, tiertower: TierTower, lanternstring: LanternString, willow: Willow, gate: Gate, shopfront: Shopfront, punt: Punt, bamboo: Bamboo, pavilion: Pavilion, lookout: Lookout, longhouse: Longhouse, longship: Longship, runestone: Runestone, jetty: Jetty, worldtree: WorldTree, rainbowbridge: RainbowBridge, greathall: GreatHall, worldserpent: WorldSerpent, ravens: Ravens, greatwolf: GreatWolf, well: Well, stag: Stag};
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
  const trees = L.trees === 'none' ? 0 : L.trees === 'few' ? 4 : L.trees === 'palm' ? 3 : (L.trees === 'broad' || L.trees === 'olive') ? 8 : 16;
  return (
    <g>
      <defs>{[['far', farC], ['mid', midC], ['gnd', gndC]].map(([k, col]) => <linearGradient key={k} id={`lg-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={mix(col, c.pal.b, k === 'far' ? 0.3 : 0.22)} /><stop offset="0.6" stopColor={col} /><stop offset="1" stopColor={mix(col, '#3a3320', 0.12)} /></linearGradient>)}</defs>
      <path d={ridgePath(far)} fill="url(#lg-far)" {...ln} strokeWidth={1.4} opacity="0.95" />
      {L.peaks && <path d={ridgePath((x) => far(x) - 60 + 40 * Math.sin(x / 90))} fill="#eef0ee" opacity="0.5" />}
      {L.water === 'sea' && <g><rect x="-80" y={horizon} width={W + 160} height={H - horizon} fill={tint('#8fa9a8', c)} />{Array.from({length: 46}, (_, i) => { const y = horizon + 14 + (i * 11.7) % (H - horizon - 20), x = (i * 331 + f * (0.15 + (i % 5) * 0.05)) % (W + 100) - 50; return <path key={i} d={`M${x} ${y} q14 -8 28 0 q14 8 28 0`} fill="none" stroke={mix('#ffffff', tint('#8fa9a8', c), 0.3)} strokeWidth="2" opacity="0.7" />; })}</g>}
      {L.stacks && <g>{[0, 1, 2].map((i) => { const sx2 = 240 + r() * (W - 480), sy2 = horizon + 200 + r() * 150, w2 = 34 + r() * 34, h2 = 80 + r() * 100; return <path key={i} d={`M${sx2 - w2} ${sy2} C${sx2 - w2 * 0.7} ${sy2 - h2 * 0.5} ${sx2 - w2 * 0.34} ${sy2 - h2 * 0.8} ${sx2 - w2 * 0.2} ${sy2 - h2} L${sx2 + w2 * 0.3} ${sy2 - h2 * 0.94} C${sx2 + w2 * 0.6} ${sy2 - h2 * 0.55} ${sx2 + w2 * 0.9} ${sy2 - h2 * 0.3} ${sx2 + w2} ${sy2}Z`} fill={tint('#8f897e', c)} {...ln} />; })}</g>}
      {L.water !== 'sea' && <path d={ridgePath(mid)} fill="url(#lg-mid)" {...ln} />}
      {L.water === 'lake' && <ellipse cx={W * 0.5} cy={horizon + 120} rx="520" ry="46" fill={tint('#9db5bd', c)} {...ln} />}
      {L.water !== 'sea' && <path d={ridgePath(nearR)} fill="url(#lg-gnd)" {...ln} />}
      {L.water === 'river' && <g><path d={river(1.1)} fill={tint('#9db5b8', c)} {...ln} />{Array.from({length: 26}, (_, i) => { const t = 0.15 + ((i * 0.037 + f / 900) % 0.85), y = horizon + 70 + t * t * (H - horizon - 70), x = cx + Math.sin(t * 3.2 + ph) * 260 * t + Math.sin(i * 9) * t * 120; return <path key={i} d={`M${x - 14 * t * 3} ${y} h${28 * t * 3}`} stroke="#f4f0dc" strokeWidth="2" opacity="0.6" />; })}</g>}
      {L.water === 'sea' && <path d={ridgePath((x) => horizon + 330 + 30 * Math.sin(x / 260), H + 40)} fill="url(#lg-gnd)" {...ln} />}
      {L.clouds && <g><rect x="-80" y={horizon + 108} width={W + 160} height={H - horizon} fill={mix('#ffffff', c.pal.b, 0.38)} opacity="0.8" />{[0, 1, 2, 3].map((j) => <g key={j}>{Array.from({length: 7}, (_, i) => { const bx = ((i * 330 + j * 180 + f * (0.22 + j * 0.07)) % (W + 480)) - 240, by = horizon + 126 + j * 92; return <ellipse key={i} cx={bx} cy={by} rx={200 + (i % 3) * 40} ry={46 + j * 5} fill={mix('#ffffff', c.pal.b, 0.3)} opacity={0.5 + j * 0.12} />; })}</g>)}</g>}
      {L.trees !== 'none' && Array.from({length: trees}, (_, i) => { const t = r(), x = r() * W, y = L.water === 'sea' ? horizon + 300 + t * 140 : horizon + 70 + t * 150; return <Tree key={i} x={x} y={y} s={L.water === 'sea' ? 0.7 + t * 0.4 : 0.3 + t * 0.5} c={c} k={L.trees === 'few' ? 'broad' : L.trees} i={i} />; })}
      {!L.clouds && tufts.map(({x, y, i}) => { const sw = Math.sin(f / 36 + i) * 2.5, col = mix(gndC, '#3a3a20', 0.45); return <path key={i} d={`M${x} ${y} q${-4 + sw} -14 ${-8 + sw} -26 M${x} ${y} q${sw} -18 ${2 + sw} -32 M${x} ${y} q${4 + sw} -12 ${9 + sw} -22`} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" />; })}
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
  if (kind === 'portico') return (
    <g>
      <rect x="-20" y="-20" width={W + 40} height="96" fill={mix('#4a3a2c', '#101018', c.night ? 0.5 : 0)} stroke={INK} strokeWidth="3" />
      {[70, 226, W - 226, W - 70].map((px, i) => <g key={i}><rect x={px - 30} y="60" width="60" height={H - 40} fill={mix('#4a3a2c', '#101018', c.night ? 0.5 : 0)} stroke={INK} strokeWidth="3" /><rect x={px - 38} y="60" width="76" height="26" fill={mix('#5d4636', '#101018', c.night ? 0.5 : 0)} {...ln} /><rect x={px - 38} y={H - 66} width="76" height="30" fill={mix('#5d4636', '#101018', c.night ? 0.5 : 0)} {...ln} /></g>)}
      <rect x="-20" y={H - 36} width={W + 40} height="56" fill={mix('#4a3a2c', '#101018', c.night ? 0.5 : 0)} />
    </g>
  );
  if (kind === 'lattice') return (
    <g>
      <path d={out + hole} fillRule="evenodd" fill={mix('#4a362a', '#101018', c.night ? 0.5 : 0)} stroke={INK} strokeWidth="3" />
      {Array.from({length: 9}, (_, i) => <path key={`v${i}`} d={`M${410 + i * 137.5} 90 V860`} stroke="#3a2a22" strokeWidth="9" />)}
      {Array.from({length: 6}, (_, i) => <path key={`h${i}`} d={`M410 ${90 + i * 154} H1510`} stroke="#3a2a22" strokeWidth="9" />)}
      {Array.from({length: 9}, (_, i) => <path key={`d${i}`} d={`M${410 + i * 137.5} 90 L${410 + i * 137.5 + 220} 860 M${410 + i * 137.5} 90 L${410 + i * 137.5 - 220} 860`} stroke="#3a2a22" strokeWidth="3.4" opacity="0.8" />)}
      <path d="M380 860 H1540 V920 H380Z" fill="#6b4c36" {...ln} />
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
      {fx.includes('rays') && <g style={{mixBlendMode: 'screen'}}>{[0, 1, 2, 3].map((i) => { const ox = W * 0.76 + i * 30, spread = 130 + i * 60; return <path key={i} d={`M${ox} -20 L${ox + spread} -20 L${ox - 260 - i * 90} ${H * 0.92} L${ox - 330 - i * 90} ${H * 0.92}Z`} fill="#fff3c4" opacity={0.05 + 0.014 * i + 0.01 * Math.sin(f / 90 + i)} />; })}</g>}
      {fx.includes('bolts') && <g>{[0, 1].map((i) => { const bx = 260 + r() * (W - 520), op = 0.05 + 0.11 * Math.max(0, Math.sin(f / 160 + i * 2.4)); let d = `M${bx} 40`, yy = 40, xx = bx; for (let k = 0; k < 5; k++) { yy += 52 + r() * 30; xx += (r() - 0.5) * 90; d += ` L${xx.toFixed(0)} ${yy.toFixed(0)}`; } return <path key={i} d={d} fill="none" stroke="#eef2ff" strokeWidth="3.2" opacity={op} strokeLinejoin="round" />; })}</g>}
      {fx.includes('sparks') && Array.from({length: 22}, (_, i) => { const sx = (r() * W + Math.sin(f / 70 + i * 2) * 16 + W) % W, sy = 940 - ((r() * 560 + f * (0.35 + r() * 0.3)) % 580); return <circle key={i} cx={sx} cy={sy} r={1.8 + r() * 1.8} fill={i % 3 ? '#f6b04a' : '#fbe58a'} opacity={0.35 + 0.4 * Math.max(0, Math.sin(f / 34 + i * 3))} style={{mixBlendMode: 'screen'}} />; })}
      {fx.includes('steam') && Array.from({length: 12}, (_, i) => { const t = ((f / 4 + i * 15) % 150) / 150, bx = (spec.smokeX ?? 0.5) * W; return <circle key={i} cx={bx + Math.sin(t * 5 + i) * 22 + t * 30} cy={800 - t * 300} r={12 + t * 46} fill="#f2efe8" opacity={0.2 * (1 - t)} />; })}
      {fx.includes('petals') && Array.from({length: 36}, (_, i) => { const px = (r() * W + f * 0.5 + Math.sin(f / 60 + i) * 22) % W, py = (r() * H + f * (0.7 + r() * 0.5)) % H; return <ellipse key={i} cx={px} cy={py} rx={3.4 + r() * 2} ry={2.2 + r() * 1.4} fill="#eec9c4" opacity="0.75" transform={`rotate(${f / 3 + i * 40} ${px} ${py})`} />; })}
      {fx.includes('lights') && <g>{[0, 1, 2].map((j) => <g key={j}>{Array.from({length: 16}, (_, i) => { const lx = 120 + i * 112, ly = 250 + j * 130 + Math.sin((i / 15) * Math.PI) * 26, tw = 0.55 + 0.35 * Math.sin(f / 34 + i + j * 3); return <g key={i}><circle cx={lx} cy={ly} r="9" fill="#f6c86a" opacity={0.13 + 0.05 * Math.sin(f / 34 + i + j * 3)} style={{mixBlendMode: 'screen'}} /><circle cx={lx} cy={ly} r="3" fill="#f6c86a" opacity={tw} /></g>; })}</g>)}</g>}
      {fx.includes('aurora') && <g style={{mixBlendMode: 'screen'}}>{[0, 1, 2].map((j) => { const yb = 70 + j * 95; const top = Array.from({length: 25}, (_, i) => { const px = -100 + i * 88; return `${i ? 'L' : 'M'}${px} ${(yb + Math.sin(px / 300 + f / 120 + j * 1.7) * 34).toFixed(0)}`; }).join(' '); const bot = Array.from({length: 25}, (_, k) => { const i = 24 - k, px = -100 + i * 88; return `L${px} ${(yb + 165 + Math.sin(px / 340 + f / 140 + j * 1.7) * 24).toFixed(0)}`; }).join(' '); return <path key={j} d={top + ' ' + bot + ' Z'} fill={j % 2 ? '#4ad8c2' : '#7fe8b0'} opacity={0.09 + 0.03 * Math.sin(f / 70 + j * 2)} />; })}</g>}
      {fx.includes('ashfall') && Array.from({length: 80}, (_, i) => { const x = (r() * W + Math.sin(f / 80 + i) * 26 + W) % W, y = (r() * H + f * (0.45 + r() * 0.3)) % H; return <circle key={i} cx={x} cy={y} r={1.6 + r() * 2.2} fill="#c9c2b4" opacity={0.34 + 0.2 * Math.sin(f / 44 + i * 2)} />; })}
    </g>
  );
};

export const Scene: React.FC<{spec: Spec; frame: number; fps: number; p: number}> = ({spec, frame, fps, p}) => {
  const s = {seed: 'x', sky: 'day', land: 'valley', ...spec};
  const pal = SKY[s.sky] ?? SKY.day, land = LAND[s.land] ?? LAND.valley;
  const c: Ctx = {pal, f: frame, fps, r: rng(hash(String(s.seed))), land, night: !!pal.night};
  const boil = Math.floor((frame * 6) / fps) % 6;
  const cam = s.cam ?? 'in', v = s.view ?? {}, z = (v.z ?? 1.06) * (1 + 0.035 * (cam === 'out' ? 1 - p : cam === 'in' ? p : 0.5));
  const fx = Math.min(Math.max(v.x ?? 0.5, 0.5 / z + 0.01), 1 - 0.5 / z - 0.01), fy = Math.min(Math.max(v.y ?? 0.5, 0.5 / z + 0.01), 1 - 0.5 / z - 0.01);
  const px = cam === 'left' ? (0.5 - p) * 30 : cam === 'right' ? (p - 0.5) * 30 : 0, py = cam === 'up' ? (0.5 - p) * 20 : 0;
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
      <g transform={`translate(${W / 2} ${H / 2}) scale(${z}) translate(${-(fx * W + px)} ${-(fy * H + py)})`}>
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
