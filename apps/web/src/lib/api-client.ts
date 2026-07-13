import type { ShotRead } from "@intent-core/contracts";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

export async function fetchShots(): Promise<ShotRead[]> {
  const response = await fetch(`${API_BASE_URL}/shots`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch shots: ${response.status}`);
  }
  return (await response.json()) as ShotRead[];
}
