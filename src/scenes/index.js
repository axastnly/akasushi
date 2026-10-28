/* ── Scene registry ───────────────────────────────────────────────────────
   Keyed by the section's data-scene. Add an entry as each scene is built;
   sections with no entry stay as static placeholders.

   Scene 00 is the whole story for now: the "from The Heart Of Japan" title
   card and the finale clip both live inside its own pin as automatic/
   scroll-scrubbed phases rather than separate scroll-triggered scenes — see
   scene-00-threshold.js. Everything that used to follow it (scenes 01–07)
   has been removed; the page goes straight from scene 00 into the footer. */

import { initThreshold } from "./scene-00-threshold.js";

export const scenes = {
  "00": initThreshold,
};
