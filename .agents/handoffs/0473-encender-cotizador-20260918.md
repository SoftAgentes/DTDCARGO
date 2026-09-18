# Handoff 0473 — Encender el cotizador: cadencia del cron y alcance de la bandera

- Fecha: 2026-09-18. Estado de la tarea: **lista para revisión**, sin publicar (ver PR / BRANCH).
  Encender en producción **bloqueado por la compuerta de privacidad** (decisión de Sam).
- Owner/sesión: `worker-encender-cotizador-0473-claude-20260918` (Claude Code).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/encender-cotizador-0473`.
- Rama: `codex/encender-cotizador-0473`, creada con `harness-worktree start` desde `origin/main` =
  `78410913`. Guard OK y claim adquirido antes de editar.
- SDD: [0473](../../docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md),
  `in-progress`, con la ampliación del 2026-09-18 y su allowlist. No se reservó número nuevo.
- Permisos del encargo (`$worker`, Sam): implementar, probar, commits locales. **El encargo no
  nombra publicación**: rama y PR quedan preparadas, sin push. Nada de producción: ni variables de
  Vercel, ni datos, ni migraciones. Supervisión: dtdcargo-53; integración y producción: dtdcargo-18.

## OBJETIVO ORIGINAL

«Encender el cotizador desde la proforma (bandera `DOCUMENT_IMPORT_ENABLED` de 0473): antes hay
que revisar de nuevo la cadencia del cron».

## LA CADENCIA, REVISADA: vuelve a cada minuto

PR #133 la bajó a `*/5` el 2026-09-17 **porque la bandera estaba apagada** (el handler corta antes
de abrir la base). Su handoff dejó como pendiente reevaluarla antes de encender. Reevaluada:

| Qué depende del tick | Con `* * * * *` | Con `*/5 * * * *` |
|---|---|---|
| Reintento tras fallo pasajero (`available_at = attempts × 60 s`) | 1–2 min, luego 2–3 min | 1–6 min, luego 2–7 min |
| Visitante esperando el error final (3 intentos fallidos) | hasta ~5 min | hasta ~13 min |
| Rescate de un proceso muerto (lease 3 min) | ≤ 4 min | ≤ 8 min |
| Caudal del cron (1 job por tick) | 60/h | 12/h |

El caudal **no** es el problema: el camino feliz lee en el acto (`after()` en `http.ts`) y el tope
diario por defecto es de 100 lecturas (`DOCUMENT_IMPORT_DAILY_JOBS`). Lo que importa es la
**espera del visitante**, que mira «En cola» en la pantalla (sondea cada 2,5 s). Con `*/5` el
escalón de reintento deja de escalonar y la espera se triplica. Por eso: `* * * * *`.

No se cambió el drenaje a varios jobs por tick: con el tope diario y el `after()` como camino
principal no hace falta, y meter un bucle con presupuesto de tiempo contra `maxDuration = 180`
añade riesgo sin ganancia medible hoy. Queda anotado para cuando haya volumen.

Para que las dos mitades no se vuelvan a desalinear sin decidirlo: el escalón se llama
`RETRY_STEP_MS` en `jobs.ts`, y `cron-cadence.test.ts` exige que `vercel.json` dispare al menos una
vez por escalón y que el lease de la 0457 (3 min) cubra el `maxDuration` de las dos rutas que
procesan (cron y API).

Costo: con la bandera encendida son ~43.200 invocaciones/mes (cada una: limpieza + un claim).
Mismo orden que `push-drain` y `client-notifications-drain`, que ya corren cada minuto.

## LO QUE APARECIÓ AL REVISAR: la bandera enciende más que el cotizador

`DOCUMENT_IMPORT_ENABLED` también enciende la carga de documentos en el **paso 2 de la compra del
portal** (`PurchaseStepDetalle` → `DocumentImportEntry`). Comprobado en el código:

1. El cliente sube un archivo → `DocumentImportPanel.ensureWorkspace()` abre con
   `{ purchaseCode }` → `openWorkspace` crea un `document_workspaces` **ligado a la prealerta**.
2. El proveedor abre su enlace, ve el formulario precargado y lo envía por el POST de siempre
   (`PackingListFormSection.tsx:554`, `/p/${token}/packlist`).
3. La ruta encuentra el documento compartido y responde **409 `shared_document_required`**
   (`app/p/[token]/packlist/route.ts`, control del Director en 0473, se conserva).
4. El formulario trata el 409 como error genérico: «No pudimos confirmar el envío…». La vía
   alternativa —confirmar desde el documento con `x-supplier-token`— **no la usa ningún
   componente**: `createDocumentClient({ supplierToken })` no se llama con ese parámetro en ningún
   lado.

Resultado: encender la bandera como estaba dejaba **sin vía de envío al proveedor** de toda compra
donde el cliente usara la carga de documentos. Es exactamente el aviso que ya tenía `.env.example`.

**Decisión de esta tarea (reversible, en código):** la bandera se parte en dos.

- `DOCUMENT_IMPORT_ENABLED=true` sola → el cotizador anónimo, su sitemap, su enlace del footer y el
  cron. Nada ligado a una compra.
- `DOCUMENT_IMPORT_PORTAL_ENABLED=true` además → documentos de compra. **No se enciende** hasta que
  exista la confirmación del proveedor desde el documento.

La negación vive en el servidor, no en la UI: `authorizeWorkspace` (todo actor no anónimo),
`openWorkspace` (proveedor, compra o sesión, antes de tocar la base), `purchases`, el estimado
combinado o guardado (antes de calcular), la pantalla `documento` (404) y la ruta del proveedor
(una lectura caída sólo falla cerrada con el portal encendido). `capabilities` publica `portal` y
`DocumentImportEntry` pide las dos llaves.

## PRIVACIDAD: compuerta antes de encender en producción

Encender es el momento en que el flujo empieza a recibir documentos reales de visitantes sin cuenta
y a mandar los PDF a un tercero. Por AGENTS eso pasa por `revisar-datos-ve`. Se aplicó **acotada al
flujo anónimo de `/cotizador`** (no es una auditoría del repo) con un subagente de solo lectura, y
se comprobaron a mano los hallazgos que tocaban esta tarea. No es asesoría legal.

Comprobados en el código por esta sesión:

- **ENCONTRADO — no hay aviso antes de subir.** Ni `app/cotizador/*` ni `components/document-import/*`
  mencionan la privacidad ni enlazan `/privacidad` (grep sin resultados). La subida arranca al
  elegir el archivo; el aviso de las 24 h sale después (`CotizadorClient.tsx`, bloque `ws?.expiresAt`).
- **ENCONTRADO — `/privacidad` no cubre este flujo:** no hay fila del cotizador, no figura un
  proveedor de IA entre los destinatarios, y lo más cercano es «Los documentos que subes se guardan
  en almacenamiento seguro» (`app/privacidad/page.tsx:304`), escrito para el portal con sesión.
- **ENCONTRADO — texto del portal dentro del cotizador:** el panel dice «antes de enviarle el enlace a
  tu proveedor», «el resto de la compra» y «el original queda como adjunto»
  (`DocumentImportPanel.tsx:143,376,436`). En el cotizador el original se borra a las 24 h y no hay
  compra. Y el aviso de las 24 h invita a «seguir desde el portal», donde la carga de documentos
  queda apagada.
- **ENCONTRADO y CORREGIDO — el borrado dependía de la bandera** (ver COMPLETADO).

Del subagente, sin re-comprobar uno por uno (etiquetados así a propósito):

- CORRECTO en parte: la instrucción a la IA excluye comprador, cuentas y firmas, y el esquema de
  salida es cerrado. Pero el PDF viaja **completo** (y dos veces por intento: conteo de tokens y
  lectura). La exclusión aplica a lo que vuelve, no a lo que se envía.
- CORRECTO: el token anónimo (256 bits, sólo su hash en la base, viaja por cabecera), la IP sólo como
  HMAC, sin grants a `anon`/`authenticated` en las tablas.
- NO VERIFICABLE desde el repo: retención y uso en Anthropic (DPA, cero retención, entrenamiento,
  región); backups/PITR de Supabase; retención de logs de Vercel/Supabase.
- Sugerido y NO aplicado (decisión de producto): no guardar el contacto del proveedor en los
  documentos anónimos. Comprobado por esta sesión: `CotizadorClient.tsx` no ofrece descarga ni
  enlace al proveedor; el contacto sólo se muestra en el paso «revisar». Dentro del cotizador su
  finalidad no es evidente, pero quitarlo cambia lo que el visitante ve: se decide, no se asume.

**Lo que Sam (con su abogado) decide antes de la Fase 3:**

1. Texto en `/privacidad`: el cotizador, la lectura con IA, Anthropic como destinatario, la
   transferencia fuera de Venezuela y el borrado a las 24 h.
2. Un aviso corto **antes** de «Elegir archivos», con enlace a `/privacidad`; si basta el aviso o
   hace falta una casilla.
3. Condiciones con Anthropic (DPA, retención, no entrenamiento) y si esta función usa una key propia.
4. Si se corrige ya el texto heredado del portal dentro del cotizador (es copia, va con `/ui-check`).

Esta sesión **no** redactó texto legal ni el aviso: el aviso tiene que enlazar a una política que
diga lo que el aviso resume, y esa política es de Sam.

## CÓMO SE ENCIENDE (para Sam y el Director)

**Antes de cualquier paso en producción:** confirmar con dtdcargo-18 que no hay otra aplicación en
curso (pedido del supervisor; el runbook exige una a la vez).

1. **Compuerta de privacidad** (sección anterior). Sin ella, encender en producción es capturar
   documentos reales sin aviso.
2. **Publicar esta rama y abrir la PR** (hace falta autorización: el encargo no la nombró).
3. **Prueba en Preview (recomendada, sigue pendiente de la Fase 2 de 0473):** en Vercel, variables
   con alcance **Preview** y, mejor, **sólo para la rama** `codex/encender-cotizador-0473` (si no,
   se encienden en todas las previews):
   - `DOCUMENT_IMPORT_ENABLED=true`
   - `DOCUMENT_IMPORT_RATE_SECRET` = 64 caracteres
     (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). **Menos de 32 y
     toda la API responde 503** (`access.ts`, `reserveRequest`).
   - `DOCUMENT_IMPORT_MODEL=claude-sonnet-5` y `ANTHROPIC_API_KEY` (sólo para PDF; XLSX/CSV no
     gastan nada).
   - **No** `DOCUMENT_IMPORT_PORTAL_ENABLED`.
   Redesplegar la preview y subir en `/cotizador` una XLSX y una proforma PDF reales.
   **Ojo, ya documentado en 0473:** Preview escribe en la **base y el bucket de producción**
   (inferencia del repo: el MCP de Vercel da 403 y no se miró el panel), y en Preview no corre el cron. Lo que se suba ahí queda hasta que la bandera se encienda en
   producción: con esta rama el cron de producción limpia lo vencido **siempre**, así que ese
   residuo se borra en el primer minuto después de mergear, encendida o no.
4. **Producción:** las mismas variables con alcance **Production** (un `RATE_SECRET` distinto al de
   Preview). **No** `DOCUMENT_IMPORT_PORTAL_ENABLED`. Opcionales con sus defaults:
   `DOCUMENT_IMPORT_DAILY_JOBS` (100), `DOCUMENT_IMPORT_DAILY_TOKEN_BUDGET` (2.000.000).
   Confirmar que `CRON_SECRET` existe en Production (sin él el cron responde 403 y no borra nada).
5. **Mergear la PR** (Director; un merge a `main` despliega a producción). El orden importa:
   **variables primero, merge después**, y el merge es el interruptor: el deploy nace con la bandera
   encendida y el cron a cada minuto. Al revés, el cotizador sigue 404 hasta un redeploy manual.
6. **Sondas después del deploy**, sin leer filas de negocio:
   - `GET /api/document-import?action=capabilities` → `{"available":true,"portal":false,…}`
   - `/cotizador` → 200; `/sitemap.xml` contiene `/cotizador`; el footer muestra «Cotiza con tu
     proforma».
   - `/portal/compras/<código>/documento` → 404, y el paso 2 de una compra nueva **sin** la carga de
     documentos.
   - Logs del cron `/api/cron/document-import-drain`: 200 con `cleanup` cada minuto.
7. **Apagar:** Vercel Instant Rollback al deploy anterior, o quitar la variable y redesplegar
   (cambiar una variable no afecta un deploy ya hecho). El borrado de lo vencido sigue corriendo.

## COMPLETADO

1. **Cadencia revisada y decidida:** `vercel.json` vuelve a `* * * * *` para
   `/api/cron/document-import-drain`. `RETRY_STEP_MS` en `jobs.ts` (mismo valor, ahora con nombre) y
   `lib/studio/document-import/cron-cadence.test.ts` atan cadencia, escalón y lease.
2. **La bandera, partida en dos**, con la negación en el servidor: `access.ts` (`portalEnabled`,
   `requirePortalScope`, y `authorizeWorkspace` niega todo lo no anónimo), `service.ts`
   (`openWorkspace`), `http.ts` (`capabilities` publica `portal`; `purchases`), `estimate.ts`
   (combinar o guardar), la pantalla `documento` (404), la ruta del proveedor
   (`app/p/[token]/packlist/route.ts`: una lectura caída sólo falla cerrada con el portal) y
   `DocumentImportEntry` (pide las dos llaves). El 409 ante un documento que ya existe **se
   conserva** con cualquier bandera. `.env.example` documenta `DOCUMENT_IMPORT_PORTAL_ENABLED`.
3. **El borrado deja de depender de la bandera:** el cron limpia lo vencido siempre; sólo la lectura
   depende de `DOCUMENT_IMPORT_ENABLED`. Sin esto, apagar después de encender dejaba sin borrar lo
   subido en las últimas 24 h.
4. **Descubrimiento del cotizador:** `/cotizador` deja de declararse excluida (apagada ya es 404);
   `app/sitemap.ts` y el footer («Cotiza con tu proforma», en «Enlaces rápidos») la muestran sólo con
   la bandera encendida. Se corrigió el comentario que decía que `force-dynamic` ahorraba el
   redeploy. **El Nav no se tocó:** su orden es decisión del founder (comentario en `Nav.tsx`).
5. **SDD-0473** ampliada (2026-09-18) con su allowlist; índice sincronizado.
6. **Revisión de datos personales acotada** al flujo anónimo (sección PRIVACIDAD).

Criterios de aceptación de 0473 que esta tarea mueve: cron/lease/retry (cadencia y contrato),
permisos cruzados (el portal no se abre por accidente), expiración (borrado independiente de la
bandera). Siguen abiertos los de 0473 que no son de esta tarea: el recorrido completo contra la base
real, PDF reales, `/ui-check` y 375/390 px del cotizador, chino y WeChat reales.

## VALIDACIÓN

SHA medido: `ccf9c1a6` (cabeza de la rama antes de este handoff), base `78410913` = `origin/main`
al momento de medir.

| Comprobación | Veredicto | Evidencia |
|---|---|---|
| Guard, rama y claim antes de editar y de commitear | **PASÓ** | `Guard OK`; rama `codex/encender-cotizador-0473` |
| Módulo document-import + cotizador + portal compras (vitest) | **PASÓ** | 18 archivos, 339 pruebas, 1 skip por diseño |
| Pruebas nuevas (cadencia, cron, footer, sitemap, ruta del proveedor, pantalla documento) | **PASÓ** | todas verdes corridas por archivo |
| Contrato de cobertura del sitemap | **PASÓ** | 3/3, tras reescribir un comentario que contenía la palabra que el contrato busca |
| Control rojo: 14 mutantes, uno por puerta | **PASÓ** | los 14 mueren; cada archivo restaurado y comprobado por sha256 |
| `tsc --noEmit` | **PASÓ** | exit 0 sin tubería |
| `eslint` sobre lo tocado | **PASÓ** | 0 errores; 4 warnings preexistentes de `DocumentCalculator.tsx` (no tocado) |
| `git diff --check` | **PASÓ** | sin salida |
| `docs:check` / índice de specs | **PASÓ** | 464 specs, sin cambios en el índice |
| `pnpm verify` completo sobre `ccf9c1a6` | **FALLÓ (exit 1)** | leído del propio proceso (`rc` a archivo, sin tubería). 16 de 17 pasos corrieron |
| └ harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols | **PASÓ** | `[OK]` en el log |
| └ `sql-tests`, `schema-rebuild` | **PASÓ** | esta vez Docker estaba disponible |
| └ `build` | **PASÓ** | `[OK] build`, build de producción |
| └ `test` | **FALLÓ** | 1 falla, 7.815 pasan y 1 se omite (7.817): `PackingListProductsStep.test.tsx` → «adds another group…», la inestable conocida (FUERA DE ALCANCE de la PR #133). **Aislada sobre `ccf9c1a6`: 9/9 en verde** |
| └ `e2e` | **FALLÓ, cobertura PARCIAL** | 1.ª vuelta: `Timed out waiting 120000ms from config.webServer`. Reintento: 144 pasan, 7 inestables que pasan al reintento, 33 omitidas y 2 fallan (`calculadora-hidratacion.spec.ts:61`, `attachments-gastos-pilot-network.spec.ts:4`). **Aisladas sobre `ccf9c1a6`: 3/3 en verde**. 15 omitidas sin Supabase público |
| └ `migrations-applied` | **NO EJECUTADO** | `[SKIP]` sin `.env.local`; no se copiaron credenciales. Esta tarea no trae migraciones |
| Causa de los rojos de `verify` | **PASÓ (comprobada)** | durante la corrida la CPU estaba al **100 %** y otra sesión (`DTD-worktrees/tarifa-programada-a-futuro`) corría su vitest con ~20 workers. Con la máquina en 20 % las 4 pruebas rojas pasaron |
| Estado encendido en un Next real (`next dev`, `DOCUMENT_IMPORT_ENABLED=true`) | **PASÓ** | `capabilities` → `{"available":true,"portal":false,…}`; `/cotizador` 200 con `robots: index, follow`; enlace del footer en `/cotizador` y en `/tarifas`; `sitemap.xml` con `/cotizador` |
| `/portal/compras/<código>/documento` en ese mismo servidor | **NO DISPONIBLE** | 500 del `proxy.ts` (middleware), que exige Supabase en `/portal` antes de llegar a la página. La puerta de la página está cubierta por `page.test.tsx` y su mutante |
| `/ui-check` | **NO EJECUTADO** | el único cambio visible es un enlace del footer con el componente existente `FooterLink`. No es UI sustancial |
| Variables en Vercel, deploy, producción | **NO EJECUTADO** | fuera de autorización: los pasos están en «CÓMO SE ENCIENDE» |
| Graphify estructural | **PENDIENTE** | `graphify update .` corrió (34.856 nodos); `structural: PENDING` |
| Graphify semántico | **NO APLICA a esta tarea** | ninguna de las 16 fuentes del piloto cambió; global 0/1.091, preexistente |
| Archify | **NO DISPONIBLE** | `ARCHIFY_RUNTIME_MISSING`: hay que descargar `archify.zip` y no está autorizado |
| Vista previa de Obsidian | **PASÓ (local)** | `knowledge-sync publish --preview` → `graphify-out/obsidian-preview`, 1.090 documentos; no toca la bóveda compartida |

## COMMITS

- `f988f83f` — fix(import): el cron borra lo vencido aunque la bandera esté apagada.
- `64e02b09` — fix(import): los documentos de compra, detrás de su propia llave.
- `c2853a30` — chore(studio): el cron vuelve a cada minuto, atado al escalón de reintento.
- `2cdbcc87` — feat(cotizador): indexable, y en el sitemap y el footer sólo con la bandera.
- `ccf9c1a6` — docs(SDD-0473): la ampliación de la spec.
- Commit que contiene este documento: el handoff.

Todos con `git add` selectivo; sin reset, sin force push, sin tocar otras ramas ni worktrees.

## PR / BRANCH

- Rama local `codex/encender-cotizador-0473`, base `78410913` (= `origin/main` al medir).
- **Sin push y sin PR:** el encargo no nombró la publicación. Cuando se autorice:
  `git push -u origin codex/encender-cotizador-0473:codex/encender-cotizador-0473` y PR contra
  `main`, en draft mientras siga abierta la compuerta de privacidad.
- El supervisor pidió avisarle a él y a dtdcargo-18 **antes** de publicar.

## PENDIENTES DE ESTA TAREA

1. **Compuerta de privacidad** (Sam y su abogado): `/privacidad`, aviso antes de subir, Anthropic.
   Sin eso no se enciende en producción.
2. **Autorización para publicar** la rama y abrir la PR.
3. **Encender** según «CÓMO SE ENCIENDE»: variables (Sam, en Vercel), merge (Director), sondas.
4. `verify` sin cierre verde en esta máquina por saturación: si el Director quiere el gate en verde
   antes de integrar, correrlo sin otra suite en paralelo, o apoyarse en el check obligatorio de la
   PR (`Calidad local sin secretos`).
5. Capa de conocimiento: Archify sin runtime y estructural en PENDING (ver tabla).

## FUERA DE ALCANCE DETECTADO

1. **La confirmación del proveedor desde el documento no existe.** Es lo que falta para encender
   `DOCUMENT_IMPORT_PORTAL_ENABLED`: un componente del enlace del proveedor que use `x-supplier-token`
   (acciones `workspace`, `save`, `confirm`), o que el formulario viejo entienda el 409. Tarea propia
   de 0473.
2. **Texto del portal dentro del cotizador** (`DocumentImportPanel.tsx:143,376,436`) y el aviso de
   las 24 h que invita a «seguir desde el portal» (`CotizadorClient.tsx`). Va con la compuerta de
   privacidad y con `/ui-check`.
3. **El visitante no puede borrar su documento antes de las 24 h** (no hay acción para eso).
4. **Enlace al cotizador en el Nav:** decisión del founder sobre su orden (2026-07-31).
5. **Inestables bajo carga**, preexistentes: `PackingListProductsStep.test.tsx` y, en e2e,
   `calculadora-hidratacion`, `attachments-gastos-pilot-network`, `auth` y `calc-event`. Con dos
   sesiones corriendo suites a la vez, `verify` no sale verde en esta máquina.
6. **Avisos preexistentes de conocimiento**: `missing-link-target` (specs 0148, 0288, 0366, entre
   otras) y `SEMANTIC_GLOBAL_PENDING 0/1091`.

## HANDOFF AL DIRECTOR

- **Qué revisar:** que partir la bandera respeta el control del 409 (se conserva con cualquier
  bandera, `route.test.ts`) y que ninguna puerta del portal queda abierta con sólo la primera llave
  (14 mutantes, uno por puerta).
- **Cambios compartidos:** `Footer.tsx` (todas las páginas públicas), `app/sitemap.ts`, `vercel.json`
  y la ruta pública del proveedor. Nada de esquema ni migraciones.
- **Orden:** variables en Production primero, merge después. El merge es el interruptor y despliega a
  producción. Un merge sin las variables deja el cron a cada minuto con la bandera apagada: ya no es
  inerte, porque ahora limpia siempre (unas 4 consultas por minuto sobre tablas casi vacías).
- **Antes de cualquier paso en producción:** confirmar con dtdcargo-18 que no hay otra aplicación en
  curso.
- **Ownership:** claim liberado al cerrar esta escritura (ver abajo). Worktree y rama se conservan.
