/* ── 00 · Threshold ───────────────────────────────────────────────────────
   Four phases, one pin — the whole site lives in this single scene now;
   everything that used to follow it as separate scroll-triggered scenes
   has been folded in here or removed. Phase 1 is automatic: black → the
   handle's gold light rises on its own → the doors fade in around it →
   the handle settles into the door's own handle → the doors open on their
   own → the line of copy and the site chrome arrive → her clip plays
   through to its own end. None of that is scroll-driven — it just plays,
   once, as soon as the artwork has actually finished loading.

   Phase 2 begins the instant phase 1 is genuinely done (both the GSAP
   tweens AND her clip's own playback — see maybeStartPhase2): the wipe
   clip (the fan sweeping across the lens to black) takes over, scrubbed
   directly to scroll position rather than played automatically — this is
   where scrolling actually starts doing something. "Scroll to enter"
   appears at that same moment, inviting it.

   Phase 3 — the "from The Heart Of Japan" title card — picks up right
   where phase 2 leaves off (see WIPE_FRACTION/TITLE_FRACTION below) and
   is itself entirely scroll-scrubbed, same mechanism as phase 2: its own
   GSAP timeline (fade in → text reveals → the world zooming toward the
   viewer while the text un-reveals, in reverse) is built once, paused,
   and scrubbed via .progress() off the same remapped scroll fraction
   that drives bgWipe.

   Phase 4 — the finale clip — picks up right where phase 3 leaves off,
   same scroll-scrub mechanism again: finaleVideo.currentTime tracks the
   next share of the remapped scroll fraction directly, exactly like
   bgWipe in phase 2. It only becomes visible once its own share of the
   scroll actually begins — by then phase 3's vignette has already swept
   the screen to black, so the reveal lands on a clean cut rather than a
   visible pop. Its very last stretch (the last couple of seconds — see
   FINALE_DIM_START below) settles the bottom of the frame into a modest
   dim, grounding the shot into the footer below without covering her
   figure, which sits well up the frame in the clip's closing moments
   (see FINALE_DIM_MAX).

   Nothing from phase 2 on is one-shot or time-driven, so scrolling back
   up unwinds all of it exactly as it drove forward — all the way back to
   her still frame at the top of the wipe clip ("the kimono lady"), not
   just a visual hint of reversibility.

   All four phases share one pin/ScrollTrigger rather than sequential ones
   specifically to avoid the pin-recreation flicker that comes with
   killing one ScrollTrigger's pin and immediately creating another on the
   same element — the progress remapping (phase1EndProgress,
   WIPE_FRACTION, TITLE_FRACTION) is what keeps each phase feeling like
   its own dedicated zone despite sharing the underlying pin throughout. */

import { gsap, ScrollTrigger, mm, MOTION_OK, MOTION_REDUCED } from "../lib/motion.js";
import { flagMissingAssets, whenMediaReady } from "../lib/assets.js";

/** How far past the top of the scene the pin holds, as a share of viewport.
    Covers all four phases: generous room for phase 1's ~8–9s automatic
    run not to be scrolled past before it's done, plus a deliberate scroll
    distance split three ways between phase 2 (the ~2.5s wipe clip), phase
    3 (the title card's reveal + zoom) and phase 4 (the ~23s finale clip)
    — see WIPE_FRACTION/TITLE_FRACTION below for how that remaining
    distance divides. Sized generously for the finale clip especially —
    it's the longest, richest stretch of footage in the scene, so it gets
    the most scroll room to actually scrub through rather than whipping
    past in a flick. */
const PIN_LENGTH = "+=650%";

/** Phase 1 hands off to a shared scroll-distance budget — everything from
    phase1EndProgress to the end of the pin — and these are where that
    budget splits: the first WIPE_FRACTION share scrubs the wipe clip
    (phase 2), the next TITLE_FRACTION scrubs the title card's own
    timeline (phase 3), and whatever's left (1 - both, see onUpdate)
    scrubs the finale clip (phase 4) — the biggest share, since it's by
    far the longest footage. All three phases read off the exact same
    remapped scroll fraction (see onUpdate below), so scrolling back up
    out of the finale clip unwinds the title card, then the wipe clip,
    landing back on her still frame — "the kimono lady" — with no
    separate reverse logic needed anywhere. */
