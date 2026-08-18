'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { MEMBERSHIP_PRICES, MEMBERSHIP_FEATURES, MEMBERSHIP_DISCOUNTS } from '@/lib/config';

const plans = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Explorador',
    price: { monthly: 0, annual: 0 },
    color: 'bg-muted text-muted-foreground border border-border',
    borderColor: 'border-border',
    highlightColor: '',
    recommended: false,
    features: [
      { text: 'Crear cuenta gratuita', included: true },
      { text: 'Explorar catálogo completo', included: true },
      { text: 'Ver trailers de todos los cursos', included: true },
      { text: 'Ver contenido gratuito', included: true },
      { text: 'Guardar cursos en Mi Lista', included: true },
      { text: 'Acceso a cursos de membresía', included: false },
      { text: 'Descuentos en cursos premium', included: false },
      { text: 'Material complementario', included: false },
    ],
  },
  {
    id: 'apertura',
    name: 'Apertura',
    subtitle: 'Membresía Básica',
    price: MEMBERSHIP_PRICES?.apertura,
    color: 'tier-badge-apertura',
    borderColor: 'border-blue-500/30',
    highlightColor: 'bg-blue-500/5',
    recommended: false,
    discount: MEMBERSHIP_DISCOUNTS?.apertura,
    features: MEMBERSHIP_FEATURES?.apertura?.map((text) => ({ text, included: true })),
  },
  {
    id: 'obturador',
    name: 'Obturador',
    subtitle: 'Membresía Pro',
    price: MEMBERSHIP_PRICES?.obturador,
    color: 'tier-badge-obturador',
    borderColor: 'border-primary/50',
    highlightColor: 'bg-primary/5',
    recommended: true,
    discount: MEMBERSHIP_DISCOUNTS?.obturador,
    features: MEMBERSHIP_FEATURES?.obturador?.map((text) => ({ text, included: true })),
  },
  {
    id: 'diafragma',
    name: 'Diafragma',
    subtitle: 'Membresía Master',
    price: MEMBERSHIP_PRICES?.diafragma,
    color: 'tier-badge-diafragma',
    borderColor: 'border-purple-500/40',
    highlightColor: 'bg-purple-500/5',
    recommended: false,
    discount: MEMBERSHIP_DISCOUNTS?.diafragma,
    features: MEMBERSHIP_FEATURES?.diafragma?.map((text) => ({ text, included: true })),
  },
];

export default function LandingPlans() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="planes" className="py-20 bg-secondary/30">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="text-center mb-12">
          <p className="text-xs font-700 text-primary tracking-widest uppercase mb-2">Membresías</p>
          <h2 className="text-hero-md font-800 text-foreground mb-4">
            Elige tu Nivel de Acceso
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-3">
            Comienza gratis y escala cuando estés listo. Los cursos premium pueden adquirirse individualmente — las membresías te dan descuentos y acceso a contenido exclusivo.
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-xl mx-auto mb-8">
            Los cursos premium ($400–$800+) nunca quedan desbloqueados automáticamente por la membresía — pero los miembros obtienen descuentos exclusivos.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-muted rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-600 transition-all ${
                !annual ? 'bg-card text-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-600 transition-all flex items-center gap-2 ${
                annual ? 'bg-card text-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              Anual
              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-700">
                -20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 xl:gap-6">
          {plans?.map((plan) => (
            <div
              key={plan?.id}
              className={`relative rounded-2xl border ${plan?.borderColor} ${plan?.highlightColor} p-6 flex flex-col transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10`}
            >
              {plan?.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-700 px-4 py-1 rounded-full whitespace-nowrap">
                  Más Popular
                </div>
              )}

              <div className="mb-5">
                <span className={`inline-flex text-xs font-700 px-2 py-0.5 rounded-full mb-3 ${plan?.color}`}>
                  {plan?.subtitle}
                </span>
                <h3 className="text-2xl font-800 text-foreground mb-1">{plan?.name}</h3>
                {plan?.id === 'free' ? (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-800 gradient-gold-text">Gratis</span>
                  </div>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-800 gradient-gold-text">
                      ${annual ? plan?.price?.annual : plan?.price?.monthly}
                    </span>
                    <span className="text-muted-foreground text-sm mb-1">/mes</span>
                  </div>
                )}
                {annual && plan?.id !== 'free' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Facturado anualmente · ${plan?.price?.annualTotal}/año
                  </p>
                )}
                {'discount' in plan && plan?.discount && (
                  <div className="mt-2 inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-600 px-2 py-0.5 rounded-full">
                    <Icon name="TagIcon" size={10} />
                    {plan?.discount}% descuento en cursos premium
                  </div>
                )}
              </div>

              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan?.features?.map((feature, fi) => (
                  <li key={`${plan?.id}-feature-${fi}`} className="flex items-start gap-2.5">
                    {feature?.included ? (
                      <Icon name="CheckCircleIcon" size={15} className="text-primary shrink-0 mt-0.5" variant="solid" />
                    ) : (
                      <Icon name="XCircleIcon" size={15} className="text-muted-foreground/40 shrink-0 mt-0.5" variant="solid" />
                    )}
                    <span className={`text-sm ${feature?.included ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {feature?.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up-login"
                className={`w-full py-3 text-sm font-700 text-center rounded-xl transition-all ${
                  plan?.recommended ? 'btn-primary' : plan?.id === 'free' ? 'btn-ghost' : 'btn-ghost'
                }`}
              >
                {plan?.id === 'free' ?'Comenzar Gratis'
                  : plan?.recommended
                  ? `Comenzar con ${plan?.name}`
                  : `Elegir ${plan?.name}`}
              </Link>
            </div>
          ))}
        </div>

        {/* Premium course note */}
        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">
            <Icon name="SparklesIcon" size={14} className="text-primary inline mr-1" />
            Los cursos premium ($400–$800+) se adquieren individualmente.{' '}
            <span className="text-foreground font-500">Los miembros obtienen hasta 30% de descuento.</span>
          </p>
        </div>
      </div>
    </section>
  );
}