# Análisis por lotes de SDD-0235 (`codex/audit-hardening-20260801`) contra main

Dueño: Worker `worker-w4-analisis-0235-20260914`. Fecha: 2026-09-14. Estado: análisis completo; PR en borrador registrada en el [handoff](../../.agents/handoffs/analisis-audit-hardening-0235.md). Clasificación: interno. SDD: no corresponde reservar número; no se modifica la spec 0235.

## Veredicto

**No hay lotes de producto extraíbles: los 42 archivos de la rama ya están en main con el mismo blob (17) o en una versión posterior que contiene y amplía su conducta (25).** La rama `codex/audit-hardening-20260801` (head `ec7adeb9`, cinco commits del 2026-08-01, base común `c13dfa8c`) no se fusionó nunca como tal, pero su contenido entró a main por otra vía el mismo día y el 2026-08-03: el hotfix de 0325 (`1955474e`, en la línea principal desde `5a1723cf`, 2026-08-01) y el carril de Gobernanza 9 (`codex/governance-9-checklist-audit`, acta [REV-SGE-052](../governance/reviews/governance-9-consolidated-local-close-2026-08-01.md)), que «consolidó SDD-0235 con una sola implementación canónica» adoptando la cobertura conductual de `codex/sdd-0235-continuity` y llegó a la línea principal con el merge `76b242bd` (2026-08-03). Los trece commits de main con «SDD-0235» en el asunto no comparten patch-id con los cinco de la rama: `git cherry -v main origin/codex/audit-hardening-20260801` marca los cinco como `+`. Por eso el conteo «5 commits · 42 archivos» del inventario de ramas engaña: mide historia, no contenido.

En producción también está cerrado: `0325` se aplicó el 2026-08-01 (sección «Estado de rollout · hotfix 0325» de la [spec en main](../specs/0235-audit-hardening-adjuntos-y-datos/spec.md)) y `0326`–`0329` se aplicaron una por una el 2026-08-03 con entradas de ledger `20260803091250`, `20260803091325`, `20260803091348` y `20260803091410` ([REV-SGE-054](../governance/reviews/governance-0326-0329-production-close-2026-08-03.md), gate verde con 332 archivos). Con `cutoff` 238 en [`migrations-baseline.json`](../../supabase/migrations-baseline.json), las cinco siguen vigiladas por `migrations-applied`; ninguna se declaró excepción.

**Corrección al [dictamen del 2026-09-12 §3](../../.agents/handoffs/director-dictamen-ramas-20260912.md):** afirma que «el endurecimiento nunca se integró» porque la spec sigue `approved`. La evidencia muestra lo contrario: código integrado, migraciones aplicadas y pruebas conductuales más fuertes que las de la rama. Lo que nunca se cerró es el estado documental: la spec y dos documentos de privacidad en main todavía dicen que `0326`–`0329` «permanecen sin aplicar» (ver fuera de alcance). El rescate por lotes que recomendaba el dictamen no tiene materia; la recomendación pasa a ser cierre documental y descarte autorizado de la rama.

## Identidad y método

