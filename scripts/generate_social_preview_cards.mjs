import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(THIS_DIR, "../apps/pwa/dist");
const OUT_DIR = path.resolve(THIS_DIR, "../apps/pwa/public");
const SANS = "Segoe UI, Arial, sans-serif";
const MONO = "Consolas, Courier New, monospace";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
};

function findBrowserExecutable() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error("No headless Chromium/Edge executable found for UI screenshot capture.");
  }
  return found;
}

function startStaticDistServer(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      const rel = reqUrl.pathname === "/" ? "index.html" : reqUrl.pathname.replace(/^\/+/, "");
      const target = path.resolve(distDir, rel);
      const filePath = target.startsWith(distDir) && fs.existsSync(target) && fs.statSync(target).isFile()
        ? target
        : path.join(distDir, "index.html");
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

async function captureViewportPng(browserPath, url, width, height, outPath, profileDir) {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    "--force-device-scale-factor=2",
    `--window-size=${width},${height}`,
    "--virtual-time-budget=5000",
    `--screenshot=${outPath}`,
    url,
  ];
  await execFileAsync(browserPath, args, { windowsHide: true, timeout: 30_000 });
  if (!fs.existsSync(outPath)) {
    throw new Error(`Headless screenshot was not written for ${url}`);
  }
}

async function frameShot(rawPath, width, height, radius = 14) {
  const resized = await sharp(rawPath)
    .resize(width, height, { fit: "cover", position: "top", kernel: "lanczos3" })
    .png()
    .toBuffer();
  const frameSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="${radius}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>
    </svg>`,
  );
  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </svg>`,
  );
  return sharp(resized)
    .composite([{ input: maskSvg, blend: "dest-in" }, { input: frameSvg }])
    .png()
    .toBuffer();
}

function badgePill(x, y, w, label, accent = "#E4E4E7", bg = "#111115", border = "#27272A") {
  return `<rect x="${x}" y="${y}" width="${w}" height="32" rx="8" fill="${bg}" stroke="${border}" stroke-width="1.2"/>
  <text x="${x + w / 2}" y="${y + 21}" text-anchor="middle" font-family="${SANS}" font-size="14" font-weight="600" fill="${accent}">${label}</text>`;
}

function buildShowcaseBaseSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1360" height="696" viewBox="0 0 1360 696">
  <rect width="1360" height="696" fill="#000000"/>
  <rect x="14" y="14" width="1332" height="668" rx="18" fill="none" stroke="#1F1F26" stroke-width="1.5"/>
  <text x="32" y="50" font-family="${SANS}" font-size="25" font-weight="800" fill="#FFFFFF">Exile Relay — Whisper Frameless UI (Live Screenshots)</text>
  <text x="32" y="74" font-family="${SANS}" font-size="15" fill="#A1A1AA">Real captured PWA views: FIELD route &amp; resistances · TOWN bench crafts &amp; vendor regex · TREE read-only 3.30.0 passive diff</text>
  <text x="32" y="106" font-family="${MONO}" font-size="13" font-weight="700" fill="#34D399">● FIELD MODE</text>
  <text x="474" y="106" font-family="${MONO}" font-size="13" font-weight="700" fill="#EAB308">● TOWN MODE</text>
  <text x="916" y="106" font-family="${MONO}" font-size="13" font-weight="700" fill="#22D3EE">● TREE MODE (PRESS P IN-GAME)</text>
