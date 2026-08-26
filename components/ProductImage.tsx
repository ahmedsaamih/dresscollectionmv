import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { parseImageValue } from '@/lib/image-value';

/** Renders a product's image area — a real photo via next/image when the
 * stored value is a URL, falling back to the current CSS-background
 * rendering for gradient placeholders. */
export function ProductImage({ img, href, className, children, alt = '', sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px' }: {
  img: string;
  href?: string;
  className?: string;
  children?: React.ReactNode;
  alt?: string;
  sizes?: string;
}) {
  const value = parseImageValue(img);
  const shared = {
    className: `product-media ${className ?? ''}`,
    style: value.type === 'css' ? { background: value.background } : undefined,
    'data-product-image': '',
  };
  const content = (
    <>
      {value.type === 'url' && (
        <Image src={value.src} alt={alt} fill sizes={sizes} style={{ objectFit: 'cover' }} />
      )}
      {children}
    </>
  );
  return href
    ? <Link href={href} {...shared}>{content}</Link>
    : <div {...shared}>{content}</div>;
}
