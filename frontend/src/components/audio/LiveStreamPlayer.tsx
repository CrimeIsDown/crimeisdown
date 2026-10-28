import { useEffect, useRef, useState } from "react";
import "mediaelement/build/mediaelementplayer.min.css";

type Media = {
  renderer?: HTMLAudioElement;
  play(): Promise<void>;
  addEventListener(name: string, callback: () => void): void;
  removeEventListener(name: string, callback: () => void): void;
};
type Player = {
  setSrc(source: { src: string; type: string }): void;
  load(): void;
  play(): Promise<void>;
  remove(): void;
};
type Props = {
  slug: string;
  autoplay?: boolean;
  onPanner?: (panner: PannerNode | null) => void;
  context?: AudioContext;
  onLevel?: (level: number) => void;
};
export default function LiveStreamPlayer({
  slug,
  autoplay = false,
  context,
  onPanner,
  onLevel,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const container = host.current!,
      audio = document.createElement("audio");
    audio.id = "stream-player-" + slug;
    audio.className = "stream-player";
    audio.preload = "none";
    audio.crossOrigin = "anonymous";
    audio.controls = true;
    container.append(audio);
    let disposed = false,
      player: Player | undefined,
      source: MediaElementAudioSourceNode | undefined,
      panner: PannerNode | undefined,
      analyser: AnalyserNode | undefined,
      meterFrame = 0;
    async function start() {
      await import("mediaelement");
      const nativeHls = Boolean(
        audio.canPlayType("application/vnd.apple.mpegurl"),
      );
      if (!nativeHls)
        (window as unknown as { dashjs: unknown }).dashjs = await import(
          "dashjs"
        );
      if (disposed) return;
      const Constructor = (
        window as unknown as {
          MediaElementPlayer: new (
            el: HTMLAudioElement,
            options: unknown,
          ) => Player;
        }
      ).MediaElementPlayer;
      player = new Constructor(audio, {
        isVideo: false,
        pauseOtherPlayers: false,
        features: ["playpause", "current", "volume"],
        iconSprite: "/img/mejs-controls.svg",
        renderers: nativeHls ? ["html5"] : ["native_dash"],
        success(media: Media) {
          const connect = () => {
            if (!context || source || disposed) return;
            const node = media.renderer || audio;
            source = context.createMediaElementSource(node);
            panner = context.createPanner();
            panner.panningModel = "HRTF";
            panner.distanceModel = "inverse";
            panner.refDistance = 4;
            analyser = context.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 1;
            source.connect(analyser);
            analyser.connect(panner);
            const samples = new Uint8Array(analyser.fftSize);
            const meter = () => {
              if (disposed || !analyser) return;
              analyser.getByteTimeDomainData(samples);
              let peak = 0;
              for (const sample of samples)
                peak = Math.max(peak, Math.abs(sample - 128));
              onLevel?.(Math.min(255, Math.round(peak * 16)));
              meterFrame = requestAnimationFrame(meter);
            };
            meter();
            panner.connect(context.destination);
            onPanner?.(panner);
            void context.resume();
          };
          media.addEventListener("canplay", connect);
        },
        error() {
          if (!disposed)
            setError(
              "This stream is currently unavailable. Please try again later.",
            );
        },
      });
      player.setSrc({
        src:
          nativeHls
            ? `https://audio.crimeisdown.com/streaming/hls/${encodeURIComponent(slug)}/index.m3u8`
            : `https://audio.crimeisdown.com/streaming/dash/${encodeURIComponent(slug)}/`,
        type: nativeHls
          ? "application/vnd.apple.mpegurl"
          : "application/dash+xml",
      });
      if (autoplay) {
        player.load();
        await player.play().catch(() => {});
      }
    }
    void start().catch(() => {
      if (!disposed) setError("Could not start this stream. Please try again.");
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(meterFrame);
      analyser?.disconnect();
      source?.disconnect();
      panner?.disconnect();
      onPanner?.(null);
      player?.remove();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      container.replaceChildren();
    };
  }, [slug, autoplay, context]);
  return (
    <>
      <div ref={host} />
      {error && (
        <p className="text-danger" role="status">
          {error}
        </p>
      )}
    </>
  );
}
