---
sdd: 0355
title: Minimizar el saldo de cliente en Conversaciones
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0021
  - SDD-0056
  - SDD-0252
  - SDD-0350
  - SDD-0354
confidencialidad: interno
---

# SDD-0355 — Saldo mínimo de Conversaciones

> **Nota de importación — 2026-09-12; actualizada el 2026-09-13.** Esta spec se importa desde la PR
> #21 (`ea9952a4`; commit `8b112b5a`) con su contenido original, `status: done` incluido: ese estado
> describe el cierre técnico local de la rama de origen. Su migración
> `0412_conversation_outstanding_facade` **fue APLICADA a producción el 2026-09-13** por el Director
> con OK nominal de Sam, después de 0411 (ledger `20260913224437 /
> 0412_conversation_outstanding_facade`, md5 `ed692e75b4ea9e3dba1799dbbfec613d`, 4024 bytes), con el
> archivo de esta rama idéntico al aplicado: `git show
> HEAD:supabase/migrations/0412_conversation_outstanding_facade.sql` da el mismo md5 y los mismos
> 4024 bytes, sólo LF; es el blob `e2c519ac`, idéntico al origen. Se aplicó con `apply_migration` y
> name exacto por el conector `claude.ai Supabase` (proyecto `xpfuzqombmjmxvprjgmi`), `{"success":
> true}` al primer intento y sin leer ninguna fila de negocio. Postflight, leído del catálogo sin
> filas: `conversation_client_outstanding` SECURITY DEFINER, STABLE, `search_path=""`, owner
> postgres, EXECUTE para `authenticated` y sin EXECUTE para `anon`, comentario presente. Advisors de
> seguridad de producción antes y después del bloque 0407 + 0411 + 0412 + 0413, comparados hallazgo
> por hallazgo: sólo cambió `authenticated_security_definer_function_executable`, de WARN 175 a WARN
> 178, con exactamente las tres RPC del lote (`public.studio_client_annual_billing`,
> `public.conversation_client_outstanding` y `public.sales_order_invoice_refs`): SECURITY DEFINER
> con EXECUTE para `authenticated`, con el control de rol y de módulo adentro; `anon` sigue sin
> EXECUTE (su lint quedó en 22) y los demás hallazgos no cambiaron (detalle en SDD-0354). Es el
> efecto esperado, no una regresión. El registro de esta ronda está en
> `.agents/handoffs/c-l07-fidelizacion-conversations.md` («RONDA 4»). Por eso 0412 ya **no** figura
> como espera en `supabase/migrations-baseline.json` ni tiene declaración en
> `supabase/pending-migration-symbol-declarations.json`; el orden migrate-first se cumplió: la RPC
> existe en la base antes de fusionar el código que la consume, así que el degradado silencioso ya
> no puede ocurrir en producción. Lote L07 del bloque C: **0407, 0411, 0412 y 0413 (aplicadas) →
> fusión y despliegue de esta PR y smoke por roles → 0414**. La medición local de la ronda 1 sigue
> valiendo como descripción de lo que pasaría sin la RPC: `getClientContext` devuelve null y la API
> del hilo responde `context: null`; el panel muestra sólo el nombre, «Sin envíos en curso» y saldo
> «—» en todas las conversaciones.
>
> Cortes: `route.ts`, `conversations-queries.ts` y `client-context.test.ts` entran idénticos al
> origen. `conversations-types.ts` y `conversaciones.test.ts` conservan el cambio de `main`
> (`STATUS_TONES.abierto = "info"`) y sólo toman el comentario del saldo y la retirada de los tests
> de `aggregateOutstanding`, cuyos tres casos (cero USD, sobrepago y moneda dominante) cubre el
> contrato SQL 0412. `digest-extract.ts` y `monthly-digest.ts`, que la PR #21 cambió en la misma
> carpeta por observabilidad, no son de este lote. Paridad medida contra `main` con datos sintéticos
> y PostgREST: igual en saldo, sobrepago, moneda dominante, cliente borrado y tenant; **diverge**
> donde `main` fallaba: excluye anuladas (1.100 → 100 USD, decisión 3), no trunca en 1.000 facturas
> (1.000 → 1.100) y el empate de moneda ya no depende del orden de filas (VES 100 → USD 70). No se
> importan el checklist `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs
> `2026-09-02-*` de la allowlist; entran fuera de ella el registro de migraciones pendientes, por la
> espera de 0414, y el handoff `.agents/handoffs/c-l07-fidelizacion-conversations.md`. Sin
> desviaciones en SQL ni en el contrato.

## Estado real

El panel de Conversaciones leía cada factura del cliente para calcular saldo y
moneda dominante. Además de exponer filas financieras a roles no financieros,
la consulta excluía borradores pero incluía facturas anuladas. Un error de
lectura terminaba presentado como saldo cero.

## Decisión

1. `conversation_client_outstanding(uuid)` recibe el id del hilo y resuelve el
   cliente dentro del tenant activo. No recibe tenant ni Shipping Mark.
2. Exige acceso efectivo a Conversaciones: admin, override explícito o default
   `commercial|operations|support`; una membresía desactivada bloquea siempre.
3. Devuelve sólo `client_id`, `balance` y `currency`. Agrega en Postgres sin
   truncamiento, excluyendo borradores, anuladas y soft-deleted.
4. Conserva el criterio de moneda dominante por total nominal facturado; un
   empate se ordena por moneda para hacerlo determinista. No convierte monedas.
5. `getClientContext` deriva el cliente desde la RPC y después relee sus datos
   por RLS. Si falla el agregado o no hay contexto autorizado, devuelve null,
   nunca un cero inventado.
6. La policy SELECT general de `invoices` sigue pendiente hasta completar la
   fachada de Órdenes de venta.

## Gate SGE-00 y privacidad

- `cumplimiento` SGE-00.05/06: permisos efectivos, membresía activa y tenant se
  verifican dentro de la función; un hilo ajeno o retirado no devuelve contexto.
- `cumplimiento` SGE-00.11: fallo de RPC oculta contexto, sin afirmar saldo cero.
- `cumplimiento` MP-01: el panel recibe saldo y moneda, no facturas individuales.
- `no aplica`: rediseño visual, nuevos datos personales, escrituras financieras.

## Allowlist exacta

- `app/api/studio/conversaciones/[id]/route.ts`
- `lib/studio/conversaciones/conversations-queries.ts`
- `lib/studio/conversaciones/conversations-types.ts`
- `lib/studio/conversaciones/__tests__/conversaciones.test.ts`
- `lib/studio/conversaciones/__tests__/client-context.test.ts`
- `supabase/migrations/0412_conversation_outstanding_facade.sql`
- `supabase/tests/0412_conversation_outstanding_facade.test.sql`
- `docs/specs/0355-conversation-outstanding-facade/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-conversation-outstanding-facade-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Conversaciones no consulta `invoices` directamente.
- La RPC sólo devuelve tres campos; deriva cliente/tenant desde el hilo.
- Roles, overrides, membresía desactivada, hilo ajeno/retirado, cero real,
  sobrepago, moneda dominante y exclusión de anuladas tienen pruebas.
- Vitest focal, TypeScript, lint, contratos SQL, rebuild, docs, numeración,
  gobernanza, componentes y diff pasan.

## Fuera de alcance

- Cambiar el criterio de moneda dominante o convertir monedas.
- Modificar UI, documentos o datos existentes.
- Aplicar 0412 a Cloud/Producción.
