// ───────────────────────────────────────────────────────────────────────────
// art.additions.tsx — 11 new props, 2 new lands, 1 new frame, 3 new effects.
// PASTE BLOCK for src/r/art.tsx (put the props next to Campfire).
//
// Conventions used (taken from the engine notes): origin (0,0) is the thing's
// feet, `s` is the scale, `tint(colour, c)` lights a colour for the current
// sky, `c.f` is the frame number, no Math.random, no Date. Names are neutral
// because the repo is public.
//
// NOT TESTED against your repo: your art.tsx was not available to me. The
// props only rely on `tint` and `c.f`. The lands, frame and effects
// (bottom of the file) must be adapted to the signature your existing
// 'coast' / 'valley' / 'mist' entries use: copy their structure, keep my shapes.
// Base size: a prop at scale 1 is about 70 units tall; change U if yours differ.
// ───────────────────────────────────────────────────────────────────────────

const U = 1;
const INK = "#3a2d28";
const stroke = (w = 1.4) => ({
  stroke: INK,
  strokeWidth: w,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
});
const flick = (c: any, k = 0) => 0.86 + 0.14 * Math.sin((c.f + k * 7) / 4);
const sway = (c: any, k = 0, amp = 1) => Math.sin((c.f + k * 11) / 22) * amp;

const WOOD = "#7a5640";
const WOOD_DK = "#58392b";
const ROOF = "#4b3b3a";
const PLASTER = "#d9c9a8";
const RED = "#a8442f";
const GLOW = "#f2b45a";
const LEAF = "#6f8f4e";

// Roof with upturned corners, centred on x=0, base at y=0, height h, width w.
const roofPath = (w: number, h: number) =>
  `M ${-w / 2 - 8} -6 Q ${-w / 2} 0 ${-w / 2 + 6} 0 L ${w / 2 - 6} 0 Q ${w / 2} 0 ${w / 2 + 8} -6 ` +
  `Q ${w / 4} ${-h * 0.35} 0 ${-h} Q ${-w / 4} ${-h * 0.35} ${-w / 2 - 8} -6 Z`;

const PaperLantern = ({ x, y, r = 5, c, k = 0 }: { x: number; y: number; r?: number; c: any; k?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r * 2.4} fill={GLOW} opacity={0.16 * flick(c, k)} />
    <ellipse rx={r} ry={r * 1.15} fill={tint(GLOW, c)} {...stroke(1)} />
    <line x1={0} y1={-r * 1.15} x2={0} y2={-r * 1.15 - 4} {...stroke(1)} />
  </g>
);

type PropArgs = { s?: number; c: any };

// 1. stall: market stall with striped awning, counter and hanging goods
export const Stall = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    <rect x={-22} y={-8} width={44} height={8} fill={tint(WOOD, c)} {...stroke()} />
    <line x1={-20} y1={-8} x2={-20} y2={-46} {...stroke(2)} />
    <line x1={20} y1={-8} x2={20} y2={-46} {...stroke(2)} />
    <path d="M -26 -46 L 26 -46 L 22 -36 L -22 -36 Z" fill={tint(RED, c)} {...stroke()} />
    {[-16, -6, 4, 14].map((x) => (
      <rect key={x} x={x} y={-46} width={5} height={10} fill={tint(PLASTER, c)} opacity={0.9} />
    ))}
    <ellipse cx={-10} cy={-12} rx={6} ry={3} fill={tint("#e2b46a", c)} {...stroke(1)} />
    <ellipse cx={6} cy={-12} rx={7} ry={3} fill={tint("#c97b5a", c)} {...stroke(1)} />
    <PaperLantern x={0} y={-30} r={4} c={c} k={2} />
  </g>
);

// 2. archbridge: humped stone bridge with a low parapet
export const ArchBridge = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    <path d="M -60 0 L -60 -10 Q 0 -52 60 -10 L 60 0 Z" fill={tint("#b9b3a4", c)} {...stroke()} />
    <path d="M -34 0 Q 0 -30 34 0 Z" fill={tint("#2d3a45", c)} opacity={0.85} />
    <path d="M -60 -14 Q 0 -58 60 -14" fill="none" {...stroke(2)} />
    {[-40, -20, 0, 20, 40].map((x) => (
      <line key={x} x1={x} y1={-14 - (1 - (x / 60) ** 2) * 34} x2={x} y2={-8 - (1 - (x / 60) ** 2) * 30} {...stroke(1.2)} />
    ))}
    <rect x={-3} y={-60} width={6} height={10} fill={tint(WOOD_DK, c)} {...stroke(1)} />
    <PaperLantern x={0} y={-64} r={3.6} c={c} k={4} />
  </g>
);

