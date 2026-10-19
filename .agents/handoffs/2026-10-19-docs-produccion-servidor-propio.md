# Docs que todavía presentaban Supabase Cloud o Vercel como producción (Worker, 2026-10-19)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19, desde las 05:00Z |
| Owner / sesión | Worker de documentación lanzado por el Director · claim `worker-docs-produccion-vigente-20261019` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a18cb369c3393ca46` |
| Rama / base | `worktree-agent-a18cb369c3393ca46` · base `origin/main` `3f3a52cc1ff39ac97dfdc99a08c38b1e933af2a5` |
| SDD | no aplica: solo documentación, sin cambio de comportamiento |
| Pedido de Sam (literal, 2026-10-19, vía Director) | «trata de avanzar todos los pendientes… todas las tareas que puedas avanzar» |
| Autorización | commits en la rama, push de esta rama y PR en borrador. Sin merge, sin producción |
| Estado de la tarea | lista-para-revision |

## Objetivo

Buscar en todo el repo las menciones que presentan a Supabase Cloud
(`xpfuzqombmjmxvprjgmi`) o a Vercel como producción **vigente**, clasificarlas y
corregir solo las vigentes y equivocadas, con un cambio mínimo y un enlace al
runbook correcto.

Hechos de partida, verificados por el Director y releídos en las fuentes:

- Desde el corte del 2026-10-14 (02:00Z), producción es el Supabase del servidor
  propio: VPS de Contabo, contenedor `dtd-cargo-db-1`, `https://supabase.dtdcargo.com`
  (`docs/runbooks/servidor-contabo.md` §3.6, `docs/runbooks/aplicar-migraciones-prod.md` §0).
- Desde el 2026-10-16 la web corre en ese VPS y se publica sola con el vigilante
  (SDD-0541, `docs/runbooks/publicacion-automatica-web.md`). Vercel está en pausa y
  sin integración de Git (`.agents/handoffs/plan-retiro-vercel-supabase-20261016.md`,
  seguimiento del 2026-10-17).
- Cloud es la copia del corte y se pausa el 2026-10-28 (mismo plan).

## Método

Búsqueda por valor con `git grep -i -E` sobre lo rastreado:
`xpfuzqombmjmxvprjgmi|supabase\.co\b|vercel\.app|apply_migration|supabase cloud|vercel`,
y una segunda pasada por `execute_sql`, `deploy_edge_function`,
`supabase functions deploy`, `supabase secrets set`, «por MCP», «conector de Supabase».
Alcance: `docs/`, `.agents/` (skills y handoffs), `.claude/`, `AGENTS.md`, `CLAUDE.md`,
los README y los comentarios de `infra/`, `scripts/` y `.github/`. Las specs se
separaron por `status` con un script de lectura fuera del repo.

Las correcciones son **notas fechadas** al inicio del documento o junto a la línea,
salvo cuatro cambios en la propia línea (README raíz, `docs/agents/README.md`,
`setup-android-apk.md` y el prompt de videos). No se reescribió ningún registro.

## Tabla de menciones

### (a) Vigentes y equivocadas → corregidas (23 archivos)

