'use client';
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
type ButtonSize = 'xs' | 'sm' | 'md';

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'disabled'> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & {
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-full transition-all cursor-pointer select-none no-underline ' +
  'uppercase tracking-[.06em] ' +
  'active:scale-[0.97] disabled:active:scale-100 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:pointer-events-none';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-none bg-rose-500 text-onPrimary font-bold ' +
    'hover:brightness-105 ' +
    'disabled:hover:brightness-100 disabled:bg-rose-500/40',
  secondary:
    'border border-rose-500/40 bg-transparent text-rose-700 font-bold ' +
    'hover:bg-rose-500/[.08] ' +
    'disabled:border-border disabled:text-muted disabled:hover:bg-transparent',
  tertiary:
    'border border-border bg-transparent text-sub font-bold ' +
    'hover:border-rose-500/35 hover:text-rose-700 ' +
    'disabled:hover:border-border disabled:hover:text-muted',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'text-[11px] px-[14px] py-2',
  sm: 'text-[12.5px] px-4 py-[13px]',
  md: 'text-[13.5px] px-6 py-[14px]',
};

/** Shared CTA button — primary/secondary/tertiary × xs/sm/md, renders as a
 * `<Link>` when `href` is passed (matches components/ProductImage.tsx's
 * href-optional-polymorphism convention), otherwise a native `<button>`.
 * Layout classes (flex-1, w-full, min-w-[Npx]...) are caller-controlled via
 * `className`, never baked in here, since they legitimately vary by container. */
export function Button({ variant = 'primary', size = 'md', className, disabled, children, href, ...rest }: ButtonProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (href) {
    if (disabled) {
      return <span aria-disabled="true" className={classes}>{children}</span>;
    }
    return (
      <Link href={href} className={classes} {...(rest as Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>)}>
        {children}
      </Link>
    );
  }

  return (
    <button disabled={disabled} className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
