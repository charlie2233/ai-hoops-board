export const ALLOWED_FORMATIVE_HOST_PERMISSIONS = [
  "https://app.formative.com/*",
  "https://formative.com/*",
  "https://*.formative.com/*",
  "https://goformative.com/*",
  "https://*.goformative.com/*"
] as const;

const FORMATIVE_ROOT_HOSTS = ["formative.com", "goformative.com"] as const;

export function isAllowedFormativeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && FORMATIVE_ROOT_HOSTS.some((host) => isHostOrSubdomain(url.hostname, host));
  } catch {
    return false;
  }
}

function isHostOrSubdomain(hostname: string, rootHost: string): boolean {
  return hostname === rootHost || hostname.endsWith(`.${rootHost}`);
}
