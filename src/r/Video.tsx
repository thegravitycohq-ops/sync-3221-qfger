import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, staticFile, Img} from 'remotion';
import {Scene, Spec} from './art';

export type Plan = {fps: number; width: number; height: number; total: number; brand: string; fade: number; scenes: {s: number; e: number; art: Spec}[]; subs: {s: number; e: number; t: string}[]};
const clamp = (x: number) => Math.max(0, Math.min(1, x));

export const Video: React.FC<Plan> = (plan) => {
  const frame = useCurrentFrame(), {fps, height} = useVideoConfig();
  const t = frame / fps, X = plan.fade;
  const i = Math.max(0, plan.scenes.findIndex((sc) => t < sc.e)), cur = plan.scenes[i], nxt = plan.scenes[i + 1];
  const draw = (sc: typeof cur) => <Scene spec={sc.art} frame={Math.max(0, frame - Math.round(sc.s * fps))} fps={fps} p={clamp((t - sc.s) / (sc.e - sc.s))} />;
  const mixIn = nxt ? clamp((t - (cur.e - X)) / X) : 0;
  const sub = plan.subs.find((u) => t >= u.s && t < u.e);
  const subA = sub ? Math.min(clamp((t - sub.s) / 0.25), clamp((sub.e - t) / 0.25)) : 0;
  const black = Math.max(1 - t / 2, clamp((t - (plan.total - 4)) / 4));
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill>{draw(cur)}</AbsoluteFill>
      {mixIn > 0 && nxt && <AbsoluteFill style={{opacity: mixIn}}>{draw(nxt)}</AbsoluteFill>}
      <AbsoluteFill style={{mixBlendMode: 'multiply', opacity: 0.45}}><Img src={staticFile('paper.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} /></AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(30,20,10,0.32) 100%)'}} />
      <div style={{position: 'absolute', top: height * 0.03, right: height * 0.04, font: `800 ${height * 0.05}px Roboto, "Liberation Sans", sans-serif`, letterSpacing: height * 0.004, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', textShadow: '0 1px 3px rgba(0,0,0,0.35)'}}>{plan.brand}</div>
      {sub && <div style={{position: 'absolute', left: '8%', right: '8%', bottom: height * 0.08, textAlign: 'center', opacity: subA, font: `italic 500 ${height * 0.045}px Roboto, "Liberation Sans", sans-serif`, lineHeight: 1.2, color: '#f6d84c', WebkitTextStroke: `${height * 0.006}px #000`, paintOrder: 'stroke fill', textShadow: '0 2px 6px rgba(0,0,0,0.7)'}}>{sub.t}</div>}
      <AbsoluteFill style={{background: '#000', opacity: black}} />
    </AbsoluteFill>
  );
};
