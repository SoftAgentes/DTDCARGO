---
sdd: 0357
title: Cerrar lectura cruda de facturas por rol y principal Portal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-18
supersedes: null
superseded_by: null
related:
  - SDD-0042
  - SDD-0139
  - SDD-0350
  - SDD-0354
  - SDD-0355
  - SDD-0356
confidencialidad: interno
---

# SDD-0357 — Lectura de facturas con autorización completa

> **Nota de aplicación — 2026-09-18.** `0414_invoices_read_rbac` **quedó aplicada a producción**
> el 2026-09-18 a las 05:18:01 UTC. La aplicó el Worker `dtdcargo-09`, con autorización nominal de
> Sam y confirmación del Director `dtdcargo-18`, después de la 0415. Registro completo en
> `.agents/handoffs/0414-0415-aplicacion-prod-20260918.md`.
>
> - **Autorización de Sam** (AskUserQuestion, textual): «A y C OK, autorizo ambas» — «Autorizo
>   aplicar 0415_mail_logs_read_rbac y 0414_invoices_read_rbac, de a una, con el runbook y cuando el
>   Director lo confirme.». Tras la 0415 repitió A1 y respondió «A1 OK, aplica la 0414».
> - **Ledger:** `20260918051801`, name exacto, 1 sentencia, md5
>   `aeccccf65130ef47602b0b6f4a3c8f4e` y 4.804 bytes, iguales al blob de `main`.
> - **Postflight de catálogo:**
>   - `invoices_team_select` ya no existe;
>   - `invoices_accounting_select` es SELECT para accounting y admin del tenant;
>   - «invoices portal self read» quedó con la misma expresión de 0452 (md5 idéntico);
>   - insert y update sin cambios, y ACL sin DELETE;
>   - las tres fachadas 0411–0413 sin cambios.
> - **Advisors de seguridad:** idénticos antes y después.
> - **Smoke posterior de Sam** con un rol no financiero, C1 a C3: «C1 a C3 OK».
> - La espera sale de `supabase/migrations-baseline.json` en la rama del registro.

