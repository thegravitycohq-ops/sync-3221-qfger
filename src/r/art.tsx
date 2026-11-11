// art-erie.tsx — Erie Canal extension for src/r/art.tsx — Path B, world-class
// Merge into art.tsx next to Campfire. Follow existing patterns exactly.
// RULES (art-cookbook.md): draw at 0,0 = feet, s = scale, use ln for ink outline,
// tint(colour, c) for lighting, c.f = frame for motion. NO Math.random, NO Date,
// NO faces, NO text, NO close-ups. People/horses small, from behind / far away.
// Palette: warm muted — ochre #C99A5B, olive #7A7A4A, sienna #8A5A2B, dusty rose #C08A7A,
// ink #2A221A, stone grey #8A8578, water green #6A8A7A, lantern gold #E8B84A.
// All shapes are flat + ink outline, like the pipeline's drawn look. Do NOT promise brush painting.
//
// HOW TO MERGE:
// 1. Paste these components into src/r/art.tsx
// 2. Register in THINGS: CanalBoat, LockGate, StoneLock, StoneAqueduct, TowpathHorse, SaltWorks, PacketCabin, Towpath
// 3. Add names to src/r/vocab.json (see vocab-erie.json), copy vocab.json to dashboard
// 4. Run: python tests/test_vocab.py
// 5. Render with erie-canal-script-pathB.json (max_shot 8) — do NOT mix Path A and Path B.

// Helpers are assumed to exist in art.tsx: ln (ink), tint(colour, c) (lighting tint)
// If your repo names them differently, alias them at top: const ln = ...; const tint = ...

// ---------------------------------------------------------------- CanalBoat
// Long narrow packet boat, low in water. Reads at 720p and in close-up.
// Feet at waterline. Cabin with one warm window (no face). Tow-rope forward.
// Gentle bob: translate y by sin(c.f) — c.f is frame, deterministic.
export function CanalBoat({ s, c }: any) {
  const bob = Math.sin(c.f * 0.08) * 1.5; // slow, calm, deterministic
  const smoke = Math.sin(c.f * 0.05) * 2;
  return (
    <g transform={`translate(0 ${bob}) scale(${s})`}>
      {/* water shadow / reflection — calm, not detailed */}
      <ellipse cx={0} cy={2} rx={92} ry={7} fill={tint("#6A8A7A", c)} opacity={0.45} />
      {/* hull — long, low, sienna with ink outline */}
      <path d="M -92 0 L 92 0 L 78 -18 L -78 -18 Z" fill={tint("#8A5A2B", c)} stroke={ln} strokeWidth={2.5} />
      <path d="M -92 0 L 92 0" stroke={ln} strokeWidth={2} />
      {/* hull planking — 3 calm lines, no text */}
      <path d="M -80 -6 L 80 -6 M -82 -11 L 82 -11" stroke={ln} strokeWidth={1} opacity={0.55} fill="none" />
      {/* cabin — ochre, roof line, one warm window */}
      <rect x={-52} y={-46} width={104} height={28} rx={2} fill={tint("#C99A5B", c)} stroke={ln} strokeWidth={2.5} />
      <path d="M -56 -46 L 0 -58 L 56 -46" fill={tint("#7A4A22", c)} stroke={ln} strokeWidth={2.5} />
      {/* warm window — lantern gold, no face */}
      <rect x={-12} y={-38} width={24} height={16} rx={2} fill={tint("#E8B84A", c)} stroke={ln} strokeWidth={1.5} />
      {/* chimney + drifting smoke — smoke uses c.f, slow */}
      <rect x={34} y={-58} width={7} height={14} fill={tint("#4A3A2A", c)} stroke={ln} strokeWidth={1.5} />
      <circle cx={38 + smoke} cy={-64} r={4} fill={tint("#D8D0C0", c)} opacity={0.55} />
      <circle cx={42 + smoke * 1.4} cy={-70} r={5.5} fill={tint("#D8D0C0", c)} opacity={0.35} />
      {/* lantern on cabin door — small, warm */}
      <circle cx={-38} cy={-30} r={3.5} fill={tint("#E8B84A", c)} stroke={ln} strokeWidth={1.2} />
      {/* tow-rope — thin line forward, to TowpathHorse */}
      <path d="M 92 -8 L 128 -22" stroke={ln} strokeWidth={1.2} fill="none" opacity={0.8} />
      {/* deck rail — calm line */}
      <path d="M -70 -18 L 70 -18" stroke={ln} strokeWidth={1} opacity={0.5} fill="none" />
    </g>
  );
}

