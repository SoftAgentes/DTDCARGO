---
sdd: 0353
title: Minimizar el contexto de correo de Cobranzas
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0026
  - SDD-0085
  - SDD-0306
  - SDD-0351
  - SDD-0358
confidencialidad: interno
---

# SDD-0353 — Contexto de correo mínimo para Cobranzas

> **Nota de importación — 2026-09-12; actualizada el 2026-09-13.** Esta spec se importa desde la PR
> #21 (`ea9952a4`; commits `e0c560a6` y `fa420f3f`) con su contenido original, `status: done`
> incluido: ese estado describe el cierre técnico local de la rama de origen. Su migración
> `0410_collections_mail_context` **fue APLICADA a producción el 2026-09-13** por el Director con OK
> nominal de Sam (ledger `20260913184537 / 0410_collections_mail_context`, 1 sentencia, md5
> `e80119c3c381d20c009c7dbd569557f4`, 7186 bytes; el ledger pasó de 449 a 450 filas), con el archivo
> de esta rama idéntico al aplicado: `git show HEAD:supabase/migrations/0410_collections_mail_context.sql`
> da el mismo md5 y los mismos 7186 bytes, sólo LF. Se aplicó con `apply_migration` y name exacto por el
> conector `claude.ai Supabase` (proyecto `xpfuzqombmjmxvprjgmi`), `{"success": true}` al primer
> intento y sin leer ninguna fila de negocio. Preflight, leído antes del catálogo y sin filas:
> `mail_logs` con relacl `authenticated=rxtm`, sin INSERT, UPDATE, DELETE ni TRUNCATE; policy
> `mail_logs_tenant_select` presente junto con `mail_logs_no_delete`,
> `mail_logs_no_insert_authenticated`, `mail_logs_no_update_authenticated` y
> `service_role_all_mail_logs`; la RPC no existía; helpers `get_user_tenant_id()` y
> `current_studio_role()` presentes. Postflight, leído después: `collections_mail_context(uuid[])`
> SECURITY DEFINER, STABLE, `search_path=""`, owner postgres, ACL
> `{postgres=X, service_role=X, authenticated=X}`, `anon` sin EXECUTE, comentario SDD-0353 y retorno
> `TABLE(invoice_id uuid, client_markbox text, has_email boolean, complained boolean, last_reminder_on date)`;
> relacl y policies de `mail_logs` idénticos a los del preflight. Advisors de seguridad de producción
> antes y después, comparados hallazgo por hallazgo: antes `rls_enabled_no_policy` INFO 21,
> `extension_in_public` WARN 1, `anon_security_definer_function_executable` WARN 22 y
> `authenticated_security_definer_function_executable` WARN 174; después, idéntico salvo
> `authenticated_security_definer_function_executable` WARN 175. La única diferencia es UN hallazgo
> nuevo: `public.collections_mail_context` aparece en `authenticated_security_definer_function_executable`.
> Es el efecto esperado e intencional: la RPC es SECURITY DEFINER y `authenticated` necesita EXECUTE; el
> control de rol (accounting|admin) y de tenant va adentro, y `anon` sigue sin EXECUTE (su lint quedó en
> 22). Ningún otro hallazgo cambió; es el lint que ya cargan las demás RPC definer del Studio, no una
> regresión. Conteo informativo autorizado, sólo agregado: 0 clientes vivos con email con blancos
> distintos del espacio al borde. El registro de esta ronda está en
> `.agents/handoffs/c-l10-recordatorios-cobranzas.md` («RONDA 2»). Por eso 0410 ya **no** figura como
> espera en `supabase/migrations-baseline.json` ni tiene declaración en
> `supabase/pending-migration-symbol-declarations.json`; el orden migrate-first se cumplió: la RPC
> existe en la base antes de fusionar el código que la consume, así que `contextoDeEnvio` ya no puede
> caer en `PGRST202`. Sigue el orden de L10 (SDD-0358): **0410 (aplicada) → despliegue de esta PR y
> verificación de la vista previa de recordatorios con accounting y admin → 0415**; la decisión 5 la
> cumple 0415, que sigue pendiente. `recordatorios-queries.ts` y su test entran idénticos al origen:
> `main` no tocó ese módulo desde la base común. No se importan el checklist
> `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` de la allowlist;
> entran fuera de ella la espera de 0415 en el baseline, que exige el gate `migrations-applied`, y el
> handoff de esta importación, donde queda la evidencia local.
>
> **Desviaciones respecto del origen**, decididas por el Director el 2026-09-12 antes de cualquier
> aplicación. (1) `0410` limpia `clients.email` y `mail_logs.to_email` con el mismo conjunto que
> `String.prototype.trim()` de JS (TAB, LF, VT, FF, CR, espacio, NBSP, U+1680, U+2000–U+200A, U+2028,
> U+2029, U+202F, U+205F, U+3000 y BOM) y compara ambos lados en minúsculas. El origen usaba `btrim` a
> secas, que sólo quita espacios, mientras `send-email.ts` guarda `to_email` con `trim().toLowerCase()`:
> un email con salto de línea, tab o NBSP al borde perdía su queja. (2) `0410` fija
> `set local lock_timeout = '5s'` y `statement_timeout = '60s'` antes de su primer lock, al nivel superior del
> archivo: rige dentro de la transacción de aplicación, como la de `apply_migration`, y en autocommit no
> tiene efecto; 0450 y 0451, en cambio, lo fijan dentro de su bloque `do`. El contrato
> `0410` agrega los casos infelices de normalización, la matriz de los 25 blancos con controles
> negativos y la aserción estática de los timeouts; por eso la migración y su contrato ya no son
> idénticos al origen.

