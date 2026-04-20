export type NavItem = {
  href: string;
  label: string;
  description?: string;
  external?: boolean;
};

export type ActionLink = {
  href: string;
  label: string;
  external?: boolean;
};

export const site = {
  name: "CrimeIsDown.com",
  domain: "https://crimeisdown.com",
  sirensDomain: "https://sirens.app",
  title: "CrimeIsDown.com",
  description:
    "Taking the confusion out of monitoring Chicago crime with data-driven tools.",
  tagline: "Taking the confusion out of monitoring Chicago crime with data-driven tools.",
};

export const primaryNav: NavItem[] = [
  {
    href: "/map",
    label: "Chicago Map",
    description:
      "Look up districts, neighborhoods, wards, and recommended channels.",
  },
  {
    href: "/audio",
    label: "Scanner Audio",
    description: "Listen live, jump into archives, and open channel replays.",
  },
  {
    href: "/transcripts/search",
    label: "Transcript Search",
    description: "Search radio transcripts to find what happened faster.",
  },
  {
    href: "/transcripts/map",
    label: "Transcript Map",
    description: "Open the transcript map workflow from the public shell.",
  },
  {
    href: "/guide",
    label: "Scanner Guide",
    description: "Decode radio IDs, UCR codes, and scanner terminology.",
  },
  {
    href: "/directives",
    label: "Police Directive Changes",
    description: "Track directive change references from the public site.",
  },
];

export const authCta: ActionLink = {
  href: "https://api.crimeisdown.com/auth/redirect",
  label: "Log in with Patreon",
  external: true,
};

export const footerLinks: ActionLink[] = [
  { href: "/support", label: "Send Feedback" },
  {
    href: "https://twitter.com/EricTendian/lists/CrimeIsDown",
    label: "Follow on Twitter",
    external: true,
  },
  {
    href: "https://www.patreon.com/EricTendian",
    label: "Support on Patreon",
    external: true,
  },
  {
    href: "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=4SHEMCHJPV8KY&lc=US&item_name=CrimeIsDown%2ecom&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donate_LG%2egif%3aNonHosted",
    label: "Donate thru Paypal",
    external: true,
  },
  {
    href: "https://status.crimeisdown.com/",
    label: "Site Status",
    external: true,
  },
];

export function isNavItemActive(pathname: string, item: NavItem) {
  if (item.external) {
    return false;
  }

  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const normalizedHref = item.href.replace(/\/+$/, "") || "/";

  return (
    normalizedPathname === normalizedHref ||
    (normalizedHref !== "/" &&
      normalizedPathname.startsWith(`${normalizedHref}/`))
  );
}
