'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import AppImage from '@/components/ui/AppImage';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import OtpVerifyScreen from './OtpVerifyScreen';


type AuthTab = 'login' | 'signup';
type AuthView = 'form' | 'otp-signup' | 'forgot-password' | 'otp-recovery' | 'new-password';

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

interface SignupForm {
  name: string;
  email: string;
  password: string;
  plan: string;
}

interface ForgotPasswordForm {
  email: string;
}

interface NewPasswordForm {
  password: string;
  confirmPassword: string;
}

const plans = [
  { id: 'apertura', name: 'Apertura', price: '$9/mes', tier: 'apertura' as const },
  { id: 'obturador', name: 'Obturador', price: '$18/mes', tier: 'obturador' as const, recommended: true },
  { id: 'diafragma', name: 'Diafragma', price: '$36/mes', tier: 'diafragma' as const },
];

export default function AuthScreen() {
  const [tab, setTab] = useState<AuthTab>('login');
  const [view, setView] = useState<AuthView>('form');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [pendingPlan, setPendingPlan] = useState('obturador');

  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const supabase = createClient();

  const loginForm = useForm<LoginForm>({ defaultValues: { email: '', password: '', remember: false } });
  const signupForm = useForm<SignupForm>({ defaultValues: { name: '', email: '', password: '', plan: 'obturador' } });
  const forgotForm = useForm<ForgotPasswordForm>({ defaultValues: { email: '' } });
  const newPasswordForm = useForm<NewPasswordForm>({ defaultValues: { password: '', confirmPassword: '' } });
  const watchedPlan = signupForm.watch('plan');

  const handleLogin = async (data: LoginForm) => {
    setLoading(true);
    setLoginError('');
    try {
      await signIn(data.email, data.password);
      toast.success('¡Bienvenido a Glewstudio!');
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Credenciales incorrectas. Verifica tu correo y contraseña.';
      setLoginError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    setLoading(true);
    try {
      // signUp without emailRedirectTo so Supabase sends a 6-digit OTP code
      await signUp(data.email, data.password, { fullName: data.name, plan: data.plan });
      setPendingEmail(data.email);
      setPendingName(data.name);
      setPendingPlan(data.plan);
      setView('otp-signup');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear la cuenta. Intenta de nuevo.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password: step 1 — send OTP to email ──────────────────────────
  const handleForgotPassword = async (data: ForgotPasswordForm) => {
    setLoading(true);
    setForgotError('');
    try {
      // Use our server-side route to generate and send the recovery OTP via Resend
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, type: 'recovery' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'No se pudo enviar el código.');
      setPendingEmail(data.email);
      setView('otp-recovery');
      toast.success('Código enviado a tu correo.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo enviar el código. Verifica el correo.';
      setForgotError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password: step 3 — set new password ───────────────────────────
  const handleNewPassword = async (data: NewPasswordForm) => {
    if (data.password !== data.confirmPassword) {
      setNewPasswordError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setNewPasswordError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      toast.success('¡Contraseña actualizada! Inicia sesión.');
      setView('form');
      setTab('login');
      newPasswordForm.reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar la contraseña.';
      setNewPasswordError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP signup screen ─────────────────────────────────────────────────────
  if (view === 'otp-signup') {
    return (
      <OtpVerifyScreen
        email={pendingEmail}
        name={pendingName}
        plan={pendingPlan}
        mode="signup"
        onBack={() => {
          setView('form');
          setTab('signup');
        }}
      />
    );
  }

  // ── OTP recovery screen ───────────────────────────────────────────────────
  if (view === 'otp-recovery') {
    return (
      <OtpVerifyScreen
        email={pendingEmail}
        name=""
        mode="recovery"
        onBack={() => setView('forgot-password')}
        onRecoverySuccess={() => setView('new-password')}
      />
    );
  }

  // ── New password screen ───────────────────────────────────────────────────
  if (view === 'new-password') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <AppLogo size={32} />
            <span className="font-extrabold text-lg text-foreground">Glewstudio</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <Icon name="LockClosedIcon" size={26} className="text-primary" />
            </div>

            <h2 className="text-2xl font-800 text-foreground text-center mb-2">Nueva contraseña</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Elige una contraseña segura para tu cuenta.
            </p>

            {newPasswordError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-5">
                <Icon name="ExclamationTriangleIcon" size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{newPasswordError}</p>
              </div>
            )}

            <form onSubmit={newPasswordForm.handleSubmit(handleNewPassword)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className="text-sm font-600 text-foreground">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-dark px-4 py-2.5 text-sm w-full pr-10"
                    {...newPasswordForm.register('password', {
                      required: 'La contraseña es obligatoria',
                      minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showNewPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    <Icon name={showNewPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
                {newPasswordForm.formState.errors.password && (
                  <p className="text-xs text-red-400">{newPasswordForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className="text-sm font-600 text-foreground">
                  Confirmar contraseña
                </label>
                <input
                  id="confirm-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-dark px-4 py-2.5 text-sm w-full"
                  {...newPasswordForm.register('confirmPassword', { required: 'Confirma tu contraseña' })}
                />
                {newPasswordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-400">{newPasswordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-sm font-700 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    Guardando…
                  </>
                ) : (
                  'Guardar contraseña'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password form ──────────────────────────────────────────────────
  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <AppLogo size={32} />
            <span className="font-extrabold text-lg text-foreground">Glewstudio</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <Icon name="KeyIcon" size={26} className="text-primary" />
            </div>

            <h2 className="text-2xl font-800 text-foreground text-center mb-2">¿Olvidaste tu contraseña?</h2>
            <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
              Ingresa tu correo y te enviaremos un código para restablecer tu contraseña.
            </p>

            {forgotError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-5">
                <Icon name="ExclamationTriangleIcon" size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{forgotError}</p>
              </div>
            )}

            <form onSubmit={forgotForm.handleSubmit(handleForgotPassword)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="forgot-email" className="text-sm font-600 text-foreground">
                  Correo electrónico
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="tu@correo.com"
                  className="input-dark px-4 py-2.5 text-sm w-full"
                  {...forgotForm.register('email', {
                    required: 'El correo es obligatorio',
                    pattern: { value: /^\S+@\S+$/i, message: 'Correo inválido' },
                  })}
                />
                {forgotForm.formState.errors.email && (
                  <p className="text-xs text-red-400">{forgotForm.formState.errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-sm font-700 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    Enviando…
                  </>
                ) : (
                  'Enviar código'
                )}
              </button>
            </form>

            <button
              onClick={() => { setView('form'); setTab('login'); forgotForm.reset(); setForgotError(''); }}
              className="mt-4 w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="ArrowLeftIcon" size={14} />
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main login / signup form ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        <AppImage
          src="https://img.rocket.new/generatedImages/rocket_gen_img_12943e71b-1772750116690.png"
          alt="Professional photographer in dark studio working with dramatic lighting creating artistic portrait"
          fill
          priority
          className="object-cover"
          sizes="60vw"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo size={36} />
            <span className="font-extrabold text-xl text-foreground">Glewstudio</span>
          </Link>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="SparklesIcon" size={16} className="text-primary" />
              <span className="text-xs font-700 text-primary tracking-wider uppercase">
                Plataforma Premium de Fotografía
              </span>
            </div>
            <h2 className="text-hero-md font-800 text-foreground mb-4 leading-tight">
              Aprende de<br />
              <span className="gradient-gold-text">Fotógrafos Reales</span>
            </h2>
            <p className="text-muted-foreground max-w-sm">
              Cursos de estudio, iluminación, edición y dirección creativa. Acceso a archivos RAW, esquemas de luz y talleres en vivo.
            </p>
            <div className="flex items-center gap-6 mt-8">
              {[
                { icon: 'FilmIcon', label: '120+ Cursos' },
                { icon: 'UsersIcon', label: '18K Estudiantes' },
                { icon: 'StarIcon', label: '4.9 Rating' },
              ].map((stat) => (
                <div key={`auth-stat-${stat.label}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name={stat.icon as any} size={16} className="text-primary" />
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <AppLogo size={32} />
          <span className="font-extrabold text-lg text-foreground">Glewstudio</span>
        </div>

        <div className="w-full max-w-md">
          {/* Tab toggle */}
          <div className="flex bg-muted rounded-xl p-1 mb-8">
            {(['login', 'signup'] as AuthTab[]).map((t) => (
              <button
                key={`auth-tab-${t}`}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-600 rounded-lg transition-all duration-200 ${
                  tab === t
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </button>
            ))}
          </div>

          {/* LOGIN FORM */}
          {tab === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="flex flex-col gap-5">
              <div>
                <h2 className="text-2xl font-800 text-foreground mb-1">Bienvenido de vuelta</h2>
                <p className="text-sm text-muted-foreground">Inicia sesión para continuar aprendiendo.</p>
              </div>

              {/* Error banner */}
              {loginError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{loginError}</p>
                </div>
              )}

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-email" className="text-sm font-600 text-foreground">
                  Correo electrónico
                </label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="tu@correo.com"
                  className="input-dark px-4 py-2.5 text-sm w-full"
                  {...loginForm.register('email', {
                    required: 'El correo es obligatorio',
                    pattern: { value: /^\S+@\S+$/i, message: 'Correo inválido' },
                  })}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-red-400">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm font-600 text-foreground">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot-password'); forgotForm.reset(); setForgotError(''); }}
                    className="text-xs text-primary hover:text-accent transition-colors font-500"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-dark px-4 py-2.5 text-sm w-full pr-10"
                    {...loginForm.register('password', { required: 'La contraseña es obligatoria' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-red-400">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border bg-input accent-primary"
                  {...loginForm.register('remember')}
                />
                <span className="text-sm text-muted-foreground">Mantenerme conectado</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-sm font-700 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    Verificando…
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>

              <p className="text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  className="text-primary hover:text-accent font-600 transition-colors"
                >
                  Regístrate gratis
                </button>
              </p>
            </form>
          )}

          {/* SIGNUP FORM */}
          {tab === 'signup' && (
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="flex flex-col gap-5">
              <div>
                <h2 className="text-2xl font-800 text-foreground mb-1">Crea tu cuenta</h2>
                <p className="text-sm text-muted-foreground">Únete a 18,000 fotógrafos en Glewstudio.</p>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-name" className="text-sm font-600 text-foreground">
                  Nombre completo
                </label>
                <input
                  id="signup-name"
                  type="text"
                  placeholder="Tu nombre"
                  className="input-dark px-4 py-2.5 text-sm w-full"
                  {...signupForm.register('name', { required: 'El nombre es obligatorio' })}
                />
                {signupForm.formState.errors.name && (
                  <p className="text-xs text-red-400">{signupForm.formState.errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-email" className="text-sm font-600 text-foreground">
                  Correo electrónico
                </label>
                <input
                  id="signup-email"
                  type="email"
                  placeholder="tu@correo.com"
                  className="input-dark px-4 py-2.5 text-sm w-full"
                  {...signupForm.register('email', {
                    required: 'El correo es obligatorio',
                    pattern: { value: /^\S+@\S+$/i, message: 'Correo inválido' },
                  })}
                />
                {signupForm.formState.errors.email && (
                  <p className="text-xs text-red-400">{signupForm.formState.errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-password" className="text-sm font-600 text-foreground">
                  Contraseña
                </label>
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, una mayúscula y un número.</p>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-dark px-4 py-2.5 text-sm w-full pr-10"
                    {...signupForm.register('password', {
                      required: 'La contraseña es obligatoria',
                      minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
                {signupForm.formState.errors.password && (
                  <p className="text-xs text-red-400">{signupForm.formState.errors.password.message}</p>
                )}
              </div>

              {/* Plan selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-600 text-foreground">Elige tu plan</label>
                <div className="flex flex-col gap-2">
                  {plans.map((plan) => (
                    <label
                      key={`signup-plan-${plan.id}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        watchedPlan === plan.id
                          ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-border/80'
                      }`}
                    >
                      <input
                        type="radio"
                        value={plan.id}
                        className="accent-primary"
                        {...signupForm.register('plan')}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <TierBadge tier={plan.tier} size="sm" />
                        <span className="text-sm font-600 text-foreground">{plan.name}</span>
                        {'recommended' in plan && plan.recommended && (
                          <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-700">
                            Popular
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-700 text-primary">{plan.price}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-sm font-700 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    Creando cuenta…
                  </>
                ) : (
                  'Crear Cuenta'
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground leading-relaxed">
                Al registrarte aceptas nuestros{' '}
                <a href="#" className="text-primary hover:underline">
                  Términos de Uso
                </a>{' '}
                y{' '}
                <a href="#" className="text-primary hover:underline">
                  Política de Privacidad
                </a>
                .
              </p>

              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-primary hover:text-accent font-600 transition-colors"
                >
                  Inicia sesión
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
