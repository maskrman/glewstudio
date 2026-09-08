'use client';

import React, { useState, useEffect } from 'react';

import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscriptionTier, type SubscriptionTier } from '@/lib/subscription';
import { MEMBERSHIP_PRICES, PAYMENT_CONFIG } from '@/lib/config';

// ─── Admin Panel ──────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'courses' | 'subscriptions' | 'purchases' | 'analytics'>('courses');
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    getUserSubscriptionTier().then(setUserTier);
  }, [user, authLoading]);

  // Demo stats
  const stats = {
    mrr: 4820,
    arr: 57840,
    activeSubscribers: 482,
    newThisMonth: 38,
    churnRate: 2.1,
    courseSales: 12,
    avgOrderValue: 497,
    totalRevenue: 63780,
  };

  const demoCourses = [
    { id: 'c1', title: 'Iluminación Rembrandt para Retrato', accessType: 'membership', tier: 'obturador', price: null, published: true, students: 3840 },
    { id: 'c2', title: 'Flujo de Trabajo RAW en Lightroom', accessType: 'membership', tier: 'apertura', price: null, published: true, students: 5200 },
    { id: 'c3', title: 'Masterclass: Iluminación para Moda Editorial', accessType: 'premium_purchase', tier: null, price: 497, published: true, students: 890 },
    { id: 'c4', title: 'Sistema Completo: Negocio de Fotografía Comercial', accessType: 'premium_purchase', tier: null, price: 799, published: true, students: 540 },
    { id: 'c5', title: 'Color Grading Cinematográfico', accessType: 'membership', tier: 'obturador', price: null, published: true, students: 2900 },
    { id: 'c6', title: 'Iluminación Cinematográfica: Del Concepto al Resultado', accessType: 'membership', tier: 'diafragma', price: null, published: true, students: 1850 },
  ];

  const demoSubscriptions = [
    { id: 's1', email: 'apertura@glewstudio.mx', tier: 'apertura', status: 'active', since: '01 ene 2026' },
    { id: 's2', email: 'obturador@glewstudio.mx', tier: 'obturador', status: 'active', since: '15 feb 2026' },
    { id: 's3', email: 'diafragma@glewstudio.mx', tier: 'diafragma', status: 'active', since: '10 mar 2026' },
    { id: 's4', email: 'usuario4@ejemplo.com', tier: 'apertura', status: 'cancelled', since: '05 abr 2026' },
    { id: 's5', email: 'usuario5@ejemplo.com', tier: 'obturador', status: 'past_due', since: '20 may 2026' },
  ];

  const demoPurchases = [
    { id: 'p1', email: 'comprador1@ejemplo.com', course: 'Masterclass: Iluminación para Moda Editorial', amount: 497, status: 'paid', date: '15 ago 2026' },
    { id: 'p2', email: 'comprador2@ejemplo.com', course: 'Sistema Completo: Negocio de Fotografía Comercial', amount: 799, status: 'paid', date: '12 ago 2026' },
    { id: 'p3', email: 'comprador3@ejemplo.com', course: 'Masterclass: Iluminación para Moda Editorial', amount: 447.30, status: 'paid', date: '10 ago 2026' },
    { id: 'p4', email: 'comprador4@ejemplo.com', course: 'Sistema Completo: Negocio de Fotografía Comercial', amount: 799, status: 'refunded', date: '08 ago 2026' },
  ];

  const tabs = [
    { id: 'courses', label: 'Cursos', icon: 'FilmIcon' },
    { id: 'subscriptions', label: 'Membresías', icon: 'CreditCardIcon' },
    { id: 'purchases', label: 'Compras', icon: 'ShoppingBagIcon' },
    { id: 'analytics', label: 'Analytics', icon: 'ChartBarIcon' },
  ] as const;

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Cog6ToothIcon" size={20} className="text-primary" />
              <h1 className="text-2xl font-800 text-foreground">Panel de Administración</h1>
            </div>
            <p className="text-sm text-muted-foreground">GLEW Studio — Gestión de plataforma</p>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
            <Icon name="ExclamationTriangleIcon" size={14} className="text-yellow-400" />
            <span className="text-xs text-yellow-400 font-600">
              {PAYMENT_CONFIG.mode} — Pagos en modo demo
            </span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'MRR', value: `$${stats.mrr.toLocaleString()}`, icon: 'BanknotesIcon', color: 'text-primary' },
            { label: 'ARR', value: `$${stats.arr.toLocaleString()}`, icon: 'ArrowTrendingUpIcon', color: 'text-green-400' },
            { label: 'Suscriptores Activos', value: stats.activeSubscribers.toString(), icon: 'UsersIcon', color: 'text-blue-400' },
            { label: 'Nuevos este mes', value: `+${stats.newThisMonth}`, icon: 'UserPlusIcon', color: 'text-purple-400' },
            { label: 'Churn Rate', value: `${stats.churnRate}%`, icon: 'ArrowTrendingDownIcon', color: 'text-red-400' },
            { label: 'Ventas de Cursos', value: stats.courseSales.toString(), icon: 'ShoppingBagIcon', color: 'text-amber-400' },
            { label: 'Ticket Promedio', value: `$${stats.avgOrderValue}`, icon: 'ReceiptPercentIcon', color: 'text-cyan-400' },
            { label: 'Revenue Total', value: `$${stats.totalRevenue.toLocaleString()}`, icon: 'CurrencyDollarIcon', color: 'text-primary' },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name={kpi.icon as any} size={16} className={kpi.color} />
                <span className="text-xs text-muted-foreground font-500">{kpi.label}</span>
              </div>
              <p className={`text-xl font-800 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-600 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* COURSES TAB */}
        {activeTab === 'courses' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-700 text-foreground">Gestión de Cursos</h2>
              <button className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
                <Icon name="PlusIcon" size={16} />
                Nuevo Curso
              </button>
            </div>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Curso</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Acceso</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Precio</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Estudiantes</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {demoCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-500 text-foreground line-clamp-1">{course.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        {course.accessType === 'membership' ? (
                          <div className="flex items-center gap-1">
                            <TierBadge tier={course.tier as any} size="sm" />
                            <span className="text-xs text-muted-foreground">+</span>
                          </div>
                        ) : (
                          <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-600">
                            Premium
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground font-500">
                        {course.price ? `$${course.price}` : <span className="text-muted-foreground">Membresía</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{course.students.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-600 ${
                          course.published
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' :'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {course.published ? 'Publicado' : 'Borrador'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                            <Icon name="PencilIcon" size={14} />
                          </button>
                          <button className="text-muted-foreground hover:text-primary transition-colors" title="Ver">
                            <Icon name="EyeIcon" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBSCRIPTIONS TAB */}
        {activeTab === 'subscriptions' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-700 text-foreground">Membresías Activas</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
                <Icon name="InformationCircleIcon" size={13} />
                Las membresías se activan solo mediante confirmación del sistema de pagos
              </div>
            </div>

            {/* Pricing summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {(['apertura', 'obturador', 'diafragma'] as const).map((tier) => (
                <div key={tier} className="glass-card rounded-xl p-4">
                  <TierBadge tier={tier} size="md" showIcon />
                  <div className="mt-3">
                    <p className="text-2xl font-800 gradient-gold-text">${MEMBERSHIP_PRICES[tier].monthly}/mes</p>
                    <p className="text-xs text-muted-foreground mt-1">${MEMBERSHIP_PRICES[tier].annual}/mes anual</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {demoSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground font-500">{sub.email}</td>
                      <td className="px-4 py-3">
                        <TierBadge tier={sub.tier as any} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-600 ${
                          sub.status === 'active' ?'bg-green-500/10 text-green-400 border border-green-500/20'
                            : sub.status === 'past_due' ?'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{sub.since}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PURCHASES TAB */}
        {activeTab === 'purchases' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-700 text-foreground">Compras de Cursos Premium</h2>
            </div>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Curso</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Monto</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {demoPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground font-500">{purchase.email}</td>
                      <td className="px-4 py-3 text-muted-foreground line-clamp-1 max-w-xs">{purchase.course}</td>
                      <td className="px-4 py-3 text-foreground font-600">${purchase.amount}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-600 ${
                          purchase.status === 'paid' ?'bg-green-500/10 text-green-400 border border-green-500/20' :'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {purchase.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{purchase.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div>
            <h2 className="text-lg font-700 text-foreground mb-6">Métricas de la Plataforma</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Revenue breakdown */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="BanknotesIcon" size={16} className="text-primary" />
                  Revenue por Membresía
                </h3>
                <div className="flex flex-col gap-3">
                  {[
                    { tier: 'apertura', count: 210, mrr: 2099 },
                    { tier: 'obturador', count: 185, mrr: 3698 },
                    { tier: 'diafragma', count: 87, mrr: 2609 },
                  ].map((item) => (
                    <div key={item.tier} className="flex items-center gap-3">
                      <TierBadge tier={item.tier as any} size="sm" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{item.count} suscriptores</span>
                          <span className="text-foreground font-600">${item.mrr.toLocaleString()}/mes</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full progress-bar rounded-full"
                            style={{ width: `${(item.mrr / 4000) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key metrics */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="ChartBarIcon" size={16} className="text-primary" />
                  Métricas Clave
                </h3>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Trial Conversion', value: '34%', trend: '+2.1%' },
                    { label: 'Free → Paid', value: '12%', trend: '+0.8%' },
                    { label: 'ARPU', value: '$9.99', trend: '+$0.40' },
                    { label: 'LTV Estimado', value: '$142', trend: '+$8' },
                    { label: 'Churn Mensual', value: '2.1%', trend: '-0.3%' },
                    { label: 'AOV Cursos Premium', value: '$497', trend: '+$12' },
                  ].map((metric) => (
                    <div key={metric.label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{metric.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-700 text-foreground">{metric.value}</span>
                        <span className="text-xs text-green-400 font-500">{metric.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
