'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

interface TopbarProps {
  currentPath?: string;
}

const navLinks = [
  { label: 'Inicio', href: '/dashboard' },
  { label: 'Cursos', href: '/courses' },
  { label: 'En Curso', href: '/en-curso' },
  { label: 'Mi Lista', href: '/watchlist' },
];

type DropdownItem =
  | { label: string; href: string; icon: string }
  | { label: string; action: 'signout'; icon: string; variant: 'destructive' };

const dropdownItems: DropdownItem[] = [
  { label: 'Cuenta y Configuración', href: '/account', icon: 'Cog6ToothIcon' },
  { label: 'Continuar viendo', href: '/account#activity', icon: 'PlayCircleIcon' },
  { label: 'Mi Lista', href: '/watchlist', icon: 'HeartIcon' },
  {
    label: 'Cerrar sesión',
    action: 'signout',
    icon: 'ArrowRightOnRectangleIcon',
    variant: 'destructive',
  },
];

const recentNotifications = [
  {
    title: 'Nueva masterclass disponible',
    description: 'Descubre nuevas técnicas de iluminación.',
    time: 'Hoy',
    icon: 'PlayCircleIcon',
  },
  {
    title: 'Suscripción renovada con éxito',
    description: 'Tu plan continúa activo.',
    time: 'Ayer',
    icon: 'CreditCardIcon',
  },
  {
    title: 'Acceso desde nuevo dispositivo',
    description: 'Se detectó un inicio de sesión reciente.',
    time: 'Hace 2 días',
    icon: 'ShieldCheckIcon',
  },
];

