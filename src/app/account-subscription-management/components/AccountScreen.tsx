'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscriptionTier, type SubscriptionTier } from '@/lib/subscription';
import { MEMBERSHIP_PRICES, MEMBERSHIP_FEATURES, MEMBERSHIP_DISCOUNTS, TIER_LABELS, PAYMENT_CONFIG } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface DownloadRow {
  id: string;
  file_name: string;
  course_title: string;
  file_size: string | null;
  file_type: string;
  downloaded_at: string;
}

type AccountSection = 'perfil' | 'suscripcion' | 'progreso' | 'descargas' | 'certificados';

// ─── Account Screen ───────────────────────────────────────────────────────────

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const supabase = createClient();

  const [section, setSection] = useState<AccountSection>('suscripcion');
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Profile state
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Progress state
  const [progressRows, setProgressRows] = useState<CourseProgressRow[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  // Downloads state
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);

  // Sign-out state
  const [signingOut, setSigningOut] = useState(false);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setStatsLoading(false); return; }

    // Populate profile fields from user metadata first (fast)
    setFullName(user.user_metadata?.full_name || '');
    setAvatarUrl(user.user_metadata?.avatar_url || '');

    // Then load subscription tier + profile from DB
    const load = async () => {
      const [tier, profileData] = await Promise.all([
        getUserSubscriptionTier(),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
      ]);
      setUserTier(tier);
      if (profileData.data) {
        if (profileData.data.full_name) setFullName(profileData.data.full_name);
        if (profileData.data.avatar_url) setAvatarUrl(profileData.data.avatar_url);
      }
      setStatsLoading(false);
    };
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load progress when section changes ─────────────────────────────────────
  useEffect(() => {
    if (section !== 'progreso' || !user) return;
    setProgressLoading(true);
    supabase
      .from('course_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setProgressRows((data as CourseProgressRow[]) || []);
        setProgressLoading(false);
      });
  }, [section, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load downloads when section changes ────────────────────────────────────
  useEffect(() => {
    if (section !== 'descargas' || !user) return;
    setDownloadsLoading(true);
    supabase
      .from('downloads')
      .select('*')
      .eq('user_id', user.id)
      .order('downloaded_at', { ascending: false })
      .then(({ data }) => {
        setDownloads((data as DownloadRow[]) || []);
        setDownloadsLoading(false);
      });
  }, [section, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ──────────────────────────────────────────────────────────
  const tierLabel = userTier ? TIER_LABELS[userTier] : 'Sin membresía';
  const tierPrice = userTier ? MEMBERSHIP_PRICES[userTier] : null;
  const tierDiscount = userTier ? MEMBERSHIP_DISCOUNTS[userTier] : 0;
  const tierFeatures = userTier ? MEMBERSHIP_FEATURES[userTier] : [];

  const completedCourses = progressRows.filter((r) => r.completed);

  const navItems: { id: AccountSection; label: string; icon: string }[] = [
    { id: 'perfil', label: 'Perfil', icon: 'UserCircleIcon' },
    { id: 'suscripcion', label: 'Suscripción', icon: 'CreditCardIcon' },
    { id: 'progreso', label: 'Mi Progreso', icon: 'ChartBarIcon' },
    { id: 'descargas', label: 'Descargas', icon: 'ArrowDownTrayIcon' },
    { id: 'certificados', label: 'Certificados', icon: 'TrophyIcon' },
  ];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/sign-up-login');
    } catch {
      setSigningOut(false);
    }
  };

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setProfileError('Solo se permiten imágenes.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('La imagen no puede superar 2 MB.');
      return;
    }

    setAvatarUploading(true);
    setProfileError(null);

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      // Update profile in DB
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl });

      // Update user metadata
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

      setAvatarUrl(publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir la imagen';
      setProfileError(msg);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      // Update profiles table
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: fullName, updated_at: new Date().toISOString() });

      if (dbError) throw dbError;

      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (authError) throw authError;

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setProfileError(msg);
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-10">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            {/* Avatar with upload */}
            <div className="relative w-14 h-14 group cursor-pointer" onClick={handleAvatarClick}>
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/30">
                <AppImage
                  src={avatarUrl || 'https://img.rocket.new/generatedImages/rocket_gen_img_1453e1878-1763300003100.png'}
                  alt={`Foto de perfil de ${fullName || user?.email?.split('@')[0] || 'Usuario'}`}
                  width={56}
                  height={56}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarUploading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Icon name="CameraIcon" size={16} className="text-white" />
                }
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-700 text-foreground">
                  {fullName || user?.email?.split('@')[0] || 'Usuario'}
                </h1>
                {userTier && <TierBadge tier={userTier} size="sm" showIcon />}
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-400/10"
          >
            {signingOut
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Icon name="ArrowRightOnRectangleIcon" size={16} />
            }
            <span className="hidden sm:block">Cerrar sesión</span>
          </button>
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

            {/* ── PROFILE ── */}
            {section === 'perfil' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Mi Perfil</h2>
                <div className="glass-card rounded-2xl p-6">
                  {/* Avatar upload area */}
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                    <div className="relative w-20 h-20 group cursor-pointer" onClick={handleAvatarClick}>
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/30">
                        <AppImage
                          src={avatarUrl || 'https://img.rocket.new/generatedImages/rocket_gen_img_1453e1878-1763300003100.png'}
                          alt="Avatar de perfil"
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {avatarUploading
                          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Icon name="CameraIcon" size={20} className="text-white" />
                        }
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-600 text-foreground mb-1">Foto de perfil</p>
                      <p className="text-xs text-muted-foreground mb-2">JPG, PNG o GIF · Máx. 2 MB</p>
                      <button
                        onClick={handleAvatarClick}
                        disabled={avatarUploading}
                        className="btn-ghost px-3 py-1.5 text-xs font-600 flex items-center gap-1.5"
                      >
                        <Icon name="ArrowUpTrayIcon" size={12} />
                        {avatarUploading ? 'Subiendo…' : 'Cambiar foto'}
                      </button>
                    </div>
                  </div>

                  {/* Profile form */}
                  <div className="flex flex-col gap-4 max-w-md">
                    <div>
                      <label className="text-sm font-600 text-foreground block mb-1.5">Nombre</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
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
                      <p className="text-xs text-muted-foreground mt-1">El correo no puede modificarse desde aquí.</p>
                    </div>

                    {profileError && (
                      <p className="text-xs text-red-400">{profileError}</p>
                    )}
                    {profileSaved && (
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <Icon name="CheckCircleIcon" size={12} variant="solid" />
                        Cambios guardados correctamente
                      </p>
                    )}

                    <button
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="btn-primary px-6 py-2.5 text-sm font-700 self-start flex items-center gap-2"
                    >
                      {profileSaving && (
                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      )}
                      {profileSaving ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── SUBSCRIPTION ── */}
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
                {statsLoading ? (
                  <div className="glass-card rounded-2xl p-6 mb-6 animate-pulse">
                    <div className="h-6 bg-muted rounded w-32 mb-3" />
                    <div className="h-4 bg-muted rounded w-48" />
                  </div>
                ) : userTier ? (
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
                {!statsLoading && userTier !== 'diafragma' && (
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

            {/* ── PROGRESS ── */}
            {section === 'progreso' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Mi Progreso</h2>

                {progressLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                        <div className="h-4 bg-muted rounded w-48 mb-2" />
                        <div className="h-2 bg-muted rounded w-full" />
                      </div>
                    ))}
                  </div>
                ) : progressRows.length === 0 ? (
                  <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <Icon name="ChartBarIcon" size={32} className="text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Aún no has comenzado ningún curso.
                      </p>
                      <Link href="/dashboard" className="btn-ghost px-5 py-2 text-sm">
                        Explorar Cursos
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                      <div className="glass-card rounded-xl p-4 text-center">
                        <p className="text-2xl font-800 gradient-gold-text">{progressRows.length}</p>
                        <p className="text-xs text-muted-foreground mt-1">Cursos iniciados</p>
                      </div>
                      <div className="glass-card rounded-xl p-4 text-center">
                        <p className="text-2xl font-800 gradient-gold-text">{completedCourses.length}</p>
                        <p className="text-xs text-muted-foreground mt-1">Cursos completados</p>
                      </div>
                      <div className="glass-card rounded-xl p-4 text-center col-span-2 sm:col-span-1">
                        <p className="text-2xl font-800 gradient-gold-text">
                          {Math.round(progressRows.reduce((acc, r) => acc + r.watched_seconds, 0) / 3600)}h
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Horas vistas</p>
                      </div>
                    </div>

                    {/* Course list */}
                    {progressRows.map((row) => {
                      const pct = row.total_seconds > 0
                        ? Math.min(100, Math.round((row.watched_seconds / row.total_seconds) * 100))
                        : 0;
                      return (
                        <div key={row.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
                          {row.course_thumbnail && (
                            <div className="w-14 h-10 rounded-lg overflow-hidden shrink-0">
                              <AppImage
                                src={row.course_thumbnail}
                                alt={row.course_thumbnail_alt || row.course_title}
                                width={56}
                                height={40}
                                className="object-cover w-full h-full"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-600 text-foreground truncate">{row.course_title}</p>
                            <p className="text-xs text-muted-foreground mb-2">{row.course_instructor}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
                            </div>
                          </div>
                          {row.completed && (
                            <Icon name="CheckCircleIcon" size={18} className="text-green-400 shrink-0" variant="solid" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── DOWNLOADS ── */}
            {section === 'descargas' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Mis Descargas</h2>
                {downloadsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                        <div className="h-4 bg-muted rounded w-48" />
                      </div>
                    ))}
                  </div>
                ) : downloads.length === 0 ? (
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
                ) : (
                  <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="divide-y divide-border">
                      {downloads.map((dl) => (
                        <div key={dl.id} className="flex items-center gap-4 px-5 py-3.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon name="DocumentArrowDownIcon" size={16} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-500 text-foreground truncate">{dl.file_name}</p>
                            <p className="text-xs text-muted-foreground">{dl.course_title}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-600 text-muted-foreground uppercase">{dl.file_type}</span>
                            {dl.file_size && (
                              <p className="text-xs text-muted-foreground">{dl.file_size}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CERTIFICATES ── */}
            {section === 'certificados' && (
              <div>
                <h2 className="text-lg font-700 text-foreground mb-6">Mis Certificados</h2>
                {completedCourses.length === 0 ? (
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
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {completedCourses.map((row) => (
                      <div key={row.id} className="glass-card rounded-2xl p-5 border border-primary/20">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon name="TrophyIcon" size={18} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-700 text-foreground truncate">{row.course_title}</p>
                            <p className="text-xs text-muted-foreground">{row.course_instructor}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            Completado {new Date(row.updated_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                          <button className="btn-ghost px-3 py-1.5 text-xs font-600 flex items-center gap-1.5">
                            <Icon name="ArrowDownTrayIcon" size={12} />
                            Descargar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}