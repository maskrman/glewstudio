/**
 * GLEW Studio — Centralized Platform Configuration
 * All pricing, discounts, and tier definitions live here.
 * These values are also stored in the platform_config table in Supabase
 * for server-side access and admin management.
 */

export type SubscriptionTier = 'apertura' | 'obturador' | 'diafragma' | null;
export type CourseAccessType = 'free' | 'membership' | 'premium_purchase';

// ─── Tier Rank ────────────────────────────────────────────────────────────────
export const TIER_RANK: Record<string, number> = {
  apertura: 1,
  obturador: 2,
  diafragma: 3,
};

export function tierRank(tier: SubscriptionTier): number {
  if (!tier) return 0;
  return TIER_RANK[tier] ?? 0;
}

export function hasAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  if (!requiredTier) return true;
  return tierRank(userTier) >= tierRank(requiredTier);
}

// ─── Membership Prices ────────────────────────────────────────────────────────
export const MEMBERSHIP_PRICES: Record<string, { monthly: number; annual: number; annualTotal: number }> = {
  apertura: { monthly: 9.99, annual: 7.99, annualTotal: 95.88 },
  obturador: { monthly: 19.99, annual: 15.99, annualTotal: 191.88 },
  diafragma: { monthly: 29.99, annual: 23.99, annualTotal: 287.88 },
};

// ─── Membership Discounts on Premium Courses ─────────────────────────────────
// Percentage discount applied to premium_purchase courses for members
export const MEMBERSHIP_DISCOUNTS: Record<string, number> = {
  apertura: 10,   // 10% off premium courses
  obturador: 20,  // 20% off premium courses
  diafragma: 30,  // 30% off premium courses
};

// ─── Tier Labels ──────────────────────────────────────────────────────────────
export const TIER_LABELS: Record<string, string> = {
  apertura: 'Plan Apertura',
  obturador: 'Plan Obturador',
  diafragma: 'Plan Diafragma',
};

export const TIER_SHORT_LABELS: Record<string, string> = {
  apertura: 'Apertura',
  obturador: 'Obturador',
  diafragma: 'Diafragma',
};

// ─── Membership Features ──────────────────────────────────────────────────────
export const MEMBERSHIP_FEATURES: Record<string, string[]> = {
  apertura: [
    'Contenido seleccionado y cursos introductorios',
    'Clases de muestra exclusivas',
    'Contenido exclusivo para miembros',
    '10% de descuento en cursos premium',
    'Acceso desde cualquier dispositivo',
    'Comunidad de estudiantes',
  ],
  obturador: [
    'Todo lo de Apertura',
    'Mayor catálogo incluido',
    'Contenido premium seleccionado',
    '20% de descuento en cursos premium',
    'Material complementario descargable',
    'Certificados cuando corresponda',
  ],
  diafragma: [
    'Todo lo de Obturador',
    'Mayor catálogo disponible',
    'Más contenido premium incluido',
    '30% de descuento en cursos premium',
    'Masterclasses exclusivas',
    'Workshops y sesiones en vivo',
    'Sesiones Q&A con instructores',
    'Revisión de portafolio mensual',
  ],
};

// ─── Price Calculation ────────────────────────────────────────────────────────
/**
 * Calculate the final price for a premium course based on user's membership tier.
 */
export function calculateCoursePrice(
  originalPrice: number,
  userTier: SubscriptionTier
): { originalPrice: number; finalPrice: number; discountPct: number; savings: number } {
  const discountPct = userTier ? (MEMBERSHIP_DISCOUNTS[userTier] ?? 0) : 0;
  const savings = Math.round(originalPrice * (discountPct / 100) * 100) / 100;
  const finalPrice = Math.round((originalPrice - savings) * 100) / 100;
  return { originalPrice, finalPrice, discountPct, savings };
}

// ─── Course Access Check (client-side, non-authoritative) ─────────────────────
/**
 * Client-side access check. NOT authoritative — server/RLS must also validate.
 * Use this only for UI rendering decisions (show/hide lock icons, etc.)
 */
export interface CourseAccessParams {
  accessType: CourseAccessType;
  minimumTier?: SubscriptionTier;
  userTier: SubscriptionTier;
  isAuthenticated: boolean;
  hasPurchased?: boolean;
}

export function canAccessCourse(params: CourseAccessParams): boolean {
  const { accessType, minimumTier, userTier, isAuthenticated, hasPurchased } = params;

  if (accessType === 'free') return true;
  if (!isAuthenticated) return false;

  if (accessType === 'premium_purchase') {
    return hasPurchased === true;
  }

  if (accessType === 'membership') {
    if (!minimumTier) return !!userTier; // any active membership
    return hasAccess(userTier, minimumTier);
  }

  return false;
}

// ─── Subscription Statuses ────────────────────────────────────────────────────
export const SUBSCRIPTION_STATUSES = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCEL_AT_PERIOD_END: 'cancel_at_period_end',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

// ─── Payment Provider ─────────────────────────────────────────────────────────
export const PAYMENT_CONFIG = {
  provider: 'demo' as const,
  mode: 'TEST' as const,
  note: 'Payment provider not yet configured. All transactions are DEMO/TEST only.',
};
