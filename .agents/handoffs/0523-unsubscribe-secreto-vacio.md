# Handoff · SDD-0523 · Secretos de firma vacíos cuentan como ausentes

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15 (UTC 05:30 a 06:00 aprox.; Caracas 01:30 a 02:00) |
| Task ID / owner | `0523-unsubscribe-secreto-vacio` / sesión Worker de Claude |
| Claim del harness | `claude-keen-swirles-62b904` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\keen-swirles-62b904` |
| Rama | `claude/wonderful-goldstine-7838d9` (nombre que le dio la app al crear el worktree; sin upstream hasta el push) |
| Base | `origin/main` `a8d99acf` (merge de la #223) |
| SDD | [0523](../../docs/specs/0523-unsubscribe-secreto-vacio/spec.md), `in-progress`. Reservada con `corepack pnpm sdd:next --reserve unsubscribe-secreto-vacio` (rama local `codex/sdd-reserve-0523-unsubscribe-secreto-vacio`, commit `7a7e32a8`, traída aquí por cherry-pick como `9a8a722f`). El Director confirmó el número. Sin migración. |
| Estado de la tarea | lista para revisión (PR contra main, sin fusionar) |
| Permisos | commits selectivos, push de la rama propia y PR contra main, sin fusionar. Sin producción, sin servidor, sin variables de entorno, sin datos ni migraciones. El arreglo del `.env` del servidor no es de esta tarea (Sam y la sesión de Contabo). |

## Objetivo

Que una variable de secreto definida pero vacía no quede como clave de firma o
verificación, empezando por `EMAIL_UNSUBSCRIBE_SECRET`, vacía (largo 0) en el
contenedor `dtd-cargo-web-1` según la medición del 2026-10-15. Tratar `""` y
sólo espacios como ausente, fallar cerrado sin ningún secreto válido,
inventariar el patrón `process.env.X ?? …` con secretos de servidor y corregir
sólo los de firma o verificación.

## Qué se hizo

- Helper `lib/runtime/server-secret.ts` (`firstConfiguredSecret`): primer valor
  no vacío ni de sólo espacios, **devuelto sin recortar**; `null` si no hay.
- Cinco sitios corregidos (detalle en la spec): `unsubscribeSecret()` y el log
  `secretSource` (ahora `unsubscribeSecretSource()`), `hashIp()` del newsletter,
  `marcaSecret()` y el secreto del webhook de correo entrante.
- Seis archivos de prueba nuevos, 57 casos: vacía, con espacios, definida y sin
  definir en cada sitio, con tokens y cookies reales, del lado que firma y del
  que verifica.

### Corrección a la premisa del encargo

El encargo decía que con la variable vacía los tokens de baja se firmaban con
clave vacía y cualquiera podía falsificarlos. El control rojo dice otra cosa:
con `""` exacto, `processUnsubscribe` (`unsubscribe-request.ts:50-53` en
`a8d99acf`) y el emisor (`newsletter/sender.ts:105` y `:141`) descartan el
secreto con `!secret`. El resultado en el servidor era que **ninguna baja
funcionaba** (500 y `estado=error` también para enlaces legítimos) y que el
emisor de Actualidad se negaba a enviar. La falsificación sí ocurre con un valor
de **sólo espacios**: `"  "` pasa el `!secret` y se usa como clave. En `/marca`
pasa lo mismo. La sal del newsletter, que no tiene `!secret`, sí quedaba en
`""` con la variable vacía. El arreglo cubre los dos casos.

### Inventario (detalle y razones en la spec)

`git grep` del patrón en `a8d99acf`, sin `NEXT_PUBLIC_*`: **23 líneas en 16
archivos**. Coincide con la auditoría del `.env` del servidor que reenvió el
Director.

| Variable | Decisión |
|---|---|
| `EMAIL_UNSUBSCRIBE_SECRET`, `NEWSLETTER_IP_HASH_SECRET`, `MARCA_ACCESS_SECRET`, `RESEND_INBOUND_WEBHOOK_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` como respaldo | **corregidas** |
| `BITACORA_ACTA_MODEL`, `BITACORA_ESCUCHA_MODEL`, `CONVERSATION_DIGEST_MODEL` | no se corrigen: no son secretos. Con `""` el modelo queda vacío y la llamada a Anthropic falla (ver FUERA DE ALCANCE) |
| `IDENTITY_CNE_PROVIDER` | sin efecto: `""` no es `verifik` y cae a `cedulave`, igual que sin definir |
| `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `D2_LOCAL_TRANSPORT` | informativos |
| `DTD_ATTACHMENTS_*` en `scripts/` | scripts de operación; `Number("")` da 0 |
| `E2E_SUPABASE_SINTETICO_PORT` | ya recorta |

