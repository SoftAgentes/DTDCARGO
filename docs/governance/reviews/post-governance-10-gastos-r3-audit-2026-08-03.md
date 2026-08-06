# REV-SGE-057 — Auditoría R3 de anulación de Gastos

| Control | Valor |
|---|---|
| Fecha | 2026-08-03 |
| Base | `origin/main@b78a686336aedadc24cd7a508ae54d788f8c2243` |
| Carril | `codex/post-governance-10-slices` |
| Módulo | Gastos · `BE` |
| Flujo | `Eliminar gasto` · Studio y consumidor móvil del mismo dominio |
| Modo | auditoría estática read-only; sin Cloud, Producción ni PII |
| Resultado | brechas comprobadas; slice SDD-0243 propuesto; cobertura sin cambio |

## 1. Selección y frontera

Se eligió exclusivamente Gastos porque existe una acción financiera real que
oculta el gasto y neutraliza su asiento. El alcance no incluye otros módulos,
ni convierte los 18 `BE` en defectos. El consumidor móvil se incluye como una
segunda entrada al mismo dominio: omitirlo dejaría un bypass directo a la misma
tabla y rompería la garantía del futuro RPC.

Adjuntos, antivirus, retención, restore drill y disposición de Storage quedan
fuera. La propuesta conserva las referencias del recibo y no borra objetos.

## 2. Recorrido observado

| Capa | Evidencia | Resultado |
|---|---|---|
| UI Studio | `ExpenseRowActions.tsx:54-66,120-153` | confirmación inline; envía solo `expenseId`; toast + refresh |
| Action Studio | `actions.ts:321-353` | gate de módulo y período; `deleted_at` primero; asiento best-effort después |
| Validación | `actions.ts:321-343` | no existe motivo, request ref ni validador del ID; un no-encontrado puede continuar |
| Librería | `expense-posting.ts:218-235` | la anulación contable devuelve `{ok:false}` sin throw; el caller ignora el resultado |
| Tabla/RLS | `0047_expenses.sql:22-39,99-136` y `0074_expenses_scope_fx.sql:84-124` | `expenses` conserva la fila, pero roles amplios pueden hacer UPDATE directo |
| Auditoría | `0290_audit_d2_financial_domain.sql:20-28,73-99,133-169` | `journal_entries` está cubierto; `expenses` no forma parte de D2 ni crea evento propio |
| Respuesta | `actions.ts:345-353` | devuelve éxito aunque la neutralización contable falle |
| Móvil | `app/m/erp/actions.ts:355-406` y `MobileErpClient.tsx:3143-3191` | repite soft-delete + best-effort y agrega cleanup físico del recibo |
| Pruebas | búsqueda focalizada del 2026-08-03 | existe suite del helper contable, no del recorrido de anulación/UI/action/RPC |

La lista activa excluye `deleted_at` mediante
`lib/studio/expense-queries.ts:138-180`, por lo que el resultado visible es que
la fila desaparece aunque el asiento pudiera seguir vivo.

## 3. Brechas comprobadas

1. **Atomicidad:** `expenses.deleted_at` y `journal_entries.status` ocurren en
   fronteras separadas; el segundo fallo no revierte el primero.
2. **Auditoría:** no existe evento obligatorio `expense_voided` con actor,
   motivo, before/after y correlación.
3. **Permanencia:** el verbo y la columna expresan P2, aunque el hecho ya es
   financiero y MP-01 exige P3/R3.
4. **Fricción:** no hay motivo obligatorio ni permiso especial; el diálogo no
   nombra consecuencia ni conserva error en contexto.
5. **Backend:** el ID no se valida y el UPDATE directo sigue disponible bajo RLS;
   el segundo consumidor móvil evita cualquier garantía exclusiva de Studio.
6. **Estado verdadero:** Studio puede anunciar “eliminado” mientras el asiento
   continúe `asentado`.
