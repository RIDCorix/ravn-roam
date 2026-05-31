export const DEFAULT_ROAM_API_URL = "http://localhost:3001";

export function serverApiBase(): string {
  return process.env.ROAM_API_URL ?? DEFAULT_ROAM_API_URL;
}
