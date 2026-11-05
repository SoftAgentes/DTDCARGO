# Handoff — SDD-0606 · Avisos del Studio: de Telegram a Discord

- **Owner / sesión:** Worker, sesión `a25c32c6-5a38-4b25-8d4e-7cbf1ea56f10` (iniciada por `local_61442abe-3b66-423e-9af4-8008d5457aa3`).
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\gracious-kapitsa-213515`
- **Rama:** `claude/gracious-kapitsa-213515`, sobre `main` 49bdba2e5. **Sin publicar.**
- **SDD:** [`docs/specs/0606-avisos-studio-a-discord/spec.md`](../../docs/specs/0606-avisos-studio-a-discord/spec.md), estado `in-progress`. Número reservado en local con `pnpm sdd:next --reserve` (`refs/heads/codex/sdd-reserve-0606-avisos-studio-a-discord` y `refs/dtd/reservations/0606`, commit 5ca29c64). **La reserva tampoco está publicada.**
- **Permisos del encargo:** commits locales. Sin push, sin PR, sin aplicar migraciones, sin tocar producción ni apagar Telegram.
- **Fecha:** 2026-11-05.

## OBJETIVO ORIGINAL

Especificar y construir el paso de los avisos del Studio de Telegram a Discord: inventario de envíos, spec con sus decisiones, revisión de privacidad, envío a Discord con pruebas, ruteo, pantalla, y el orden del corte sin ejecutarlo.

## COMPLETADO

1. **Inventario**, por valor y no por carpeta (spec, «Contexto»): 15 avisos por categoría, 7 envíos por persona, 5 respuestas del bot que se retiran con Telegram, y lo del servidor (`infra/ops/`) separado y sin tocar.
2. **Spec con siete decisiones** (D1 a D7): las direcciones de los webhooks van en variables del servidor; el destino se generaliza en la categoría; una categoría sin canal cae a `#avisos-equipo`; los avisos por persona son una mención en el canal; a Discord sale lo mínimo y el tipo lo impone; reglas del envío; apagado en el entorno de prueba.
3. **Envío a Discord** (`lib/studio/discord/`): recorte a 2.000, sin menciones por defecto, reintento con el tiempo que indica Discord (tope de 5 s y 3 intentos), corte a los 8 s, nunca lanza, la dirección no sale en errores.
4. **Despachador** (`lib/studio/alerts/`): Discord primero, respaldo en Discord, y Telegram como red mientras exista su token. Sin variables de Discord, el comportamiento es el de antes.
5. **Los 15 avisos por categoría y los 7 por persona** pasan por el despachador nuevo, cada uno con su aviso mínimo.
6. **Perfil:** campo «Menciones en Discord» (guardar y quitar el ID propio).
7. **Pantalla:** Ajustes › «Alertas del equipo» muestra el estado de cada canal de Discord; la matriz de Telegram queda abajo, rotulada como respaldo.
8. **Migración 0514** escrita, con contrato, **sin aplicar**. Registrada como espera en `supabase/migrations-baseline.json` y declarada ante el gate de símbolos.
9. **Revisión de privacidad** con `revisar-datos-ve`: [`privacidad.md`](../../docs/specs/0606-avisos-studio-a-discord/privacidad.md). 9 `CORRECTO`, 3 `ENCONTRADO`, 6 `NO VERIFICABLE`. Discord quedó propuesto en `docs/legal/privacidad/inventario-terceros.md`.

### Correcciones de la revisión de Codex (2026-11-05, tanda 2)

Encargo de la sesión coordinadora, con la aprobación de Sam que ella transmitió («Sí, repártelas»), sobre el commit `67d6f2ecb`. Verificadas contra la cabeza `d838e56b4` antes de cambiar; las seis seguían abiertas. La de membresía activa (`getStudioAccess`) ya estaba en `01a41c74c`.

