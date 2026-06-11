---
sdd: "0067"
title: "Aceptación con evidencia reforzada (SDD-B del handoff legal) — 2 checkboxes + user_agent + atadura a factura + export de evidencia"
status: done
author: "handoff Claude Chat (capa legal) + Claude Code"
created: 2026-06-10
updated: 2026-06-11
supersedes: null
superseded_by: null
related: ["0054", "0042", "0021"]
confidencialidad: interno
---

# DTD-0067 — Aceptación con evidencia reforzada (SDD-B)

> Primera spec de la capa legal del handoff (`docs/legal/HANDOFF_CAPA_LEGAL.md` §SDD-B,
> orden B → C → A → E → D). **SDD-0054 ya construyó ~80%**: `legal_docs` versionado,
> `legal_acceptances` append-only server-sellada (hash SHA-256 + ip + server-time),
> gate AUT-04 en Facturación (modo ADVISORY, `LEGAL_GATE_HARD_BLOCK=false`) y el flujo
> de aceptación del Portal (Opción B: factura borrador → cliente acepta monto exacto).
> Esta spec implementa SOLO el delta del handoff. Branch: `feat/capa-legal`.

## 1. Resumen en una línea

Subir la aceptación del Portal al estándar probatorio del handoff: modal con los **2
checkboxes literales** de `COPY_LEGAL_UI.md §1`, evidencia con **`user_agent`** y
**declaración de comerciante** dentro del hash (v2), **atadura forense a la factura**
(`invoice_id`), y **export de evidencia JSON + vista imprimible** desde `/studio/legal`.

## 2. Por qué

- Handoff SDD-B exige: tabla con `user_agent` (hoy no existe la columna), modal de
  2 checkboxes (hoy hay 1: falta la declaración de comerciante, cláusula 1.4 del
  Acuerdo v3), y "export de evidencia: PDF/JSON del registro de aceptación de un
  cliente/operación (para abogado en caso de reclamo)".
- Estado real verificado en prod (2026-06-10): `legal_acceptances` tiene **0 filas** y
  NO tiene `user_agent` → se puede subir el formato de evidencia a **v2 sin
  compatibilidad hacia atrás** (no hay filas v1 que preservar). Ventana que se cierra
  apenas un cliente acepte: hacerlo AHORA.
- DoD del handoff: "Imposible confirmar cotización sin aceptación registrada (con
  hash/IP/versión)" — el flip a bloqueo duro ya existe (`LEGAL_GATE_HARD_BLOCK`) y
  queda en manos del founder; esta spec lo hace visible para que no se olvide.

## 3. Decisiones ancladas

1. **Evidencia v2 (breaking limpio, 0 filas en prod).** `hashEvidence` pasa de `v:1` a
   `v:2`; el payload canónico suma `user_agent` (saneado, null si vacío) y
   `merchant_declaration: true` (la declaración de comerciante FORMA PARTE de lo
   aceptado → entra al hash). `invoice_id` es metadato forense, **NO entra al hash**
   (la granularidad de re-aceptación sigue siendo la ORDEN/`quote_code` — decisión
   M-1 de 0054 round 2: re-emisión de factura del mismo shipment comparte aceptación).
2. **Copy literal con fallback pre-v3.** `COPY_LEGAL_UI.md §1` está redactado para el
   Acuerdo v3 (aún no publicado — eso es SDD-A). Mientras los vigentes sean
   `tyc v2.1 + operador v1.4`: el checkbox 1 lista los documentos vigentes reales por
   nombre+versión (mismo template, nombres desde `legal_docs`); el checkbox 2 se
   muestra SIEMPRE pero el sufijo "(cláusula 1.4)" solo se renderiza cuando el set
   vigente incluya el acuerdo v3 (key `acuerdo-servicios`). Cuando SDD-A publique v3,
   el modal queda EXACTAMENTE como el copy literal sin tocar código. (DESIGN-CHECK
   registrado acá: es adaptación mínima, no reescritura del copy.)
3. **Ambos checkboxes obligatorios** con fieldError individual (patrón
   `useActionState` + validación manual, sin Zod). El estado de cada checkbox viaja a
   la action y la declaración queda en la evidencia.
4. **`user_agent` server-side**: se lee de `headers()` en la action (NUNCA del body del
   form — el cliente no escribe su propia evidencia). Truncado a 512 chars, vacío → null.