## Estado real

Cobranzas sólo necesita saber si el cliente tiene email, si presentó una queja
y cuándo salió el último recordatorio de cada factura. Para calcularlo leía
directamente emails, metadata y todo `mail_logs` del tenant. Esa dependencia
impedía completar el RBAC admin-only de Mailing en SDD-0351.

## Decisión

1. Crear `collections_mail_context(uuid[])`, sin parámetro de tenant y limitada
   a facturas del tenant activo que el caller solicita.
2. Exigir `accounting|admin` dentro de la función `SECURITY DEFINER` y limitar
   cada llamada a 1.000 facturas.
3. Devolver únicamente `invoice_id`, Shipping Mark, dos flags y la fecha UTC del
   último recordatorio. Email y metadata no salen de la base.
4. Migrar `contextoDeEnvio()` a la RPC y fallar cerrado si no puede calcularla.
5. Restringir el SELECT directo de `mail_logs` a admin; `service_role` conserva
   envío, webhooks y health checks. **Secuencia corregida antes de publicar
   (SDD-0358):** 0410 sólo crea el facade compatible; 0415 restringe la lectura
   después de desplegar y verificar la aplicación consumidora.

## Gate SGE-00 y privacidad

- `cumplimiento` SGE-00.05/06: función y policy prueban rol + tenant; ids de otro
  tenant devuelven cero filas.
- `cumplimiento` SGE-00.11: un error de autorización aborta el preview/envío en
  vez de asumir que el cliente acepta correo.
- `cumplimiento` MP-01: la capa de Cobranzas recibe señales minimizadas, no email
  ni metadata del histórico.
- `no aplica`: visuales, accesibilidad, IA o cambio del criterio de recordatorio.

## Allowlist exacta

- `lib/studio/collections/recordatorios-queries.ts`
- `lib/studio/collections/__tests__/recordatorios-queries.test.ts`
- `supabase/migrations/0410_collections_mail_context.sql`
- `supabase/tests/0410_collections_mail_context.test.sql`
- `docs/specs/0353-collections-mail-context/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-collections-mail-context-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Cobranzas no consulta `clients.email` ni `mail_logs` directamente.
- Accounting/admin reciben sólo señales de sus facturas; otros roles,
  membresías desactivadas y otros tenants fallan cerrados.
- Admin conserva la consola completa de Mailing y service_role el runtime.
- Las pruebas focales, contrato SQL, rebuild, TypeScript, lint, docs,
  numeración, gobernanza y diff pasan.

## Fuera de alcance

- Cambiar el criterio o frecuencia de recordatorios.
- Cambiar Resend, crons, webhooks, UI o datos existentes.
- Aplicar la migración a Cloud/Producción.