| Punto | Qué cambió | Prueba que falló antes del arreglo |
|---|---|---|
| A3 | El envío pide `wait=true` y sólo da por entregado lo que vuelve con el ID del mensaje. Cola durable `studio_alert_outbox` (migración 0515, **sin aplicar**) para registro, bugs y reporte diario; la drena el cron de cada 5 min que ya existía | `send-webhook.test.ts` (3 casos A3) y `dispatch-alert.test.ts` («va a la cola…, no a Telegram») |
| A4 | El reintento de bugs sigue vivo por Discord aunque la persona no tenga Telegram | `bug-notif-outbox.test.ts` («A4: … la fila sigue viva») |
| A5 | Discord sólo para el tenant de `DISCORD_TENANT_ID`; sin la variable, apagado | `dispatch-alert.test.ts` (2 casos A5) |
| M1 | 429 sin dato espera 1 s; nunca menos de 250 ms; el drenado frena el lote | `send-webhook.test.ts` (2 casos M1) |
| M2 | Cuatro estados (entregado, rechazado, reintentable, incierto); lo incierto no se repite en otro canal, ni por Telegram, ni en la cola | `send-webhook.test.ts` (4 casos M2), `dispatch-alert.test.ts` (2), `bug-notif-outbox.test.ts` (1) |
| M4 | `User-Agent: DiscordBot (https://dtdcargo.com, 1.0)` y la URL validada entera con `URL` | `send-webhook.test.ts` (User-Agent, id corto, token corto) |

Rojo medido el 2026-11-05 con las pruebas nuevas sobre el código anterior: 16 de 38 en el envío, 11 de 24 en el despachador (5 por comportamiento; 6 por la firma nueva con tenant) y 3 de 12 en el reintento de bugs. El candado del drenado de la cola se comprobó con un mutante (sin él, la fila sale dos veces).

Decisión mía que Sam puede cambiar: un **5xx** se trata como «no se guardó» y va al respaldo y a la cola. Es una inferencia de la documentación de Discord, no una medición; si fuera falsa, el costo es un aviso duplicado. Lo contrario arriesgaba perder avisos de registro o de bugs durante una caída.

### Dos decisiones que tomé y Sam puede cambiar

- **El reporte diario sale a Discord con conteos y sin el total de gastos.** La regla era «sin montos». El texto que redacta el modelo trae cifras de dinero, así que a Discord no sale. Consecuencia: cuando `#reporte-diario` tenga su dirección, el resumen redactado deja de llegar por mensajería y no tiene pantalla en el Studio. Si Sam quiere el texto completo, hay que decidir si el canal puede llevar montos agregados o si se crea una pantalla.
- **Los contactos y estimados de la web salen a Discord sólo como «llegó uno».** No quedan guardados en el ERP, así que no hay código ni enlace que mandar; el detalle sigue llegando por el correo al equipo.

## VALIDACIÓN

Máquina medida antes de lanzar `verify` (2026-11-05): 7,4 GB de RAM libres de 31,4; CPU al 57 %; 115 procesos `node.exe`, ninguno de `vitest`, `verify`, `next build` ni `playwright`; Docker Desktop apagado.