| Archivo | Qué decía | Corrección |
|---|---|---|
| `docs/runbooks/setup-kommo-webhook.md` | URL del webhook en `xpfuzq….supabase.co`, secreto en «Edge Functions → Secrets», logs en el dashboard | Nota: URL `https://supabase.dtdcargo.com/functions/v1/kommo-webhook?secret=…`, secreto en `/srv/dtd-cargo/.env` (`env-set.sh --name`), recrear `functions` al rotar, `docker logs dtd-cargo-functions-1` |
| `docs/runbooks/deploy-kommo-push-client.md` | deploy por MCP/CLI a Cloud, URL de Cloud, `supabase secrets set`, «desplegada en Vercel» | Nota: URL del servidor, carpeta `functions/` armada desde el repo, `KOMMO_PUSH_DRY_RUN` en el `.env`, logs del contenedor |
| `docs/runbooks/deploy-kommo-writeback.md` | `apply_migration` o editor SQL, URL de Cloud, deploy en Vercel | Nota: migraciones con `aplicar-migraciones-prod.md`, URL del servidor, `functions_base_url`, job en el pg_cron del servidor |
| `docs/runbooks/activar-crm-kommo.md` | URL de Cloud, «deploy Vercel hecho», estado por MCP | Nota con el servidor y el pg_cron vigentes |
| `docs/runbooks/deploy-orden-venta-0072.md` | dashboard y SQL editor de Cloud, `apply_migration`, «push a main = Vercel» | Nota: registro histórico de junio; hoy migraciones y publicación por los runbooks vigentes |
| `docs/runbooks/setup-portal-auth.md` | «Proyecto Supabase: ref `xpfuzq…`» con enlaces al dashboard | Nota: Auth vive en el GoTrue del servidor; lo vigente es su sección Self-hosted |
| `docs/runbooks/setup-resend.md` | variables en Vercel y redeploy | Nota: `.env` del servidor, Variables del repo para `NEXT_PUBLIC_*`, recrear `web`, logs |
| `docs/runbooks/setup-resend-inbound.md` | variable en Vercel (Production) | Nota equivalente |
| `docs/runbooks/setup-telegram-bot.md` | `vercel env add … production`, redeploy, logs de Vercel, rotación en Vercel | Nota: `.env`, `telegram-webhook.sh set` (hecho el 2026-10-16 07:06Z), rotación en el servidor |
| `docs/runbooks/setup-web-push.md` | VAPID en Vercel, redeploy, cron limitado por el plan Hobby | Nota: VAPID ya en el `.env`, contenedor `cron` generado desde `vercel.json` |
| `docs/runbooks/setup-android-apk.md` | `DTD_ANDROID_CERT_SHA256` «en Vercel» | Cambio en la línea y nota: `.env` del servidor |
| `docs/runbooks/codex-engineering.md` ⚑ | «El repo documenta Vercel como publicador de main»; release con «ID de deployment READY» | Nota: el párrafo es histórico; publicación por el vigilante; equivalencias de evidencia y de vuelta atrás |
| `docs/engineering/project-rules.md` ⚑ | §«El último commit del push decide si hay deploy»: `ignoreCommand` de Vercel y «redesplegar a mano desde Vercel» | Nota «Histórico desde el 2026-10-16» al inicio de la sección. **Ese es el único cambio en este archivo** |
| `README.md` ⚑ | «**Vercel** para deploy» | Línea reemplazada: servidor propio, enlace al runbook de publicación |
| `docs/architecture/stack-tecnico.md` | foto del 2026-05-27 con DB `xpfuzq…` y Deploy en Vercel, sin marca de fecha vencida | Nota inicial y nota en §Deploy; la tabla queda como foto |
| `docs/architecture/mobile-pwa-roadmap.md` | «VAPID keys en Vercel» como acción #1 (estado «vigente 2026-06-16») | Nota en la cabecera |
| `docs/agents/README.md` | «logs del deploy (Vercel/etc)» | Línea: logs del contenedor `web` |
| `docs/marketing/servicios-infografias/videos/PROMPT-CODEX-VIDEOS.md` | «base de producción en la nube (`xpfuzq…`)» | Paréntesis corregido; la advertencia `pnpm dev` = PRODUCCIÓN se conserva |
| `docs/legal/privacidad/inventario-terceros.md` | Supabase recibe «Todo»; Contabo «todavía sin datos» | Nota sobre la tabla; la reescritura de filas es la H14, pendiente |
| `docs/legal/privacidad/registro-tratamiento.md` | §6/§9 con Supabase `us-east-1` como destino vivo | Nota en §6 |
| `docs/legal/privacidad/mapa-de-borrado.md` | fila «Supabase / Vercel: Todo» | Nota bajo la fila |
| `infra/ops/README.md` | «`import-from-cloud.sh` copia producción de Supabase Cloud» | Nota: Cloud ya no es producción; para probar, `entorno-prueba.md` |
| `docs/specs/0326-telegram-secret-header/spec.md` (in-progress) | «Corte alojado obligatorio», con pasos en Vercel | Nota fechada: el `setWebhook` limpio se hizo en el servidor; lo que quede va en el `.env` |