- `main` asignado y HEAD de este worktree: `b07ad98bda4da35086d8207640321a7995fc8f24`.
- Rama fuente, solo lectura: `origin/codex/audit-hardening-20260801` = `ec7adeb98a2e03f398cc004f9dbab75f19b68b2c`. Commits propios: `a87a1d71` (docs), `ac6d5f2e` (migraciones y contratos), `5be7b06d` (aplicación y pruebas), `7f12627a` (handoff), `ec7adeb9` (confirmar publicación); todos del 2026-08-01 entre 08:38 y 08:48 -0400.
- Base común: `c13dfa8cd30dd5095abdcad32f28245569c47c56` (2026-08-01 08:15). `main` acumula 1420 commits desde esa base.
- Git `2.55.0.windows.5`. Rama escritora `codex/analisis-audit-hardening-0235`; guard y claim PASÓ.
- `git diff --name-status BASE RAMA` define las 42 rutas, sin renames. Los blobs salen de `git rev-parse RAMA:ruta`, `main:ruta` y `BASE:ruta`. `git merge-tree --write-tree main RAMA` reporta los choques textuales. `git diff RAMA main -- ruta`, filtrado a líneas `-`, aísla lo que solo tiene la rama. `git log BASE..main -- ruta` da el commit que superó cada archivo. Producción no se consultó: el estado del ledger se toma de actas fechadas que ya están en main.
- Regla de clasificación. **IDÉNTICO EN MAIN**: mismo blob. **SUPERADO EN MAIN**: main contiene la conducta o el contenido del delta de la rama, verificado línea a línea, aunque el texto difiera o Git reporte conflicto; se cita el commit que lo trajo y los que lo ampliaron. **VIGENTE**: la rama aporta una conducta o contenido ausente en main. **EN CONFLICTO**: main cambió el mismo tramo y la rama aún aporta algo distinto que exigiría resolución manual. La columna «choque» registra lo que reporta `merge-tree`; no decide la clase.
- Nada de la rama se copió al árbol. Solo se escribieron este documento y el handoff.

Salida agregada medida:

```text
git merge-base main origin/codex/audit-hardening-20260801
c13dfa8cd30dd5095abdcad32f28245569c47c56

rutas=42  identico=17  superado=25  vigente=0  en-conflicto=0
merge-tree: content=13  add/add=7  modify/delete=2  fusion-limpia=1  sin-solape=2
git cherry -v main RAMA: 5 commits '+' (ningún parche equivalente por patch-id)
```

## Tabla archivo por archivo

`A/M` es el estado desde la base común. Los blobs son IDs Git abreviados, no commits. `main` = `b07ad98b`; rama = `ec7adeb9`. Los números de línea citados son de la versión en `main`.

