/**
 * Poda del espejo: qué embudos y etapas borrar cuando desaparecen de Kommo.
 *
 * El problema: el sync es upsert-only. Lo único que se drena hoy es
 * `kommo_unsorted` (una cola). Pipelines y statuses nunca se borran, así que
 * el espejo acumula lo que Kommo ya eliminó. Medido en producción el
 * 2026-08-11: **12 embudos en el espejo, 11 borrados en Kommo** (la cuenta se
 * consolidó a uno solo, "Ventas DTD"), y **68 etapas huérfanas**. El
 * desplegable del Mapa de etapas ofrecía 12 opciones de las cuales 11 no
 * existían, y el Tablero pintaba pestañas de embudos muertos.
 *
 * Estas funciones son PURAS: deciden QUÉ es candidato a borrarse. El chequeo
 * de "¿tiene leads?" es I/O y vive en sync.ts, porque necesita la base.
 *
 * ── Las dos guardas, y por qué ninguna es opcional ──
 *
 * 1. **Lectura vacía ⇒ cero borrados.** Si el fetch a Kommo falla, devuelve
 *    vacío o el token pierde permisos, un `delete` de "lo que no vino" vaciaría
 *    el espejo entero. Una lista vacía no significa "Kommo no tiene embudos":
 *    significa "no sé". Se traduce en no borrar nada.
 *
 * 2. **Nunca borrar lo que todavía tiene leads espejados.** `kommo_statuses` no
 *    tiene FK a `kommo_pipelines` (migración 0082: `pipeline_id` es columna
 *    suelta), así que nada impide dejar leads apuntando a un embudo o una etapa
 *    inexistente. El Tablero los pintaría como "Etapa #1234".
 */

export type PipelineRef = { id: number };
export type StatusRef = { pipeline_id: number; id: number };

/**
 * Embudos del espejo que Kommo ya no devuelve.
 *
 * `fetched` vacío ⇒ `[]` (guarda 1). El llamador todavía debe aplicar la
 * guarda 2 (¿tiene leads?) antes de borrar.
 */
export function pipelinesToPrune(
  fetched: PipelineRef[],
  mirrored: PipelineRef[],
): number[] {
  if (fetched.length === 0) return [];
  const alive = new Set(fetched.map((p) => Number(p.id)));
  const out: number[] = [];
  for (const m of mirrored) {
    const id = Number(m.id);
    if (!alive.has(id)) out.push(id);
  }
  return out;
}

/**
 * Etapas del espejo que Kommo ya no devuelve, identificadas por
 * `(pipeline_id, id)` — que es la clave natural (migración 0083: los estados de
 * sistema 142/143 se repiten con el MISMO id en todos los embudos, así que el
 * `id` solo no distingue nada).
 *
 * `fetched` vacío ⇒ `[]` (guarda 1).
 */
export function statusesToPrune(
  fetched: StatusRef[],
  mirrored: StatusRef[],
): StatusRef[] {
  if (fetched.length === 0) return [];
  const key = (s: StatusRef) => `${Number(s.pipeline_id)}:${Number(s.id)}`;
  const alive = new Set(fetched.map(key));
  const out: StatusRef[] = [];
  for (const m of mirrored) {
    if (!alive.has(key(m))) {
      out.push({ pipeline_id: Number(m.pipeline_id), id: Number(m.id) });
    }
  }
  return out;
}
