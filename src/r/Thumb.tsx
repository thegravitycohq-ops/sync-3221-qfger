import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {Scene, Spec} from './art';
import './fonts';

export type ThumbProps = {art: Spec; text: string; badge: string};
// Large, high-contrast, 2 to 5 words: readable at phone-thumbnail size.
const lines = (t: string) => {
  const w = t.toUpperCase().split(/\s+/).filter(Boolean), out: string[] = [];
  for (const x of w) (out.length && (out[out.length - 1] + ' ' + x).length <= 13 ? (out[out.length - 1] += ' ' + x) : out.push(x));
  return out;
};
export const Thumb: React.FC<ThumbProps> = ({art, text, badge}) => {
  const {width: W, height: H} = useVideoConfig(), L = lines(text), longest = Math.max(1, ...L.map((l) => l.length));
  const size = Math.min(0.2 * H, (0.58 * W) / (longest * 0.43), (0.84 * H) / (L.length * 1.05));
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Scene spec={art} frame={30} fps={15} p={0.5} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(12,9,5,0.72) 0%, rgba(12,9,5,0.38) 45%, rgba(12,9,5,0) 72%)'}} />
      <div style={{position: 'absolute', left: W * 0.045, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', font: `400 ${size}px/1.02 Anton, Impact, sans-serif`, textTransform: 'uppercase', WebkitTextStroke: `${size * 0.05}px #000`, paintOrder: 'stroke fill', textShadow: '0 6px 18px rgba(0,0,0,0.6)'}}>
        {L.map((l, i) => <div key={i} style={{color: i === L.length - 1 && L.length > 1 ? '#f6d84c' : '#fff'}}>{l}</div>)}
      </div>
      {badge && <div style={{position: 'absolute', right: W * 0.035, bottom: H * 0.06, padding: `${H * 0.012}px ${H * 0.03}px`, borderRadius: H * 0.02, background: 'rgba(12,9,5,0.82)', border: `${H * 0.004}px solid #f6d84c`, color: '#f6d84c', font: `400 ${H * 0.075}px/1 Anton, Impact, sans-serif`, letterSpacing: H * 0.003}}>{badge}</div>}
    </AbsoluteFill>
  );
};
