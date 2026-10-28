/* ── Missing-asset fallback ───────────────────────────────────────────────
   Until the real photography/video is dropped into /public/assets, a media
   layer resolves to nothing and reads as an empty black frame. This flags
   each broken <img> or <video> individually (not the whole scene), so CSS
   can paint a stand-in for just that layer — e.g. doors can be real while
   the background is still a placeholder. Does nothing once a file is
   present: safe to leave in. */

const isVideo = (el) => el.tagName === "VIDEO";

export function flagMissingAssets(section) {
  const media = Array.from(section.querySelectorAll("img, video"));
  if (!media.length) return;

  const check = (el) => {
    const broken = isVideo(el) ? !!el.error : el.complete && el.naturalWidth === 0;
    el.classList.toggle("is-broken", broken);
    /* An <img> with a src that failed to load still paints the browser's
       own broken-image icon on top of whatever CSS fallback .is-broken
       supplies — color/text-indent tricks don't suppress it. An <img>
       with NO src, on the other hand, renders nothing native at all, so
       clearing it once the failure is confirmed is what actually lets the
       CSS stand-in show cleanly underneath. Only once broken is true —
       never touch a src that just hasn't finished loading yet. */
    if (broken && !isVideo(el) && el.getAttribute("src")) {
      el.removeAttribute("src");
    }
  };

  media.forEach((el) => {
    check(el);
    const ready = isVideo(el) ? el.readyState >= 1 : el.complete;
    if (ready) return;
    el.addEventListener("error", () => check(el), { once: true });
    el.addEventListener(isVideo(el) ? "loadeddata" : "load", () => check(el), { once: true });
  });
}

/**
 * Resolves once every given <img>/<video> has either finished loading or
 * failed — for an intro that reveals artwork partway through its own
 * animation (so it shouldn't start until the artwork is actually there to
 * reveal), as opposed to flagMissingAssets, which is about what to paint
 * when a layer never arrives at all. A failed element still resolves
 * (doesn't hang the intro waiting on a 404 forever) — flagMissingAssets'
 * per-layer fallback is what covers that case visually.
 *
 * Also resolves on a per-element timeout (4s default), separately from
 * the error case above — some mobile browsers (iOS Safari under Low Data
 * Mode in particular) can simply never start downloading a <video>'s
 * data on their own despite preload="auto"/muted/playsinline, so
 * 'loadeddata' never fires and never will; without this, the intro would
 * hang forever rather than just late. The video keeps loading/playing
 * normally after the timeout fires — this only stops it gating the
 * intro's start.
 */
export function whenMediaReady(media, timeoutMs = 4000) {
  return Promise.all(
    media.filter(Boolean).map(
      (el) =>
        new Promise((resolve) => {
          if (isVideo(el)) {
            if (el.readyState >= 2) return resolve(); // HAVE_CURRENT_DATA+
            el.addEventListener("loadeddata", resolve, { once: true });
          } else {
            if (el.complete) return resolve();
            el.addEventListener("load", resolve, { once: true });
          }
          el.addEventListener("error", resolve, { once: true });
          setTimeout(resolve, timeoutMs);
        }),
    ),
  );
}
