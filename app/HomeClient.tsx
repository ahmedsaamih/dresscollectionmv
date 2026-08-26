'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
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

  const stats = [
    { value: copy.heroStatOneValue, label: copy.heroStatOneLabel },
    { value: copy.heroStatTwoValue, label: copy.heroStatTwoLabel },
    { value: copy.heroStatThreeValue, label: copy.heroStatThreeLabel },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-page text-body font-archivo">
      <Header active="home" tagline={settings.tagline} collections={collections} navCopy={copy} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-[rgba(0,0,0,.07)]">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(900px 460px at 78% 8%,rgba(219,87,149,.12),rgba(219,87,149,0) 60%)' }} />
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-8 sm:py-12 lg:py-[84px] grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-10 items-center relative min-h-[600px] sm:min-h-[680px] lg:min-h-0">
          {/* Carousel: fills the whole hero as an absolutely-positioned backdrop at
              every breakpoint. On mobile the copy overlays the bottom of the image on
              a white scrim; on desktop (lg:) it's a right-aligned strip at 70% of the
              hero width instead, with the copy beside it and a left-edge fade instead
              of a bottom one. Either way it's clipped to the section so it never
              overflows, and the copy's own z-10 keeps it on top. */}
          <div data-hero-reveal className="opacity-0 absolute inset-0 lg:inset-auto lg:right-0 lg:top-0 lg:bottom-0 lg:w-[70%]">
            <HeroCarousel images={settings.heroImages.length ? settings.heroImages : (settings.heroImage ? [settings.heroImage] : [])} />
            {/* Mobile: gradual white fade rising from the bottom of the photo, so the
                overlaid copy below sits on a legible backdrop — no black scrim, same
                smooth-blend language as the desktop fade, just rotated for portrait. */}
            <div className="lg:hidden absolute inset-0 pointer-events-none rounded-[18px]" style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0) 20%,rgba(255,255,255,.65) 38%,rgba(255,255,255,.94) 52%,#fff 100%)' }} />
            {/* Desktop: long, gradual white fade from the left edge into the photo —
                no black scrim, just a smooth blend so the copy sits on a clean backdrop. */}
            <div className="hidden lg:block absolute inset-0 pointer-events-none rounded-[18px]" style={{ background: 'linear-gradient(90deg,#fff 0%,rgba(255,255,255,.92) 18%,rgba(255,255,255,.55) 38%,rgba(255,255,255,0) 62%)' }} />
          </div>

          <div className="relative z-10 flex flex-col justify-end h-full lg:h-auto lg:block lg:justify-normal">
            <div data-hero-reveal className="opacity-0 inline-flex items-center gap-[10px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-6">
              <span className="w-[26px] h-[2px] bg-rose-500 skew-accent" />
              {copy.heroEyebrow}
            </div>
            <h1 data-hero-reveal className="opacity-0 font-archivo font-black text-[44px] sm:text-[56px] lg:text-[72px] leading-[.92] tracking-[-0.035em] text-balance">
              {copy.heroTitle}
            </h1>
            <p data-hero-reveal className="opacity-0 mt-6 text-[15px] sm:text-[17px] leading-[1.6] text-sub max-w-[480px]">
              {settings.heroSub}
            </p>
            <div data-hero-reveal className="opacity-0 flex gap-[14px] mt-8 flex-wrap">
              <Link href="/ready-made" className="no-underline bg-rose-500 text-[#200612] font-extrabold text-[15px] px-7 py-[15px] rounded-xl shadow-rose-lg inline-flex items-center gap-[9px] hover:brightness-105 transition-all">
                {copy.heroPrimaryCta} <span>→</span>
              </Link>
              <Link href="/casual-wear" className="no-underline border border-[rgba(0,0,0,.16)] text-body font-bold text-[15px] px-7 py-[15px] rounded-xl hover:border-[rgba(0,0,0,.3)] transition-colors">
                {copy.heroSecondaryCta}
              </Link>
            </div>
            <div data-hero-reveal className="opacity-0 flex gap-7 mt-10">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-archivo-narrow font-bold text-[30px] text-body tracking-[.01em]">{s.value}</div>
                  <div className="text-[11.5px] text-muted tracking-[.05em] mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SHOP BY CATEGORY ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-[52px] pb-[10px]">
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-[16px]">
          {[
            { title: 'New Arrivals', desc: copy.categoryReadyDesc, href: '/ready-made', icon: CATEGORY_ICONS.ready, img: settings.categoryReadyImage },
            { title: 'Party & Occasion', desc: copy.categoryOccasionDesc, href: '/occasion', icon: CATEGORY_ICONS.occasion, img: settings.categoryCustomImage },
            { title: 'Casual Dresses', desc: copy.categoryCasualDesc, href: '/casual-wear', icon: CATEGORY_ICONS.casual, img: settings.categoryCasualImage },
            { title: 'Accessories', desc: copy.categoryAccessoriesDesc, href: '/accessories', icon: CATEGORY_ICONS.accessories, img: settings.categoryAccessoriesImage },
          ].map((c) => {
            const hasImg = !!c.img;
            return (
              <Link key={c.href} href={c.href} data-reveal
                className={`no-underline rounded-[18px] p-6 flex flex-col gap-[14px] aspect-[3/4] min-[380px]:aspect-[4/5] relative overflow-hidden hover:-translate-y-1 transition-all group ${hasImg ? '' : 'bg-[#f5f1f3]'}`}>
                {hasImg ? (
                  <>
                    <Image src={c.img!} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 280px" style={{ objectFit: 'cover' }} />
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(6,32,27,0) 0%,rgba(6,32,27,.1) 50%,rgba(6,32,27,.78) 100%)' }} />
                  </>
                ) : (
                  <div className="relative z-10 w-[46px] h-[46px] rounded-xl flex items-center justify-center bg-[rgba(219,87,149,.1)] text-rose-700"><c.icon size={22} /></div>
                )}
                <div className="relative z-10 mt-auto">
                  <div className={`font-archivo-narrow font-semibold text-[20px] tracking-[.05em] uppercase ${hasImg ? 'text-white' : 'text-body'}`}>{c.title}</div>
                  <div className={`text-[12.5px] mt-[6px] leading-[1.45] ${hasImg ? 'text-white/85' : 'text-[#705260]'}`}>{c.desc}</div>
                  <span className={`inline-flex items-center gap-[5px] mt-3 text-[11px] font-bold uppercase tracking-[.08em] transition-all group-hover:translate-x-1 ${hasImg ? 'text-white' : 'text-rose-700'}`}>{copy.categoryExploreLabel} →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── FEATURED DRESSES ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[44px]">
        <div data-reveal className="flex items-end justify-between mb-7">
          <div>
            <div className="inline-flex items-center gap-[9px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-2.5">
              <span className="w-[22px] h-[2px] bg-rose-500 skew-accent" />{copy.featuredEyebrow}
            </div>
            <h2 className="font-archivo-narrow font-bold text-[30px] sm:text-[36px] tracking-[.01em]">{copy.featuredTitle}</h2>
          </div>
          <Link href="/ready-made" className="no-underline text-[12px] font-bold uppercase tracking-[.06em] text-rose-700">{copy.featuredViewAll} →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-[18px] gap-y-[30px]">
          {featured.map((p) => (
            <div key={p.id} data-motion-card>
              <ProductCard product={p} viewOptionsLabel={viewOptionsLabel} />
            </div>
          ))}
        </div>
      </section>

      {/* ── ACCESSORIES ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[32px]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-archivo-narrow font-bold text-[24px] tracking-[.01em]">{copy.accessoriesTitle}</h2>
          <Link href="/accessories" className="no-underline text-[12px] font-bold uppercase tracking-[.06em] text-rose-700">{copy.accessoriesCta} →</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-[14px] gap-y-[24px]">
          {accessories.map((a) => (
            <div key={a.id} data-motion-card>
              <ProductCard product={a} variant="compact" viewOptionsLabel={viewOptionsLabel} />
            </div>
          ))}
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[48px]">
          <div className="text-center mb-[38px]">
            <div className="text-[12px] font-bold tracking-[.18em] uppercase text-rose-600">{copy.testimonialsEyebrow}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-[28px] gap-y-[30px]">
            {testimonials.map((t, i) => (
              <div key={i} data-reveal className="relative pl-[6px]">
                <span aria-hidden="true" className="font-fraunces italic absolute -top-4 -left-1 text-[52px] leading-none text-[rgba(219,87,149,.2)] select-none">&ldquo;</span>
                <StarRating rating={t.rating ?? 5} size={14} className="text-rose-700 relative" />
                <p className="text-[14.5px] leading-[1.65] text-[#705260] mt-[14px] relative">{t.quote}</p>
                <div className="flex items-center gap-[11px] mt-[20px] relative">
                  <div className="w-[36px] h-[36px] rounded-full bg-[linear-gradient(135deg,#600a32,#36021a)] flex-none" />
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
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 pb-[56px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-9 sm:gap-12 items-center">
          <div
            className="h-[240px] sm:h-[400px] relative rounded-[20px] overflow-hidden"
            style={!settings.workshopImage ? { background: 'linear-gradient(150deg,#600a32,#36021a)' } : undefined}
          >
            {settings.workshopImage ? (
              <Image src={settings.workshopImage} alt="" fill sizes="(max-width: 1024px) 100vw, 540px" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="absolute left-[22px] bottom-5 text-[11px] tracking-[.16em] uppercase text-white/55">Studio image · admin-set</span>
            )}
          </div>
          <div>
            <div className="inline-flex items-center gap-[9px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-[14px]">
              <span className="w-[22px] h-[2px] bg-rose-500 skew-accent" />{copy.storyEyebrow}
            </div>
            <h2 className="font-archivo-narrow font-bold text-[30px] sm:text-[38px] leading-[1.05]">{copy.storyTitle}</h2>
            <p className="text-[14.5px] leading-[1.7] text-sub mt-5 max-w-[440px]">
              {copy.storyBody}
            </p>
            <Link href="/about" className="no-underline inline-block mt-[26px] border border-[rgba(0,0,0,.16)] text-body font-bold text-[12px] uppercase tracking-[.06em] px-[24px] py-[13px] rounded-full hover:border-rose-500 hover:text-rose-700 transition-colors">
              {copy.storyCta}
            </Link>
          </div>
        </div>
      </section>

      <Footer tagline={settings.tagline} collections={collections} navCopy={copy} paymentCopy={settings.storefrontCopy.paymentCheckout} />

    </div>
  );
}
