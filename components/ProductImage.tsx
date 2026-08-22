'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const CYCLE_MS = 900;

/**
 * Renders a product's image area. When multiple colour photos are uploaded,
 * hovering cycles through them (base image + each distinct colour image);
 * resets to the base image on mouse-leave.
 */
export function ProductImage({ img, colorImages, href, className, children }: {
  img: string;
  colorImages?: Record<string, string> | null;
  href?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const images = useMemo(
    () => Array.from(new Set([img, ...Object.values(colorImages ?? {})].filter(Boolean))),
    [img, colorImages],
  );
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (images.length <= 1) return;
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setIdx(i => (i + 1) % images.length), CYCLE_MS);
  };
  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIdx(0);
  };
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const shared = {
    className: `product-media ${className ?? ''}`,
    style: { background: images[idx] },
    onMouseEnter: start,
    onMouseLeave: stop,
    'data-product-image': '',
    'aria-label': href ? undefined : images.length > 1 ? 'Product image with alternate colours' : undefined,
  };
  return href
    ? <Link href={href} {...shared}>{children}</Link>
    : <div {...shared}>{children}</div>;
}
