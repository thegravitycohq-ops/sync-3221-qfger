import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, staticFile, Img} from 'remotion';
import {Scene, Spec} from './art';
import './fonts';

// Wordmark — Variant A (approved by Bruce, 2026-11-15): small gold serif,
// soft glow, bottom centre. The dashboard still sends only the brand NAME;
// this changes purely how the renderer draws that string.
// Font stack: Cormorant Garamond when the @fontsource import in fonts.ts is
// present, otherwise Georgia / Times — always a serif, never Anton.
export const WM = {font: `'Cormorant Garamond', Georgia, 'Times New Roman', serif`, size: 0.038, bottom: 0.035, color: '#e3c268'};
// Chapter cards (restyled by Bruce, 2026-11-15): a small gold-serif
// 'Chapter - N' line over the chapter name set HUGE in the same gold serif
// as the wordmark. Cards use WM.font / WM.color — there is no separate
// card font any more.
// Subtitles (Bruce, 2026-11-16): CREAM text, WHITE outline (no black
// outline), NO italic, Montserrat, sitting in the MIDDLE of the frame so
// they never collide with the bottom-centre wordmark. Montserrat loads via
// the @fontsource import in fonts.ts; until then the stack falls back to a
// plain sans, still cream with a white outline.
export const SUB = {font: `'Montserrat', 'Segoe UI', Arial, sans-serif`, size: 0.054, bottom: 0.45, color: '#f4ecd8', stroke: 0.007};

// Chapter cards (added 2026-11-14): plan.cards is an OPTIONAL list of silent windows emitted by
// prep.py at chapter boundaries. During a window no narration plays; the chapter's title is drawn
// centred on screen and fades gently in and out. Plans without the field render exactly as before.
export type Plan = {fps: number; width: number; height: number; total: number; brand: string; fade: number; scenes: {s: number; e: number; art: Spec}[]; subs: {s: number; e: number; t: string}[]; cards?: {s: number; e: number; title: string; n?: number}[]; intro?: {s: number; e: number}; tagline?: string};
const clamp = (x: number) => Math.max(0, Math.min(1, x));