7. **Archivos:** Móvil intenta borrar el recibo luego del soft-delete, fuera de
   un contrato P4/versionado y sin atomicidad con la mutación financiera.

No se comprobó pérdida de datos en Producción, un fallo real de auditoría ni un
asiento huérfano existente. Son riesgos demostrables por el contrato del código,
no afirmaciones sobre filas productivas.

## 4. Clasificación del estado actual

| Política | Versión | Riesgo | Clasificación | Evidencia resumida |
|---|---:|---:|---|---|
| SGE-00 | 1.0 | R3 | no conformidad | .03/.04/.07: fricción, auditoría y verdad del éxito insuficientes |
| MP-01 | 1.1 | R3 | no conformidad | gasto financiero tratado como P2; sin motivo ni permiso especial |
| BTN-01 | 1.1 | R3 | no conformidad | `Eliminar` describe mal P3 y la decisión final no expresa consecuencia |
| HTD-01 | 1.0 | R3 | no aplica al legado actual | no fue adoptada; SDD-0243 propone usarla, sin elevarla transversalmente |
| AUD-01 | 1.0 | R3 | no conformidad | mutación y evento no son una operación; no hay evento del gasto |
| AUD-02 | 1.0 | R3 | no aplica | el flujo no consulta, retiene ni exporta logs |
| ERR-01 | 1.0 | R3 | no conformidad | el error de transacción depende de toast o copy local y no corrige el éxito parcial |
| FRM-01 | 1.1 | R3 | no conformidad | no existe campo ni validación de motivo |
| LOD-01 | 1.0 | R3 | cumplimiento parcial | UI bloquea repetición, pero pending no garantiza resultado durable |
| A11Y-01 | 1.1 | R3 | no conformidad | menú Studio sin patrón ARIA completo; confirmaciones inline sin foco seguro |
| CMP-01 | 1.1 | R3 | no conformidad | no reutiliza `ConfirmDialog` canonical para la misma necesidad |
| UPL-01 | 1.0 | R3 | no aplica al slice | la corrección no debe operar archivos; el cleanup actual se retira del recorrido |
| NUM-01 | 1.1 | R3 | no aplica | no se modifican montos |
| IA-01 | 1.0 | R3 | no aplica | no interviene IA |

No se registra excepción. AVS-01 permanece como contrato histórico verificado y
se aplica mediante el `ConfirmDialog` canónico; no se reabre como política.

## 5. Slice mínimo

SDD-0243 propone un único contrato de anulación para Studio y Móvil:

- capability `void_expense` para `accounting` + admin;
- RPC transaccional con motivo, request ref, tenant, rol, período y lock;
- anulación conjunta del gasto y asiento, más eventos AUD-01;
- trigger que impide la transición directa;
- `ConfirmDialog` canonical en ambos consumidores;
- referencias de recibo preservadas, sin tocar Storage.

El allowlist exacto y las pruebas de aceptación están en SDD-0243 §§5–6. El
basename `0340_expense_void_governance` es provisional hasta revalidar todas las
refs; cualquier aplicación productiva exige autorización individual por ese
basename vigente.

## 6. Cobertura y gates

- Gastos permanece `BE`: una auditoría con no conformidades no es evidencia de
  adopción verificada.
- No se modifica LB-SGE-106 ni la matriz histórica REV-SGE-050.
- Los ocho `NA+BE` no fueron abiertos; su smoke sigue uno por uno y por rol.
- E5 no fue abierto ni se creó lote; no hubo preflight nuevo con elegibilidad.
- Cloud, Vercel y Producción no fueron consultados ni modificados.
- PLG-01 validó `read-only · 27 políticas · 4 componentes` antes de la auditoría.

## 7. Estado de la reserva

`pnpm sdd:next` encontró SDD `0243` y migración `0340` libres sobre 101 refs.
El mecanismo preparó el commit de reserva sin tocar la rama; el stub fue
incorporado localmente. Como no existe autorización de push, SDD-0243 todavía
no está reservado globalmente y debe revalidarse antes de implementar.