| # | Ruta | A/M | Blob rama / main | Clase | Superado por | Choque | Evidencia |
|---:|---|---|---|---|---|---|---|
| 1 | `.agents/handoffs/2026-08-01-audit-hardening-close.md` | A | `6cf1f32a` / ausente | SUPERADO (documental) | `495e0970` (REV-SGE-052), `dc8e77bd` (REV-SGE-054) | no | Handoff de cierre de la propia rama: verificación local del 2026-08-01 y «integrador exclusivo pendiente». `git rev-parse main:<ruta>` falla y `ls .agents/handoffs` no lo tiene bajo otro nombre. Su siguiente paso quedó ejecutado y documentado por las actas de Gobernanza 9. Único blob de la rama sin equivalente en main. |
| 2 | `.env.example` | M | `9e1c3f51` / `53ba7784` | SUPERADO | `5a2962c7` → `8ffaa0a9`, `6e75ae50` (SDD-0224), `b301eb8a` | content | Las seis claves que agrega la rama existen en main: `AV_PROVIDER` l.252, `AV_SIGNATURE_UPDATED_AT` l.253, `AV_EICAR_VERIFIED_AT` l.259, `OBJECT_LOCK_VERIFIED_AT` l.281, `RESTORE_DRILL_VERIFIED_AT` l.282, `NEXT_PUBLIC_BUG_REPLAY_ENABLED=0` l.305. Solo-rama: `BACKUP_REGION=` vacío (main `=auto`) y `DRILL_VERSION_ID`, retirada con R2, que no devuelve `VersionId`. |
| 3 | `app/api/cron/purge-throttle/__tests__/route.test.ts` | M | `e80056ad` / `1ac72b96` | SUPERADO | `1955474e` → `ab86cd12`, `004b1300` (DTD-0455) | content | La aserción de la rama (`tables` = registro + PIN, `deleted` 10) quedó cubierta y ampliada: main afirma `count: "exact"` en cada DELETE y tres tablas. |
| 4 | `app/api/cron/purge-throttle/route.ts` | M | `b5946d7b` / `98f1e171` | SUPERADO | `1955474e` → `ab86cd12` (DTD-0455) | content | main purga `operario_pin_attempts` (l.71) y además `public_verify_throttle` (l.80) con `deletedByTable` (l.96–98). Las dos líneas solo-rama son la suma `deleted` sin el tercer contador. |
| 5 | `app/api/studio/__tests__/route-auth.test.ts` | A | `97b2fd35` / `8697a86b` | SUPERADO | `b6dc4f71`, `02254b36`, `028f5c3a` → `f4f0f382` (SDD-0286) | add/add | La rama traía 25 líneas de grep estático sobre el fuente; main tiene nueve casos conductuales: 401 sin sesión en shipments/KPIs/conversaciones, 403 sin permiso de tracking en PATCH/DELETE, módulo ausente en GET y lecturas legítimas preservadas. |
| 6 | `app/api/studio/conversaciones/[id]/route.ts` | M | `dd256559` / `964ac7d4` | SUPERADO | `5a2962c7` → `f4f0f382` (SDD-0286), `f9bbf24d` (SDD-0354–0356) | content | main: `auth.getUser()` y 401 (l.32–34) más `moduleViewDenial(supabase, "conversaciones")` (l.36). Solo-rama: `getClientContext(...)`, sustituido por RPC minimizada. |
| 7 | `app/api/studio/kpis/route.ts` | M | `5f128a59` / `4241f9c9` | SUPERADO | `5a2962c7` → `f4f0f382` | content | main: 401 (l.36–38) más `moduleViewDenial(supabase, "dashboard")` (l.40). Cero líneas solo-rama. |
| 8 | `app/api/studio/shipments/[id]/route.ts` | M | `549746f9` / `2ca7e139` | SUPERADO | `5a2962c7` → `f4f0f382` | content | main conserva `requireStudioSession()` (l.21–23), 401 en GET/PATCH/DELETE (l.64, 86, 144), `moduleEditDenial` en PATCH/DELETE (l.87, 145) y añade `moduleViewDenial` en GET (l.65). Solo-rama: la línea de import, reescrita para traer ambos guards. |
| 9 | `app/m/cn/login/actions.ts` | M | `d862b1ee` / `68fc6d76` | SUPERADO | `1955474e` → `6254e1f1` (SDD-0443) | no (fusión limpia) | El único cambio de la rama, `signInWithPin(pin, "cn")`, está en main l.23. La línea solo-rama `redirect("/m/cn")` es la conducta anterior a SDD-0443 (conservar caja QR tras el PIN). |
| 10 | `app/m/ve/login/actions.ts` | M | `3282e58d` / `3282e58d` | IDÉNTICO | `1955474e` | no | Mismo blob. |
| 11 | `app/noticias/[slug]/_components/FaqPageJsonLd.tsx` | M | `0d1bd32b` / ausente | SUPERADO | `5a2962c7` → eliminado en `20064ed1` (SDD-0301) | modify/delete | main recibió el mismo cambio (`serializeJsonLd`) el 2026-08-01 y podó el componente el 2026-08-26; `git grep FaqPageJsonLd main -- app lib` no devuelve consumidores. Resucitarlo revertiría la poda. |
| 12 | `app/noticias/[slug]/_components/NewsArticleJsonLd.tsx` | M | `5043710b` / `5043710b` | IDÉNTICO | `5a2962c7` | no | Mismo blob. |
| 13 | `app/portal/(auth)/login/__tests__/actions.test.ts` | A | `2875948d` / ausente | SUPERADO | `dcfa6e0c` → movido por `9d8f2b68` (SDD-0276) | no | main lo tuvo en esa ruta el 2026-08-01 y lo reemplazó por `app/entrar/__tests__/actions.test.ts`, conductual, con mocks de throttle y envío, al unificar la puerta pública. |
| 14 | `app/portal/(auth)/login/actions.ts` | M | `2fc4dc12` / ausente | SUPERADO | `dcfa6e0c` → `9d8f2b68` (SDD-0276) | modify/delete | Las tres protecciones de la rama viven en [`app/entrar/actions.ts`](../../app/entrar/actions.ts): `THROTTLE_PREFIX = "portal-login:"` (l.14), `genericSuccess` (l.28) y `shouldCreateUser: false` (l.48). main añade cerrojo por email (`portal-login-mail:`, límite 5) y pipeline propio de magic link. |
| 15 | `app/studio/(app)/_actions/__tests__/deployActions.test.ts` | A | `9f7d639b` / `1b9fab3f` | SUPERADO | `b6dc4f71` | add/add | Grep estático de 12 líneas frente a tres casos conductuales con mocks de sesión y rol: rechaza sin sesión, rechaza no admin, preserva admin local. |
| 16 | `app/studio/(app)/_actions/deployActions.ts` | M | `7f8150f0` / `7f8150f0` | IDÉNTICO | `5a2962c7` | no | Mismo blob; guard `getStudioRole` y `role !== "admin"` (l.50–53). |
| 17 | `app/studio/(app)/ve/__tests__/actions-auth.test.ts` | A | `b1afc818` / `b1afc818` | IDÉNTICO | `5a2962c7` | no | Mismo blob: la «prueba adicional de autorización VE» que cita REV-SGE-052. |
| 18 | `app/studio/_components/bug-reporter/BugTechCaptureProvider.tsx` | M | `c81bd32e` / `98d7a9d9` | SUPERADO | `24240844` | content | main condiciona `rrwebCapture.install()` con el helper `bugReplayEnabled()` importado de `bug-rrweb-capture` (l.27–30, 38) en lugar del `process.env` inline de la rama. Misma conducta: apagado salvo `NEXT_PUBLIC_BUG_REPLAY_ENABLED === "1"`. |
| 19 | `docs/legal/privacidad/evaluacion-proveedor-respaldo-externo.md` | M | `be5eb072` / `55b207c6` | SUPERADO | `8857aca3` → `d2941d3d`, `7a567dd4`, `28a718c6` (SDD-0224) | content | La rama recomendaba AWS S3 + GuardDuty como preferida (§10 comparativo, fecha 2026-08-01). main (2026-08-04) registra la selección operativa Cloudflare R2 + ClamAV, AWS como primera selección conservada y precios R2. Las 152 líneas solo-rama son la redacción previa a esa decisión. |
| 20 | `docs/legal/privacidad/mapa-de-borrado.md` | M | `443c79b9` / `7462ba45` | SUPERADO | `1955474e` → `09f83a9e`, `bab07a73`, `630b81ac` | content | main tiene la fila `operario_pin_attempts` (l.188) y una §8 «Rollout Cloud SDD-0235» (l.265) posterior a la §8 «pendientes de Cloud» de la rama. La §8 de main también quedó desfasada; ver fuera de alcance. |
| 21 | `docs/legal/privacidad/registro-tratamiento.md` | M | `42da16b5` / `66c363c2` | SUPERADO | `1955474e` → `09f83a9e`, `bab07a73`, `630b81ac`, `2e34df9a` | content | main va por la versión 1.4 (2026-09-11) con la §4.2 de la rama y filas corregidas: `operario_pin_attempts` CORRECTO en Cloud (l.94) y `public_track_log` «sin cron ni DELETE» (l.95), que desmiente el «48 h en cron» de la rama. |
| 22 | `docs/runbooks/adjuntos-backup-antivirus-restore.md` | A | `7600b594` / `2bb795c0` | SUPERADO | `8857aca3` → `b825a270`, `d2941d3d`, `7a567dd4`, `68c81784`, `28a718c6`, `25e56d03` | add/add | main: «Estado: R2 configurado; 0346 y código desplegados; antivirus y piloto apagados» (l.4), §2 «Seleccionada · Cloudflare R2 + ClamAV» y «Alternativa conservada · AWS S3 + GuardDuty» (l.21, 54). Las 34 líneas solo-rama son la opción AWS como prioritaria. |
| 23 | `docs/specs/0235-audit-hardening-adjuntos-y-datos/allowlist.md` | A | `a7f990eb` / `a7f990eb` | IDÉNTICO | `1955474e` | no | Mismo blob. |
| 24 | `docs/specs/0235-audit-hardening-adjuntos-y-datos/spec.md` | A | `c5d847d4` / `cbc7c345` | SUPERADO | `1955474e` | add/add | `git diff main RAMA` solo quita la sección «Estado de rollout · hotfix 0325» (12 líneas): la rama es subconjunto estricto de main. `status: approved` en ambas. |
| 25 | `lib/auth/__tests__/operario-session.test.ts` | A | `40a5abab` / `40a5abab` | IDÉNTICO | `1955474e` | no | Mismo blob. |
| 26 | `lib/auth/operario-session.ts` | M | `e03062d1` / `e03062d1` | IDÉNTICO | `1955474e` | no | Mismo blob; consumidor de la firma server-only de `verify_operario_pin` (0325). |
| 27 | `lib/public/__tests__/json-ld.test.ts` | A | `9c5ea0e4` / `260b242f` | SUPERADO | `87fc9117` | add/add | main conserva el caso `</script>` y añade el de ida y vuelta («preserva contenido estructurado legítimo»); además `app/__tests__/json-ld-escape-contract.test.ts` exige `serializeJsonLd()` en todo bloque `ld+json`; SDD-0303 (`in-progress`) lo extiende a `components/`. |
| 28 | `lib/public/json-ld.ts` | A | `63c948c6` / `5e4f59f1` | SUPERADO | `87fc9117` | add/add | Cuerpo idéntico (`JSON.stringify(value).replace(/</g, "\\u003c")`); solo difiere el comentario de cabecera. Consumido por faq, glosario, importar-de-china y `NewsArticleJsonLd`. |
| 29 | `lib/studio/__tests__/bug-rrweb-capture.test.ts` | A | `2125b936` / `5f28d537` | SUPERADO | `24240844` | add/add | main prueba las funciones (`bugReplayEnabled(undefined/"0"/"true"/"1")`, `maskReplayText("Cédula V-12.345.678") === "***"`) en vez de leer el fuente con `readFileSync`. |
| 30 | `lib/studio/attachments/__tests__/pilot-gate.test.ts` | M | `3c5c6004` / `a0558f31` | SUPERADO | `4dad5924` → `8ffaa0a9`, `6e75ae50` (SDD-0224) | content | main cubre los dos casos de la rama (`antivirus_not_verified`, `restore_not_verified`) y añade `object_lock_not_verified`, `contract_not_verified`, `pipl_not_verified` y el camino R2. |
| 31 | `lib/studio/attachments/pilot-gate.ts` | M | `db0faa7e` / `234813b1` | SUPERADO | `4dad5924` → `8ffaa0a9`, `6e75ae50` | content | main conserva las tres razones de la rama (l.8, 11–12) y las endurece: frescura de timestamps (24 h AV, 93 d lock/restore), regla de lock R2 ≥ 3654 días, contrato y PIPL (l.60–98). |
| 32 | `lib/studio/bug-rrweb-capture.ts` | M | `33205fb3` / `237daba5` | SUPERADO | `24240844`, `028f5c3a` | content | main tiene `maskTextFn: maskReplayText` (l.73), `maskReplayText` exportada (l.47) y `bugReplayEnabled` leyendo `NEXT_PUBLIC_BUG_REPLAY_ENABLED` (l.42). Las dos líneas solo-rama son el lambda inline `() => "***"` y su comentario. |
| 33 | `supabase/migrations/0325_operario_pin_login_hardening.sql` | A | `a0c859cc` / `a0c859cc` | IDÉNTICO | `1955474e` | no | Mismo blob. Aplicada en producción el 2026-08-01 como hotfix nominal (spec, «Estado de rollout · hotfix 0325»). |
| 34 | `supabase/migrations/0326_public_tracking_privacy_throttle.sql` | A | `883a20ee` / `883a20ee` | IDÉNTICO | `b3899eea` | no | Mismo blob. Aplicada 2026-08-03, ledger `20260803091250` (REV-SGE-054). |
| 35 | `supabase/migrations/0327_internal_function_grants.sql` | A | `343a1803` / `343a1803` | IDÉNTICO | `b3899eea` | no | Mismo blob. Aplicada 2026-08-03, ledger `20260803091325`. |
| 36 | `supabase/migrations/0328_camionero_dispatch_assignment.sql` | A | `ff1fa86f` / `ff1fa86f` | IDÉNTICO | `b3899eea` | no | Mismo blob. Aplicada 2026-08-03, ledger `20260803091348`. |
| 37 | `supabase/migrations/0329_user_profiles_tenant_scope.sql` | A | `4ed02208` / `4ed02208` | IDÉNTICO | `b3899eea` | no | Mismo blob. Aplicada 2026-08-03, ledger `20260803091410`. |
| 38 | `supabase/tests/0325_operario_pin_login_hardening.test.sql` | A | `52bf0211` / `52bf0211` | IDÉNTICO | `1955474e` | no | Mismo blob; contrato que corre `node scripts/run-sql-tests.mjs`. |
| 39 | `supabase/tests/0326_public_tracking_privacy_throttle.test.sql` | A | `8f5c9acb` / `8f5c9acb` | IDÉNTICO | `b3899eea` | no | Mismo blob. |
| 40 | `supabase/tests/0327_internal_function_grants.test.sql` | A | `381d0ae2` / `381d0ae2` | IDÉNTICO | `b3899eea` | no | Mismo blob. |
| 41 | `supabase/tests/0328_camionero_dispatch_assignment.test.sql` | A | `21f8b20b` / `21f8b20b` | IDÉNTICO | `b3899eea` | no | Mismo blob. |
| 42 | `supabase/tests/0329_user_profiles_tenant_scope.test.sql` | A | `8bfaf84c` / `8bfaf84c` | IDÉNTICO | `b3899eea` | no | Mismo blob. |

