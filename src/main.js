import "./styles/main.css";

import { startSmoothScroll, refreshWhenSettled, trackScrollState } from "./lib/motion.js";
import { scenes } from "./scenes/index.js";

/* TEMPORARY — on-screen error display for diagnosing the mobile freeze.
   Mobile Safari gives no console without a cable + a Mac; this makes any
   crash visible directly on the phone's screen instead. Remove once the
   root cause is found. */
function showFatalError(message) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;inset:0;z-index:999999;background:#200;color:#fff;" +
    "font:13px/1.4 monospace;padding:1rem;overflow:auto;white-space:pre-wrap;" +
    "border:4px solid red;";
  el.textContent = "SITE CRASHED:\n\n" + message;
  document.body.appendChild(el);
}
window.addEventListener("error", (e) => {
  showFatalError(`${e.message}\n${e.filename}:${e.lineno}:${e.colno}\n\n${e.error?.stack || ""}`);
});
window.addEventListener("unhandledrejection", (e) => {
  showFatalError(`Unhandled promise rejection: ${e.reason?.message || e.reason}\n\n${e.reason?.stack || ""}`);
});

/* Chrome (and some others) restore the previous scroll position on a
   plain refresh by default — on a site this scroll-driven, reloading
   mid-scene lands with GSAP's ScrollTrigger still mid-setup fighting an
   already-restored position, which reads as broken rather than helpful.
   There's only ever the one page right now, so this is unconditional;
   if the site ever grows real routes, scope it to the homepage path.

   Three layers, not one — confirmed by instrumenting an actual reload
   (not just reasoning about it) that each on its own gets silently
   undone:
     1. This early reset handles the common case and is all
        reduced-motion visitors need (no Lenis there to fight it).
     2. Once Lenis is running (see boot()), a raw window.scrollTo alone
        isn't enough — Lenis tracks its own internal target scroll
        position independently and corrects the native position back
        toward that target on its next animation frame, so Lenis's own
        API has to be told too, or it quietly wins a moment later.
     3. Neither of those beats what turned out to be the real culprit:
        Chrome can fire ITS OWN restore — bypassing window.scrollTo
        entirely, so nothing here can intercept or preempt it — timed to
        land right around the page's 'load' event, after both of the
        above have already run. A short delay past 'load' is what
        actually wins that race, confirmed by tracing the exact scroll
        events firing on a real reload: Chrome's late jump consistently
        lands within ~100ms of 'load', so 300ms afterward is comfortably
        past it without being perceptible as a delay to anyone watching. */
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

function boot() {
  const lenis = startSmoothScroll();
  lenis?.scrollTo(0, { immediate: true, force: true });

  /* Guards the delayed correction below against undoing a visitor who's
     already genuinely scrolling by the time it fires — 'load' can take a
     couple of seconds on a slow connection (this page preloads sizeable
     video), which is plenty of time for someone to start reading before
     Chrome's own late restore (and our correction for it) lands. Real
     input only, not the 'scroll' event itself — that fires for Chrome's
     own restore too, which is exactly what shouldn't count here. */
  let userInteracted = false;
  const markInteracted = () => {
    userInteracted = true;
  };
  window.addEventListener("wheel", markInteracted, { once: true, passive: true });
  window.addEventListener("touchstart", markInteracted, { once: true, passive: true });
  window.addEventListener("keydown", markInteracted, { once: true });

  window.addEventListener(
    "load",
    () => {
      setTimeout(() => {
        if (userInteracted) return;
        window.scrollTo(0, 0);
        lenis?.scrollTo(0, { immediate: true, force: true });
      }, 300);
    },
    { once: true },
  );

  trackScrollState();

  const sections = Array.from(document.querySelectorAll(".scene"));

  sections.forEach((section) => {
    scenes[section.dataset.scene]?.(section);
  });

  refreshWhenSettled();

  // TEMPORARY — see showFatalError above. Confirms boot() actually ran
  // to completion, so a frozen page with no badge means the script never
  // got this far (as opposed to running fine and something else freezing).
  const badge = document.createElement("div");
  badge.textContent = `JS booted · ${sections.length} scene(s) · lenis:${!!lenis}`;
  badge.style.cssText =
    "position:fixed;bottom:4px;left:4px;z-index:999999;background:#0a0;" +
    "color:#000;font:10px monospace;padding:2px 6px;border-radius:3px;";
  document.body.appendChild(badge);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
