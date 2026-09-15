/**
 * Política de evidencia de `verify`.
 *
 * `critical` solo clasifica una OMISIÓN. No apaga pasos ni suaviza fallos:
 * cualquier paso que corre y falla conserva exit 1. Un paso crítico sin medir
 * impide presentar el resultado como cierre completo; uno no crítico deja
 * cobertura parcial, pero no invalida por sí solo la evidencia del artefacto
 * desplegable.
 *
 * El exit distingue fallos de ejecución, no disponibilidad de evidencia:
 * un paso que corre y falla sale 1; una omisión crítica sale 0 con un veredicto
 * de CIERRE INCOMPLETO. Los worktrees ordinarios no reciben credenciales de
 * producción y volverlos rojos por diseño haría rutinario ignorar el rojo. El
 * exit 0 tampoco autoriza aprobación: el veredicto obliga a conseguir la
 * medición o una excepción explícita antes de presentar el cierre como completo.
 *
 * Un paso que el watchdog corta por COLGADO/TIMEOUT (SDD-0454) es un FALLO con
 * motivo, nunca una omisión: corrió y no terminó. Sale 1 como cualquier fallo
 * y el motivo viaja hasta la línea final.
 *
 * Un paso con COBERTURA PARCIAL (SDD-0470) corrió, pero dejó sin medir una
 * parte declarada con motivo. Hoy es el e2e sin Supabase público: los specs que
 * lo necesitan se omiten. Se clasifica igual que una omisión: si el paso es
 * crítico, el cierre queda INCOMPLETO. El exit sigue la regla de las
 * omisiones: 0 sin fallos y 1 con fallos. Nunca se presenta como TODO VERDE.
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
  "pending-migration-symbols": Object.freeze({
    critical: true,
    reason:
      "Cruza los simbolos que el codigo invoca contra las migraciones declaradas pendientes: es lo unico que impide que llegue a main codigo que depende de una RPC o tabla ausente en produccion. Sin medirlo, el cierre no prueba nada sobre ese riesgo.",
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

/**
 * Un fallo es el nombre del paso o `{ name, reason }`. El motivo lo pone quien
 * sabe por qué no hay un exit que citar —hoy, el watchdog ante un paso
 * COLGADO— y viaja hasta la línea final, para que el cierre no dependa de
 * encontrar el [FAIL] anterior.
 */
function normalizeFailures(failures) {
  return failures.map((failure) =>
    typeof failure === "string"
      ? { name: failure, reason: null }
      : { name: failure?.name, reason: failure?.reason ?? null },
  );
}

const failureLabel = (failure) =>
  failure.reason ? `${failure.name} [${failure.reason}]` : failure.name;

function assertKnownResults(stepNames, skipped, failures, partial) {
  const known = new Set(stepNames);
  const resultNames = [
    ...skipped.map((step) => step.name),
    ...failures.map((failure) => failure.name),
    ...partial.map((step) => step?.name),
  ];
  const unknown = [...new Set(resultNames.filter((name) => !known.has(name)))];
  const repeatedSkipped = duplicates(skipped.map((step) => step.name));
  const blankReasons = failures
    .filter((failure) => failure.reason !== null && !String(failure.reason).trim())
    .map((failure) => failure.name);
  if (unknown.length > 0) throw new Error(`resultados de pasos desconocidos: ${unknown.join(", ")}`);
  if (repeatedSkipped.length > 0) {
    throw new Error(`pasos omitidos duplicados: ${repeatedSkipped.join(", ")}`);
  }
  if (blankReasons.length > 0) {
    throw new Error(`fallos con motivo vacío: ${blankReasons.join(", ")}`);
  }
  const partialNames = partial.map((step) => step.name);
  const repeatedPartial = duplicates(partialNames);
  const skippedNames = new Set(skipped.map((step) => step.name));
  const skippedAndPartial = partialNames.filter((name) => skippedNames.has(name));
  const blankPartial = partial
    .filter((step) => typeof step.reason !== "string" || !step.reason.trim())
    .map((step) => step.name);
  if (repeatedPartial.length > 0) {
    throw new Error(`pasos con cobertura parcial duplicados: ${repeatedPartial.join(", ")}`);
  }
  if (skippedAndPartial.length > 0) {
    throw new Error(`pasos a la vez omitidos y con cobertura parcial: ${skippedAndPartial.join(", ")}`);
  }
  if (blankPartial.length > 0) {
    throw new Error(`coberturas parciales sin motivo: ${blankPartial.join(", ")}`);
  }
}