| Comprobación | Resultado | Detalle |
|---|---|---|
| Pruebas nuevas de Discord, despachador, perfil, pantalla y avisos reales | PASÓ | 7 archivos, 71 pruebas, corridas después del arreglo de permisos |
| Contrato de la migración 0514 en PostgreSQL embebido (PGlite) | PASÓ | 3 de esas 71: contrato completo, control rojo sin la migración, mutante sin el CHECK |
| Contrato de permisos por acción (`lib/studio/rbac-actions-guard.test.ts`) | PASÓ tras el arreglo | Falló en `verify` y se corrigió; ver abajo |
| Pruebas existentes relacionadas (`vitest related` sobre lo modificado) | PASÓ | 77 archivos, 811 pruebas, antes de sumar perfil y pantalla |
| `pnpm typecheck` | PASÓ | |
| ESLint sobre los archivos tocados | PASÓ | |
| `pnpm docs:check` · `pnpm sdd:check` | PASÓ | índice regenerado con `docs:index` |
| `pnpm governance:check` · `pnpm components:check` | PASÓ | |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ | 0 ROJO · 1 AMARILLO declarado (`user_profiles.discord_user_id`, 0514) |
| `/ui-check` | HECHO, sin hallazgos altos | Ver abajo |
| Contrato SQL de la 0514 en Docker (`run-sql-tests`) | NO EJECUTADO | Docker Desktop apagado: la suite SQL en contenedor no midió nada. El mismo contrato sí corrió en PGlite (fila de arriba), que es otra medición y no la reemplaza |
| Prueba contra un webhook real de Discord | NO EJECUTADO | No existe ningún webhook todavía; crearlo es de Sam |
| Vista en el navegador del perfil y de Ajustes | NO EJECUTADO | No levanté el Studio con sesión; la pantalla se midió con pruebas de render |
| Graphify · Archify · `knowledge:status` | NO EJECUTADO | Lo publica el Director desde `main` integrado |
| `pnpm verify` | **FALLÓ** (exit 1), y además incompleto | Ver «Resultado de `pnpm verify`». No se repitió entero: una segunda corrida necesita turno del Director General |

### Resultado de `pnpm verify`

Una sola corrida, de 17:47:53Z a 18:41:01Z del 2026-11-05, sobre `67d6f2ecb` (antes del arreglo de permisos). Resumen del propio script: «14 de 17 pasos corrieron de verdad», `[FAIL] verify: 1 fallo(s) → test`, «CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied, sql-tests, schema-rebuild».

| Paso | Resultado | Detalle |
|---|---|---|
| harness | PASÓ | |
| lint | PASÓ | |
| rsc-boundary | PASÓ | |
| typecheck | PASÓ | |
| edge-functions | PASÓ | 4 funciones compilan |
| test | **FALLÓ** | Primer intento: 3 archivos y 11 pruebas en rojo de 967 archivos y 14.702 pruebas. Reintento: 2 archivos y 4 pruebas en rojo de 976 y 14.774. Detalle abajo |
| docs:check | PASÓ | |
| numbering | PASÓ | |
| feature-constants | PASÓ | |
| components:check | PASÓ | |
| governance:check | PASÓ | |
| migrations-applied | NO DISPONIBLE | `[SKIP]`: el worktree no tiene `.env.local` con acceso a la base. No se midió |
| pending-migration-symbols | PASÓ | 0 ROJO · 1 AMARILLO declarado (la 0514) |
| sql-tests | NO EJECUTADO | `[SKIP]`: Docker apagado. No se midió |
| schema-rebuild | NO EJECUTADO | `[SKIP]`: Docker apagado. No se midió |
| e2e | PASÓ | 238 pasaron, 20 omitidas |
| build | PASÓ | |

**Los rojos del paso `test`, uno por uno:**

| Archivo | Intento 1 | Reintento | Qué es |
|---|---|---|---|
| `lib/studio/rbac-actions-guard.test.ts` | 3 rojos | 3 rojos | **De este cambio, real.** El contrato exige que toda acción nueva nazca con candado. Las dos acciones del ID de Discord sólo comprobaban la sesión, y el inventario pasó de 459 a 461 sin registrarse. **Corregido después de la corrida:** las dos exigen `getStudioAccess` (miembro activo) y quedaron en `EXCEPCIONES` con su verificación. Vuelto a correr aislado junto con la prueba de las acciones: 2 archivos, 480 pruebas, PASÓ |
| `app/p/[token]/supplier-flow.test.tsx` | 6 rojos | pasó | Archivo que no toqué. Pasó en el reintento de la misma corrida. No lo corrí aislado |
| `app/portal/la-accion-lanza.test.tsx` | 2 rojos | pasó | Archivo que no toqué. Pasó en el reintento. No lo corrí aislado |
| `scripts/__tests__/entorno-prueba-scripts.test.mjs` | pasó | 1 rojo | Agotó su tope de 600 s en el reintento; en el primer intento había pasado, con el mismo árbol. No lo corrí aislado. Lee `infra/dtd-cargo/.env.example`, que esta rama modifica: que haya pasado en el primer intento dice que el cambio no lo rompe, pero no es una medición limpia |

