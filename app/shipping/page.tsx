import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCatalog } from '@/lib/catalog';
import { Home, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ShippingPage() {
  const { settings, collections } = await getCatalog();
  const navCopy = settings.storefrontCopy.homepageNavigation;
  const copy = settings.storefrontCopy.shippingPickup;
  const cards = [
    { icon: Home, title: copy.pickupCardTitle, body: copy.pickupCardBody, meta: copy.pickupCardMeta },
    { icon: Truck, title: copy.deliveryCardTitle, body: copy.deliveryCardBody, meta: copy.deliveryCardMeta },
  ];
  const sections = [
    { title: copy.productionTitle, body: copy.productionBody },
    { title: copy.deliveryEstimateTitle, body: copy.deliveryEstimateBody },
    { title: copy.manualPaymentTitle, body: copy.manualPaymentBody },
  ];

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header tagline={settings.tagline} collections={collections} navCopy={navCopy} />
      <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-[52px] pb-[90px]">
        <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[40px] tracking-[.01em]">{copy.shippingPageTitle}</h1>
        <p className="text-[14.5px] text-sub mt-[9px] mb-[30px]">{copy.shippingPageIntro}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-9">
          {cards.map(c => (
            <div key={c.title} className="bg-surface rounded-2xl p-[22px]">
              <div className="w-[42px] h-[42px] rounded-xl bg-[rgba(219,87,149,.1)] text-rose-700 flex items-center justify-center"><c.icon size={20} /></div>
              <div className="font-extrabold text-[16px] mt-[14px]">{c.title}</div>
              <div className="text-[13px] text-[#705260] mt-[7px] leading-[1.6]">{c.body}</div>
              <div className="font-extrabold text-[14px] text-rose-700 mt-3">{c.meta}</div>
            </div>
          ))}
        </div>
        {sections.map((s, i) => (
          <div key={i} className="mb-6">
            <h2 className="font-archivo-narrow font-bold text-[20px] mb-[10px]">{s.title}</h2>
            <p className="text-[13.5px] leading-[1.75] text-sub">{s.body}</p>
          </div>
        ))}
      </div>
      <Footer tagline={settings.tagline} collections={collections} navCopy={navCopy} paymentCopy={settings.storefrontCopy.paymentCheckout} />
    </div>
  );
}
