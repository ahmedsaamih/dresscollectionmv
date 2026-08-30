'use client';
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * Homepage hero visual. With 0-1 images it renders the original static panel
 * (gradient fallback or a single still image) unchanged. With 2+ images it
 * becomes an auto-advancing carousel: images are stacked (absolute inset-0)
 * and cross-fade via opacity — no scroll APIs involved at all, since the
 * scroll-based version wasn't reliably animating for every user. There is no
 * manual interaction with the carousel itself (no drag/wheel/touch-swipe) —
 * this is auto-advance only.
 *
 * On mount it cross-fades quickly through every image once (the "fast
 * intro"), then hands off to advancing one image every 4s. While that intro
 * is playing, page scroll is briefly captured: scrolling down doesn't move
 * the page yet, it's "spent" letting the intro finish, then normal page
 * scroll resumes. That capture is scoped to the page, not the carousel.
 */
export function HeroCarousel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const autoAdvanceStartedRef = useRef(false);

  const n = images.length;

  useEffect(() => {
    if (n < 2) return;

    // Nothing here may run before the window `load` event — only the first
    // image is fetch-priority/preloaded (see the `priority={i === 0}` prop
    // below), and this cross-fade advances `active` on a fixed timer with no
    // regard for whether that image has actually finished loading. Starting
    // it at mount raced the real network fetch on slow connections: the
    // carousel could advance past index 0 before its image ever painted, so
    // the element actually visible (and painted) when LCP was measured was
    // a later, non-prioritized image — silently defeating the `priority`
    // prop entirely. Gating everything on `load` guarantees the first image
    // has already had its chance to be the LCP element before anything else
    // is touched; on a fast connection `load` fires almost immediately, so
    // the intro still plays right away.
    let started = false;
    let cleanupIntervals = () => {};

    const begin = () => {
      if (started) return;
      started = true;

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let intervalId: number | undefined;
      let introIntervalId: number | undefined;
      let lockTimeout: number | undefined;

      // Briefly capture page scroll so the intro gets to finish before the
      // user scrolls past the hero. Only engages if the page is already at
      // the top (nothing to jack if they've scrolled down into the site),
      // never traps scrolling back up, and always releases itself — either
      // when the intro finishes or after a fixed safety timeout. Real
      // reaction time to actually attempt a scroll after the page loads
      // easily exceeds a couple seconds, so the timeout here is generous on
      // purpose — too short and the lock has usually already released before
      // anyone tries to scroll, making it look like it never worked.
      let scrollLocked = !reduced && window.scrollY < 40;
      let touchStartY = 0;
      const onWheel = (e: WheelEvent) => { if (scrollLocked && e.deltaY > 0) e.preventDefault(); };
      const onTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0]?.clientY ?? 0; };
      const onTouchMove = (e: TouchEvent) => {
        if (!scrollLocked) return;
        const dy = touchStartY - (e.touches[0]?.clientY ?? touchStartY);
        if (dy > 0) e.preventDefault();
      };
      const releaseScrollLock = () => {
        if (!scrollLocked) return;
        scrollLocked = false;
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        if (lockTimeout) window.clearTimeout(lockTimeout);
      };
      if (scrollLocked) {
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        lockTimeout = window.setTimeout(releaseScrollLock, 5000);
      }

      const startAutoAdvance = () => {
        releaseScrollLock();
        if (autoAdvanceStartedRef.current) return;
        autoAdvanceStartedRef.current = true;
        intervalId = window.setInterval(() => {
          setActive((i) => (i + 1) % n);
        }, 4000);
      };

      if (reduced) {
        startAutoAdvance();
      } else {
        // Fast intro: cross-fade through every image once in quick
        // succession, landing back on the first, then the interval above
        // picks up the normal 4s cadence right where the intro left off.
        let step = 0;
        introIntervalId = window.setInterval(() => {
          step++;
          setActive(step % n);
          if (step >= n) {
            if (introIntervalId) window.clearInterval(introIntervalId);
            introIntervalId = undefined;
            startAutoAdvance();
          }
        }, 260);
      }

      cleanupIntervals = () => {
        releaseScrollLock();
        autoAdvanceStartedRef.current = false;
        if (intervalId) window.clearInterval(intervalId);
        if (introIntervalId) window.clearInterval(introIntervalId);
      };
    };

    if (document.readyState === 'complete') {
      begin();
    } else {
      window.addEventListener('load', begin, { once: true });
    }

    return () => {
      window.removeEventListener('load', begin);
      cleanupIntervals();
    };
  }, [n]);

  if (images.length === 0) {
    return (
      <div className="relative isolate h-full rounded-[18px] overflow-hidden border border-[rgba(163,113,62,.2)]" style={{ background: 'linear-gradient(150deg,#f8f3ea,#f2e6d3)' }}>
        <StreakAndBadge />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="relative isolate h-full rounded-[18px] overflow-hidden border border-[rgba(163,113,62,.2)]">
        <Image src={images[0]} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" style={{ objectFit: 'cover' }} priority />
        <StreakAndBadge />
      </div>
    );
  }

  return (
    // isolate forces this to always create its own stacking context, so the
    // active slide's z-index stays contained in here — without it, once the
    // parent reveal wrapper settles at opacity:1 (losing the stacking
    // context that opacity<1 creates), the active slide's positive z-index
    // leaks out and paints over the parent's fade overlay, which sits right
    // next to this in the DOM with no z-index of its own.
    <div className="relative isolate h-full rounded-[18px] overflow-hidden border border-[rgba(163,113,62,.2)]">
      {images.map((src, i) => {
        const isActive = i === active;
        return (
          <div
            key={src + i}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 1 : 0 }}
          >
            <Image src={src} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" style={{ objectFit: 'cover' }} priority={i === 0} />
            {/* glass sheen */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,0) 42%,rgba(255,255,255,.05) 100%)' }} />
            {isActive && (
              <>
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 animate-streak bg-[linear-gradient(100deg,transparent,rgba(163,113,62,.08),transparent)]" />
                </div>
                <FeaturedBadge />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StreakAndBadge() {
  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 animate-streak bg-[linear-gradient(100deg,transparent,rgba(163,113,62,.08),transparent)]" />
      </div>
      <FeaturedBadge />
    </>
  );
}

function FeaturedBadge() {
  return (
    <span className="absolute top-5 right-5 text-[10.5px] font-bold tracking-[.14em] uppercase text-onPrimary bg-page/90 px-3 py-[7px] rounded-full">
      Featured
    </span>
  );
}