En el reintento vitest reportó además 4 errores de infraestructura («Failed to start forks worker … Timeout waiting for worker to respond») sobre archivos que no fallaron por aserción. Es la firma de la máquina cargada (115 procesos `node.exe` al empezar), no de una regresión.

**Lo que esta corrida no prueba:** que la rama con el arreglo de permisos pase `verify` completo. Después del arreglo corrí sólo el contrato de permisos, la prueba de las acciones, las pruebas nuevas, `typecheck`, ESLint de lo tocado y el gate de símbolos. El paso `test` entero no se repitió.

### `/ui-check`

Sin hallazgos altos. Medios y bajos:

- [media] `ProfileModal.tsx`, bloque «Menciones en Discord»: Guardar y Quitar son `<button>` con las clases del sistema, no `<ActionButton>`. Sigue el patrón del bloque de Telegram que tiene al lado; se deshabilitan mientras guardan y anuncian el resultado con `aria-live`.
- [baja] Espaciados de 14 px en las tarjetas nuevas, fuera de la escala de 4 px; son los mismos que usa la matriz de Telegram de la misma pantalla.
- Bien: sólo tokens `var(--*)`, `Badge` del sistema, etiqueta y ayuda asociadas al campo, sin anchos fijos, tuteo.

## COMMITS

Locales, en `claude/gracious-kapitsa-213515`:

- `3164f8fb0` chore(sdd): reserva SDD-0606 — avisos-studio-a-discord
- `ed495e25c` feat(studio): SDD-0606 — avisos del Studio a Discord, con lo mínimo
- `fea518665` feat(studio): SDD-0606 — ID de Discord en el perfil, estado en Ajustes y migración 0514
- `67d6f2ecb` docs(specs): SDD-0606 — spec, revisión de privacidad y Discord en el inventario de terceros
- `01a41c74c` fix(studio): SDD-0606 — las acciones del ID de Discord exigen membresía activa
- `25462453e` y `d838e56b4`: handoff con el resultado de `verify` y el texto de la PR
- más los commits de la tanda 2 (revisión de Codex): el arreglo y este handoff.

## PR / BRANCH

Sam autorizó en esta sesión, el 2026-11-05, publicar la rama y abrir la PR en borrador («Sí, publica», a la pregunta «¿Autorizas publicar la rama y abrir la PR en borrador de la SDD-0606 cuando termine verify?»). Eso cubre publicar y abrir la PR; no cubre fusionar, aplicar la migración ni publicar la web. **La rama está publicada** (`origin/claude/gracious-kapitsa-213515`, sobre `25462453e` más el commit de esta nota). **La PR no está abierta:** `gh pr create` fue denegado por el control de permisos de la sesión y no lo rodeé. El título y el texto están listos en [`sdd-0606-pr-borrador.md`](sdd-0606-pr-borrador.md); la abre Sam, o el Director, desde https://github.com/SoftAgentes/DTDCARGO/pull/new/claude/gracious-kapitsa-213515 con título `feat(studio): SDD-0606 — avisos del Studio de Telegram a Discord`, como borrador y contra `main`. Va en borrador porque `verify` falló y está incompleto. La reserva local (`codex/sdd-reserve-0606`) no se publica: la PR lleva la spec.

## PENDIENTES DE ESTA TAREA

Lo que necesita Sam para que llegue a producción, en orden:

