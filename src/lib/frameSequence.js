/* ── Mobile frame-sequence scrubbing ──────────────────────────────────────
   iOS Safari won't paint a `currentTime` seek on a <video> that's never
   actually been played (see the priming fix in scene-00-threshold.js) —
   and even primed, scrubbing a 25s video by seeking is still fighting the
   decoder on real phone hardware. Desktop's video scrub already works
   fine and stays as-is; mobile instead draws pre-extracted frames (see
   scripts/extract-frames.mjs) onto a <canvas>, driven by the same scroll
   progress the video's currentTime would have used. */

const MOBILE_BREAKPOINT = "(max-width: 47.99em)";
/* Matches the breakpoint already used elsewhere (chrome.css, scenes.css)
   rather than inventing a second one. Combined with a touch check since a
   touch-but-wide device (iPad) has the same video-scrub problem a phone
   does. Computed once — device class doesn't change mid-session, so this
   doesn't need to be a live matchMedia listener. */
export const IS_MOBILE_RUNTIME =
  window.matchMedia(MOBILE_BREAKPOINT).matches ||
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0;

/* CSS hook for showing the canvas layer and hiding its video counterpart
   (or vice versa) — see .use-frame-canvas in scene-00.css. Set as a module
   side effect so it's in place before scene-00-threshold.js runs its own
   setup, regardless of import order. */
document.documentElement.classList.toggle("use-frame-canvas", IS_MOBILE_RUNTIME);

/** Caps the canvas backing-store resolution on very-high-DPR phones —
    beyond ~2.5x the frame images themselves (extracted at 1280px wide)
    are already the resolution ceiling, so a higher canvas buffer would
    just upscale blur, not add sharpness. */
const DPR_CAP = 2.5;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Draws a pre-extracted frame sequence onto a <canvas>, scrubbed by
 * `setProgress(0..1)` instead of a video's `currentTime`.
 *
 * Loading has two phases, matching the brief: `loadFirstFrame()` fetches
 * just frame 0 so the section has something to show the instant it's
 * revealed; `startSequentialLoad()` (called once scroll is approaching
 * the section, well before it's actually needed) then requests every
 * remaining frame strictly in order from the start, a handful at a time.
 * `setProgress` never leaves the canvas blank waiting on a frame that
 * hasn't arrived yet — it draws the nearest frame that HAS loaded until
 * the real target catches up.
 */
export class FrameSequencePlayer {
  constructor({ canvas, basePath, frameCount, ext = "avif", concurrency = 4 }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.basePath = basePath;
    this.frameCount = frameCount;
    this.ext = ext;
    this.concurrency = concurrency;

    this.images = new Array(frameCount).fill(null);
    this.requested = new Array(frameCount).fill(false);
    this.lastDrawnIndex = -1;
    this.targetIndex = 0;
    this.nextToRequest = 0;
    this.inFlight = 0;
    this.sequentialStarted = false;

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas);
    this._resize();
  }

  _frameUrl(i) {
    const n = String(i + 1).padStart(4, "0"); // ffmpeg's frame numbering is 1-based
    return `${this.basePath}/f_${n}.${this.ext}`;
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      if (this.lastDrawnIndex >= 0 && this.images[this.lastDrawnIndex]) {
        this._paint(this.images[this.lastDrawnIndex]);
      }
    }
  }

  loadFirstFrame() {
    return new Promise((resolve) => {
      if (this.images[0]) return resolve();
      this.requested[0] = true;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.images[0] = img;
        this._drawFrame(0);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = this._frameUrl(0);
    });
  }

  startSequentialLoad() {
    if (this.sequentialStarted) return;
    this.sequentialStarted = true;
    this._pump();
  }

  _pump() {
    while (this.inFlight < this.concurrency && this.nextToRequest < this.frameCount) {
      const i = this.nextToRequest++;
      if (!this.requested[i]) this._loadIndex(i);
    }
  }

  _loadIndex(i) {
    this.requested[i] = true;
    this.inFlight++;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      this.images[i] = img;
      this.inFlight--;
      // Scroll may have already moved past this frame while it was in
      // flight — draw it now rather than waiting for the next tick.
      if (i === this.targetIndex) this._drawFrame(i);
      this._pump();
    };
    img.onerror = () => {
      this.inFlight--;
      this._pump();
    };
    img.src = this._frameUrl(i);
  }

  _nearestLoaded(target) {
    if (this.images[target]) return target;
    for (let d = 1; d < this.frameCount; d++) {
      const back = target - d;
      const fwd = target + d;
      if (back >= 0 && this.images[back]) return back;
      if (fwd < this.frameCount && this.images[fwd]) return fwd;
      if (back < 0 && fwd >= this.frameCount) break;
    }
    return -1;
  }

  setProgress(p) {
    const target = Math.round(clamp01(p) * (this.frameCount - 1));
    this.targetIndex = target;
    const nearest = this._nearestLoaded(target);
    if (nearest === -1) return; // frame 0 itself hasn't arrived yet
    this._drawFrame(nearest);
  }

  _drawFrame(index) {
    if (index === this.lastDrawnIndex) return;
    const img = this.images[index];
    if (!img) return;
    this.lastDrawnIndex = index;
    this._paint(img);
  }

  _paint(img) {
    const { canvas, ctx } = this;
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / img.width, ch / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  destroy() {
    this._resizeObserver.disconnect();
  }
}
