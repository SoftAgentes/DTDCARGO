# REV-SGE-030 — Auditoría R3 de Nómina: anulación de finiquito

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Base | `origin/main` `47fdda2072a4fdc1c4cf142abd9ac6fd58076067` |
| Superficie | Studio ERP |
| Módulo | Nómina y RRHH |
| Flujo | `finiquito confirmado → anulado` |
| Riesgo | R3 · legal, financiero, PII y permanencia |
| Modo | auditoría read-only; cero cambios de producto |
| Resultado | siete no conformidades comprobadas; slice correctivo propuesto |

## 1. Alcance y límites

La muestra se restringe a una sola decisión irreversible: **anular un finiquito
confirmado** y neutralizar su asiento contable asociado. La selección prioriza
esta transición porque modifica simultáneamente evidencia laboral, una provisión
contable y la posibilidad de generar un nuevo finiquito para el empleado.

La revisión trazó UI, Server Action, queries, RBAC, persistencia, asiento,
auditoría y pruebas locales disponibles. No leyó PII ni llamó Cloud, Auth,
Supabase Producción, Vercel o servicios externos.

No se observaron sesiones autenticadas, doble ejecución real, fallo inducido de
DB, teclado completo, lector de pantalla, zoom 200 %, viewport móvil, red lenta
ni comportamiento en Producción. La ausencia de esa evidencia no se convierte
en cumplimiento.

## 2. Inventario R3 acotado

| Acción real | Efecto | Clasificación preliminar |
|---|---|---|
| Marcar corte `pagado` | Sella `paid_at`, pero no ejecuta una transferencia | R3 por declaración financiera |
| Confirmar finiquito | Formaliza el cálculo y crea una provisión contable | R3/P3 |
| Anular finiquito confirmado | Neutraliza asiento, cambia evidencia laboral y habilita regeneración | **R3/P3 seleccionado** |
| Anular amonestación | Conserva el acta y cambia su estado | R3/P3, fuera de muestra |
| Registrar pago de prestador | Asienta un hecho monetario | R3/P3, fuera de muestra |

La acción seleccionada no declara conforme o no conforme el módulo completo.

## 3. Recorrido técnico comprobado

| Frontera | Evidencia |
|---|---|
| UI | `FiniquitoDetalle.tsx:156-164` ejecuta `anularFiniquitoAction(settlement.id)` directamente desde un botón danger. No abre diálogo ni captura motivo. |
| Estado UI | `FiniquitoDetalle.tsx:72-79` usa `useTransition`, muestra errores en contexto y vuelve al listado cuando la respuesta no trae `error`. |
| Server Action | `actions.ts:1583-1613` aplica `moduleEditDenial`, lee el finiquito, anula primero el asiento y después actualiza el finiquito. |
| Lectura tenant | `settlement-queries.ts:75-90` obtiene el finiquito mediante el cliente autenticado y RLS. |
| Permiso | `rbac.ts:113-115` permite Nómina a `accounting`; `rbac-guard.ts:109-120` valida edición del módulo, no una capability de anulación. |
| Asiento | `settlement-posting.ts:174-185` usa cliente admin y actualiza `journal_entries.status='anulado'` sin motivo humano. |
| Persistencia | `0179_nomina_settlements.sql:116-135` modela estado y vínculo al asiento; `:149-153` libera el índice al anular. |
| RLS | `0179_nomina_settlements.sql:257-289` concede `update/delete` y una policy `for all` a `admin/accounting`; no restringe transiciones ni columnas. |
| Auditoría disponible | `0294_audit_d2_human_reasons.sql:115-140` ya ofrece `void_journal_entry_with_audit_reason(uuid,text)` con motivo dentro de la transacción. |
| Auditoría ejecutada | `0290_audit_d2_financial_domain.sql:133-169` audita cambios del asiento; con cliente admin el actor queda `system` (`:90-91`) y el motivo cae en el genérico del trigger. |
| Pruebas disponibles | `0294_audit_d2_human_reasons.test.sql:170-223` demuestra actor y motivo; `:290-311` demuestra rollback si falla auditoría. El flujo de Nómina no usa ese RPC. |

## 4. Evidencia favorable existente

- El verbo visible es `Anular`, coherente con P3.
- La fila del finiquito se conserva; no hay purga física.
- La lectura inicial está acotada por tenant y rol mediante RLS.
- `canTransitionSettlement()` rechaza transiciones fuera del lifecycle declarado.
- La UI deshabilita los botones mientras la promesa está pendiente y conserva
  el error en un `role="alert"`.
- Existe una infraestructura financiera ya verificada para motivo humano,
  actor, correlación y rollback por fallo del writer de auditoría.
- Existe `ConfirmDialog` canonical con `reasonRequired`, error persistente,
  `holdToConfirm` y alternativa accesible; el flujo todavía no lo consume.