Lectura transversal por objetivo de la spec (numeración de su sección «Objetivo»): 1 PIN por tenant/región y huella de IP → filas 10, 26, 33, 38 idénticas y purga en fila 4. 2 tracking público → fila 34 aplicada; su consumidor `lib/public/tracking-queries.ts` está huérfano porque `/track` redirige a `/portal/login` ([reglas técnicas](../engineering/project-rules.md), tabla de integraciones). 3 grants, camionero y `user_profiles` → filas 35–37. 4 sesión y permisos en acciones y APIs → filas 5–8, 15–17, superadas por SDD-0286. 5 enumeración del portal → filas 13–14 en `/entrar`. 6 JSON-LD → filas 11–12, 27–28 y SDD-0303. 7 rrweb → filas 18, 29, 32. 8 gate de adjuntos → filas 2, 30–31, endurecidas por SDD-0224. 9 runbook y gates externos → filas 19, 22. 10 pruebas de regresión → en main son conductuales, no grep del fuente.

## Lotes propuestos

Como no queda contenido vigente, no se propone ningún lote de extracción de código ni de SQL. Lo que sí queda abierto son tres unidades de cierre, ninguna con migración asignada ni necesaria. Cada una tendría su tarea, owner y allowlist propios; este documento no las ejecuta.

