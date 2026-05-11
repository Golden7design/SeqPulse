import {Composition} from 'remotion';
import {MainVideo} from './Video';
import {OpenDashboard} from './OpenDashboards';
import {PipelineSuccess} from './PipelineSuccess';
import {SlowAnalyse} from './SlowAnalyse';
import {Debate} from './Debate';

export const RemotionRoot = () => (
  <>
    <Composition
      id="OpenDashboards"
      component={OpenDashboard}
      durationInFrames={320}
      fps={30}
      width={1920}
      height={1080}
    />

    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: 'Hello Remotion',
        subtitle: 'SEQPULSE',
      }}
    />

    <Composition
      id="PipelineSuccess"
      component={PipelineSuccess}
      durationInFrames={350}
      fps={30}
      width={1920}
      height={1080}
    />

    <Composition
      id="SlowAnalyse"
      component={SlowAnalyse}
      durationInFrames={210}
      fps={30}
      width={1920}
      height={1080}
    />

    <Composition
      id="Debate"
      component={Debate}
      durationInFrames={210}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