function omittedSuffix(noncriticalMissing) {
  return noncriticalMissing.length > 0
    ? ` También sin medir, no críticos: ${noncriticalMissing.join(", ")}.`
    : "";
}

const partialLabel = (step) => `${step.name} [${step.reason}]`;

function partialSuffix(noncriticalPartial) {
  return noncriticalPartial.length > 0
    ? ` También con cobertura parcial, no críticos: ${noncriticalPartial.map(partialLabel).join(", ")}.`
    : "";
}

/** «CRÍTICOS SIN MEDIR: …. CRÍTICOS CON COBERTURA PARCIAL: …», o vacío. */
function criticalGaps(criticalMissing, criticalPartial) {
  const parts = [];
  if (criticalMissing.length > 0) parts.push(`CRÍTICOS SIN MEDIR: ${criticalMissing.join(", ")}.`);
  if (criticalPartial.length > 0) {
    parts.push(`CRÍTICOS CON COBERTURA PARCIAL: ${criticalPartial.map(partialLabel).join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * Devuelve la única línea final y el exit correspondiente a la evidencia.
 * `partial` (SDD-0470) lista `{ name, reason }` de pasos que corrieron con
 * cobertura parcial declarada. Sin parciales, los mensajes son los de siempre.
 */
export function buildVerifyVerdict({ stepNames, skipped, failures, partial = [] }) {
  const failed = normalizeFailures(failures);
  assertKnownResults(stepNames, skipped, failed, partial);
  const criticalMissing = skipped
    .map((step) => step.name)
    .filter((name) => STEP_POLICY[name].critical);
  const noncriticalMissing = skipped
    .map((step) => step.name)
    .filter((name) => !STEP_POLICY[name].critical);
  const criticalPartialSteps = partial.filter((step) => STEP_POLICY[step.name].critical);
  const noncriticalPartialSteps = partial.filter((step) => !STEP_POLICY[step.name].critical);
  const criticalPartial = criticalPartialSteps.map((step) => step.name);
  const noncriticalPartial = noncriticalPartialSteps.map((step) => step.name);
  const measured = stepNames.length - skipped.length;
  const gaps = criticalGaps(criticalMissing, criticalPartialSteps);
  const evidence = { criticalMissing, noncriticalMissing, criticalPartial, noncriticalPartial };

  if (failed.length > 0) {
    return {
      kind: "failed",
      tone: "fail",
      exitCode: 1,
      ...evidence,
      message:
        `verify: ${failed.length} fallo(s) → ${failed.map(failureLabel).join(", ")}` +
        (gaps ? ` CIERRE ADEMÁS INCOMPLETO — ${gaps}` : "") +
        omittedSuffix(noncriticalMissing) +
        partialSuffix(noncriticalPartialSteps),
    };
  }

  if (gaps) {
    const partialNote = partial.length > 0
      ? `, con cobertura parcial: ${partial.map((step) => step.name).join(", ")}`
      : "";
    return {
      kind: "critical-unmeasured",
      tone: "warn",
      exitCode: 0,
      ...evidence,
      message:
        `verify: CIERRE INCOMPLETO — ${gaps}` +
        omittedSuffix(noncriticalMissing) +
        partialSuffix(noncriticalPartialSteps) +
        ` No hubo fallos en lo medido (${measured}/${stepNames.length}${partialNote}); ` +
        "exit 0 NO equivale a cierre verde completo.",
    };
  }

  if (noncriticalMissing.length > 0 || noncriticalPartialSteps.length > 0) {
    const segments = [];
    if (noncriticalMissing.length > 0) {
      segments.push(`no críticos sin medir: ${noncriticalMissing.join(", ")}`);
    }
    if (noncriticalPartialSteps.length > 0) {
      segments.push(`no críticos con cobertura parcial: ${noncriticalPartialSteps.map(partialLabel).join(", ")}`);
    }
    return {
      kind: "noncritical-unmeasured",
      tone: "warn",
      exitCode: 0,
      ...evidence,
      message:
        `verify: SIN FALLOS, COBERTURA PARCIAL — ${segments.join("; ")} ` +
        `(${measured}/${stepNames.length} pasos medidos).`,
    };
  }

  return {
    kind: "complete",
    tone: "ok",
    exitCode: 0,
    ...evidence,
    message: `verify: TODO VERDE ✓ (${measured}/${stepNames.length} pasos medidos)`,
  };
}