</svg>`;
}

function buildOgBaseSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="76%" cy="28%" r="58%">
      <stop offset="0%" stop-color="#EAB308" stop-opacity="0.14"/>
      <stop offset="50%" stop-color="#22D3EE" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#000000"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="16" y="16" width="1168" height="598" rx="20" fill="none" stroke="#1F1F26" stroke-width="1.5"/>
  <rect x="52" y="54" width="56" height="56" rx="14" fill="#09090D" stroke="#EAB308" stroke-width="2.2"/>
  <path d="M80 64 L96 82 L80 100 L64 82 Z" fill="none" stroke="#F4F4F5" stroke-width="3.2" stroke-linejoin="round"/>
  <circle cx="80" cy="82" r="5" fill="#EAB308"/>
  <text x="124" y="79" font-family="${SANS}" font-size="14" font-weight="700" fill="#EAB308" letter-spacing="1.4">PATH OF EXILE TELEMETRY</text>
  <text x="124" y="106" font-family="${MONO}" font-size="16" font-weight="600" fill="#A1A1AA">exile-relay.dunhas.com</text>
  <text x="52" y="198" font-family="${SANS}" font-size="64" font-weight="800" fill="#FFFFFF">Exile Relay</text>
  <text x="52" y="248" font-family="${SANS}" font-size="23" font-weight="500" fill="#D4D4D8">Second-Screen &amp; In-Game Overlay Telemetry</text>
  <text x="52" y="286" font-family="${SANS}" font-size="18" fill="#A1A1AA">Zero-touch Client.txt zones, PoB bracket diffs, crafting</text>
  <text x="52" y="312" font-family="${SANS}" font-size="18" fill="#A1A1AA">bench suggestions &amp; hotkey-synced 3.30.0 passive tree.</text>
  ${badgePill(52, 362, 166, "F7 Local Overlay", "#FFFFFF", "#131318", "#3F3F46")}
  ${badgePill(230, 362, 204, "QR Mobile / Tablet HUD", "#EAB308", "#181409", "#854D0E")}
  ${badgePill(52, 406, 224, "PoB + Client.txt Live Diff", "#34D399", "#071812", "#065F46")}
  ${badgePill(288, 406, 178, "3.30.0 Passive Tree", "#22D3EE", "#07161B", "#155E75")}
  <text x="52" y="544" font-family="${SANS}" font-size="14" font-weight="600" fill="#71717A">Read-Only Telemetry · No Memory Reading · MIT Open Source</text>
  <text x="52" y="568" font-family="${SANS}" font-size="13" fill="#52525B">Live interactive demo: exile-relay.dunhas.com/?demo=1</text>
</svg>`;
}

async function main() {
  if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
    throw new Error(`Missing built PWA bundle at ${DIST_DIR}. Run pnpm run build:all first.`);
  }
  const browserPath = findBrowserExecutable();
  const { server, port } = await startStaticDistServer(DIST_DIR);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "exile-relay-shots-"));
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const base = `http://127.0.0.1:${port}/?demo=1`;
    const shots = [
      ["field_mobile.png", `${base}&mode=FIELD`, 500, 660],
      ["town_mobile.png", `${base}&mode=TOWN`, 500, 660],
      ["tree_mobile.png", `${base}&mode=TREE`, 500, 660],
      ["field_wide.png", `${base}&mode=FIELD`, 840, 620],
    ];
    for (const [idx, [file, url, w, h]] of shots.entries()) {
      const profileDir = path.join(tmpDir, `profile_${idx}`);
      await captureViewportPng(browserPath, url, w, h, path.join(tmpDir, file), profileDir);
    }

    const [fieldCard, townCard, treeCard, ogWideCard, ogTreeInset] = await Promise.all([
      frameShot(path.join(tmpDir, "field_mobile.png"), 420, 554, 14),
      frameShot(path.join(tmpDir, "town_mobile.png"), 420, 554, 14),
      frameShot(path.join(tmpDir, "tree_mobile.png"), 420, 554, 14),
      frameShot(path.join(tmpDir, "field_wide.png"), 540, 398, 14),
      frameShot(path.join(tmpDir, "tree_mobile.png"), 286, 316, 14),
    ]);

    await sharp(Buffer.from(buildShowcaseBaseSvg()))
      .composite([
        { input: fieldCard, left: 28, top: 118 },
        { input: townCard, left: 470, top: 118 },
        { input: treeCard, left: 912, top: 118 },
      ])
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT_DIR, "preview-modes-showcase.png"));

    await sharp(Buffer.from(buildOgBaseSvg()))
      .composite([
        { input: ogWideCard, left: 564, top: 44 },
        { input: ogTreeInset, left: 868, top: 274 },
      ])
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT_DIR, "og-preview.png"));

    console.log(`Captured real Whisper Frameless UI screenshots in ${OUT_DIR}`);
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
