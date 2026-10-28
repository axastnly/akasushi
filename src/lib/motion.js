/* ── Motion runtime: GSAP + ScrollTrigger + Lenis ─────────────────────────── */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/* iOS/Android collapse their toolbars while you scroll, which fires `resize`
   mid-scroll. Without this, every pinned section re-measures and visibly
   jumps. It is the single most important setting for mobile pinning. */
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };

/** One matchMedia context for every scene, so reduced-motion is live-reactive. */
export const mm = gsap.matchMedia();

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const MOTION_REDUCED = "(prefers-reduced-motion: reduce)";

const reduceMotion = window.matchMedia(MOTION_REDUCED);

/**
 * Smooth scrolling, wired into GSAP's ticker so ScrollTrigger and Lenis read
 * the same frame. Returns null when the visitor asked for reduced motion —
 * then the page is plain native scroll.
 */
export function startSmoothScroll() {
  if (reduceMotion.matches) return null;

  const lenis = new Lenis({
    /* 0.1 is Lenis's own default — it's been this since the project
       started, not a deliberate choice, and reads as sluggish: at 0.1,
       the smoothed scroll only closes ~10% of the remaining distance to
       its target per frame, so it takes a good half-second to fully
       settle after you stop scrolling. 0.22 still smooths (not raw/native
       scroll-snap) but catches up roughly twice as fast. wheelMultiplier
       is the OTHER lever "slow" usually means — how far a given scroll
       gesture actually moves the page, independent of how quickly it
       catches up — nudged up alongside it for the same reason. */
    lerp: 0.22,
    wheelMultiplier: 1.2,
    smoothWheel: true,
    /* Leave touch scrolling native. Hijacking it costs frames on iPhone and
       is what makes pinned sections feel like they stick or drift in Safari. */
    syncTouch: false,
    anchors: { offset: 0, duration: 1.2 },
  });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/** Re-measure once late-arriving fonts and images have settled layout. */
export function refreshWhenSettled() {
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}

/** Flags <body> as soon as the page has moved, so the scroll prompt can go. */
export function trackScrollState() {
  const update = () => {
    document.body.classList.toggle("has-scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}
