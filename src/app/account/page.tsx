'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscriptionTier, type SubscriptionTier } from '@/lib/subscription';
import {
  MEMBERSHIP_PRICES,
  MEMBERSHIP_FEATURES,
  MEMBERSHIP_DISCOUNTS,
  TIER_LABELS,
  PAYMENT_CONFIG,
} from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import AppLayout from '@/components/AppLayout';

interface CourseProgressRow {
  id: string;
  course_id: string;
  course_title: string;
  course_instructor: string;
  course_thumbnail: string;
  course_thumbnail_alt: string;
  watched_seconds: number;
  total_seconds: number;
  completed: boolean;
  started_at: string;
  updated_at: string;
}

type AccountPanel = 'activity' | 'security' | 'email' | null;

const accountActions = [
  {
    id: 'activity',
    title: 'Continuar viendo',
    description: 'Retoma tus cursos y revisa tu progreso.',
    icon: 'PlayCircleIcon',
  },
  {
    id: 'security',
    title: 'Seguridad',
    description: 'Actualiza la contraseña de tu cuenta.',
    icon: 'LockClosedIcon',
  },
  {
    id: 'email',
    title: 'Cambiar correo electrónico',
    description: 'Gestiona el correo asociado a tu cuenta.',
    icon: 'MailIcon',
  },
] as const;

