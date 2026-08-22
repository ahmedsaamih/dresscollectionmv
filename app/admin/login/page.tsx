'use client';
import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Enter your email and password.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Login failed');
        setSubmitting(false);
        return;
      }
      router.replace(next.startsWith('/admin') ? next : '/admin');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="w-[380px]">
      <div className="text-center mb-8">
        <div className="w-[52px] h-[52px] rounded-full overflow-hidden inline-block relative"><Image src="/logo-icon.png" alt="Dress Collection" fill className="object-cover" /></div>
        <div className="font-archivo-narrow font-bold text-[22px] tracking-[.1em] uppercase mt-3">Dress Collection</div>
        <div className="text-[12.5px] text-[#907481] mt-1">Admin panel</div>
      </div>

      <form onSubmit={submit} className="bg-[#f9f6f7] border border-[rgba(0,0,0,.08)] rounded-2xl p-6 flex flex-col gap-4">
        <div>
          <label className="text-[12px] font-semibold text-[#705260] block mb-[7px]">Email</label>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
            placeholder="admin@dresscollectionmv.com" autoComplete="username"
            className="w-full bg-[#f9e8f0] border border-[rgba(0,0,0,.12)] rounded-[10px] px-[14px] py-3 text-[#150d11] text-[14px] outline-none focus:border-[#db5795]" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-[#705260] block mb-[7px]">Password</label>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="••••••••" autoComplete="current-password"
            className="w-full bg-[#f9e8f0] border border-[rgba(0,0,0,.12)] rounded-[10px] px-[14px] py-3 text-[#150d11] text-[14px] outline-none focus:border-[#db5795]" />
        </div>
        {error && <div className="text-[12px] text-[#e81a2b]">{error}</div>}
        <button type="submit" disabled={submitting}
          className="border-none bg-[#db5795] text-[#200612] font-extrabold text-[15px] py-[14px] rounded-xl cursor-pointer hover:brightness-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 6px 22px rgba(219,87,149,.22)' }}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="text-center mt-5">
        <Link href="/" className="text-[12.5px] text-[#907481] no-underline hover:text-[#600a32] transition-colors">← Back to storefront</Link>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-6 font-archivo text-body">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