// ---------------------------------------------------------------- PacketCabin
// Cabin alone (for dock / town scenes where boat is not needed). Same palette as CanalBoat cabin.
export function PacketCabin({ s, c }: any) {
  return (
    <g transform={`scale(${s})`}>
      <rect x={-46} y={-34} width={92} height={34} rx={2} fill={tint("#C99A5B", c)} stroke={ln} strokeWidth={2.5} />
      <path d="M -50 -34 L 0 -46 L 50 -34" fill={tint("#7A4A22", c)} stroke={ln} strokeWidth={2.5} />
      <rect x={-10} y={-26} width={20} height={14} rx={2} fill={tint("#E8B84A", c)} stroke={ln} strokeWidth={1.5} />
      <rect x={22} y={-24} width={10} height={24} fill={tint("#5A3A1A", c)} stroke={ln} strokeWidth={1.2} />
    </g>
  );
}

// ---------------------------------------------------------------- LockGate
// Paired stone walls + timber gates. Use for every lock scene (Flight of Five = 5x LockGate).
// Draw as two stone blocks + gate planks with diagonal braces. Water in middle, calm.
export function LockGate({ s, c }: any) {
  const waterY = Math.sin(c.f * 0.04) * 1; // water level breathes very slowly
  return (
    <g transform={`scale(${s})`}>
      {/* left stone wall */}
      <rect x={-92} y={-52} width={34} height={52} fill={tint("#8A8578", c)} stroke={ln} strokeWidth={2.5} />
      <path d="M -92 -38 L -58 -38 M -92 -24 L -58 -24 M -75 -52 L -75 0" stroke={ln} strokeWidth={1} opacity={0.5} fill="none" />
      {/* right stone wall */}
      <rect x={58} y={-52} width={34} height={52} fill={tint("#8A8578", c)} stroke={ln} strokeWidth={2.5} />
      <path d="M 58 -38 L 92 -38 M 58 -24 L 92 -24 M 75 -52 L 75 0" stroke={ln} strokeWidth={1} opacity={0.5} fill="none" />
      {/* timber gates — sienna planks, diagonal brace, iron hinge dots */}
      <g>
        <rect x={-58} y={-38} width={58} height={38} fill={tint("#8A5A2B", c)} stroke={ln} strokeWidth={2.5} />
        <path d="M -58 -38 L 0 0 M -40 -38 L -40 0 M -20 -38 L -20 0" stroke={ln} strokeWidth={1.2} opacity={0.6} fill="none" />
        <circle cx={-52} cy={-32} r={2} fill={ln} />
        <circle cx={-52} cy={-6} r={2} fill={ln} />
        <rect x={0} y={-38} width={58} height={38} fill={tint("#7A4A22", c)} stroke={ln} strokeWidth={2.5} />
        <path d="M 0 0 L 58 -38 M 20 -38 L 20 0 M 40 -38 L 40 0" stroke={ln} strokeWidth={1.2} opacity={0.6} fill="none" />
        <circle cx={52} cy={-32} r={2} fill={ln} />
        <circle cx={52} cy={-6} r={2} fill={ln} />
      </g>
      {/* water — calm band, moves with c.f very slowly */}
      <rect x={-58} y={-6 + waterY} width={116} height={6} fill={tint("#6A8A7A", c)} opacity={0.7} />
      {/* moss — dusty green touches on stone, no detail */}
      <circle cx={-82} cy={-48} r={5} fill={tint("#7A7A4A", c)} opacity={0.6} />
      <circle cx={82} cy={-48} r={5} fill={tint("#7A7A4A", c)} opacity={0.6} />
      {/* keeper's lantern hook — small warm dot */}
      <circle cx={-70} cy={-56} r={3} fill={tint("#E8B84A", c)} stroke={ln} strokeWidth={1} />
    </g>
  );
}

// ---------------------------------------------------------------- StoneLock
// Single stone lock wall (for wide shots where only one wall is in frame).
export function StoneLock({ s, c }: any) {
  return (
    <g transform={`scale(${s})`}>
      <rect x={-80} y={-48} width={160} height={48} fill={tint("#8A8578", c)} stroke={ln} strokeWidth={2.5} />
      <path d="M -80 -32 L 80 -32 M -80 -16 L 80 -16 M -40 -48 L -40 0 M 0 -48 L 0 0 M 40 -48 L 40 0" stroke={ln} strokeWidth={1} opacity={0.5} fill="none" />
      <circle cx={-60} cy={-44} r={5} fill={tint("#7A7A4A", c)} opacity={0.55} />
      <circle cx={60} cy={-44} r={5} fill={tint("#7A7A4A", c)} opacity={0.55} />
    </g>
  );
}

