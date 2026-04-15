export const PORTAL_MODE_KEY = "star_id_portal_mode";

export type PortalMode = "student" | "admin";

export function getPortalMode(): PortalMode | null {
  const value = localStorage.getItem(PORTAL_MODE_KEY);
  if (value === "student" || value === "admin") return value;
  return null;
}

export function setPortalMode(mode: PortalMode): void {
  localStorage.setItem(PORTAL_MODE_KEY, mode);
}

export function clearPortalMode(): void {
  localStorage.removeItem(PORTAL_MODE_KEY);
}