1. **Una corrida completa de `pnpm verify` sobre la rama final**, con turno del Director General y con Docker encendido, para medir el paso `test` entero después del arreglo y las suites SQL que quedaron sin correr.
2. **Descongelar la publicación** de la web. Con el código publicado y sin variables de Discord no cambia nada.
3. **Crear en Discord** los cinco canales, privados por rol, y un webhook por canal: `#registro-clientes`, `#conversaciones-portal`, `#bugs`, `#reporte-diario`, `#avisos-equipo`.
4. **Poner las cinco direcciones y `DISCORD_TENANT_ID`** en el servidor (`DISCORD_WEBHOOK_REGISTRO`, `_CONVERSACIONES`, `_BUGS`, `_REPORTES`, `_EQUIPO`, y el ID del tenant de DTD Cargo) con `infra/ops/migrate/env-set.sh` y reiniciar la web. Sin `DISCORD_TENANT_ID`, Discord queda apagado. Las direcciones son llaves: no van por chat ni al repositorio.
5. **Probar un aviso por categoría** contra los webhooks reales. Es la primera vez que este código hablará con Discord.
6. **OK nominal para cada migración, de a una**, pasando por el Director General y con `docs/runbooks/aplicar-migraciones-prod.md`: `0514_user_profiles_discord_user_id` (ID de Discord en el perfil; sin ella, avisos sin menciones) y `0515_studio_alert_outbox` (cola; sin ella, lo que Discord no guarda cae a Telegram). Ninguna bloquea lo anterior. Al aplicar cada una, retirar su espera de `supabase/migrations-baseline.json` y su declaración de `supabase/pending-migration-symbol-declarations.json`.
7. **Cada persona enlaza su ID de Discord** en Perfil › Preferencias.
8. **Retirar `TELEGRAM_BOT_TOKEN`** del servidor: ese es el apagado de Telegram. Después, dar de baja el webhook del bot y retirar `TELEGRAM_WEBHOOK_SECRET` y `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.

Estado de Discord informado por la sesión coordinadora el 2026-11-05 (no medido por mí): los cinco canales de Operación ya existen en el servidor «DTD Cargo» y son privados; los webhooks todavía no están creados. El paso 3 se reduce a crear un webhook por canal.

Decisiones de Sam que quedan abiertas:

- **Quién ve los canales (resuelto por Sam, informado el 2026-11-05, no medido por mí).** Sam es dueño y único administrador; el rol «Equipo» ve toda Operación y lo tienen además un socio y una cuenta compartida («DTD Cargo»). Tres cuentas leen los avisos: la regla de lo mínimo sigue obligatoria, y la cuenta compartida no deja saber quién leyó qué (`privacidad.md`, «No verificable» 1).

- El reporte diario sin montos (arriba).
- La línea para `/privacidad` que declare la herramienta de mensajería interna (`privacidad.md`, hallazgo 1). El texto público lo aprueba Sam.
- Cómo se atiende una supresión: borrar un cliente en el Studio no borra los avisos de Discord con su código.

## FUERA DE ALCANCE DETECTADO

- **Scripts del servidor que avisan por Telegram:** `infra/ops/web/publicar-web.sh`, `infra/ops/web/telegram-webhook.sh`, `infra/ops/uptime-kuma/` y sus pruebas. Pasan a `#publicaciones` y `#salud` en otra tarea; tienen su propia llave.
- **`infra/ops/staging/verificar-aislamiento.sh`:** conviene sumar las cinco variables de Discord a su lista de integraciones que deben estar vacías en prueba. El código ya apaga Discord con `APP_ENV=staging`; sería la segunda barrera.
- **Retiro del código y de los datos de Telegram:** `lib/studio/telegram/`, `app/api/telegram/webhook/`, el bloque de Telegram del perfil y de Ajustes, los nombres `channel_telegram` y `telegram_attempts`, y las tablas y columnas con identificadores de chat. Va en otra spec después del corte; borrar esos identificadores es un cambio de datos con su propio OK.
- **Voseo en textos que ya estaban:** `app/studio/_components/wiring/ProfileModal.tsx:1087` y `:1270` dicen «Recibí». El segundo está en el bloque de Telegram, que se retira.
- **`lib/studio/integration-health.ts`:** Debug › Estado revisa Telegram contra su API y no tiene equivalente para Discord; hoy sólo se listan los nombres de las variables presentes.
- **La política pública ya omitía a Telegram**, que hoy recibe nombre y teléfono de clientes (`app/privacidad/page.tsx:240`).

