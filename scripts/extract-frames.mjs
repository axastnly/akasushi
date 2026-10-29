/* ── Mobile frame-sequence extraction ─────────────────────────────────────
   Turns the two scroll-scrubbed videos (bg-wipe.mp4, finale.mp4 — bg.mp4 is
   never scrubbed, just autoplays once, so it's not part of this) into
   per-frame AVIF images for the mobile canvas player (see
   src/lib/frameSequence.js). iOS Safari won't paint a currentTime seek on a
   video that's never actually played, so mobile gets drawn frames instead
   of video scrubbing; desktop keeps the video (it already works there).

   Run manually with `npm run frames:build` whenever the source footage
   changes — this is a one-time asset-generation step, not part of the
   build. ffmpeg (via the already-installed ffmpeg-static) extracts PNG
   frames at 1280px wide / 12fps (every other frame of the 24fps source);
   sharp encodes each to AVIF. WebP was tested as a fallback but AVIF beat
   it on size at every quality setting worth shipping, so there's no WebP
   fallback — see the quality choice below. */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSETS_DIR = path.join(ROOT, "public/assets/00-threshold");
const OUT_DIR = path.join(ASSETS_DIR, "frames");

/* 60 beat both WebP q80 (the fallback format this replaces) and a visual
   check on the darkest/most gradient-heavy frames (the banding risk the
   brief specifically called out) at every section tested — see the sample
   comparison this number came from. Bump this, not the resolution, if
   banding ever actually shows up on a real device. */
const AVIF_QUALITY = 60;
const FRAME_WIDTH = 1280;
const FPS = 12;

const SECTIONS = [
  { name: "wipe", src: path.join(ASSETS_DIR, "bg-wipe.mp4") },
  { name: "finale", src: path.join(ASSETS_DIR, "finale.mp4") },
];

function extractPngFrames(srcVideo, outDir) {
  mkdirSync(outDir, { recursive: true });
  execFileSync(ffmpegPath, [
    "-y",
    "-i", srcVideo,
    "-vf", `scale=${FRAME_WIDTH}:-2,fps=${FPS}`,
    path.join(outDir, "f_%04d.png"),
    "-loglevel", "error",
  ]);
}

async function encodeAvif(pngDir, outDir) {
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(pngDir).filter((f) => f.endsWith(".png")).sort();
  let total = 0;
  for (const file of files) {
    const base = file.replace(/\.png$/, "");
    const outFile = path.join(outDir, `${base}.avif`);
    await sharp(path.join(pngDir, file)).avif({ quality: AVIF_QUALITY }).toFile(outFile);
    total += statSync(outFile).size;
  }
  return { count: files.length, totalBytes: total };
}

async function run() {
  const results = [];

  for (const section of SECTIONS) {
    console.log(`\n== ${section.name} ==`);
    const pngDir = path.join(tmpdir(), `aka-frames-${section.name}-${Date.now()}`);
    const outDir = path.join(OUT_DIR, section.name);

    console.log(`extracting PNG frames from ${path.relative(ROOT, section.src)}...`);
    extractPngFrames(section.src, pngDir);

    console.log(`encoding AVIF (q${AVIF_QUALITY})...`);
    const { count, totalBytes } = await encodeAvif(pngDir, outDir);

    rmSync(pngDir, { recursive: true, force: true });

    const mb = (totalBytes / 1024 / 1024).toFixed(2);
    const avg = (totalBytes / count / 1024).toFixed(1);
    console.log(`${count} frames, ${mb} MB total, ${avg} KB/frame avg`);
    results.push({ section: section.name, count, mb });
  }

  console.log("\n== summary ==");
  for (const r of results) {
    console.log(`${r.section}: ${r.count} frames, ${r.mb} MB`);
  }
}

run();
