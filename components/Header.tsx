'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useStore } from '@/contexts/StoreContext';
import { Search, ShoppingCart, Menu, X } from 'lucide-react';

interface HeaderProps {
  active?: string;
}

export function Header({ active = '' }: HeaderProps) {
  const { counts } = useCart();
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.homepageNavigation;
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const beginNavigation = () => setNavigating(true);

  // Both the mobile menu and the search bar overlay the page (position:
  // absolute) instead of sitting in normal flow, so opening them never pushes
  // page content down. They stay mounted a beat after closing so the
  // max-height/opacity transition can play in reverse instead of the panel
  // just vanishing — "rendered" tracks that extra beat, "open" drives the
  // CSS state within it.
  const [menuRendered, setMenuRendered] = useState(false);
  const [searchRendered, setSearchRendered] = useState(false);
  const panelTimers = useRef<{ menu?: ReturnType<typeof setTimeout>; search?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    if (menuOpen) { clearTimeout(panelTimers.current.menu); setMenuRendered(true); }
    else if (menuRendered) panelTimers.current.menu = setTimeout(() => setMenuRendered(false), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);
  useEffect(() => {
    if (searchOpen) { clearTimeout(panelTimers.current.search); setSearchRendered(true); }
    else if (searchRendered) panelTimers.current.search = setTimeout(() => setSearchRendered(false), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);
  useEffect(() => () => { clearTimeout(panelTimers.current.menu); clearTimeout(panelTimers.current.search); }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearchOpen(false);
    setMenuOpen(false);
    beginNavigation();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const navLinks = [
    ...data.collections.map((cl) => ({
      key: cl.key,
      label: cl.label,
      href: cl.key === 'ready' ? '/ready-made' : cl.key === 'casual' ? '/casual-wear' : cl.key === 'accessories' ? '/accessories' : `/${cl.key}`,
    })),
    { key: 'about', label: copy.navAboutLabel, href: '/about' },
  ];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    setNavigating(false);
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (searchOpen) setSearchOpen(false);
      if (menuOpen) { setMenuOpen(false); menuButtonRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, searchOpen]);

  return (
    <header className="sticky top-0 z-50 font-archivo" aria-busy={navigating}>
      <div
        className="flex items-center justify-between gap-2 sm:gap-5 px-3 sm:px-7 py-[11px] sm:py-[13px] transition-all max-w-full"
        style={{
          background: scrolled ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.82)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,0,0,.08)',
        }}
      >
        {/* Logo */}
        <Link href="/" onClick={beginNavigation} className="flex items-center gap-[9px] sm:gap-[11px] no-underline flex-none min-w-0">
          <div className="w-[34px] h-[34px] rounded-full overflow-hidden border border-[rgba(219,87,149,.22)] relative flex-none">
            <Image src="/logo-icon.png" alt="Dress Collection" fill sizes="34px" className="object-cover" />
          </div>
          <span className="hidden min-[360px]:inline font-archivo-narrow font-bold text-[14px] sm:text-[16px] tracking-[.08em] sm:tracking-[.14em] uppercase text-body whitespace-nowrap">
            Dress Collection
          </span>
        </Link>

        {/* Nav (desktop) */}
        <nav className="hidden lg:flex items-center gap-1 ml-2" aria-label="Primary navigation">
          {data.collections.map((cl) => {
            const href = cl.key === 'ready' ? '/ready-made' : cl.key === 'casual' ? '/casual-wear' : cl.key === 'accessories' ? '/accessories' : `/${cl.key}`;
            const on = active === cl.key;
            return (
              <Link key={cl.id} href={href} onClick={beginNavigation} className={`no-underline text-[13.5px] px-[13px] py-2 rounded-lg transition-all duration-300 ${on ? 'text-rose-700 bg-[rgba(219,87,149,.1)] shadow-[inset_0_-2px_0_#db5795] font-bold' : 'text-sub hover:text-rose-700 font-medium'}`}>
                {cl.label}
              </Link>
            );
          })}
          <Link href="/about" onClick={beginNavigation} className={`no-underline text-[13.5px] px-[13px] py-2 rounded-lg transition-all duration-300 ${active === 'about' ? 'text-rose-700 bg-[rgba(219,87,149,.1)] shadow-[inset_0_-2px_0_#db5795] font-bold' : 'text-sub hover:text-rose-700 font-medium'}`}>{copy.navAboutLabel}</Link>
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-[10px] ml-auto flex-none">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="w-10 h-10 rounded-[10px] border border-[rgba(0,0,0,.1)] bg-transparent text-sub hover:text-rose-700 hover:border-[rgba(219,87,149,.4)] cursor-pointer flex items-center justify-center transition-all"
            aria-label="Search"
          ><Search size={16} /></button>
          <Link href="/status" onClick={beginNavigation} className="hidden md:inline-flex no-underline text-[12.5px] font-semibold text-sub border border-[rgba(0,0,0,.1)] px-[13px] py-[9px] rounded-[10px] hover:text-rose-700 hover:border-[rgba(219,87,149,.4)] transition-all whitespace-nowrap">
            {copy.statusLabel}
          </Link>
          <Link href="/cart" onClick={beginNavigation} aria-label="Cart" className="relative no-underline w-10 h-10 rounded-[10px] border border-[rgba(219,87,149,.3)] bg-[rgba(219,87,149,.08)] text-rose-700 flex items-center justify-center">
            <ShoppingCart size={18} />
            {mounted && counts.total > 0 && (
              <span key={counts.total} className="absolute -top-[7px] -right-[7px] min-w-[19px] h-[19px] px-[5px] rounded-full bg-rose-500 text-[#200612] text-[11px] font-black flex items-center justify-center tabular shadow-[0_0_0_2px_#ffffff] animate-pop">
                {counts.total}
              </span>
            )}
          </Link>
          {/* Hamburger (mobile/tablet) */}
          <button
            ref={menuButtonRef}
            onClick={() => { setMenuOpen((o) => !o); setSearchOpen(false); }}
            className="lg:hidden w-10 h-10 rounded-[10px] border border-[rgba(0,0,0,.1)] bg-transparent text-sub hover:text-rose-700 cursor-pointer flex items-center justify-center transition-all"
            aria-label="Menu" aria-expanded={menuOpen}
          >{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </div>
      <div aria-hidden="true" className={`h-[2px] origin-left bg-rose-500 transition-transform duration-300 ${navigating ? 'scale-x-100' : 'scale-x-0'}`} />

      {/* Mobile menu drawer — absolutely positioned so it overlays page content
          below instead of pushing it down, with a real open/close transition
          (max-height + opacity) rather than an instant DOM add/remove. */}
      {menuRendered && (
        <nav
          aria-label="Mobile navigation"
          aria-hidden={!menuOpen}
          className={`lg:hidden absolute inset-x-0 top-full z-40 flex flex-col px-4 gap-1 overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,.14)] transition-[max-height,opacity] duration-300 [transition-timing-function:cubic-bezier(.16,1,.3,1)] ${menuOpen ? 'max-h-[70vh] opacity-100 py-3' : 'max-h-0 opacity-0 py-0 pointer-events-none'}`}
          style={{ background: 'rgba(255,255,255,.98)', borderBottom: menuOpen ? '1px solid rgba(0,0,0,.08)' : 'none' }}
        >
          {navLinks.map((l) => {
            const on = active === l.key;
            return (
              <Link key={l.key} href={l.href} onClick={beginNavigation} tabIndex={menuOpen ? undefined : -1} className={`no-underline text-[15px] px-3 py-[11px] rounded-lg transition-colors ${on ? 'text-rose-700 bg-[rgba(219,87,149,.1)] font-bold' : 'text-sub hover:text-rose-700 font-medium'}`}>
                {l.label}
              </Link>
            );
          })}
          <Link href="/status" onClick={beginNavigation} tabIndex={menuOpen ? undefined : -1} className="no-underline text-[15px] px-3 py-[11px] rounded-lg text-sub font-medium hover:text-rose-700 transition-colors border-t border-[rgba(0,0,0,.07)] mt-1 pt-3">
            {copy.statusLabel}
          </Link>
        </nav>
      )}

      {/* Search bar — same overlay + transition treatment as the mobile menu. */}
      {searchRendered && (
        <form
          onSubmit={submitSearch} role="search"
          aria-hidden={!searchOpen}
          className={`absolute inset-x-0 top-full z-40 flex items-center gap-2 sm:gap-3 px-3 sm:px-7 max-w-full overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,.14)] transition-[max-height,opacity] duration-300 [transition-timing-function:cubic-bezier(.16,1,.3,1)] ${searchOpen ? 'max-h-[70px] opacity-100 py-3' : 'max-h-0 opacity-0 py-0 pointer-events-none'}`}
          style={{ background: 'rgba(255,255,255,.96)', borderBottom: searchOpen ? '1px solid rgba(0,0,0,.08)' : 'none' }}
        >
          <span className="text-muted" aria-hidden="true"><Search size={16} /></span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search products"
            placeholder="Search dresses, colours, occasions…"
            tabIndex={searchOpen ? undefined : -1}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-body font-archivo text-[15px] placeholder:text-muted"
          />
          <button type="submit" tabIndex={searchOpen ? undefined : -1} className="border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.08)] text-rose-700 font-bold text-[12.5px] px-[14px] py-[7px] rounded-[8px] cursor-pointer whitespace-nowrap">Search</button>
          <button type="button" onClick={() => setSearchOpen(false)} tabIndex={searchOpen ? undefined : -1} aria-label="Close search" className="border-none bg-transparent text-muted cursor-pointer"><X size={18} /></button>
        </form>
      )}
    </header>
  );
}
