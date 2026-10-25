import { useEffect, useRef, useState } from "react";
import type IcecastMetadataPlayer from "icecast-metadata-player";
export default function IcecastPlayer({ stream }: { stream: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [title, setTitle] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let disposed = false,
      player: IcecastMetadataPlayer | undefined;
    void import("icecast-metadata-player")
      .then(({ default: Player }) => {
        if (disposed) return;
        player = new Player(stream, {
          audioElement: audio.current!,
          metadataTypes: ["icy"],
          icyDetectionTimeout: 5000,
          onMetadata: (metadata: { StreamTitle?: string }) =>
            setTitle(String(metadata.StreamTitle || "")),
          onError: (message) => setError(String(message)),
        });
      })
      .catch(() => {
        if (audio.current) audio.current.src = stream;
      });
    return () => {
      disposed = true;
      void player?.stop();
    };
  }, [stream]);
  return (
    <>
      <p>
        <small>
          Please note it might take a few seconds for the audio to load once
          pressing play.
        </small>
      </p>
      <p id="icecast-metadata">
        {title && (
          <>
            <strong>Now Playing:</strong> {title}
          </>
        )}
        {error}
      </p>
      <audio ref={audio} id="icecast-audio" controls>
        Your browser does not support HTML5 audio.
      </audio>
      <table id="icecast-metadataQueue" />
    </>
  );
}