> **Nota de importación — 2026-09-12; actualizada el 2026-09-13.** Esta spec se importa desde la PR
> #21 (`ea9952a4`; commit `702de3f4`) con su contenido original, `status: done` incluido: ese estado
> describe el cierre técnico local de la rama de origen, no un release. `0414_invoices_read_rbac`
> está **PENDIENTE DE APLICAR** y declarada en `supabase/migrations-baseline.json`; fusionar no
> autoriza aplicarla. Lote L07 del bloque C: **0407, 0411, 0412 y 0413, aplicadas a producción el
> 2026-09-13** por el Director con OK nominal de Sam (ledgers `20260913224300`, `20260913224418`,
> `20260913224437` y `20260913224453`; identidad, preflight, postflight y advisors en las notas de
> SDD-0350 y SDD-0354 a SDD-0356 y en el handoff, «RONDA 4») **→ fusión y despliegue de esta PR y
> smoke por roles → 0414**. El preflight de 0414 exige las tres RPC como SECURITY DEFINER y
> exactamente las policies `invoices_team_select` e `invoices portal self read`: el postflight de
> producción del 2026-09-13 dio eso. Precisión medida en local encima de `main`: si 0414 se aplica
> con el código de `main` todavía desplegado, o si se revierte sólo la app después, no hay error;
> RLS devuelve cero filas a los roles no financieros, Fidelización, CRM y Reportes dejan a todos los
> clientes en Bronze, Conversaciones muestra saldo 0 y el drawer de la OV «Facturas · 0». Tras 0414
> accounting y admin conservan lectura y escritura de su tenant y las tres RPC siguen respondiendo.
>
> **Portal, en los dos órdenes (ronda 3; estado real en la ronda 4).** 0414 vuelve a crear `invoices
> portal self read` con la expresión coherente por tenant. Es la misma que dejó
> `0452_portal_invoices_tenant_rls` (SDD-0463), **aplicada a producción el 2026-09-13** (ledger
> `20260913175856`), antes que 0407: el preflight de 0407 ya encontró la policy Portal con esa
> expresión. Producción tiene un solo tenant (conteo agregado autorizado del 2026-09-13), así que la
> frontera entre tenants es preventiva.
>
> - **Con 0452 aplicada antes, que es el caso de producción:** para el Portal, 0414 no cambia nada y
>   la frontera rige desde 0452. El preflight de 0414 pasa, porque pide la policy por nombre, y la
>   foto de catálogo tras 0414 es idéntica con 0452 previa y sin ella (medido).
>
> - **Sin 0452:** 0414 habría cerrado por sí misma la lectura del Portal entre tenants con Shipping
>   Mark repetido (medido).
>
> **Frontera aceptada por el Director como intencional (ronda 2).** Un vínculo activo cuyo cliente está
> borrado, o cuyo vínculo y cliente no coinciden de tenant, no lee facturas y **no recibe ningún mensaje de
> error**: la lectura devuelve cero filas. Un vínculo coherente conserva las suyas y no ve las de otro
> tenant.
>
> En la app no cambia nada en ningún orden. Desde SDD-0462 (PR #107, en `main`), las lecturas de facturas
> del Portal resuelven el principal y filtran por su tenant:
> - el layout manda a esos principales a `/entrar` (`app/portal/(app)/layout.tsx:39-40`);
> - la ruta del PDF resuelve el principal antes de leer la factura y responde 404
>   (`app/portal/(app)/facturas/[code]/pdf/route.ts:50-51`).
>
> La frontera sólo se ve en la consulta directa a PostgREST con el JWT del propio usuario.
>
> **Test de inventario (ronda 2).** `scripts/__tests__/invoice-read-boundary.test.mjs` entra idéntico al
> origen (blob `97c82149`), sin ajustar su lista de lectores: el inventario que congela, 45 llamadas
> directas `from("invoices")` en 18 archivos, coincide con el código real de esta rama, y sus imports
> (`canAccessModule` de `lib/studio/rbac.ts` y `KPI_CATALOG` de `lib/studio/dashboard/dashboard-catalog.ts`)
> existen en `main`, así que no requiere código de producto ausente (SDD-0322, SDD-0390 u otros). Pasa
> focal 3/3. Control rojo: un lector ficticio de `invoices` fuera de la lista lo hace fallar (19 archivos
> contra 18) y, al retirarlo, vuelve a verde. Las PR #104 y #105 no alteran ese inventario: un conteo AST
> de los 15 archivos de producción que tocan da 0 cambios. Tras incorporar `main` en la ronda 3 (PR #107
> y #108), el test sigue pasando 3/3 con las mismas 45 llamadas en 18 archivos: SDD-0462 no cambió las
> lecturas directas.
>
> **Ajuste del test en la ronda 3: tope propio de 60 s.** Deja de ser idéntico al origen sólo en eso: la
> primera prueba recibe `60_000` como tercer argumento de `it`, con un comentario que lo justifica. La
> lista, el recorrido y las aserciones no cambian.
> - **Por qué.** El `verify` completo sobre `799c8ae3` falló en `test` sólo por esta prueba, en los dos
>   intentos: `Test timed out in 20000ms`, con 22,4 s y 20,8 s. Lee y parsea unos 1.600 módulos y, bajo la
>   carga de la suite, pasa del tope global de 20 s (`vitest.config.ts:50`). Sola tarda unos 2,5 s.
> - **No debilita la prueba.** Es sincrónica: Vitest no puede cortarla a mitad y sólo compara la duración
>   al terminar (`withTimeout` de `@vitest/runner` 4.1.7). Una copia temporal con tope de 1 ms falló con
>   `Test timed out in 1ms.` después de 2,2 s de recorrido. El control rojo del inventario se repitió con
>   el tope nuevo: 19 archivos contra 18, y verde al retirarlo.
> - **Descartado: prefiltrar por el texto `invoices`.** Parsear sólo los módulos que lo contienen pierde
>   literales escritos con escapes, como `'inv\x6fices'`, que el AST sí cuenta. La variante sin pérdida
>   (texto `invoices` o una barra invertida) parsea 350 módulos, pero sólo baja de 1,6 a 1,0 s, porque
>   leer los 1.600 archivos cuesta 0,7 s. Con esa proporción, los 22 s bajo carga quedarían en unos 13 s,
>   todavía cerca del tope.
>
> No se importan el checklist `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs
> `2026-09-02-*` de la allowlist. Entran fuera de ella el registro de migraciones pendientes, que exige el
> gate `migrations-applied`, y el handoff `.agents/handoffs/c-l07-fidelizacion-conversations.md`. Ahí
> quedan el inventario de lectores y escritores, la paridad, los locks y la vuelta atrás de 0414, probada
> en local con 0452 aplicada y sin ella (sección «VUELTA ATRÁS DE 0407 Y 0414»).
>
> **Esa vuelta atrás, a propósito, no restaura la policy Portal vulnerable de 0085.** Deja `invoices portal
> self read` con la expresión coherente por tenant, y su postflight la exige.
> - Con 0452 aplicada, el catálogo de `invoices` queda idéntico al de antes de 0414.
> - Sin 0452, sólo difiere en esa policy.
>
> **Desviación respecto del origen**, pre-autorizada por el Director el 2026-09-12 antes de cualquier
> aplicación: `0414` fija `set local lock_timeout = '5s'` y `statement_timeout = '60s'` antes de su
> primer lock, al nivel superior del archivo. Toma ACCESS EXCLUSIVE sobre `invoices` y ACCESS SHARE sobre
> `clients` y `client_users`: con un lector que retenía `invoices` 15 s, el archivo de origen esperó
> 13,99 s y dejó 11,99 s en cola a un lector nuevo; el archivo actual corta a los 5,0 s y se revierte
> entero. El tope rige sólo dentro de la transacción de aplicación, como la de `apply_migration`; en
> autocommit no tiene efecto, a diferencia de 0450 y 0451, que lo fijan dentro de su bloque `do`. El
> contrato `0414` anula los topes que dejó 0407 en su transacción antes de incluir 0414 y agrega la
> aserción estática y la comprobación en transacción, así que la migración y su contrato ya no son
> idénticos al origen.

## Evidencia y decisión

Después de 0411–0413, Fidelización/CRM, Conversaciones y Órdenes de venta usan
RPCs minimizadas. El inventario AST de `app/`, `lib/` y `supabase/functions/`
queda en 18 archivos / 45 llamadas literales directas a `from("invoices")`.
Se congela ese inventario; no sustituye una prueba de autorización dinámica.

- Finanzas y sus exports, estados de cuenta, búsqueda global y widgets:
  requieren `invoices|accounting|collections|costing|fiscal|reports`, o admin
  en Rendiciones. Los candados de dinero no admiten overrides.
- Fidelización conserva sólo consultas de aplicación de crédito: sus acciones
  exigen `moduleEditDenial("accounting")` antes de leer o mutar facturas.
- Kommo conserva un proceso con `service_role` y filtro explícito de tenant.
- Portal conserva queries RLS y contextos elevados controlados por principal.

La policy Portal histórica usa únicamente Shipping Mark. La restricción de
`clients` es `unique(tenant_id, markbox)` (0006), no global. Por tanto, conservar
esa policy sin tenant dejaría abierta una lectura cruzada al cerrar la interna.

1. Reemplazar SELECT interno tenant-wide por tenant + `accounting|admin` activos.
2. Mantener los estados y la lectura financiera de soft-deleted para auditoría;
   las queries de operación siguen excluyéndolos. No cambiar INSERT/UPDATE/DELETE.
3. Portal: exigir vínculo `client_users` activo de `auth.uid()`, cliente vivo,
   y coincidencia de tenant en vínculo, cliente y factura, además de Shipping
   Mark. Conservar exclusión de borradores y soft-deleted de la policy original.
4. No dar acceso interno por overrides de módulos no financieros. Esos módulos
   continúan funcionando mediante las tres RPCs de lectura mínima.
5. Rechazar preflight si faltan las RPCs o hay policies SELECT/ALL inesperadas.

## Allowlist exacta

- `supabase/migrations/0414_invoices_read_rbac.sql`
- `supabase/tests/0414_invoices_read_rbac.test.sql`
- `scripts/__tests__/invoice-read-boundary.test.mjs`
- `docs/specs/0357-invoices-read-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-invoices-read-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Gate constitucional

| Principio | Resultado y evidencia |
|---|---|
| SGE-00.01 | cumplimiento: no cambia verbos ni estados de negocio |
| SGE-00.02 | cumplimiento: no muta ni elimina registros; contratos de escritura conservada |
| SGE-00.03 | cumplimiento: R3, lectura financiera; matriz vigente de dinero, sin nueva fricción UI |
| SGE-00.04 | no aplica: no agrega acciones financieras ni de permanencia; no modifica auditoría |
| SGE-00.05 | cumplimiento: pruebas de rol, tenant, vínculo revocado, cliente retirado y Shipping Mark repetido |
| SGE-00.06 | cumplimiento: preflight valida dependencias y policies antes de sustituirlas |
| SGE-00.07 | cumplimiento: prueba integrada de RPCs con SELECT crudo denegado; Cloud no se declara medido |
| SGE-00.08 | no aplica: no cambia recorridos de usuario |
| SGE-00.09 | cumplimiento: reutiliza helpers de membresía y policies; no crea UI |
| SGE-00.10 | no aplica: sin modificación visual o interactiva |
| SGE-00.11 | cumplimiento: errores de preflight identifican dependencia o drift |
| SGE-00.12 | cumplimiento: migración alojada conserva gate humano específico |

MP-01: no cambia retención, borradores P2, hechos emitidos P3 ni evidencia P4.
No captura, exporta ni traslada PII. El fixture SQL es sintético y usa rollback.

## Aceptación

- Los cinco roles internos no financieros no pueden leer filas crudas.
- Accounting/admin ven sólo su tenant; identidad ausente/desactivada no ve.
- Portal activo ve únicamente sus facturas no borrador/vivas del tenant propio;
  un Shipping Mark igual en otro tenant no abre acceso. Revocado/cliente retirado
  o relación con tenant incoherente no ve filas.
- INSERT/UPDATE financieros y ausencia de DELETE físico permanecen; service_role
  conserva su operación explícita.
- 0411, 0412 y 0413 reales funcionan después de aplicar 0414 con rol comercial.
- Inventario AST, SQL, rebuild y verificador canónico pasan; los SKIP se separan.

## Gate alojado y límite

0414 requiere que 0411–0413 estén aplicadas Y que la aplicación que usa esas RPCs
ya esté desplegada y verificada. El preflight SQL no puede demostrar la versión
del frontend: esa comprobación humana es obligatoria antes del OK individual.
No ejecutar esta migración junto con un deploy implícito. El orden coordinado de
0410 (facade + cierre de mail_logs) necesita su propio preflight de compatibilidad.
No se cambia la autorización de otras tablas Portal, RPCs históricas ni views.
