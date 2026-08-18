'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscriptionTier, hasAccess, TIER_LABELS, type SubscriptionTier } from '@/lib/subscription';

// This course requires at least "obturador"
const COURSE_REQUIRED_TIER: SubscriptionTier = 'obturador';

type DetailTab = 'descripcion' | 'curriculo' | 'instructor' | 'resenas';

const curriculum = [
{ id: 'cur-001', section: 'Módulo 1: Fundamentos', lessons: [
  { id: 'les-001', title: 'Introducción al Esquema Rembrandt', duration: '08:42', preview: true, hasResource: false },
  { id: 'les-002', title: 'Historia y Origen de la Técnica', duration: '12:15', preview: true, hasResource: false },
  { id: 'les-003', title: 'Equipamiento Necesario', duration: '09:30', preview: false, hasResource: true }]
},
{ id: 'cur-002', section: 'Módulo 2: Configuración de Luz', lessons: [
  { id: 'les-004', title: 'Configuración del Key Light', duration: '14:32', preview: false, hasResource: true },
  { id: 'les-005', title: 'Posicionamiento del Modelo', duration: '11:18', preview: false, hasResource: false },
  { id: 'les-006', title: 'Ajuste del Fill Light', duration: '16:45', preview: false, hasResource: true },
  { id: 'les-007', title: 'El Triángulo de Luz en la Mejilla', duration: '13:22', preview: false, hasResource: true }]
},
{ id: 'cur-003', section: 'Módulo 3: Variantes Avanzadas', lessons: [
  { id: 'les-008', title: 'Variantes del Esquema Clásico', duration: '18:00', preview: false, hasResource: false },
  { id: 'les-009', title: 'Combinando con Luz de Borde', duration: '22:10', preview: false, hasResource: true },
  { id: 'les-010', title: 'Rembrandt en Exterior con Flash', duration: '28:45', preview: false, hasResource: false }]
},
{ id: 'cur-004', section: 'Módulo 4: Producción y Edición', lessons: [
  { id: 'les-011', title: 'Sesión Práctica en Estudio Real', duration: '31:40', preview: false, hasResource: true },
  { id: 'les-012', title: 'Edición Post-Producción RAW', duration: '25:15', preview: false, hasResource: true },
  { id: 'les-013', title: 'Color Grading Tonos Cálidos', duration: '19:30', preview: false, hasResource: true },
  { id: 'les-014', title: 'Exportación para Diferentes Usos', duration: '10:20', preview: false, hasResource: false },
  { id: 'les-015', title: 'Proyecto Final — Entrega y Revisión', duration: '22:08', preview: false, hasResource: false }]
}];


