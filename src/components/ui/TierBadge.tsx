import React from 'react';
import Icon from '@/components/ui/AppIcon';

type Tier = 'apertura' | 'obturador' | 'diafragma' | 'free';

interface TierBadgeProps {
  tier: Tier;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

const tierConfig: Record<Tier, { label: string; className: string; icon: string }> = {
  free: { label: 'Gratis', className: 'bg-muted text-muted-foreground border border-border', icon: 'PlayIcon' },
  apertura: { label: 'Apertura', className: 'tier-badge-apertura', icon: 'CameraIcon' },
  obturador: { label: 'Obturador', className: 'tier-badge-obturador', icon: 'StarIcon' },
  diafragma: { label: 'Diafragma', className: 'tier-badge-diafragma', icon: 'SparklesIcon' },
};

export default function TierBadge({ tier, size = 'sm', showIcon = false }: TierBadgeProps) {
  const config = tierConfig[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-600 ${config.className} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {showIcon && <Icon name={config.icon as any} size={size === 'sm' ? 10 : 13} />}
      {config.label}
    </span>
  );
}