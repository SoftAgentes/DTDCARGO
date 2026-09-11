# Handoff — C / L08: RBAC admin-only de Mailing

Fecha: 2026-09-11. Task ID: `c-l08-mailing-rbac`.
Owner / sesión: `c-l08-worker-20260911-claude` (Worker Claude Code asignado por el Director; sin subagentes escritores).

Estado: lista-para-revision como PR draft, no integrada ni aplicada a producción. La validación canónica quedó parcial por un límite de entorno: E2E se colgó y lo detuve a indicación del Director; el build de verify no se alcanzó y lo cubre la CI del SHA de producto. Detalle en VALIDACIÓN.

Tomé el claim al iniciar, sobre el worktree que creó el Director (guard OK y árbol limpio en la base); se libera al terminar la publicación de este handoff.

- Repo: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal no modificado).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l08-mailing-rbac`.
- Rama: `codex/c-l08-mailing-rbac`.
- Base asignada y HEAD inicial: `3c6107012f754953323202a7386b3e7811593814`, igual a `origin/main` al iniciar, al hacer commit y al publicar.
- Origen solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, head de la PR #21 (`codex/saneamiento-integral`, draft), confirmado con `gh pr view 21`.
- SDD: `docs/specs/0351-mailing-rbac/spec.md`, importada con su `status: done` histórico y una nota de importación fechada bajo el título.
  - No hubo reserva de número: la spec 0351 y la migración 0408 solo existían en `origin/codex/saneamiento-integral`.
  - `docs/specs/0408-client-document-entity-rbac/` y `supabase/migrations/0351_operario_rpc_exige_rol.sql` pertenecen a la otra secuencia y no chocan (`sdd:check` PASÓ).
- Plan: `docs/audits/c-analisis-bloque-c.md:77` (fila L08) y anexo `docs/audits/c-analisis-bloque-c-sql.md:29, 59, 102, 147, 196, 238`.

## OBJETIVO ORIGINAL

Preparar el lote L08 del bloque C para integrarlo en main mediante PR draft:

- importar la migración `0408_mailing_admin_rbac`, su contrato SQL y la spec 0351;
- declarar `0408_mailing_admin_rbac` pendiente de aplicar;
- auditar los consumidores de Mailing y de las dos RPC que pasan a service_role.

Sin cambios de app/lib, sin merge, sin producción y sin lectura de datos productivos.

## COMPLETADO

- **Migración y contrato:** `supabase/migrations/0408_mailing_admin_rbac.sql` y `supabase/tests/0408_mailing_admin_rbac.test.sql` importados idénticos por blob.
- **Spec:** `docs/specs/0351-mailing-rbac/spec.md` es el blob de origen más una nota de importación de 8 líneas bajo el título.
  - Frontmatter, `done` histórico y «Allowlist exacta» histórica quedan intactos.
  - No importé `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` que esa allowlist cita; la nota lo aclara.
- **Baseline:** `supabase/migrations-baseline.json` recibe una única línea, la espera `0408_mailing_admin_rbac`, con el formato de las vigentes.
  - Indica bloque C L08 / SDD-0351, que fusionar NO autoriza aplicar, que se requiere OK nominal de Sam y el runbook, y el name exacto. También pide revalidar esta auditoría antes de aplicar.
  - `cutoff: 238` y las esperas 0409/0418/0419/0430 quedan intactas.
- **Índice:** `docs/specs/README.md` regenerado con `corepack pnpm docs:index` (416 specs; 0351 sale de la lista de huecos).
- **Auditoría de consumidores:** completa, veredicto **SIN IMPACTO** (tabla abajo).

### Qué hace 0408 (confirmado en el archivo)

- Preflight de catálogo `0408:22-67`: exige las seis tablas, los dos helpers, las dos RPC y cuatro policies ALL históricas.
- Policies admin-only `:70-246`: `tenant_id = get_user_tenant_id()` y `current_studio_role() = 'admin'` en `mail_templates`, `mail_signatures`, `mail_rules`, `mail_config`, `mail_blacklist` y `mail_scheduled`. Retira las `*_by_tenant` y las owner/tenant de firmas (0018/0206).
- ACL `:250-261`: `revoke all` y CRUD mínimo por tabla; config queda solo con select/update y blacklist sin update.
- RPC `:265-272`: `mail_increment_template_metrics` y `mail_check_blacklist` quedan solo para `service_role`.
- Comentarios `:274-277` y postflight de catálogo `:279-318`.
- `mail_logs` solo aparece en el comentario `:15`: no cambia.
- No crea ni consume el facade 0410 (anexo SQL `:29, :147`); no depende de L10.

### Datos personales

Firmas (email, teléfono, WhatsApp), blacklist (email) y programados (destinatarios y cuerpo) contienen datos personales.

0408 no contiene INSERT, UPDATE, DELETE, TRUNCATE, ALTER TABLE, COPY, CREATE TABLE ni CREATE FUNCTION: la búsqueda de sentencias al inicio de línea solo coincide con el comentario `:15`. La migración únicamente reduce lectores y escritores; no captura, mueve ni elimina datos. Por eso la revisión focal de `.claude/skills/revisar-datos-ve/SKILL.md` no aplica.

### Auditoría de consumidores

Método:

- grep de las seis tablas, las dos RPC, `sendEmail`, `fireMailEvent`, `mail-queries`, `MailSignature`/`signature_user_id` y cada notificador de `lib/`;
- en `app/`, `lib/`, `components/`, `supabase/functions/` y `scripts/`, siguiendo cada cliente hasta su creación;
- revisión del SQL de `supabase/migrations/` (funciones, vistas, triggers y grants).

Base `3c610701`.

| # | Consumidor (archivo:línea) | Objetos | Cliente | Gate | Efecto de 0408 |
|---|---|---|---|---|---|
| a1 | `app/api/webhooks/resend/route.ts:151` | RPC `mail_increment_template_metrics` | `supabaseAdmin = createAdminClient()` `:95` | webhook Resend | Ninguno: service_role conserva EXECUTE (`0408:267-268`) |
| a2 | `lib/studio/mail/send-email.ts:207` | RPC `mail_increment_template_metrics` | parámetro `supabaseAdmin` `:57`; todos los llamadores pasan `createAdminClient()` (e2-e4) | — | Ninguno |
| a3 | `lib/studio/mail-queries.ts:330-341` `isEmailBlacklisted` | RPC `mail_check_blacklist` | sería el cliente recibido | — | Sin llamadores en app/lib/components/functions/scripts; tras 0408, un llamador authenticated recibiría 42501 |
| a4 | SQL `supabase/migrations/**` | ambas RPC | — | — | Ninguna función, vista ni trigger las invoca: solo están las definiciones `0018:240, 276` y sus replays. `0248:24-25` ya las clasificaba como solo-servidor |
| b1 | `app/api/newsletter/subscribe/route.ts:115-120` | SELECT `mail_blacklist` | `admin = createAdminClient()` `:60` | ruta pública | Ninguno |
| b2 | `app/api/cron/mail-scheduled/route.ts:55-61, 77, 88-102` | `mail_scheduled` y `sendEmail` | `admin = createAdminClient()` `:52` | `CRON_SECRET` | Ninguno |
| b3 | `app/api/webhooks/resend/route.ts:160-170` | UPSERT `mail_blacklist` | `supabaseAdmin` `:95` | webhook | Ninguno |
| b4 | `app/studio/(app)/marketing/newsletter/actions.ts:111`; `lib/studio/newsletter/sender.ts:79-84, 150` | `mail_blacklist`, `mail_config` | `createAdminClient()` (`actions.ts:98, 150, 204`) | módulo marketing | Ninguno |
| c1 | `app/studio/(app)/mailing/layout.tsx:12`; `app/studio/(app)/mailing/page.tsx:100-102` | — | sesión | `requireModuleView("mailing")` y `link.role !== "admin"` → redirect | Gate intacto. `mailing` ∈ `ADMIN_ONLY_MODULES`/`LOCKED_MODULES` (`lib/studio/rbac.ts:143, 173-188`) y los overrides se ignoran en módulos LOCKED (`rbac.ts:325, 346`) |
| c2 | `page.tsx:151-171, 194, 235` | lecturas de las seis tablas (`listTemplates`, `listRules` con embed de templates, config, blacklist, `listScheduled`, `listTenantSignatures`) | sesión | tras c1 | El admin activo conserva SELECT; un no-admin nunca llega |
| c3 | `app/studio/(app)/mailing/actions.ts`, 14 de 15 actions | CRUD de sesión sobre las seis tablas | sesión (admin client en firmas y envíos) | `moduleEditDenial(supabase, "mailing")` antes de tocar tablas: `:64, :200, :280, :334, :367, :392, :441, :494, :532, :624, :711, :779, :869, :904` | El admin conserva el CRUD que usa la UI (el contrato lo prueba); un no-admin queda denegado por el guard |
| c4 | `actions.ts:111-161` `sendTestTemplateAction` | SELECT `mail_templates` `:128-132` | sesión; envío con `createAdminClient()` `:140` | **sin `moduleEditDenial`**; solo la invoca `mailing/_components/TemplateEditorDrawer.tsx:22, 41` | El admin no cambia. Un no-admin que la llame directamente pasa a recibir «Template no encontrado.»: 0408 cierra el hueco en DB. No es un flujo legítimo no-admin → FUERA DE ALCANCE |
| d1 | Firmas: `page.tsx:194, 235`; `actions.ts:216-249`; `actions.ts:572` (`getDefaultSignature` en `buildOutgoingHtml`, llamado desde `:638` y `:729`, tras el guard) | `mail_signatures` | sesión admin / admin client | c1/c3 | Únicos consumidores: no hay editor de firma en perfil, conversaciones, móvil ni otro módulo (`MailSignature` solo aparece en `mailing/_components/*`). `listSignatures` (`mail-queries.ts:106`) no tiene llamadores. Ningún flujo de dueño usa las owner policies (`0018:339-363`) ni las tenant (`0206:34-53`). El subtítulo `page.tsx:66-67` describe la vista admin (`actions.ts:167-174`) |
| d2 | Lectores de `lib/studio/mail-queries.ts` `:43/48, :71/76, :85/90, :106/111, :127/131, :142/147, :203/208, :218/223, :233/237, :246/250, :265/269` | seis tablas | parámetro | — | Solo se llaman desde c2 (`listTemplates`, `listRules`, `listScheduled`, `listTenantSignatures`) y c3 (`getDefaultSignature`). `getTemplate`, `getTemplateBySlug`, `listSignatures`, `getRule`, `getMailConfig` y `listBlacklist` no tienen llamadores |
| e1 | `lib/studio/mail/send-email.ts:67-77, 95-105, 131-136` | `mail_config`, `mail_templates`, `mail_blacklist` | parámetro `supabaseAdmin` | — | Estructural: inserta en `mail_logs` (`:152-168`), algo que authenticated no puede hacer (`0018:302-305` concede solo SELECT; policy `with check (false)` en `0018:370-372`). Ningún envío funciona hoy con sesión |
| e2 | `lib/studio/mail/mail-rule-engine.ts:70-75, 86-90, 171-177, 216-230` (`fireMailEvent`) | `mail_rules`, `mail_templates`, `auth.admin.listUsers` | parámetro | — | Todos los llamadores usan `createAdminClient()`: `cobranzas/actions.ts:316→320`, `facturacion/actions.ts:575`, `cotizador/actions.ts:288→312`, `tracking/nuevo/actions.ts:124→126`, `cn/actions.ts:494→542` (dentro de `if (… && admin)` `:534`). accounting, commercial, operations y warehouse disparan reglas vía service_role |
| e3 | `sendEmail` directo en app/ | seis tablas vía e1 | `createAdminClient()` | — | `cron/alta-health/route.ts:56→91`, `api/contact/route.ts:130→189`, `(auth)/login/recuperar/actions.ts:58→115`, `portal/(app)/referidos/actions.ts:43→84`, `usuarios/actions.ts:188→208, 453→560`, `mailing/actions.ts:140→145, 737→742, 814→819` |
| e4 | Notificadores de `lib/` con parámetro, alimentados por `createAdminClient()` | seis tablas vía e1 | service_role | — | Detalle por grupo en la lista bajo esta tabla |
| f1 | `scripts/seed-mail-templates.ts:279, 294` (`seedMailTemplates(supabase)`), llamado desde `scripts/seed.ts:43` | `mail_templates` | cliente con `SUPABASE_SERVICE_ROLE_KEY` (`seed.ts:27-37`) | — | Ninguno |
| f2 | `supabase/functions/**` | — | — | — | Sin referencias a Mailing |

Llamadores de los notificadores de e4, todos con `createAdminClient()`:

- **Bugs:** `bug-create.ts:144, 168` ← `api/studio/bugs/route.ts:107-116` y `mis-bugs/actions.ts:102-111`; `api/studio/bugs/[id]/state/route.ts:83→98`; `[id]/messages/route.ts:122→150`; `studio/(app)/bugs/actions.ts:134→152, 316→345`; `cron/bug-notifications-drain/route.ts:36→37`.
- **Cotización:** `portal/(app)/cotizaciones/actions.ts:59→103`; `estimados/actions.ts:57→113`.
- **Registro:** `app/registro/actions.ts:114→398, 423`.
- **Contacto:** `api/contact/route.ts:130→179`.
- **Packing list:** `app/p/[token]/packlist/route.ts:46, 121→195`.
- **Estimado:** `api/public/estimacion/route.ts:67→128`.
- **Pago:** `portal/(app)/facturas/[code]/reportar/actions.ts:69→186`.
- **Invitación al Portal:** `clientes/actions.ts:230→231, 260` y `472→473`; `admin/portal-backfill-actions.ts:343→388, 483→509`; `cron/portal-cold-reminder/route.ts:72→161`.
- **Identidad:** `clientes/actions.ts:663→664`.
- **Acceso al Portal:** `app/entrar/actions.ts:101→145, 152`.
- **Salud del correo:** `cron/mail-health/route.ts:78→112`.
- **Tarifas:** `cron/rate-expiry-alert/route.ts:44→67`; `cron/searates-refresh/route.ts:58→79`.
- **Avisos al cliente:** `cron/client-notifications-drain/route.ts:34→35`.
- **Reenvío:** `mailing/actions.ts:927→932`.
- **Sin envío:** `shipment-milestone-notify.ts:78` no tiene llamadores y `conversaciones/actions.ts:119-125` no envía correo.

**Veredicto: SIN IMPACTO.**

- Ningún rol no-admin (accounting, commercial, operations, warehouse, support, marketing) lee ni escribe las seis tablas con su sesión en un flujo legítimo.
- Ningún llamador authenticated usa las dos RPC.
- Los envíos (reglas del ERP, facturas, cobranzas, cotizaciones, bugs, Portal y crons) usan service_role, que 0408 no toca.

No hay bloqueo de release. El único residual de app es c4.

### Gobernanza (AGENT-BRIEF → SGE-00)

| Principio | Clasificación | Evidencia de esta extracción |
|---|---|---|
| SGE-00.05 permisos/tenant | cumplimiento (pendiente de release) | Negativas del contrato: commercial no lee, actualiza, inserta ni borra (`test.sql:170-226`); RPC bloqueadas `:228-258`; admin desactivado `:260-275`; admin de otro tenant `:277-293`. Positivas: admin `:295-341` y service_role `:345-354`. La UI ya estaba gateada (c1/c3). Solo rige en producción tras aplicar 0408 |
| SGE-00.06 / SGE-00.11 | cumplimiento | Preflight `0408:22-67` aborta ante objetos o policies ausentes; postflight `:279-318`. La membresía desactivada falla cerrada (`0200:70-82`, `test.sql:260-275`). Los rechazos 42501 ya se traducen en actions (`actions.ts:99, 303, 350, 463, 516, 662`) |
| ERR-01 | cumplimiento | Mismo contrato PostgREST/RLS que las actions ya traducen |
| SGE-00.01-04, .07-.10, .12; MP-01 | no aplica | Sin UI, verbos, flujos de guardado, operaciones asíncronas, IA ni cambio de ciclo de vida: el admin conserva el CRUD vigente (spec 0351, sección «MP-01 y datos») |
| `mail_logs` | no conformidad acotada | El SELECT tenant-wide se mantiene (`0018:366-368`). Su cierre corresponde a L10 (0410→0415, SDD-0353/0358), fuera de este lote |

## VALIDACIÓN

- **PASÓ** guard y claim: `node scripts/harness-worktree.mjs guard` y `claim --owner c-l08-worker-20260911-claude`; raíz, rama y base verificadas. `guard --owner` y la rama se revalidaron antes de escribir, de cada commit y del push.
- **PASÓ** `corepack pnpm install --frozen-lockfile` (38.1 s), Node 24.20.0 / pnpm 12.3.4; lockfile intacto.
- **PASÓ** identidad por blob (bloque abajo).
- **PASÓ** `node scripts/install-merge-drivers.mjs --check`: driver `dtd-generated-records` verificado.
- **PASÓ** `corepack pnpm sdd:check`: sin números repetidos; los avisos históricos «NO se renumera» son preexistentes.
- **PASÓ** `corepack pnpm docs:index` (416 specs, 36 huecos) y `corepack pnpm docs:check`.
- **PASÓ** `node scripts/check-schema-rebuild.mjs`, corrido aparte (07:28:12Z→07:28:43Z): 421 archivos, 403 migraciones aplicadas desde cero, 18 solo-ledger, barrido de 219 tablas y 2 tenants sintéticos.
- **PASÓ** `node scripts/check-pending-migration-symbols.mjs`: 0 ROJO · 0 AMARILLO. `supabase/pending-migration-symbol-declarations.json` intacto.
- **PASÓ** `git diff --check` (archivos rastreados y nuevos) y allowlist exacta: base..`a11131ef` son 5 rutas (+775/−2); con este handoff, 6.
- **FALLÓ** `corepack pnpm verify`, exit **1** forzado, entre 07:31:19Z y 08:42:02Z, sobre el contenido exacto de `a11131ef4aaff694fb8fadc83354016789ddc231`. Se ejecutaron 16 de 17 pasos; no se reintentó, por indicación del Director. Resultado por paso:
  - **PASÓ** harness (18/18), lint (0 errores / 8 advertencias preexistentes en archivos no tocados), rsc-boundary (1597 módulos), typecheck, edge-functions (4, deno 2 vía npx), test (526 archivos / 6684 tests), docs:check (416), numbering (416 specs · 421 migraciones), feature-constants (5), components:check, governance:check (28 políticas), pending-migration-symbols (0/0), sql-tests (163 contratos, incluido `0408_mailing_admin_rbac.test.sql`, con rollback total) y schema-rebuild (421 / 403 / 18, 219 tablas).
  - **NO DISPONIBLE** migrations-applied: SKIP por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. No se consultó producción ni se copiaron secretos.
  - **FALLÓ/NO DISPONIBLE** e2e: se colgó y lo detuve a indicación del Director.
    - Arrancó con un dev server propio en el puerto 3220 («Running 186 tests using 8 workers»).
    - Resultados parciales hasta las 07:48:32Z: 142 resultados con reintentos; 130 de 186 tests con resultado (106 pasaron, 11 fallaron, 1 intermitente, 12 omitidos) y 56 sin resultado.
    - Por proyecto: chromium 50/5/1/6, mobile-chrome 51/5/0/6 y mobile-safari 5/1/0/0.
    - Los 11 fallos son login/auth (`e2e/auth.spec.ts:21, 91, 98, 105`) y `e2e/global-search.spec.ts:22`, con el webServer reportando falta de URL/clave Supabase en `proxy.ts:67` (límite conocido). Intermitente: `auth.spec.ts:74` en chromium. Omitidos: 12 journeys Tier 3 que requieren seed.
    - Tras el resultado #142 (mobile-safari) no hubo más salida durante 53 minutos.
  - **NO EJECUTADO** build dentro de verify: no se alcanzó. Lo cubre la CI «Calidad local sin secretos» del SHA de producto (siguiente punto).
- **PASÓ** CI remota «Calidad local sin secretos» sobre `a11131ef`, [run 34575215649](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34575215649) (07:36:59Z→07:51:22Z). Pasaron los 19 pasos, entre ellos «Build de produccion sin secretos» y «Confirmar arbol reproducible». Esa CI no ejecuta SQL, schema-rebuild, E2E ni el ledger de Supabase. La CI del commit de este handoff se registra por SHA en la PR.
- **NO EJECUTADO**, por no aplicar:
  - `/ui-check`: no hay UI.
  - revisión focal `revisar-datos-ve`: no hay captura, movimiento ni borrado de datos (evidencia en COMPLETADO).
- **NO EJECUTADO**, por estar fuera de la autorización: merge, aplicación de 0408 a producción, lectura de datos productivos y deploy manual. El único deploy fue el preview automático de rama en Vercel.
- **NO DISPONIBLE** E2E autenticado: faltan credenciales Supabase en el worktree.

### Detención del E2E colgado (a indicación del Director)

- **Identificación con `Get-CimInstance Win32_Process`:** listener `:::3220` → PID 41872 (`next …\start-server.js`, con la ruta de este worktree) → `next dev --webpack --port 3220` (45876) → `cmd` (22140) → Playwright `cli.js test --reporter=list,json` (18412) → `node scripts/verify.mjs` (44044) → `cmd` (28268) → `pnpm-native.exe verify` (12568) → `corepack.js pnpm verify` (**45568**, 03:31:19 hora local = `verify.start` 07:31:19Z) → `sh.exe` (21100). Los seis workers de Playwright llevaban la ruta del worktree.
- **Árbol guardado antes de detener:** 29 procesos, con PID y hora de creación. Cero «hijos falsos» por PID reutilizado.
  - Cadena de verify: 45568, 12568, 28268, 44044.
  - Playwright 18412 y sus workers 27240, 41484, 42692, 22744, 30828 y 39952.
  - `next`: 22140, 45876, 41872.
  - 15 `chrome-headless-shell`: 42640, 7604, 47252, 21576, 13760, 31712, 5068, 38140, 46808, 45904, 37816, 2528, 48012, 35320, 39252.
- **Detención:** `taskkill /PID 45568 /T /F` a las 08:42:01Z terminó los 29. `verify.exit = 1` a las 08:42:02Z.
- **Comprobación:** a las 08:42:58Z había 4 `chrome-headless-shell` (45904, 48012, 2528, 39252) todavía terminando. A las 08:44:04Z: 0 sobrevivientes del árbol guardado (mismo PID y misma hora de creación), 0 listeners y 0 sockets en 3220 (`netstat`), y ningún proceso no-shell con la ruta del worktree.
- **Procesos ajenos:** no se tocaron los de L02, L04 y L06; la detención se limitó al árbol validado.
- **Observación:** el worker 39952 (creado a las 07:48:23Z) no tenía navegador hijo al detenerlo, y el silencio empieza en mobile-safari.

### Identidad por blob

`git rev-parse` / `git cat-file -s` sobre `ea9952a4:<ruta>` y `a11131ef:<ruta>`, en el orden migración / contrato / spec:

```text
migración origen:  64ffe072b79ff9b8bb0a36cb34292b4d926fd23a  14337 B
migración HEAD:    64ffe072b79ff9b8bb0a36cb34292b4d926fd23a  14337 B
contrato origen:   cac14e660e3c4d92510bbeccd47a728007e71983  14445 B
contrato HEAD:     cac14e660e3c4d92510bbeccd47a728007e71983  14445 B
spec origen:       d07457fc3a808c421a0de3012e279ba2b19429b9   3445 B
spec con nota:     bd13956798c79418aef0fd796081515cd1cdd3fa   4101 B  (3445 + 656 de nota)
```

Además de comparar OID, `spec-note.mjs verify` retira la nota por forma y compara Buffers contra el blob `ea9952a4:docs/specs/0351-mailing-rbac/spec.md`. Resultado: `strippedEqualsSourceBlob: true`, sin CRLF, 8 líneas y 656 bytes de nota.

Evidencia local fuera de Git, en `C:/Users/AKX generator/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/454d97be-b1e0-4fc9-97e9-c6bb621ba84c/scratchpad/c-l08-mailing-rbac/`:

- logs de pasos: `install.log`, `docs-index.log`, `docs-check.log`, `sdd-check.log`, `merge-drivers.log`, `pending-symbols.log`, `schema-rebuild.log`;
- verify: `verify.log`, `verify.exit`, `verify.sha`, `e2e-partial.txt`, `e2e-summary.txt`;
- detención del E2E: `proc-tree-before.txt`, `verify-tree.json`/`.txt`, `taskkill.log`, `verify-tree-check*.txt`;
- scripts: `spec-note.mjs`, `proc-tree.ps1`, `tree-guard.ps1`;
- `src/` con los tres blobs de origen.

## COMMITS

- `a11131ef4aaff694fb8fadc83354016789ddc231` — importación lógica de L08 en un commit selectivo: spec con nota, SQL, contrato, espera del baseline y regeneración del índice. Alcance contra la base: 5 archivos, +775/−2; ningún archivo de app/lib/components ni `supabase/pending-migration-symbol-declarations.json`.
- Commit que contiene este documento — cierre durable del Worker. El SHA final va en la PR; no se crea un commit recursivo para registrar su propio hash.

## PR / BRANCH

[PR #74 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/74), base `main`, rama `codex/c-l08-mailing-rbac`, worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l08-mailing-rbac`.

- Publicación: push explícito de la rama a sí misma (`git push -u origin codex/c-l08-mailing-rbac:codex/c-l08-mailing-rbac`), después de confirmar con `git ls-remote` que main seguía en `3c610701`.
- Head de extracción: `a11131ef`. El SHA final del handoff queda en la PR.
- No se fusionó ni se desplegó manualmente; Vercel generó su preview automático de rama.

## PENDIENTES DE ESTA TAREA

No quedan pendientes de extracción ni de auditoría.

La validación canónica es parcial por límite de entorno, y por indicación del Director no se reintenta verify:

- E2E se colgó y lo detuve;
- el build de verify quedó NO EJECUTADO, cubierto por la CI de `a11131ef`;
- migrations-applied y E2E autenticado quedan NO DISPONIBLE.

La PR sigue en draft. La integración (revisión por SHA, orden con #69/#70/#71/#72/#73 y merge autorizado) y la aplicación productiva de 0408 (tarea nominal separada) no son de esta tarea.

## FUERA DE ALCANCE DETECTADO

1. **`sendTestTemplateAction` no tiene guard** (`app/studio/(app)/mailing/actions.ts:111-161`). Hoy, antes de 0408, un miembro autenticado no-admin puede invocarla directamente como endpoint: lee la plantilla con su sesión y dispara un envío de prueba vía service_role a su propio correo (inserta `mail_logs` y consume Resend). 0408 lo cierra en DB, pero el guard de app sigue ausente. Corresponde a una tarea app/** con SDD propia (`moduleEditDenial(supabase, "mailing")` antes de `:122`).
2. **Textos que quedan desactualizados al aplicar 0408:** `actions.ts:14` («RLS valida vía mail_config_by_tenant policies»), `lib/studio/mail-queries.ts:121-126` (la policy tenant de 0206 permite el SELECT a cualquier miembro) y el subtítulo `page.tsx:66-67` («Cada empleado configura su firma»), que no refleja el modelo administrado por el admin. Son copy y documentación; la decisión de producto va aparte.
3. **Referencia a un checklist ausente.** La aceptación histórica de 0351 dice que la deuda de `mail_logs` «queda visible en el checklist P1», pero ese checklist no se importó. En el plan, esa deuda la cubre L10.
4. **Membresía con `limit 1` sin orden.** `get_user_tenant_id()` y `current_studio_role()` (`0200:50-82`), igual que `getStudioAccess` (`lib/studio/rbac-guard.ts:72-78`), toman la primera membresía activa con `limit 1` sin orden. Con varias membresías activas, el tenant y el rol podrían salir de filas distintas. Es un supuesto V1 single-tenant preexistente que afecta a todas las policies RBAC (0408, 0409…); no lo introduce 0408.
5. **Código muerto.** `lib/studio/shipment-milestone-notify.ts:78` (`notifyShipmentMilestoneToClient`) no tiene llamadores; es código muerto respecto del correo.
6. **E2E se cuelga en este entorno**, igual que en L21 según el Director:
   - tras 142 resultados, el último de mobile-safari, no hubo salida en 53 minutos;
   - el webServer mostró timeouts de 3000 ms al arrancar y el error de `proxy.ts:67` por falta de configuración Supabase.

   No se tocaron retries, timeouts, tests ni dependencias; la causa del cuelgue queda para una tarea de harness/E2E.
7. **Lint:** 8 advertencias preexistentes en `app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `app/studio/(app)/crm/_components/KommoBoardView.tsx:124` y `KommoClient.tsx:553`; ningún error.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR draft y sus checks por SHA, e integrar según el orden que decidas.
  - El corte coincide con el plan: L08 sin allowlist app/lib, sin dependencia SQL, sin facade 0410 e independiente de L10.
  - Acepta o rechaza explícitamente la validación parcial (E2E colgado y build cubierto por CI).
- **Compartidos:** `supabase/migrations-baseline.json` y `docs/specs/README.md`, con L19 #69, L21 #70, L20 #72, registro #71 y L15 #73 (todas draft al consultar `gh pr list`).
  - Hay que unir entradas y regenerar el índice sin elegir un lado; el merge driver `dtd-generated-records` está verificado en este clon.
  - La entrada 0408 va primera por orden numérico.
- **Release:** fusionar NO autoriza aplicar `0408_mailing_admin_rbac`.
  - Requiere OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`, de a una y con name exacto.
  - Antes de aplicar, repite esta auditoría contra el main vigente: cualquier consumidor nuevo que lea o escriba las seis tablas con sesión, o que invoque las dos RPC como authenticated, rompería para no-admin.
  - El postflight de la migración valida policies y ACL. Tras aplicar, retira la espera del baseline.
- **Sesiones consumidoras:** ninguna otra sesión usa este worktree. Owner de esta única sesión escritora: `c-l08-worker-20260911-claude`.
- **Cierre:**
  - commit selectivo de este handoff tras `guard --owner`, y push de la rama a sí misma;
  - body final de la PR #74 con el SHA final y consulta de la CI de ese SHA;
  - liberación con `node scripts/harness-worktree.mjs release --owner c-l08-worker-20260911-claude`; la PR registra el recibo efectivo.

  No se borran ni la rama ni el worktree.
