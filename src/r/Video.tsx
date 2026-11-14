import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, staticFile, Img} from 'remotion';
import {Scene, Spec} from './art';
import './fonts';

// Watermark constants measured from the reference screenshots (1366x768): text about 26% of the frame width,
// cap height 5.3% of frame height, 3.5% in from the right, 4.7% down from the top, white at about 0.24 opacity.
export const WM = {font: 'Anton, Impact, sans-serif', size: 0.0616, top: 0.045, right: 0.035, opacity: 0.24, color: '255,255,255'};
// Subtitles: italic, yellow, black outline, lower third.
export const SUB = {font: 'Roboto, Arial, sans-serif', size: 0.045, bottom: 0.08, color: '#f6d84c', stroke: 0.006};

// Chapter cards (added 2026-11-14): plan.cards is an OPTIONAL list of silent windows emitted by
// prep.py at chapter boundaries. During a window no narration plays; the chapter's title is drawn
// centred on screen and fades gently in and out. Plans without the field render exactly as before.
export type Plan = {fps: number; width: number; height: number; total: number; brand: string; fade: number; scenes: {s: number; e: number; art: Spec}[]; subs: {s: number; e: number; t: string}[]; cards?: {s: number; e: number; title: string}[]};
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
  const cardA = card ? Math.min(clamp((t - card.s) / 0.9), clamp((card.e - t) / 0.9)) : 0;
  const black = Math.max(1 - t / 2, clamp((t - (plan.total - 4)) / 4));
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill>{draw(cur)}</AbsoluteFill>
      {mixIn > 0 && nxt && <AbsoluteFill style={{opacity: mixIn}}>{draw(nxt)}</AbsoluteFill>}
      <AbsoluteFill style={{mixBlendMode: 'multiply', opacity: 0.45}}><Img src={staticFile('paper.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} /></AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(30,20,10,0.32) 100%)'}} />
      {plan.brand && <div style={{position: 'absolute', top: height * WM.top, right: width * WM.right, font: `400 ${height * WM.size}px/1 ${WM.font}`, textTransform: 'uppercase', whiteSpace: 'nowrap', color: `rgba(${WM.color},${WM.opacity})`}}>{plan.brand}</div>}
      {sub && <div style={{position: 'absolute', left: '8%', right: '8%', bottom: height * SUB.bottom, textAlign: 'center', opacity: subA, font: `italic 500 ${height * SUB.size}px/1.2 ${SUB.font}`, color: SUB.color, WebkitTextStroke: `${height * SUB.stroke}px #000`, paintOrder: 'stroke fill', textShadow: '0 2px 6px rgba(0,0,0,0.7)'}}>{sub.t}</div>}
      {card && <div style={{position: 'absolute', left: '10%', right: '10%', top: height * 0.4, textAlign: 'center', opacity: cardA}}>
        <div style={{width: width * 0.09, height: 2, margin: '0 auto 18px', background: 'rgba(244,236,216,0.75)'}} />
        <div style={{font: `400 ${height * 0.062}px/1.25 ${WM.font}`, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f4ecd8', textShadow: '0 3px 14px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9)'}}>{card.title}</div>
        <div style={{width: width * 0.09, height: 2, margin: '18px auto 0', background: 'rgba(244,236,216,0.75)'}} />
      </div>}
      <AbsoluteFill style={{background: '#000', opacity: black}} />
    </AbsoluteFill>
  );
};