const reviews = [
{ id: 'rev-001', name: 'Mariana López', avatar: "https://images.unsplash.com/photo-1511937209140-62912b8086d9", avatarAlt: 'Young woman reviewer portrait', rating: 5, date: '15 jul 2026', text: 'El mejor curso de iluminación que he tomado. Carlos explica cada concepto con claridad y los archivos RAW de práctica son invaluables.' },
{ id: 'rev-002', name: 'Pedro Arroyo', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1ebb03a41-1763292034510.png", avatarAlt: 'Male reviewer headshot portrait', rating: 5, date: '10 jul 2026', text: 'Increíble calidad de producción. Los esquemas de iluminación en PDF son perfectos para tener siempre a la mano en el estudio.' },
{ id: 'rev-003', name: 'Camila Torres', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1e47647de-1776117330071.png", avatarAlt: 'Young woman reviewer with long dark hair', rating: 4, date: '02 jul 2026', text: 'Muy buen contenido. Me hubiera gustado más variantes de Rembrandt para diferentes tipos de rostro, pero lo básico está muy bien cubierto.' },
{ id: 'rev-004', name: 'Andrés Solís', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_179ebd6f2-1763294255544.png", avatarAlt: 'Male reviewer with glasses professional headshot', rating: 5, date: '28 jun 2026', text: 'Llevo 3 años haciendo fotografía de retrato y este curso me enseñó cosas que no sabía. La sesión práctica del módulo 4 es oro puro.' },
{ id: 'rev-005', name: 'Valeria Ríos', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_13717d9a1-1773121295746.png", avatarAlt: 'Female reviewer with straight hair smiling', rating: 5, date: '20 jun 2026', text: 'Compré el Plan Obturador solo por este curso y valió completamente la pena. Los LUTs incluidos ya los estoy usando en mis trabajos.' }];


export default function CourseDetailBody() {
  const { user, loading: authLoading } = useAuth();
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [tierLoading, setTierLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<DetailTab>('curriculo');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cur-001', 'cur-002']));

  useEffect(() => {
    if (authLoading) return;
    if (!user) {setTierLoading(false);return;}
    getUserSubscriptionTier().then((tier) => {
      setUserTier(tier);
      setTierLoading(false);
    });
  }, [user, authLoading]);

  const isAuthenticated = !!user;
  const isLoading = authLoading || tierLoading;
  const canAccessCourse = hasAccess(userTier, COURSE_REQUIRED_TIER);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  };

  const totalLessons = curriculum.reduce((acc, s) => acc + s.lessons.length, 0);
  const totalDuration = '8h 32min';

  return (
    <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 pb-20">
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex border-b border-border mb-8 overflow-x-auto scrollbar-hide">
            {([
            { id: 'descripcion', label: 'Descripción' },
            { id: 'curriculo', label: `Currículo (${totalLessons})` },
            { id: 'instructor', label: 'Instructor' },
            { id: 'resenas', label: `Reseñas (${reviews.length})` }] as
            {id: DetailTab;label: string;}[]).map((t) =>
            <button
              key={`detail-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 px-5 py-3.5 text-sm font-600 border-b-2 transition-colors ${
              activeTab === t.id ?
              'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`
              }>
              
                {t.label}
              </button>
            )}
          </div>

          {/* DESCRIPCIÓN */}
          {activeTab === 'descripcion' &&
          <div className="prose prose-invert max-w-none">
              <h3 className="text-lg font-700 text-foreground mb-3">Lo que aprenderás</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {[
              'Crear el triángulo de Rembrandt con precisión',
              'Controlar sombras y altas luces en retrato',
              'Adaptar el esquema a diferentes tipos de rostro',
              'Combinar con luces de relleno y borde',
              'Trabajar con modificadores profesionales',
              'Editar archivos RAW en Lightroom y Photoshop',
              'Exportar para uso comercial y editorial',
              'Crear LUTs personalizados para tu estilo'].
              map((item, i) =>
              <div key={`learn-${i}`} className="flex items-start gap-2">
                    <Icon name="CheckCircleIcon" size={16} className="text-primary shrink-0 mt-0.5" variant="solid" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
              )}
              </div>

              <h3 className="text-lg font-700 text-foreground mb-3">Requisitos</h3>
              <ul className="flex flex-col gap-2 mb-8">
                {[
              'Cámara réflex o mirrorless con control manual',
              'Conocimientos básicos de exposición (ISO, apertura, velocidad)',
              'Al menos una fuente de luz artificial (flash, LED)',
              'Ganas de aprender y practicar'].
              map((req, i) =>
              <li key={`req-${i}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-1">•</span>
                    {req}
                  </li>
              )}
              </ul>

              <h3 className="text-lg font-700 text-foreground mb-3">Descripción completa</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                La iluminación Rembrandt es una de las técnicas más reconocibles y solicitadas en fotografía de retrato profesional. Named después del maestro holandés del claroscuro, este esquema crea un triángulo de luz característico en la mejilla sombreada del sujeto, generando profundidad, drama y una calidad pictórica inconfundible.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                En este curso, Carlos Mendoza — fotógrafo comercial con más de 12 años de experiencia en sesiones para marcas como Zara, L'Oréal y El Palacio de Hierro — te guía desde los fundamentos teóricos hasta la aplicación práctica en estudio real. Trabajarás con los mismos archivos RAW que Carlos capturó durante las sesiones del curso.
              </p>
            </div>
          }

          {/* CURRÍCULO */}
          {activeTab === 'curriculo' &&
          <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-muted-foreground">
                  {totalLessons} lecciones · {totalDuration} de contenido · 5 archivos descargables
                </p>
                <button
                onClick={() => setExpandedSections(new Set(curriculum.map((s) => s.id)))}
                className="text-xs text-primary hover:text-accent font-600 transition-colors">
                
                  Expandir todo
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {curriculum.map((section) =>
              <div key={section.id} className="border border-border rounded-xl overflow-hidden">
                    <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left">
                  
                      <div className="flex items-center gap-3">
                        <Icon
                      name={expandedSections.has(section.id) ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                      size={16}
                      className="text-muted-foreground shrink-0" />
                    
                        <span className="text-sm font-700 text-foreground">{section.section}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {section.lessons.length} lecciones
                      </span>
                    </button>

                    {expandedSections.has(section.id) &&
                <div className="divide-y divide-border">
                        {section.lessons.map((lesson) => {
                    const lessonLocked = !lesson.preview && !canAccessCourse;
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                        
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                {lesson.preview ?
                          <Icon name="PlayIcon" size={14} className="text-primary" /> :
                          lessonLocked ?
                          <Icon name="LockClosedIcon" size={12} className="text-muted-foreground" /> :

                          <Icon name="PlayIcon" size={14} className="text-primary" />
                          }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm ${lessonLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                                    {lesson.title}
                                  </span>
                                  {lesson.preview &&
                            <span className="text-xs text-primary border border-primary/30 px-1.5 py-0.5 rounded font-600">
                                      Vista previa
                                    </span>
                            }
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {lesson.hasResource && !lessonLocked &&
                          <Icon name="PaperClipIcon" size={13} className="text-primary" title="Incluye recurso descargable" />
                          }
                                {lesson.hasResource && lessonLocked &&
                          <Icon name="LockClosedIcon" size={13} className="text-muted-foreground" title="Recurso bloqueado" />
                          }
                                <span className="text-xs text-muted-foreground font-mono">{lesson.duration}</span>
                              </div>
                            </div>);

                  })}
                      </div>
                }
                  </div>
              )}
              </div>
            </div>
          }

          {/* INSTRUCTOR */}
          {activeTab === 'instructor' &&
          <div>
              <div className="flex items-start gap-5 mb-6">
                <div className="relative w-20 h-20 rounded-full overflow-hidden shrink-0">
                  <AppImage
                  src="https://img.rocket.new/generatedImages/rocket_gen_img_151c008d8-1763296088919.png"
                  alt="Carlos Mendoza professional photography instructor headshot"
                  fill
                  className="object-cover"
                  sizes="80px" />
                
                </div>
                <div>
                  <h3 className="text-xl font-700 text-foreground mb-1">Carlos Mendoza</h3>
                  <p className="text-sm text-muted-foreground mb-3">Fotógrafo Comercial y Director de Arte · Ciudad de México</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Icon name="StarIcon" size={14} className="text-primary" variant="solid" />
                      <span className="text-foreground font-600">4.9</span> valoración
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="UsersIcon" size={14} />
                      4,820 estudiantes
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="PlayCircleIcon" size={14} />
                      14 cursos
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Carlos Mendoza es fotógrafo comercial con más de 12 años de experiencia en campañas para marcas de moda, belleza y consumo masivo. Ha trabajado para Zara, L'Oréal México, El Palacio de Hierro y múltiples agencias de publicidad en LATAM.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Su metodología de enseñanza combina teoría técnica rigurosa con sesiones prácticas en estudio real, usando el mismo equipamiento y flujos de trabajo que emplea en sus producciones comerciales. Actualmente imparte talleres presenciales en CDMX y Monterrey además de su contenido en Glewstudio.
              </p>
            </div>
          }

          {/* RESEÑAS */}
          {activeTab === 'resenas' &&
          <div>
              {/* Rating summary */}
              <div className="flex items-center gap-8 mb-8 p-5 bg-card border border-border rounded-2xl">
                <div className="text-center">
                  <div className="text-5xl font-800 gradient-gold-text mb-1">4.9</div>
                  <div className="flex justify-center mb-1">
                    {Array.from({ length: 5 }).map((_, i) =>
                  <Icon key={`sum-star-${i}`} name="StarIcon" size={14} className="text-primary" variant="solid" />
                  )}
                  </div>
                  <p className="text-xs text-muted-foreground">Valoración del curso</p>
                </div>
                <div className="flex-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                  const pcts: Record<number, number> = { 5: 88, 4: 8, 3: 3, 2: 1, 1: 0 };
                  return (
                    <div key={`rating-bar-${star}`} className="flex items-center gap-2 mb-1.5">
                        <div className="flex items-center gap-0.5 w-12 shrink-0">
                          {Array.from({ length: star }).map((_, i) =>
                        <Icon key={`rbar-star-${star}-${i}`} name="StarIcon" size={10} className="text-primary" variant="solid" />
                        )}
                        </div>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full progress-bar rounded-full" style={{ width: `${pcts[star]}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pcts[star]}%</span>
                      </div>);

                })}
                </div>
              </div>

              {/* Reviews list */}
              <div className="flex flex-col gap-5">
                {reviews.map((rev) =>
              <div key={rev.id} className="flex gap-4 pb-5 border-b border-border last:border-0">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <AppImage src={rev.avatar} alt={rev.avatarAlt} fill className="object-cover" sizes="40px" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-600 text-foreground">{rev.name}</span>
                        <span className="text-xs text-muted-foreground">{rev.date}</span>
                      </div>
                      <div className="flex mb-2">
                        {Array.from({ length: rev.rating }).map((_, i) =>
                    <Icon key={`rev-star-${rev.id}-${i}`} name="StarIcon" size={12} className="text-primary" variant="solid" />
                    )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{rev.text}</p>
                    </div>
                  </div>
              )}
              </div>
            </div>
          }
        </div>

        {/* Sticky sidebar */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0">
          <div className="lg:sticky lg:top-20">
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
              {/* Thumbnail */}
              <div className="relative aspect-video">
                <AppImage
                  src="https://img.rocket.new/generatedImages/rocket_gen_img_1cb16a1d8-1785194269805.png"
                  alt="Course enrollment card showing Rembrandt lighting technique preview"
                  fill
                  className="object-cover"
                  sizes="400px" />
                
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  {canAccessCourse ?
                  <Link href="/video-player">
                      <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                        <Icon name="PlayIcon" size={24} className="text-primary-foreground ml-1" />
                      </div>
                    </Link> :

                  <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
                      <Icon name="LockClosedIcon" size={22} className="text-white/60" />
                    </div>
                  }
                </div>
              </div>

              <div className="p-5">
                {/* Subscription status */}
                {!isLoading &&
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs ${
                canAccessCourse ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`
                }>
                    <Icon name={canAccessCourse ? 'CheckCircleIcon' : 'LockClosedIcon'} size={13} />
                    <span>
                      {isAuthenticated ?
                    userTier ?
                    canAccessCourse ?
                    `Acceso incluido en ${TIER_LABELS[userTier]}` :
                    `Tu plan (${TIER_LABELS[userTier]}) no incluye este curso` :
                    'Sin suscripción activa' : 'Inicia sesión para acceder'}
                    </span>
                  </div>
                }

                {/* Price */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-2xl font-800 text-foreground">Incluido en</div>
                    <TierBadge tier="obturador" size="md" showIcon />
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-700 text-primary">$49/mes</div>
                    <div className="text-xs text-muted-foreground">Plan Obturador</div>
                  </div>
                </div>

                {/* CTA based on access */}
                {isLoading ?
                <div className="w-full py-3 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div> :
                canAccessCourse ?
                <Link href="/video-player" className="btn-primary w-full py-3 text-sm font-700 text-center block mb-3">
                    Continuar Curso
                  </Link> :
                isAuthenticated ?
                <Link
                  href="/account-subscription-management"
                  className="btn-primary w-full py-3 text-sm font-700 text-center block mb-3">
                  
                    Actualizar a Plan Obturador
                  </Link> :

                <Link href="/sign-up-login" className="btn-primary w-full py-3 text-sm font-700 text-center block mb-3">
                    Acceder al Curso
                  </Link>
                }

                <Link href="/video-player" className="btn-ghost w-full py-2.5 text-sm font-600 text-center block mb-5">
                  Vista Previa Gratis
                </Link>

                {/* Course stats */}
                <div className="flex flex-col gap-2.5 text-sm">
                  {[
                  { icon: 'ClockIcon', label: '8h 32min de contenido en video' },
                  { icon: 'QueueListIcon', label: `${totalLessons} lecciones` },
                  { icon: 'DocumentArrowDownIcon', label: '5 archivos RAW de práctica' },
                  { icon: 'DocumentTextIcon', label: '4 esquemas de iluminación PDF' },
                  { icon: 'SwatchIcon', label: '2 Presets Lightroom + 1 LUT' },
                  { icon: 'DevicePhoneMobileIcon', label: 'Acceso en móvil y tablet' },
                  { icon: 'TrophyIcon', label: 'Certificado al completar' }].
                  map((item, i) =>
                  <div key={`course-stat-${i}`} className="flex items-center gap-2.5 text-muted-foreground">
                      <Icon name={item.icon as any} size={15} className="text-primary shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>);

}