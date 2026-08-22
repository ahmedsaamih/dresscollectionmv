'use client';
import { useEffect } from 'react';

/**
 * Shared scroll/entrance animation hook (GSAP). Pages opt elements in via:
 *   data-hero-reveal  — staggered reveal on load (above the fold)
 *   data-reveal       — fade-up; immediate if already in view, else on scroll
 *   data-parallax     — gentle vertical parallax on scroll (desktop only)
 *   data-motion-card  — short, staggered card entrance
 *   data-motion-scene — reversible decorative scroll scene
 *
 * Robustness notes:
 *  - Respects prefers-reduced-motion (elements simply appear).
 *  - Guards against React StrictMode's double-invoke + async-import race: if the
 *    effect is cleaned up before GSAP loads, we never build (and never leave an
 *    element stuck at opacity 0).
 *  - Elements already in the viewport animate immediately rather than waiting for
 *    a scroll, so nothing flashes in and then vanishes.
 *  - On any failure, every element is forced visible.
 */
export function useReveal() {
  useEffect(() => {
    const heroes = Array.from(document.querySelectorAll<HTMLElement>('[data-hero-reveal]'));
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-motion-card]'));
    const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-motion-scene]'));
    const showAll = () => [...heroes, ...reveals, ...cards, ...scenes].forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { showAll(); return; }

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    let media: { revert: () => void } | undefined;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        ctx = gsap.context(() => {
          if (heroes.length) {
            gsap.from(heroes, {
              y: 56, opacity: 0, clipPath: 'inset(0 0 100% 0)', duration: 0.9, stagger: 0.11, ease: 'power4.out',
              onComplete: () => heroes.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; }),
            });
          }

          const vh = window.innerHeight;
          reveals.forEach((el) => {
            const inView = el.getBoundingClientRect().top < vh * 0.92;
            if (inView) {
              // Visible on load → animate straight away; never left hidden.
              gsap.from(el, { y: 34, opacity: 0, duration: 0.68, ease: 'power3.out' });
            } else {
              gsap.from(el, {
                y: 42, opacity: 0, duration: 0.72, ease: 'power3.out',
                scrollTrigger: { trigger: el, start: 'top 90%', once: true },
              });
            }
          });

          cards.forEach((el, index) => {
            const inView = el.getBoundingClientRect().top < vh * 0.92;
            const vars = { y: 44, opacity: 0, duration: 0.68, delay: inView ? Math.min(index * 0.06, 0.36) : 0, ease: 'power4.out' };
            if (inView) gsap.from(el, vars);
            else gsap.from(el, { ...vars, scrollTrigger: { trigger: el, start: 'top 91%', once: true } });
          });

          const desktopMedia = gsap.matchMedia();
          media = desktopMedia;
          desktopMedia.add('(min-width: 768px)', () => {
            // Decorative surfaces may reverse; content remains visible after discovery.
            scenes.forEach((el) => {
              if (el.dataset.motionScene === 'static') return;
              const subtle = el.dataset.motionScene === 'subtle';
              gsap.fromTo(el, { y: subtle ? 8 : 44, scale: subtle ? 0.995 : 0.94, rotate: subtle ? 0 : -1.5 }, {
                y: subtle ? -8 : -44, scale: subtle ? 1.005 : 1.035, rotate: subtle ? 0 : 1.5, ease: 'none',
                scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.65 },
              });
            });
            document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((para) => {
              gsap.fromTo(para, { y: 0 }, {
                y: 72, ease: 'none',
                scrollTrigger: { trigger: para, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
              });
            });
          });
        });

        ScrollTrigger.refresh();
      })
      .catch(() => { if (!cancelled) showAll(); });

    return () => { cancelled = true; try { media?.revert(); ctx?.revert(); } catch { /* ignore */ } };
  }, []);
}