export default function Topbar({ currentPath = '' }: TopbarProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { user, loading, signOut } = useAuth();
  const visibleNavLinks = [
    ...navLinks.filter((link) => link.label !== 'En Vivo' || Boolean(user)),
    ...(user?.app_metadata?.role === 'admin' ? [{ label: 'Administración', href: '/admin' }] : []),
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    } else if (document.activeElement === searchInputRef.current) {
      searchInputRef.current?.blur();
    }
  }, [searchOpen]);

  const handleSignOut = async () => {
    await signOut();
    setDropdownOpen(false);
    router.replace('/');
    router.refresh();
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/courses?search=${encodeURIComponent(query)}`);
    setSearchOpen(false);
  };

  const handleDropdownAction = (action: string) => {
    if (action === 'signout') {
      handleSignOut();
    }
  };

  if (loading) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/70 to-transparent">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <AppLogo size={32} />
            <span className="font-extrabold text-lg tracking-tight text-foreground hidden sm:block">
              Glewstudio
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-20 h-8 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'glass-nav' : 'bg-gradient-to-b from-black/70 to-transparent'
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <AppLogo size={32} />
            <span className="font-extrabold text-lg tracking-tight text-foreground hidden sm:block">
              Glewstudio
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleNavLinks.map((link) => (
              <Link
                key={`nav-${link.label}`}
                href={link.href}
                className={`px-4 py-2 rounded-md text-sm font-500 transition-colors duration-150 ${
                  currentPath === link.href
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <div id="header-search-panel" className="flex shrink-0 items-center" ref={searchRef}>
              <div
                aria-hidden={!searchOpen}
                className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                  searchOpen ? 'w-28 sm:w-36 md:w-44 lg:w-52 xl:w-64' : 'w-0'
                }`}
              >
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-input px-3"
                >
                  <input
                    ref={searchInputRef}
                    id="header-search"
                    type="search"
                    tabIndex={searchOpen ? 0 : -1}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar"
                    aria-label="Buscar cursos"
                    className="min-w-0 flex-1 border-transparent bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-0"
                  />
                  {searchQuery.length > 0 && (
                    <button
                      type="button"
                      tabIndex={searchOpen ? 0 : -1}
                      onClick={() => setSearchQuery('')}
                      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-ring"
                      aria-label="Limpiar búsqueda"
                    >
                      <Icon name="XMarkIcon" size={16} />
                    </button>
                  )}
                  <button
                    type="submit"
                    tabIndex={searchOpen ? 0 : -1}
                    disabled={!searchQuery.trim()}
                    className="hidden shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-ring md:block"
                    aria-label="Buscar"
                  >
                    <Icon name="ArrowRightIcon" size={16} />
                  </button>
                </form>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((open) => !open);
                  setNotificationsOpen(false);
                  setDropdownOpen(false);
                }}
                className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground transition-colors focus-ring"
                aria-label="Buscar"
                aria-expanded={searchOpen}
                aria-controls="header-search-panel"
              >
                <Icon name="MagnifyingGlassIcon" size={20} />
              </button>
            </div>

            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setSearchOpen(false);
                  setDropdownOpen(false);
                }}
                className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground transition-colors relative focus-ring"
                aria-label="Notificaciones"
                aria-expanded={notificationsOpen}
                aria-controls="header-notifications-panel"
              >
                <Icon name="BellIcon" size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
              </button>
              {notificationsOpen && (
                <div
                  id="header-notifications-panel"
                  className="fixed right-4 top-16 z-[60] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:absolute sm:right-0 sm:top-full sm:mt-2"
                  role="dialog"
                  aria-label="Notificaciones recientes"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-sm font-700 text-foreground">Notificaciones</h2>
                    <span className="text-xs text-muted-foreground">De ejemplo</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {recentNotifications.map((notification) => (
                      <li
                        key={notification.title}
                        className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon name={notification.icon as any} size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-600 text-foreground">
                              {notification.title}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {notification.time}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {notification.description}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {user ? (
              // Authenticated user dropdown
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 btn-ghost px-3 py-1.5 text-sm font-600 focus-ring"
                  aria-label="Menú de usuario"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <div className="w-7 h-7 rounded-full gradient-gold flex items-center justify-center text-xs font-700 text-primary-foreground">
                    {user.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden lg:block text-sm">Mi Cuenta</span>
                  <Icon
                    name="ChevronDownIcon"
                    size={14}
                    className="hidden lg:block transition-transform duration-200"
                  />
                </button>

                {/* Dropdown with Framer Motion */}
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl border border-border bg-zinc-950 shadow-2xl overflow-hidden z-[100]"
                      role="menu"
                    >
                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-border bg-muted/30">
                        <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">
                          Tipo de cuenta
                        </p>
                        <p className="text-sm font-600 text-foreground gradient-gold-text">
                          {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'}
                        </p>
                      </div>

                      {/* Dropdown items */}
                      <nav className="py-2" role="menu">
                        {dropdownItems.map((item) => {
                          const className = `w-full flex items-center gap-3 px-4 py-2.5 text-sm font-500 transition-colors ${
                            'variant' in item && item.variant === 'destructive'
                              ? 'text-red-400 hover:bg-red-400/10 focus:bg-red-400/10'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted focus:bg-muted'
                          } focus-ring`;

                          return 'href' in item ? (
                            <Link
                              key={item.label}
                              href={item.href}
                              onClick={() => setDropdownOpen(false)}
                              className={className}
                              role="menuitem"
                            >
                              <Icon name={item.icon as any} size={18} />
                              {item.label}
                            </Link>
                          ) : (
                            <button
                              key={item.label}
                              onClick={() => handleDropdownAction(item.action)}
                              className={className}
                              role="menuitem"
                            >
                              <Icon name={item.icon as any} size={18} />
                              {item.label}
                            </button>
                          );
                        })}
                      </nav>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              // Not authenticated - show sign up
              <Link
                href="/sign-up-login?plan=free"
                className="hidden md:flex btn-primary px-4 py-1.5 text-sm"
              >
                Comenzar Gratis
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 text-foreground focus-ring"
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
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="relative ml-auto w-72 h-full bg-card flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <Link
                href="/"
                className="flex items-center gap-2"
                onClick={() => setMobileOpen(false)}
              >
                <AppLogo size={28} />
                <span className="font-extrabold text-base text-foreground">Glewstudio</span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground focus-ring"
              >
                <Icon name="XMarkIcon" size={22} />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {visibleNavLinks.map((link) => (
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
              {user ? (
                <>
                  <Link
                    href="/account"
                    className="btn-ghost px-4 py-2.5 text-sm text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    Mi Cuenta
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="btn-ghost px-4 py-2.5 text-sm text-center text-destructive hover:text-destructive"
                  >
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-up-login?plan=free"
                    className="btn-primary px-4 py-2.5 text-sm text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    Comenzar Gratis
                  </Link>
                  <Link
                    href="/sign-up-login"
                    className="btn-ghost px-4 py-2.5 text-sm text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    Iniciar Sesión
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
