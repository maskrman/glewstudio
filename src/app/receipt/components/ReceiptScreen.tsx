'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface PlanDetail {
  name: string;
  subtitle: string;
  price: number;
  billingCycle: 'monthly' | 'annual';
  features: string[];
  badgeClass: string;
}

const planDetails: Record<string, PlanDetail> = {
  apertura: {
    name: 'Apertura',
    subtitle: 'Plan Básico',
    price: 9,
    billingCycle: 'annual',
    badgeClass: 'tier-badge-apertura',
    features: ['Librería básica e intermedia (80+ cursos)', 'Calidad HD 720p / 1080p', 'Acceso desde cualquier dispositivo', 'Comunidad de estudiantes'],
  },
  obturador: {
    name: 'Obturador',
    subtitle: 'Plan Pro',
    price: 18,
    billingCycle: 'annual',
    badgeClass: 'tier-badge-obturador',
    features: ['Todo lo del Plan Apertura', 'Cursos avanzados y Masterclasses', 'Calidad Full HD / 4K', 'Descarga de archivos RAW de práctica', 'Presets de Lightroom y LUTs'],
  },
  diafragma: {
    name: 'Diafragma',
    subtitle: 'Plan Master VIP',
    price: 36,
    billingCycle: 'annual',
    badgeClass: 'tier-badge-diafragma',
    features: ['Todo lo del Plan Obturador', 'Talleres en vivo mensuales', 'Revisión y retroalimentación de portafolio', 'Certificaciones digitales', 'Sesiones Q&A con instructores'],
  },
};

const nextSteps = [
  { icon: 'PlayCircleIcon', title: 'Explora tu librería', description: 'Accede a todos los cursos incluidos en tu plan desde el dashboard.', href: '/dashboard', cta: 'Ir al Dashboard' },
  { icon: 'UserCircleIcon', title: 'Completa tu perfil', description: 'Agrega tu foto y personaliza tu experiencia de aprendizaje.', href: '/account-subscription-management', cta: 'Mi Cuenta' },
  { icon: 'BookmarkIcon', title: 'Crea tu lista', description: 'Guarda los cursos que quieres ver para encontrarlos fácilmente.', href: '/watchlist', cta: 'Mi Lista' },
];

function generateOrderId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'GS-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateInvoiceContent(orderId: string, plan: PlanDetail, date: string): string {
  const annualTotal = plan.price * 12;
  return `GLEWSTUDIO — RECIBO DE COMPRA
==============================
Número de Orden: ${orderId}
Fecha: ${date}
------------------------------
Plan: ${plan.name} (${plan.subtitle})
Ciclo de Facturación: Anual
Precio mensual: $${plan.price}/mes
Total anual: $${annualTotal}.00 USD
------------------------------
Estado: PAGADO
Próxima renovación: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
==============================
Gracias por suscribirte a Glewstudio.
Aprende fotografía con los mejores instructores.
https://glewstudio7616.builtwithrocket.new`;
}

