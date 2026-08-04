'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

interface TopbarProps {
  currentPath?: string;
}

const navLinks = [
  { label: 'Inicio', href: '/dashboard' },
  { label: 'Cursos', href: '/courses' },
  { label: 'En Vivo', href: '/dashboard' },
  { label: 'Mi Lista', href: '/watchlist' },
];

export default function Topbar({ currentPath = '' }: TopbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'glass-nav' : 'bg-gradient-to-b from-black/70 to-transparent'
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <AppLogo size={32} />
            <span className="font-extrabold text-lg tracking-tight text-foreground hidden sm:block">
              Glewstudio
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={`nav-${link.label}`}
                href={link.href}
                className={`px-4 py-2 rounded-md text-sm font-500 transition-colors duration-150 ${
                  currentPath === link.href
                    ? 'text-primary' :'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button className="hidden md:flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground transition-colors">
              <Icon name="MagnifyingGlassIcon" size={20} />
            </button>
            <button className="hidden md:flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground transition-colors relative">
              <Icon name="BellIcon" size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            </button>
            <Link
              href="/account-subscription-management"
              className="hidden md:flex items-center gap-2 btn-ghost px-3 py-1.5 text-sm font-600"
            >
              <div className="w-7 h-7 rounded-full gradient-gold flex items-center justify-center text-xs font-700 text-primary-foreground">
                M
              </div>
              <span className="hidden lg:block text-sm">Mi Cuenta</span>
            </Link>
            <Link
              href="/sign-up-login"
              className="hidden md:flex btn-primary px-4 py-1.5 text-sm"
            >
              Suscribirse
            </Link>
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Icon name="Bars3Icon" size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative ml-auto w-72 h-full bg-card flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <AppLogo size={28} />
                <span className="font-extrabold text-base text-foreground">Glewstudio</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="XMarkIcon" size={22} />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {navLinks.map((link) => (
                <Link
                  key={`mobile-nav-${link.label}`}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-500 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto p-4 border-t border-border flex flex-col gap-3">
              <Link
                href="/sign-up-login"
                className="btn-primary px-4 py-2.5 text-sm text-center"
                onClick={() => setMobileOpen(false)}
              >
                Suscribirse
              </Link>
              <Link
                href="/account-subscription-management"
                className="btn-ghost px-4 py-2.5 text-sm text-center"
                onClick={() => setMobileOpen(false)}
              >
                Mi Cuenta
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}