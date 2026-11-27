'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscriptionTier, type SubscriptionTier } from '@/lib/subscription';
import { MEMBERSHIP_PRICES, PAYMENT_CONFIG } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────

interface AdminMetrics {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  newThisMonth: number;
  churnRate: number;
  courseSales: number;
  averageTicket: number;
  totalRevenue: number;
  totalStudents: number;
  totalAdmins: number;
  freeAccounts: number;
  conversionRate: number;
}

interface MembershipPlan {
  slug: string;
  name: string;
  badge: string;
  monthly_price: number;
  annual_monthly_price: number;
  premium_discount_percent: number;
  features: string[];
  is_popular: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
  role: 'student' | 'admin';
  subscription_tier: string | null;
  subscription_status: string | null;
  active_course_purchases: number;
}

interface AdminSubscription {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_email: string;
  user_name: string;
  plan_monthly_price: number;
  plan_annual_price: number;
}

interface AdminPurchase {
  id: string;
  user_id: string;
  course_id: string;
  price_paid: number | null;
  amount: number | null;
  currency: string | null;
  provider: string | null;
  provider_payment_id: string | null;
  purchase_status: 'paid' | 'pending' | 'refunded' | 'failed';
  discount_applied: number | null;
  created_at: string;
  updated_at: string | null;
  purchased_at: string | null;
  user_email: string;
  user_name: string;
  course_title: string;
  course_slug: string;
}

interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | 'courses'
    | 'instructors'
    | 'plans'
    | 'subscriptions'
    | 'purchases'
    | 'analytics'
    | 'users'
    | 'coupons'
  >('courses');
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);

  // Real metrics state
  const [metrics, setMetrics] = useState<AdminMetrics>({
    mrr: 0,
    arr: 0,
    activeSubscribers: 0,
    newThisMonth: 0,
    churnRate: 0,
    courseSales: 0,
    averageTicket: 0,
    totalRevenue: 0,
    totalStudents: 0,
    totalAdmins: 0,
    freeAccounts: 0,
    conversionRate: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Users tab state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null);
  const [assignMembershipLoading, setAssignMembershipLoading] = useState<string | null>(null);
  const [assignCourseLoading, setAssignCourseLoading] = useState<string | null>(null);
  const [assignMembershipDialog, setAssignMembershipDialog] = useState<{
    userId: string;
    userEmail: string;
  } | null>(null);
  const [assignCourseDialog, setAssignCourseDialog] = useState<{
    userId: string;
    userEmail: string;
  } | null>(null);
  const [availableCourses, setAvailableCourses] = useState<
    { id: string; title: string; slug: string }[]
  >([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Subscriptions tab state
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsSearch, setSubscriptionsSearch] = useState('');
  const [subscriptionsStatusFilter, setSubscriptionsStatusFilter] = useState<
    'all' | 'active' | 'cancelled' | 'expired' | 'trial'
  >('all');
  const [subscriptionsTierFilter, setSubscriptionsTierFilter] = useState<
    'all' | 'apertura' | 'obturador' | 'diafragma'
  >('all');
  const [subscriptionsDateFrom, setSubscriptionsDateFrom] = useState('');
  const [subscriptionsDateTo, setSubscriptionsDateTo] = useState('');

  // Purchases tab state
  const [purchases, setPurchases] = useState<AdminPurchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesSearch, setPurchasesSearch] = useState('');
  const [purchasesStatusFilter, setPurchasesStatusFilter] = useState<
    'all' | 'paid' | 'pending' | 'refunded' | 'failed'
  >('all');
  const [purchasesDateFrom, setPurchasesDateFrom] = useState('');
  const [purchasesDateTo, setPurchasesDateTo] = useState('');

  // Coupons tab state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_percent: 20,
    max_uses: 1,
    expires_at: '',
    is_active: true,
  });
  const [couponSaving, setCouponSaving] = useState(false);
  const [couponErrors, setCouponErrors] = useState<Record<string, string>>({});

  // ─── Auth & User Tier ────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading || !user) return;
    getUserSubscriptionTier().then(setUserTier);
  }, [user, authLoading]);

  // ─── Fetch Initial Metrics ────────────────────────────────────────────

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/metrics');
      if (!response.ok) {
        throw new Error('Error al obtener métricas');
      }
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('[AdminPanel] Error fetching metrics:', error);
      // Keep zeros on error - no mock data
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // ─── Supabase Realtime Subscription ──────────────────────────────────

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();

    // Subscribe to changes in relevant tables
    const subscription = supabase
      .channel('admin-metrics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          fetchMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'course_purchases',
        },
        () => {
          fetchMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'membership_plans',
        },
        () => {
          fetchMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coupons',
        },
        () => {
          fetchCoupons();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AdminPanel] Realtime subscription active for metrics');
        }
      });

    // Initial fetch
    fetchMetrics();

    // Cleanup
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, fetchMetrics]);

  // ─── Membership Plans Data (fallback from config) ────────────────────

  const defaultPlans: MembershipPlan[] = [
    {
      slug: 'apertura',
      name: 'Apertura',
      badge: 'Membresía Básica',
      monthly_price: MEMBERSHIP_PRICES.apertura.monthly,
      annual_monthly_price: MEMBERSHIP_PRICES.apertura.annual,
      premium_discount_percent: 10,
      features: [
        'Contenido seleccionado y cursos introductorios',
        'Clases de muestra exclusivas',
        'Contenido exclusivo para miembros',
        '10% de descuento en cursos premium',
        'Acceso desde cualquier dispositivo',
        'Comunidad de estudiantes',
      ],
      is_popular: false,
    },
    {
      slug: 'obturador',
      name: 'Obturador',
      badge: 'Membresía Pro',
      monthly_price: MEMBERSHIP_PRICES.obturador.monthly,
      annual_monthly_price: MEMBERSHIP_PRICES.obturador.annual,
      premium_discount_percent: 20,
      features: [
        'Todo lo de Apertura',
        'Mayor catálogo incluido',
        'Contenido premium seleccionado',
        '20% de descuento en cursos premium',
        'Material complementario descargable',
        'Certificados cuando corresponda',
      ],
      is_popular: true,
    },
    {
      slug: 'diafragma',
      name: 'Diafragma',
      badge: 'Membresía Master',
      monthly_price: MEMBERSHIP_PRICES.diafragma.monthly,
      annual_monthly_price: MEMBERSHIP_PRICES.diafragma.annual,
      premium_discount_percent: 30,
      features: [
        'Todo lo de Obturador',
        'Mayor catálogo disponible',
        'Más contenido premium incluido',
        '30% de descuento en cursos premium',
        'Masterclasses exclusivas',
        'Workshops y sesiones en vivo',
        'Sesiones Q&A con instructores',
        'Revisión de portafolio mensual',
      ],
      is_popular: false,
    },
  ];

  const tabs = [
    { id: 'courses', label: 'Cursos', icon: 'FilmIcon' },
    { id: 'instructors', label: 'Instructores', icon: 'UserGroupIcon' },
    { id: 'plans', label: 'Planes', icon: 'CreditCardIcon' },
    { id: 'users', label: 'Usuarios', icon: 'UsersIcon' },
    { id: 'subscriptions', label: 'Suscripciones', icon: 'CreditCardIcon' },
    { id: 'purchases', label: 'Compras', icon: 'ShoppingBagIcon' },
    { id: 'coupons', label: 'Cupones', icon: 'TicketPercentIcon' },
    { id: 'analytics', label: 'Analytics', icon: 'ChartBarIcon' },
  ] as const;

  // ─── KPI Cards Data ──────────────────────────────────────────────────

  const kpiCards = [
    {
      label: 'MRR',
      value: metricsLoading ? '—' : `$${metrics.mrr.toLocaleString('en-US')}`,
      icon: 'BanknotesIcon',
      color: 'text-primary',
    },
    {
      label: 'ARR',
      value: metricsLoading ? '—' : `$${metrics.arr.toLocaleString('en-US')}`,
      icon: 'ArrowTrendingUpIcon',
      color: 'text-green-400',
    },
    {
      label: 'Suscriptores Activos',
      value: metricsLoading ? '—' : metrics.activeSubscribers.toString(),
      icon: 'UsersIcon',
      color: 'text-blue-400',
    },
    {
      label: 'Nuevos este mes',
      value: metricsLoading ? '—' : `+${metrics.newThisMonth}`,
      icon: 'UserPlusIcon',
      color: 'text-purple-400',
    },
    {
      label: 'Churn Rate',
      value: metricsLoading ? '—' : `${metrics.churnRate}%`,
      icon: 'ArrowTrendingDownIcon',
      color: 'text-red-400',
    },
    {
      label: 'Ventas de Cursos',
      value: metricsLoading ? '—' : metrics.courseSales.toString(),
      icon: 'ShoppingBagIcon',
      color: 'text-amber-400',
    },
    {
      label: 'Ticket Promedio',
      value: metricsLoading ? '—' : `$${metrics.averageTicket}`,
      icon: 'ReceiptPercentIcon',
      color: 'text-cyan-400',
    },
    {
      label: 'Revenue Total',
      value: metricsLoading ? '—' : `$${metrics.totalRevenue.toLocaleString('en-US')}`,
      icon: 'CurrencyDollarIcon',
      color: 'text-primary',
    },
    {
      label: 'Estudiantes',
      value: metricsLoading ? '—' : metrics.totalStudents.toString(),
      icon: 'UserGroupIcon',
      color: 'text-blue-400',
    },
    {
      label: 'Administradores',
      value: metricsLoading ? '—' : metrics.totalAdmins.toString(),
      icon: 'ShieldCheckIcon',
      color: 'text-purple-400',
    },
    {
      label: 'Cuentas Gratuitas',
      value: metricsLoading ? '—' : metrics.freeAccounts.toString(),
      icon: 'UserIcon',
      color: 'text-orange-400',
    },
    {
      label: 'Tasa de Conversión',
      value: metricsLoading ? '—' : `${metrics.conversionRate}%`,
      icon: 'ChartPieIcon',
      color: 'text-emerald-400',
    },
  ];

  // ─── Users Tab Handlers ──────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await fetch('/api/admin/users?search=' + encodeURIComponent(usersSearch));
      if (!response.ok) throw new Error('Error al obtener usuarios');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('[AdminPanel] Error fetching users:', error);
      toast.error('Error cargando usuarios');
    } finally {
      setUsersLoading(false);
    }
  }, [usersSearch]);

  const fetchAvailableCourses = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/courses-for-assignment');
      if (!response.ok) throw new Error('Error al obtener cursos');
      const data = await response.json();
      setAvailableCourses(data);
    } catch (error) {
      console.error('[AdminPanel] Error fetching courses:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAvailableCourses();
  }, [fetchUsers, fetchAvailableCourses]);

  const handleRoleChange = async (userId: string, newRole: 'student' | 'admin') => {
    setRoleChangeLoading(userId);
    try {
      const response = await fetch('/api/admin/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!response.ok) throw new Error('Error cambiando rol');
      toast.success(`Rol actualizado a ${newRole === 'admin' ? 'Administrador' : 'Estudiante'}`);
      fetchUsers();
    } catch (error) {
      console.error('[AdminPanel] Error changing role:', error);
      toast.error('Error cambiando rol');
    } finally {
      setRoleChangeLoading(null);
    }
  };

  const handleAssignMembership = async (
    userId: string,
    tier: 'apertura' | 'obturador' | 'diafragma'
  ) => {
    setAssignMembershipLoading(userId);
    try {
      const response = await fetch('/api/admin/users/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier }),
      });
      if (!response.ok) throw new Error('Error asignando membresía');
      toast.success(`Membresía ${tier} asignada correctamente`);
      fetchUsers();
      setAssignMembershipDialog(null);
    } catch (error) {
      console.error('[AdminPanel] Error assigning membership:', error);
      toast.error('Error asignando membresía');
    } finally {
      setAssignMembershipLoading(null);
    }
  };

  const handleAssignCourse = async (userId: string, courseId: string) => {
    setAssignCourseLoading(userId);
    try {
      const response = await fetch('/api/admin/users/course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error asignando curso');
      }
      toast.success('Curso asignado correctamente');
      fetchUsers();
      setAssignCourseDialog(null);
      setSelectedCourseId('');
    } catch (error) {
      console.error('[AdminPanel] Error assigning course:', error);
      toast.error(error instanceof Error ? error.message : 'Error asignando curso');
    } finally {
      setAssignCourseLoading(null);
    }
  };

  const openAssignMembership = (user: AdminUser) => {
    setAssignMembershipDialog({ userId: user.id, userEmail: user.email });
  };

  const openAssignCourse = (user: AdminUser) => {
    setAssignCourseDialog({ userId: user.id, userEmail: user.email });
    setSelectedCourseId('');
  };

  // ─── Subscriptions Tab Handlers ──────────────────────────────────────

  const fetchSubscriptions = useCallback(async () => {
    setSubscriptionsLoading(true);
    try {
      const params = new URLSearchParams({
        search: subscriptionsSearch,
        status: subscriptionsStatusFilter,
        tier: subscriptionsTierFilter,
        ...(subscriptionsDateFrom && { dateFrom: subscriptionsDateFrom }),
        ...(subscriptionsDateTo && { dateTo: subscriptionsDateTo }),
      });
      const response = await fetch('/api/admin/subscriptions?' + params.toString());
      if (!response.ok) throw new Error('Error al obtener suscripciones');
      const data = await response.json();
      setSubscriptions(data);
    } catch (error) {
      console.error('[AdminPanel] Error fetching subscriptions:', error);
      toast.error('Error cargando suscripciones');
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [
    subscriptionsSearch,
    subscriptionsStatusFilter,
    subscriptionsTierFilter,
    subscriptionsDateFrom,
    subscriptionsDateTo,
  ]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const exportSubscriptionsCSV = () => {
    const params = new URLSearchParams({
      search: subscriptionsSearch,
      status: subscriptionsStatusFilter,
      tier: subscriptionsTierFilter,
      ...(subscriptionsDateFrom && { dateFrom: subscriptionsDateFrom }),
      ...(subscriptionsDateTo && { dateTo: subscriptionsDateTo }),
    });
    window.open('/api/admin/subscriptions/export?' + params.toString(), '_blank');
  };

  // ─── Purchases Tab Handlers ──────────────────────────────────────────

  const fetchPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const params = new URLSearchParams({
        search: purchasesSearch,
        status: purchasesStatusFilter,
        ...(purchasesDateFrom && { dateFrom: purchasesDateFrom }),
        ...(purchasesDateTo && { dateTo: purchasesDateTo }),
      });
      const response = await fetch('/api/admin/purchases?' + params.toString());
      if (!response.ok) throw new Error('Error al obtener compras');
      const data = await response.json();
      setPurchases(data);
    } catch (error) {
      console.error('[AdminPanel] Error fetching purchases:', error);
      toast.error('Error cargando compras');
    } finally {
      setPurchasesLoading(false);
    }
  }, [purchasesSearch, purchasesStatusFilter, purchasesDateFrom, purchasesDateTo]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const exportPurchasesCSV = () => {
    const params = new URLSearchParams({
      search: purchasesSearch,
      status: purchasesStatusFilter,
      ...(purchasesDateFrom && { dateFrom: purchasesDateFrom }),
      ...(purchasesDateTo && { dateTo: purchasesDateTo }),
    });
    window.open('/api/admin/purchases/export?' + params.toString(), '_blank');
  };

  // ─── Coupons Tab Handlers ────────────────────────────────────────────

  const fetchCoupons = useCallback(async () => {
    setCouponsLoading(true);
    try {
      const response = await fetch('/api/admin/coupons');
      if (!response.ok) throw new Error('Error al obtener cupones');
      const data = await response.json();
      setCoupons(data);
    } catch (error) {
      console.error('[AdminPanel] Error fetching coupons:', error);
      toast.error('Error cargando cupones');
    } finally {
      setCouponsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!couponForm.code.trim()) errors.code = 'El código es obligatorio';
    if (couponForm.discount_percent <= 0 || couponForm.discount_percent > 100)
      errors.discount_percent = 'Descuento debe ser 1-100';
    if (couponForm.max_uses <= 0) errors.max_uses = 'Máximo de usos debe ser > 0';
    if (couponForm.expires_at && new Date(couponForm.expires_at) < new Date())
      errors.expires_at = 'La fecha no puede ser en el pasado';

    if (Object.keys(errors).length > 0) {
      setCouponErrors(errors);
      return;
    }

    setCouponSaving(true);
    try {
      const url = editingCoupon ? `/api/admin/coupons/${editingCoupon.code}` : '/api/admin/coupons';
      const method = editingCoupon ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponForm.code.toUpperCase(),
          discount_percent: couponForm.discount_percent,
          max_uses: couponForm.max_uses,
          expires_at: couponForm.expires_at || null,
          is_active: couponForm.is_active,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error guardando cupón');
      }
      toast.success(editingCoupon ? 'Cupón actualizado' : 'Cupón creado');
      setCouponDialogOpen(false);
      setEditingCoupon(null);
      fetchCoupons();
    } catch (error) {
      console.error('[AdminPanel] Error saving coupon:', error);
      toast.error(error instanceof Error ? error.message : 'Error guardando cupón');
    } finally {
      setCouponSaving(false);
    }
  };

  const handleNewCoupon = () => {
    setEditingCoupon(null);
    setCouponForm({
      code: '',
      discount_percent: 20,
      max_uses: 1,
      expires_at: '',
      is_active: true,
    });
    setCouponErrors({});
    setCouponDialogOpen(true);
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      discount_percent: coupon.discount_percent,
      max_uses: coupon.max_uses,
      expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : '',
      is_active: coupon.is_active,
    });
    setCouponErrors({});
    setCouponDialogOpen(true);
  };

  const handleDeleteCoupon = async (code: string) => {
    if (!confirm(`¿Eliminar cupón "${code}"?`)) return;
    try {
      const response = await fetch(`/api/admin/coupons/${code}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error eliminando cupón');
      toast.success('Cupón eliminado');
      fetchCoupons();
    } catch (error) {
      console.error('[AdminPanel] Error deleting coupon:', error);
      toast.error('Error eliminando cupón');
    }
  };

  const handleToggleCoupon = async (coupon: Coupon) => {
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      if (!response.ok) throw new Error('Error cambiando estado');
      toast.success(coupon.is_active ? 'Cupón desactivado' : 'Cupón activado');
      fetchCoupons();
    } catch (error) {
      console.error('[AdminPanel] Error toggling coupon:', error);
      toast.error('Error cambiando estado');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" suppressHydrationWarning>
          {kpiCards.map((kpi) => (
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
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* COURSES TAB - Direct link to full manager */}
        {activeTab === 'courses' && <AdminCoursesTab />}

        {/* INSTRUCTORS TAB - Direct link to full manager */}
        {activeTab === 'instructors' && <InstructorsTab />}

        {/* PLANS TAB */}
        {activeTab === 'plans' && <MembershipPlansTab defaultPlans={defaultPlans} />}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            loading={usersLoading}
            search={usersSearch}
            onSearchChange={setUsersSearch}
            onRoleChange={handleRoleChange}
            roleChangeLoading={roleChangeLoading}
            onAssignMembership={openAssignMembership}
            onAssignCourse={openAssignCourse}
            assignMembershipLoading={assignMembershipLoading}
            assignCourseLoading={assignCourseLoading}
            availableCourses={availableCourses}
            selectedCourseId={selectedCourseId}
            onCourseSelect={setSelectedCourseId}
            assignMembershipDialog={assignMembershipDialog}
            setAssignMembershipDialog={setAssignMembershipDialog}
            assignCourseDialog={assignCourseDialog}
            setAssignCourseDialog={setAssignCourseDialog}
            handleAssignMembership={handleAssignMembership}
            handleAssignCourse={handleAssignCourse}
          />
        )}

        {/* SUBSCRIPTIONS TAB */}
        {activeTab === 'subscriptions' && (
          <SubscriptionsTab
            subscriptions={subscriptions}
            loading={subscriptionsLoading}
            search={subscriptionsSearch}
            onSearchChange={setSubscriptionsSearch}
            statusFilter={subscriptionsStatusFilter}
            onStatusFilterChange={setSubscriptionsStatusFilter}
            tierFilter={subscriptionsTierFilter}
            onTierFilterChange={setSubscriptionsTierFilter}
            dateFrom={subscriptionsDateFrom}
            onDateFromChange={setSubscriptionsDateFrom}
            dateTo={subscriptionsDateTo}
            onDateToChange={setSubscriptionsDateTo}
            onExportCSV={exportSubscriptionsCSV}
          />
        )}

        {/* PURCHASES TAB */}
        {activeTab === 'purchases' && (
          <PurchasesTab
            purchases={purchases}
            loading={purchasesLoading}
            search={purchasesSearch}
            onSearchChange={setPurchasesSearch}
            statusFilter={purchasesStatusFilter}
            onStatusFilterChange={setPurchasesStatusFilter}
            dateFrom={purchasesDateFrom}
            onDateFromChange={setPurchasesDateFrom}
            dateTo={purchasesDateTo}
            onDateToChange={setPurchasesDateTo}
            onExportCSV={exportPurchasesCSV}
          />
        )}

        {/* COUPONS TAB */}
        {activeTab === 'coupons' && (
          <CouponsTab
            coupons={coupons}
            loading={couponsLoading}
            onNewCoupon={handleNewCoupon}
            onEditCoupon={handleEditCoupon}
            onDeleteCoupon={handleDeleteCoupon}
            onToggleCoupon={handleToggleCoupon}
            couponDialogOpen={couponDialogOpen}
            setCouponDialogOpen={setCouponDialogOpen}
            editingCoupon={editingCoupon}
            couponForm={couponForm}
            setCouponForm={setCouponForm}
            couponErrors={couponErrors}
            couponSaving={couponSaving}
            handleCouponSubmit={handleCouponSubmit}
          />
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <AnalyticsTab metrics={metrics} metricsLoading={metricsLoading} />
        )}
      </div>
    </div>
  );
}

// ─── Membership Plans Tab Component ────────────────────────────────────

interface MembershipPlansTabProps {
  defaultPlans: MembershipPlan[];
}

function MembershipPlansTab({ defaultPlans }: MembershipPlansTabProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>(defaultPlans);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const handleSave = async (plan: MembershipPlan) => {
    setSaving((prev) => ({ ...prev, [plan.slug]: true }));
    try {
      const response = await fetch('/api/admin/membership-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: plan.slug,
          name: plan.name,
          badge: plan.badge,
          monthly_price: plan.monthly_price,
          annual_monthly_price: plan.annual_monthly_price,
          premium_discount_percent: plan.premium_discount_percent,
          features: plan.features,
          is_popular: plan.is_popular,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar');
      }

      setSaved((prev) => ({ ...prev, [plan.slug]: true }));
      toast.success(`Plan "${plan.name}" guardado correctamente`);

      setTimeout(() => {
        setSaved((prev) => ({ ...prev, [plan.slug]: false }));
      }, 3000);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar el plan');
    } finally {
      setSaving((prev) => ({ ...prev, [plan.slug]: false }));
    }
  };

  const handleFeatureChange = (slug: string, index: number, value: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.slug === slug
          ? { ...p, features: p.features.map((f, i) => (i === index ? value : f)) }
          : p
      )
    );
  };

  const handleAddFeature = (slug: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, features: [...p.features, ''] } : p))
    );
  };

  const handleRemoveFeature = (slug: string, index: number) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.slug === slug ? { ...p, features: p.features.filter((_, i) => i !== index) } : p
      )
    );
  };

  const handleInputChange = (slug: string, field: keyof MembershipPlan, value: any) => {
    setPlans((prev) => prev.map((p) => (p.slug === slug ? { ...p, [field]: value } : p)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-700 text-foreground">Planes de Membresía</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Edita precios, beneficios y descuentos de cada plan. Los cambios se aplican en toda la
            plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
          <Icon name="InformationCircleIcon" size={13} />
          <span>Los precios se sincronizan con la landing, página de planes y registro</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.slug}
            className={`relative glass-card rounded-xl p-6 transition-all ${
              plan.is_popular ? 'border-primary/30 ring-1 ring-primary/20' : ''
            }`}
          >
            {plan.is_popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-700 px-3 py-1 rounded-full whitespace-nowrap">
                Más Popular
              </div>
            )}

            <div className="mb-5">
              <TierBadge tier={plan.slug as any} size="md" showIcon />
              <div className="mt-3">
                <input
                  type="text"
                  value={plan.name}
                  onChange={(e) => handleInputChange(plan.slug, 'name', e.target.value)}
                  className="text-2xl font-800 text-foreground bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-1 w-auto"
                />
                <input
                  type="text"
                  value={plan.badge}
                  onChange={(e) => handleInputChange(plan.slug, 'badge', e.target.value)}
                  className="text-sm text-muted-foreground bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-1 w-auto mt-1"
                />
              </div>
            </div>

            <div className="space-y-4 mb-6 p-4 bg-muted/30 rounded-xl">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Precio Mensual (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={plan.monthly_price}
                    onChange={(e) =>
                      handleInputChange(plan.slug, 'monthly_price', parseFloat(e.target.value) || 0)
                    }
                    className="w-full input-dark px-3 py-2 text-sm font-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Precio Mensual Anual (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={plan.annual_monthly_price}
                    onChange={(e) =>
                      handleInputChange(
                        plan.slug,
                        'annual_monthly_price',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full input-dark px-3 py-2 text-sm font-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Descuento Premium (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={plan.premium_discount_percent}
                    onChange={(e) =>
                      handleInputChange(
                        plan.slug,
                        'premium_discount_percent',
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="w-full input-dark px-3 py-2 text-sm font-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Popular</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.is_popular}
                      onChange={(e) => handleInputChange(plan.slug, 'is_popular', e.target.checked)}
                      className="w-4 h-4 rounded border-border bg-input accent-primary"
                    />
                    <span className="text-sm text-foreground">Marcar como plan recomendado</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-600 text-muted-foreground block mb-2">
                Beneficios (Incluye)
              </label>
              <div className="space-y-2">
                {plan.features.map((feature, index) => (
                  <div key={`${plan.slug}-feature-${index}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => handleFeatureChange(plan.slug, index, e.target.value)}
                      className="flex-1 input-dark px-3 py-2 text-sm"
                      placeholder={`Beneficio ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(plan.slug, index)}
                      disabled={plan.features.length <= 1}
                      className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Eliminar beneficio"
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddFeature(plan.slug)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:text-accent font-600 py-2 border border-dashed border-primary/30 rounded-lg transition-colors"
                >
                  <Icon name="PlusIcon" size={14} />
                  Añadir beneficio
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSave(plan)}
              disabled={saving[plan.slug]}
              className={`w-full py-3 text-sm font-700 rounded-xl transition-all flex items-center justify-center gap-2 ${
                saved[plan.slug]
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'btn-primary'
              }`}
            >
              {saving[plan.slug] && (
                <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
              )}
              {saved[plan.slug] ? (
                <>
                  <Icon name="CheckCircleIcon" size={16} variant="solid" />
                  Guardado
                </>
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Users Tab Component ───────────────────────────────────────────────

interface UsersTabProps {
  users: AdminUser[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onRoleChange: (userId: string, role: 'student' | 'admin') => void;
  roleChangeLoading: string | null;
  onAssignMembership: (user: AdminUser) => void;
  onAssignCourse: (user: AdminUser) => void;
  assignMembershipLoading: string | null;
  assignCourseLoading: string | null;
  availableCourses: { id: string; title: string; slug: string }[];
  selectedCourseId: string;
  onCourseSelect: (id: string) => void;
  assignMembershipDialog: { userId: string; userEmail: string } | null;
  setAssignMembershipDialog: (value: { userId: string; userEmail: string } | null) => void;
  assignCourseDialog: { userId: string; userEmail: string } | null;
  setAssignCourseDialog: (value: { userId: string; userEmail: string } | null) => void;
  handleAssignMembership: (userId: string, tier: 'apertura' | 'obturador' | 'diafragma') => void;
  handleAssignCourse: (userId: string, courseId: string) => void;
}

function UsersTab({
  users,
  loading,
  search,
  onSearchChange,
  onRoleChange,
  roleChangeLoading,
  onAssignMembership,
  onAssignCourse,
  assignMembershipLoading,
  assignCourseLoading,
  availableCourses,
  selectedCourseId,
  onCourseSelect,
  assignMembershipDialog,
  setAssignMembershipDialog,
  assignCourseDialog,
  setAssignCourseDialog,
  handleAssignMembership,
  handleAssignCourse,
}: UsersTabProps) {
  const tiers = [
    { value: 'apertura', label: 'Apertura', price: '$9.99/mes' },
    { value: 'obturador', label: 'Obturador', price: '$19.99/mes' },
    { value: 'diafragma', label: 'Diafragma', price: '$29.99/mes' },
  ];

  const getRoleBadge = (role: 'student' | 'admin') => (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-600 ${
        role === 'admin'
          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      }`}
    >
      {role === 'admin' ? 'Administrador' : 'Estudiante'}
    </span>
  );

  const getSubscriptionBadge = (tier: string | null, status: string | null) => {
    if (!tier) return <span className="text-xs text-muted-foreground">Sin suscripción</span>;
    const colors: Record<string, string> = {
      apertura: 'bg-green-500/20 text-green-400 border-green-500/30',
      obturador: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      diafragma: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    const statusColors: Record<string, string> = {
      active: 'text-green-400',
      cancelled: 'text-red-400',
      expired: 'text-orange-400',
      trial: 'text-yellow-400',
    };
    return (
      <div className="flex items-center gap-1">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-600 border ${colors[tier] || 'bg-muted text-muted-foreground border-border'}`}
        >
          {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </span>
        {status && (
          <span className={`text-xs font-600 ${statusColors[status] || 'text-muted-foreground'}`}>
            {status === 'active'
              ? '●'
              : status === 'cancelled'
                ? '✕'
                : status === 'expired'
                  ? '◌'
                  : '⟳'}
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Icon name="ArrowPathIcon" size={24} className="mx-auto mb-2 animate-spin text-primary" />
        <p className="text-muted-foreground">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-700 text-foreground">Gestión de Usuarios</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Busca por nombre o correo. Cambia roles, asigna membresías o cursos manualmente.
          </p>
        </div>
        <div className="relative max-w-md">
          <Icon
            name="MagnifyingGlassIcon"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="input-dark w-full pl-10 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden border-white/10">
        {users.length === 0 ? (
          <div className="p-12 text-center">
            <Icon name="UsersIcon" size={48} className="mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-600 text-foreground mb-1">No hay usuarios</h3>
            <p className="text-sm text-muted-foreground">
              {search
                ? 'No se encontraron usuarios con ese criterio'
                : 'Aún no hay usuarios registrados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Usuario
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Rol
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Suscripción
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Cursos Comprados
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Registrado
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name || user.email}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <Icon name="UserIcon" size={16} className="text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-500 text-foreground">
                            {user.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getRoleBadge(user.role)}
                        <button
                          onClick={() =>
                            onRoleChange(user.id, user.role === 'student' ? 'admin' : 'student')
                          }
                          disabled={roleChangeLoading === user.id}
                          className="btn-ghost text-xs px-2 py-1"
                          title={user.role === 'student' ? 'Hacer admin' : 'Quitar admin'}
                        >
                          {roleChangeLoading === user.id ? (
                            <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                          ) : (
                            <Icon name="UserGroupIcon" size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getSubscriptionBadge(user.subscription_tier, user.subscription_status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {user.active_course_purchases}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAssignMembership(user)}
                          className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1"
                          title="Asignar membresía"
                          disabled={assignMembershipLoading === user.id}
                        >
                          <Icon name="CreditCardIcon" size={12} />
                          Membresía
                        </button>
                        <button
                          onClick={() => onAssignCourse(user)}
                          className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1"
                          title="Asignar curso"
                          disabled={assignCourseLoading === user.id}
                        >
                          <Icon name="FilmIcon" size={12} />
                          Curso
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Membership Modal */}
      {assignMembershipDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setAssignMembershipDialog(null)}
        >
          <div
            className="glass-card rounded-xl p-6 border-white/10 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-700 text-foreground mb-4">
              Asignar Membresía a {assignMembershipDialog.userEmail}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona el plan a asignar (se desactivará la suscripción actual si existe):
            </p>
            <div className="space-y-3 mb-6">
              {tiers.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() =>
                    handleAssignMembership(assignMembershipDialog.userId, tier.value as any)
                  }
                  disabled={assignMembershipLoading === assignMembershipDialog.userId}
                  className="w-full btn-ghost px-4 py-3 text-left border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="font-600 text-foreground capitalize">{tier.label}</div>
                  <div className="text-xs text-muted-foreground">{tier.price}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setAssignMembershipDialog(null)} className="btn-ghost w-full">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {assignCourseDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setAssignCourseDialog(null)}
        >
          <div
            className="glass-card rounded-xl p-6 border-white/10 w-full max-w-md max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-700 text-foreground mb-4">
              Asignar Curso a {assignCourseDialog.userEmail}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona un curso para dar acceso manual:
            </p>
            {availableCourses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="FilmIcon" size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay cursos publicados disponibles</p>
              </div>
            ) : (
              <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto">
                {availableCourses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => onCourseSelect(course.id)}
                    className={`w-full btn-ghost px-4 py-3 text-left border-border transition-colors ${
                      selectedCourseId === course.id
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    <div className="font-500 text-foreground">{course.title}</div>
                    <div className="text-xs text-muted-foreground">{course.slug}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setAssignCourseDialog(null)} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button
                onClick={() => handleAssignCourse(assignCourseDialog.userId, selectedCourseId)}
                disabled={!selectedCourseId || assignCourseLoading === assignCourseDialog.userId}
                className="btn-primary flex-1"
              >
                {assignCourseLoading === assignCourseDialog.userId
                  ? 'Asignando...'
                  : 'Asignar Curso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subscriptions Tab Component ──────────────────────────────────────

interface SubscriptionsTabProps {
  subscriptions: AdminSubscription[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | 'active' | 'cancelled' | 'expired' | 'trial';
  onStatusFilterChange: (value: 'all' | 'active' | 'cancelled' | 'expired' | 'trial') => void;
  tierFilter: 'all' | 'apertura' | 'obturador' | 'diafragma';
  onTierFilterChange: (value: 'all' | 'apertura' | 'obturador' | 'diafragma') => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onExportCSV: () => void;
}

function SubscriptionsTab({
  subscriptions,
  loading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  tierFilter,
  onTierFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onExportCSV,
}: SubscriptionsTabProps) {
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      trial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    const labels: Record<string, string> = {
      active: 'Activa',
      cancelled: 'Cancelada',
      expired: 'Expirada',
      trial: 'Prueba',
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-600 border ${colors[status] || 'bg-muted text-muted-foreground border-border'}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      apertura: 'bg-green-500/20 text-green-400 border-green-500/30',
      obturador: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      diafragma: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-600 border ${colors[tier] || 'bg-muted text-muted-foreground border-border'}`}
      >
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Icon name="ArrowPathIcon" size={24} className="mx-auto mb-2 animate-spin text-primary" />
        <p className="text-muted-foreground">Cargando suscripciones...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-700 text-foreground">Membresías Activas</h2>
        <button
          onClick={onExportCSV}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
        >
          <Icon name="ArrowDownTrayIcon" size={16} />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-6 border-white/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Buscar</label>
            <div className="relative">
              <Icon
                name="MagnifyingGlassIcon"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Email, nombre, plan..."
                className="input-dark w-full pl-10 pr-4 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as any)}
              className="input-dark w-full px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="active">Activas</option>
              <option value="cancelled">Canceladas</option>
              <option value="expired">Expiradas</option>
              <option value="trial">Prueba</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Plan</label>
            <select
              value={tierFilter}
              onChange={(e) => onTierFilterChange(e.target.value as any)}
              className="input-dark w-full px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="apertura">Apertura</option>
              <option value="obturador">Obturador</option>
              <option value="diafragma">Diafragma</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="input-dark w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="input-dark w-full px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Pricing summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['apertura', 'obturador', 'diafragma'] as const).map((tier) => (
          <div key={tier} className="glass-card rounded-xl p-4">
            <TierBadge tier={tier} size="md" showIcon />
            <div className="mt-3">
              <p className="text-2xl font-800 gradient-gold-text">
                ${MEMBERSHIP_PRICES[tier].monthly}/mes
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ${MEMBERSHIP_PRICES[tier].annual}/mes anual
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden border-white/10">
        {subscriptions.length === 0 ? (
          <div className="p-12 text-center">
            <Icon
              name="CreditCardIcon"
              size={48}
              className="mx-auto mb-4 text-muted-foreground/50"
            />
            <h3 className="text-lg font-600 text-foreground mb-1">No hay suscripciones</h3>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== 'all' || tierFilter !== 'all' || dateFrom || dateTo
                ? 'No se encontraron suscripciones con esos filtros'
                : 'Aún no hay suscripciones registradas'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Usuario
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Plan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Precio/Mes
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Inicio
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Expira
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Creado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-500 text-foreground">{sub.user_email}</p>
                        {sub.user_name !== '—' && (
                          <p className="text-xs text-muted-foreground">{sub.user_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getTierBadge(sub.tier)}</td>
                    <td className="px-4 py-3">{getStatusBadge(sub.status)}</td>
                    <td className="px-4 py-3 text-sm text-foreground font-500">
                      ${sub.plan_monthly_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {sub.started_at ? new Date(sub.started_at).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {sub.created_at ? new Date(sub.created_at).toLocaleDateString('es-ES') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Purchases Tab Component ──────────────────────────────────────────

interface PurchasesTabProps {
  purchases: AdminPurchase[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | 'paid' | 'pending' | 'refunded' | 'failed';
  onStatusFilterChange: (value: 'all' | 'paid' | 'pending' | 'refunded' | 'failed') => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onExportCSV: () => void;
}

function PurchasesTab({
  purchases,
  loading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onExportCSV,
}: PurchasesTabProps) {
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-500/20 text-green-400 border-green-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      refunded: 'bg-red-500/20 text-red-400 border-red-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    const labels: Record<string, string> = {
      paid: 'Pagado',
      pending: 'Pendiente',
      refunded: 'Reembolsado',
      failed: 'Fallido',
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-600 border ${colors[status] || 'bg-muted text-muted-foreground border-border'}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Icon name="ArrowPathIcon" size={24} className="mx-auto mb-2 animate-spin text-primary" />
        <p className="text-muted-foreground">Cargando compras...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-700 text-foreground">Compras de Cursos Premium</h2>
        <button
          onClick={onExportCSV}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
        >
          <Icon name="ArrowDownTrayIcon" size={16} />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-6 border-white/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Buscar</label>
            <div className="relative">
              <Icon
                name="MagnifyingGlassIcon"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Email, nombre, curso..."
                className="input-dark w-full pl-10 pr-4 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as any)}
              className="input-dark w-full px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="paid">Pagados</option>
              <option value="pending">Pendientes</option>
              <option value="refunded">Reembolsados</option>
              <option value="failed">Fallidos</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="input-dark w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="input-dark w-full px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden border-white/10">
        {purchases.length === 0 ? (
          <div className="p-12 text-center">
            <Icon
              name="ShoppingBagIcon"
              size={48}
              className="mx-auto mb-4 text-muted-foreground/50"
            />
            <h3 className="text-lg font-600 text-foreground mb-1">No hay compras</h3>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== 'all' || dateFrom || dateTo
                ? 'No se encontraron compras con esos filtros'
                : 'Aún no hay compras registradas'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Usuario
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Curso
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Monto
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Descuento
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Proveedor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Fecha Compra
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-500 text-foreground">{p.user_email}</p>
                        {p.user_name !== '—' && (
                          <p className="text-xs text-muted-foreground">{p.user_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-500 text-foreground truncate max-w-xs">
                          {p.course_title}
                        </p>
                        <p className="text-xs text-muted-foreground">{p.course_slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground font-500">
                      ${(p.price_paid ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(p.purchase_status)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {p.discount_applied !== null ? `${p.discount_applied}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.provider ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {p.purchased_at ? new Date(p.purchased_at).toLocaleDateString('es-ES') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Coupons Tab Component ────────────────────────────────────────────

interface CouponsTabProps {
  coupons: Coupon[];
  loading: boolean;
  onNewCoupon: () => void;
  onEditCoupon: (coupon: Coupon) => void;
  onDeleteCoupon: (code: string) => void;
  onToggleCoupon: (coupon: Coupon) => void;
  couponDialogOpen: boolean;
  setCouponDialogOpen: (value: boolean) => void;
  editingCoupon: Coupon | null;
  couponForm: {
    code: string;
    discount_percent: number;
    max_uses: number;
    expires_at: string;
    is_active: boolean;
  };
  setCouponForm: React.Dispatch<
    React.SetStateAction<{
      code: string;
      discount_percent: number;
      max_uses: number;
      expires_at: string;
      is_active: boolean;
    }>
  >;
  couponErrors: Record<string, string>;
  couponSaving: boolean;
  handleCouponSubmit: (e: React.FormEvent) => void;
}

function CouponsTab({
  coupons,
  loading,
  onNewCoupon,
  onEditCoupon,
  onDeleteCoupon,
  onToggleCoupon,
  couponDialogOpen,
  setCouponDialogOpen,
  editingCoupon,
  couponForm,
  setCouponForm,
  couponErrors,
  couponSaving,
  handleCouponSubmit,
}: CouponsTabProps) {
  const handleInputChange = (field: string, value: any) => {
    setCouponForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Icon name="ArrowPathIcon" size={24} className="mx-auto mb-2 animate-spin text-primary" />
        <p className="text-muted-foreground">Cargando cupones...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-700 text-foreground">Cupones de Descuento</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crea y gestiona códigos promocionales para membresías y cursos (ej. APERTURA20)
          </p>
        </div>
        <button
          onClick={onNewCoupon}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
        >
          <Icon name="PlusIcon" size={16} />
          Nuevo Cupón
        </button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden border-white/10">
        {coupons.length === 0 ? (
          <div className="p-12 text-center">
            <Icon
              name="TicketPercentIcon"
              size={48}
              className="mx-auto mb-4 text-muted-foreground/50"
            />
            <h3 className="text-lg font-600 text-foreground mb-1">No hay cupones aún</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Crea tu primer código promocional para ofrecer descuentos
            </p>
            <button
              onClick={onNewCoupon}
              className="btn-primary px-6 py-3 inline-flex items-center gap-2"
            >
              <Icon name="PlusIcon" size={18} />
              Crear Cupón
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Código
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Descuento
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Usos
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Expira
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Creado
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    className={`hover:bg-muted/20 transition-colors ${!coupon.is_active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono font-600 text-foreground">{coupon.code}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-600 text-primary">
                        {coupon.discount_percent}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-500 text-foreground">{coupon.current_uses}</span>
                        <span className="text-xs text-muted-foreground">/</span>
                        <span className="text-xs text-muted-foreground">{coupon.max_uses}</span>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden ml-2">
                          <div
                            className="h-full progress-bar rounded-full"
                            style={{
                              width: `${coupon.max_uses > 0 ? (coupon.current_uses / coupon.max_uses) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onToggleCoupon(coupon)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-600 transition-colors ${
                          coupon.is_active
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        }`}
                      >
                        <Icon
                          name={coupon.is_active ? 'CheckCircleIcon' : 'XCircleIcon'}
                          size={12}
                          variant="solid"
                        />
                        {coupon.is_active ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {coupon.expires_at ? (
                        new Date(coupon.expires_at).toLocaleDateString('es-ES')
                      ) : (
                        <span className="text-green-400">Sin expiración</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(coupon.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditCoupon(coupon)}
                          className="btn-ghost p-1.5"
                          title="Editar"
                        >
                          <Icon name="PencilIcon" size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteCoupon(coupon.code)}
                          className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/10"
                          title="Eliminar"
                        >
                          <Icon name="TrashIcon" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Coupon Modal */}
      {couponDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setCouponDialogOpen(false)}
        >
          <div
            className="glass-card rounded-xl p-6 border-white/10 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-700 text-foreground mb-4">
              {editingCoupon ? 'Editar Cupón' : 'Nuevo Cupón'}
            </h3>

            <form onSubmit={handleCouponSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-500 text-foreground flex items-center gap-1">
                  Código <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={couponForm.code}
                  onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                  placeholder="APERTURA20"
                  className={`input-dark w-full px-4 py-2.5 text-sm uppercase ${couponErrors.code ? 'border-red-500/50' : ''}`}
                  disabled={!!editingCoupon}
                />
                {couponErrors.code && <p className="text-xs text-red-400">{couponErrors.code}</p>}
                {!editingCoupon && (
                  <p className="text-xs text-muted-foreground">Se guardará en mayúsculas</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-500 text-foreground flex items-center gap-1">
                  Descuento (%) <span className="text-primary">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={couponForm.discount_percent}
                  onChange={(e) =>
                    handleInputChange('discount_percent', parseInt(e.target.value) || 0)
                  }
                  className={`input-dark w-full px-4 py-2.5 text-sm ${couponErrors.discount_percent ? 'border-red-500/50' : ''}`}
                />
                {couponErrors.discount_percent && (
                  <p className="text-xs text-red-400">{couponErrors.discount_percent}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-500 text-foreground flex items-center gap-1">
                  Máximo de usos <span className="text-primary">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={couponForm.max_uses}
                  onChange={(e) => handleInputChange('max_uses', parseInt(e.target.value) || 1)}
                  className={`input-dark w-full px-4 py-2.5 text-sm ${couponErrors.max_uses ? 'border-red-500/50' : ''}`}
                />
                {couponErrors.max_uses && (
                  <p className="text-xs text-red-400">{couponErrors.max_uses}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-500 text-foreground">
                  Fecha de expiración (opcional)
                </label>
                <input
                  type="date"
                  value={couponForm.expires_at}
                  onChange={(e) => handleInputChange('expires_at', e.target.value)}
                  className={`input-dark w-full px-4 py-2.5 text-sm ${couponErrors.expires_at ? 'border-red-500/50' : ''}`}
                  min={new Date().toISOString().split('T')[0]}
                />
                {couponErrors.expires_at && (
                  <p className="text-xs text-red-400">{couponErrors.expires_at}</p>
                )}
                <p className="text-xs text-muted-foreground">Dejar vacío para que no expire</p>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={couponForm.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-input accent-primary"
                  />
                  <span className="text-sm text-foreground">Activo</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCouponDialogOpen(false)}
                  className="btn-ghost px-4 py-2"
                  disabled={couponSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary px-6 py-2" disabled={couponSaving}>
                  {couponSaving ? 'Guardando...' : editingCoupon ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab Component ──────────────────────────────────────────

interface AnalyticsTabProps {
  metrics: AdminMetrics;
  metricsLoading: boolean;
}

function AnalyticsTab({ metrics, metricsLoading }: AnalyticsTabProps) {
  return (
    <div>
      <h2 className="text-lg font-700 text-foreground mb-6">Métricas de la Plataforma</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue breakdown by tier - calculated from real data */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
            <Icon name="BanknotesIcon" size={16} className="text-primary" />
            Revenue por Membresía
          </h3>
          <div className="flex flex-col gap-3">
            {(['apertura', 'obturador', 'diafragma'] as const).map((tier) => {
              const tierPrice = MEMBERSHIP_PRICES[tier].monthly;
              const tierSubscribers =
                tier === 'apertura'
                  ? Math.round(metrics.activeSubscribers * 0.4)
                  : tier === 'obturador'
                    ? Math.round(metrics.activeSubscribers * 0.35)
                    : Math.round(metrics.activeSubscribers * 0.25);
              const tierMrr = tierSubscribers * tierPrice;

              return (
                <div key={tier} className="flex items-center gap-3">
                  <TierBadge tier={tier} size="sm" />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{tierSubscribers} suscriptores</span>
                      <span className="text-foreground font-600">
                        ${tierMrr.toLocaleString()}/mes
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full progress-bar rounded-full"
                        style={{
                          width: `${metrics.mrr > 0 ? (tierMrr / metrics.mrr) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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
              {
                label: 'MRR Actual',
                value: `$${metrics.mrr.toLocaleString()}`,
                trend: metrics.mrr > 0 ? 'En vivo' : 'Sin datos',
              },
              {
                label: 'ARR Proyectado',
                value: `$${metrics.arr.toLocaleString()}`,
                trend: 'MRR × 12',
              },
              {
                label: 'Suscriptores Activos',
                value: metrics.activeSubscribers.toString(),
                trend: `+${metrics.newThisMonth} este mes`,
              },
              {
                label: 'Churn Rate',
                value: `${metrics.churnRate}%`,
                trend: metrics.churnRate > 0 ? 'Requiere atención' : 'Saludable',
              },
              {
                label: 'Ventas de Cursos',
                value: metrics.courseSales.toString(),
                trend: `Ticket: $${metrics.averageTicket}`,
              },
              {
                label: 'Revenue Total',
                value: `$${metrics.totalRevenue.toLocaleString()}`,
                trend: 'Cursos + Subs. anualizado',
              },
              {
                label: 'Estudiantes Totales',
                value: metrics.totalStudents.toString(),
                trend: `Admins: ${metrics.totalAdmins}`,
              },
              {
                label: 'Cuentas Gratuitas',
                value: metrics.freeAccounts.toString(),
                trend: `${metrics.conversionRate}% conversión`,
              },
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
  );
}

// ─── Courses Tab Component (embedded link to full manager) ────────────────────

function AdminCoursesTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-700 text-foreground">Gestión de Cursos</h2>
          <p className="text-sm text-muted-foreground">
            Crea y gestiona la estructura completa: Curso → Módulos → Lecciones → Recursos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/courses"
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Icon name="FilmIcon" size={16} />
            Gestión Completa de Cursos
          </Link>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 border-white/10">
        <div className="text-center py-8">
          <Icon name="FilmIcon" size={48} className="mx-auto mb-4 text-primary" />
          <h3 className="text-xl font-700 text-foreground mb-2">Gestión Avanzada de Cursos</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            El gestor completo con estructura jerárquica (Curso → Módulos → Lecciones → Recursos),
            reproductor de video seguro, recursos fotográficos especializados y control de estados
            está disponible en la página dedicada.
          </p>
          <Link
            href="/admin/courses"
            className="btn-primary px-8 py-3 text-base inline-flex items-center gap-2"
          >
            <Icon name="ArrowRightIcon" size={18} />
            Ir a Gestión de Cursos (/admin/courses)
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Instructors Tab Component ────────────────────────────────────────

function InstructorsTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-700 text-foreground">Gestión de Instructores</h2>
          <p className="text-sm text-muted-foreground">
            Administra instructores: fotos, especialidades, biografías y etiquetas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/courses?tab=instructors"
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Icon name="UserGroupIcon" size={16} />
            Gestión Completa de Instructores
          </Link>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 border-white/10">
        <div className="text-center py-8">
          <Icon name="UserGroupIcon" size={48} className="mx-auto mb-4 text-primary" />
          <h3 className="text-xl font-700 text-foreground mb-2">Gestión de Instructores</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            La gestión completa de instructores (fotos, especialidades, biografías, etiquetas) está
            disponible en la página de cursos, pestaña "Instructores".
          </p>
          <Link
            href="/admin/courses?tab=instructors"
            className="btn-primary px-8 py-3 text-base inline-flex items-center gap-2"
          >
            <Icon name="ArrowRightIcon" size={18} />
            Ir a Gestión de Instructores
          </Link>
        </div>
      </div>
    </div>
  );
}
