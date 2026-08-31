'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { HeroCarousel } from '@/components/HeroCarousel';
import { ProductCard } from '@/components/ProductCard';
import { useReveal } from '@/lib/useReveal';
import { StarRating } from '@/components/StarRating';
import { CATEGORY_ICONS } from '@/lib/icons';
import type { Product, StoreCollection, StoreSetting, Testimonial } from '@/lib/types';

interface HomeClientProps {
  settings: StoreSetting;
  collections: StoreCollection[];
  featured: Product[];
  accessories: Product[];
  testimonials: Testimonial[];
}

export function HomeClient({ settings, collections, featured, accessories, testimonials }: HomeClientProps) {
  const copy = settings.storefrontCopy.homepageNavigation;
  const viewOptionsLabel = settings.storefrontCopy.productCatalog.viewOptionsLabel;
  useReveal();

  return (
    <div className="min-h-screen overflow-x-hidden bg-page text-body font-archivo">
      <Header active="home" tagline={settings.tagline} collections={collections} navCopy={copy} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-[rgba(43,28,18,.07)]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-8 sm:py-12 lg:py-[96px] grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-10 items-center relative min-h-[600px] sm:min-h-[680px] lg:min-h-0">
          {/* Carousel: fills the whole hero as an absolutely-positioned backdrop at
              every breakpoint. On mobile the copy overlays the bottom of the image on
              a white scrim; on desktop (lg:) it's a right-aligned strip at 70% of the
              hero width instead, with the copy beside it and a left-edge fade instead
              of a bottom one. Either way it's clipped to the section so it never
              overflows, and the copy's own z-10 keeps it on top. */}
          <div data-hero-reveal className="opacity-0 absolute inset-0 lg:inset-auto lg:right-0 lg:top-0 lg:bottom-0 lg:w-[70%]">
            <HeroCarousel images={settings.heroImages.length ? settings.heroImages : (settings.heroImage ? [settings.heroImage] : [])} />
            {/* Mobile: gradual cream fade rising from the bottom of the photo, so the
                overlaid copy below sits on a legible backdrop — no black scrim, same
                smooth-blend language as the desktop fade, just rotated for portrait. */}
            <div className="lg:hidden absolute inset-0 pointer-events-none rounded-[10px]" style={{ background: 'linear-gradient(180deg,rgba(253,251,246,0) 0%,rgba(253,251,246,0) 20%,rgba(253,251,246,.65) 38%,rgba(253,251,246,.94) 52%,#fdfbf6 100%)' }} />
            {/* Desktop: long, gradual cream fade from the left edge into the photo —
                no black scrim, just a smooth blend so the copy sits on a clean backdrop. */}
            <div className="hidden lg:block absolute inset-0 pointer-events-none rounded-[10px]" style={{ background: 'linear-gradient(90deg,#fdfbf6 0%,rgba(253,251,246,.92) 18%,rgba(253,251,246,.55) 38%,rgba(253,251,246,0) 62%)' }} />
          </div>

          <div className="relative z-10 flex flex-col justify-end h-full lg:h-auto lg:block lg:justify-normal">
            <div data-hero-reveal className="opacity-0 inline-flex items-center gap-[10px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-7">
              <span className="w-[26px] h-px bg-rose-500" />
              {copy.heroEyebrow}
            </div>
            <h1 data-hero-reveal className="opacity-0 font-playfair font-semibold text-[46px] sm:text-[60px] lg:text-[74px] leading-[1.02] tracking-[.005em] text-balance">
              {copy.heroTitle}
            </h1>
            <p data-hero-reveal className="opacity-0 mt-7 text-[15px] sm:text-[17px] leading-[1.6] text-sub max-w-[480px]">
              {settings.heroSub}
            </p>
            <div data-hero-reveal className="opacity-0 flex gap-[14px] mt-10 flex-wrap">
              <Button href="/ready-made" variant="primary" size="md" className="gap-[9px]">
                {copy.heroPrimaryCta} <span>→</span>
              </Button>
              <Button href="/casual-wear" variant="tertiary" size="md">
                {copy.heroSecondaryCta}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURED DRESSES ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[64px]">
        <div data-reveal className="text-center mb-12">
          <div className="inline-flex items-center gap-[9px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-3">
            <span className="w-[22px] h-px bg-rose-500" />{copy.featuredEyebrow}<span className="w-[22px] h-px bg-rose-500" />
          </div>
          <h2 className="font-playfair font-semibold text-[32px] sm:text-[40px] tracking-[.01em]">{copy.featuredTitle}</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-[24px] gap-y-[44px]">
          {featured.map((p) => (
            <div key={p.id} data-motion-card>
              <ProductCard product={p} viewOptionsLabel={viewOptionsLabel} />
            </div>
          ))}
        </div>
        <div className="text-center mt-14">
          <Button href="/ready-made" variant="tertiary" size="md">
            {copy.featuredViewAll} →
          </Button>
        </div>
      </section>

      {/* ── SHOP BY CATEGORY ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-[72px] pb-[24px] border-t border-[rgba(43,28,18,.07)]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {[
            { title: 'New Arrivals', href: '/ready-made', icon: CATEGORY_ICONS.ready, img: settings.categoryReadyImage },
            { title: 'Party & Occasion', href: '/occasion', icon: CATEGORY_ICONS.occasion, img: settings.categoryCustomImage },
            { title: 'Casual Dresses', href: '/casual-wear', icon: CATEGORY_ICONS.casual, img: settings.categoryCasualImage },
            { title: 'Accessories', href: '/accessories', icon: CATEGORY_ICONS.accessories, img: settings.categoryAccessoriesImage },
          ].map((c) => {
            const hasImg = !!c.img;
            return (
              <Link key={c.href} href={c.href} data-reveal
                className="opacity-0 no-underline flex flex-col items-center text-center gap-4 group">
                <div className={`relative w-[128px] h-[128px] sm:w-[168px] sm:h-[168px] rounded-full overflow-hidden transition-transform group-hover:-translate-y-1 ${hasImg ? '' : 'bg-[rgba(163,113,62,.1)] flex items-center justify-center'}`}>
                  {hasImg ? (
                    <Image src={c.img!} alt="" fill sizes="(max-width: 640px) 40vw, 168px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <c.icon size={32} className="text-rose-700" />
                  )}
                </div>
                <div>
                  <div className="font-playfair font-semibold text-[15px] sm:text-[18px] tracking-[.03em] uppercase text-body group-hover:text-rose-700 transition-colors">{c.title}</div>
                  <span className="inline-flex items-center gap-[5px] mt-[6px] text-[10.5px] font-bold uppercase tracking-[.08em] text-rose-700 transition-all group-hover:translate-x-1">{copy.categoryExploreLabel} →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── ACCESSORIES ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[48px] border-t border-[rgba(43,28,18,.07)]">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-playfair font-semibold text-[24px] tracking-[.01em]">{copy.accessoriesTitle}</h2>
          <Link href="/accessories" className="no-underline text-[12px] font-bold uppercase tracking-[.06em] text-rose-700">{copy.accessoriesCta} →</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-[18px] gap-y-[30px]">
          {accessories.map((a) => (
            <div key={a.id} data-motion-card>
              <ProductCard product={a} variant="compact" viewOptionsLabel={viewOptionsLabel} />
            </div>
          ))}
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[64px] border-t border-[rgba(43,28,18,.07)]">
          <div className="text-center mb-[44px]">
            <div className="text-[12px] font-bold tracking-[.18em] uppercase text-rose-600">{copy.testimonialsEyebrow}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-[28px] gap-y-[30px]">
            {testimonials.map((t, i) => (
              <div key={i} data-reveal className="relative pl-[6px]">
                <span aria-hidden="true" className="font-fraunces italic absolute -top-4 -left-1 text-[52px] leading-none text-[rgba(163,113,62,.25)] select-none">&ldquo;</span>
                <StarRating rating={t.rating ?? 5} size={14} className="text-rose-700 relative" />
                <p className="text-[14.5px] leading-[1.65] text-sub mt-[14px] relative">{t.quote}</p>
                <div className="flex items-center gap-[11px] mt-[20px] relative">
                  <div className="w-[36px] h-[36px] rounded-full bg-[linear-gradient(135deg,#7c5730,#3c2a18)] flex-none" />
                  <div>
                    <div className="text-[13px] font-bold text-body">{t.name}</div>
                    <div className="text-[11.5px] text-muted">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-[34px]">
            <Link href="/reviews" className="text-[12px] font-bold uppercase tracking-[.06em] text-rose-700 no-underline hover:underline">See all reviews →</Link>
          </div>
        </section>
      )}

      {/* ── BRAND STORY ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[64px] border-t border-[rgba(43,28,18,.07)]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 sm:gap-16 items-center">
          <div
            className="h-[280px] sm:h-[440px] relative rounded-[10px] overflow-hidden"
            style={!settings.workshopImage ? { background: 'linear-gradient(150deg,#7c5730,#3c2a18)' } : undefined}
          >
            {settings.workshopImage ? (
              <Image src={settings.workshopImage} alt="" fill sizes="(max-width: 1024px) 100vw, 540px" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="absolute left-[22px] bottom-5 text-[11px] tracking-[.16em] uppercase text-white/55">Studio image · admin-set</span>
            )}
          </div>
          <div>
            <div className="inline-flex items-center gap-[9px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-[16px]">
              <span className="w-[22px] h-px bg-rose-500" />{copy.storyEyebrow}
            </div>
            <h2 className="font-playfair font-semibold text-[32px] sm:text-[42px] leading-[1.1]">{copy.storyTitle}</h2>
            <p className="text-[14.5px] leading-[1.7] text-sub mt-6 max-w-[440px]">
              {copy.storyBody}
            </p>
            <Button href="/about" variant="tertiary" size="sm" className="mt-8">
              {copy.storyCta}
            </Button>
          </div>
        </div>
      </section>

      <Footer tagline={settings.tagline} collections={collections} navCopy={copy} paymentCopy={settings.storefrontCopy.paymentCheckout} />

    </div>
  );
}