const WIPE_FRACTION = 0.28;
const TITLE_FRACTION = 0.22;

/** How much of phase 2's own 0–1 progress (wipeProgress) bg-shot's
    fade spans, right at the start of it — not a one-time toggle, a
    continuous crossfade driven directly off wipeProgress like everything
    else in this scrub, which is what makes it reversible for free:
    scrolling back down through this same small window fades the still
    back in exactly as it fades bg--wipe back out, no separate reverse
    case to write. Small on purpose — this is meant to read as a brief
    settle at the seam, not a slow dissolve eating into the wipe clip's
    own runtime. */
const BG_SHOT_FADE_FRACTION = 0.04;

/** Where, within phase 4's own 0–1 progress, the bottom-up dim starts
    climbing — the clip plays clean through this much of itself first, and
    only the remaining share (1 - this) is spent darkening, reaching full
    reach exactly as the clip's own scrub reaches its end. 0.92 lines up
    with roughly the finale clip's last 2 seconds (it's ~25s long) — the
    dim is meant to read as a brief closing beat right at the very end,
    not something that's visibly underway for a big stretch of the clip. */
const FINALE_DIM_START = 0.92;

/** How far up the frame --dim is allowed to climb (as a share of its own
    100-is-"reaches the top edge" scale — see .finale__dim in
    scene-00.css). Well short of reaching the top: this is meant to
    ground the bottom of the frame into the footer, not black out most of
    the shot — her figure (head, the raised fan) sits well up the frame
    in the finale clip's last moments, and covering much past the lower
    third started hiding her entirely rather than just settling the
    scene. */
const FINALE_DIM_MAX = 35;

/** Caps how far real scroll is allowed to get ahead of phase 1's own
    autoplay timeline (handle fill, door open, bg.mp4), as a share of the
    pin's total scroll distance. phase1EndProgress (below) snapshots
    wherever scroll happens to be the moment phase 1 actually finishes —
    deliberately, so phase 2 always gets to use whatever's left, however
    far ahead that is. The failure mode that leaves unguarded: a fast
    swipe on mobile can cover a third or more of the whole pin in the few
    seconds phase 1 takes to play out (trivial on touch, much less likely
    with a mouse wheel), leaving almost nothing of "whatever's left" —
    phase 2's wipe clip and the title card then both end up compressed
    into a sliver of scroll, reading as skipped entirely. This holds
    scroll at a small ceiling until phase1Done flips, so "whatever's
    left" never shrinks to next to nothing. */
const PHASE1_SCROLL_CAP = 0.1;

/** Stretches every duration/gap in phase 1 by this much — one knob for
    its pace, rather than hand-tuning each number and losing the
    proportions between stages. Doesn't apply to phases 2 or 3 — both pace
    themselves off scroll position, not time. */
const PACE = 1.4;

