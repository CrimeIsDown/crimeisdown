import { useEffect, useRef, useState, type FormEvent } from "react";
import { legacyApi, patreonLoginUrl } from "@/lib/legacy-api";

type Channel = { id: number; service: string; path: string };
type LocationRule = {
  address: string;
  geo: { lat: number; lng: number };
  radius: number | null;
  travel_time: number | null;
};
type Subscription = {
  id: number;
  name: string;
  enabled: boolean;
  keywords: string[] | string | null;
  ignore_keywords: string[] | string | null;
  topic: string;
  notification_channels: number[];
  location: LocationRule | null;
};
type Talkgroup = { value: string; label: string; system: string };
type Department = { group: string; talkgroups: Talkgroup[] };
type System = { group: string; talkgroups: Department[] };
type User = {
  is_admin?: boolean;
  patreon_tier?: { features?: { transcript_geosearch?: boolean } };
};
const serviceNames: Record<string, string> = {
  ntfy: "ntfy.crimeisdown.com",
  tgram: "Telegram",
  ses: "Email",
  sns: "SMS",
};
function lines(value: Subscription["keywords"]): string {
  if (typeof value === "string") {
    try {
      return lines(JSON.parse(value));
    } catch {
      return value;
    }
  }
  return Array.isArray(value) ? value.join("\n") : "";
}
function strings(value: FormDataEntryValue | null) {
  const result = String(value || "").split("\n");
  return result.length === 1 && result[0] === "" ? null : result;
}