| Lote | Archivos | Riesgo | Orden y condición de arranque | Migración | Pruebas | Spec que lo cubre |
|---|---|---|---|---|---|---|
| **C1 · Cierre documental de SDD-0235 en main** | `docs/specs/0235-audit-hardening-adjuntos-y-datos/spec.md` (estado y sección «Estado de rollout»), `docs/legal/privacidad/mapa-de-borrado.md` §8, `docs/legal/privacidad/registro-tratamiento.md` §4.2 fila `public_track_log`, `docs/specs/README.md` regenerado con `pnpm docs:index` | Privacidad, solo documental: los tres textos afirman hoy que `0326`–`0329` siguen fuera de producción, contra REV-SGE-054. Sin riesgo de auth, adjuntos ni API. | Primero; independiente. Arranca cuando Sam decida el estado final de la spec (decisión 1). Las filas de privacidad se redactan con `CORRECTO`/`ENCONTRADO`/`NO VERIFICABLE` citando el acta, sin consultar producción. | Ninguna | `pnpm docs:check`, `pnpm sdd:check`, verificación de enlaces; `revisar-datos-ve` en modo advisory sobre los dos documentos legales | 0235 (cambio de estado, no de alcance); referencia cruzada a 0455 |
| **C2 · Descarte autorizado de la rama remota** | Ninguno en el repo; operación Git sobre `origin/codex/audit-hardening-20260801` | Ninguno de producto. Pérdida del único blob sin equivalente (`6cf1f32a`, handoff histórico), mitigable con este documento, que registra head y blob, o con un tag de archivo. | Después de C1 o en paralelo; arranca solo con la autorización de Sam (decisión 2). Cumple las condiciones del runbook: evidencia de integración (esta tabla), sin worktree local sobre la rama (`git worktree list`), sin PR abierta (`gh pr list --head` vacío). | Ninguna | `git branch -r --contains` y verificación posterior de que `main` no cambia | Ninguna: es limpieza de Gobernanza, no producto |
| **R1 · Residual funcional fuera de la rama: retención de `public_track_log`** | `app/api/cron/purge-throttle/route.ts` y su test; `docs/legal/privacidad/registro-tratamiento.md` §4.2; migración solo si la retención se fija en SQL (no hay número asignado) | Privacidad y API de cron: la tabla guarda huella desde 0326 pero las filas previas pueden conservar IP cruda y no existe purga ([SDD-0455](../specs/0455-purge-public-verify-throttle/spec.md), hallazgo «`public_track_log` no tiene purga»). | Después de que Sam fije la política de retención (decisión 3). No es extracción de la rama: la rama nunca tuvo esa purga; es el criterio de aceptación de 0235 «el throttle y su purga tienen tests» que quedó parcial. | Solo si se decide SQL; la asignaría el Director | Vitest del cron con `count: "exact"` por tabla; contrato SQL si hay migración; `pnpm verify` | Spec nueva, `related` 0235, 0326 y 0455 |

