export type HomeSearchAccount = {
  patreon_tier?: { features?: { transcript_search?: boolean } } | null;
} | null;

export function homeSearchContext(account: HomeSearchAccount, now = new Date()) {
  const paid = account?.patreon_tier?.features?.transcript_search === true;
  return {
    index: paid ? `calls_${now.toISOString().slice(0, 7).replace("-", "_")}` : "calls_demo",
    heading: paid ? "Search your local radio channels" : "Start with your part of Chicago",
    button: paid ? "Search transcripts" : "See sample transcripts",
    help: paid
      ? "We’ll find the police zone and fire channel covering your address, then open their current transcripts."
      : account
        ? "Explore sample transcripts from the police and fire channels covering your address. A Patreon tier with transcript search adds access to current traffic."
        : "We’ll find the police and fire channels covering your address and open sample transcripts. Free to try, no account needed.",
    limits: paid ? "Chicago addresses only. CPD zone traffic is delayed 30–35 minutes." : "Historical recordings · Chicago addresses only.",
  };
}

export function sirensPrefillUrl(address: string, destination = "https://sirens.app/") {
  const url = new URL(destination);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid Sirens URL");
  const place = address.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  if (place) {
    url.hash = new URLSearchParams({prompt: `What police, fire, or EMS activity has been reported near ${place} recently? Please include the times and sources.`}).toString();
  }
  return url.href;
}