export default function AccountPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const supabase = createClient();

  const [userTier, setUserTier] = useState<SubscriptionTier | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [recentCourses, setRecentCourses] = useState<CourseProgressRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');

  // Security form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [activePanel, setActivePanel] = useState<AccountPanel>(null);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      setRecentLoading(false);
      return;
    }

    // Populate from user metadata
    setFullName(user.user_metadata?.full_name || '');
    setAvatarUrl(user.user_metadata?.avatar_url || '');
    setEmail(user.email || '');

    // Load subscription tier + recent courses
    const load = async () => {
      const [tier, recentData] = await Promise.all([
        getUserSubscriptionTier(),
        supabase
          .from('course_progress')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(6),
      ]);
      setUserTier(tier);
      setRecentCourses((recentData.data as CourseProgressRow[]) || []);
      setProfileLoading(false);
      setRecentLoading(false);
    };
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ──────────────────────────────────────────────────────────
  const tierLabel = userTier ? TIER_LABELS[userTier] : 'Sin membresía';
  const tierPrice = userTier ? MEMBERSHIP_PRICES[userTier] : null;
  const tierDiscount = userTier ? MEMBERSHIP_DISCOUNTS[userTier] : 0;
  const tierFeatures = userTier ? MEMBERSHIP_FEATURES[userTier] : [];

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
    router.refresh();
  };

  const handleSecuritySave = async (type: 'password' | 'email') => {
    if (!user) return;
    setSecuritySaving(true);
    setSecurityMessage(null);

    try {
      if (type === 'password') {
        if (!newPassword || !confirmPassword) {
          throw new Error('Completa todos los campos');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('Las contraseñas no coinciden');
        }
        if (newPassword.length < 8) {
          throw new Error('La contraseña debe tener al menos 8 caracteres');
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        setSecurityMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        if (!newEmail || !newEmail.includes('@')) {
          throw new Error('Email inválido');
        }

        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;

        setSecurityMessage({
          type: 'success',
          text: 'Correo actualizado. Verifica tu nuevo email.',
        });
        setNewEmail('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setSecurityMessage({ type: 'error', text: msg });
    } finally {
      setSecuritySaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppLayout currentPath="/account">
      <div className="min-h-screen bg-[#0A0A0F] pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden border border-primary/30 bg-card shrink-0">
                {avatarUrl ? (
                  <AppImage
                    src={avatarUrl}
                    alt={`Foto de perfil de ${fullName || user?.email?.split('@')[0] || 'Usuario'}`}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-700 text-primary">
                    {(fullName || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-800 text-foreground">
                  {fullName || user?.email?.split('@')[0] || 'Usuario'}
                </h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-400/10 focus-ring"
            >
              <Icon name="ArrowRightOnRectangleIcon" size={16} />
              <span>Cerrar sesión</span>
            </button>
          </motion.div>

          <div className="space-y-12">
            <section id="activity" aria-label="Accesos de cuenta">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {accountActions.map((action) => {
                  const isActive = activePanel === action.id;
                  return (
                    <button
                      key={action.id}
                      id={`account-action-${action.id}`}
                      type="button"
                      aria-expanded={isActive}
                      aria-controls="account-panel"
                      onClick={() =>
                        setActivePanel((current) => (current === action.id ? null : action.id))
                      }
                      className={`group flex min-h-28 w-full items-start justify-between gap-3 rounded-2xl border p-4 text-left transition-colors focus-ring ${
                        isActive
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-card/80'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-primary'
                          }`}
                        >
                          <Icon name={action.icon as any} size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-700 text-foreground">
                            {action.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {action.description}
                          </span>
                        </span>
                      </span>
                      <Icon
                        name="ChevronDownIcon"
                        size={16}
                        className={`mt-1 shrink-0 text-muted-foreground transition-transform ${
                          isActive ? 'rotate-180 text-primary' : ''
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <div id="account-panel" className="scroll-mt-24">
                {activePanel && (
                  <div
                    key={activePanel}
                    role="region"
                    aria-labelledby={`account-action-${activePanel}`}
                    className="pt-6"
                  >
                    {activePanel === 'activity' && (
                      <RecentCoursesTab recentCourses={recentCourses} loading={recentLoading} />
                    )}
                    {activePanel === 'security' && (
                      <SecuritySettingsPanel
                        mode="password"
                        newPassword={newPassword}
                        setNewPassword={setNewPassword}
                        confirmPassword={confirmPassword}
                        setConfirmPassword={setConfirmPassword}
                        newEmail={newEmail}
                        setNewEmail={setNewEmail}
                        email={email}
                        securitySaving={securitySaving}
                        securityMessage={securityMessage}
                        onSave={handleSecuritySave}
                      />
                    )}
                    {activePanel === 'email' && (
                      <SecuritySettingsPanel
                        mode="email"
                        newPassword={newPassword}
                        setNewPassword={setNewPassword}
                        confirmPassword={confirmPassword}
                        setConfirmPassword={setConfirmPassword}
                        newEmail={newEmail}
                        setNewEmail={setNewEmail}
                        email={email}
                        securitySaving={securitySaving}
                        securityMessage={securityMessage}
                        onSave={handleSecuritySave}
                      />
                    )}
                  </div>
                )}
              </div>
            </section>

            <section id="membership" aria-labelledby="membership-heading" className="scroll-mt-24">
              <h2 id="membership-heading" className="text-xl font-700 text-foreground mb-5">
                Membresía y suscripción
              </h2>
              <SubscriptionTab
                userTier={userTier}
                tierLabel={tierLabel}
                tierPrice={tierPrice}
                tierDiscount={tierDiscount}
                tierFeatures={tierFeatures}
                loading={profileLoading}
              />
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Subscription Tab ──────────────────────────────────────────────────────────
function SubscriptionTab({
  userTier,
  tierLabel,
  tierPrice,
  tierDiscount,
  tierFeatures,
  loading,
}: {
  userTier: SubscriptionTier | null;
  tierLabel: string;
  tierPrice: { monthly: number; annual: number; annualTotal: number } | null;
  tierDiscount: number;
  tierFeatures: string[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-32 mb-3" />
          <div className="h-4 bg-muted rounded w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-24 mb-2" />
              <div className="h-10 bg-muted rounded" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="space-y-8"
    >
      {/* Current Plan */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-6 md:p-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            {userTier && (
              <div className="mb-3">
                <TierBadge tier={userTier} size="md" showIcon />
              </div>
            )}
            <h2 className="text-2xl md:text-3xl font-800 text-foreground">{tierLabel}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {userTier
                ? `$${tierPrice?.monthly}/mes · Membresía activa`
                : 'Suscríbete para acceder a contenido exclusivo y descuentos en cursos premium'}
            </p>
          </div>
          {userTier && (
            <div className="text-right md:text-left">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                Descuento en cursos premium
              </p>
              <p className="text-3xl font-800 gradient-gold-text">{tierDiscount}%</p>
            </div>
          )}
        </div>

        {userTier && (
          <div className="mt-6 border-t border-border pt-6">
            <p className="text-xs font-600 text-muted-foreground mb-4 uppercase tracking-wider">
              Beneficios incluidos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tierFeatures.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <Icon
                    name="CheckCircleIcon"
                    size={16}
                    className="text-primary shrink-0 mt-0.5"
                    variant="solid"
                  />
                  <span className="text-sm text-foreground">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href="/account/billing"
            className="btn-primary px-6 py-3 text-sm font-700 inline-flex items-center justify-center gap-2 focus-ring"
          >
            <Icon name="ArrowUpCircleIcon" size={18} />
            {userTier ? 'Gestionar membresía' : 'Sube a Premium'}
          </Link>
          <Link
            href="/#planes"
            className="text-sm font-600 text-muted-foreground hover:text-foreground transition-colors px-3 py-2 focus-ring rounded-lg"
          >
            Ver todos los planes
          </Link>
        </div>
      </motion.div>

      {/* Demo mode notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4"
      >
        <Icon
          name="ExclamationTriangleIcon"
          size={16}
          className="text-yellow-400 shrink-0 mt-0.5"
        />
        <div>
          <p className="text-sm font-600 text-yellow-400">Modo {PAYMENT_CONFIG.mode}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{PAYMENT_CONFIG.note}</p>
        </div>
      </motion.div>

      {/* Upgrade Options */}
      {!loading && userTier !== 'diafragma' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-700 text-foreground mb-6">Actualizar Membresía</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['apertura', 'obturador', 'diafragma'] as const).map((tier) => (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.3 + ['apertura', 'obturador', 'diafragma'].indexOf(tier) * 0.1,
                }}
                className={`rounded-2xl border p-6 transition-all relative overflow-hidden ${
                  userTier === tier
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30'
                }`}
              >
                {userTier === tier && (
                  <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs font-700 px-2 py-0.5 rounded-full">
                    Plan Actual
                  </div>
                )}
                <div className="mb-3">
                  <TierBadge tier={tier} size="md" showIcon />
                </div>
                <p className="text-2xl font-800 gradient-gold-text">
                  ${MEMBERSHIP_PRICES[tier].monthly}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ${MEMBERSHIP_PRICES[tier].annual}/mes (anual)
                </p>
                <p className="text-xs text-primary font-600 mt-3 flex items-center gap-1">
                  <Icon name="TagIcon" size={12} />
                  {MEMBERSHIP_DISCOUNTS[tier]}% descuento en premium
                </p>
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="text-xs font-600 text-muted-foreground mb-3 uppercase tracking-wider">
                    Incluye
                  </p>
                  <div className="space-y-2 max-h-40 overflow-hidden">
                    {MEMBERSHIP_FEATURES[tier].slice(0, 4).map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Icon
                          name="CheckIcon"
                          size={12}
                          className="text-primary shrink-0 mt-0.5"
                          variant="solid"
                        />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {MEMBERSHIP_FEATURES[tier].length > 4 && (
                      <div className="text-xs text-primary font-500 mt-1">
                        +{MEMBERSHIP_FEATURES[tier].length - 4} más...
                      </div>
                    )}
                  </div>
                </div>
                {userTier === tier ? (
                  <button className="mt-5 w-full btn-ghost py-2 text-sm font-600" disabled>
                    Plan actual
                  </button>
                ) : (
                  <Link
                    href="/account/billing"
                    className="mt-5 w-full btn-primary py-2 text-sm font-700 flex items-center justify-center gap-2 focus-ring"
                  >
                    {userTier ? 'Cambiar a este plan' : 'Suscribirse'}
                    <Icon name="ArrowRightIcon" size={14} />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Recent Courses Tab ────────────────────────────────────────────────────────
function RecentCoursesTab({
  recentCourses,
  loading,
}: {
  recentCourses: CourseProgressRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="glass-card rounded-xl p-4 animate-pulse flex items-center gap-4"
          >
            <div className="w-16 h-10 rounded-lg bg-muted shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-muted rounded w-48 mb-2" />
              <div className="h-2 bg-muted rounded w-full" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    );
  }

  if (recentCourses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-12 text-center"
      >
        <Icon name="PlayCircleIcon" size={48} className="text-muted-foreground/40 mx-auto mb-4" />
        <h3 className="text-lg font-700 text-foreground mb-2">Aún no has empezado nada</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
          Explora el catálogo y comienza tu primer curso. Tu progreso aparecerá aquí
          automáticamente.
        </p>
        <Link
          href="/courses"
          className="btn-primary px-6 py-2.5 text-sm font-700 inline-flex items-center gap-2"
        >
          <Icon name="FilmIcon" size={16} />
          Ver Cursos
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Summary stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
      >
        <StatCard label="Cursos iniciados" value={recentCourses.length} />
        <StatCard label="Completados" value={recentCourses.filter((r) => r.completed).length} />
        <StatCard
          label="Horas vistas"
          value={`${Math.round(recentCourses.reduce((acc, r) => acc + r.watched_seconds, 0) / 3600)} h`}
        />
        <StatCard label="En progreso" value={recentCourses.filter((r) => !r.completed).length} />
      </motion.div>

      {/* Course list */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {recentCourses.map((row, index) => {
          const pct =
            row.total_seconds > 0
              ? Math.min(100, Math.round((row.watched_seconds / row.total_seconds) * 100))
              : 0;
          return (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * index }}
              className="glass-card rounded-xl p-4 flex items-center gap-4 group hover:bg-muted/50 transition-colors"
            >
              {row.course_thumbnail && (
                <Link
                  href="/course-detail"
                  className="w-16 h-10 rounded-lg overflow-hidden shrink-0 relative"
                >
                  <AppImage
                    src={row.course_thumbnail}
                    alt={row.course_thumbnail_alt || row.course_title}
                    width={64}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="PlayIcon" size={20} className="text-white" />
                  </div>
                </Link>
              )}
              <div className="flex-1 min-w-0">
                <Link href="/course-detail" className="hover:text-primary transition-colors">
                  <p className="text-sm font-600 text-foreground truncate">{row.course_title}</p>
                </Link>
                <p className="text-xs text-muted-foreground mb-2">{row.course_instructor}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.3 }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
                </div>
              </div>
              {row.completed && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                  className="text-green-400"
                >
                  <Icon name="CheckCircleIcon" size={22} variant="solid" />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-xl p-4 text-center">
      <p className="text-2xl font-800 gradient-gold-text">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ── Security Settings ─────────────────────────────────────────────────────────
function SecuritySettingsPanel({
  mode,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  newEmail,
  setNewEmail,
  email,
  securitySaving,
  securityMessage,
  onSave,
}: {
  mode: 'password' | 'email';
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  newEmail: string;
  setNewEmail: (v: string) => void;
  email: string;
  securitySaving: boolean;
  securityMessage: { type: 'success' | 'error'; text: string } | null;
  onSave: (type: 'password' | 'email') => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl"
    >
      {mode === 'password' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="LockClosedIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-700 text-foreground">Cambiar Contraseña</h3>
              <p className="text-sm text-muted-foreground">
                Tu contraseña debe tener al menos 8 caracteres
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="newPassword"
                className="text-sm font-600 text-foreground block mb-1.5"
              >
                Nueva Contraseña
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-dark px-4 py-2.5 text-sm w-full"
                placeholder="Mín. 8 caracteres"
              />
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="text-sm font-600 text-foreground block mb-1.5"
              >
                Confirmar Nueva Contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-dark px-4 py-2.5 text-sm w-full"
                placeholder="••••••••"
              />
            </div>
            <button
              onClick={() => onSave('password')}
              disabled={securitySaving || !newPassword || !confirmPassword}
              className="btn-primary px-6 py-2.5 text-sm font-700 flex items-center gap-2 focus-ring"
            >
              {securitySaving && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full"
                />
              )}
              {securitySaving ? 'Guardando…' : 'Actualizar Contraseña'}
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="MailIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-700 text-foreground">Cambiar Correo Electrónico</h3>
              <p className="text-sm text-muted-foreground">
                Recibirás un email de verificación en la nueva dirección
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-600 text-foreground block mb-1.5">Correo Actual</label>
              <input
                type="email"
                value={email}
                className="input-dark px-4 py-2.5 text-sm w-full opacity-60"
                aria-label="Correo electrónico actual"
                disabled
              />
            </div>
            <div>
              <label htmlFor="newEmail" className="text-sm font-600 text-foreground block mb-1.5">
                Nuevo Correo Electrónico
              </label>
              <input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="input-dark px-4 py-2.5 text-sm w-full"
                placeholder="nuevo@email.com"
              />
            </div>
            <button
              onClick={() => onSave('email')}
              disabled={securitySaving || !newEmail}
              className="btn-primary px-6 py-2.5 text-sm font-700 flex items-center gap-2 focus-ring"
            >
              {securitySaving ? 'Actualizando…' : 'Actualizar Correo'}
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {securityMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-500 shadow-2xl ${
              securityMessage.type === 'success'
                ? 'bg-green-500/90 text-white'
                : 'bg-red-500/90 text-white'
            }`}
            role="alert"
          >
            <Icon
              name={securityMessage.type === 'success' ? 'CheckCircleIcon' : 'XCircleIcon'}
              size={18}
              variant="solid"
            />
            {securityMessage.text}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
