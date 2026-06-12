/**
 * Copy del modal de aceptación (SDD-0067 · decisión #2) — fuente única.
 *
 * `docs/legal/COPY_LEGAL_UI.md §1` es el copy LITERAL, redactado para el
 * Acuerdo de Servicios v3 (key `acuerdo-servicios`, lo publica SDD-A). Mientras
 * los vigentes sean otros (hoy `tyc v2.1 + operador v1.4`), este helper aplica
 * el FALLBACK pre-v3:
 *
 *  - checkbox 1 lista los documentos vigentes REALES por nombre + versión
 *    (mismo template; nombres desde `legal_docs`).
 *  - checkbox 2 (declaración de comerciante) se muestra SIEMPRE; el sufijo
 *    "(cláusula 1.4)" solo se renderiza cuando el set vigente incluye el
 *    acuerdo v3.
 *  - cuando SDD-A publique v3 (set vigente = acuerdo-servicios), el modal queda
 *    EXACTAMENTE como el copy literal de §1 SIN tocar código (lo asierta el
 *    test acceptance-copy.test.ts).
 *
 * DESIGN-CHECK (registrado en la spec): es adaptación mínima del copy, no
 * reescritura. Cambiar los textos = decisión en Claude Chat (efecto probatorio).
 *
 * PURO: sin Supabase, sin React. Lo consumen la página del Portal (server) y
 * los tests.
 */

/** Key del Acuerdo de Servicios v3 (SDD-A) en `legal_docs`. */
export const ACUERDO_SERVICIOS_KEY = "acuerdo-servicios";

/** Lo mínimo que el copy necesita de un doc vigente. */
export type AcceptanceCopyDoc = {
  key: string;
  name: string;
  version: string;
};

/** Doc vigente que cambió respecto de lo ya aceptado (re-aceptación). */
export type ChangedCopyDoc = AcceptanceCopyDoc & {
  /** effective_date (ISO date `YYYY-MM-DD`). */
  effective_date: string;
};

/** Textos del modal de aceptación, listos para renderizar. */
export type AcceptanceCopy = {
  title: string;
  body: string;
  /** Label del link al documento completo (ancla a los docs en la página). */
  readLinkLabel: string;
  checkbox1: string;
  checkbox2: string;
  submitLabel: string;
  backLabel: string;
  /** Texto probatorio bajo los botones. */
  legalFooter: string;
};

/** "v2.1" | "2.1" → "2.1" (el template pone el prefijo `v` donde toca). */
function versionNumber(version: string): string {
  return String(version ?? "")
    .trim()
    .replace(/^v/i, "");
}

/** "Nombre (vN.N)" — el item de la lista de docs del checkbox 1. */
function docLabel(d: AcceptanceCopyDoc): string {
  return `${d.name} (v${versionNumber(d.version)})`;
}

/** ["A"] → "A" · ["A","B"] → "A y B" · ["A","B","C"] → "A, B y C". */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/** "2026-07-01" → "1 de julio de 2026" (UTC fijo: sin corrimiento por TZ). */
function formatFecha(isoDate: string): string {
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(isoDate);
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * Construye el copy del modal a partir de los docs VIGENTES de cara al cliente
 * (los que el sello registra). Con el set v3 (`acuerdo-servicios`) produce el
 * copy LITERAL de COPY_LEGAL_UI.md §1; con cualquier otro set, el fallback
 * pre-v3 (mismos templates, nombres reales).
 */
export function buildAcceptanceCopy(docs: AcceptanceCopyDoc[]): AcceptanceCopy {
  const acuerdo = docs.find((d) => d.key === ACUERDO_SERVICIOS_KEY) ?? null;
  const hasAcuerdo = acuerdo != null;

  const title = hasAcuerdo
    ? "Acuerdo de Servicios DTD Cargo"
    : "Términos y Condiciones DTD Cargo";

  const body =
    hasAcuerdo && docs.length === 1
      ? `Antes de confirmar tu cotización, necesitamos tu aceptación del ${acuerdo.name} (v${versionNumber(acuerdo.version)}), que incluye la política de reembolso, la lista de mercancía prohibida y el checklist de pre-alerta.`
      : `Antes de confirmar tu cotización, necesitamos tu aceptación de los documentos vigentes: ${joinList(docs.map(docLabel))}.`;

  const checkbox1 =
    hasAcuerdo && docs.length === 1
      ? `He leído y acepto el ${acuerdo.name} de DTD Cargo (v${versionNumber(acuerdo.version)}), incluyendo sus Anexos A, B y C.`
      : `He leído y acepto los documentos ${joinList(docs.map(docLabel))} de DTD Cargo.`;

  // Checkbox 2 SIEMPRE visible; "(cláusula 1.4)" solo con el acuerdo v3 vigente.
  const checkbox2 = `Declaro que actúo como comerciante, empresa o emprendedor con fines de lucro${hasAcuerdo ? " (cláusula 1.4)" : ""}.`;

  return {
    title,
    body,
    readLinkLabel: hasAcuerdo
      ? "Leer el Acuerdo completo →"
      : "Leer los documentos completos →",
    checkbox1,
    checkbox2,
    submitLabel: "Aceptar y confirmar cotización",
    backLabel: "Volver",
    legalFooter:
      "Tu aceptación queda registrada con fecha, hora, dirección IP y huella de integridad (hash), conforme a la Ley sobre Mensajes de Datos y Firmas Electrónicas.",
  };
}

/**
 * Aviso de RE-ACEPTACIÓN por versión nueva (§1 último bloque): se muestra
 * cuando el cliente ya tiene aceptaciones previas de la MISMA orden pero con
 * docs que ya no son los vigentes (re-versión ⇒ re-aceptación). `changed` son
 * los docs vigentes que la última aceptación NO cubre.
 *
 * Con el acuerdo v3 como único cambio produce el copy literal:
 * "Actualizamos nuestro Acuerdo de Servicios a la versión {version} (vigente
 *  desde {fecha}). Para confirmar esta cotización, por favor revísalo y
 *  acéptalo nuevamente."
 */
export function buildReacceptanceNotice(changed: ChangedCopyDoc[]): string {
  if (changed.length === 0) return "";

  if (changed.length === 1 && changed[0].key === ACUERDO_SERVICIOS_KEY) {
    const d = changed[0];
    return `Actualizamos nuestro Acuerdo de Servicios a la versión ${versionNumber(d.version)} (vigente desde ${formatFecha(d.effective_date)}). Para confirmar esta cotización, por favor revísalo y acéptalo nuevamente.`;
  }

  const items = changed.map(
    (d) =>
      `${d.name} a la versión ${versionNumber(d.version)} (vigente desde ${formatFecha(d.effective_date)})`,
  );
  const tail =
    changed.length === 1 ? "revísalo y acéptalo" : "revísalos y acéptalos";
  return `Actualizamos ${joinList(items)}. Para confirmar esta cotización, por favor ${tail} nuevamente.`;
}

/** Label del link del aviso de re-aceptación ("[Ver qué cambió →]" en §1). */
export const REACCEPTANCE_LINK_LABEL = "Ver qué cambió →";
