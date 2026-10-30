"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  ScrollTrigger,
  mm,
  MOTION_OK,
  MOTION_REDUCED,
} from "@/lib/motion";
import { WebCodecsPlayer } from "@/lib/webcodecsPlayer";
import { asset } from "@/lib/paths";
import Button from "./Button";

/* Ported from the Vite site's scene-00-threshold.js — same four-phase
   choreography (auto intro → wipe scrub → title card → finale scrub),
   same pin/ScrollTrigger mechanics. The only real change: phases 2 and 4
   scrub WebCodecsPlayer instances instead of seeking <video> elements or
   drawing pre-extracted AVIF frames — see lib/webcodecsPlayer.ts. */

const PIN_LENGTH = "+=650%";
const WIPE_FRACTION = 0.28;
const TITLE_FRACTION = 0.22;
const BG_SHOT_FADE_FRACTION = 0.04;
const FINALE_DIM_START = 0.92;
const FINALE_DIM_MAX = 35;
const PHASE1_SCROLL_CAP = 0.1;
const PACE = 1.4;
// Real-time length of the phase-1 -> phase-2 handoff fade (bg--main fading
// out to reveal bgShot underneath). Scroll-driven, not time-driven, but the
// handoff itself runs on a clock so bgShot must stay locked at full opacity
// for this long regardless of how fast the user keeps scrolling — see the
// phase1EndTime gate in the ScrollTrigger onUpdate handler below.
const HANDOFF_DURATION = 1.6 * PACE;

/* Frame-rate-independent exponential lerp — smooths the discrete frame
   picks WebCodecs scrubbing produces (same reasoning as the AVIF
   version's smoothProgress). Snaps to target below SETTLE_EPSILON so it
   stops computing once converged rather than chasing forever. */
const SCRUB_SMOOTHING = 0.35;
const SETTLE_EPSILON = 0.0015;
function smoothProgress(current: number, target: number) {
  if (Math.abs(target - current) < SETTLE_EPSILON) return target;
  const rate = 1 - Math.pow(1 - SCRUB_SMOOTHING, gsap.ticker.deltaRatio());
  return current + (target - current) * rate;
}