## HANDOFF AL DIRECTOR

- **Orden de integración**, según la sesión coordinadora (`local_61442abe…`) tras hablar con el Director General (`local_25e2dded…`), que serializa las fusiones a `main`. Segundo aviso del 2026-11-05, que corrige el primero: 1) PR #376 (SDD-0604), después de la tanda D del Director General; 2) PR #377 (SDD-0605); 3) esta, al final porque lleva migración. Nadie fusiona por su cuenta.
- **Cruce con la SDD-0603 (rediseño del Studio):** esta rama toca `app/studio/_components/wiring/ProfileModal.tsx` (un import, una línea que monta `<DiscordSection />` y el componente nuevo al final del archivo) y el rediseño también lo toca. **No lo resolví.** Falta decidir quién va primero; si entra antes el rediseño, el bloque «Menciones en Discord» hay que rehacerlo sobre su versión del modal y actualizar la línea declarada en `supabase/pending-migration-symbol-declarations.json`.
- **Corridas pesadas:** se pide turno al Director General antes de lanzarlas. El `verify` de esta tarea lo lancé a las 17:47Z sin ese turno, tras medir que no había otra corrida viva; el aviso de la regla llegó después. No lancé ni lanzaré otra sin turno.
- **Migración 0514:** no se aplica en prueba ni en producción sin OK concreto de Sam y sin pasar por el Director General. El siguiente número libre de migración es 0515.
- **`infra/ops/`** es terreno del Director General: los avisos del servidor quedan sólo documentados en «Fuera de alcance detectado». Traer `main` a esta rama una sola vez, en su turno; al escribir esto `origin/main` ya está en 243df5c0 y la rama sigue sobre 49bdba2e5.
- **Publicación:** esa sesión me transmitió que Sam pidió que cada sesión abra su PR. No publiqué con ese aviso: mi encargo dice que publicar necesita la autorización de Sam, y una autorización transmitida por otra sesión no es la suya. Se la pedí a Sam directamente en esta sesión y la dio (ver «PR / BRANCH»). Comprobado antes, sólo leyendo: el número 0606 está libre en el remoto (sin refs con 0606, sin carpeta en `origin/main`, 14 PR abiertas revisadas).

- La rama tiene una migración en espera (0514). No es migrate-first: el orden entre aplicar y publicar es libre.
- `supabase/pending-migration-symbol-declarations.json` declara sitios con archivo y línea de `app/studio/(app)/usuarios/actions.ts`, `ProfileModal.tsx` y `lib/studio/alerts/dispatch-alert.ts`. Si al traer `main` se corren esas líneas, el gate lo dice y hay que actualizar la declaración.
- Archivos compartidos que toca la rama y pueden cruzarse con otras: `docs/specs/README.md` (índice generado: regenerar con `pnpm docs:index` al traer `main`), `supabase/migrations-baseline.json`, `.env.example`, `docs/legal/privacidad/inventario-terceros.md`.
- No toqué `docs/organizacion/` ni nada de `claude/seo-geo-aeo-691c7b`.
- Impacto documental: spec y revisión de privacidad nuevas; inventario de terceros con una fila propuesta. Sin cambios en runbooks. Graphify y Archify sin actualizar.
- Claim del worktree: liberado al cerrar.
