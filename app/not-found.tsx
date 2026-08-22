import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-page text-body font-archivo flex flex-col">
      <div className="flex-1 flex items-center justify-center px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(700px 360px at 50% 30%,rgba(219,87,149,.08),transparent 60%)' }} />
        <div className="absolute inset-0 animate-streak opacity-20 bg-[linear-gradient(100deg,transparent,rgba(219,87,149,.06),transparent)] pointer-events-none" />
        <div className="text-center relative max-w-[520px]">
          <div
            className="font-archivo font-black leading-none tracking-[-0.04em] text-rose-700"
            style={{ fontSize: '140px', textShadow: '0 0 60px rgba(219,87,149,.3)' }}
          >
            404
          </div>
          <h1 className="font-archivo-narrow font-bold text-[30px] mt-1.5">Page not found</h1>
          <p className="text-[14.5px] text-sub mt-3 leading-[1.6]">
            The page you are after does not exist or has moved. Let us get you back to shopping.
          </p>
          <div className="flex gap-3 justify-center mt-[26px] flex-wrap">
            <Link href="/" className="no-underline bg-rose-500 text-[#200612] font-extrabold text-[14px] px-6 py-[13px] rounded-xl hover:brightness-105 transition-all">
              Back to home
            </Link>
            <Link href="/ready-made" className="no-underline border border-[rgba(0,0,0,.16)] text-body font-bold text-[14px] px-6 py-[13px] rounded-xl hover:border-[rgba(0,0,0,.3)] transition-colors">
              Shop new arrivals
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
