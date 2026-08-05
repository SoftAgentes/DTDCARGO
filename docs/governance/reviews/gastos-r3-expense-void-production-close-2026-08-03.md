# REV-SGE-059 — Cierre productivo R3 de anulación de Gastos

| Control | Valor |
|---|---|
| Fecha | 2026-08-03 |
| Base de rollout | `origin/main@279bb1f1ce6d30f451e4d1ef7cb79ffd1568d0c6` |
| Implementación funcional | `fd9485773a840bd77427288339aad25fc59b5d55` |
| SDD | SDD-0243 · `done` |
| Módulo | Gastos · `VA` sólo para `Anular gasto` |
| Roles permitidos | `accounting` + `admin` |
| Migración | `0340_expense_void_governance` · aplicada individualmente |
| Resultado | Producción, despliegue compatible y smoke autenticado cerrados |

## 1. Gate nominal y preflight inmediato

El founder autorizó literalmente `0340_expense_void_governance` para
Producción. Inmediatamente antes del DDL se comprobó, sin leer filas de negocio
ni PII:

- `HEAD` y `origin/main` en `279bb1f1`, worktree limpio y divergencia `0/0`;
- ledger con 345 entradas y ausencia exacta de `0340_expense_void_governance`;
- `expenses`, `journal_entries`, `audit_entity_types`, `entity_audit_log`,
  `append_audit_event`, cierre contable y auditoría D2 presentes;
- RPC, guard, trigger y catálogo objetivo todavía ausentes;
- archivo local idéntico al blob de `origin/main`, sin colisión `0340` ni drift
  nuevo.

Se aplicó una sola migración mediante el basename exacto autorizado. No se
ejecutó ninguna migración vecina ni un bundle.

## 2. Postflight de Producción

| Control | Evidencia | Resultado |
|---|---|---|
| Ledger | 346 entradas; `20260803181231 · 0340_expense_void_governance` una vez | verde |
| RPC | `void_expense_governed(uuid,text,text)` · `SECURITY DEFINER` | presente |
| Guard | `guard_expense_void()` · `SECURITY DEFINER` | presente |
| Trigger | `guard_expense_void_trg` sobre `expenses`, habilitado `O` | presente |
| ACL RPC | `authenticated=EXECUTE`; `anon`, `service_role` y `PUBLIC` revocados | mínimo esperado |
| ACL guard | sólo owner `postgres` | mínimo esperado |
| `search_path` | vacío en RPC y guard | verde |
| AUD-01 | `expense`, dominio `finance`, versión 1, activo, introducido por `migration:0340` | verde |
| D2/RLS | trigger D2 activo; RLS activo en gastos y asientos | verde |

Los advisors de rendimiento permanecieron idénticos: 602 avisos, 483 `INFO` y
119 `WARN`. Seguridad pasó de 168 a 169 avisos: el único delta fue el linter
esperado `authenticated_security_definer_function_executable` para el RPC que
debe ser invocable por el rol autenticado. Se clasificó como advertencia
evaluada, no como defecto: `anon`, `PUBLIC` y `service_role` no ejecutan; el RPC
revalida `auth.uid()`, membresía activa, tenant, rol, estado y período. Véase la
[referencia del advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## 3. Despliegue compatible

GitHub registró el deployment productivo `5726589634` asociado exactamente a
`fd9485773a840bd77427288339aad25fc59b5d55`, con estado final `success` en
Vercel. Tanto la URL del deployment como `https://dtdcargo.com` respondieron
HTTP 200. No se ejecutó ni fue necesario autorizar un deploy manual.

## 4. Smoke autenticado controlado

El smoke usó una rama efímera de Supabase sin datos productivos, con fixture
completamente ficticio: un tenant, cuatro usuarios sintéticos por rol, cinco
gastos, cinco asientos y un documento de recibo controlado. La rama heredó las
346 migraciones, terminó saludable y fue eliminada al concluir; la lista final
de ramas confirmó únicamente `main`.

### Servidor y atomicidad

| Caso | Resultado autenticado |
|---|---|
| `accounting` | `voided` |
| replay idéntico de `accounting` | `replayed`, sin eventos duplicados |
| `admin` | `voided` |
| `operations` | denegado por servidor, sin mutación |
| `warehouse` | denegado por servidor, sin mutación |
| motivo vacío | rechazado, sin mutación |
| período cerrado | rechazado, sin mutación |

Los dos éxitos dejaron gasto anulado, asiento `anulado` y exactamente un evento
`expense_voided` más un `journal_entry_voided`, con actor, motivo y correlación
comunes. Los tres gastos rechazados conservaron gasto vivo, asiento `asentado`
y cero eventos de anulación. El replay no agregó eventos.

El gasto con adjunto conservó exactamente
`fixture/recibo-e2e-0243.pdf` y su `receipt_document_id`; no hubo cleanup de
Storage ni alteración de referencias.

### Studio y Móvil

| Rol | Studio | Móvil | Servidor |
|---|---|---|---|
| `accounting` | `Anular gasto` visible; diálogo R3 | `Anular este gasto` visible; mismo diálogo | permite |
| `admin` | `Anular gasto` visible | comparte capability y contrato | permite |
| `operations` | menú contiene sólo `Editar` | editor sin acción de anular | deniega |
| `warehouse` | menú contiene sólo `Editar` | editor sin acción de anular | deniega |

En ambas superficies el diálogo nombra el gasto, exige `Motivo de la anulación`,
inicia el foco en `Cancelar` y explica que registro y recibo se conservan
mientras el asiento deja de afectar saldos. Abrir y cancelar no mutó el fixture.

## 5. Cierre de evidencia y cobertura

- SDD-0243 cambia de `in-progress` a `done` porque Producción, deployment
  compatible y smoke autenticado están cerrados;
- Gastos cambia de `BE` a `VA` exclusivamente para `Anular gasto`;
- LB-SGE-107 deriva 32 `VA`, 17 `BE` y ocho `NA+BE`;
- ninguna otra fila, política, migración, acción o módulo fue reevaluado.

## 6. Gates finales

| Gate | Resultado |
|---|---|
| `pnpm verify` | TODO VERDE; 396 archivos/4684 pruebas, 70 SQL, schema rebuild y 72 E2E ejecutables |
| build | verde; 155 páginas con configuración Supabase sintética, sin filas de Producción |
| PLG-01 | read-only; 27 políticas; cuatro componentes; forward-tests 7/7 |
| `git diff --check` | verde |

El gate `migrations-applied` no recibió service-role key local y quedó omitido;
se sustituyó por evidencia superior del ledger productivo y el postflight
metadata-only exacto de las secciones 1 y 2. Los 18 E2E omitidos requieren
fixtures de otros recorridos; el smoke específico de SDD-0243 se ejecutó
separadamente y está cerrado en la sección 4.

El push del recibo documental y la limpieza del worktree conservan su gate
independiente. No queda DDL, deploy manual ni smoke pendiente para SDD-0243.
