'use client';
import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductImage } from '@/components/ProductImage';
import { HeroCarousel } from '@/components/HeroCarousel';
import { useStore } from '@/contexts/StoreContext';
import { useReveal } from '@/lib/useReveal';
import { StarRating } from '@/components/StarRating';
import { CATEGORY_ICONS } from '@/lib/icons';

export default function HomePage() {
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.homepageNavigation;
  const productCopy = data.settings.storefrontCopy.productCatalog;
  useReveal();

  const featured = data.products.filter(p => p.collection === 'ready').slice(0, 4);
  const accessories = data.products.filter(p => p.collection === 'accessories').slice(0, 6);

  const stats = [
    { value: copy.heroStatOneValue, label: copy.heroStatOneLabel },
    { value: copy.heroStatTwoValue, label: copy.heroStatTwoLabel },
    { value: copy.heroStatThreeValue, label: copy.heroStatThreeLabel },
  ];

  const testimonials = data.reviews;

  return (
    <div className="min-h-screen overflow-x-hidden bg-page text-body font-archivo">
      <Header active="home" />

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
            <HeroCarousel images={data.settings.heroImages.length ? data.settings.heroImages : (data.settings.heroImage ? [data.settings.heroImage] : [])} />
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
              {data.settings.heroSub}
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

      {/* ── CATEGORIES ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-8 pb-3">
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-[18px]">
          {[
            { title: 'New Arrivals', desc: copy.categoryReadyDesc, href: '/ready-made', icon: CATEGORY_ICONS.ready, img: data.settings.categoryReadyImage },
            { title: 'Party & Occasion', desc: copy.categoryCustomDesc, href: '/occasion', icon: CATEGORY_ICONS.occasion, img: data.settings.categoryCustomImage },
            { title: 'Casual Dresses', desc: copy.categoryCasualDesc, href: '/casual-wear', icon: CATEGORY_ICONS.casual, img: data.settings.categoryCasualImage },
            { title: 'Accessories', desc: copy.categoryAccessoriesDesc, href: '/accessories', icon: CATEGORY_ICONS.accessories, img: data.settings.categoryAccessoriesImage },
          ].map((c) => {
            const hasImg = !!c.img;
            return (
              <Link key={c.href} href={c.href} data-reveal
                className={`no-underline rounded-2xl p-6 flex flex-col gap-[14px] min-h-[184px] relative overflow-hidden hover:-translate-y-1 transition-all group ${hasImg ? 'bg-cover bg-center border border-transparent hover:border-[rgba(219,87,149,.6)]' : 'bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] hover:border-[rgba(219,87,149,.45)]'}`}
                style={hasImg ? { backgroundImage: `url(${c.img})` } : undefined}>
                {hasImg && (
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(6,32,27,0) 0%,rgba(6,32,27,.15) 45%,rgba(6,32,27,.82) 100%)' }} />
                )}
                <div className={`relative z-10 w-[46px] h-[46px] rounded-xl flex items-center justify-center ${hasImg ? 'bg-white/15 backdrop-blur-sm text-white' : 'bg-[rgba(219,87,149,.1)] text-rose-700'}`}><c.icon size={22} /></div>
                <div className="relative z-10 mt-auto">
                  <div className={`font-archivo-narrow font-bold text-[21px] tracking-[.01em] ${hasImg ? 'text-white' : 'text-body'}`}>{c.title}</div>
                  <div className={`text-[12.5px] mt-[5px] leading-[1.45] ${hasImg ? 'text-white/85' : 'text-[#705260]'}`}>{c.desc}</div>
                </div>
                <span className={`relative z-10 text-[14px] transition-all group-hover:translate-x-1 ${hasImg ? 'text-white/90 group-hover:text-white' : 'text-muted group-hover:text-rose-700'}`}>{copy.categoryExploreLabel} →</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── FEATURED DRESSES ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-6">
        <div data-reveal className="flex items-end justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-[9px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-2.5">
              <span className="w-[22px] h-[2px] bg-rose-500 skew-accent" />{copy.featuredEyebrow}
            </div>
            <h2 className="font-archivo-narrow font-bold text-[34px] tracking-[.01em]">{copy.featuredTitle}</h2>
          </div>
          <Link href="/ready-made" className="no-underline text-[13.5px] font-semibold text-rose-700">{copy.featuredViewAll} →</Link>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-[18px]">
          {featured.map((p) => (
            <div key={p.id} data-motion-card className="bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all">
              <ProductImage href={`/product/${p.id}`} img={p.img} colorImages={p.colorImages} className="block no-underline h-[172px] relative">
                {p.badge && (
                  <span className={`absolute top-[11px] left-[11px] text-[10px] font-extrabold tracking-[.07em] uppercase px-[9px] py-1 rounded-[6px] ${p.badge === 'Sale' ? 'bg-coral-500 text-white' : 'bg-rose-500 text-[#200612]'}`}>
                    {p.badge}
                  </span>
                )}
              </ProductImage>
              <div className="p-4">
                <Link href={`/product/${p.id}`} className="no-underline text-body font-bold text-[14px] block hover:text-rose-600 transition-colors">{p.name}</Link>
                <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
                <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                  <span className="font-extrabold text-[15px] text-rose-700 tabular">MVR {p.price}</span>
                  <Link
                    href={`/product/${p.id}`}
                    className="no-underline border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.08)] text-rose-700 font-extrabold text-[12px] px-[14px] py-2 rounded-[9px] hover:bg-rose-500 hover:text-[#200612] transition-all"
                  >
                    {productCopy.viewOptionsLabel}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ACCESSORIES ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-archivo-narrow font-bold text-[26px]">{copy.accessoriesTitle}</h2>
          <Link href="/accessories" className="no-underline text-[13px] font-semibold text-rose-700">{copy.accessoriesCta} →</Link>
        </div>
        <div className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-[14px]">
          {accessories.map((a) => (
            <Link key={a.id} data-motion-card href={`/product/${a.id}`} className="no-underline bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-[14px] overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all">
              <ProductImage img={a.img} colorImages={a.colorImages} className="block h-[90px] relative">
                {a.badge && (
                  <span className={`absolute top-[7px] left-[7px] text-[9px] font-extrabold tracking-[.05em] uppercase px-[7px] py-[3px] rounded-[5px] ${a.badge === 'Sale' ? 'bg-coral-500 text-white' : 'bg-rose-500 text-[#200612]'}`}>
                    {a.badge}
                  </span>
                )}
              </ProductImage>
              <div className="p-3">
                <div className="text-[12.5px] font-semibold text-[#705260] whitespace-nowrap overflow-hidden text-ellipsis">{a.name}</div>
                <div className="text-[12px] font-extrabold text-rose-700 mt-[3px] tabular">MVR {a.price}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px]">
          <div className="text-center mb-[34px]">
            <div className="text-[12px] font-bold tracking-[.18em] uppercase text-rose-600">{copy.testimonialsEyebrow}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
            {testimonials.map((t, i) => (
              <div key={i} data-reveal className="bg-[#f9f6f7] border border-[rgba(0,0,0,.08)] rounded-2xl p-[26px]">
                <StarRating rating={t.rating ?? 5} size={15} className="text-rose-700" />
                <p className="text-[14.5px] leading-[1.6] text-[#705260] mt-[14px]">&quot;{t.quote}&quot;</p>
                <div className="flex items-center gap-[11px] mt-[18px]">
                  <div className="w-[38px] h-[38px] rounded-full bg-[linear-gradient(135deg,#600a32,#36021a)] flex-none" />
                  <div>
                    <div className="text-[13px] font-bold text-body">{t.name}</div>
                    <div className="text-[11.5px] text-muted">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-[28px]">
            <Link href="/reviews" className="text-[13px] font-bold text-rose-700 no-underline hover:underline">See all reviews →</Link>
          </div>
        </section>
      )}

      {/* ── BRAND STORY ── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 pb-[36px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-9 bg-[#f9f6f7] border border-[rgba(0,0,0,.08)] rounded-[20px] overflow-hidden items-center">
          <div
            className="h-[200px] sm:h-[340px] relative"
            style={!data.settings.workshopImage ? { background: 'linear-gradient(150deg,#600a32,#36021a)' } : undefined}
          >
            {data.settings.workshopImage ? (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${data.settings.workshopImage})` }} />
            ) : (
              <span className="absolute left-[22px] bottom-5 text-[11px] tracking-[.16em] uppercase text-white/55">Studio image · admin-set</span>
            )}
          </div>
          <div className="p-6 sm:py-10 sm:pr-11 sm:pl-2">
            <div className="inline-flex items-center gap-[9px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-[14px]">
              <span className="w-[22px] h-[2px] bg-rose-500 skew-accent" />{copy.storyEyebrow}
            </div>
            <h2 className="font-archivo-narrow font-bold text-[32px] leading-[1.05]">{copy.storyTitle}</h2>
            <p className="text-[14.5px] leading-[1.65] text-sub mt-4 max-w-[440px]">
              {copy.storyBody}
            </p>
            <Link href="/about" className="no-underline inline-block mt-[22px] border border-[rgba(0,0,0,.16)] text-body font-bold text-[14px] px-[22px] py-3 rounded-xl hover:border-[rgba(0,0,0,.3)] transition-colors">
              {copy.storyCta}
            </Link>
          </div>
        </div>
      </section>

      <Footer />

    </div>
  );
}