⚑ = fuente del piloto semántico de Graphify (`scripts/knowledge-policy.json`).

### (b) Históricas → no se editan

| Grupo | Archivos con coincidencias | Por qué |
|---|---|---|
| `.agents/handoffs/` | 137 (387 líneas) | evidencia fechada |
| Specs `done` | 84 (153 líneas) | registros cerrados |
| Specs no `done` con registros fechados | 40 | líneas «Deploy: el status de Vercel del merge dice…» (0522–0538), mediciones fechadas contra `xpfuzq…` (0253, 0258, 0278, 0365), motivos de diseño (0003, 0025, 0150, 0247, 0259, 0280, 0291), avisos «merge = deploy de Vercel» de su fecha (0468, 0479, 0484, 0500), recon de 0184 |
| Specs mixtas | 0473 y 0477 | sus citas de `vercel.json` son correctas (los horarios salen de ahí); las de Vercel como plataforma son de su fecha |
| `docs/governance/reviews/` y `BASELINE-*` | 70 y 25 | revisiones y líneas base fechadas; la SDD-0546 ya declaró históricas las revisiones |
| `docs/governance/README.md` | 1 | registro de cierre de MP-01 |
| `docs/archive/`, `docs/qa/`, `docs/audits/` | 4, 6 y 7 | transcripciones, QA y auditorías fechadas |
| `docs/investigacion/`, `docs/architecture/migracion-vps-2026-07*.md`, `mobile-audit.md`, `decisions/0001-…` | 2, 2, 1 y 1 | investigación y decisiones con fecha |
| `docs/operaciones/prompt-cierre-permisos-2026-08-07.md` | 1 | prompt fechado |
| `docs/marketing/README.md`, `seo.md`, `link-in-bio.md` | 3 | Previews de julio, verificación fechada del 301, casilla vieja |
| `docs/legal/privacidad/AUDITORIA-2026-07.md`, `revision-0473-…`, `revision-0487-…` | 3 | revisiones fechadas |
| `docs/design/studio/_norte/BRAND-DECISIONS.md` | 1 | incidente fechado |
| `docs/runbooks/kommo-webhook-tercero-qp1-nova.md`, `adjuntos-backup-antivirus-restore.md`, `assets/restauracion-laptop-2026-09-05/message.txt` | 3 | captura del 2026-08-24, cierre fechado y adjunto |
| `supabase/migrations/` (0084, 0136, 0472 y otras) y `supabase/tests/` | 37 y 1 | migraciones aplicadas: no se editan |
| Comentarios de `infra/ops/migrate/*.sh` y `infra/ops/web/corte-paso2.sh` | 5 | herramientas del traslado; se describen en su fecha |
| Comentarios de `scripts/check-build.mjs`, `scripts/norte.mjs`, `scripts/verify.mjs:539`, `scripts/check-edge-functions.mjs:28` | 4 | motivos de su fecha; no llevan a operar contra otra base |

### (c) Correctas → sin cambio

- Las fuentes del traslado: `servidor-contabo.md`, `aplicar-migraciones-prod.md` (§13 histórico),
  `publicacion-automatica-web.md`, `backup-restore-servidor.md`, `entorno-prueba.md`, el plan de retiro.
- Specs de la transición y guardas: 0505, 0540, 0541, 0544, 0546, 0547, 0548; 0164, 0248 y 0292
  (`vercel.json` sigue siendo la fuente del crontab); 0369 y 0440 (guardas de URL del E2E);
  0191 y 0192 (exclusiones); 0224 y 0235 (sus prohibiciones protegen igual: la lista de
  entornos permitidos es cerrada y no incluye producción).
- `docs/engineering/project-rules.md` §«Supabase MCP» (líneas 129-132 de la base): ya decía
  que producción es el servidor y que el MCP lee Cloud.