Los demás secretos de verificación (`CRON_SECRET`, `RESEND_WEBHOOK_SECRET`,
`TELEGRAM_WEBHOOK_SECRET`, `DEBUG_HEALTH_SECRET`, `CBM_ESTUDIO_TOKEN`,
`DTD_ATTACHMENTS_AV_TOKEN`, `DOCUMENT_IMPORT_RATE_SECRET`) no usan `??` y ya
descartan `""`.

## Impacto documental y conocimiento

- Documentos actualizados: spec 0523 (nueva) y `docs/specs/README.md`
  (regenerado con `pnpm docs:index`).
- No se tocaron `infra/dtd-cargo/.env.example:102-108` ni
  `docs/runbooks/servidor-contabo.md:585`, que dicen que con las variables
  vacías la app usa el service role. Con `a8d99acf` eso era falso; con esta
  rama pasa a ser cierto, así que no hace falta corregirlos. Son además
  archivos de la sesión de Contabo, que trabaja en el corte de esta noche.
- `pnpm knowledge:status` (exit 0, `ok: false`, revisión `9a8a722f`): structural
  INVALID con 4580 pendientes y 0 drifted, semantic INVALID con 1208
  pendientes, archify PENDING, obsidian PENDING. El worktree no tiene
  `graphify-out/`, así que todo el repo figura pendiente: no es efecto de este
  cambio. La spec 0523 aparece como `native_semantic_missing_or_changed`.
- Graphify `update`, `knowledge:visual`, `knowledge:visual:check` y
  `knowledge:publish --preview`: NO EJECUTADOS. Validación liviana por encargo;
  el grafo lo publica el Director desde main integrado. Pendiente global: la
  estructura de Graphify debe incorporar el helper, las seis pruebas y la spec
  0523 después de integrar.

## Cierre

**OBJETIVO ORIGINAL:** reservar la SDD; tratar la cadena vacía o de sólo espacios
como ausente en `unsubscribe-token.ts`, `unsubscribe-request.ts` y la sal de
`newsletter/subscribe/route.ts`, con fallo cerrado sin secreto válido; barrer e
inventariar el patrón y corregir sólo los secretos de firma o verificación;
pruebas con control rojo y mutantes; validación focalizada; spec, handoff, push
y PR sin fusionar.

**COMPLETADO:**
- SDD-0523 reservada y escrita, con inventario.
- Los tres sitios pedidos y dos más del mismo tipo (`/marca` y webhook
  entrante), con un helper compartido.
- 57 pruebas nuevas, control rojo y 16 mutantes muertos.
- Criterios de aceptación de la spec cumplidos (los nueve marcados).

**VALIDACIÓN** (árbol de trabajo idéntico al de `cd826d8b`; documentación sobre
`4832fbe7`):

| Comprobación | Resultado |
|---|---|
| Control rojo: pruebas nuevas contra el código de `a8d99acf` (los cinco archivos de origin/main, helper presente) | FALLÓ, como se esperaba: 32 de 57. Pasan 25, de ellas 6 del helper que main no tiene. Ejemplos en la spec |
| Pruebas nuevas con el arreglo (6 archivos) | PASÓ 57/57 |
| Mutantes (16, sobre líneas del diff; control 57/57 antes y después; archivos restaurados y `git status` comprobado) | PASÓ: 16 muertos. Cada uno cuenta como muerto sólo si la salida trae la línea `Tests` |
| Suites vecinas: `lib/studio/mail`, `lib/marca`, `app/marca`, `lib/studio/newsletter`, `lib/runtime`, `lib/http`, `app/api/newsletter`, `app/api/conversaciones`, `app/api/email`, `lib/studio/conversaciones` | PASÓ: 29 archivos, 401 pruebas |
| `pnpm typecheck` (salida a archivo, sin tubería) | PASÓ: exit 0 |
| `pnpm lint` completo | PASÓ: exit 0, 0 errores y 15 advertencias, ninguna en archivos de esta tarea |
| `pnpm docs:check` | PASÓ: índice sincronizado con 508 specs |
| `pnpm sdd:check` | PASÓ: «numbering: sin números repetidos»; los ⏸ son choques históricos ya aplicados |
| `git diff --check` | PASÓ |
| `pnpm verify` completo | NO EJECUTADO: el encargo pide no correrlo sin turno del Director |
| e2e, Docker y build | NO EJECUTADO: fuera de la validación pedida |
| `/ui-check` | NO EJECUTADO, no aplica: no hay cambio visual |
| `revisar-datos-ve` | NO EJECUTADO, no aplica en sentido estricto: no se agrega captura ni flujo nuevo. El cambio refuerza la seudonimización de `consent_ip_hash` (la sal ya no puede quedar vacía) |

