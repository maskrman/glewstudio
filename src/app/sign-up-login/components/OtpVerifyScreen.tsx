'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface OtpVerifyScreenProps {
  email: string;
  name: string;
  plan?: string;
  onBack: () => void;
  /** 'signup' for new account verification, 'recovery' for password reset */
  mode?: 'signup' | 'recovery';
  onRecoverySuccess?: (code: string) => void;
}

export default function OtpVerifyScreen({
  email,
  name,
  plan = 'obturador',
  onBack,
  mode = 'signup',
  onRecoverySuccess,
}: OtpVerifyScreenProps) {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newOtp.every((d) => d !== '') && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    setError('');
    try {
      // Verify against our custom otp_codes table
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, type: mode === 'recovery' ? 'recovery' : 'signup' }),
      });
      const result = await res.json();

      if (!res.ok || !result.verified) {
        setError(result?.error || 'Código incorrecto o expirado. Verifica e intenta de nuevo.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      if (mode === 'recovery') {
        // Pass the verified code back so parent can show the new-password form
        onRecoverySuccess?.(code);
        return;
      }

      // signup mode — refresh session so the server sees the confirmed email
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session) {
        // If refresh fails, the session may have expired — user needs to sign in manually
        toast.success('¡Cuenta verificada! Por favor inicia sesión.');
        router.push('/sign-up-login');
        router.refresh();
        return;
      }

      // insert subscription now that OTP is verified and session is fresh
      try {
        const userId = refreshData.session.user?.id;
        if (userId) {
          const { error: subError } = await supabase
            .from('subscriptions')
            .insert({ user_id: userId, tier: plan, status: 'active' });
          if (subError) {
            console.error('Subscription insert error:', subError.message);
          }
        }
      } catch {
        // non-blocking — subscription can be retried later
      }

      // send welcome email (non-blocking)
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ type: 'WELCOME', email, name }),
        });
      } catch {
        // non-blocking
      }

      toast.success('¡Cuenta verificada! Bienvenido a GlewStudio.');
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al verificar el código.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, type: mode === 'recovery' ? 'recovery' : 'signup' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Error al reenviar el código.');
      setCountdown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      toast.success('Código reenviado a tu correo.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al reenviar el código.';
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <AppLogo size={32} />
          <span className="font-extrabold text-lg text-foreground">Glewstudio</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <Icon name="EnvelopeIcon" size={26} className="text-primary" />
          </div>

          <h2 className="text-2xl font-800 text-foreground text-center mb-2">
            {mode === 'recovery' ? 'Recupera tu contraseña' : 'Verifica tu correo'}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
            {mode === 'recovery' ?'Enviamos un código de recuperación a' :'Enviamos un código de 6 dígitos a'}
            <br />
            <span className="text-foreground font-600">{maskedEmail}</span>
          </p>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-5">
              <Icon name="ExclamationTriangleIcon" size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* OTP inputs */}
          <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={`otp-${i}`}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className={`w-12 h-14 text-center text-xl font-800 rounded-xl border transition-all outline-none
                  bg-muted text-foreground
                  ${digit ? 'border-primary/60 bg-primary/5' : 'border-border'}
                  ${error ? 'border-red-500/60' : ''}
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'focus:border-primary focus:bg-primary/5'}
                `}
                aria-label={`Dígito ${i + 1} del código OTP`}
              />
            ))}
          </div>

          {/* Verify button */}
          <button
            onClick={() => handleVerify(otp.join(''))}
            disabled={loading || otp.some((d) => !d)}
            className="btn-primary w-full py-3 text-sm font-700 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mb-4"
          >
            {loading ? (
              <>
                <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                Verificando…
              </>
            ) : (
              'Verificar Código'
            )}
          </button>

          {/* Resend */}
          <div className="text-center">
            {canResend ? (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-primary hover:text-accent font-600 transition-colors disabled:opacity-60"
              >
                {resending ? 'Reenviando…' : 'Reenviar código'}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Reenviar en <span className="text-foreground font-600">{countdown}s</span>
              </p>
            )}
          </div>

          {/* Back */}
          <button
            onClick={onBack}
            className="mt-4 w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowLeftIcon" size={14} />
            {mode === 'recovery' ? 'Volver al inicio de sesión' : 'Volver al registro'}
          </button>
        </div>
      </div>
    </div>
  );
}
