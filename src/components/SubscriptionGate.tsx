'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useUserPlan, hasAccess, TIER_LABELS, TIER_PRICES, type SubscriptionTier } from '@/hooks/useUserPlan';

interface SubscriptionGateProps {
  /** Minimum tier required to access the content */
  requiredTier: SubscriptionTier;
  /** Content to render if user has access */
  children: React.ReactNode;
  /** Optional custom message */
  message?: string;
}

/**
 * Wraps content that requires a specific subscription tier.
 * Shows an upgrade prompt if the user's plan is insufficient.
 */
export default function SubscriptionGate({ requiredTier, children, message }: SubscriptionGateProps) {
  const { tier, isActive, isLoading } = useUserPlan();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="ArrowPathIcon" size={24} className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!isActive || !hasAccess(tier, requiredTier)) {
    const requiredLabel = TIER_LABELS[requiredTier] ?? requiredTier;
    const requiredPrice = TIER_PRICES[requiredTier] ?? '';

    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
          <Icon name="LockClosedIcon" size={28} className="text-primary" />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <TierBadge tier={requiredTier} size="md" showIcon />
          <span className="text-sm font-600 text-muted-foreground">requerido</span>
        </div>

        <h3 className="text-xl font-800 text-foreground mb-2">
          Contenido exclusivo
        </h3>

        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
          {message || `Este contenido requiere el ${requiredLabel} o superior. Actualiza tu plan para acceder.`}
        </p>

        {!isActive && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 mb-5">
            <Icon name="ExclamationTriangleIcon" size={15} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400 font-600">No tienes una suscripción activa</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/sign-up-login"
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-700"
          >
            <Icon name="ArrowUpCircleIcon" size={16} />
            Actualizar a {requiredLabel} — {requiredPrice}
          </Link>
          <Link
            href="/dashboard"
            className="btn-ghost inline-flex items-center gap-2 px-5 py-2.5 text-sm font-600"
          >
            Ver cursos gratuitos
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
