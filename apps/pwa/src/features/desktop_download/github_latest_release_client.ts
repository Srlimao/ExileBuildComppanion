import { useEffect, useState } from "react";

export const GITHUB_REPO_SLUG = "Srlimao/ExileBuildComppanion";
export const LATEST_PORTABLE_EXE_URL = `https://github.com/${GITHUB_REPO_SLUG}/releases/latest/download/ExileRelay.exe`;
export const LATEST_SETUP_EXE_URL = `https://github.com/${GITHUB_REPO_SLUG}/releases/latest/download/ExileRelay-Setup.exe`;
export const LATEST_RELEASE_PAGE_URL = `https://github.com/${GITHUB_REPO_SLUG}/releases/latest`;

export interface LatestDesktopReleaseInfo {
  tagName: string | null;
  portableUrl: string;
  setupUrl: string;
  releasePageUrl: string;
  portableSizeLabel: string | null;
}

interface CachedReleasePayload {
  fetchedAt: number;
  info: LatestDesktopReleaseInfo;
}

interface GitHubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubReleaseResponse {
  tag_name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

const CACHE_KEY = "exile_latest_release_v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

const DEFAULT_RELEASE_INFO: LatestDesktopReleaseInfo = {
  tagName: null,
  portableUrl: LATEST_PORTABLE_EXE_URL,
  setupUrl: LATEST_SETUP_EXE_URL,
  releasePageUrl: LATEST_RELEASE_PAGE_URL,
  portableSizeLabel: null,
};

function readCachedRelease(): LatestDesktopReleaseInfo | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedReleasePayload;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.info;
  } catch {
    return null;
  }
}

export function useLatestDesktopReleaseInfo(): LatestDesktopReleaseInfo {
  const [info, setInfo] = useState<LatestDesktopReleaseInfo>(() => readCachedRelease() ?? DEFAULT_RELEASE_INFO);

  useEffect(() => {
    if (readCachedRelease()) return;
    let active = true;

    void fetch(`https://api.github.com/repos/${GITHUB_REPO_SLUG}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((res) => (res.ok ? (res.json() as Promise<GitHubReleaseResponse>) : null))
      .then((data) => {
        if (!active || !data) return;
        const portableAsset =
          data.assets?.find((a) => a.name === "ExileRelay.exe") ??
          data.assets?.find((a) => a.name === "ExileCompanionHUD.exe");
        const setupAsset =
          data.assets?.find((a) => a.name === "ExileRelay-Setup.exe") ??
          data.assets?.find((a) => a.name === "ExileCompanionHUD-Setup.exe");
        const nextInfo: LatestDesktopReleaseInfo = {
          tagName: data.tag_name ?? null,
          portableUrl: portableAsset?.browser_download_url ?? LATEST_PORTABLE_EXE_URL,
          setupUrl: setupAsset?.browser_download_url ?? LATEST_SETUP_EXE_URL,
          releasePageUrl: data.html_url ?? LATEST_RELEASE_PAGE_URL,
          portableSizeLabel: portableAsset ? `${(portableAsset.size / (1024 * 1024)).toFixed(1)} MB` : null,
        };
        setInfo(nextInfo);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), info: nextInfo }));
        } catch {
          // Ignore storage quota errors
        }
      })
      .catch(() => {
        // Keep stable latest/download fallback URLs offline or on rate limits
      });

    return () => {
      active = false;
    };
  }, []);

  return info;
}