Orden operativo recomendado: C1 → C2. R1 es independiente y solo depende de la decisión de retención. Ninguno de los tres exige tocar `cutoff`, `pendingBelowCutoff` ni el ledger.

## Descarte recomendado

Se recomienda descartar la rama completa `codex/audit-hardening-20260801`, es decir sus 42 rutas y sus cinco commits, con la autorización que exige AGENTS para borrar una rama remota. Evidencia:

- 17 rutas con blob idéntico en main (filas 10, 12, 16, 17, 23, 25, 26, 33–42), incluidas las cinco migraciones y sus cinco contratos SQL.
- 25 rutas superadas por versiones posteriores que contienen la conducta de la rama y la amplían (filas 1–9, 11, 13–15, 18–22, 24, 27–32), con el commit citado en cada fila y sin ninguna línea solo-rama que aporte una protección ausente en main.
- Ninguna ruta EN CONFLICTO semántico: los 22 choques textuales que reporta `merge-tree` son versiones más viejas del mismo cambio, incluidos los dos modify/delete (`FaqPageJsonLd.tsx` podado por SDD-0301; login del portal trasladado a `/entrar` por SDD-0276).
- Migraciones aplicadas en producción según actas fechadas (REV-SGE-054), sin excepción en el baseline.
- La rama no tiene PR abierta ni cerrada (`gh pr list --head codex/audit-hardening-20260801 --state all` devuelve vacío) ni worktree local registrado.