5. **Export de evidencia (V1 = JSON + imprimible, sin dependencia de PDF):**
   - Route handler fino `app/api/studio/legal/evidence/[code]/route.ts` (admin-only,
     mismo gating que `/studio/legal`; usa `apiError()` de `lib/http/api-error.ts`)
     → descarga JSON: fila completa + docs aceptadas + `hash_verified` (recomputado
     server-side con `hashEvidence`) + datos del cliente (nombre, markbox) + metadata
     de export (`exported_at`, `exported_by`).
   - Vista imprimible `app/studio/(app)/legal/evidencia/[code]/page.tsx` (server,
     admin-only, print-friendly: encabezado DTD Cargo, todos los campos de evidencia,
     verificación de integridad, lista de docs con versión) → "PDF" = imprimir del
     navegador. Botones "Descargar JSON" + "Imprimir" en el modal de Evidencia
     existente de `LegalClient`.
   - Export por OPERACIÓN: el mismo route handler acepta `?quote=<code>` para devolver
     TODAS las aceptaciones de una orden (array, mismo formato).
6. **Banner de modo del gate** en `/studio/legal`: leyenda visible "Gate de facturación
   DDP: ADVISORY (no bloquea)" vs "BLOQUEO DURO activo", leyendo la constante
   `LEGAL_GATE_HARD_BLOCK` exportada desde un módulo compartible (moverla de
   `facturacion/actions.ts` a `lib/studio/legal/gate-config.ts` y reexportar para no
   romper imports). El flip sigue siendo decisión founder (1 línea).
7. **Migración `0120_acceptance_evidence_v2.sql` — aditiva**: `alter table
   legal_acceptances add column user_agent text, add column merchant_declaration
   boolean not null default false, add column invoice_id uuid references
   invoices(id) on delete set null;` + índice `(tenant_id, invoice_id)` parcial where
   invoice_id is not null. ⚠️ El trigger de inmutabilidad es BEFORE UPDATE OR DELETE
   por fila — el ALTER TABLE no lo dispara (DDL ok). NO se aplica a prod en esta
   corrida (la aplica el founder; con 0 filas es instantánea).
8. **No tocar**: la máquina de estados de `invoices`, el flujo Opción B, la semántica
   re-versión⇒re-aceptación ni la granularidad por orden. **No** publicar v3 (SDD-A).
   **No** flipear `LEGAL_GATE_HARD_BLOCK` (founder).

## 4. Approach

### Migración `supabase/migrations/0120_acceptance_evidence_v2.sql`
Como decisión #7. Comentario en el SQL: evidencia v2 = primer formato productivo
(v1 nunca llegó a prod con filas).

### `lib/studio/legal/` (núcleo)
- `types.ts`: `AcceptanceInput` suma `user_agent: string | null`,
  `merchant_declaration: boolean`, `invoice_id: string | null` (los 2 primeros entran
  a `acceptanceHashPayload`; `invoice_id` NO). `validateAcceptanceInput` exige
  `merchant_declaration === true` (sin declaración no hay aceptación válida).
- `seal.ts`: `hashEvidence` v2 (bump `v:1` → `v:2`, payload con `user_agent` +
  `merchant_declaration`). `sealAcceptance(input, docs, ip, userAgent, now)` — firma
  nueva, sanea user_agent (trim, 512 max, vacío → null).
- `queries.ts`: `acceptanceRowValid` recomputa el hash v2 desde la fila (lee
  `user_agent`/`merchant_declaration` de la fila; fail-closed si el recompute no
  matchea — igual que hoy). `listAcceptances` expone los campos nuevos. Nueva
  `getAcceptanceEvidence(supabase, {tenantId, code})` → fila + verificación + cliente
  (para el export y la vista imprimible); y variante por `quote_code` (array).
- `gate-config.ts` (nuevo): `export const LEGAL_GATE_HARD_BLOCK = false` + comentario
  del flip founder. `facturacion/actions.ts` la importa de acá.

### Portal (productor de evidencia)
- `app/portal/(app)/facturas/[code]/aceptar/page.tsx` + `AcceptanceForm`: copy del
  modal según `COPY_LEGAL_UI.md §1` con la decisión #2 (título, cuerpo con link al
  doc completo, checkbox 1 con docs vigentes, checkbox 2 declaración de comerciante,
  botón "Aceptar y confirmar cotización", texto probatorio bajo botones). Copy de
  re-aceptación (§1 último bloque) cuando la causa es nueva versión: detectar si el
  cliente tiene aceptaciones previas de la misma orden con docs ya no vigentes →
  mostrar el aviso "Actualizamos nuestro Acuerdo…".
- `actions.ts` (`registerAcceptanceAction`): lee `user-agent` de `headers()`, valida
  los 2 checkboxes (fieldErrors), pasa `merchant_declaration` + `user_agent` +
  `invoice_id` al sello/insert. Idempotencia intacta (`unique(tenant, hash)`).

