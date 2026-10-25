import CalendarInput from "./CalendarInput";
import { useEffect, useState, type FormEvent } from "react";
import { legacyApi, patreonLoginUrl } from "@/lib/legacy-api";
import { archiveFeeds } from "@/lib/audio/data";
import { buildRangeExportPayload } from "@/lib/audio/archive";

type Job = {
  id: string;
  status: string;
  requested_hours: number;
  processed_hours: number;
  missing_hours?: string[];
  download_url?: string | null;
  error?: string | null;
};
type Account = { is_admin?: boolean; patreon_tier?: { rate?: number } };
function initialTime(hours: number) {
  const date = new Date(Date.now() - hours * 3600000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00`;
}
export default function AudioRangeExport() {
  const [account, setAccount] = useState<Account | null | undefined>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [job, setJob] = useState<Job>();
  const allowed = Boolean(
    account && (account.is_admin || Number(account.patreon_tier?.rate) >= 50),
  );
  useEffect(() => {
    void legacyApi<Account>("/api/user")
      .then(setAccount)
      .catch(() => setAccount(null));
  }, []);
  useEffect(() => {
    if (!job?.id || ["succeeded", "failed"].includes(job.status)) return;
    let disposed = false,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await legacyApi<Job>(
          `/api/audio-range-exports/${encodeURIComponent(job!.id)}`,
        );
        if (!disposed) {
          setJob(next);
          if (!["succeeded", "failed"].includes(next.status))
            timer = setTimeout(poll, 5000);
        }
      } catch (e) {
        if (!disposed) setError(String(e));
      }
    }
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [job?.id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!allowed) return;
    const data = new FormData(event.currentTarget);
    try {
      const payload = buildRangeExportPayload(
        String(data.get("feed") || ""),
        String(data.get("start_datetime") || ""),
        String(data.get("end_datetime") || ""),
      );
      setBusy(true);
      setJob(undefined);
      setJob(await legacyApi<Job>("/api/audio-range-exports", "POST", payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="audio-range-export">
      <h4>Range export (Commander+)</h4>
      <p className="text-muted">
        Combine up to 24 continuous hours into one MP3 file.
      </p>
      {account === undefined ? (
        <p className="small text-muted">Checking account access...</p>
      ) : !account ? (
        <div className="alert alert-info">
          <p className="mb-2">Log in to use range export.</p>
          <a
            className="btn btn-primary btn-sm"
            href={patreonLoginUrl()}
            referrerPolicy="unsafe-url"
          >
            Log in with Patreon
          </a>
        </div>
      ) : (
        !allowed && (
          <div className="alert alert-warning">
            <p className="mb-2">
              Range export requires Commander tier ($50/mo) or above.
            </p>
            <a
              className="btn btn-primary btn-sm"
              href="https://www.patreon.com/checkout/EricTendian/1260099"
              target="_blank"
              rel="noreferrer"
            >
              Upgrade to Commander
            </a>
          </div>
        )
      )}
      <form onSubmit={submit}>
        <div className="mb-3">
          <label htmlFor="range-feed">Radio channel</label>
          <select
            className="form-control"
            id="range-feed"
            name="feed"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select channel
            </option>
            {archiveFeeds.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="range-start-datetime">Start time (US Central)</label>
          <CalendarInput
            className="form-control"
            id="range-start-datetime"
            name="start_datetime"
            defaultValue={initialTime(2)}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="range-end-datetime">End time (US Central)</label>
          <CalendarInput
            className="form-control"
            id="range-end-datetime"
            name="end_datetime"
            defaultValue={initialTime(1)}
            required
          />
        </div>
        <button className="btn btn-primary" disabled={busy || !allowed}>
          {busy ? "Submitting..." : "Create range export"}
        </button>
      </form>
      {error && (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
        </div>
      )}
      {job && (
        <div className="card mt-3" role="status">
          <div className="card-body">
            <p className="mb-2">
              Export status:{" "}
              <span
                className={`badge text-bg-${job.status === "succeeded" ? "success" : job.status === "failed" ? "danger" : job.status === "processing" ? "warning" : "secondary"}`}
              >
                {job.status}
              </span>
            </p>
            <p className="mb-1">Requested hours: {job.requested_hours || 0}</p>
            <p className="mb-1">Processed hours: {job.processed_hours || 0}</p>
            {Boolean(job.missing_hours?.length) && (
              <div className="mt-2">
                <p className="mb-1">
                  <strong>Missing hours</strong>
                </p>
                <ul>
                  {job.missing_hours!.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {job.download_url && /^https?:/.test(job.download_url) && (
              <a
                className="btn btn-success mt-3"
                href={job.download_url}
                target="_blank"
                rel="noreferrer"
              >
                Download merged audio
              </a>
            )}
            {job.error && (
              <div className="alert alert-danger mt-3 mb-0">{job.error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
