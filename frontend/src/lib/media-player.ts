import "video.js/dist/video-js.css";
import "videojs-wavesurfer/dist/css/videojs.wavesurfer.css";

type Player = {
  src(source: { src: string; type: string }): void;
  dispose(): void;
  wavesurfer(): { surfer: { zoom(value: number): void } };
};
export async function mountWaveformPlayer(
  audio: HTMLAudioElement,
  src: string,
  type: string,
  autoplay = false,
  timeline?: HTMLElement,
): Promise<Player> {
  const videojs = (await import("video.js")).default;
  await import("videojs-wavesurfer");
  const plugins = [];
  if (timeline) {
    const Timeline = (
      await import("wavesurfer.js/dist/plugin/wavesurfer.timeline.js")
    ).default;
    plugins.push(Timeline.create({ container: timeline }));
  }
  const player = videojs(audio, {
    aspectRatio: "4:1",
    controls: true,
    autoplay: autoplay ? "play" : false,
    techOrder: ["html5"],
    plugins: {
      wavesurfer: {
        displayMilliseconds: false,
        interact: true,
        normalize: true,
        waveColor: "#0F0",
        progressColor: "#0A0",
        cursorColor: "#FFF",
        plugins,
      },
    },
  });
  player.src({ src, type });
  return player as unknown as Player;
}
