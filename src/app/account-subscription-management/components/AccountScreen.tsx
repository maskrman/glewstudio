'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscriptionTier, type SubscriptionTier } from '@/lib/subscription';
import { MEMBERSHIP_PRICES, MEMBERSHIP_FEATURES, MEMBERSHIP_DISCOUNTS, TIER_LABELS, PAYMENT_CONFIG } from '@/lib/config';

// ─── CourseCard with access type and price ────────────────────────────────────
interface CourseCardExtProps {
  id: string;
  title: string;
  instructor: string;
  thumbnail: string;
  thumbnailAlt: string;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  progress?: number;
  isLive?: boolean;
  isLocked?: boolean;
  lessonCount?: number;
  rating?: number;
  price?: number;
  accessType?: 'free' | 'membership' | 'premium_purchase';
  accessBadge?: string;
}

// ─── Account Screen ───────────────────────────────────────────────────────────

type AccountSection = 'perfil' | 'suscripcion' | 'facturacion' | 'descargas' | 'certificados';

export default function AccountScreen() {
  const { user } = useAuth();
  const [section, setSection] = useState<AccountSection>('suscripcion');
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) { setStatsLoading(false); return; }
    getUserSubscriptionTier().then((tier) => {
      setUserTier(tier);
      setStatsLoading(false);
    });
  }, [user]);

  const tierLabel = userTier ? TIER_LABELS[userTier] : 'Sin membresía';
  const tierPrice = userTier ? MEMBERSHIP_PRICES[userTier] : null;
  const tierDiscount = userTier ? MEMBERSHIP_DISCOUNTS[userTier] : 0;
  const tierFeatures = userTier ? MEMBERSHIP_FEATURES[userTier] : [];

  const navItems: { id: AccountSection; label: string; icon: string }[] = [
    { id: 'perfil', label: 'Perfil', icon: 'UserCircleIcon' },
    { id: 'suscripcion', label: 'Suscripción', icon: 'CreditCardIcon' },
    { id: 'facturacion', label: 'Facturación', icon: 'DocumentTextIcon' },
    { id: 'descargas', label: 'Descargas', icon: 'ArrowDownTrayIcon' },
    { id: 'certificados', label: 'Certificados', icon: 'TrophyIcon' },
  ];

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-10">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-primary/30">
            <AppImage
              src={user?.user_metadata?.avatar_url || 'https://img.rocket.new/generatedImages/rocket_gen_img_1453e1878-1763300003100.png'}
              alt={`Foto de perfil de ${user?.user_metadata?.full_name || 'Usuario'}`}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-700 text-foreground">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'}
              </h1>
              {userTier && <TierBadge tier={userTier} size="sm" showIcon />}
            </div>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar nav */}
          <nav className="lg:w-56 shrink-0">
            <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-500 transition-colors whitespace-nowrap ${
                    section === item.id
                      ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon name={item.icon as any} size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">

            {/* SUBSCRIPTION */}
            {section === 'suscripcion' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Mi Membresía</h2>

                {/* Demo mode notice */}
                <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-600 text-yellow-400">Modo {PAYMENT_CONFIG.mode}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{PAYMENT_CONFIG.note}</p>
                  </div>
                </div>

                {/* Current plan */}
                {userTier ? (
                  <div className="glass-card rounded-2xl p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <TierBadge tier={userTier} size="md" showIcon />
                        <p className="text-2xl font-800 text-foreground mt-2">{tierLabel}</p>
                        <p className="text-muted-foreground text-sm mt-1">
                          ${tierPrice?.monthly}/mes · Membresía activa
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Descuento en cursos premium</p>
                        <p className="text-2xl font-800 gradient-gold-text">{tierDiscount}%</p>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <p className="text-xs font-600 text-muted-foreground mb-3">Beneficios incluidos</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tierFeatures.map((feature, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Icon name="CheckCircleIcon" size={14} className="text-primary shrink-0 mt-0.5" variant="solid" />
                            <span className="text-xs text-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 mt-5">
                      <button className="btn-ghost px-4 py-2 text-sm flex items-center gap-2">
                        <Icon name="ArrowUpCircleIcon" size={16} />
                        Cambiar Plan
                      </button>
                      <button className="text-sm text-muted-foreground hover:text-red-400 transition-colors px-4 py-2">
                        Cancelar membresía
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card rounded-2xl p-6 mb-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Icon name="CreditCardIcon" size={24} className="text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-700 text-foreground mb-2">Sin membresía activa</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                      Suscríbete para acceder a contenido exclusivo y obtener descuentos en cursos premium.
                    </p>
                    <Link href="/#planes" className="btn-primary px-6 py-2.5 text-sm font-700 inline-block">
                      Ver Planes
                    </Link>
                  </div>
                )}

                {/* Upgrade options */}
                {userTier !== 'diafragma' && (
                  <div>
                    <h3 className="text-sm font-700 text-foreground mb-4">Opciones de Membresía</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(['apertura', 'obturador', 'diafragma'] as const).map((tier) => (
                        <div
                          key={tier}
                          className={`rounded-xl border p-4 transition-all ${
                            userTier === tier
                              ? 'border-primary/50 bg-primary/5' :'border-border hover:border-primary/30'
                          }`}
                        >
                          <TierBadge tier={tier} size="sm" showIcon />
                          <p className="text-xl font-800 gradient-gold-text mt-2">
                            ${MEMBERSHIP_PRICES[tier].monthly}/mes
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ${MEMBERSHIP_PRICES[tier].annual}/mes anual
                          </p>
                          <p className="text-xs text-primary font-600 mt-2">
                            {MEMBERSHIP_DISCOUNTS[tier]}% descuento en premium
                          </p>
                          {userTier === tier ? (
                            <span className="mt-3 block text-xs text-center text-primary font-600">Plan actual</span>
                          ) : (
                            <button className="mt-3 w-full btn-ghost py-1.5 text-xs font-600">
                              {!userTier ? 'Suscribirse' : 'Cambiar a este plan'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PROFILE */}
            {section === 'perfil' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Mi Perfil</h2>
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex flex-col gap-4 max-w-md">
                    <div>
                      <label className="text-sm font-600 text-foreground block mb-1.5">Nombre</label>
                      <input
                        type="text"
                        defaultValue={user?.user_metadata?.full_name || ''}
                        className="input-dark px-4 py-2.5 text-sm w-full"
                        placeholder="Tu nombre completo"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-600 text-foreground block mb-1.5">Correo electrónico</label>
                      <input
                        type="email"
                        defaultValue={user?.email || ''}
                        className="input-dark px-4 py-2.5 text-sm w-full opacity-60"
                        disabled
                      />
                    </div>
                    <button className="btn-primary px-6 py-2.5 text-sm font-700 self-start">
                      Guardar cambios
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* BILLING */}
            {section === 'facturacion' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Historial de Facturación</h2>
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Los recibos de pago aparecerán aquí una vez que el sistema de pagos esté configurado.
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Icon name="DocumentTextIcon" size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Sin historial de facturación</p>
                  </div>
                </div>
              </div>
            )}

            {/* DOWNLOADS */}
            {section === 'descargas' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Mis Descargas</h2>
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Icon name="ArrowDownTrayIcon" size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Los archivos descargables aparecerán aquí cuando accedas a cursos con material complementario.
                    </p>
                    <Link href="/dashboard" className="btn-ghost px-5 py-2 text-sm">
                      Explorar Cursos
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* CERTIFICATES */}
            {section === 'certificados' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Mis Certificados</h2>
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Icon name="TrophyIcon" size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Completa cursos para obtener tus certificados digitales.
                    </p>
                    <Link href="/dashboard" className="btn-ghost px-5 py-2 text-sm">
                      Ver Cursos
                    </Link>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}