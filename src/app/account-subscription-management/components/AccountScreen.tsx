'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type AccountSection = 'perfil' | 'suscripcion' | 'facturacion' | 'descargas' | 'certificados';

interface ProfileForm {
  name: string;
  email: string;
  bio: string;
  notifyNewCourses: boolean;
  notifyLive: boolean;
  notifyProgress: boolean;
}

const invoices = [
{ id: 'inv-001', date: '01 jul 2026', amount: '$18.00', status: 'Pagado', plan: 'Obturador', method: 'Visa ••••4821' },
{ id: 'inv-002', date: '01 jun 2026', amount: '$18.00', status: 'Pagado', plan: 'Obturador', method: 'Visa ••••4821' },
{ id: 'inv-003', date: '01 may 2026', amount: '$18.00', status: 'Pagado', plan: 'Obturador', method: 'Visa ••••4821' },
{ id: 'inv-004', date: '01 abr 2026', amount: '$18.00', status: 'Pagado', plan: 'Obturador', method: 'Visa ••••4821' },
{ id: 'inv-005', date: '01 mar 2026', amount: '$12.00', status: 'Pagado', plan: 'Apertura', method: 'Visa ••••4821' },
{ id: 'inv-006', date: '01 feb 2026', amount: '$12.00', status: 'Pagado', plan: 'Apertura', method: 'Visa ••••4821' }];


const downloads = [
{ id: 'dl-001', name: 'Archivo RAW — Iluminación Rembrandt (Lección 4)', course: 'Iluminación Rembrandt para Retrato', date: '22 jul 2026', size: '48.2 MB', type: 'RAW' },
{ id: 'dl-002', name: 'Esquema de Iluminación Rembrandt — PDF', course: 'Iluminación Rembrandt para Retrato', date: '22 jul 2026', size: '2.8 MB', type: 'PDF' },
{ id: 'dl-003', name: 'Preset Lightroom — Tonos Cálidos Retrato', course: 'Iluminación Rembrandt para Retrato', date: '20 jul 2026', size: '1.1 MB', type: 'PRESET' },
{ id: 'dl-004', name: 'Archivo RAW — Fotografía de Producto Mesa de Luz', course: 'Fotografía de Producto en Mesa de Luz', date: '18 jul 2026', size: '62.5 MB', type: 'RAW' },
{ id: 'dl-005', name: 'Flujo de Trabajo RAW — PDF Guía Rápida', course: 'Flujo de Trabajo RAW en Lightroom', date: '15 jul 2026', size: '4.2 MB', type: 'PDF' },
{ id: 'dl-006', name: 'Preset Pack — Tonos Cinematográficos (6 presets)', course: 'Color Grading Cinematográfico', date: '12 jul 2026', size: '3.8 MB', type: 'PRESET' }];


const certificates = [
{ id: 'cert-001', course: 'Flujo de Trabajo RAW en Lightroom', completed: '10 jul 2026', instructor: 'Alejandro Vega', credential: 'GS-2026-LR-0481' },
{ id: 'cert-002', course: 'Fotografía de Producto en Mesa de Luz', completed: '02 jul 2026', instructor: 'Sofía Reyes', credential: 'GS-2026-PP-0329' }];


const navItems: {id: AccountSection;label: string;icon: string;}[] = [
{ id: 'perfil', label: 'Perfil', icon: 'UserCircleIcon' },
{ id: 'suscripcion', label: 'Suscripción', icon: 'CreditCardIcon' },
{ id: 'facturacion', label: 'Facturación', icon: 'DocumentTextIcon' },
{ id: 'descargas', label: 'Descargas', icon: 'ArrowDownTrayIcon' },
{ id: 'certificados', label: 'Certificados', icon: 'TrophyIcon' }];