export default function ThresholdScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLVideoElement>(null);
  const bgShotRef = useRef<HTMLImageElement>(null);
  const wipeCanvasRef = useRef<HTMLCanvasElement>(null);
  const doorLeftRef = useRef<HTMLImageElement>(null);
  const doorRightRef = useRef<HTMLImageElement>(null);
  const handleLeftRef = useRef<HTMLImageElement>(null);
  const handleRightRef = useRef<HTMLImageElement>(null);
  const handleBaseLeftRef = useRef<HTMLImageElement>(null);
  const handleBaseRightRef = useRef<HTMLImageElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const ctaGroupRef = useRef<HTMLDivElement>(null);
  const titleCardRef = useRef<HTMLDivElement>(null);
  const titleCardGradientRef = useRef<HTMLDivElement>(null);
  const titleCardTreesRef = useRef<HTMLImageElement>(null);
  const titleCardBirdsRef = useRef<HTMLImageElement>(null);
  const titleCardVignetteRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const titleLine1Ref = useRef<HTMLSpanElement>(null);
  const titleLine2Ref = useRef<HTMLSpanElement>(null);
  const finaleCanvasRef = useRef<HTMLCanvasElement>(null);
  const finaleDimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureGsapRegistered();
    const section = sectionRef.current!;
    const pin = pinRef.current!;
    const bg = bgRef.current!;
    const bgShot = bgShotRef.current;
    const wipeCanvas = wipeCanvasRef.current;
    const doorLeft = doorLeftRef.current!;
    const doorRight = doorRightRef.current!;
    const handleLeft = handleLeftRef.current;
    const handleRight = handleRightRef.current;
    const handleBaseLeft = handleBaseLeftRef.current;
    const handleBaseRight = handleBaseRightRef.current;
    const copy = copyRef.current;
    const lines = [line1Ref.current, line2Ref.current].filter(Boolean) as HTMLElement[];
    const ctaGroup = ctaGroupRef.current;
    const titleCard = titleCardRef.current;
    const titleCardGradient = titleCardGradientRef.current;
    const titleCardTrees = titleCardTreesRef.current;
    const titleCardBirds = titleCardBirdsRef.current;
    const titleCardVignette = titleCardVignetteRef.current;
    const titleCardReveals = [eyebrowRef.current, titleLine1Ref.current, titleLine2Ref.current].filter(
      Boolean,
    ) as HTMLElement[];
    const finaleCanvas = finaleCanvasRef.current;
    const finaleDim = finaleDimRef.current;
    const chrome = document.querySelector(".chrome");

    const wipePlayer = wipeCanvas ? new WebCodecsPlayer(wipeCanvas, asset("/assets/00-threshold/bg-wipe.mp4")) : null;
    const finalePlayer = finaleCanvas ? new WebCodecsPlayer(finaleCanvas, asset("/assets/00-threshold/finale.mp4")) : null;
    wipePlayer?.load();
    finalePlayer?.load();

    const mmContext = mm.add(MOTION_OK, () => {
      if (copy) gsap.set(copy, { opacity: 1 });

      const handles = [handleLeft, handleRight].filter(Boolean) as HTMLElement[];
      const doors = [doorLeft, doorRight];
      let seq: gsap.core.Timeline | null = null;
      let cancelled = false;
      let phase1Done = false;
      let phase1EndProgress = 0;
      let phase1EndTime = 0;
      let finaleVisible = false;
      let smoothedWipeProgress = 0;
      let smoothedFinaleProgress = 0;

      const titleCardTl =
        titleCard && titleCardReveals.length === 3
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

      let introPartsRemaining = 2;
      const maybeStartPhase2 = () => {
        introPartsRemaining -= 1;
        if (introPartsRemaining > 0 || cancelled) return;

        phase1Done = true;
        phase1EndProgress = st.progress;
        phase1EndTime = performance.now();
        // bg--main fades out; bgShot just sits at full opacity underneath
        // it the whole time (no fade-in of its own), so fading bg out is
        // what reveals it — a fade-out only, not a crossfade.
        gsap.to(bg, { opacity: 0, duration: HANDOFF_DURATION, ease: "sine.inOut" });
        if (bgShot) gsap.set(bgShot, { opacity: 1 });
        if (wipeCanvas) gsap.set(wipeCanvas, { opacity: 1, delay: HANDOFF_DURATION });
      };

      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: PIN_LENGTH,
        pin,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (!phase1Done && self.progress > PHASE1_SCROLL_CAP) {
            window.scrollTo(0, self.start + PHASE1_SCROLL_CAP * (self.end - self.start));
          }

          if (!phase1Done || !wipeCanvas) return;
          const remaining = 1 - phase1EndProgress;
          const rawProgress = remaining > 0 ? (self.progress - phase1EndProgress) / remaining : 1;

          const wipeProgress = gsap.utils.clamp(0, 1, rawProgress / WIPE_FRACTION);
          smoothedWipeProgress = smoothProgress(smoothedWipeProgress, wipeProgress);
          wipePlayer?.seekToProgress(smoothedWipeProgress);

          // Scroll can keep advancing wipeProgress during the handoff fade
          // (users don't pause while bg--main fades out), and
          // BG_SHOT_FADE_FRACTION is a narrow window — without this gate,
          // bgShot would already be fading back out before bg--main had
          // finished revealing it, hiding the fade almost entirely. Hold
          // bgShot at full opacity until the time-based handoff is done.
          if (bgShot && performance.now() - phase1EndTime >= HANDOFF_DURATION * 1000) {
            const shotOpacity = 1 - gsap.utils.clamp(0, 1, wipeProgress / BG_SHOT_FADE_FRACTION);
            gsap.set(bgShot, { opacity: shotOpacity });
          }

          if (titleCardTl) {
            const titleProgress = gsap.utils.clamp(0, 1, (rawProgress - WIPE_FRACTION) / TITLE_FRACTION);
            titleCardTl.progress(titleProgress);
          }

          if (finaleCanvas) {
            const finaleFraction = 1 - WIPE_FRACTION - TITLE_FRACTION;
            const finaleRaw = (rawProgress - WIPE_FRACTION - TITLE_FRACTION) / finaleFraction;
            const finaleActive = finaleRaw > 0;
            if (finaleActive !== finaleVisible) {
              finaleVisible = finaleActive;
              gsap.set(finaleCanvas, { opacity: finaleActive ? 1 : 0 });
            }
            if (finaleActive && finalePlayer) {
              const finaleProgress = gsap.utils.clamp(0, 1, finaleRaw);
              smoothedFinaleProgress = smoothProgress(smoothedFinaleProgress, finaleProgress);
              finalePlayer.seekToProgress(smoothedFinaleProgress);

              if (finaleDim) {
                const dimProgress = gsap.utils.clamp(0, 1, (finaleProgress - FINALE_DIM_START) / (1 - FINALE_DIM_START));
                gsap.set(finaleDim, { "--dim": dimProgress * FINALE_DIM_MAX });
              }
            }
          }
        },
      });

      bg.addEventListener("ended", maybeStartPhase2, { once: true });

      function whenMediaReady(media: Array<HTMLImageElement | HTMLVideoElement | null>, timeoutMs = 4000) {
        return Promise.all(
          media.filter((el): el is HTMLImageElement | HTMLVideoElement => !!el).map(
            (el) =>
              new Promise<void>((resolve) => {
                const isVideo = el.tagName === "VIDEO";
                if (isVideo) {
                  if ((el as HTMLVideoElement).readyState >= 2) return resolve();
                  el.addEventListener("loadeddata", () => resolve(), { once: true });
                } else {
                  if ((el as HTMLImageElement).complete) return resolve();
                  el.addEventListener("load", () => resolve(), { once: true });
                }
                el.addEventListener("error", () => resolve(), { once: true });
                setTimeout(resolve, timeoutMs);
              }),
          ),
        );
      }

      whenMediaReady([bg, bgShot, doorLeft, doorRight, handleLeft, handleRight]).then(() => {
        if (cancelled) return;

        seq = gsap.timeline({ defaults: { ease: "none" }, onComplete: maybeStartPhase2 });

        if (handles.length) {
          seq.to(handles, { "--fill": 100, duration: 2.0 * PACE, ease: "power2.inOut" });
        }

        seq.to(doors, { opacity: 1, duration: 1 * PACE, ease: "power1.out" }, `+=${0.15 * PACE}`);

        const doorOpenStart = seq.duration() + 0.4 * PACE;
        const doorOpenDuration = 1.8 * PACE;

        seq
          .set(bg, { opacity: 1 }, doorOpenStart)
          .call(
            () => {
              bg.currentTime = 0;
              bg.play().catch(() => {});
            },
            undefined,
            doorOpenStart,
          )
          .to(
            [doorLeft, handleLeft, handleBaseLeft].filter(Boolean) as HTMLElement[],
            { xPercent: -101, duration: doorOpenDuration, ease: "power2.inOut" },
            doorOpenStart,
          )
          .to(
            [doorRight, handleRight, handleBaseRight].filter(Boolean) as HTMLElement[],
            { xPercent: 101, duration: doorOpenDuration, ease: "power2.inOut" },
            doorOpenStart,
          )
          .to(bg, { scale: 1, duration: doorOpenDuration, ease: "power2.inOut" }, doorOpenStart)
          .fromTo(
            lines,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.5 * PACE, stagger: 0.12 * PACE, ease: "power2.out" },
            doorOpenStart + 0.7 * PACE,
          );

        if (ctaGroup) {
          seq.fromTo(
            ctaGroup,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.5 * PACE, ease: "power2.out" },
            doorOpenStart + 0.7 * PACE + 0.12 * PACE * lines.length,
          );
        }

        if (chrome) {
          seq.to(chrome, { autoAlpha: 1, duration: 0.5 * PACE }, doorOpenStart + 0.7 * PACE);
        }
      });

      return () => {
        cancelled = true;
        st.kill();
        seq?.kill();
        titleCardTl?.kill();
        bg.removeEventListener("ended", maybeStartPhase2);
        bg.pause();
        wipePlayer?.destroy();
        finalePlayer?.destroy();
        if (wipeCanvas) gsap.set(wipeCanvas, { clearProps: "all" });
        if (finaleCanvas) gsap.set(finaleCanvas, { clearProps: "all" });
        if (finaleDim) gsap.set(finaleDim, { clearProps: "all" });
        gsap.set([copy, lines, ctaGroup, bg, doorLeft, doorRight].filter(Boolean) as HTMLElement[], { clearProps: "all" });
        if (bgShot) gsap.set(bgShot, { clearProps: "all" });
        if (chrome) gsap.set(chrome, { clearProps: "all" });
        if (handleLeft) gsap.set(handleLeft, { clearProps: "all" });
        if (handleRight) gsap.set(handleRight, { clearProps: "all" });
        if (handleBaseLeft) gsap.set(handleBaseLeft, { clearProps: "all" });
        if (handleBaseRight) gsap.set(handleBaseRight, { clearProps: "all" });
        if (titleCard) gsap.set(titleCard, { clearProps: "all" });
        if (titleCardGradient) gsap.set(titleCardGradient, { clearProps: "all" });
        if (titleCardTrees) gsap.set(titleCardTrees, { clearProps: "all" });
        if (titleCardBirds) gsap.set(titleCardBirds, { clearProps: "all" });
        if (titleCardVignette) gsap.set(titleCardVignette, { clearProps: "all" });
        if (titleCardReveals.length) gsap.set(titleCardReveals, { clearProps: "all" });
      };
    });

    mm.add(MOTION_REDUCED, () => {
      const stReduced = ScrollTrigger.create({
        trigger: section,
        start: "top 80%",
        once: true,
        onEnter: () => {
          section.classList.add("is-visible");
          chrome?.classList.add("is-visible");
        },
      });

      return () => {
        stReduced.kill();
        section.classList.remove("is-visible");
        chrome?.classList.remove("is-visible");
      };
    });

    return () => {
      mmContext.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={sectionRef}
      className="scene scene--threshold"
      id="scene-00"
      data-scene="00"
      aria-label="Chapter 00, Threshold"
    >
      <div className="scene__pin" ref={pinRef}>
        <div className="threshold" aria-hidden="true">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={bgRef}
            className="threshold__bg threshold__bg--main"
            src={asset("/assets/00-threshold/bg.mp4")}
            width={1280}
            height={720}
            muted
            playsInline
            preload="auto"
          />
          <canvas ref={wipeCanvasRef} className="threshold__bg threshold__bg--wipe-canvas" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={bgShotRef}
            className="threshold__bg-shot"
            src={asset("/assets/00-threshold/bg-first-shot.webp")}
            alt=""
            width={1920}
            height={1080}
            aria-hidden="true"
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={doorLeftRef}
            className="threshold__door threshold__door--left"
            src={asset("/assets/00-threshold/door-left.webp")}
            alt=""
            width={1376}
            height={2562}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleBaseLeftRef}
            className="threshold__handle-base threshold__handle-base--left"
            src={asset("/assets/00-threshold/handle-left-base.svg")}
            alt=""
            width={1375}
            height={2560}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleLeftRef}
            className="threshold__handle threshold__handle--left"
            src={asset("/assets/00-threshold/handle-left.svg")}
            alt=""
            width={1375}
            height={2560}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={doorRightRef}
            className="threshold__door threshold__door--right"
            src={asset("/assets/00-threshold/door-right.webp")}
            alt=""
            width={1375}
            height={2562}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleBaseRightRef}
            className="threshold__handle-base threshold__handle-base--right"
            src={asset("/assets/00-threshold/handle-right-base.svg")}
            alt=""
            width={1375}
            height={2560}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleRightRef}
            className="threshold__handle threshold__handle--right"
            src={asset("/assets/00-threshold/handle-right.svg")}
            alt=""
            width={1375}
            height={2560}
            decoding="async"
          />
        </div>

        <div className="scene__copy" ref={copyRef}>
          <div className="scene__copy-content">
            <p className="display">
              <span className="display__line" ref={line1Ref}>
                A Taste Of Japan
              </span>
              <span className="display__line" ref={line2Ref}>
                An Experience Beyond
              </span>
            </p>
            <div className="scene__cta-group" ref={ctaGroupRef}>
              <Button href="#reserve" variant="primary" aria-label="Reserve a table">
                Reserve
              </Button>
              <Button href="#menu" variant="secondary" aria-label="View menu">
                View Menu
              </Button>
            </div>
          </div>
        </div>

        <div className="title-card" ref={titleCardRef} aria-hidden="true">
          <div className="title-card__world">
            <div className="title-card__gradient" ref={titleCardGradientRef} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={titleCardTreesRef}
              className="title-card__trees"
              src={asset("/assets/01-unknown/trees.webp")}
              alt=""
              width={567}
              height={683}
              decoding="async"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={titleCardBirdsRef}
              className="title-card__birds"
              src={asset("/assets/01-unknown/birds.webp")}
              alt=""
              width={533}
              height={623}
              decoding="async"
            />
          </div>
          <div className="title-card__copy">
            <p className="title-card__eyebrow" data-reveal ref={eyebrowRef}>
              from
            </p>
            <p className="title-card__title">
              <span className="title-card__title-line" data-reveal ref={titleLine1Ref}>
                The Heart
              </span>
              <span className="title-card__title-line" data-reveal ref={titleLine2Ref}>
                Of Japan
              </span>
            </p>
          </div>
          <div className="title-card__vignette" ref={titleCardVignetteRef} aria-hidden="true" />
        </div>

        <canvas ref={finaleCanvasRef} className="finale__canvas" aria-hidden="true" />
        <div className="finale__dim" ref={finaleDimRef} aria-hidden="true" />
      </div>
    </section>
  );
}