export default function ReceiptScreen() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const supabase = createClient();

  const [orderId, setOrderId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanDetail>(planDetails.obturador);
  const [downloaded, setDownloaded] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const emailFiredRef = useRef(false);

  useEffect(() => {
    const planParam = searchParams?.get('plan')?.toLowerCase();
    if (planParam && planDetails[planParam]) {
      setSelectedPlan(planDetails[planParam]);
    } else if (user) {
      // Fetch actual plan from subscriptions table
      supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
        .then(({ data }) => {
          if (data?.tier && planDetails[data.tier]) {
            setSelectedPlan(planDetails[data.tier]);
          }
        });
    }
  }, [user, searchParams]);

  useEffect(() => {
    const newOrderId = generateOrderId();
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    const renewal = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    setOrderId(newOrderId);
    setPurchaseDate(dateStr);
    setRenewalDate(renewal);
  }, []);

  // Fire order confirmation email once when orderId + plan + user are ready
  useEffect(() => {
    if (!orderId || !purchaseDate || !user || emailFiredRef.current) return;
    emailFiredRef.current = true;

    const sendEmail = async () => {
      setEmailSending(true);
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const annualTotal = selectedPlan.price * 12;
        const renewal = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX', {
          day: '2-digit', month: 'long', year: 'numeric',
        });

        const res = await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
            orderId,
            planName: selectedPlan.name,
            planSubtitle: selectedPlan.subtitle,
            price: selectedPlan.price,
            billingCycle: selectedPlan.billingCycle,
            annualTotal,
            purchaseDate,
            renewalDate: renewal,
            features: selectedPlan.features,
          }),
        });

        if (res.ok) {
          setEmailSent(true);
        }
      } catch {
        // silently fail — receipt page still works
      } finally {
        setEmailSending(false);
      }
    };

    sendEmail();
  }, [orderId, purchaseDate, user, selectedPlan]);

  const handleDownloadInvoice = () => {
    if (!orderId || !purchaseDate) return;
    const content = generateInvoiceContent(orderId, selectedPlan, purchaseDate);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibo-${orderId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const annualTotal = selectedPlan.price * 12;
  const displayRenewalDate = renewalDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] blob-gold opacity-40 pointer-events-none" />

      <div className="max-w-2xl mx-auto animate-slide-up">

        {/* Success header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-gold mb-4 shadow-lg shadow-primary/30">
            <Icon name="CheckIcon" size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-hero-md font-800 text-foreground mb-2">¡Suscripción Activada!</h1>
          <p className="text-muted-foreground text-base">
            Tu pago fue procesado exitosamente. Ya tienes acceso completo a tu plan.
          </p>
          {/* Email status indicator */}
          {(emailSending || emailSent) && (
            <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full text-xs font-600 ${
              emailSent
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' :'bg-primary/10 text-primary border border-primary/20'
            }`}>
              {emailSending ? (
                <>
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                  Enviando confirmación por correo…
                </>
              ) : (
                <>
                  <Icon name="EnvelopeIcon" size={13} />
                  Confirmación enviada a {user?.email}
                </>
              )}
            </div>
          )}
        </div>

        {/* Receipt card */}
        <div className="glass-card rounded-2xl overflow-hidden mb-6">
          {/* Card header */}
          <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="DocumentTextIcon" size={20} className="text-primary" />
              <span className="font-700 text-foreground text-sm">Recibo de Compra</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">{orderId || '—'}</span>
          </div>

          {/* Plan info */}
          <div className="px-6 py-5 border-b border-border/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={`inline-flex text-xs font-700 px-2 py-0.5 rounded-full mb-2 ${selectedPlan.badgeClass}`}>
                  {selectedPlan.subtitle}
                </span>
                <h2 className="text-xl font-800 text-foreground">Plan {selectedPlan.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Suscripción anual · Acceso inmediato</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-800 gradient-gold-text">${selectedPlan.price}<span className="text-sm font-500 text-muted-foreground">/mes</span></div>
                <div className="text-xs text-muted-foreground mt-0.5">Facturado anualmente</div>
              </div>
            </div>

            {/* Features included */}
            <ul className="mt-4 flex flex-col gap-2">
              {selectedPlan.features.map((feat, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                  <Icon name="CheckCircleIcon" size={15} className="text-primary shrink-0" variant="solid" />
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          {/* Billing details */}
          <div className="px-6 py-5 border-b border-border/60">
            <h3 className="text-xs font-700 text-muted-foreground uppercase tracking-widest mb-4">Detalle de Facturación</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Número de orden</span>
                <span className="font-600 text-foreground font-mono text-xs">{orderId || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fecha de compra</span>
                <span className="font-600 text-foreground">{purchaseDate || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ciclo de facturación</span>
                <span className="font-600 text-foreground">Anual</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Próxima renovación</span>
                <span className="font-600 text-foreground">{displayRenewalDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estado</span>
                <span className="flex items-center gap-1.5 text-green-400 font-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
                  Activo
                </span>
              </div>
              <div className="border-t border-border/60 pt-3 flex justify-between">
                <span className="text-sm font-700 text-foreground">Total cobrado</span>
                <span className="text-base font-800 gradient-gold-text">${annualTotal}.00 USD</span>
              </div>
            </div>
          </div>

          {/* Download invoice */}
          <div className="px-6 py-5">
            <button
              onClick={handleDownloadInvoice}
              className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-700 transition-all duration-200 ${
                downloaded
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30' :'btn-ghost hover:border-primary/40 hover:text-primary'
              }`}
            >
              <Icon name={downloaded ? 'CheckIcon' : 'ArrowDownTrayIcon'} size={18} />
              {downloaded ? '¡Recibo descargado!' : 'Descargar Recibo (.txt)'}
            </button>
          </div>
        </div>

        {/* Next steps */}
        <div className="mb-8">
          <h3 className="text-xs font-700 text-muted-foreground uppercase tracking-widest mb-4 px-1">Próximos Pasos</h3>
          <div className="flex flex-col gap-3">
            {nextSteps.map((step, i) => (
              <div
                key={i}
                className="glass-card rounded-xl px-5 py-4 flex items-center gap-4 hover:border-primary/20 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name={step.icon} size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-700 text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{step.description}</p>
                </div>
                <Link
                  href={step.href}
                  className="shrink-0 text-xs font-700 text-primary hover:text-accent transition-colors flex items-center gap-1"
                >
                  {step.cta}
                  <Icon name="ChevronRightIcon" size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Primary CTA */}
        <Link
          href="/dashboard"
          className="btn-primary w-full py-3.5 text-sm font-700 text-center rounded-xl flex items-center justify-center gap-2"
        >
          <Icon name="PlayCircleIcon" size={18} />
          Comenzar a Aprender
        </Link>
      </div>
    </div>
  );
}
