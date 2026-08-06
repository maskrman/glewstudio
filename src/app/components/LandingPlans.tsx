'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const plans = [
  {
    id: 'plan-basico',
    name: 'Básico',
    subtitle: 'Plan Básico',
    monthlyPrice: 10,
    color: 'tier-badge-apertura',
    borderColor: 'border-blue-500/30',
    highlightColor: 'bg-blue-500/5',
    recommended: false,
    features: [
      { text: 'Librería básica e intermedia (80+ cursos)', included: true },
      { text: 'Calidad HD 720p / 1080p', included: true },
      { text: 'Acceso desde cualquier dispositivo', included: true },
      { text: 'Comunidad de estudiantes', included: true },
      { text: 'Cursos avanzados y Masterclasses', included: false },
      { text: 'Descarga de archivos RAW y PDFs', included: false },
      { text: 'Revisión de portafolio', included: false },
      { text: 'Certificaciones digitales', included: false },
      { text: 'Acceso offline', included: false },
    ],
  },
  {
    id: 'plan-estandar',
    name: 'Estándar',
    subtitle: 'Plan Estándar',
    monthlyPrice: 25,
    color: 'tier-badge-obturador',
    borderColor: 'border-primary/50',
    highlightColor: 'bg-primary/5',
    recommended: true,
    features: [
      { text: 'Todo lo del Plan Básico', included: true },
      { text: 'Cursos avanzados y Masterclasses', included: true },
      { text: 'Calidad Full HD / 4K', included: true },
      { text: 'Descarga de archivos RAW de práctica', included: true },
      { text: 'Esquemas de iluminación en PDF', included: true },
      { text: 'Presets de Lightroom y LUTs', included: true },
      { text: 'Revisión de portafolio', included: false },
      { text: 'Certificaciones digitales', included: false },
      { text: 'Acceso offline', included: false },
    ],
  },
  {
    id: 'plan-vip',
    name: 'VIP',
    subtitle: 'Plan VIP',
    monthlyPrice: 50,
    color: 'tier-badge-diafragma',
    borderColor: 'border-purple-500/40',
    highlightColor: 'bg-purple-500/5',
    recommended: false,
    features: [
      { text: 'Todo lo del Plan Estándar', included: true },
      { text: 'Revisión y retroalimentación de portafolio', included: true },
      { text: 'Certificaciones digitales al completar rutas', included: true },
      { text: 'Acceso offline en app móvil', included: true },
      { text: 'Sesiones Q&A con instructores', included: true },
      { text: 'Acceso anticipado a nuevos cursos', included: true },
      { text: 'Comunidad VIP exclusiva', included: true },
      { text: 'Soporte prioritario', included: true },
      { text: '1 revisión de portafolio mensual', included: true },
    ],
  },
];

const ANNUAL_DISCOUNT = 0.30;

function getAnnualMonthly(monthly: number) {
  return parseFloat((monthly * (1 - ANNUAL_DISCOUNT)).toFixed(2));
}

function getAnnualTotal(monthly: number) {
  return Math.round(getAnnualMonthly(monthly) * 12);
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export default function LandingPlans() {
  const [annual, setAnnual] = useState(false);
  const { ref: headerRef, inView: headerInView } = useInView(0.2);
  const { ref: cardsRef, inView: cardsInView } = useInView(0.1);

  return (
    <section id="planes" className="py-20 bg-secondary/30">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">

        {/* Animated header */}
        <div
          ref={headerRef}
          className="text-center mb-12 transition-all duration-700"
          style={{
            opacity: headerInView ? 1 : 0,
            transform: headerInView ? 'translateY(0)' : 'translateY(32px)',
          }}
        >
          <p className="text-xs font-700 text-primary tracking-widest uppercase mb-2">Planes</p>
          <h2 className="text-hero-md font-800 text-foreground mb-4">
            Elige tu Nivel de Aprendizaje
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Desde fundamentos hasta masterclasses avanzadas con instructores activos en la industria.
          </p>

          {/* Billing toggle */}
          <div
            className="inline-flex items-center gap-3 bg-muted rounded-full p-1 transition-all duration-500"
            style={{
              opacity: headerInView ? 1 : 0,
              transform: headerInView ? 'scale(1)' : 'scale(0.9)',
              transitionDelay: '200ms',
            }}
          >
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
                -30%
              </span>
            </button>
          </div>
        </div>

        {/* Animated plan cards */}
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 xl:gap-8">
          {plans?.map((plan, index) => {
            const displayPrice = annual
              ? getAnnualMonthly(plan.monthlyPrice)
              : plan.monthlyPrice;
            const annualTotal = getAnnualTotal(plan.monthlyPrice);

            return (
              <div
                key={plan?.id}
                className={`relative rounded-2xl border ${plan?.borderColor} ${plan?.highlightColor} p-6 flex flex-col transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1`}
                style={{
                  opacity: cardsInView ? 1 : 0,
                  transform: cardsInView ? 'translateY(0)' : 'translateY(48px)',
                  transition: `opacity 0.6s ease, transform 0.6s ease, box-shadow 0.3s ease`,
                  transitionDelay: cardsInView ? `${index * 120}ms` : '0ms',
                }}
              >
                {plan?.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-700 px-4 py-1 rounded-full">
                    Más Popular
                  </div>
                )}

                <div className="mb-6">
                  <span className={`inline-flex text-xs font-700 px-2 py-0.5 rounded-full mb-3 ${plan?.color}`}>
                    {plan?.subtitle}
                  </span>
                  <h3 className="text-2xl font-800 text-foreground mb-1">{plan?.name}</h3>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-800 gradient-gold-text">
                      ${displayPrice % 1 === 0 ? displayPrice : displayPrice.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground text-sm mb-1">/mes</span>
                  </div>
                  {annual ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Cobrado como ${annualTotal} / año · Ahorra {Math.round(ANNUAL_DISCOUNT * 100)}%
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Facturado mensualmente
                    </p>
                  )}
                </div>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {plan?.features?.map((feature, fi) => (
                    <li
                      key={`${plan?.id}-feature-${fi}`}
                      className="flex items-start gap-2.5 transition-all duration-300"
                      style={{
                        opacity: cardsInView ? 1 : 0,
                        transitionDelay: cardsInView ? `${index * 120 + fi * 40 + 300}ms` : '0ms',
                      }}
                    >
                      {feature?.included ? (
                        <Icon name="CheckCircleIcon" size={16} className="text-primary shrink-0 mt-0.5" variant="solid" />
                      ) : (
                        <Icon name="XCircleIcon" size={16} className="text-muted-foreground/40 shrink-0 mt-0.5" variant="solid" />
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
                    plan?.recommended ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  {plan?.recommended ? 'Comenzar con Estándar' : `Elegir ${plan?.name}`}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}