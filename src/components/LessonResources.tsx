'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { getLessonResources, generateSignedDownloadUrl, type LessonResource } from '@/app/actions/lessonResources';
import { hasAccess, TIER_LABELS, type SubscriptionTier } from '@/lib/subscription';

interface LessonResourcesProps {
  courseId: string;
  lessonId: string;
  userTier: SubscriptionTier;
  isAuthenticated: boolean;
  isLoading?: boolean;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  RAW: 'DocumentArrowDownIcon',
  PDF: 'DocumentTextIcon',
  XMP: 'SwatchIcon',
  DNG: 'DocumentArrowDownIcon',
  LUT: 'FilmIcon',
  ZIP: 'ArchiveBoxIcon',
  PRESET: 'SwatchIcon',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  RAW: 'text-amber-400',
  PDF: 'text-red-400',
  XMP: 'text-blue-400',
  DNG: 'text-amber-400',
  LUT: 'text-purple-400',
  ZIP: 'text-green-400',
  PRESET: 'text-blue-400',
};

export default function LessonResources({
  courseId,
  lessonId,
  userTier,
  isAuthenticated,
  isLoading: parentLoading = false,
}: LessonResourcesProps) {
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    if (!isAuthenticated) {
      setFetchLoading(false);
      return;
    }
    setFetchLoading(true);
    setFetchError(null);
    try {
      const result = await getLessonResources(courseId, lessonId);
      if (result.error) {
        setFetchError(result.error);
      } else {
        setResources(result.resources);
      }
    } catch {
      setFetchError('No se pudieron cargar los recursos.');
    } finally {
      setFetchLoading(false);
    }
  }, [courseId, lessonId, isAuthenticated]);

  useEffect(() => {
    if (!parentLoading) {
      fetchResources();
    }
  }, [fetchResources, parentLoading]);

  const handleDownload = async (resource: LessonResource) => {
    if (!isAuthenticated) return;

    const resourceTier = resource.requiredTier as SubscriptionTier;
    const canDownload = hasAccess(userTier, resourceTier);

    if (!canDownload) {
      setDownloadError(
        `Este recurso requiere ${TIER_LABELS[resourceTier] ?? resource.requiredTier}.`
      );
      setTimeout(() => setDownloadError(null), 4000);
      return;
    }

    setDownloadingId(resource.id);
    setDownloadError(null);

    try {
      const result = await generateSignedDownloadUrl(resource.id);
      if (result.url) {
        // Open signed URL in a new tab — browser handles the download
        const anchor = document.createElement('a');
        anchor.href = result.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } else {
        setDownloadError(result.error ?? 'No se pudo generar el enlace de descarga.');
        setTimeout(() => setDownloadError(null), 5000);
      }
    } catch {
      setDownloadError('Error al generar el enlace de descarga.');
      setTimeout(() => setDownloadError(null), 5000);
    } finally {
      setDownloadingId(null);
    }
  };

  const isLoading = parentLoading || fetchLoading;

  if (!isAuthenticated) {
    return (
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Archivos descargables para esta lección.
        </p>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="LockClosedIcon" size={18} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Inicia sesión para ver los recursos</p>
          <Link href="/sign-up-login" className="btn-primary px-4 py-2 text-xs font-700">
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Archivos descargables para esta lección. Los recursos marcados requieren Plan Diafragma.
      </p>

      {/* Subscription status indicator */}
      {!isLoading && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs ${
            userTier ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Icon name={userTier ? 'CheckCircleIcon' : 'LockClosedIcon'} size={13} />
          <span>
            {userTier
              ? `Plan activo: ${TIER_LABELS[userTier]}`
              : 'Sin suscripción activa'}
          </span>
        </div>
      )}

      {/* Download error banner */}
      {downloadError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg mb-3 bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <Icon name="ExclamationCircleIcon" size={13} className="shrink-0 mt-0.5" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={`skel-${i}`} className="flex items-center gap-3 p-3 rounded-xl border border-border animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2.5 bg-muted rounded w-1/2" />
              </div>
              <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Fetch error */}
      {!isLoading && fetchError && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Icon name="ExclamationCircleIcon" size={24} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{fetchError}</p>
          <button
            onClick={fetchResources}
            className="btn-ghost px-3 py-1.5 text-xs font-600"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !fetchError && resources.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="DocumentIcon" size={18} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No hay recursos para esta lección</p>
        </div>
      )}

      {/* Resource list */}
      {!isLoading && !fetchError && resources.length > 0 && (
        <div className="flex flex-col gap-3">
          {resources.map((res) => {
            const resourceTier = res.requiredTier as SubscriptionTier;
            const resLocked = !hasAccess(userTier, resourceTier);
            const isDownloading = downloadingId === res.id;
            const iconName = FILE_TYPE_ICONS[res.fileType] ?? 'DocumentIcon';
            const iconColor = FILE_TYPE_COLORS[res.fileType] ?? 'text-primary';

            return (
              <div
                key={res.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  resLocked
                    ? 'border-border opacity-60' :'border-border hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                {/* File type icon */}
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    resLocked ? 'bg-muted' : 'bg-primary/10'
                  }`}
                >
                  <Icon
                    name={iconName as any}
                    size={18}
                    className={resLocked ? 'text-muted-foreground' : iconColor}
                  />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-600 text-foreground truncate">{res.displayName}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {res.fileSize && (
                      <span className="text-xs text-muted-foreground">{res.fileSize}</span>
                    )}
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-600">
                      {res.fileType}
                    </span>
                    {res.requiredTier && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-600 ${
                          res.requiredTier === 'diafragma' ?'tier-badge-diafragma' :'tier-badge-obturador'
                        }`}
                      >
                        {res.requiredTier === 'diafragma' ? 'Master' : 'Pro'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Download button */}
                <button
                  onClick={() => handleDownload(res)}
                  disabled={isDownloading}
                  className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    resLocked
                      ? 'bg-muted cursor-not-allowed'
                      : isDownloading
                      ? 'bg-primary/10 cursor-wait' :'bg-primary/10 hover:bg-primary/20 text-primary'
                  }`}
                  aria-label={
                    resLocked
                      ? 'Contenido bloqueado'
                      : isDownloading
                      ? 'Descargando...'
                      : `Descargar ${res.displayName}`
                  }
                >
                  {isDownloading ? (
                    <div className="w-3.5 h-3.5 border border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon
                      name={resLocked ? 'LockClosedIcon' : 'ArrowDownTrayIcon'}
                      size={14}
                      className={resLocked ? 'text-muted-foreground' : 'text-primary'}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upgrade CTA for locked resources */}
      {!isLoading && !fetchError && resources.some((r) => !hasAccess(userTier, r.requiredTier as SubscriptionTier)) && (
        <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Algunos recursos requieren un plan superior
          </p>
          <Link
            href="/account-subscription-management"
            className="text-xs text-primary font-600 hover:underline"
          >
            Ver planes →
          </Link>
        </div>
      )}
    </div>
  );
}