export default function AccountScreen() {
  const [section, setSection] = useState<AccountSection>('suscripcion');
  const [saving, setSaving] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [coursesInProgress, setCoursesInProgress] = useState(0);
  const [certificatesCount, setCertificatesCount] = useState(0);
  const [completedCourses, setCompletedCourses] = useState<{ id: string; course_id: string; course_title: string; course_instructor: string; completed_at: string | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user, signOut } = useAuth();
  const supabase = createClient();

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario';
  const displayEmail = user?.email || '';
  const currentAvatar = avatarUrl || user?.user_metadata?.avatar_url || 'https://img.rocket.new/generatedImages/rocket_gen_img_1453e1878-1763300003100.png';

  const tierLabel = userTier
    ? userTier.charAt(0).toUpperCase() + userTier.slice(1)
    : 'Sin plan';

  useEffect(() => {
    if (!user) {
      setStatsLoading(false);
      return;
    }

    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        // Fetch subscription tier
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('tier')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        setUserTier(subData?.tier ?? null);

        // Fetch course progress stats
        const { data: progressData } = await supabase
          .from('course_progress')
          .select('id, course_id, course_title, course_instructor, watched_seconds, completed, completed_at')
          .eq('user_id', user.id);

        if (progressData) {
          const totalSeconds = progressData.reduce((sum, row) => sum + (row.watched_seconds || 0), 0);
          setWatchedSeconds(totalSeconds);

          const inProgress = progressData.filter((row) => !row.completed).length;
          setCoursesInProgress(inProgress);

          const completed = progressData.filter((row) => row.completed);
          setCertificatesCount(completed.length);
          setCompletedCourses(
            completed.map((row) => ({
              id: row.id,
              course_id: row.course_id,
              course_title: row.course_title,
              course_instructor: row.course_instructor,
              completed_at: row.completed_at,
            }))
          );
        }
      } catch {
        // silently fail — stats remain at 0
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  // Format seconds into "Xh Ymin" or "Ymin"
  const formatWatchTime = (seconds: number): string => {
    if (seconds === 0) return '0 min';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  };

  const profileForm = useForm<ProfileForm>({
    defaultValues: {
      name: displayName,
      email: displayEmail,
      bio: 'Fotógrafa de retrato y moda basada en CDMX. Especializada en sesiones de estudio con iluminación artificial.',
      notifyNewCourses: true,
      notifyLive: true,
      notifyProgress: false
    }
  });

  const handleSaveProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: data.name }
      });
      if (error) throw error;
      toast.success('Perfil actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.push('/sign-up-login');
    } catch (err: any) {
      toast.error(err.message || 'Error al cerrar sesión');
      setLoggingOut(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 2MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success('Foto de perfil actualizada');
    } catch (err: any) {
      toast.error(err.message || 'Error al subir la imagen');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-primary/30">
            <AppImage
              src={currentAvatar}
              alt={`Foto de perfil de ${displayName}`}
              fill
              className="object-cover"
              sizes="56px" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-700 text-foreground">{displayName}</h1>
              {userTier && <TierBadge tier={userTier as any} size="sm" showIcon />}
            </div>
            <p className="text-sm text-muted-foreground">{displayEmail} · Miembro desde ene 2026</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left nav */}
          <aside className="w-full lg:w-56 xl:w-64 shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto scrollbar-hide">
              {navItems.map((item) =>
              <button
                key={`account-nav-${item.id}`}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-600 transition-all whitespace-nowrap ${
                section === item.id ?
                'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`
                }>
                
                  <Icon name={item.icon as any} size={17} />
                  {item.label}
                </button>
              )}
              {/* Logout button */}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-600 transition-all whitespace-nowrap text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-60 lg:mt-4">
                {loggingOut
                  ? <Icon name="ArrowPathIcon" size={17} className="animate-spin" />
                  : <Icon name="ArrowRightOnRectangleIcon" size={17} />
                }
                {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
              </button>
            </nav>
          </aside>

          {/* Right content */}
          <div className="flex-1 min-w-0">
            {/* PERFIL */}
            {section === 'perfil' &&
            <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-lg font-700 text-foreground mb-1">Información de Perfil</h2>
                <p className="text-sm text-muted-foreground mb-6">Actualiza tu información personal y preferencias de notificación.</p>

                <form onSubmit={profileForm.handleSubmit(handleSaveProfile)} className="flex flex-col gap-5">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-border">
                      <AppImage
                        src={currentAvatar}
                        alt="Foto de perfil actual del usuario"
                        fill
                        className="object-cover"
                        sizes="64px" />
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Icon name="ArrowPathIcon" size={18} className="text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      <button
                        type="button"
                        onClick={handleAvatarClick}
                        disabled={uploadingAvatar}
                        className="btn-ghost px-4 py-2 text-sm font-600 mb-1 disabled:opacity-60">
                        {uploadingAvatar ? 'Subiendo…' : 'Cambiar foto'}
                      </button>
                      <p className="text-xs text-muted-foreground">JPG, PNG o WebP · Máx. 2MB</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="acc-name" className="text-sm font-600 text-foreground">Nombre completo</label>
                      <input
                      id="acc-name"
                      type="text"
                      className="input-dark px-4 py-2.5 text-sm"
                      {...profileForm.register('name', { required: 'Nombre obligatorio' })} />
                    
                      {profileForm.formState.errors.name &&
                    <p className="text-xs text-red-400">{profileForm.formState.errors.name.message}</p>
                    }
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="acc-email" className="text-sm font-600 text-foreground">Correo electrónico</label>
                      <input
                      id="acc-email"
                      type="email"
                      className="input-dark px-4 py-2.5 text-sm"
                      {...profileForm.register('email', { required: 'Correo obligatorio' })} />
                    
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="acc-bio" className="text-sm font-600 text-foreground">Biografía</label>
                    <p className="text-xs text-muted-foreground">Cuéntanos sobre tu trabajo y estilo fotográfico.</p>
                    <textarea
                    id="acc-bio"
                    rows={3}
                    className="input-dark px-4 py-2.5 text-sm resize-none"
                    {...profileForm.register('bio')} />
                  
                  </div>

                  {/* Notifications */}
                  <div>
                    <h3 className="text-sm font-700 text-foreground mb-3">Notificaciones</h3>
                    <div className="flex flex-col gap-3">
                      {[
                    { field: 'notifyNewCourses' as const, label: 'Nuevos cursos y contenido', desc: 'Recibe un aviso cuando se publiquen nuevos cursos' },
                    { field: 'notifyLive' as const, label: 'Talleres en vivo', desc: 'Recordatorios antes de los talleres del Plan Diafragma' },
                    { field: 'notifyProgress' as const, label: 'Resumen de progreso semanal', desc: 'Un correo cada lunes con tu avance de la semana' }].
                    map((notif) =>
                    <label key={`notif-${notif.field}`} className="flex items-start gap-3 cursor-pointer">
                          <div className="relative mt-0.5">
                            <input
                          type="checkbox"
                          className="sr-only"
                          {...profileForm.register(notif.field)} />
                        
                            <div className={`w-10 h-5 rounded-full transition-colors ${profileForm.watch(notif.field) ? 'bg-primary' : 'bg-muted'}`}>
                              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${profileForm.watch(notif.field) ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-600 text-foreground">{notif.label}</p>
                            <p className="text-xs text-muted-foreground">{notif.desc}</p>
                          </div>
                        </label>
                    )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary px-6 py-2.5 text-sm font-700 flex items-center gap-2 disabled:opacity-60">
                    
                      {saving ?
                    <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Guardando…</> :

                    'Guardar Cambios'
                    }
                    </button>
                    <button type="button" className="btn-ghost px-5 py-2.5 text-sm font-600">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            }

            {/* SUSCRIPCIÓN */}
            {section === 'suscripcion' &&
            <div className="flex flex-col gap-5">
                {/* Current plan card */}
                <div className="bg-card border border-primary/20 rounded-2xl p-6">
                  <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-lg font-700 text-foreground">Plan Actual</h2>
                        {userTier && <TierBadge tier={userTier as any} size="md" showIcon />}
                      </div>
                      <p className="text-sm text-muted-foreground">Próxima renovación: <span className="text-foreground font-600">1 agosto 2026</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                      onClick={() => setShowCancelModal(true)}
                      className="text-xs text-red-400 hover:text-red-300 font-600 transition-colors">
                      
                        Cancelar suscripción
                      </button>
                    </div>
                  </div>

                  {/* Usage stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                  { label: 'Horas vistas', value: statsLoading ? '…' : formatWatchTime(watchedSeconds), icon: 'PlayCircleIcon', color: 'text-primary' },
                  { label: 'Cursos iniciados', value: statsLoading ? '…' : String(coursesInProgress), icon: 'BookOpenIcon', color: 'text-blue-400' },
                  { label: 'Descargas usadas', value: '0 / ∞', icon: 'ArrowDownTrayIcon', color: 'text-emerald-400' },
                  { label: 'Certificados', value: statsLoading ? '…' : String(certificatesCount), icon: 'TrophyIcon', color: 'text-amber-400' }].
                  map((stat) =>
                  <div key={`usage-${stat.label}`} className="bg-muted/40 rounded-xl p-3.5">
                        <Icon name={stat.icon as any} size={18} className={`${stat.color} mb-2`} />
                        <div className="text-xl font-800 text-foreground">{stat.value}</div>
                        <div className="text-xs text-muted-foreground">{stat.label}</div>
                      </div>
                  )}
                  </div>
                </div>

                {/* Upgrade CTA — only show if not on diafragma */}
                {userTier !== 'diafragma' && (
                <div className="bg-gradient-to-br from-purple-500/10 to-card border border-purple-500/20 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl tier-badge-diafragma flex items-center justify-center shrink-0">
                      <Icon name="SparklesIcon" size={22} className="text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-700 text-foreground mb-1">Actualiza al Plan Diafragma</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Desbloquea talleres en vivo mensuales, revisión de portafolio, certificaciones y acceso offline por solo $18 más al mes.
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {['Talleres en Vivo', 'Revisión de Portafolio', 'Certificaciones', 'Acceso Offline', 'Sesiones Q&A'].map((feat) =>
                      <span key={`upgrade-feat-${feat}`} className="text-xs tier-badge-diafragma px-2 py-0.5 rounded-full font-600">
                            {feat}
                          </span>
                      )}
                      </div>
                      <Link
                      href="/sign-up-login"
                      className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-700">
                      
                        <Icon name="ArrowUpCircleIcon" size={16} />
                        Actualizar a Diafragma — $36/mes
                      </Link>
                    </div>
                  </div>
                </div>
                )}
              </div>
            }

            {/* FACTURACIÓN */}
            {section === 'facturacion' &&
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <div>
                    <h2 className="text-lg font-700 text-foreground">Historial de Pagos</h2>
                    <p className="text-sm text-muted-foreground">Visa terminada en 4821 · Próximo cargo: $18.00 el 1 ago 2026</p>
                  </div>
                  <button className="btn-ghost px-4 py-2 text-sm font-600 flex items-center gap-2">
                    <Icon name="PencilIcon" size={14} />
                    Cambiar método
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {['Fecha', 'Descripción', 'Método', 'Monto', 'Estado', ''].map((col) =>
                      <th key={`invoice-col-${col}`} className="text-left px-5 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">
                            {col}
                          </th>
                      )}
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) =>
                    <tr key={inv.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5 text-sm text-foreground font-mono">{inv.date}</td>
                          <td className="px-5 py-3.5 text-sm text-foreground">
                            Glewstudio — Plan {inv.plan}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">{inv.method}</td>
                          <td className="px-5 py-3.5 text-sm font-700 text-foreground font-mono">{inv.amount}</td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-600 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button className="text-xs text-primary hover:text-accent font-600 transition-colors flex items-center gap-1">
                              <Icon name="ArrowDownTrayIcon" size={12} />
                              PDF
                            </button>
                          </td>
                        </tr>
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            }

            {/* DESCARGAS */}
            {section === 'descargas' &&
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-lg font-700 text-foreground mb-0.5">Archivos Descargados</h2>
                  <p className="text-sm text-muted-foreground">{downloads.length} archivos · Descargas ilimitadas con Plan Obturador</p>
                </div>
                <div className="divide-y divide-border">
                  {downloads.map((dl) =>
                <div key={dl.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  dl.type === 'RAW' ? 'bg-primary/10' :
                  dl.type === 'PDF' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`
                  }>
                        <Icon
                      name="DocumentArrowDownIcon"
                      size={18}
                      className={
                      dl.type === 'RAW' ? 'text-primary' :
                      dl.type === 'PDF' ? 'text-blue-400' : 'text-emerald-400'
                      } />
                    
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-600 text-foreground truncate">{dl.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{dl.course}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                        <span className="font-mono">{dl.date}</span>
                        <span>{dl.size}</span>
                        <span className={`font-700 px-2 py-0.5 rounded-full ${
                    dl.type === 'RAW' ? 'bg-primary/10 text-primary' :
                    dl.type === 'PDF' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`
                    }>
                          {dl.type}
                        </span>
                      </div>
                      <button
                    onClick={() => toast.success(`Descargando ${dl.name}…`)}
                    className="shrink-0 w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Volver a descargar ${dl.name}`}>
                    
                        <Icon name="ArrowDownTrayIcon" size={14} />
                      </button>
                    </div>
                )}
                </div>
              </div>
            }

            {/* CERTIFICADOS */}
            {section === 'certificados' &&
            <div className="flex flex-col gap-5">
                {statsLoading ? (
                  <div className="bg-card border border-border rounded-2xl p-12 text-center">
                    <Icon name="ArrowPathIcon" size={32} className="text-muted-foreground mx-auto mb-4 animate-spin" />
                    <p className="text-sm text-muted-foreground">Cargando certificados…</p>
                  </div>
                ) : completedCourses.length === 0 ?
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                    <Icon name="TrophyIcon" size={40} className="text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-700 text-foreground mb-2">Sin certificados aún</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Completa un curso para recibir tu certificado digital. Los certificados están disponibles en todos los planes.
                    </p>
                    <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-sm font-700 inline-flex">
                      Explorar Cursos
                    </Link>
                  </div> :

              <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{completedCourses.length} certificados obtenidos</p>
                    </div>
                    {completedCourses.map((cert) =>
                <div key={cert.id} className="bg-card border border-border rounded-2xl p-5 flex items-start gap-5">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center shrink-0">
                          <Icon name="TrophyIcon" size={26} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-700 text-foreground mb-1">{cert.course_title}</h3>
                          {cert.course_instructor && (
                            <p className="text-sm text-muted-foreground mb-1">Instructor: {cert.course_instructor}</p>
                          )}
                          {cert.completed_at && (
                            <p className="text-xs text-muted-foreground mb-3">
                              Completado el {new Date(cert.completed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} · ID: <span className="font-mono text-foreground">{cert.course_id.toUpperCase()}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                        onClick={() => toast.success('Certificado descargado')}
                        className="btn-primary px-4 py-1.5 text-xs font-700 flex items-center gap-1.5">
                        
                              <Icon name="ArrowDownTrayIcon" size={13} />
                              Descargar PDF
                            </button>
                            <button
                        onClick={() => toast.success('Enlace copiado al portapapeles')}
                        className="btn-ghost px-4 py-1.5 text-xs font-600 flex items-center gap-1.5">
                        
                              <Icon name="ShareIcon" size={13} />
                              Compartir
                            </button>
                          </div>
                        </div>
                      </div>
                )}

                    {/* Upgrade prompt for more certs */}
                    {userTier !== 'diafragma' && (
                    <div className="bg-muted/30 border border-border rounded-2xl p-5 flex items-center gap-4">
                      <Icon name="LockClosedIcon" size={20} className="text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-600 text-foreground mb-0.5">Certificaciones de Rutas Completas</p>
                        <p className="text-xs text-muted-foreground">Las certificaciones de rutas de aprendizaje completas requieren el Plan Diafragma.</p>
                      </div>
                      <Link href="/sign-up-login" className="btn-ghost px-3 py-1.5 text-xs font-600 shrink-0">
                        Actualizar
                      </Link>
                    </div>
                    )}
                  </>
              }
              </div>
            }
          </div>
        </div>
      </div>

      {/* Cancel subscription modal */}
      {showCancelModal &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCancelModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Icon name="ExclamationTriangleIcon" size={22} className="text-red-400" />
            </div>
            <h3 className="text-lg font-700 text-foreground text-center mb-2">¿Cancelar suscripción?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
              Perderás acceso a todos los cursos avanzados, descargas y tu historial de progreso al finalizar el período actual el <span className="text-foreground font-600">1 agosto 2026</span>.
            </p>
            <div className="flex flex-col gap-2">
              <button
              onClick={() => {
                setShowCancelModal(false);
                toast.error(`Suscripción cancelada. Acceso activo hasta el 1 ago 2026.`);
              }}
              className="w-full py-2.5 text-sm font-700 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors">
              
                Sí, cancelar suscripción
              </button>
              <button
              onClick={() => setShowCancelModal(false)}
              className="btn-primary w-full py-2.5 text-sm font-700">
              
                Mantener mi Plan {tierLabel}
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

}