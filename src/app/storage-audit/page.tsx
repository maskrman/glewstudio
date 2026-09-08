'use client';

import { useState } from 'react';
import { runStorageAudit } from '@/app/actions/storageAudit';
import type { StorageAuditReport, AuditTestResult } from '@/app/actions/storageAudit';

function TestResultCard({ result }: { result: AuditTestResult }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    result.actualResult === 'DENIED' && result.expectedResult === 'DENIED' ?'bg-green-900/30 border-green-700'
      : result.actualResult === 'PERMITTED'&& result.expectedResult === 'PERMITTED' ?'bg-green-900/30 border-green-700'
      : result.actualResult === 'SKIPPED' ?'bg-yellow-900/20 border-yellow-700' :'bg-red-900/30 border-red-700';

  const badge =
    result.actualResult === 'SKIPPED' ?'bg-yellow-700 text-yellow-100'
      : result.passed
      ? 'bg-green-700 text-green-100' :'bg-red-700 text-red-100';

  const badgeText = result.actualResult === 'SKIPPED' ? 'SKIPPED' : result.passed ? 'PASS' : 'FAIL';

  return (
    <div className={`border rounded-lg p-4 mb-3 ${statusColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${badge}`}>{badgeText}</span>
            <span className="text-xs font-mono text-gray-400">{result.testId}</span>
          </div>
          <h3 className="text-sm font-semibold text-white">{result.testName}</h3>
          <p className="text-xs text-gray-400 mt-1">{result.scenario}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-gray-500">Expected: <span className="text-gray-300">{result.expectedResult}</span></span>
          <span className="text-xs text-gray-500">Actual: <span className={result.passed ? 'text-green-400' : result.actualResult === 'SKIPPED' ? 'text-yellow-400' : 'text-red-400'}>{result.actualResult}</span></span>
          {result.httpStatus && (
            <span className="text-xs text-gray-500">HTTP: <span className="text-gray-300">{result.httpStatus}</span></span>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-300 mt-2">{result.explanation}</p>

      {(result.policyEvaluated || result.usingExpression || result.errorMessage) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-400 hover:text-blue-300 mt-2 underline"
        >
          {expanded ? 'Hide details' : 'Show policy details'}
        </button>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          {result.policyEvaluated && (
            <div>
              <span className="text-xs font-semibold text-gray-400">Policy evaluated:</span>
              <pre className="text-xs text-blue-300 mt-1 bg-black/30 p-2 rounded overflow-x-auto">{result.policyEvaluated}</pre>
            </div>
          )}
          {result.usingExpression && (
            <div>
              <span className="text-xs font-semibold text-gray-400">USING expression evaluation:</span>
              <pre className="text-xs text-green-300 mt-1 bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">{result.usingExpression}</pre>
            </div>
          )}
          {result.errorMessage && (
            <div>
              <span className="text-xs font-semibold text-gray-400">Supabase error:</span>
              <pre className="text-xs text-red-300 mt-1 bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">{result.errorMessage}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PolicyDocSection({ report }: { report: StorageAuditReport }) {
  const [section, setSection] = useState<string | null>(null);
  const doc = report.policyDocumentation;

  const sections = [
    { key: 'videos', label: 'videos bucket policy', content: doc.videosBucketPolicy },
    { key: 'lesson', label: 'lesson-resources bucket policy', content: doc.lessonResourcesBucketPolicy },
    { key: 'using_v', label: 'USING/WITH CHECK (videos)', content: doc.usingExpressionVideos },
    { key: 'using_l', label: 'USING/WITH CHECK (lesson-resources)', content: doc.usingExpressionLessonResources },
    { key: 'helper', label: 'Helper function logic', content: doc.helperFunctionLogic },
    { key: 'why', label: 'Why Apertura cannot read Diafragma', content: doc.whyAperturaCannotReadDiafragma },
  ];

  return (
    <div className="mt-6">
      <h2 className="text-base font-bold text-white mb-3">Policy Documentation</h2>
      <div className="space-y-2">
        {sections.map((s) => (
          <div key={s.key} className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setSection(section === s.key ? null : s.key)}
              className="w-full text-left px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 flex justify-between items-center"
            >
              <span>{s.label}</span>
              <span className="text-gray-500">{section === s.key ? '▲' : '▼'}</span>
            </button>
            {section === s.key && (
              <pre className="text-xs text-green-300 bg-black/40 p-4 overflow-x-auto whitespace-pre-wrap border-t border-gray-700">
                {s.content}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StorageAuditPage() {
  const [report, setReport] = useState<StorageAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runStorageAudit();
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error running audit');
    } finally {
      setLoading(false);
    }
  };

  const overallBadge = report
    ? report.overallStatus === 'PASS' ?'bg-green-700 text-green-100'
      : report.overallStatus === 'PARTIAL' ?'bg-yellow-700 text-yellow-100' :'bg-red-700 text-red-100' :'';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Storage Bypass Audit</h1>
          <p className="text-sm text-gray-400 mt-1">
            Auditoría de cierre — Fase 2. Verifica que las políticas de storage.objects bloquean
            el acceso directo de usuarios Apertura a contenido Diafragma.
          </p>
        </div>

        {/* Architecture note */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-bold text-blue-300 mb-2">Arquitectura de defensa en profundidad</h2>
          <div className="text-xs text-gray-300 space-y-1">
            <p><span className="text-blue-400 font-semibold">PUERTA PRIMARIA (server-side):</span> /api/video-token y generateSignedVideoUrl() verifican courses.minimum_tier antes de emitir URL firmada.</p>
            <p><span className="text-green-400 font-semibold">PUERTA SECUNDARIA (storage policy — NUEVA):</span> videos_tier_select y lesson_resources_tier_select extraen courseId del path y verifican el tier del usuario contra courses.minimum_tier.</p>
            <p className="text-yellow-300 mt-2">⚠️ Vulnerabilidad corregida: las políticas anteriores permitían acceso a cualquier usuario con suscripción activa (cualquier tier). Las nuevas políticas verifican el tier específico del contenido.</p>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRunAudit}
          disabled={loading}
          className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors mb-6"
        >
          {loading ? 'Ejecutando tests de autorización...' : 'Ejecutar Auditoría de Storage (Tests A–F)'}
        </button>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {report && (
          <>
            {/* Summary */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">Resultado de la auditoría</h2>
                <span className={`text-sm font-bold px-3 py-1 rounded ${overallBadge}`}>
                  {report.overallStatus}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{report.totalTests}</div>
                  <div className="text-xs text-gray-400">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{report.passed}</div>
                  <div className="text-xs text-gray-400">Passed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{report.failed}</div>
                  <div className="text-xs text-gray-400">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{report.skipped}</div>
                  <div className="text-xs text-gray-400">Skipped</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Timestamp: {report.timestamp}
              </p>
              {report.skipped > 0 && (
                <p className="text-xs text-yellow-400 mt-1">
                  ℹ️ Tests omitidos requieren datos de prueba en la base de datos (cursos/recursos con tier=diafragma).
                  Crea los datos de prueba y vuelve a ejecutar la auditoría.
                </p>
              )}
            </div>

            {/* Test results */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-white mb-3">Resultados por test</h2>
              {report.results.map((result) => (
                <TestResultCard key={result.testId} result={result} />
              ))}
            </div>

            {/* Policy documentation */}
            <PolicyDocSection report={report} />
          </>
        )}

        {/* Static policy reference (always visible) */}
        {!report && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <h2 className="text-sm font-bold text-white mb-3">Políticas implementadas (migración 20260819010000)</h2>
            <div className="space-y-4 text-xs">
              <div>
                <p className="text-blue-400 font-semibold mb-1">videos_tier_select — USING expression:</p>
                <pre className="text-green-300 bg-black/40 p-3 rounded overflow-x-auto">{`bucket_id = 'videos'
AND (
  public.is_admin()
  OR public.user_can_access_course_content(
       split_part(name, '/', 1)::UUID
     )
)`}</pre>
              </div>
              <div>
                <p className="text-blue-400 font-semibold mb-1">lesson_resources_tier_select — USING expression:</p>
                <pre className="text-green-300 bg-black/40 p-3 rounded overflow-x-auto">{`bucket_id = 'lesson-resources'
AND (
  public.is_admin()
  OR public.user_can_access_course_content(
       split_part(name, '/', 1)::UUID
     )
)`}</pre>
              </div>
              <div>
                <p className="text-blue-400 font-semibold mb-1">user_can_access_course_content(courseId) — lógica:</p>
                <pre className="text-gray-300 bg-black/40 p-3 rounded overflow-x-auto">{`1. auth.uid() != NULL (autenticado)
2. courses WHERE id = courseId AND is_published = TRUE → minimum_tier
3. IF minimum_tier IS NULL → TRUE (curso gratuito)
4. required_rank = get_tier_rank(minimum_tier)
5. subscriptions WHERE user_id = auth.uid() AND status = 'active' → tier
6. IF get_tier_rank(user_tier) >= required_rank → TRUE
7. course_purchases WHERE user_id = auth.uid() AND course_id = courseId
   AND purchase_status = 'paid' → TRUE
8. RETURN FALSE`}</pre>
              </div>
              <div className="bg-red-900/20 border border-red-700 rounded p-3">
                <p className="text-red-400 font-semibold mb-1">Por qué Apertura NO puede leer Diafragma:</p>
                <pre className="text-gray-300 overflow-x-auto">{`Path: <diafragma_course_id>/lesson.mp4
split_part(name, '/', 1) = <diafragma_course_id>
courses.minimum_tier = 'diafragma' → rank=3
user tier = 'apertura' → rank=1
1 >= 3 → FALSE
No paid purchase → FALSE
USING = FALSE → HTTP 400/403 (DENIED)`}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
