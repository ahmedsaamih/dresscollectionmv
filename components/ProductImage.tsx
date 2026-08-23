'use client';
import React from 'react';
import Link from 'next/link';

/** Renders a product's image area. */
export function ProductImage({ img, href, className, children }: {
  img: string;
  href?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const shared = {
    className: `product-media ${className ?? ''}`,
    style: { background: img },
    'data-product-image': '',
  };
  return href
    ? <Link href={href} {...shared}>{children}</Link>
    : <div {...shared}>{children}</div>;
}
