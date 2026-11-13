import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(THIS_DIR, "../apps/desktop/src-tauri/icons");

function buildBadgeSvg(accentHex, innerHex) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" rx="52" fill="#09090B"/>
    <rect x="10" y="10" width="236" height="236" rx="44" fill="none" stroke="${accentHex}" stroke-width="14"/>
    <path d="M128 46 L194 128 L128 210 L62 128 Z" fill="none" stroke="${innerHex}" stroke-width="18" stroke-linejoin="round"/>
    <circle cx="128" cy="128" r="24" fill="${accentHex}"/>
  </svg>`;
}

async function renderRgbaPng(svg, size) {
  return sharp(Buffer.from(svg))
    .resize(size, size)
    .ensureAlpha()
    .png({ palette: false, compressionLevel: 9 })
    .toBuffer();
}

function buildMultiSizeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(entries.length, 4);

  const dirBuffers = [];
  let offset = 6 + entries.length * 16;

  for (const entry of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0);
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(entry.png.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirBuffers.push(dir);
    offset += entry.png.length;
  }

  return Buffer.concat([header, ...dirBuffers, ...entries.map((e) => e.png)]);
}

async function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const mainSvg = buildBadgeSvg("#6366F1", "#EAB308");
  const trayGraySvg = buildBadgeSvg("#71717A", "#D4D4D8");
  const trayGreenSvg = buildBadgeSvg("#22C55E", "#ECFDF5");
  const trayAmberSvg = buildBadgeSvg("#F59E0B", "#FEF3C7");

  const [png32, png128, png256, trayGray, trayGreen, trayAmber] = await Promise.all([
    renderRgbaPng(mainSvg, 32),
    renderRgbaPng(mainSvg, 128),
    renderRgbaPng(mainSvg, 256),
    renderRgbaPng(trayGraySvg, 64),
    renderRgbaPng(trayGreenSvg, 64),
    renderRgbaPng(trayAmberSvg, 64),
  ]);

  fs.writeFileSync(path.join(ICONS_DIR, "32x32.png"), png32);
  fs.writeFileSync(path.join(ICONS_DIR, "128x128.png"), png128);
  fs.writeFileSync(path.join(ICONS_DIR, "128x128@2x.png"), png256);
  fs.writeFileSync(path.join(ICONS_DIR, "icon.png"), png256);
  fs.writeFileSync(path.join(ICONS_DIR, "tray-gray.png"), trayGray);
  fs.writeFileSync(path.join(ICONS_DIR, "tray-green.png"), trayGreen);
  fs.writeFileSync(path.join(ICONS_DIR, "tray-amber.png"), trayAmber);

  const icoBuffer = buildMultiSizeIco([
    { size: 32, png: png32 },
    { size: 256, png: png256 },
  ]);
  fs.writeFileSync(path.join(ICONS_DIR, "icon.ico"), icoBuffer);

  console.log(`Generated Tauri RGBA PNG + ICO assets in ${ICONS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