export const Video: React.FC<Plan> = (plan) => {
  const frame = useCurrentFrame(), {fps, height, width} = useVideoConfig();
  const t = frame / fps;
  const i = Math.max(0, plan.scenes.findIndex((sc) => t < sc.e)), cur = plan.scenes[i], nxt = plan.scenes[i + 1];
  const X = Math.min(plan.fade, (cur.e - cur.s) * 0.3); // dissolve length: never more than 30% of a short shot
  const draw = (sc: typeof cur) => <Scene spec={sc.art} frame={Math.max(0, frame - Math.round(sc.s * fps))} fps={fps} p={clamp((t - sc.s) / (sc.e - sc.s))} />;
  const mixIn = nxt ? clamp((t - (cur.e - X)) / X) : 0;
  const sub = plan.subs.find((u) => t >= u.s && t < u.e);
  const subA = sub ? Math.min(clamp((t - sub.s) / 0.25), clamp((sub.e - t) / 0.25)) : 0;
  const card = (plan.cards ?? []).find((cd) => t >= cd.s && t < cd.e);
  const cardNo = card ? (card.n ?? (plan.cards ?? []).indexOf(card) + 2) : 0; // prep numbers cards; fallback: chapters 2..N
  const cardA = card ? Math.min(clamp((t - card.s) / 0.9), clamp((card.e - t) / 0.9)) : 0;
  const black = Math.max(1 - t / 2, clamp((t - (plan.total - 4)) / 4));
  const intro = plan.intro && t >= plan.intro.s && t < plan.intro.e ? plan.intro : null;
  const TYPE_SECS = 3.2; // channel name types itself in over ~3.2s, Dreamoria-style
  const nameShown = intro ? Math.max(0, Math.min(plan.brand.length, Math.ceil(clamp((t - intro.s - 0.4) / TYPE_SECS) * plan.brand.length))) : 0;
  const tagA = intro ? clamp((t - intro.s - 0.4 - TYPE_SECS - 0.3) / 1.4) : 0;
  const introA = intro ? Math.min(1, clamp((intro.e - t) / 1.2)) : 0;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill>{draw(cur)}</AbsoluteFill>
      {mixIn > 0 && nxt && <AbsoluteFill style={{opacity: mixIn}}>{draw(nxt)}</AbsoluteFill>}
      <AbsoluteFill style={{mixBlendMode: 'multiply', opacity: 0.45}}><Img src={staticFile('paper.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} /></AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(30,20,10,0.32) 100%)'}} />
      {plan.brand && !intro && <div style={{position: 'absolute', left: 0, right: 0, bottom: height * WM.bottom, textAlign: 'center', font: `600 ${height * WM.size}px/1 ${WM.font}`, letterSpacing: '0.04em', whiteSpace: 'nowrap', color: WM.color, textShadow: '0 0 14px rgba(227,194,104,0.55), 0 2px 6px rgba(0,0,0,0.7)'}}>{plan.brand}</div>}
      {intro && plan.brand && <div style={{position: 'absolute', left: '6%', right: '6%', top: height * 0.32, textAlign: 'center', opacity: introA}}>
        <div style={{font: `600 ${height * 0.115}px/1.15 ${WM.font}`, letterSpacing: '0.05em', whiteSpace: 'nowrap', color: WM.color, textShadow: '0 0 26px rgba(227,194,104,0.6), 0 3px 16px rgba(0,0,0,0.85)'}}>{plan.brand.slice(0, nameShown)}{nameShown < plan.brand.length && <span style={{opacity: 0.75}}>|</span>}</div>
        {plan.tagline ? <div style={{font: `600 ${height * 0.037}px/1.3 ${WM.font}`, letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: height * 0.028, color: WM.color, opacity: tagA, transform: `translateY(${Math.round((1 - tagA) * height * 0.014)}px)`, textShadow: '0 0 14px rgba(227,194,104,0.5), 0 2px 8px rgba(0,0,0,0.8)'}}>{plan.tagline}</div> : null}
      </div>}
      {sub && !intro && <div style={{position: 'absolute', left: '8%', right: '8%', bottom: height * SUB.bottom, textAlign: 'center', opacity: subA, font: `500 ${height * SUB.size}px/1.2 ${SUB.font}`, color: SUB.color, WebkitTextStroke: `${height * SUB.stroke}px #ffffff`, paintOrder: 'stroke fill', textShadow: '0 0 10px rgba(244,236,216,0.35)'}}>{sub.t}</div>}
      {card && <div style={{position: 'absolute', left: '10%', right: '10%', top: height * 0.4, textAlign: 'center', opacity: cardA}}>
        <div style={{width: width * 0.09, height: 2, margin: '0 auto 20px', background: 'rgba(227,194,104,0.55)'}} />
        <div style={{font: `600 ${height * 0.034}px/1.2 ${WM.font}`, letterSpacing: '0.3em', color: WM.color, textShadow: '0 0 12px rgba(227,194,104,0.5), 0 2px 8px rgba(0,0,0,0.8)'}}>{`Chapter - ${cardNo}`}</div>
        <div style={{font: `600 ${height * 0.108}px/1.18 ${WM.font}`, letterSpacing: '0.02em', marginTop: height * 0.014, color: WM.color, textShadow: '0 0 22px rgba(227,194,104,0.55), 0 3px 14px rgba(0,0,0,0.85)'}}>{card.title}</div>
        <div style={{width: width * 0.09, height: 2, margin: '20px auto 0', background: 'rgba(227,194,104,0.55)'}} />
      </div>}
      <AbsoluteFill style={{background: '#000', opacity: black}} />
    </AbsoluteFill>
  );
};
