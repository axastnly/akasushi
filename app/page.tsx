"use client";

import { useEffect } from "react";
import Chrome from "@/components/Chrome";
import ThresholdScene from "@/components/ThresholdScene";
import { startSmoothScroll, refreshWhenSettled, trackScrollState } from "@/lib/motion";

export default function Home() {
  useEffect(() => {
    // Ported from main.js: Chrome restores scroll position on refresh by
    // default, which fights a scroll-driven pin mid-setup. Three layers —
    // see the Vite site's main.js for the full reasoning (bg.mp4/this
    // delay specifically beats Chrome's own late-restore, which otherwise
    // lands right around 'load').
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    const lenis = startSmoothScroll();
    lenis?.scrollTo(0, { immediate: true, force: true });

    let userInteracted = false;
    const markInteracted = () => {
      userInteracted = true;
    };
    window.addEventListener("wheel", markInteracted, { once: true, passive: true });
    window.addEventListener("touchstart", markInteracted, { once: true, passive: true });
    window.addEventListener("keydown", markInteracted, { once: true });

    const onLoad = () => {
      setTimeout(() => {
        if (userInteracted) return;
        window.scrollTo(0, 0);
        lenis?.scrollTo(0, { immediate: true, force: true });
      }, 300);
    };
    window.addEventListener("load", onLoad, { once: true });

    trackScrollState();
    refreshWhenSettled();

    return () => {
      window.removeEventListener("load", onLoad);
      lenis?.destroy();
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#site-footer">
        Skip the intro
      </a>
      <Chrome />
      <main>
        <ThresholdScene />
      </main>
    </>
  );
}