**COMMITS:**
- `9a8a722f` — chore(sdd): reserva SDD-0523 (cherry-pick del stub).
- `cd826d8b` — fix(studio): helper, cinco sitios y seis archivos de prueba.
- `4832fbe7` — docs(sdd): spec 0523 e índice regenerado.
- `e4a67ca8` — handoff.
- Commit posterior, a pedido del Director en la revisión de la PR: corrige el
  relato de tres comentarios (`lib/runtime/server-secret.ts`,
  `lib/studio/mail/unsubscribe-token.ts` y `lib/marca/access.ts`), que decían
  que con `""` se podía falsificar. Con `""` fallaba cerrado; la falsificación
  era con sólo espacios. Actualiza las tres citas de línea que se corrieron en
  la spec. Las pruebas no cambian.

**PR / BRANCH:** PR contra `main` desde `claude/wonderful-goldstine-7838d9`, sin
fusionar. La URL va en el reporte al Director y se obtiene con
`gh pr list --head claude/wonderful-goldstine-7838d9`; no se empuja otro commit
sólo para anotarla.

**PENDIENTES DE ESTA TAREA:**
- Revisión del Director y CI de la PR. El Director avisó que no se fusiona nada
  hasta después del corte de Vercel al servidor propio de esta noche.
- Estado SDD `done` después de integrar.
- *No verificado:* si llegó algún enlace de baja al servidor propio mientras la
  variable estuvo vacía (habría recibido `estado=error`). Los correos apuntan a
  `NEXT_PUBLIC_SITE_URL`, que sigue en Vercel hasta el corte. Medirlo exige leer
  los logs del contenedor (`email_unsubscribe_invalid` no aplica: con secreto
  vacío la ruta corta antes del log), y eso queda para la sesión de Contabo.

**FUERA DE ALCANCE DETECTADO:**
- **Modelos de Anthropic con `??`** (`bitacora/extract.ts:263`,
  `escucha-extract.ts:110-111`, `conversaciones/digest-extract.ts:27-28`): con
  la variable vacía el modelo queda en `""` y la extracción de actas, escucha y
  resúmenes falla. El runbook (`servidor-contabo.md:589`) dice
  «`BITACORA_ACTA_MODEL` (vacío = `claude-sonnet-4-6`)», que con este código no
  es cierto. Hoy no rompe porque Contabo quitó las vacías. Candidato a una tarea
  chica con el mismo helper (o uno que recorte, porque aquí no hay compatibilidad
  que cuidar).
- **Secretos de verificación con sólo espacios:** `CRON_SECRET`,
  `TELEGRAM_WEBHOOK_SECRET`, `DEBUG_HEALTH_SECRET`, `CBM_ESTUDIO_TOKEN` y los
  demás que usan `!secret` aceptarían `"  "` como secreto válido. Es un error de
  configuración improbable, pero el remedio es el mismo helper.
- **Comentario viejo en `.env.example:383-384`** (raíz): dice que
  `MARCA_ACCESS_SECRET` sin valor «cae a un default de desarrollo». El código
  cae a `SUPABASE_SERVICE_ROLE_KEY` desde la SDD-0238; no hay default de
  desarrollo.
- **Secreto común entre Vercel y el servidor:** si después del corte el
  servidor usa una service role distinta de la de Cloud (Supabase propio), los
  enlaces de baja ya enviados y las cookies de `/marca` dejan de valer allí,
  con o sin este arreglo. Lo que lo evita es fijar el mismo
  `EMAIL_UNSUBSCRIBE_SECRET` y `MARCA_ACCESS_SECRET` en los dos lados (hoy
  ninguno existe en Vercel). Decisión de Sam y de la sesión de Contabo.
- `lib/studio/newsletter/sender.ts:73` usa `source.NEXT_PUBLIC_SITE_URL ?? …`,
  fuera del grep literal de la 0518 (no es `process.env.`). Le aplica el mismo
  razonamiento de la 0518 para `NEXT_PUBLIC_SITE_URL`.

**HANDOFF AL DIRECTOR:**
- Siguiente acción: revisar la PR. Toca cinco archivos de código, todos con el
  mismo cambio de una expresión, más un helper nuevo y pruebas. No toca
  `lib/shared/`, contratos, migraciones ni infraestructura.
- Al integrar: el índice (`docs/specs/README.md`) tiene el driver de merge; si
  la 0522 o la 0524 entran antes, regenerarlo con el script.
- La rama de reserva `codex/sdd-reserve-0523-unsubscribe-secreto-vacio` quedó
  local y sin publicar, como las anteriores; se borra con `-D` cuando la spec
  esté en main, con la comprobación de siempre.
- Sesiones consumidoras: ninguna aparte de esta. El claim
  `claude-keen-swirles-62b904` se libera después del push y la PR. No se
  eliminan el worktree ni la rama.
