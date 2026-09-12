# 0409 aplicada a producción — 2026-09-11

Tarea: aplicar `0409_bank_reconciliation_rbac` (SDD-0352, lote L09 del bloque C). La ejecutó el
Director con autorización nominal de Sam («Autorizo aplicar a producción
0409_bank_reconciliation_rbac»), conforme a `docs/runbooks/aplicar-migraciones-prod.md`.
Proyecto `xpfuzqombmjmxvprjgmi`.

## Resultado

**APLICADA.** Ledger de producción: `20260911111907 / 0409_bank_reconciliation_rbac`, con el
basename exacto. Se aplicó sola y con el SQL idéntico al archivo de `main` (blob `333847b3`,
6608 B, md5 `154d4b3e6c5cc3a192666bcad5fcc5dc`). Su preflight y su postflight internos pasaron;
si hubieran fallado, la transacción se habría abortado.

## Qué cierra

Antes, `bank_statements` y `bank_statement_lines` tenían las policies `FOR ALL` «… by tenant».
Concedían CRUD a cualquier sesión `authenticated` del tenant (expresión
`tenant_id = (SELECT get_user_tenant_id())`), aunque en la aplicación Contabilidad es solo
`accounting|admin`. Ahora cada operación (SELECT/INSERT/UPDATE/DELETE) exige tenant activo y rol
`accounting|admin`. La ACL de `authenticated` queda en SELECT/INSERT/UPDATE/DELETE: pierde
REFERENCES, TRIGGER y MAINTAIN. TRUNCATE no lo tenía antes.

## Estado previo (capturado antes de aplicar; solo catálogo, sin filas de negocio)

| Objeto | Valor previo |
|---|---|
| `bank_statements by tenant` | PERMISSIVE · `{authenticated}` · ALL · `(tenant_id = ( SELECT get_user_tenant_id() AS get_user_tenant_id))` en USING y WITH CHECK |
| `bank_statement_lines by tenant` | Igual que la anterior, sobre `bank_statement_lines` |
| `service_role_all_*` (ambas tablas) | PERMISSIVE · `{service_role}` · ALL · `true` |
| RLS | activa en ambas; `force` desactivado |
| `relacl` (ambas) | `{postgres=arwdDxtm/postgres,anon=xtm/postgres,authenticated=arwdxtm/postgres,service_role=arwdDxtm/postgres}` |
| Comentarios | textos SDD-0105 (se restituyen abajo) |
| Helpers del preflight | `get_user_tenant_id()` y `current_studio_role()` presentes |
| Ledger | última entrada `20260911041034 / 0427_portal_delete_delivery_address_command`; 0409 ausente |

## Vuelta atrás

Las policies previas solo existían en la base. Se capturaron **antes** de aplicar y este SQL es
el único artefacto de reversión. Solo se ejecuta con OK nominal de Sam y en una transacción.
Antes de usarlo hay que evaluar la compatibilidad, porque vuelve a abrir el CRUD a toda sesión
`authenticated` del tenant. Este SQL no retira la fila del ledger; si se revierte, hay que
registrarlo aparte.

```sql
begin;

drop policy if exists bank_statements_accounting_select on public.bank_statements;
drop policy if exists bank_statements_accounting_insert on public.bank_statements;
drop policy if exists bank_statements_accounting_update on public.bank_statements;
drop policy if exists bank_statements_accounting_delete on public.bank_statements;
create policy "bank_statements by tenant"
  on public.bank_statements as permissive for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists bank_statement_lines_accounting_select on public.bank_statement_lines;
drop policy if exists bank_statement_lines_accounting_insert on public.bank_statement_lines;
drop policy if exists bank_statement_lines_accounting_update on public.bank_statement_lines;
drop policy if exists bank_statement_lines_accounting_delete on public.bank_statement_lines;
create policy "bank_statement_lines by tenant"
  on public.bank_statement_lines as permissive for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

grant references, trigger, maintain on public.bank_statements to authenticated;
grant references, trigger, maintain on public.bank_statement_lines to authenticated;

comment on table public.bank_statements is
  'SDD-0105: cabecera del extracto bancario, 1 por (cuenta, período). account_id = cuenta banco/caja del plan (1.1.1.x). status open→reconciled→archived (text+check). RLS por tenant_id. La conciliación de sus líneas no muta el mayor (solo vincula).';
comment on table public.bank_statement_lines is
  'SDD-0105: movimientos de un extracto. status pending→matched|manual|ignored. matched_entry_id liga a un asiento EXISTENTE del diario (V1 no crea asientos). RLS por tenant_id (denormalizado). Un asiento no puede ligarse a dos movimientos (unique parcial sobre matched_entry_id).';

commit;
```

## Verificación posterior, contra el objeto

| Comprobación | Resultado |
|---|---|
| Policies históricas `FOR ALL` «… by tenant» | ausentes |
| Policies nuevas | 8: `*_accounting_{select,insert,update,delete}` en las dos tablas, rol `{authenticated}` |
| Policies `service_role_all_*` | conservadas |
| ACL de `authenticated` | `arwd` en ambas; `has_table_privilege(..., 'TRUNCATE')` = false |
| RLS | activa en ambas |
| Comentarios | actualizados a SDD-0105/0352 |
| Ledger | `20260911111907 / 0409_bank_reconciliation_rbac` |
| Advisors de seguridad (resultado completo procesado) | 4 lints en el proyecto, ninguno sobre `bank_statement*` |

## Qué no se midió

No se leyeron filas de negocio, así que no hay conteo de sesiones que accedieran a estas tablas
por PostgREST con un rol distinto de `accounting|admin`. En la aplicación, Contabilidad ya exige
`accounting|admin` en Next, por lo que no se espera ninguna regresión visible. Un rol distinto
que usara PostgREST directamente pierde el acceso, que es justo lo que se buscaba.

## Cambios en el repositorio (esta rama)

- `supabase/migrations-baseline.json`: `0409_bank_reconciliation_rbac` sale de `pendingBelowCutoff`.
  El cutoff sigue en 238 y las demás esperas quedan intactas.
- `docs/specs/0352-bank-reconciliation-rbac/spec.md`: la nota de importación pasa a «aplicada».
- Este registro.

## OBJETIVO ORIGINAL

Aplicar 0409 en producción con autorización nominal, verificarla contra el objeto y dejar
registro y vuelta atrás en Git.

## COMPLETADO

Aplicación, verificación contra el objeto, artefacto de rollback y retiro de la espera del
baseline.

## VALIDACIÓN

El detalle está en la PR. Incluye `docs:check`, `sdd:check`, `check-pending-migration-symbols`
y `git diff --check` sobre esta rama.

## COMMITS / PR / BRANCH

El commit que contiene este documento está en la rama `codex/c-0409-aplicada-prod`; la URL de la
PR está en su descripción.

## PENDIENTES DE ESTA TAREA

Integrar esta PR, con autorización de merge de Sam.

## FUERA DE ALCANCE DETECTADO

Ninguno propio de esta aplicación.

## HANDOFF AL DIRECTOR

El worktree `c-0409-aplicada-prod` pertenece a la sesión Director. Después del merge se puede
limpiar según el runbook.