Estas fortalezas reducen el tamaño del slice, pero no cierran las brechas.

## 5. Hallazgos

| ID | Riesgo | Hallazgo | Clasificación |
|---|---|---|---|
| PAY-R3-001 | crítico | El botón `Anular` ejecuta de inmediato. No muestra entidad, consecuencia, asiento afectado ni exige motivo. | `no conformidad` · MP-01, BTN-01, FRM-01 |
| PAY-R3-002 | crítico | SDD-0109 reserva la anulación al admin, pero `moduleEditDenial("nomina")` permite también `accounting`; no existe capability específica. | `no conformidad` · SGE-00.05, MP-01 |
| PAY-R3-003 | crítico | El flujo evita `void_journal_entry_with_audit_reason`, usa service role y produce actor `system` con motivo genérico. El cambio del finiquito no tiene evento AUD-01 propio. | `no conformidad` · SGE-00.04, AUD-01 |
| PAY-R3-004 | crítico | El asiento se anula antes que el finiquito en dos operaciones sin transacción. Si la segunda falla, queda asiento anulado y finiquito confirmado, sin compensación durable. | `no conformidad` · SGE-00.02/.07, AUD-01 |
| PAY-R3-005 | alto | La DB no impone lifecycle ni inmutabilidad: un cliente `accounting` puede actualizar directamente el estado/campos del finiquito y modificar o borrar renglones confirmados. | `no conformidad` · SGE-00.05, MP-01 |
| PAY-R3-006 | alto | El `UPDATE ... WHERE status = s.status` no solicita filas de vuelta. Cero filas afectadas no es error y la action puede responder `{ok:true}`; doble ejecución puede anunciar éxito falso. | `no conformidad` · SGE-00.07, LOD-01, ERR-01 |
| PAY-R3-007 | alto | Solo se prueba la función pura de transición. No hay contrato SQL, test de Server Action, UI ni E2E de motivo, rol, tenant, concurrencia, fallo de auditoría o rollback de esta anulación. | `no conformidad de evidencia` · SGE-00, A11Y-01 |

No se registran excepciones. Los hallazgos pertenecen al legado observado; esta
auditoría documental no introduce regresiones nuevas.

## 6. Gate SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.01 · predecible | `no conformidad` | `Anular` es correcto, pero la consecuencia contable y la regeneración posterior no se explican antes de ejecutar. |
| SGE-00.02 · no perder trabajo | `no conformidad` | Las dos escrituras pueden divergir y no existe reconciliación durable. |
| SGE-00.03 · fricción por riesgo | `no conformidad` | R3 se ejecuta con un click sin motivo ni confirmación. |
| SGE-00.04 · auditoría | `no conformidad` | Falta evento del finiquito y el asiento pierde actor/motivo humano. |
| SGE-00.05 · permiso/tenant/estado | `no conformidad` | Tenant sí está acotado; permiso admin-only y lifecycle en DB no. |
| SGE-00.06 · prevenir errores | `no conformidad` | No hay preflight de motivo/capability ni cierre atómico del conflicto. |
| SGE-00.07 · estado visible y verdadero | `no conformidad` | Cero filas actualizadas puede devolverse como éxito. |
| SGE-00.08 · frecuencia/pasos | `no aplica` | No se midió frecuencia ni se propone reducir pasos en esta auditoría. |
| SGE-00.09 · reutilizar patrón | `no conformidad` | No usa el RPC auditado ni `ConfirmDialog` ya disponibles. |
| SGE-00.10 · accesibilidad equivalente | `no conformidad de evidencia` | El botón es nativo, pero falta el diálogo R3 y no hubo prueba manual/runtime. |
| SGE-00.11 · lenguaje accionable | `no conformidad` | La UI no comunica consecuencia ni recuperación; errores pueden incluir mensajes internos de DB. |
| SGE-00.12 · autoridad humana sobre IA | `no aplica` | El flujo no usa IA. |

## 7. Matriz de políticas

| Política | Versión | Riesgo | Clasificación | Slice recomendado |
|---|---:|---|---|---|
| SGE-00 | 1.0 | R3 | `no conformidad` | transacción gobernada + evidencia completa |
| MP-01 | 1.1 | P3/R3 | `no conformidad` | consecuencia, motivo, capability, estado y vínculo preservado |
| BTN-01 | 1.1 | R3 | `no conformidad` | `ConfirmDialog` danger; acción directa deja de ejecutar |
| HTD-01 | 1.0 | R3 | `no aplica` actual | evaluar `holdToConfirm`; es opcional y no sustituye backend/auditoría |
| AUD-01 | 1.0 | R3 | `no conformidad` | un RPC atómico escribe mutación y eventos con actor/motivo/correlación |
| ERR-01 | 1.0 | R3 | `no conformidad` | códigos seguros, conflicto explícito y recuperación sin éxito falso |
| FRM-01 | 1.1 | R3 | `no conformidad` | motivo obligatorio validado en UI y servidor |
| LOD-01 | 1.0 | R3 | `no conformidad` | pending real, deduplicación servidor y resultado durable |
| NUM-01 | 1.1 | — | `no aplica` | la anulación no edita montos |
| A11Y-01 | 1.1 | R3 | `no conformidad de evidencia` | foco seguro, error persistente, teclado, 200 %, móvil y alternativa a HTD |

