import React from 'react';
import {Composition} from 'remotion';
import {Video, Plan} from './Video';
import {Thumb, ThumbProps} from './Thumb';

const def: Plan = {fps: 15, width: 1280, height: 720, total: 10, brand: '', fade: 0.8, scenes: [{s: 0, e: 10, art: {}}], subs: []};
const tdef: ThumbProps = {art: {}, text: 'Example', badge: ''};
export const Root: React.FC = () => (
  <>
    <Composition id="V" component={Video} width={def.width} height={def.height} fps={def.fps} durationInFrames={150} defaultProps={def}
      calculateMetadata={({props}) => ({durationInFrames: Math.ceil(props.total * props.fps), fps: props.fps, width: props.width, height: props.height})} />
    <Composition id="T" component={Thumb} width={1280} height={720} fps={15} durationInFrames={1} defaultProps={tdef} />
  </>
);