// 3. tiertower: slender tower of stacked curved roofs
export const TierTower = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    {[0, 1, 2, 3, 4].map((i) => {
      const w = 34 - i * 5;
      const y = -i * 16;
      return (
        <g key={i} transform={`translate(0 ${y})`}>
          <rect x={-w / 2 + 3} y={-12} width={w - 6} height={12} fill={tint(PLASTER, c)} {...stroke(1.1)} />
          <rect x={-2} y={-9} width={4} height={6} fill={tint("#3a2f2b", c)} />
          <path d={roofPath(w + 6, 8)} transform="translate(0 -12)" fill={tint(ROOF, c)} {...stroke(1.1)} />
        </g>
      );
    })}
    <line x1={0} y1={-98} x2={0} y2={-112} {...stroke(1.6)} />
  </g>
);

// 4. lanternstring: two poles with a sagging cord and five lanterns
export const LanternString = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    <line x1={-42} y1={0} x2={-42} y2={-52} {...stroke(2)} />
    <line x1={42} y1={0} x2={42} y2={-52} {...stroke(2)} />
    <path d="M -42 -50 Q 0 -30 42 -50" fill="none" {...stroke(1.1)} />
    {[-28, -14, 0, 14, 28].map((x, i) => {
      const y = -50 + (1 - (x / 42) ** 2) * 18 + 6 + sway(c, i, 0.6);
      return <PaperLantern key={x} x={x} y={y} r={4.6} c={c} k={i} />;
    })}
  </g>
);

// 5. willow: trunk with long, swaying hanging branches
export const Willow = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    <path d="M -3 0 Q -4 -22 0 -40 Q 4 -22 3 0 Z" fill={tint(WOOD_DK, c)} {...stroke()} />
    <ellipse cx={0} cy={-46} rx={26} ry={12} fill={tint(LEAF, c)} {...stroke(1.1)} />
    {[-22, -15, -8, -1, 6, 13, 20].map((x, i) => (
      <path
        key={x}
        d={`M ${x} -44 Q ${x + sway(c, i, 2.5)} -28 ${x + sway(c, i + 3, 3.5)} ${-6 - (i % 3) * 5}`}
        fill="none"
        stroke={tint(LEAF, c)}
        strokeWidth={2}
        strokeLinecap="round"
      />
    ))}
  </g>
);

// 6. gate: timber gate with a curved roof and a round lantern on each side
export const Gate = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    <rect x={-30} y={-44} width={9} height={44} fill={tint(RED, c)} {...stroke()} />
    <rect x={21} y={-44} width={9} height={44} fill={tint(RED, c)} {...stroke()} />
    <rect x={-21} y={-44} width={42} height={44} fill={tint("#2a2320", c)} />
    <rect x={-34} y={-50} width={68} height={7} fill={tint(WOOD_DK, c)} {...stroke()} />
    <path d={roofPath(80, 20)} transform="translate(0 -50)" fill={tint(ROOF, c)} {...stroke()} />
    <PaperLantern x={-17} y={-34} r={5} c={c} k={1} />
    <PaperLantern x={17} y={-34} r={5} c={c} k={5} />
  </g>
);

// 7. shopfront: two-storey wooden shop with upturned eaves and lit windows
export const ShopFront = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    <rect x={-32} y={-52} width={64} height={52} fill={tint(PLASTER, c)} {...stroke()} />
    <rect x={-32} y={-26} width={64} height={3} fill={tint(WOOD_DK, c)} />
    {[-22, 0, 22].map((x, i) => (
      <rect key={x} x={x - 6} y={-48} width={12} height={16} fill={tint(GLOW, c)} opacity={0.75 + 0.25 * flick(c, i)} {...stroke(1)} />
    ))}
    <rect x={-26} y={-20} width={52} height={20} fill={tint("#2f2723", c)} />
    <path d="M -34 -20 L 34 -20 L 30 -12 L -30 -12 Z" fill={tint(RED, c)} {...stroke(1)} />
    <path d={roofPath(76, 18)} transform="translate(0 -52)" fill={tint(ROOF, c)} {...stroke()} />
  </g>
);

