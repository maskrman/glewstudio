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
import OtpVerifyScreen from './OtpVerifyScreen';


type AuthTab = 'login' | 'signup';

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

const plans = [
  { id: 'apertura', name: 'Apertura', price: '$9/mes', tier: 'apertura' as const },
  { id: 'obturador', name: 'Obturador', price: '$18/mes', tier: 'obturador' as const, recommended: true },
  { id: 'diafragma', name: 'Diafragma', price: '$36/mes', tier: 'diafragma' as const },
];

export default function AuthScreen() {
  const [tab, setTab] = useState<AuthTab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  // OTP verification state
  const [showOtp, setShowOtp] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingName, setPendingName] = useState('');

  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const loginForm = useForm<LoginForm>({ defaultValues: { email: '', password: '', remember: false } });
  const signupForm = useForm<SignupForm>({ defaultValues: { name: '', email: '', password: '', plan: 'obturador' } });
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
    // 1. Crear el usuario en Supabase
    await signUp(data.email, data.password, { fullName: data.name, plan: data.plan });

    // 2. Generar o tomar el código OTP (por ejemplo 6 dígitos)
    // Si tu signUp genera un código o usas uno temporal de prueba:
    const code = "123456"; // <-- Reemplaza por la variable que contenga tu código OTP real
    // 3. Enviar correo mediante Edge Function
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'OTP_VERIFICATION',
          email: data.email,
          name: data.name,
          otpCode: code, // <--- AHORA SÍ LO ENVÍA
        }),
      });
      const resData = await response.json();
      console.log('Respuesta de Edge Function:', resData);
    } catch (emailError) {
      console.error('Error al enviar el correo:', emailError);
    }
  } catch (error) {
    console.error('Error en el registro:', error);
  } finally {
    setLoading(false);
  }
};
      } catch {
        // Non-blocking — Supabase still sends its own confirmation email
      }

      setPendingEmail(data.email);
      setPendingName(data.name);
      setShowOtp(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear la cuenta. Intenta de nuevo.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Show OTP screen after signup
  if (showOtp) {
    return (
      <OtpVerifyScreen
        email={pendingEmail}
        name={pendingName}
        onBack={() => {
          setShowOtp(false);
          setTab('signup');
        }}
      />
    );
  }

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
                  <button type="button" className="text-xs text-primary hover:text-accent transition-colors font-500">
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