// ---------------------------------------------------------------- StoneAqueduct
// Long stone bridge with arches. Boat passes on top (CanalBoat placed above in JSON).
// River below is drawn by the engine (riverX). Keep arches wide and calm.
export function StoneAqueduct({ s, c }: any) {
  return (
    <g transform={`scale(${s})`}>
      {/* parapet + deck */}
      <rect x={-110} y={-58} width={220} height={10} fill={tint("#8A8578", c)} stroke={ln} strokeWidth={2.5} />
      {/* stone band */}
      <rect x={-110} y={-48} width={220} height={28} fill={tint("#8A8578", c)} stroke={ln} strokeWidth={2.5} />
      <path d="M -110 -34 L 110 -34" stroke={ln} strokeWidth={1} opacity={0.5} fill="none" />
      {/* arches — 3 wide cut-outs, water green inside */}
      <g fill={tint("#6A8A7A", c)} stroke={ln} strokeWidth={2}>
        <path d="M -88 -20 A 18 20 0 0 1 -52 -20 L -52 -20 L -88 -20 Z" />
        <path d="M -18 -20 A 18 20 0 0 1 18 -20 L 18 -20 L -18 -20 Z" />
        <path d="M 52 -20 A 18 20 0 0 1 88 -20 L 88 -20 L 52 -20 Z" />
      </g>
      {/* piers */}
      <rect x={-110} y={-20} width={22} height={20} fill={tint("#7A7568", c)} stroke={ln} strokeWidth={2} />
      <rect x={-22} y={-20} width={22} height={20} fill={tint("#7A7568", c)} stroke={ln} strokeWidth={2} />
      <rect x={22} y={-20} width={22} height={20} fill={tint("#7A7568", c)} stroke={ln} strokeWidth={2} />
      <rect x={88} y={-20} width={22} height={20} fill={tint("#7A7568", c)} stroke={ln} strokeWidth={2} />
    </g>
  );
}

// ---------------------------------------------------------------- TowpathHorse
// Far horse on towpath, seen from side / behind, small. No face, no close-up.
// Tail + head move very slowly with c.f. Use herd palette.
export function TowpathHorse({ s, c }: any) {
  const head = Math.sin(c.f * 0.06) * 1.2;
  const tail = Math.sin(c.f * 0.06 + 1) * 1.5;
  return (
    <g transform={`scale(${s})`}>
      {/* body — dark, calm */}
      <ellipse cx={0} cy={-18} rx={26} ry={12} fill={tint("#4A3A2A", c)} stroke={ln} strokeWidth={2} />
      {/* neck + head — lowered, calm, no face */}
      <path d="M 20 -22 L 32 -30 L 36 -24 L 26 -14 Z" fill={tint("#4A3A2A", c)} stroke={ln} strokeWidth={2} transform={`translate(0 ${head})`} />
      {/* legs — 4 thin lines, feet at 0 */}
      <path d="M -16 -10 L -16 0 M -6 -10 L -6 0 M 8 -10 L 8 0 M 18 -10 L 18 0" stroke={ln} strokeWidth={2} fill="none" />
      {/* tail — slow sway */}
      <path d={`M -26 -20 Q -32 -10 -30 0`} stroke={ln} strokeWidth={2} fill="none" transform={`translate(${tail} 0)`} />
      {/* towpath line under feet */}
      <path d="M -40 0 L 40 0" stroke={ln} strokeWidth={1} opacity={0.4} fill="none" />
    </g>
  );
}

// ---------------------------------------------------------------- Towpath
// Ground path alone (for wide towpath shots without horse).
export function Towpath({ s, c }: any) {
  return (
    <g transform={`scale(${s})`}>
      <rect x={-110} y={-4} width={220} height={8} fill={tint("#C9B88A", c)} stroke={ln} strokeWidth={1.5} />
      <path d="M -110 -4 L 110 -4" stroke={ln} strokeWidth={1} opacity={0.5} fill="none" />
    </g>
  );
}

// ---------------------------------------------------------------- SaltWorks
// Low white salt rows + shed. White mounds, grey shed, no text. For Syracuse / Salina.
export function SaltWorks({ s, c }: any) {
  return (
    <g transform={`scale(${s})`}>
      {/* salt mounds — white, soft shading */}
      <ellipse cx={-52} cy={-6} rx={26} ry={10} fill={tint("#F2EFE6", c)} stroke={ln} strokeWidth={1.5} />
      <ellipse cx={0} cy={-8} rx={30} ry={12} fill={tint("#F2EFE6", c)} stroke={ln} strokeWidth={1.5} />
      <ellipse cx={52} cy={-6} rx={26} ry={10} fill={tint("#F2EFE6", c)} stroke={ln} strokeWidth={1.5} />
      {/* shed — low, grey-brown */}
      <rect x={-70} y={-38} width={44} height={28} fill={tint("#8A8578", c)} stroke={ln} strokeWidth={2} />
      <path d="M -74 -38 L -48 -48 L -22 -38" fill={tint("#5A4A32", c)} stroke={ln} strokeWidth={2} />
      {/* rake — leaning, thin */}
      <path d="M 68 -36 L 78 0" stroke={ln} strokeWidth={1.5} fill="none" />
    </g>
  );
}

// Register in THINGS (in art.tsx):
// CanalBoat, LockGate, StoneLock, StoneAqueduct, TowpathHorse, Towpath, SaltWorks, PacketCabin