Mientras no se borre, cualquier inventario basado en `git log main..rama` seguirá contándola como «5 commits · 42 archivos» pendientes, como ocurrió en el dictamen del 2026-09-12. Si se prefiere conservar historia, la alternativa es un tag de archivo sobre `ec7adeb9` y el borrado de la rama; el tag preserva el handoff `6cf1f32a`.

## Decisiones que solo Sam puede tomar

1. **Estado final de SDD-0235.** Pasar a `done` reconociendo el cierre por otra vía, o mantener `approved` hasta cerrar el residual R1. Nueve de sus diez objetivos están cumplidos y aplicados; el criterio «el throttle y su purga tienen tests» del tracking público queda parcial porque `public_track_log` no tiene purga. Si se elige `done`, el residual debe quedar nombrado en una spec nueva, no diluido.
2. **Borrado de la rama remota `codex/audit-hardening-20260801`** (lote C2), con o sin tag de archivo. El runbook exige autorización específica por rama; la evidencia de integración está en este documento.
3. **Política de retención de `public_track_log`** (lote R1): plazo de purga de las huellas y qué hacer con las filas anteriores a 0326 que pueden conservar IP cruda (sin backfill). Es una decisión de privacidad, no técnica; el código solo la ejecuta.
4. **Retención y aviso de rrweb** si alguna vez se habilita `NEXT_PUBLIC_BUG_REPLAY_ENABLED=1`: la fila de `registro-tratamiento.md` §4.2 mantiene la retención en ⬜. Hoy está apagado por defecto y no captura nada; no requiere acción mientras siga así.

