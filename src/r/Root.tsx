import React from 'react';
import {Composition} from 'remotion';
import {Video, Plan} from './Video';

const def: Plan = {fps: 15, width: 1280, height: 720, total: 10, brand: '', fade: 2, scenes: [{s: 0, e: 10, art: {}}], subs: []};
export const Root: React.FC = () => (
  <Composition id="V" component={Video} width={def.width} height={def.height} fps={def.fps} durationInFrames={150} defaultProps={def}
    calculateMetadata={({props}) => ({durationInFrames: Math.ceil(props.total * props.fps), fps: props.fps, width: props.width, height: props.height})} />
);
