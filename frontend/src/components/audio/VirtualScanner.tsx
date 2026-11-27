import { useEffect, useRef, useState } from "react";
import { audioStreams, type AudioStream } from "@/lib/audio/data";
import LiveStreamPlayer from "./LiveStreamPlayer";

type Stream = AudioStream & { disabled?: boolean };
export default function VirtualScanner() {
  const [streams, setStreams] = useState<Stream[]>([]),
    [enabled, setEnabled] = useState<string[]>([]),
    [loading, setLoading] = useState(true);
  const [zonePlayers, setZonePlayers] = useState(
    () => new Map<number, Window>(),
  );
  const [popupBlocked, setPopupBlocked] = useState(false);
  const hasZonePlayers = zonePlayers.size > 0;
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
            disabled: !s.broadcastifyId && !live.includes(s.slug),
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

  useEffect(() => {
    if (!hasZonePlayers) return;
    const timer = window.setInterval(() => {
      setZonePlayers((previous) => {
        const openPlayers = [...previous].filter(([, player]) => !player.closed);
        return openPlayers.length === previous.size
          ? previous
          : new Map(openPlayers);
      });
    }, 750);
    return () => window.clearInterval(timer);
  }, [hasZonePlayers]);

  function openZone(feedId: number) {
    const player = window.open(
      "about:blank",
      "_blank",
      "popup,width=460,height=560",
    );
    setPopupBlocked(!player);
    if (!player) return;

    // Keep a handle to detect closure, and detach the opener before navigation.
    player.opener = null;
    player.location.replace(
      `https://www.broadcastify.com/listen/feed/popout.php?feedId=${feedId}`,
    );
    setZonePlayers((previous) => new Map(previous).set(feedId, player));
  }

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
          Select a CPD zone to open its Broadcastify player. Close the pop-out
          to stop listening to that zone. Zone audio is delayed 30–35 minutes.
          CrimeIsDown.com is not affiliated with Broadcastify.
        </p>
        {popupBlocked ? (
          <p role="status">
            Your browser blocked the pop-out. Use the link next to the zone to
            open Broadcastify in a new tab.
          </p>
        ) : null}
      </div>
      <div className="row">
        <div className="col-md-6">
          <fieldset id="streamlist">
            <legend>Scanner feeds</legend>
            <div className="stream-options scanner-feed-list mb-3">
              {loading ? (
                <p>Loading...</p>
              ) : streams.length ? (
                streams.map((stream) => {
                  const { slug, broadcastifyId } = stream;
                  const name = stream.shortname ?? stream.name;
                  const label = broadcastifyId ? name.replace(" [ENC]", "") : name;
                  const zoneOpen = Boolean(
                    broadcastifyId && zonePlayers.has(broadcastifyId),
                  );
                  return (
                    <div className="scanner-feed-row" key={slug}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`checkbox-${slug}`}
                        value={slug}
                        disabled={stream.disabled || zoneOpen}
                        checked={zoneOpen || enabled.includes(slug)}
                        onChange={(event) => {
                          if (broadcastifyId) openZone(broadcastifyId);
                          else toggle(slug, event.target.checked);
                        }}
                      />
                      <label
                        className="form-check-label scanner-feed-name"
                        htmlFor={`checkbox-${slug}`}
                      >
                        {label}
                      </label>
                      {broadcastifyId ? (
                        <a
                          className="scanner-feed-action"
                          href={`https://www.broadcastify.com/listen/feed/${broadcastifyId}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${label} on Broadcastify in a new tab`}
                          title="Open on Broadcastify in a new tab"
                        >
                          <svg className="cid-icon" aria-hidden="true">
                            <use href="#cid-Link" />
                          </svg>
                        </a>
                      ) : null}
                      <a
                        href={`/audio/live/${slug}`}
                        className="scanner-feed-action"
                        aria-label={`Archive for ${name}`}
                        title={`View archive for ${name}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 3h18v4H3zM5 7v14h14V7M10 11h4" />
                        </svg>
                      </a>
                    </div>
                  );
                })
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