## Validación y límites

- PASÓ: guard y claim sobre `codex/analisis-audit-hardening-0235` en HEAD `b07ad98b`.
- PASÓ: inventario de 42 rutas con blobs de rama, main y base; `merge-tree` con 22 choques; `git cherry` con cinco `+`; diffs filtrados por archivo; historia por ruta desde la base.
- PASÓ: `corepack pnpm docs:check`, «índice sincronizado con 452 specs», sin cambios en `pnpm-lock.yaml` ni en el árbol.
- PASÓ: verificación de enlaces relativos de este documento y del handoff con un script propio; `git diff --check`. Resultados en el handoff.
- NO EJECUTADO: `pnpm verify`, porque la tarea no cambia producto, SQL ni harness; los tests de main citados se leyeron, no se corrieron.
- NO EJECUTADO: consulta al ledger de producción, prohibida por el encargo; el estado de 0325–0329 se toma de la spec y de REV-SGE-054.
- Límite: la equivalencia se demostró por blob y por lectura línea a línea de los deltas; no se ensambló ni compiló la rama. Los números de línea corresponden a `main` en `b07ad98b` y envejecen con cada merge.

## Fuera de alcance detectado

- **Textos desfasados en main sobre el rollout de 0326–0329.** La spec 0235 (líneas 37–38, «`0326`–`0329` permanecen sin aplicar»), `mapa-de-borrado.md` §8 (l.272, «siguen fuera de Producción») y `registro-tratamiento.md` §4.2 (l.95, `public_track_log` «Cloud NO VERIFICABLE») contradicen REV-SGE-054 (aplicadas el 2026-08-03). Es materia del lote C1; no se corrigió aquí porque las specs quedan excluidas del alcance.
- **El dictamen del 2026-09-12 §3** debe corregirse: la rama sí se integró por otra vía; recomendación cambia de «rescate por lotes» a «cierre documental y descarte autorizado».
- **Método de inventario de ramas.** `git log main..rama` y `git cherry` no detectan integraciones re-aterrizadas con otros commits; comparar blobs por ruta (`git rev-parse rama:ruta` frente a `main:ruta`) sí. Conviene incorporarlo al briefing del Director antes de dictaminar ramas antiguas; el mismo patrón puede afectar a `codex/governance-final-100` y `codex/portal-colors-reception-integration-20260906`, que el dictamen dejó en revisión propia.
- **`lib/public/tracking-queries.ts` huérfano** (ya documentado en reglas técnicas): el beneficio en runtime de 0326 es latente mientras `/track` redirija al portal. No es un defecto de la rama ni de main.
- **La [radiografía del 2026-08-02](2026-08-02-radiografia-erp.md) fila 23** afirmaba que 0326–0329 vivían solo en la rama; era cierto ese día y quedó resuelto el 2026-08-03. Evidencia fechada, sin acción.
- `corepack pnpm docs:check` instaló dependencias automáticamente al no existir `node_modules` (pnpm 12); el lockfile no cambió. Se registra por transparencia.

## Índice

`docs/README.md` ubica las auditorías en la carpeta `docs/audits/` sin listar archivos, y `docs/audits/` no tiene índice propio; los análisis del bloque C tampoco figuran en ningún índice. No corresponde agregar una entrada. Documentos hermanos: [plan del bloque C](c-analisis-bloque-c.md) y [mapa de solapamientos](c-analisis-bloque-c-solapamientos.md).