export function initThreshold(section) {
  const q = gsap.utils.selector(section);

  const pin = q(".scene__pin")[0];
  const bg = q(".threshold__bg--main")[0];
  const bgShot = q(".threshold__bg-shot")[0];
  const bgWipe = q(".threshold__bg--wipe")[0];
  const doorLeft = q(".threshold__door--left")[0];
  const doorRight = q(".threshold__door--right")[0];
  const handleLeft = q(".threshold__handle--left")[0];
  const handleRight = q(".threshold__handle--right")[0];
  const handleBaseLeft = q(".threshold__handle-base--left")[0];
  const handleBaseRight = q(".threshold__handle-base--right")[0];
  const copy = q(".scene__copy")[0];
  const lines = q(".display__line");
  const scrollPrompt = q(".scroll-prompt")[0];
  const titleCard = q(".title-card")[0];
  const titleCardGradient = q(".title-card__gradient")[0];
  const titleCardTrees = q(".title-card__trees")[0];
  const titleCardBirds = q(".title-card__birds")[0];
  const titleCardVignette = q(".title-card__vignette")[0];
  const titleCardReveals = q("[data-reveal]");
  const finaleVideo = q(".finale__video")[0];
  const finaleDim = q(".finale__dim")[0];
  /* Lives outside this section (it's the site-wide header), so it isn't
     reachable through `q`. */
  const chrome = document.querySelector(".chrome");

  if (!pin || !doorLeft || !doorRight) return;

  flagMissingAssets(section);

  /* ── full motion ──────────────────────────────────────────────────────── */
  mm.add(MOTION_OK, () => {
    gsap.set(copy, { opacity: 1 });

    const handles = [handleLeft, handleRight].filter(Boolean);
    const doors = [doorLeft, doorRight];
    let seq = null;
    let cancelled = false;
    let phase1Done = false;
    let phase1EndProgress = 0;
    let finaleVisible = false;

    const revealScrollPrompt = () => {
      if (!scrollPrompt) return;
      gsap.to(scrollPrompt, {
        opacity: () => (document.body.classList.contains("has-scrolled") ? 0 : 1),
        duration: 0.5 * PACE,
      });
    };

    /* Phase 3: the title card. Built once, paused — onUpdate below drives
       it with .progress() off the same remapped scroll fraction that
       scrubs bgWipe, so it's exactly as scroll-reversible as phase 2 is.
       Reveals the text (same left→right mask-sweep the handle's gold
       light used in phase 1, reused via the shared [data-reveal]/--reveal
       mechanism), holds, then zooms toward the viewer while the text
       un-reveals the same way it arrived, in reverse.

       The zoom (scale, duration, ease) and the un-reveal are identical
       for every element — gradient, trees, birds, each title line — only
       their START times differ, paired front-to-back: gradient leaves
       with the eyebrow, trees 0.15s later with the first line, birds
       (nearest the lens) a further 0.35s after that with the last —
       a longer gap than gradient→trees gets, so the birds' turn reads as
       a distinct second beat rather than three things leaving on the
       same metronome tick. That staggering is what keeps it reading as
       one coordinated push toward the viewer rather than a flat image
       zooming, not a different zoom per layer.

       "Going past" rather than just growing: trees drift left and birds
       drift right as they zoom (xPercent alongside the scale) — each
       continuing in the direction its own side of the frame already
       implies, like passing the viewer on either side rather than
       rushing straight at them. Gradient (full-bleed, no "side" of its
       own) and the text (a separate pane un-revealing, not part of the
       world) both stay put, scale/mask only.

       Birds' box already sits flush against the screen's right edge
       (CSS right:0) — scaling it from the default center origin grows
       HALF the image further off that edge (clipped, invisible) and the
       other half toward center (the half actually visible), so it reads
       as growing toward center, not traveling right, no matter how large
       xPercent gets. Its transform-origin is pinned to the box's own
       left edge instead (see scene-00.css) so the whole image visibly
       balloons rightward from that fixed point — xPercent then reads as
       real rightward motion rather than being swallowed by the clip.
       Trees doesn't need this: its box sits at the opposite edge (left:0)
       with the clipped half already on the side that's invisible anyway,
       so its default center origin already reads correctly as leftward.

       What makes it read as *entering* rather than just enlarging: an
       aggressive expo.in ease (barely moving at first, then genuinely
       rushing by the end — a threshold being crossed, not a smooth
       glide), trees and birds picking up a cheap motion-blur-and-dim as
       they go (gradient stays crisp — it's the "world" itself, not
       something rushing past the lens) and, in the last beat, a vignette
       sweeping the whole card to black — the moment of actually passing
       through, rather than the zoom just trailing off. */
    const titleCardTl = titleCard
      ? gsap
          .timeline({ paused: true })
          .to(titleCard, { opacity: 1, duration: 0.6 }, 0)
          .fromTo(titleCardReveals[0], { "--reveal": 0 }, { "--reveal": 100, duration: 0.5 }, 0.3)
          .fromTo(titleCardReveals[1], { "--reveal": 0 }, { "--reveal": 100, duration: 0.5 }, 0.6)
          .fromTo(titleCardReveals[2], { "--reveal": 0 }, { "--reveal": 100, duration: 0.55 }, 0.85)
          .addLabel("zoom", "+=0.8")
          .to(titleCardGradient, { scale: 2.3, duration: 1.7, ease: "expo.in" }, "zoom")
          .to(
            titleCardTrees,
            { scale: 2.3, xPercent: -14, filter: "blur(7px) brightness(0.6)", duration: 1.7, ease: "expo.in" },
            "zoom+=0.15",
          )
          .to(
            titleCardBirds,
            { scale: 2.3, xPercent: 32, filter: "blur(7px) brightness(0.6)", duration: 1.7, ease: "expo.in" },
            "zoom+=0.5",
          )
          .to(titleCardReveals[0], { "--reveal": 0, duration: 0.9, ease: "power1.in" }, "zoom")
          .to(titleCardReveals[1], { "--reveal": 0, duration: 0.9, ease: "power1.in" }, "zoom+=0.15")
          .to(titleCardReveals[2], { "--reveal": 0, duration: 0.9, ease: "power1.in" }, "zoom+=0.5")
          .to(titleCardVignette, { opacity: 1, duration: 0.7, ease: "power1.in" }, "zoom+=1.6")
      : null;

    /* Phase 1 → phase 2 handoff. Waits for BOTH of phase 1's finish
       conditions, whichever lands second: the GSAP tweens in `seq`
       (door-open, copy, chrome) and bg's own 'ended' event. These aren't
       the same moment — bg's ~3s clip starts alongside the ~2.5s
       door-open tween, so in practice her clip is almost always what's
       still running after the tweens finish, and this is what actually
       gates the handoff on her clip genuinely being done, not just the
       UI animations around it. */
    let introPartsRemaining = 2;
    const maybeStartPhase2 = () => {
      introPartsRemaining -= 1;
      if (introPartsRemaining > 0 || cancelled) return;

      phase1Done = true;
      phase1EndProgress = st.progress;
      if (bgWipe) gsap.set(bgWipe, { currentTime: 0 });
      /* bg dissolves into bg-shot (the high-res still), not a hard cut —
         bgWipe sits underneath both, primed at currentTime 0 but kept
         hidden (opacity held at 0, its CSS default) until the crossfade
         actually finishes, specifically so it can never peek through
         mid-fade: it's already fully opaque the instant it's revealed,
         right as bg-shot reaches full opacity and covers it anyway.
         Plain gsap calls, not positioned on `seq` — this handoff runs
         off bg's own 'ended' event (one of two conditions this function
         waits on), not a scroll event or seq's own timeline, so it has
         no natural position within either to hang off of. From here on,
         BG_SHOT_FADE_FRACTION / the wipeProgress block below takes over
         driving bg-shot's opacity, in both directions. */
      const handoffDuration = 1.6 * PACE;
      gsap.to(bg, { opacity: 0, duration: handoffDuration, ease: "sine.inOut" });
      if (bgShot) {
        gsap.fromTo(
          bgShot,
          { opacity: 0 },
          { opacity: 1, duration: handoffDuration, ease: "sine.inOut" },
        );
      }
      if (bgWipe) gsap.set(bgWipe, { opacity: 1, delay: handoffDuration });
      revealScrollPrompt();
    };

    /* Just a hold through phase 1 — nothing here reacts to scroll
       position until phase1Done flips. From then on, onUpdate scrubs
       bgWipe directly: self.progress is remapped against
       phase1EndProgress (captured above, whatever it happened to be)
       rather than used raw, so phase 2 always starts bgWipe at exactly
       0 and finishes it at exactly scroll-end, regardless of how far
       into the shared pin scroll already was when phase 1 finished.

       Direct assignment, not an eased gsap.to() retarget — tried that
       (a short smoothing tween, reasoning it would give the decoder
       breathing room), and it read as lag, not as the clip catching up.
       Makes sense in hindsight: Lenis is already smoothing the scroll
       input itself underneath (same lesson as the cursor interaction in
       the Unknown-scene prototype elsewhere in this project) — adding a
       second smoothing layer on top just stacks delay rather than fixing
       anything. Measured separately (an isolated instrumented test, not
       a guess) that direct seeking here completes almost instantly on
       both Chromium and WebKit — ~99–100% of seeks landing in under 3ms
       — so there was never a decoder-speed problem for this to solve. */
    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: PIN_LENGTH,
      pin,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        /* See PHASE1_SCROLL_CAP above. Native window.scrollTo, not
           lenis.scrollTo — touch scrolling runs natively regardless of
           Lenis (syncTouch: false in startSmoothScroll), which is
           exactly the case this is guarding against, so this needs to
           win against real touch input, not against Lenis's own
           smoothing of wheel input. */
        if (!phase1Done && self.progress > PHASE1_SCROLL_CAP) {
          window.scrollTo(0, self.start + PHASE1_SCROLL_CAP * (self.end - self.start));
        }

        if (!phase1Done || !bgWipe) return;
        const remaining = 1 - phase1EndProgress;
        const rawProgress = remaining > 0 ? (self.progress - phase1EndProgress) / remaining : 1;

        const wipeProgress = gsap.utils.clamp(0, 1, rawProgress / WIPE_FRACTION);
        bgWipe.currentTime = wipeProgress * bgWipe.duration;

        /* bg-shot crossfades against bgWipe over the first sliver of
           wipeProgress (BG_SHOT_FADE_FRACTION) — continuously driven off
           the live scrub position, same as bgWipe.currentTime right
           above, not a one-time toggle. That's what makes it reversible
           for free: scrolling back down through this same window fades
           the still back in exactly as it fades bg--wipe back out. */
        if (bgShot) {
          const shotOpacity = 1 - gsap.utils.clamp(0, 1, wipeProgress / BG_SHOT_FADE_FRACTION);
          gsap.set(bgShot, { opacity: shotOpacity });
        }

        if (titleCardTl) {
          const titleProgress = gsap.utils.clamp(
            0,
            1,
            (rawProgress - WIPE_FRACTION) / TITLE_FRACTION,
          );
          titleCardTl.progress(titleProgress);
        }

        if (finaleVideo) {
          const finaleFraction = 1 - WIPE_FRACTION - TITLE_FRACTION;
          const finaleRaw = (rawProgress - WIPE_FRACTION - TITLE_FRACTION) / finaleFraction;
          const finaleActive = finaleRaw > 0;
          /* Toggled, not set every frame — a plain gsap.set() on every
             onUpdate would fight the browser's own paint for no reason
             once it's already in the right state. By the time this
             crosses from hidden to visible, titleCardTl has already
             finished sweeping its vignette fully opaque (titleProgress
             clamps to 1 right at this same boundary), so the cut lands on
             black either way — no fade needed here, same reasoning as
             bg's hard .set in phase 1. */
          if (finaleActive !== finaleVisible) {
            finaleVisible = finaleActive;
            gsap.set(finaleVideo, { opacity: finaleActive ? 1 : 0 });
          }
          if (finaleActive && finaleVideo.duration) {
            const finaleProgress = gsap.utils.clamp(0, 1, finaleRaw);
            finaleVideo.currentTime = finaleProgress * finaleVideo.duration;

            /* The bottom-up dim — see FINALE_DIM_START/FINALE_DIM_MAX
               above and .finale__dim in scene-00.css. Scrubbed the same
               direct way as everything else here: climbs with the last
               share of the clip's own progress, un-climbs just as
               readily scrolling back out of it. Capped well short of
               --dim 100 (which would reach the frame's own top edge) —
               her figure sits well up the frame in the clip's last
               moments, and reaching much past the lower third started
               hiding her rather than just grounding the shot. */
            if (finaleDim) {
              const dimProgress = gsap.utils.clamp(
                0,
                1,
                (finaleProgress - FINALE_DIM_START) / (1 - FINALE_DIM_START),
              );
              gsap.set(finaleDim, { "--dim": dimProgress * FINALE_DIM_MAX });
            }
          }
        }
      },
    });

    bg?.addEventListener("ended", maybeStartPhase2, { once: true });

    /* Gated on the artwork having actually finished loading (not just the
       script having run) — door-left.png alone is the better part of a
       megabyte, and starting the reveal before it's actually there would
       show it popping in mid-sequence instead of fading in deliberately. */
    whenMediaReady([bg, bgShot, bgWipe, doorLeft, doorRight, handleLeft, handleRight]).then(() => {
      if (cancelled) return;

      seq = gsap.timeline({ defaults: { ease: "none" }, onComplete: maybeStartPhase2 });

      // 1 — the handle's gold light rises against plain black (nothing
      // else is visible yet — see the opacity:0 CSS defaults on bg/door).
      // Slower than the rest of phase 1 (2.0 vs the ~1–1.4 everything
      // else here uses) — this is the first thing a visitor sees, so it
      // gets more room to read as a deliberate reveal rather than a blip.
      if (handles.length) {
        seq.to(handles, { "--fill": 100, duration: 2.0 * PACE, ease: "power2.inOut" });
      }

      // 2 — the doors fade in. The handle (gold + grey base) stays put —
      // it only ever fades IN (step 1's --fill rise); it does not fade
      // back out here. It stays fully visible, sitting on top of the
      // door as that fades in, and leaves the same way the door does:
      // sliding off with it in step 3. bg stays out of this (own step,
      // later) — bg and the doors fading in together would mean, for
      // the whole transition, the still-semi-transparent doors letting
      // the also-fading-in kimono background bleed straight through
      // them, which rather defeats "closed door" for that entire
      // window.
      seq.to(doors, { opacity: 1, duration: 1 * PACE, ease: "power1.out" }, `+=${0.15 * PACE}`);

      // 3 — a beat to register the closed door, then it opens on its own.
      // 101% rather than 100%: clears the half-pixel seam at the frame
      // edge. Each handle rides the same tween as its door (an array
      // target, identical values applied to both) so it travels in exact
      // lockstep — combined with sharing the door's own CSS sizing and
      // crop rules, this is what keeps the two pixel-aligned throughout.
      //
      // Every position below is computed from seq.duration() at the
      // moment it's captured — this timeline is plain elapsed seconds
      // (nothing scroll-driven to derive a fraction from any more, unlike
      // the old scrub version), so these are just arithmetic, not the
      // kind of thing that needs re-deriving later.
      const doorOpenStart = seq.duration() + 0.4 * PACE;
      const doorOpenDuration = 1.8 * PACE;

      seq
        /* bg becomes visible the instant the doors start sliding, not
           before — by now the doors are already fully opaque (step 2's
           fade-in finished a beat ago), so there's no transparency window
           for it to bleed through; it only ever shows in the actual
           widening gap, which is the point. A hard .set, not a fade: the
           gap is ~0px at this exact instant anyway, so there's nothing
           for a fade to smooth over, and a fade here would just reopen
           the same bleed-through window this is fixing. */
        .set(bg, { opacity: 1 }, doorOpenStart)
        /* bg is a <video> (a few seconds of her moving) — it always starts
           fresh from its first frame exactly when revealed, not wherever
           it happened to land if it had been playing unseen in the
           background already. .play() isn't a tweenable property, hence
           .call() rather than .set()/.to(). A plain function guard, not a
           tag check: this quietly does nothing if bg is ever swapped
           back to a plain <img>. Gated to this MOTION_OK branch only —
           under reduced motion, nothing ever calls .play(), so the video
           simply stays paused on its first frame, same spirit as the
           rest of this scene's reduced motion handling (no autoplay HTML
           attribute is used anywhere, specifically so this is the only
           place playback can start). */
        .call(
          () => {
            if (typeof bg.play !== "function") return;
            bg.currentTime = 0;
            bg.play().catch(() => {}); // a blocked autoplay just leaves the first frame showing
          },
          null,
          doorOpenStart,
        )
        .to([doorLeft, handleLeft, handleBaseLeft].filter(Boolean), { xPercent: -101, duration: doorOpenDuration, ease: "power2.inOut" }, doorOpenStart)
        .to([doorRight, handleRight, handleBaseRight].filter(Boolean), { xPercent: 101, duration: doorOpenDuration, ease: "power2.inOut" }, doorOpenStart)
        .to(bg, { scale: 1, duration: doorOpenDuration, ease: "power2.inOut" }, doorOpenStart)
        // 4 — copy arrives once there is a gap to read it through.
        .fromTo(
          lines,
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.5 * PACE, stagger: 0.12 * PACE, ease: "power2.out" },
          doorOpenStart + 0.7 * PACE,
        );

      // 5 — the site chrome arrives alongside the copy. autoAlpha covers
      // both opacity and visibility, so it's unfocusable/unclickable
      // until actually shown — CSS starts it hidden the same way.
      if (chrome) {
        seq.to(chrome, { autoAlpha: 1, duration: 0.5 * PACE }, doorOpenStart + 0.7 * PACE);
      }

      // 6 — phase 2's handoff (bgWipe reveal, scroll-prompt reveal) is
      // handled by maybeStartPhase2 — this timeline's own onComplete
      // above, and bg's 'ended' listener, both feed into it. Phase 3's
      // own timeline is already built (titleCardTl, above) by the time
      // any of this runs, and phase 4's finale clip is scrubbed exactly
      // like bgWipe — the ScrollTrigger's onUpdate drives both, no
      // separate handoff moment needed for either.
    });

    return () => {
      cancelled = true;
      st.kill();
      seq?.kill();
      titleCardTl?.kill();
      bg?.removeEventListener("ended", maybeStartPhase2);
      if (typeof bg.pause === "function") bg.pause();
      if (bgWipe) {
        bgWipe.pause();
        gsap.set(bgWipe, { clearProps: "all" });
      }
      if (finaleVideo) {
        finaleVideo.pause();
        gsap.set(finaleVideo, { clearProps: "all" });
      }
      if (finaleDim) gsap.set(finaleDim, { clearProps: "all" });
      gsap.set([copy, lines, bg, doorLeft, doorRight], { clearProps: "all" });
      if (bgShot) gsap.set(bgShot, { clearProps: "all" });
      if (chrome) gsap.set(chrome, { clearProps: "all" });
      if (handleLeft) gsap.set(handleLeft, { clearProps: "all" });
      if (handleRight) gsap.set(handleRight, { clearProps: "all" });
      if (handleBaseLeft) gsap.set(handleBaseLeft, { clearProps: "all" });
      if (handleBaseRight) gsap.set(handleBaseRight, { clearProps: "all" });
      if (scrollPrompt) gsap.set(scrollPrompt, { clearProps: "all" });
      if (titleCard) gsap.set(titleCard, { clearProps: "all" });
      if (titleCardGradient) gsap.set(titleCardGradient, { clearProps: "all" });
      if (titleCardTrees) gsap.set(titleCardTrees, { clearProps: "all" });
      if (titleCardBirds) gsap.set(titleCardBirds, { clearProps: "all" });
      if (titleCardVignette) gsap.set(titleCardVignette, { clearProps: "all" });
      if (titleCardReveals.length) gsap.set(titleCardReveals, { clearProps: "all" });
    };
  });

  /* ── reduced motion ───────────────────────────────────────────────────────
     No pin, no automatic sequence: the doors rest open (CSS) and the copy
     fades in when the scene is on screen. */
  mm.add(MOTION_REDUCED, () => {
    const st = ScrollTrigger.create({
      trigger: section,
      start: "top 80%",
      once: true,
      onEnter: () => {
        section.classList.add("is-visible");
        chrome?.classList.add("is-visible");
      },
    });

    return () => {
      st.kill();
      section.classList.remove("is-visible");
      chrome?.classList.remove("is-visible");
    };
  });
}