- `docs/agents/README.md:61`, `AGENTS.md:32` (genérico), `docs/governance/AGENT-BRIEF.md:39`,
  `docs/governance/research/skills-map.md`, `docs/design/studio/rediseno-erp-brief-2026-07-06.md`.
- Legales: `politica-cookies-DRAFT.md` (el nombre `sb-xpfuzq…-auth-token` se conservó a propósito),
  `politica-privacidad-DRAFT.md` y `DTDCARGO_Politicas_Digitales_v3_para_abogada.md` (genéricos),
  `revision-traslado-contabo-2026-10-09.md`, `privacidad/README.md`.
- `e2e/README.md` y `docs/runbooks/e2e-supabase-efimero.md`: hablan de un entorno de prueba en
  Cloud, no de producción (ver FUERA DE ALCANCE 6).
- Infra y scripts: `.github/workflows/build-image-prueba.yml`, `infra/ops/staging/verificar-aislamiento.sh`,
  `infra/dtd-cargo/compose.supabase.yml`, `cron/Dockerfile`, `cron/crontab`, `infra/dtd-cargo/README.md`,
  `infra/templates/proyecto/*`, `infra/ops/web/{publicar-web,smoke-web,telegram-webhook}.sh`,
  `scripts/check-migrations-applied.mjs` (mide el servidor desde la SDD-0548), `scripts/build-crontab.mjs`,
  `scripts/verify.mjs:484`, `scripts/e2e/sdd-0168-fixture.ts` (guarda).
- `.agents/skills/` y `.claude/`: sin menciones de Cloud o Vercel como producción.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `node scripts/build-docs-index.mjs --check` (`docs:check`) | árbol de trabajo sobre `3f3a52cc` | PASÓ: «índice sincronizado con 543 specs» |
| `node scripts/check-numbering.mjs` (`sdd:check`) | ídem | PASÓ: «sin números repetidos»; los ⏸ son choques históricos conocidos |
| `git diff --check` | ídem | PASÓ (sin salida) |
| Revisión de voseo en las líneas agregadas | `git diff -U0` | PASÓ: ningún imperativo voseante en lo nuevo |
| `node scripts/knowledge-sync.mjs status` (`knowledge:status`) | ídem | EJECUTADO, exit 0 con `ok: false`: estructural INVALID y semántico INVALID porque este worktree no tiene `graphify-out` (4.858 pendientes, 3.571 faltantes); piloto 0/16 verificados; Archify PENDING por `ARCHIFY_RUNTIME_MISSING`. Es el estado de un worktree nuevo, no lo causó este cambio |
| `pnpm verify` | — | NO EJECUTADO: solo documentación, por indicación del Director |
| `graphify update`, `knowledge:visual`, `knowledge:publish --preview` | — | NO EJECUTADO: el worktree no tiene derivados, una corrida pesada a la vez y el Director publica desde main |

Sin conexión al servidor ni a ninguna base. No se leyó ningún `.env`.

## Impacto documental y Graphify

- Documentos canónicos actualizados: los 23 de la tabla (a).
- **Fuentes del piloto semántico modificadas:** `docs/engineering/project-rules.md` (una nota de
  6 líneas al inicio de §«El último commit del push decide si hay deploy»), `docs/runbooks/codex-engineering.md`
  (una nota de 14 líneas después del párrafo «Pipeline observado») y `README.md` (una línea de la
  lista Stack). El Director emite sus recibos semánticos después del merge.
- `docs/marketing/README.md` no cambia: la corrección de `PROMPT-CODEX-VIDEOS.md` no agrega ni
  mueve archivos del árbol.

## COMMITS

- `d103c095` — docs: producción vigente es el servidor propio, no Supabase Cloud ni Vercel (los 23 documentos).
- El commit que contiene este documento.

## PR / BRANCH

- Rama `worktree-agent-a18cb369c3393ca46`, base `main`, PR en borrador (URL en el informe del Worker).

## PENDIENTES DE ESTA TAREA

- Ninguno dentro del alcance. Los recibos semánticos de las tres fuentes del piloto le tocan al
  Director después del merge.

## FUERA DE ALCANCE DETECTADO