## 8. Slice mínimo propuesto

**SDD candidata:** `SDD-0225 — Anulación gobernada de finiquito de Nómina`.

Objetivo: sustituir las dos escrituras best-effort por una sola frontera de DB
que, en la misma transacción:

1. autentique tenant y exija capability admin-only;
2. bloquee el finiquito con `FOR UPDATE` y valide `confirmado`;
3. valide motivo humano y correlation/idempotency key;
4. anule el asiento conservando `journal_entry_id` como vínculo histórico;
5. cambie el finiquito a `anulado`;
6. escriba eventos del asiento y del finiquito con actor, motivo, antes/después y
   la misma correlación;
7. aborte todo si falla cualquier guarda o evento;
8. rechace actualizaciones directas que evadan el lifecycle.

La UI debe abrir `ConfirmDialog` canonical con consecuencia concreta, motivo
obligatorio, `danger`, pending y error persistente. `holdToConfirm` se decide en
la SDD como fricción adicional opcional; siempre conserva la alternativa de
checkbox + click.

## 9. Allowlist exacta candidata para implementación

Antes de abrir el slice se debe revalidar `origin/main` y los correlativos,
porque otra sesión posee SDD-0224 y las migraciones 0306–0314.

- `docs/specs/0225-nomina-anulacion-finiquito-gobernada/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `app/studio/(app)/nomina/actions.ts`
- `app/studio/(app)/nomina/_components/FiniquitoDetalle.tsx`
- `app/studio/(app)/nomina/_components/__tests__/FiniquitoDetalle.test.tsx`
- `lib/studio/accounting/settlement-posting.ts`
- `lib/studio/rbac.ts`
- `lib/studio/rbac.test.ts`
- `supabase/migrations/0315_nomina_settlement_void_governance.sql`
- `supabase/tests/0315_nomina_settlement_void_governance.test.sql`
- `e2e/nomina-settlement-void.spec.ts`

Cualquier ruta adicional exige detenerse y ampliar la allowlist antes de
editar. La lista no autoriza todavía implementación, migración, Cloud,
Producción, Vercel o datos reales.

## 10. Pruebas de aceptación propuestas

### Contrato SQL

- admin del tenant anula un finiquito confirmado con motivo válido;
- `accounting`, otros roles, anon y tenant ajeno fallan sin mutar;
- borrador, anulado, asiento ajeno, motivo corto y correlation inválida fallan;
- finiquito y asiento cambian juntos o ninguno cambia;
- `journal_entry_id` permanece unido al finiquito anulado;
- eventos de ambos objetos conservan actor humano, motivo y correlación común;
- fallo forzado del writer de auditoría revierte ambas mutaciones;
- doble llamada concurrente produce un solo resultado durable y la segunda
  recibe conflicto/idempotent replay, nunca éxito falso;
- update directo, borrado de renglones confirmados o cambio de totales falla.

### UI y Server Action

- click en `Anular` solo abre el diálogo;
- el diálogo nombra finiquito, empleado, monto, asiento y consecuencia;
- motivo vacío no envía; motivo válido llega intacto al servidor;
- Cancelar y Escape antes de pending producen cero solicitudes;
- pending bloquea repetición y no permite cerrar una mutación iniciada;
- error de permiso, conflicto o auditoría permanece visible y conserva motivo;
- éxito se muestra solo después de la respuesta durable.

### Runtime

- admin/accounting, teclado, lector, foco restaurado, zoom 200 %, móvil,
  light/dark y movimiento reducido;
- red lenta, offline, doble click, dos pestañas y respuesta perdida;
- verificación autenticada de que accounting no ve/ejecuta la capability si la
  decisión admin-only de SDD-0109 se conserva.

## 11. Validadores del futuro slice

```text
pnpm test <tests focalizados>
node scripts/run-sql-tests.mjs
pnpm governance:check
pnpm components:check
pnpm docs:check
git diff --check
```

Cloud, Producción y E2E autenticado mantienen autorización y evidencia
separadas. Esta revisión no demuestra que las migraciones candidatas existan o
estén aplicadas.

## 12. Decisión

La anulación de finiquito confirmado **no está lista para declararse conforme**.
La corrección es acotable a un slice R3 y puede reutilizar infraestructura ya
existente, pero requiere primero aprobar SDD-0225 y su allowlist exacta.

Nómina permanece `BE` en LB-SGE-104: revisar este flujo no certifica las demás
acciones del módulo.