export default function NotificationSettings() {
  const [user, setUser] = useState<User | null | undefined>();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [talkgroups, setTalkgroups] = useState<System[]>([]);
  const [channel, setChannel] = useState<Channel>();
  const [subscription, setSubscription] = useState<Subscription>();
  const [tab, setTab] = useState("subscriptions");
  const [service, setService] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminConfig, setAdminConfig] = useState<unknown>();
  const subscriptionForm = useRef<HTMLFormElement>(null);
  const address = useRef<HTMLInputElement>(null);
  const latitude = useRef<HTMLInputElement>(null);
  const longitude = useRef<HTMLInputElement>(null);
  const mapLink = useRef<HTMLAnchorElement>(null);
  const geo = user?.patreon_tier?.features?.transcript_geosearch;
  async function reload() {
    const [c, s, t] = await Promise.all([
      legacyApi<Channel[]>("/api/notificationChannels"),
      legacyApi<Subscription[]>("/api/transcriptSubscriptions"),
      legacyApi<System[]>("/api/searchTalkgroups"),
    ]);
    setChannels(c);
    setSubscriptions(s);
    setTalkgroups(t);
  }
  useEffect(() => {
    let active = true;
    void legacyApi<User>("/api/user")
      .then(async (value) => {
        if (active) {
          setUser(value);
          try {
            await reload();
          } catch (e) {
            setError(String(e));
          }
        }
      })
      .catch((e) => {
        if (active) {
          setUser(null);
          if (!String(e).includes("401")) setError(String(e));
        }
      });
    return () => {
      active = false;
    };
  }, []);
  // Google is loaded asynchronously by the shared layout. Dispose polling on navigation.
  useEffect(() => {
    if (!geo || tab !== "subscriptions") return;
    let listener: { remove(): void } | undefined;
    const timer = setInterval(() => {
      const maps = (
        window as unknown as {
          google?: {
            maps?: {
              places?: {
                Autocomplete: new (
                  element: HTMLInputElement,
                  options: unknown,
                ) => {
                  addListener(
                    event: string,
                    cb: () => void,
                  ): { remove(): void };
                  getPlace(): {
                    geometry?: { location: { lat(): number; lng(): number } };
                  };
                };
              };
            };
          };
        }
      ).google?.maps;
      if (!address.current || !maps?.places) return;
      clearInterval(timer);
      const autocomplete = new maps.places.Autocomplete(address.current, {
        bounds: {
          north: 42.8781,
          south: 40.8781,
          east: -86.6298,
          west: -88.6298,
        },
        componentRestrictions: { country: "us" },
        fields: ["geometry", "name", "address_components"],
        strictBounds: false,
      });
      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) return;
        const lat = place.geometry.location.lat(),
          lng = place.geometry.location.lng();
        if (latitude.current) latitude.current.value = String(lat);
        if (longitude.current) longitude.current.value = String(lng);
        if (mapLink.current)
          mapLink.current.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      });
    }, 250);
    return () => {
      clearInterval(timer);
      listener?.remove();
    };
  }, [geo, tab, subscription?.id]);
  async function mutate(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function editSubscription(value: Subscription) {
    setSubscription(value);
    requestAnimationFrame(() =>
      document
        .getElementById("subscription-form-heading")
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }
  async function saveChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await mutate(async () => {
      await legacyApi(
        `/api/notificationChannels${channel ? `/${channel.id}` : ""}`,
        channel ? "PUT" : "POST",
        { service: data.get("service"), path: data.get("path") },
      );
      setChannel(undefined);
      setService("");
      form.reset();
    });
  }
  async function saveSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const topics = data.getAll("topic").map(String),
      selected = data.getAll("notification_channels").map(Number);
    if (!topics.length) {
      setError("You must select at least one talkgroup to match.");
      return;
    }
    if (!selected.length) {
      setError("You must select at least one notification channel.");
      return;
    }
    const keywords = strings(data.get("keywords"));
    const locationAddress = String(data.get("address") || "");
    if (
      !keywords &&
      !locationAddress &&
      selected.some(
        (id) => channels.find((c) => Number(c.id) === id)?.service !== "ntfy",
      )
    ) {
      setError("You must enter at least one keyword or address.");
      return;
    }
    let location: LocationRule | null = null;
    if (locationAddress) {
      const lat = Number(data.get("lat")),
        lng = Number(data.get("lng"));
      if (
        !data.get("lat") ||
        !data.get("lng") ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        setError("You must select a valid address from the autocomplete.");
        return;
      }
      if (!data.get("radius") && !data.get("travel_time")) {
        setError("You must enter a radius or travel time for the address.");
        return;
      }
      location = {
        address: locationAddress,
        geo: { lat, lng },
        radius: data.get("radius") ? Number(data.get("radius")) : null,
        travel_time: data.get("travel_time")
          ? Number(data.get("travel_time"))
          : null,
      };
    }
    // Preserve location rules when editing with a tier that cannot edit geosearch.
    await mutate(async () => {
      await legacyApi(
        `/api/transcriptSubscriptions${subscription ? `/${subscription.id}` : ""}`,
        subscription ? "PUT" : "POST",
        {
          name: data.get("name"),
          enabled: data.get("enabled") === "on",
          keywords,
          ignore_keywords: strings(data.get("ignore_keywords")),
          topic: topics.join("|"),
          notification_channels: selected,
          location: geo ? location : (subscription?.location ?? null),
        },
      );
      setSubscription(undefined);
      form.reset();
    });
  }
  const channelList = (selected?: number[]) => (
    <ul className="list-group">
      {channels
        .filter((c) => !selected || selected.map(Number).includes(Number(c.id)))
        .map((c) => (
          <li className="list-group-item" key={c.id}>
            <div className="d-flex justify-content-between">
              <span>
                <span className="badge bg-primary me-2">
                  {serviceNames[c.service] || c.service}
                </span>
                {c.path}
              </span>
              {!selected && (
                <span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm me-2"
                    aria-label={`Edit ${c.path}`}
                    disabled={busy}
                    onClick={() => {
                      setChannel(c);
                      setService(c.service);
                    }}
                  >
                    <svg className="cid-icon" aria-hidden="true">
                      <use href="#cid-Pencil" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    aria-label={`Delete ${c.path}`}
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Delete this channel?"))
                        void mutate(async () => {
                          await legacyApi(
                            `/api/notificationChannels/${c.id}`,
                            "DELETE",
                          );
                        });
                    }}
                  >
                    <svg className="cid-icon" aria-hidden="true">
                      <use href="#cid-TrashAlt" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          </li>
        ))}
    </ul>
  );
  if (user === undefined) return <p role="status">Logging in...</p>;
  if (!user)
    return (
      <>
        <a
          href={patreonLoginUrl()}
          className="ptrn-button"
          referrerPolicy="unsafe-url"
        >
          <img src="/img/login-with-patreon.png" alt="Log in with Patreon" />
        </a>
        {error && <p role="alert">{error}</p>}
      </>
    );
  return (
    <>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <ul className="nav nav-tabs mt-0" role="tablist">
        {["subscriptions", "channels", ...(user.is_admin ? ["admin"] : [])].map(
          (name) => (
            <li className="nav-item" role="presentation" key={name}>
              <button
                className={`nav-link ${tab === name ? "active" : ""}`}
                id={`${name}-tab`}
                type="button"
                role="tab"
                aria-controls={`${name}-tab-pane`}
                aria-selected={tab === name}
                onClick={() => {
                  setTab(name);
                  if (name === "admin")
                    void legacyApi("/api/config/notifications.json")
                      .then(setAdminConfig)
                      .catch((e) => setError(String(e)));
                }}
              >
                {name[0].toUpperCase() + name.slice(1)}
              </button>
            </li>
          ),
        )}
      </ul>
      <div
        role="tabpanel"
        id={`${tab}-tab-pane`}
        aria-labelledby={`${tab}-tab`}
      >
        {tab === "channels" && (
          <div className="row mt-4">
            <div className="col-lg">
              <h2 className="fs-4">Your available notification channels</h2>
              {!channels.length && <p>No channels. Add one!</p>}
              {channelList()}
            </div>
            <div className="col-lg">
              <h2 id="channel-form-heading" className="fs-4 mt-4">
                {channel ? "Edit" : "Add a new"} notification channel
              </h2>
              <form
                id="channel-form"
                key={channel?.id || "new"}
                onSubmit={saveChannel}
              >
                <div className="mb-3">
                  <label htmlFor="serviceInput" className="form-label">
                    Service name:
                  </label>
                  <select
                    id="serviceInput"
                    name="service"
                    className="form-select"
                    required
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                  >
                    <option value="">Choose a service</option>
                    <option value="ntfy">ntfy.crimeisdown.com</option>
                    <option value="tgram">Telegram</option>
                    <option value="ses">Email</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="pathInput" className="form-label">
                    Destination:{" "}
                    {
                      (
                        {
                          tgram: "Telegram Chat ID",
                          ntfy: "ntfy Topic Name",
                          ses: "Email Address",
                        } as Record<string, string>
                      )[service]
                    }
                  </label>
                  <input
                    id="pathInput"
                    className="form-control"
                    type="text"
                    name="path"
                    defaultValue={channel?.path || ""}
                    required
                  />
                </div>
                {service === "tgram" && (
                  <div className="alert alert-info">
                    Get your Telegram chat ID by sending a message to{" "}
                    <a
                      href="https://t.me/crimeisdown_bot"
                      target="_blank"
                      rel="noreferrer"
                    >
                      @crimeisdown_bot
                    </a>
                    .
                  </div>
                )}
                {service === "ntfy" && (
                  <div className="alert alert-info">
                    This topic name can be anything you like, but it must be
                    unique across all users. It cannot contain spaces (use
                    _underscores_ instead). This topic name is what you will
                    enter onto{" "}
                    <a href="https://ntfy.crimeisdown.com/">
                      ntfy.crimeisdown.com
                    </a>{" "}
                    to subscribe to notifications.
                  </div>
                )}
                <button className="btn btn-primary" disabled={busy}>
                  {channel ? "Update" : "Add"} Channel
                </button>
              </form>
            </div>
          </div>
        )}
        {tab === "subscriptions" && (
          <div className="row mt-4">
            <div className="col-lg">
              <h2 className="fs-4">Your current subscriptions</h2>
              {!subscriptions.length && <p>No subscriptions.</p>}
              {subscriptions.map((s) => (
                <div className="card mb-4" key={s.id}>
                  <div className="card-header d-flex justify-content-between">
                    <h5 className="mt-1 mb-0">
                      {!s.enabled && (
                        <span className="badge bg-secondary me-2">
                          Disabled
                        </span>
                      )}
                      {s.name}
                    </h5>
                    <span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm me-2"
                        aria-label={`Edit ${s.name}`}
                        onClick={() => editSubscription(s)}
                      >
                        <svg className="cid-icon" aria-hidden="true">
                          <use href="#cid-Pencil" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        aria-label={`Delete ${s.name}`}
                        disabled={busy}
                        onClick={() => {
                          if (confirm("Delete this subscription?"))
                            void mutate(async () => {
                              await legacyApi(
                                `/api/transcriptSubscriptions/${s.id}`,
                                "DELETE",
                              );
                            });
                        }}
                      >
                        <svg className="cid-icon" aria-hidden="true">
                          <use href="#cid-TrashAlt" />
                        </svg>
                      </button>
                    </span>
                  </div>
                  <div className="card-body">
                    {lines(s.keywords) && (
                      <div className="mb-3">
                        <p className="fw-bold">
                          Keywords to match, one per line
                        </p>
                        <textarea
                          className="form-control"
                          value={lines(s.keywords)}
                          rows={3}
                          disabled
                        />
                      </div>
                    )}
                    {lines(s.ignore_keywords) && (
                      <div className="mb-3">
                        <p className="fw-bold">
                          Keywords to negate other keyword matches, one per line
                        </p>
                        <textarea
                          className="form-control"
                          value={lines(s.ignore_keywords)}
                          disabled
                        />
                      </div>
                    )}
                    {s.location?.address && (
                      <p className="fst-italic">
                        Will notify on calls less than{" "}
                        {s.location.radius ? `${s.location.radius} miles` : ""}{" "}
                        {s.location.radius && s.location.travel_time
                          ? "or "
                          : ""}
                        {s.location.travel_time
                          ? `${s.location.travel_time} minutes`
                          : ""}{" "}
                        away from {s.location.address}
                      </p>
                    )}
                    <p className="fw-bold">Talkgroups to match</p>
                    <ul>
                      {talkgroups.flatMap((system) =>
                        system.talkgroups.flatMap((dept) =>
                          dept.talkgroups
                            .filter((tg) =>
                              s.topic.split("|").includes(tg.value),
                            )
                            .map((tg) => (
                              <li key={tg.value}>
                                {tg.label} ({tg.system})
                              </li>
                            )),
                        ),
                      )}
                    </ul>
                    <p className="fw-bold">Will notify via:</p>
                    {channelList(s.notification_channels)}
                    {!s.enabled && (
                      <p className="mt-2 fst-italic">
                        Note: Notifications are currently disabled. Please edit
                        and re-enable the subscription to receive them.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="col-lg">
              <h2 id="subscription-form-heading" className="fs-4">
                {subscription ? "Edit" : "Add a new"} subscription
              </h2>
              <form
                ref={subscriptionForm}
                key={subscription?.id || "new"}
                id="subscription-form"
                aria-label="New subscription form"
                onSubmit={saveSubscription}
              >
                <div className="row mb-3">
                  <div className="col">
                    <label htmlFor="nameInput" className="form-label">
                      Subscription name
                    </label>
                    <input
                      id="nameInput"
                      className="form-control"
                      name="name"
                      defaultValue={subscription?.name}
                      required
                    />
                  </div>
                  <div className="col-3">
                    <div className="form-check">
                      <input
                        id="enabledInput"
                        className="form-check-input"
                        type="checkbox"
                        name="enabled"
                        defaultChecked={subscription?.enabled ?? true}
                      />
                      <label
                        className="form-check-label"
                        htmlFor="enabledInput"
                      >
                        Enabled?
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="keywordList" className="form-label">
                    Keywords to match, one per line (will be interpreted as
                    exact matches, case insensitive)
                  </label>
                  <textarea
                    id="keywordList"
                    className="form-control"
                    name="keywords"
                    rows={3}
                    defaultValue={lines(subscription?.keywords ?? null)}
                    placeholder={
                      "Examples: dead body\nperson shot\nstill and box\nstill in box"
                    }
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="ignoreKeywordList" className="form-label">
                    Keywords to prevent a notification if other keywords were
                    matched above, one per line (will be interpreted as exact
                    matches, case insensitive)
                  </label>
                  <textarea
                    id="ignoreKeywordList"
                    className="form-control"
                    name="ignore_keywords"
                    rows={1}
                    defaultValue={lines(subscription?.ignore_keywords ?? null)}
                    placeholder={"Examples: disregard\ndead body cam"}
                  />
                </div>
                {geo && (
                  <div className="mb-3">
                    <p className="fst-italic">
                      Optionally, get notified of incidents near an address of
                      your choice, based on either distance or current driving
                      time. If provided along with keywords, will only notify if
                      both keywords and location matches.
                    </p>
                    <label htmlFor="addressInput" className="form-label">
                      Address
                    </label>
                    <div className="input-group">
                      <input
                        ref={address}
                        id="addressInput"
                        className="form-control"
                        name="address"
                        defaultValue={subscription?.location?.address}
                        onInput={() => {
                          if (latitude.current) latitude.current.value = "";
                          if (longitude.current) longitude.current.value = "";
                        }}
                      />
                      <a
                        ref={mapLink}
                        className="btn btn-secondary"
                        href={`https://www.google.com/maps/search/?api=1&query=${subscription?.location?.geo.lat},${subscription?.location?.geo.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on map
                      </a>
                    </div>
                    <input
                      ref={latitude}
                      type="hidden"
                      name="lat"
                      defaultValue={subscription?.location?.geo.lat}
                    />
                    <input
                      ref={longitude}
                      type="hidden"
                      name="lng"
                      defaultValue={subscription?.location?.geo.lng}
                    />
                    <div className="row mt-3">
                      <div className="col">
                        <label htmlFor="radiusInput" className="form-label">
                          Radius (miles)
                        </label>
                        <input
                          className="form-control"
                          id="radiusInput"
                          type="number"
                          name="radius"
                          min="0"
                          max="100"
                          step="0.1"
                          defaultValue={subscription?.location?.radius ?? ""}
                        />
                      </div>
                      <div className="col">
                        <label htmlFor="travelTimeInput" className="form-label">
                          Travel time (minutes)
                        </label>
                        <input
                          className="form-control"
                          id="travelTimeInput"
                          type="number"
                          name="travel_time"
                          min="0"
                          max="60"
                          step="1"
                          defaultValue={
                            subscription?.location?.travel_time ?? ""
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
                <fieldset className="row mb-3">
                  <legend>Talkgroups to match</legend>
                  <i>Scroll for a full list.</i>
                  <div className="talkgroup-list row">
                    {talkgroups.map((system) => (
                      <div key={system.group}>
                        <h4 className="mt-3">{system.group}</h4>
                        {system.talkgroups.map((dept) => (
                          <div key={dept.group}>
                            <p className="mt-3">
                              <strong>{dept.group}</strong>
                            </p>
                            <div className="row">
                              {dept.talkgroups.map((tg) => (
                                <div className="col-md-4" key={tg.value}>
                                  <div className="form-check">
                                    <input
                                      id={`talkgroup_${tg.value}`}
                                      className="form-check-input"
                                      type="checkbox"
                                      name="topic"
                                      value={tg.value}
                                      defaultChecked={subscription?.topic
                                        .split("|")
                                        .includes(tg.value)}
                                    />
                                    <label
                                      className="form-check-label"
                                      htmlFor={`talkgroup_${tg.value}`}
                                    >
                                      {tg.label}
                                    </label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="mb-3">
                  <legend>Notification channels to send on</legend>
                  {!channels.length && <p>No channels. Add one!</p>}
                  <ul className="list-group">
                    {channels.map((c) => (
                      <li className="list-group-item" key={c.id}>
                        <input
                          className="form-check-input"
                          id={`channel_${c.id}`}
                          type="checkbox"
                          name="notification_channels"
                          value={c.id}
                          defaultChecked={subscription?.notification_channels
                            .map(Number)
                            .includes(Number(c.id))}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`channel_${c.id}`}
                        >
                          <span className="badge bg-primary ms-2 me-2">
                            {serviceNames[c.service]}
                          </span>
                          {c.path}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
                <button className="btn btn-primary" disabled={busy}>
                  {subscription ? "Update" : "Add"} Subscription
                </button>
              </form>
            </div>
          </div>
        )}
        {tab === "admin" && (
          <pre className="mt-4">{JSON.stringify(adminConfig, null, 2)}</pre>
        )}
      </div>
    </>
  );
}