### Studio (consumidor/exportador)
- `LegalClient` (`/studio/legal`): banner de modo del gate (decisión #6); el modal de
  Evidencia muestra user_agent + declaración + invoice; botones "Descargar JSON" y
  "Imprimir expediente".
- Route handler + página imprimible (decisión #5).

### Tests (Vitest, en `lib/studio/legal/__tests__/` + portal)
- Hash v2: determinístico; user_agent/merchant_declaration cambian el hash; orden de
  docs sigue sin cambiar el hash; `invoice_id` NO cambia el hash.
- `validateAcceptanceInput`: rechaza `merchant_declaration=false`.
- Round-trip actualizado: sello v2 → `hasValidAcceptanceForMarkbox` true; fila v2 con
  user_agent alterado post-hoc → hash no matchea → gate false (evidencia load-bearing).
- `getAcceptanceEvidence`: hash_verified true/false; por quote_code devuelve todas.
- Action: sin checkbox 2 → fieldError, no insert (stub).

## 5. Acceptance

- [x] Migración `0120` aditiva limpia (user_agent, merchant_declaration, invoice_id +
      índice). NO aplicada a prod por el harness.
- [x] Evidencia v2: hash cubre user_agent + merchant_declaration; tests verdes
      incluyendo round-trip y manipulación post-hoc.
- [x] Portal: modal con los 2 checkboxes literales (fallback pre-v3 documentado),
      ambos obligatorios con fieldError; user_agent capturado server-side; copy de
      re-aceptación por nueva versión.
- [x] `/studio/legal`: banner de modo del gate + export JSON (single + por operación)
      + vista imprimible, todo admin-only.
- [x] `node scripts/verify.mjs` 🟢 (gate completo, 1570 tests).
- [x] Sin cambios en: máquina de estados de invoices, granularidad por orden,
      `LEGAL_GATE_HARD_BLOCK` (sigue false), publicación de v3.

## 7. Notas de implementación (cierre 2026-06-11)

- Shipped vía harness en branch `feat/capa-legal` (worktree aislado): implementer →
  gate 🟢 (1570 tests, +56) → reviewer **APPROVED en 1 ronda** (checklist C1–C8 en
  `.harness/progress/review_0067.md`; 0 bloqueantes, 4 menores).
- Auditoría crítica del reviewer: hash v2 load-bearing con UNA sola `hashEvidence`
  para sello/gate/export (cero drift) · fila manipulada post-hoc ⇒ gate false
  (probado para UA mutado/null y declaración flipeada) · user_agent JAMÁS del
  FormData (test con campo forjado) · export admin-only con client de SESIÓN
  (RLS on) + tenant explícito · copy literal cotejado string-exacto contra
  COPY_LEGAL_UI §1 (set v3) + fallback pre-v3.
- Review ui-ux (post-APPROVED, regla founder): 0 bloqueantes; se aplicaron 7 fixes
  (hover de bitácora vía clase `.studio-row-btn` — inline background pisaba el
  hover · región de T&C operable por teclado WCAG 2.1.1 · aria-invalid/describedby
  + role=alert en los 2 checkboxes · Evidencia del modal en UTC como el expediente
  · voseo "Pediles"→"Pídele" · overflowWrap anywhere en valores impresos ·
  `#fff`→`var(--color-white)`).
- Hallazgos menores aceptados (sin acción, documentados por el reviewer): con
  `?quote=` el `[code]` de la URL del export se ignora (decisión #5) · el aviso de
  re-aceptación no verifica hash (informativo; la verdad la imponen gate+pre-check)
  · pre-check de idempotencia corre antes de validar checkboxes (UX correcta).
- **Pendiente founder (gates de activación):** (1) aplicar `0120` a prod ANTES de
  deployar este código — el gate y la bitácora seleccionan las columnas nuevas;
  (2) flip de `LEGAL_GATE_HARD_BLOCK` (lib/studio/legal/gate-config.ts) cuando
  haya adopción → recién ahí se cumple el DoD "imposible confirmar sin aceptación".

## 6. Fuera de alcance (respetar)

- SDD-C recibos de cobranza, SDD-A `/terminos` + publicación del Acuerdo v3, SDD-E
  expediente operativo completo (fotos/POD), SDD-D rendición — specs siguientes.
- Notificación al cliente de aceptación pendiente (gap conocido de 0054, sigue).
- PDF server-side generado (V1 = imprimible del navegador; si el abogado exige PDF
  firmado, se evalúa en SDD-E con el expediente completo).
- Aplicar migración a prod / flip del gate (founder).
