'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

export default function LandingTopbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'glass-nav' : 'bg-gradient-to-b from-black/80 to-transparent'
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo size={32} />
            <span className="font-extrabold text-lg tracking-tight text-foreground hidden sm:block">
              Glewstudio
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {['Cursos', 'En Vivo', 'Instructores', 'Planes']?.map((item) => (
              <a
                key={`landing-nav-${item}`}
                href={`#${item?.toLowerCase()}`}
                className="text-sm font-500 text-muted-foreground hover:text-foreground transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-up-login"
              className="hidden md:block btn-ghost px-4 py-1.5 text-sm font-600"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/sign-up-login"
              className="btn-primary px-4 py-1.5 text-sm"
            >
              Comenzar Gratis
            </Link>
            <button
              className="md:hidden text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Icon name="Bars3Icon" size={22} />
            </button>
          </div>
        </div>
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="relative ml-auto w-72 h-full bg-card flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <AppLogo size={28} />
                <span className="font-extrabold text-base">Glewstudio</span>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <Icon name="XMarkIcon" size={22} className="text-muted-foreground" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {['Cursos', 'En Vivo', 'Instructores', 'Planes']?.map((item) => (
                <a
                  key={`mobile-landing-${item}`}
                  href={`#${item?.toLowerCase()}`}
                  className="px-4 py-3 rounded-lg text-sm font-500 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {item}
                </a>
              ))}
            </nav>
            <div className="mt-auto p-4 border-t border-border flex flex-col gap-3">
              <Link href="/sign-up-login" className="btn-primary py-2.5 text-sm text-center" onClick={() => setMobileOpen(false)}>
                Comenzar Gratis
              </Link>
              <Link href="/sign-up-login" className="btn-ghost py-2.5 text-sm text-center" onClick={() => setMobileOpen(false)}>
                Iniciar Sesión
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}