// 8. punt: flat, low canal boat with a woven canopy and a bow lantern
export const Punt = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U}) translate(0 ${sway(c, 2, 0.8)})`}>
    <path d="M -38 -4 Q -34 4 -26 4 L 26 4 Q 34 4 40 -8 L 30 -6 L -34 -6 Z" fill={tint(WOOD, c)} {...stroke()} />
    <path d="M -18 -6 Q -18 -26 0 -26 Q 18 -26 18 -6 Z" fill={tint("#a58a58", c)} {...stroke(1.2)} />
    <line x1={-10} y1={-24} x2={-10} y2={-6} {...stroke(0.8)} />
    <line x1={2} y1={-26} x2={2} y2={-6} {...stroke(0.8)} />
    <line x1={34} y1={-6} x2={34} y2={-22} {...stroke(1.2)} />
    <PaperLantern x={34} y={-26} r={3.8} c={c} k={3} />
  </g>
);

// 9. bamboo: five canes with leaf tufts, gently swaying
export const Bamboo = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    {[-12, -6, 0, 7, 13].map((x, i) => {
      const h = 52 + (i % 3) * 8;
      const dx = sway(c, i, 1.6);
      return (
        <g key={x}>
          <path d={`M ${x} 0 Q ${x + dx / 2} ${-h / 2} ${x + dx} ${-h}`} fill="none" stroke={tint("#7da15a", c)} strokeWidth={2.6} strokeLinecap="round" />
          {[0.35, 0.6, 0.85].map((t) => (
            <ellipse key={t} cx={x + dx * t + 5} cy={-h * t} rx={7} ry={1.8} fill={tint(LEAF, c)} transform={`rotate(-20 ${x + dx * t + 5} ${-h * t})`} />
          ))}
        </g>
      );
    })}
  </g>
);

// 10. pavilion: open lake pavilion on stone piles, lantern at each corner
export const Pavilion = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    <rect x={-30} y={-6} width={60} height={6} fill={tint("#8e8a80", c)} {...stroke()} />
    {[-26, -9, 9, 26].map((x) => (
      <rect key={x} x={x - 2} y={-36} width={4} height={30} fill={tint(RED, c)} {...stroke(1)} />
    ))}
    <rect x={-30} y={-40} width={60} height={5} fill={tint(WOOD_DK, c)} {...stroke(1)} />
    <path d={roofPath(74, 20)} transform="translate(0 -40)" fill={tint(ROOF, c)} {...stroke()} />
    <PaperLantern x={-28} y={-30} r={3.4} c={c} k={0} />
    <PaperLantern x={28} y={-30} r={3.4} c={c} k={6} />
  </g>
);

// 11. lookout: small wooden watch post on stilts with a lamp
export const Lookout = ({ s = 1, c }: PropArgs) => (
  <g transform={`scale(${s * U})`}>
    {[-12, 12].map((x) => (
      <line key={x} x1={x} y1={0} x2={x * 0.8} y2={-36} {...stroke(2.2)} />
    ))}
    <line x1={-10} y1={-14} x2={10} y2={-26} {...stroke(1.2)} />
    <line x1={10} y1={-14} x2={-10} y2={-26} {...stroke(1.2)} />
    <rect x={-16} y={-52} width={32} height={16} fill={tint(WOOD, c)} {...stroke()} />
    <rect x={-8} y={-48} width={16} height={9} fill={tint(GLOW, c)} opacity={0.7 + 0.3 * flick(c, 2)} />
    <path d={roofPath(40, 12)} transform="translate(0 -52)" fill={tint(ROOF, c)} {...stroke()} />
  </g>
);

// Register next to the existing entries (THINGS is the engine's name→component map):
//   THINGS.stall = Stall;  THINGS.archbridge = ArchBridge;  THINGS.tiertower = TierTower;
//   THINGS.lanternstring = LanternString;  THINGS.willow = Willow;  THINGS.gate = Gate;
//   THINGS.shopfront = ShopFront;  THINGS.punt = Punt;  THINGS.bamboo = Bamboo;
//   THINGS.pavilion = Pavilion;  THINGS.lookout = Lookout;
// (If THINGS is a const object literal, add the same keys inside the literal instead.)

// ───────────────────────────────────────────────────────────────────────────
// LANDS, FRAME, EFFECTS: shapes only. `W`/`H` are the canvas size. Wrap these in
// whatever signature your 'coast', 'valley', 'cave' and 'mist' entries use.
// ───────────────────────────────────────────────────────────────────────────

// land "canal": flat stone embankments on both sides of a dark channel
export const LandCanal = ({ W, H, c }: { W: number; H: number; c: any }) => (
  <g>
    <rect x={0} y={H * 0.5} width={W} height={H * 0.5} fill={tint("#6e665a", c)} />
    <rect x={W * 0.18} y={H * 0.56} width={W * 0.64} height={H * 0.44} fill={tint("#27343f", c)} />
    {[0.62, 0.7, 0.78, 0.86].map((t, i) => (
      <line key={t} x1={W * (0.2 + 0.02 * i)} y1={H * t} x2={W * (0.8 - 0.02 * i)} y2={H * t + sway(c, i, 1.2)} stroke={tint("#8aa0ad", c)} strokeWidth={1} opacity={0.35} />
    ))}
    <rect x={W * 0.16} y={H * 0.54} width={W * 0.03} height={H * 0.46} fill={tint("#9a9282", c)} />
    <rect x={W * 0.81} y={H * 0.54} width={W * 0.03} height={H * 0.46} fill={tint("#9a9282", c)} />
  </g>
);

// land "lake": layered far hills, a wide calm water plane with slow shimmer
export const LandLake = ({ W, H, c }: { W: number; H: number; c: any }) => (
  <g>
    <path d={`M 0 ${H * 0.5} Q ${W * 0.2} ${H * 0.36} ${W * 0.42} ${H * 0.48} Q ${W * 0.7} ${H * 0.34} ${W} ${H * 0.5} Z`} fill={tint("#59705f", c)} />
    <path d={`M 0 ${H * 0.5} Q ${W * 0.3} ${H * 0.42} ${W * 0.55} ${H * 0.5} Q ${W * 0.8} ${H * 0.4} ${W} ${H * 0.5} Z`} fill={tint("#3f5648", c)} />
    <rect x={0} y={H * 0.5} width={W} height={H * 0.5} fill={tint("#33424e", c)} />
    {[0.56, 0.62, 0.69, 0.77, 0.86].map((t, i) => (
      <line key={t} x1={W * 0.1} y1={H * t} x2={W * 0.9} y2={H * t + sway(c, i, 1.6)} stroke={tint("#9fb4bf", c)} strokeWidth={1} opacity={0.28} />
    ))}
  </g>
);

// frame "lattice": carved wooden window lattice laid over the scene
export const FrameLattice = ({ W, H, c }: { W: number; H: number; c: any }) => (
  <g opacity={0.92}>
    <rect x={0} y={0} width={W} height={H * 0.08} fill={tint(WOOD_DK, c)} />
    <rect x={0} y={H * 0.92} width={W} height={H * 0.08} fill={tint(WOOD_DK, c)} />
    <rect x={0} y={0} width={W * 0.05} height={H} fill={tint(WOOD_DK, c)} />
    <rect x={W * 0.95} y={0} width={W * 0.05} height={H} fill={tint(WOOD_DK, c)} />
    {Array.from({ length: 9 }, (_, i) => (
      <g key={i}>
        <line x1={W * (0.05 + i * 0.1)} y1={H * 0.08} x2={W * (0.05 + i * 0.1)} y2={H * 0.92} stroke={tint(WOOD_DK, c)} strokeWidth={3} />
        <line x1={W * 0.05} y1={H * (0.08 + i * 0.1)} x2={W * 0.95} y2={H * (0.08 + i * 0.1)} stroke={tint(WOOD_DK, c)} strokeWidth={3} />
      </g>
    ))}
  </g>
);

// fx "steam": soft white wisps rising and widening (deterministic, no random)
export const FxSteam = ({ W, H, c }: { W: number; H: number; c: any }) => (
  <g>
    {Array.from({ length: 7 }, (_, i) => {
      const t = ((c.f + i * 23) % 120) / 120;
      return <ellipse key={i} cx={W * (0.2 + 0.1 * i) + sway(c, i, 6)} cy={H * (0.78 - 0.4 * t)} rx={10 + 22 * t} ry={6 + 12 * t} fill="#ffffff" opacity={0.22 * (1 - t)} />;
    })}
  </g>
);

// fx "petals": small golden blossoms drifting slowly down and sideways
export const FxPetals = ({ W, H, c }: { W: number; H: number; c: any }) => (
  <g>
    {Array.from({ length: 14 }, (_, i) => {
      const t = ((c.f * 0.6 + i * 41) % 260) / 260;
      return <circle key={i} cx={W * (((i * 0.137) % 1) + 0.05 * Math.sin(t * 6 + i))} cy={H * (0.2 + 0.7 * t)} r={2.2} fill="#e8b84a" opacity={0.8 * (1 - Math.abs(t - 0.5))} />;
    })}
  </g>
);

// fx "lights": small floating lamp-points bobbing on the water, low in the frame
export const FxLights = ({ W, H, c }: { W: number; H: number; c: any }) => (
  <g>
    {Array.from({ length: 9 }, (_, i) => {
      const x = W * (0.12 + ((i * 0.211) % 0.78));
      const y = H * (0.62 + ((i * 0.37) % 0.22)) + sway(c, i, 2);
      return (
        <g key={i}>
          <circle cx={x} cy={y} r={9} fill={GLOW} opacity={0.12 * flick(c, i)} />
          <circle cx={x} cy={y} r={2.6} fill={GLOW} opacity={0.9 * flick(c, i)} />
        </g>
      );
    })}
  </g>
);
