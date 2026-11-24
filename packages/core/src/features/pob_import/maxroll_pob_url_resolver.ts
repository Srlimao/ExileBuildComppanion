const MAXROLL_POB_URL_REGEX =
  /^https?:\/\/(?:www\.)?maxroll\.gg\/poe\/pob\/([A-Za-z0-9_-]+)/i;
const MAXROLL_PLANNER_LOAD_URL_REGEX =
  /^https?:\/\/planners\.maxroll\.gg\/profiles\/load\/poe\/([A-Za-z0-9_-]+)/i;

/** Extracts the profile ID from a Maxroll PoB share link or direct profile JSON URL. */
export function extractMaxrollPobId(input: string): string | null {
  const trimmed = input.trim();
  const pageMatch = MAXROLL_POB_URL_REGEX.exec(trimmed);
  if (pageMatch?.[1]) return pageMatch[1];
  const loadMatch = MAXROLL_PLANNER_LOAD_URL_REGEX.exec(trimmed);
  return loadMatch?.[1] ?? null;
}

/** Fetches the compressed Base64 PoB code from Maxroll's public planner profile endpoint. */
export async function fetchMaxrollPobCode(
  pobId: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const endpoint = `https://planners.maxroll.gg/profiles/load/poe/${encodeURIComponent(pobId)}`;
  const response = await fetcher(endpoint, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Maxroll PoB profile returned HTTP ${response.status} (paste raw PoB export code for offline mode).`,
    );
  }
  const body = (await response.json()) as { data?: unknown };
  const nested =
    typeof body.data === "string"
      ? (JSON.parse(body.data) as { pobCode?: unknown })
      : (body.data as { pobCode?: unknown } | undefined);
  const pobCode = typeof nested?.pobCode === "string" ? nested.pobCode.trim() : "";
  if (!pobCode) {
    throw new Error("Maxroll PoB profile payload did not include a valid pobCode.");
  }
  return pobCode;
}
