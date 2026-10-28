import { useEffect, useRef, useState } from "react";
import { audioStreams, type AudioStream } from "@/lib/audio/data";
import LiveStreamPlayer from "./LiveStreamPlayer";

type Stream = AudioStream & { disabled?: boolean };
export default function VirtualScanner() {
  const [streams, setStreams] = useState<Stream[]>([]),
    [enabled, setEnabled] = useState<string[]>([]),
    [loading, setLoading] = useState(true);
  const context = useRef<AudioContext | undefined>(undefined);
  const panners = useRef(new Map<string, PannerNode>());
  const room = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    void fetch("https://audio.crimeisdown.com/streaming/stat")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const xml = new DOMParser().parseFromString(
          await response.text(),
          "text/xml",
        );
        return [...xml.querySelectorAll("live stream")]
          .filter((node) => node.querySelector("active"))
          .map((node) => node.querySelector("name")?.textContent || "");
      })
      .catch(() => [] as string[])
      .then((live) => {
        if (!active) return;
        const available: Stream[] = audioStreams
          .filter(
            (s) =>
              s.broadcastifyId ||
              live.includes(s.slug) ||
              s.name.startsWith("CFD") ||
              s.name.startsWith("CPD Citywide"),
          )
          .map((s) => ({
            ...s,
            disabled: Boolean(s.broadcastifyId) || !live.includes(s.slug),
          }));
        for (const name of live)
          if (!available.some((s) => s.slug === name))
            available.push({
              slug: name,
              name,
              description: "",
              frequency: "",
            });
        setStreams(available);
        setLoading(false);
      });
    return () => {
      active = false;
      void context.current?.close();
    };
  }, []);
  function toggle(slug: string, checked: boolean) {
    if (checked) {
      context.current ||= new AudioContext();
      void context.current.resume();
    }
    setEnabled((previous) =>
      checked ? [...previous, slug] : previous.filter((s) => s !== slug),
    );
  }
  function position(element: HTMLElement, x: number, y: number) {
    const width = room.current!.clientWidth - element.offsetWidth,
      height = room.current!.clientHeight - element.offsetHeight;
    x = Math.max(0, Math.min(width, x));
    y = Math.max(0, Math.min(height, y));
    element.style.left = x + "px";
    element.style.top = y + "px";
    const panner = panners.current.get(element.dataset.slug!);
    if (panner) {
      panner.positionX.value = (x / Math.max(width, 1) - 0.5) * 4;
      panner.positionZ.value = (y / Math.max(height, 1) - 0.5) * 4;
    }
  }
  return (
    <>
      <h3>Live streaming from CrimeIsDown</h3>
      <div className="alert alert-info">
        <p>
          <img
            className="bcfy-favicon"
            src="https://s.broadcastify.com/icons/favicon-96x96.png"
            alt="Broadcastify.com"
          />{" "}
          Listen to encrypted radio channels using the Broadcastify.com links
          below. Radio traffic is delayed 30-35 minutes. CrimeIsDown.com is not
          affiliated with Broadcastify.
        </p>
      </div>
      <div className="row">
        <div className="col-md-6">
          <fieldset id="streamlist">
            <legend>Scanner feeds</legend>
            <div className="stream-options scanner-feed-list mb-3">
              {loading ? (
                <p>Loading...</p>
              ) : streams.length ? (
                streams.map((s) => s.broadcastifyId ? (
                  <div className="scanner-feed-row" key={s.slug}>
                    <a
                      className="scanner-feed-name"
                      href={`https://www.broadcastify.com/listen/feed/${s.broadcastifyId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {(s.shortname ?? s.name).replace(" [ENC]", "")}
                      <svg className="cid-icon scanner-external-icon" aria-hidden="true"><use href="#cid-Link" /></svg>
                    </a>{" "}
                    <a
                      className="scanner-archive-link"
                      href={`/audio/live/${s.slug}`}
                      aria-label={`Archive for ${s.shortname ?? s.name}`}
                      title={`View archive for ${s.shortname ?? s.name}`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3h18v4H3zM5 7v14h14V7M10 11h4" />
                      </svg>
                    </a>
                  </div>
                ) : (
                  <div className="scanner-feed-row" key={s.slug}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`checkbox-${s.slug}`}
                      value={s.slug}
                      disabled={s.disabled}
                      checked={enabled.includes(s.slug)}
                      onChange={(e) => toggle(s.slug, e.target.checked)}
                    />
                    <label
                      className="form-check-label scanner-feed-name"
                      htmlFor={`checkbox-${s.slug}`}
                    >
                      {s.shortname ?? s.name}
                    </label>{" "}
                    <a
                      href={`/audio/live/${s.slug}`}
                      className="scanner-archive-link"
                      aria-label={`Archive for ${s.shortname ?? s.name}`}
                      title={`View archive for ${s.shortname ?? s.name}`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3h18v4H3zM5 7v14h14V7M10 11h4" />
                      </svg>
                    </a>

                  </div>
                ))
              ) : (
                <p className="text-danger">
                  Sorry, all streams are currently offline due to technical
                  difficulties. Please try again later.
                </p>
              )}
            </div>
          </fieldset>
        </div>
        <div className="col-md-6">
          <h4>Spatial Scanner Audio</h4>
          <p>
            Drag{" "}
            <svg className="cid-icon" aria-hidden="true">
              <use href="#cid-VolumeHigh" />
            </svg>{" "}
            to move stereo channels, put on{" "}
            <svg className="cid-icon" aria-hidden="true">
              <use href="#cid-Headphones" />
            </svg>{" "}
            for surround sound
          </p>
          <div className="draggable-parent" ref={room}>
            <svg className="cid-icon scanner-listener" aria-hidden="true">
              <use href="#cid-User" />
            </svg>
            {enabled.map((slug, i) => (
              <button
                type="button"
                key={slug}
                className="draggable"
                data-slug={slug}
                style={{
                  left: 20 + i * 10,
                  top: 20 + i * 10,
                  touchAction: "none",
                }}
                aria-label={`Position ${slug}; use arrow keys to move`}
                onPointerDown={(e) =>
                  e.currentTarget.setPointerCapture(e.pointerId)
                }
                onPointerMove={(e) => {
                  if (e.buttons !== 1) return;
                  position(
                    e.currentTarget,
                    e.currentTarget.offsetLeft + e.movementX,
                    e.currentTarget.offsetTop + e.movementY,
                  );
                }}
                onKeyDown={(e) => {
                  if (!e.key.startsWith("Arrow")) return;
                  e.preventDefault();
                  position(
                    e.currentTarget,
                    e.currentTarget.offsetLeft +
                      (e.key === "ArrowLeft"
                        ? -10
                        : e.key === "ArrowRight"
                          ? 10
                          : 0),
                    e.currentTarget.offsetTop +
                      (e.key === "ArrowUp"
                        ? -10
                        : e.key === "ArrowDown"
                          ? 10
                          : 0),
                  );
                }}
              >
                <svg className="cid-icon" aria-hidden="true">
                  <use href="#cid-VolumeHigh" />
                </svg>
                {slug}
              </button>
            ))}
          </div>
        </div>
        <div className="col-md-12">
          <div className="row">
            {enabled.map((slug) => {
              const s = streams.find((s) => s.slug === slug)!;
              return (
                <div className="stream col-sm-6" key={slug}>
                  <p className="title">
                    <a href={`/audio/live/${slug}`}>{s.shortname ?? s.name}</a>
                  </p>
                  <LiveStreamPlayer
                    slug={slug}
                    autoplay
                    context={context.current}
                    onLevel={(level) => {
                      const handle = [
                        ...(room.current?.querySelectorAll<HTMLElement>(
                          "[data-slug]",
                        ) || []),
                      ].find((element) => element.dataset.slug === slug);
                      if (handle) handle.style.color = `rgb(0, ${level}, 0)`;
                    }}
                    onPanner={(node) => {
                      if (node) panners.current.set(slug, node);
                      else panners.current.delete(slug);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