1. **`infra/dtd-cargo/compose.yml`** (huella bloqueante del vigilante, de la sesión de Contabo): los
   comentarios de las líneas 98 («así lo hace hoy Vercel») y 111 («en Vercel se ve así») quedaron en
   presente. No se tocó; anotarlo para la próxima PR que toque ese archivo.
2. **`infra/dtd-cargo/.env.example`** (excluido por ser `.env*`): la línea 72 dice «la cookie de sesión
   que usa HOY Supabase Cloud» (el valor es correcto: se conservó a propósito) y las líneas 22, 93, 113 y
   119 hablan de paridad con Vercel. El `.env.example` raíz tiene 13 coincidencias sin revisar.
3. **`docs/runbooks/servidor-contabo.md`** (runbook de la sesión de Contabo): la cabecera dice «ninguna
   fase ejecutada al 2026-10-08» y la fila de la Fase 3 en §5 «Registro de ejecución» sigue «pendiente»,
   aunque §3.6 registra el corte. No se tocó.
4. **Hallazgo H14 de `revision-traslado-contabo-2026-10-09.md`:** reescribir las filas de Supabase, Vercel y
   Contabo de los tres documentos de privacidad (contrato, región, retención, borrado). Pedía hacerlo en la
   PR que cerrara la Fase 3. Aquí solo se agregaron notas; la reescritura la deciden Sam y la abogada.
5. **Comentarios de `infra/ops/migrate/*.sh`** («copia producción de Supabase Cloud», «las claves que hoy
   viven en Vercel»): no se editaron porque sus copias instaladas en `/srv/ops` se comparan con el repo.
   La aclaración quedó en `infra/ops/README.md`.
6. **E2E efímero sobre Cloud (NO VERIFICADO):** `e2e/README.md`, `docs/runbooks/e2e-supabase-efimero.md` y el
   fixture de la SDD-0168 crean branches de Supabase Cloud. Si dependen del proyecto `xpfuzq…`, dejarán de
   funcionar con la pausa del 2026-10-28. El plan de retiro (Fase 4, paso 4) le asigna a
   `e2e-supabase-efimero.md` una nota para el 2026-10-30.
7. **`docs/architecture/stack-tecnico.pdf`:** la misma foto de mayo, sin nota (binario).
8. **`scripts/e2e/sdd-0168-fixture.ts:169`:** la constante se llama `PRODUCTION_PROJECT_REF` y apunta a Cloud.
   Sigue protegiendo, pero el nombre ya no es exacto. Es código de pruebas.
9. **`docs/runbooks/kommo-webhook-tercero-qp1-nova.md`:** la captura del 2026-08-24 muestra el webhook propio en
   Cloud; la decisión sobre el webhook de `qp1-nova.ru` sigue abierta y no se revisó hoy.
10. **`README.md` raíz:** fuera de la línea corregida, sigue en «Pre-MVP, sin código» y con una ruta de otro equipo.
11. **SDD-0326:** para cerrarla falta evidencia de `getWebhookInfo` y del flujo `/start` en el servidor.
12. **Comentarios de `scripts/check-build.mjs`** («Replica lo que corre Vercel») y **`scripts/check-edge-functions.mjs:28`**
    («hoy NO hay CI»): están desactualizados, pero no llevan a operar contra otra base.

## HANDOFF AL DIRECTOR

- Revisar el diff (23 documentos más este handoff) y decidir el merge. No toca código, migraciones,
  `.env*` ni `compose.yml`. Como cada push a `main` construye una imagen, el merge dispara una publicación
  de la web con el mismo código: es el mismo efecto productivo de cualquier merge.
- Conflicto posible: la PR #280 también toca `docs/engineering/project-rules.md`, en otra sección
  (§«Identidad pública», alrededor de la línea 351). Mi cambio está en la línea 55. No se pisan.
- Después del merge: recibos semánticos de `docs/engineering/project-rules.md`, `docs/runbooks/codex-engineering.md`
  y `README.md`.
- Ownership: se libera el claim al terminar la escritura y el push.
