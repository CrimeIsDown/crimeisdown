/** Runtime bindings used by this app; the local Node config supplies an empty env. */
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
