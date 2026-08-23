'use client';
import React, { useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastProps {
  title: string;
  sub?: string;
  href?: string;
  hrefLabel?: string;
  onDismiss: () => void;
  variant?: 'cart' | 'success';
}

export function Toast({ title, sub, href, hrefLabel = 'View →', onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2600);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={cn(
      'fixed bottom-7 left-1/2 z-[90] flex items-center gap-3',
      'border rounded-[13px] px-[18px] py-[14px]',
      'shadow-[0_14px_44px_rgba(0,0,0,.55)]',
      'animate-[toastIn_.3s_cubic-bezier(.16,1,.3,1)]',
      '-translate-x-1/2',
      'bg-[#200c15] border-[rgba(219,87,149,.35)]',
    )}>
      <span className="w-[26px] h-[26px] rounded-full bg-rose-500 text-[#200612] inline-flex items-center justify-center">
        <Check size={15} strokeWidth={3} />
      </span>
      <div>
        <div className="text-[13px] font-bold text-[#ffe9f3]">{title}</div>
        {sub && <div className="text-[11.5px] text-charcoal-400">{sub}</div>}
      </div>
      {href && (
        <a href={href} className="ml-2 text-[12px] font-bold text-rose-500 no-underline">
          {hrefLabel}
        </a>
      )}
    </div>
  );
}
