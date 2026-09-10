/**
 * Política de evidencia de `verify`.
 *
 * `critical` solo clasifica una OMISIÓN. No apaga pasos ni suaviza fallos:
 * cualquier paso que corre y falla conserva exit 1. Un paso crítico sin medir
 * impide presentar el resultado como cierre completo; uno no crítico deja
 * cobertura parcial, pero no invalida por sí solo la evidencia del artefacto
 * desplegable.
 *
 * La política vive separada del runner para que cada paso nuevo tenga que
 * declarar su impacto y para probar el veredicto sin ejecutar el gate entero.
 */

export const STEP_POLICY = Object.freeze({
  harness: Object.freeze({
    critical: false,
    reason:
      "Valida tooling de coordinación, no el artefacto desplegado; su omisión reduce evidencia de proceso, no de comportamiento de producción.",
  }),
  lint: Object.freeze({
    critical: true,
    reason:
      "Aplica reglas de código y arquitectura que bloquean patrones inválidos antes de que lleguen al runtime.",
  }),
  "rsc-boundary": Object.freeze({
    critical: true,
    reason:
      "Detecta cruces server/client que typecheck y unitarios no ven y que producen errores 500 en runtime.",
  }),
  typecheck: Object.freeze({
    critical: true,
    reason:
      "Demuestra que el grafo TypeScript del producto conserva contratos estáticos compilables.",
  }),
  "edge-functions": Object.freeze({
    critical: true,
    reason:
      "Es la única comprobación estática completa de Edge Functions con efectos live, excluidas del typecheck principal.",
  }),
  test: Object.freeze({
    critical: true,
    reason:
      "Ejecuta la suite de regresión funcional y de contratos del producto.",
  }),
  "docs:check": Object.freeze({
    critical: false,
    reason:
      "Valida frontmatter e índice documental SDD; su ausencia afecta trazabilidad, no el comportamiento del artefacto desplegado.",
  }),
  numbering: Object.freeze({
    critical: true,
    reason:
      "Evita colisiones de specs y migraciones que vuelven ambigua o insegura la integración.",
  }),
  "feature-constants": Object.freeze({
    critical: true,
    reason:
      "Detecta cambios de banderas que alteran comportamiento real sin quedar declarados.",
  }),
  "components:check": Object.freeze({
    critical: false,
    reason:
      "Valida el registro derivado de componentes; su omisión reduce inventario de gobernanza, no cobertura runtime.",
  }),
  "governance:check": Object.freeze({
    critical: false,
    reason:
      "Valida una cápsula derivada para agentes; su omisión reduce evidencia de gobernanza, no cobertura del binario desplegable.",
  }),
  "migrations-applied": Object.freeze({
    critical: true,
    reason:
      "Compara repositorio contra el ledger real de producción y detecta migraciones integradas pero no aplicadas, como 0228 y 0169.",
  }),
  "sql-tests": Object.freeze({
    critical: true,
    reason:
      "Prueba RLS, privilegios, triggers e invariantes SQL sobre PostgreSQL desechable.",
  }),
  "schema-rebuild": Object.freeze({
    critical: true,
    reason:
      "Demuestra que el esquema puede reconstruirse desde los archivos versionados y descubre migraciones inaplicables.",
  }),
  e2e: Object.freeze({
    critical: true,
    reason:
      "Cubre interacciones navegador y fallos cliente que unitarios, typecheck y build no ejercitan.",
  }),
  build: Object.freeze({
    critical: true,
    reason:
      "Construye el artefacto de producción y ejerce prerender, bundling y next/font no cubiertos por otros pasos.",
  }),
});

function duplicates(names) {
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

/** Obliga a clasificar exactamente todos los pasos del runner. */
export function assertCompleteStepPolicy(stepNames) {
  const repeated = duplicates(stepNames);
  const declared = Object.keys(STEP_POLICY);
  const missing = stepNames.filter((name) => !Object.hasOwn(STEP_POLICY, name));
  const orphaned = declared.filter((name) => !stepNames.includes(name));
  const malformed = declared.filter((name) => {
    const policy = STEP_POLICY[name];
    return typeof policy.critical !== "boolean" || !policy.reason?.trim();
  });
  const problems = [];
  if (repeated.length > 0) problems.push(`pasos duplicados: ${repeated.join(", ")}`);
  if (missing.length > 0) problems.push(`sin clasificación: ${missing.join(", ")}`);
  if (orphaned.length > 0) problems.push(`clasificaciones huérfanas: ${orphaned.join(", ")}`);
  if (malformed.length > 0) problems.push(`clasificaciones sin motivo válido: ${malformed.join(", ")}`);
  if (problems.length > 0) {
    throw new Error(`política de verify incompleta — ${problems.join("; ")}`);
  }
}

function assertKnownResults(stepNames, skipped, failures) {
  const known = new Set(stepNames);
  const resultNames = [
    ...skipped.map((step) => step.name),
    ...failures,
  ];
  const unknown = [...new Set(resultNames.filter((name) => !known.has(name)))];
  const repeatedSkipped = duplicates(skipped.map((step) => step.name));
  if (unknown.length > 0) throw new Error(`resultados de pasos desconocidos: ${unknown.join(", ")}`);
  if (repeatedSkipped.length > 0) {
    throw new Error(`pasos omitidos duplicados: ${repeatedSkipped.join(", ")}`);
  }
}

function omittedSuffix(noncriticalMissing) {
  return noncriticalMissing.length > 0
    ? ` También sin medir, no críticos: ${noncriticalMissing.join(", ")}.`
    : "";
}

/** Devuelve la única línea final y el exit correspondiente a la evidencia. */
export function buildVerifyVerdict({ stepNames, skipped, failures }) {
  assertKnownResults(stepNames, skipped, failures);
  const criticalMissing = skipped
    .map((step) => step.name)
    .filter((name) => STEP_POLICY[name].critical);
  const noncriticalMissing = skipped
    .map((step) => step.name)
    .filter((name) => !STEP_POLICY[name].critical);
  const measured = stepNames.length - skipped.length;

  if (failures.length > 0) {
    const criticalSuffix = criticalMissing.length > 0
      ? ` CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: ${criticalMissing.join(", ")}.`
      : "";
    return {
      kind: "failed",
      tone: "fail",
      exitCode: 1,
      criticalMissing,
      noncriticalMissing,
      message:
        `verify: ${failures.length} fallo(s): ${failures.join(", ")}.` +
        criticalSuffix +
        omittedSuffix(noncriticalMissing),
    };
  }

  if (criticalMissing.length > 0) {
    return {
      kind: "critical-unmeasured",
      tone: "warn",
      exitCode: 0,
      criticalMissing,
      noncriticalMissing,
      message:
        `verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: ${criticalMissing.join(", ")}.` +
        omittedSuffix(noncriticalMissing) +
        ` No hubo fallos en lo medido (${measured}/${stepNames.length}); ` +
        "exit 0 NO equivale a cierre verde completo.",
    };
  }

  if (noncriticalMissing.length > 0) {
    return {
      kind: "noncritical-unmeasured",
      tone: "warn",
      exitCode: 0,
      criticalMissing,
      noncriticalMissing,
      message:
        `verify: SIN FALLOS, COBERTURA PARCIAL — no críticos sin medir: ` +
        `${noncriticalMissing.join(", ")} (${measured}/${stepNames.length} pasos medidos).`,
    };
  }

  return {
    kind: "complete",
    tone: "ok",
    exitCode: 0,
    criticalMissing,
    noncriticalMissing,
    message: `verify: TODO VERDE ✓ (${measured}/${stepNames.length} pasos medidos)`,
  };
}
