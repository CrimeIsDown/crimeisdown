import { site } from "@/lib/site";

export function buildCanonical(pathname: string) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  return new URL(normalized, site.domain).toString();
}

export function buildTitle(title?: string) {
  return title ? `${title} | ${site.title}` : site.title;
}
