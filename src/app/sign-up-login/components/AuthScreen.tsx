'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import AppImage from '@/components/ui/AppImage';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { MEMBERSHIP_PRICES } from '@/lib/config';
import { getPublicMembershipPlans, type MembershipPlan } from '@/app/admin/actions/membership';
import { createClient } from '@/lib/supabase/client';

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

interface Plan {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  tier: 'apertura' | 'obturador' | 'diafragma';
  recommended?: boolean;
}

export default function AuthScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [tab, setTab] = useState<AuthTab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  // Coupon state
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_percent: number;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, validateCoupon } = useAuth();

  const loginForm = useForm<LoginForm>({
    defaultValues: { email: '', password: '', remember: false },
  });
  const signupForm = useForm<SignupForm>({
    defaultValues: { name: '', email: '', password: '', plan: 'free' },
  });
  const watchedPlan = signupForm.watch('plan');

  // Reset coupon when plan changes to 'free'
  useEffect(() => {
    if (watchedPlan === 'free') {
      setShowCouponInput(false);
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponError('');
    }
  }, [watchedPlan]);

  // Handle coupon validation
  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError('Ingresa un código de cupón');
      return;
    }
    setCouponValidating(true);
    setCouponError('');
    try {
      const result = await validateCoupon(code);
      if (result.valid) {
        setAppliedCoupon({ code, discount_percent: result.discount_percent });
        setShowCouponInput(false);
        setCouponCode('');
        toast.success(`Cupón "${code}" aplicado: ${result.discount_percent}% de descuento`);
      } else {
        setCouponError(result.message || 'Cupón no válido');
        setAppliedCoupon(null);
      }
    } catch (err) {
      console.error('[AuthScreen] Error applying coupon:', err);
      setCouponError('Error al validar el cupón');
      setAppliedCoupon(null);
    } finally {
      setCouponValidating(false);
    }
  };

  // Handle removing applied coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setShowCouponInput(true);
    setCouponError('');
  };

  // Load membership plans from database
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadPlans() {
      try {
        const dbPlans = await getPublicMembershipPlans();

        if (!mounted) return;

        if (dbPlans && dbPlans.length > 0) {
          const transformedPlans: Plan[] = [
            {
              id: 'free',
              name: 'Gratis',
              subtitle: 'Explorador',
              price: 'Gratis',
              tier: 'apertura' as const,
            },
            ...dbPlans.map((dbPlan: MembershipPlan) => ({
              id: dbPlan.slug,
              name: dbPlan.name,
              subtitle: dbPlan.badge || 'Membresía',
              price: `$${dbPlan.monthly_price}/mes`,
              tier: dbPlan.slug as 'apertura' | 'obturador' | 'diafragma',
              recommended: dbPlan.is_popular,
            })),
          ];
          setPlans(transformedPlans);
        } else {
          // Fallback to config values
          const fallbackPlans: Plan[] = [
            {
              id: 'free',
              name: 'Gratis',
              subtitle: 'Explorador',
              price: 'Gratis',
              tier: 'apertura' as const,
            },
            {
              id: 'apertura',
              name: 'Apertura',
              subtitle: 'Membresía Básica',
              price: `$${MEMBERSHIP_PRICES.apertura.monthly}/mes`,
              tier: 'apertura' as const,
            },
            {
              id: 'obturador',
              name: 'Obturador',
              subtitle: 'Membresía Pro',
              price: `$${MEMBERSHIP_PRICES.obturador.monthly}/mes`,
              tier: 'obturador' as const,
              recommended: true,
            },
            {
              id: 'diafragma',
              name: 'Diafragma',
              subtitle: 'Membresía Master',
              price: `$${MEMBERSHIP_PRICES.diafragma.monthly}/mes`,
              tier: 'diafragma' as const,
            },
          ];
          setPlans(fallbackPlans);
        }
      } catch (error) {
        console.error('Error loading membership plans:', error);
        // Fallback to config values on error
        const fallbackPlans: Plan[] = [
          {
            id: 'free',
            name: 'Gratis',
            subtitle: 'Explorador',
            price: 'Gratis',
            tier: 'apertura' as const,
          },
          {
            id: 'apertura',
            name: 'Apertura',
            subtitle: 'Membresía Básica',
            price: `$${MEMBERSHIP_PRICES.apertura.monthly}/mes`,
            tier: 'apertura' as const,
          },
          {
            id: 'obturador',
            name: 'Obturador',
            subtitle: 'Membresía Pro',
            price: `$${MEMBERSHIP_PRICES.obturador.monthly}/mes`,
            tier: 'obturador' as const,
            recommended: true,
          },
          {
            id: 'diafragma',
            name: 'Diafragma',
            subtitle: 'Membresía Master',
            price: `$${MEMBERSHIP_PRICES.diafragma.monthly}/mes`,
            tier: 'diafragma' as const,
          },
        ];
        setPlans(fallbackPlans);
      } finally {
        if (mounted) {
          setLoadingPlans(false);
        }
      }
    }

    loadPlans();

    // Subscribe to Realtime changes on membership_plans table
    const channel = supabase
      .channel('membership-plans-changes-auth')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'membership_plans',
        },
        () => {
          if (mounted) {
            loadPlans();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Set default plan from URL parameter
  useEffect(() => {
    const urlPlan = searchParams.get('plan');
    if (urlPlan) {
      const validPlans = ['free', 'apertura', 'obturador', 'diafragma'];
      if (validPlans.includes(urlPlan)) {
        signupForm.setValue('plan', urlPlan, { shouldValidate: true });
      }
    }
  }, [searchParams, signupForm]);

  const handleLogin = async (data: LoginForm) => {
    setLoading(true);
    setLoginError('');
    try {
      await signIn(data.email, data.password);
      toast.success('¡Bienvenido a Glewstudio!');
      const requestedPath = new URLSearchParams(window.location.search).get('next');
      const safePath =
        requestedPath?.startsWith('/') &&
        !requestedPath.startsWith('//') &&
        !requestedPath.includes('\\')
          ? requestedPath
          : '/dashboard';
      router.push(safePath);
      router.refresh();
    } catch (err: any) {
      setLoginError(err?.message || 'Credenciales incorrectas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    setLoading(true);
    try {
      await signUp(data.email, data.password, {
        fullName: data.name,
        plan: data.plan,
        couponCode: appliedCoupon?.code,
      });
      toast.success('¡Cuenta creada! Bienvenido a Glewstudio.');
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        <AppImage
          src=""
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
              Aprende de
              <br />
              <span className="gradient-gold-text">Fotógrafos Reales</span>
            </h2>
            <p className="text-muted-foreground max-w-sm">
              Cursos de estudio, iluminación, edición y dirección creativa. Acceso a archivos RAW,
              esquemas de luz y talleres en vivo.
            </p>
            <div className="flex items-center gap-6 mt-8">
              {[
                { icon: 'FilmIcon', label: '120+ Cursos' },
                { icon: 'UsersIcon', label: '18K Estudiantes' },
                { icon: 'StarIcon', label: '4.9 Rating' },
              ].map((stat) => (
                <div
                  key={`auth-stat-${stat.label}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
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
        <Link href="/" className="lg:hidden flex items-center gap-2 mb-8 focus-ring">
          <AppLogo size={32} />
          <span className="font-extrabold text-lg text-foreground">Glewstudio</span>
        </Link>

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
                <p className="text-sm text-muted-foreground">
                  Inicia sesión para continuar aprendiendo.
                </p>
              </div>

              {/* Error banner */}
              {loginError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <Icon
                    name="ExclamationTriangleIcon"
                    size={16}
                    className="text-red-400 shrink-0 mt-0.5"
                  />
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
                    {...loginForm.register('password', {
                      required: 'La contraseña es obligatoria',
                    })}
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
                  <p className="text-xs text-red-400">
                    {loginForm.formState.errors.password.message}
                  </p>
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
                <p className="text-sm text-muted-foreground">
                  Únete a 18,000 fotógrafos en Glewstudio.
                </p>
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
                  <p className="text-xs text-red-400">
                    {signupForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-password" className="text-sm font-600 text-foreground">
                  Contraseña
                </label>
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres, una mayúscula y un número.
                </p>
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
                  <p className="text-xs text-red-400">
                    {signupForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Plan selection */}
              {loadingPlans ? (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-600 text-foreground">Elige tu plan</label>
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="animate-pulse flex items-center gap-3 p-3 rounded-xl border border-border"
                      >
                        <div className="w-4 h-4 rounded-full bg-muted" />
                        <div className="flex-1">
                          <div className="h-4 w-3/4 bg-muted rounded" />
                          <div className="h-3 w-1/2 bg-muted rounded mt-1" />
                        </div>
                        <div className="w-20 h-6 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-600 text-foreground">Elige tu plan</label>
                  <div className="flex flex-col gap-2">
                    {plans.map((plan) => (
                      <label
                        key={`signup-plan-${plan.id}`}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          watchedPlan === plan.id
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:border-border/80'
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
                          <div className="flex flex-col">
                            <span className="text-sm font-600 text-foreground">{plan.name}</span>
                            {'subtitle' in plan && plan.subtitle && (
                              <span className="text-xs text-muted-foreground">{plan.subtitle}</span>
                            )}
                          </div>
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
              )}

              {/* Coupon section - only show for paid plans */}
              {watchedPlan !== 'free' && !loadingPlans && (
                <div className="flex flex-col gap-2">
                  {!appliedCoupon && !showCouponInput && (
                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-border hover:border-primary/50 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary"
                        onChange={() => setShowCouponInput(true)}
                      />
                      <span className="text-sm font-500 text-foreground">
                        Aplicar cupón de descuento
                      </span>
                    </label>
                  )}

                  {showCouponInput && !appliedCoupon && (
                    <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-muted/30">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Ej. APERTURA20"
                          className="input-dark flex-1 px-4 py-2.5 text-sm uppercase"
                          disabled={couponValidating}
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={couponValidating || !couponCode.trim()}
                          className="btn-primary px-4 py-2.5 text-sm font-600 whitespace-nowrap disabled:opacity-60"
                        >
                          {couponValidating ? 'Validando...' : 'Aplicar'}
                        </button>
                      </div>
                      {couponError && <p className="text-xs text-red-400">{couponError}</p>}
                    </div>
                  )}

                  {appliedCoupon && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-3">
                        <Icon name="TicketPercentIcon" size={18} className="text-green-400" />
                        <div>
                          <p className="text-sm font-600 text-foreground">
                            Cupón{' '}
                            <span className="font-mono text-primary">{appliedCoupon.code}</span>{' '}
                            aplicado
                          </p>
                          <p className="text-xs text-green-400 font-500">
                            {appliedCoupon.discount_percent}% de descuento
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-xs text-red-400 hover:text-red-300 font-500 flex items-center gap-1"
                      >
                        <Icon name="XIcon" size={12} />
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
              )}

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
