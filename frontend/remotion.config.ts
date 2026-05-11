import {Config} from '@remotion/cli/config';

// Use H.264 MP4 by default
Config.setCodec('h264');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Optional: speed up preview on slower machines
Config.setMaxTimelineTracks(15);
