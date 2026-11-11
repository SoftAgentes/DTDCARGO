---
sdd: "0588"
title: "Actualizaciones de Chatwoot desde Studio (etapa E3 del programa SDD-0582)"
status: in-progress
author: "Claude Worker «0582 E3» (Sam)"
created: 2026-10-30
updated: 2026-10-30
supersedes: null
superseded_by: null
related: ["0582", "0583", "0584", "0585"]
confidencialidad: interno
---

# SDD-0588 — Actualizaciones de Chatwoot desde Studio (E3)

> SDD hija de la [SDD-0582](../0582-chatwoot-piloto/spec.md), etapa **E3 «Actualizaciones desde Studio»** (decisión H), pasos **3.1 a 3.4** del [checklist](../0582-chatwoot-piloto/checklist.md). El **3.4** (análisis con IA del salto de versión) entró el 2026-10-30, cuando Sam eligió el motor (ver «Paso 3.4»).

## Contexto

- Chatwoot `v4.19.1-ce` corre en el VPS desde el 2026-10-29 ([SDD-0583](../0583-chatwoot-vps-e1/spec.md)), fijado por etiqueta y digest.
- DTD le monta dos initializers propios en solo lectura: la **redacción de logs** (paso 1.7) y el **candado de `/register` y `/deregister`** (paso 4.2, [SDD-0584](../0584-chatwoot-proteccion-register/spec.md), PR aparte, todavía no desplegado). Una subida mal hecha puede dejarlos **sin efecto en silencio**: el candado protege el número de WhatsApp que se comparte con Kommo.
- Pedido de Sam (respuesta 5 de la 0582): «un botón en Studio que muestre qué implica cada versión, con análisis por IA». Esta SDD entrega el aviso, la pantalla, el procedimiento y el análisis (3.4).

## Alcance

| Paso | Entrega |
|---|---|
| 3.1 | [Runbook de versiones](../../runbooks/chatwoot-versiones.md): RPO/RTO, ventana, drenaje de Sidekiq, respaldo conjunto en el momento, prueba en copia, paso a producción, smoke S1–S10 y recuperación del tráfico. Comprobación explícita de los dos initializers, por línea de arranque **y** por comportamiento. Ampliado el 2026-10-30 a pedido del Director con el tercer initializer, `zz_dtd_revocar_sesiones.rb` (paso 2.7 de E2, texto tomado de su handoff 0585): fila en «Pieza propia», corrida `prueba-revocar-sesiones.sh` en §4 con su control C1 en rojo, y S6–S7 en el smoke, que pasa a S1–S12 |
| 3.2 | Vigilante: cron diario `/api/cron/chatwoot-versiones` que compara `GET https://chat.dtdcargo.com/api` con los releases públicos de `chatwoot/chatwoot` y guarda la revisión en `chatwoot_version_checks` (0507). Avisa por push a los admins una vez por versión nueva |
| 3.3 | Pantalla **Administración › Actualizaciones** (`/studio/admin/actualizaciones`), solo para admin: versión instalada, disponible, notas de cada versión pendiente, «Revisar ahora» y «Pedir actualización», que guarda un registro en `chatwoot_update_requests` (0507) y **no despliega nada** |
| 3.4 | «Analizar con IA» en la misma pantalla: arma un paquete **solo de código** (diff público de Chatwoot entre las dos etiquetas y la superficie propia de DTD), lo manda al motor GLM de Z.AI y guarda en `chatwoot_version_analyses` (0509) un informe en español con el riesgo por pieza propia y la recomendación «seguro / revisar / no actualizar». Si el motor falla, guarda el informe **sin IA**. **No despliega nada** |

**Fuera:** cualquier cambio en el VPS (también el de agentes y la oficina), en Meta o en el Chatwoot vivo; poner la llave real del motor en el servidor (puerta de integración con OK de Sam); y subir de versión de verdad (cada subida es su propia tarea con OK nominal).

## Decisiones

| ID | Decisión | Por qué |
|---|---|---|
| E3-D1 | **El pedido es un registro, no un despliegue.** «Pedir actualización» inserta una fila y lo dice en pantalla; nada en Studio tiene credenciales del VPS | Decisión H: el análisis «solo informa», y la puerta de despliegue de la 0582 es un OK nominal de Sam |
| E3-D2 | **Un pedido por versión destino y tenant** (`unique (tenant_id, to_version)`). Pedir otra vez la misma responde «ya pedida» | El registro es para el Director y Sam; repetirlo no agrega información |
| E3-D3 | **El vigilante solo lee fuentes públicas sin credenciales:** `/api` de Chatwoot (pública) y la API de releases de GitHub sin token. Una revisión al día; «Revisar ahora» reutiliza una de menos de 10 min | GitHub admite 60 pedidos por hora por IP sin token; no hace falta un secreto nuevo |
| E3-D4 | **Sin datos personales en las revisiones.** Las notas de Chatwoot nombran a quien contribuye (`by @usuario in …`, «New Contributors»); se quitan antes de guardar, igual que todo HTML crudo (etiquetas y comentarios). Las notas se muestran como **texto plano**, y el enlace solo si apunta a `github.com/chatwoot/chatwoot/releases/` | revisar-datos-ve (§ abajo); contenido de un tercero |
| E3-D5 | **Aviso una vez por versión:** el push sale solo si la última revisión **sin error** no mostraba esa misma versión. Un error de lectura no avisa: un `/api` caído ya lo avisa Uptime Kuma | Evitar ruido sin perder el aviso |
| E3-D6 | **Escribe solo service_role** en `chatwoot_version_checks`; el admin solo lee. Los pedidos los crea el admin con su propio cliente (RLS: admin, su tenant, `requested_by = auth.uid()`, revisión citada visible) | Que nadie pueda fabricar una «versión disponible» desde Studio |
| E3-D7 | **Navegación de una línea:** una sección más en Administración (grupo PRO), con `requireModuleView("admin")` en el layout y `requireRole("admin")` en cada acción | Pedido del Director para minimizar conflictos con E2 y E6.3 |
| E3-D8 | **Comprobación de los initializers por comportamiento** (runbook §4 y S2–S5): controles en rojo de `ensayo-local.sh` (A1) y `prueba-register.sh` (C), dueño del método interceptado y sonda de redacción. La línea «activa» del arranque no basta | Un método renombrado deja el candado cargado pero inútil |

## Paso 3.4 · Análisis con IA

**Motor (E3-D15, decisión vigente).** Sam lo decidió el 2026-10-30, por selector. Sus respuestas literales a las preguntas del Director:

- «¿Qué proveedor de IA de pago usa Studio (para el análisis de versiones 3.4 y el bot E7)?» → «Solo GLM».
- «¿Qué tope de gasto mensual pones para empezar?» → «US$50 al mes».

Queda así:

- La llave será una **API key de pago de Z.AI, aparte** del plan de la oficina de agentes, con **su propio tope de US$50 al mes**. La crea Sam al arrancar.
- Studio la lee de su variable propia, `DTD_CHATWOOT_IA_GLM_KEY`. El repo no lee la variable de la oficina ni copia su valor.
- El bot de **E7 usa el mismo proveedor (solo GLM) y el mismo tope**.

Esta decisión reemplaza a la anterior del mismo día («GLM de la oficina (Recomendado)», que apuntaba al Personal Coding Plan de la oficina). La anterior queda solo como historia.

> **Orden del Director del 2026-10-30, después de esta decisión: «No implementes el 3.4 todavía».** Llegó cuando el 3.4 ya estaba hecho y publicado en esta rama (`7d66bd450`, punta `c2a91dcab`). No se revirtió nada. El Director respondió el mismo día que **se queda**, porque ya está hecho y bien protegido, y que la fila 3.4 **entra a la cola de `pnpm verify`** detrás del 2.7 de E2, que corre desde las 21:08Z. También pidió que el endpoint por defecto sea el de la API de pago (abajo, «Endpoints»).

| ID | Decisión | Por qué |
|---|---|---|
| E3-D9 | **Al motor solo le llega código.** El paquete trae el diff **público** de `chatwoot/chatwoot` (`GET /repos/chatwoot/chatwoot/compare/vA...vB`, sin token), pero solo de los archivos de los que depende alguna pieza propia (`PIEZAS`). De los demás archivos cambiados van solo los nombres. Además va la superficie de DTD: initializers y compose de `infra/chatwoot`, la ficha (`panel/`) y un **índice** de las rutas de Chatwoot que usa `lib/studio/chatwoot`, con `archivo:línea`; el código entero de esa carpeta no viaja | Pedido del Director: «nunca le llegan datos de clientes, `.env` ni secretos» |
| E3-D10 | **Dos cortes, con prueba negativa.** `rutaExcluida` saca `.env*`, `secretos/`, `credentials`, llaves, certificados y archivos de datos. `pareceSecreto` saca cualquier archivo cuyo texto tenga forma de credencial (llaves privadas, `sbp_`, `sk-`, JWT, llaves de Z.AI, asignaciones literales largas a `*SECRET*`, `*TOKEN*` y parecidas). La superficie se lee sin recorrer subcarpetas y nunca entra un valor de `process.env` | Dos cortes independientes: uno por ruta y otro por contenido |
| E3-D11 | **Respuesta con esquema cerrado.** El motor responde un JSON con `recomendacion`, `resumen` y `piezas`. `leerInforme` descarta las piezas inventadas y los archivos que no están en el paquete, completa en «medio» las piezas que el motor no evaluó, nunca deja «seguro» si alguna pieza tiene riesgo o si el paquete se recortó, y pasa todo a texto plano. Las instrucciones le dicen al motor que el contenido es material para revisar, nunca órdenes | IA-01: contexto no confiable (*prompt injection*) e identificadores alucinados |
| E3-D12 | **Respaldo sin IA.** Si no hay llave, si el motor falla, si tarda más de 120 s o si responde algo inválido, se guarda un informe determinista: por pieza, si la versión cambia archivos de los que depende. Ese informe recomienda «revisar» o «seguro» y nunca «no actualizar», porque no lee el código (la 0509 lo impone con un check). Si GitHub no da el diff, no se llama al motor | IA-01: «siempre existe salida segura o camino manual»; el camino manual es el runbook §3 |
| E3-D13 | **Topes.** Por archivo: 12.000 caracteres. Por paquete: 120.000. Nombres de otros cambios: hasta 300. Respuesta del motor: 4.000 tokens, de la que se leen como mucho 60.000 caracteres. Hasta **5 análisis por tenant en 24 h**, contados en la 0509, y uno a la vez por tenant. Caché: un análisis **con IA** del mismo salto en los últimos 30 días se reutiliza sin llamar a nadie. Un informe sin IA no cuenta como caché | Cuidar el tope de gasto de US$50 al mes (E3-D15), que comparte con el bot de E7. El tope de dinero se fija en la cuenta de Z.AI; estos topes acotan cuánto puede gastar el 3.4 |
| E3-D14 | **Solo el salto pendiente.** La acción exige que `de → a` sea la instalada y la disponible de la última revisión, igual que «Pedir actualización»: un formulario viejo no gasta llamadas. El informe lo escribe service_role después del gate de admin; el admin solo lo lee | E3-D6 |

**Nivel IA-01: I1** (propone una clasificación y una recomendación). No escribe nada del ERP ni dispara acciones: el informe es un registro aparte y la subida sigue pidiendo el OK nominal de Sam.

| Contrato IA-01 | Clasificación | Evidencia |
|---|---|---|
| El usuario sabe qué hace, con qué datos y qué está procesando | cumplimiento | El panel dice qué le llega al motor y que no instala nada. Mientras corre, el botón dice «Analizando…» |
| Permiso y tenant antes del contexto | cumplimiento | `tenantAdminGate` y la revisión del tenant, antes de leer GitHub o la superficie (`actions.test.ts`) |
| Separa hecho, inferencia y propuesta | cumplimiento | El informe dice si salió con IA (y con qué modelo) o sin IA, y separa la recomendación de los archivos citados. No toca datos del ERP |
| Preview o diff antes de I2–I4 | no aplica | I1 |
| Cancelar y fallo parcial | no aplica | No ejecuta nada. El fallo del motor cae al respaldo, que dice el motivo |
| Prompts y outputs minimizados | cumplimiento | E3-D9, E3-D10 y E3-D13. Se guarda el informe, no el prompt |
| Auditoría I3/I4 | no aplica | I1. Igual queda constancia del modelo, de quién pidió, del salto y del tamaño del paquete |
| Prompt injection, alucinación de ID y doble ejecución | cumplimiento | E3-D11 (`analisis.test.ts`) y uno a la vez con caché (`analisis-motor.test.ts`) |
| Salida segura | cumplimiento | E3-D12 |

**Allowlist del 3.4** (archivos de comportamiento que cambian):

- `lib/studio/chatwoot/analisis.ts`, `analisis-superficie.ts`, `analisis-motor.ts` y `analisis-queries.ts` (nuevos);
- `app/studio/(app)/admin/actualizaciones/actions.ts` (`analizarConIa`), `page.tsx` y `_components/ActualizacionesPanel.tsx`;
- `next.config.ts`, solo `outputFileTracingIncludes` de `/studio/admin/actualizaciones`;
- `supabase/migrations/0509_chatwoot_version_analyses.sql` (nueva);
- `.env.example` e `infra/dtd-cargo/.env.example` (las tres variables `DTD_CHATWOOT_IA_GLM_*`).

Pruebas y declaraciones: `lib/studio/chatwoot/__tests__/analisis{,-superficie,-motor}.test.ts`, `app/studio/(app)/admin/actualizaciones/__tests__/{actions,ActualizacionesPanel}.test.ts(x)`, `supabase/tests/0509_chatwoot_version_analyses.test.sql`, `lib/studio/__tests__/chatwoot-analisis.migration.test.ts`, `lib/studio/rbac-actions-guard.test.ts` (452 → 453), `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`.

**Endpoints** (los dos son compatibles con OpenAI, `POST …/chat/completions`):

| Endpoint | Cuándo | Cómo |
|---|---|---|
| `https://api.z.ai/api/paas/v4/chat/completions` · **API de pago de Z.AI** | **Por defecto** (`URL_MOTOR_POR_DEFECTO`). Va con la API key de pago que crea Sam, aparte del plan de la oficina y con su tope de US$50 al mes (E3-D15) | `DTD_CHATWOOT_IA_GLM_URL` vacía |
| `https://api.z.ai/api/coding/paas/v4/chat/completions` · **Coding Plan** | **No se usa.** El plan es para herramientas de programación y no sabemos si sus términos admiten el uso desde una aplicación | Solo si se escribe a propósito en `DTD_CHATWOOT_IA_GLM_URL` (`URL_MOTOR_CODING_PLAN` queda documentada en el código) |

Pruebas: `analisis-motor.test.ts` fija que el valor por defecto es la API de pago y no contiene `/coding/`, y que el Coding Plan solo entra si se configura.

**NO VERIFICADO sin la llave real:** que la API de pago responda con esta forma y el modelo `glm-4.6` desde el servidor de Studio, y que el tope de US$50 al mes esté configurado en la cuenta. La llamada real a Z.AI es una puerta de integración con OK de Sam. La URL y el modelo se cambian sin tocar código con `DTD_CHATWOOT_IA_GLM_URL` y `DTD_CHATWOOT_IA_GLM_MODELO`.

## Migración 0507 (NO APLICADA)

`supabase/migrations/0507_chatwoot_versiones.sql`, declarada en `migrations-baseline.json › pendingBelowCutoff`. Número **asignado por el Director** el 2026-10-30, comprobado contra todas las ramas y worktrees (la más alta ocupada era la 0506). Contrato `supabase/tests/0507_chatwoot_versiones.test.sql` (26 aserciones) en `lib/studio/__tests__/chatwoot-versiones.migration.test.ts`: contrato verde, control rojo, 9 mutantes que caen en su aserción y preflight de reaplicación.

Sin la 0507, todo degrada sin romper: el cron responde `omitido`, la pantalla dice «Todavía no hay revisiones» y «Pedir actualización» responde un error traducido.

## Migración 0509 (NO APLICADA)

`supabase/migrations/0509_chatwoot_version_analyses.sql`, declarada en `migrations-baseline.json › pendingBelowCutoff`. Va después de la 0507 (de ella cuelga `check_id`). **0509 tomada por E3 y confirmada por el Director el 2026-10-30.** El Director no la había asignado: había pedido la 0508 libre para E9 y E2 la tomó. Después revisó la 0509 en todas las ramas y nadie más la usa. Contrato `supabase/tests/0509_chatwoot_version_analyses.test.sql` (21 aserciones) en `lib/studio/__tests__/chatwoot-analisis.migration.test.ts`: contrato verde, control rojo, 9 mutantes, preflight de reaplicación y preflight sin la 0507 (14/14 PASÓ).

Sin la 0509: la pantalla no muestra informe y «Analizar con IA» responde un error traducido **antes** de leer GitHub o llamar al motor.

## Criterios de aceptación

- [x] **3.1** Runbook con RPO/RTO, ventana, drenaje, respaldo conjunto, prueba en copia, producción, smoke y recuperación del tráfico; comprobación explícita del candado de `/register` y de la redacción de logs en §4 y S2–S5.
- [x] **3.2** El cron compara `/api` con los releases, guarda la revisión sin datos personales y avisa una vez por versión nueva (pruebas puras, de fuentes, del vigilante con doble que filtra y de la ruta).
- [x] **3.3** Pantalla solo admin con versión instalada, disponible, notas y «Pedir actualización» que deja registro y no despliega; `/ui-check` pasado (3 ajustes aplicados: `--ink-mute` como texto → `--ink-soft`, notas en `--f-sans`, alineación del icono sin px sueltos).
- [x] **3.4** «Analizar con IA»: paquete solo de código con prueba negativa de secretos y `.env`, doble del motor, respaldo sin IA, topes, caché y timeout; informe por pieza y recomendación; no despliega (E3-D9 a E3-D14). 58 pruebas puntuales PASÓ y 20 de 21 mutantes muertos; el que sobrevivía era código de más y se quitó.
- [ ] `pnpm verify`: corrido el 2026-10-30 sobre `b9e1e3e54` y FALLÓ. Los 4 rojos son ajenos a E3: dos heredados de E2, ya corregidos (`850a6ff91`, `5451c818d`), y dos ambientales o del sitio público (detalle en el handoff). Segunda corrida, con turno del Director, el 2026-10-31 de 09:26Z a 10:06Z sobre `b04e63abcca1c715817cb9cd30f0db5b9f0e3d76`, que incluye el 3.4 y el código de 2.7 y 2.8 de E2. FALLÓ **solo por rojos heredados**: 3 contratos SQL de SDD-0573 (0467/0497) y el e2e del CTA de Shipping Mark. Ningún rojo es propio ni de carga. Los contratos de la 0507 y la 0509 pasan en Postgres 17. Queda abierto hasta un verify verde.
- [x] Cron registrado en `vercel.json` (13:15 UTC) y el crontab regenerado sobre la punta de `codex/0582-e2-poc` del 2026-10-30 (`c1d081b3b`).

## Privacidad (revisar-datos-ve)

| Dato | Dónde | Base y minimización |
|---|---|---|
| Versión instalada y publicada, notas de releases | `chatwoot_version_checks` | Datos técnicos públicos. Se quitan las menciones a personas (E3-D4); retención de 180 días |
| uuid de quien pide | `chatwoot_update_requests.requested_by` | Trazabilidad interna de una decisión operativa. Solo el uuid; sin nombre ni correo; `on delete set null` |
| Paquete de código para el motor | Z.AI (GLM), en tránsito; no se guarda | Sin datos personales: diff público de Chatwoot y código propio de DTD, con dos cortes y prueba negativa (E3-D9, E3-D10). Fila en [inventario de terceros](../../legal/privacidad/inventario-terceros.md) §2. Como no hay datos personales, la PIPL no aplica aunque el proveedor sea chino |
| Informe y uuid de quien lo pidió | `chatwoot_version_analyses` | Datos técnicos sobre código; `requested_by` solo con el uuid y `on delete set null`; tope de 64 KiB por informe |

Nada de lo que sale a la red lleva datos de clientes: el pedido a GitHub no tiene parámetros propios, el de `/api` no lleva credenciales y al motor solo le llega código, con la llave únicamente en la cabecera `Authorization`.

## 2026-11-04 · La 0507 y la 0509 aplicadas en producción: cierre del runbook §6

Aplicadas hoy por el Director General. Lo que antes en esta spec dice que no están aplicadas es de su fecha.

| Migración | COMMIT | `version` del ledger | md5 y bytes | Filas del ledger | PR | Evidencia, en `/srv/ops/evidencias/` | Sello en el candado, `ledger` exacta |
|---|---|---|---|---|---|---|---|
| `0507_chatwoot_versiones` | 2026-11-04T21:11:07.833Z | `20261104211107` | `a04d4f7a18f700146e8cf7580da01d0a`, 6532 | 511 | #339 | `apply-0507-dtd-cargo-20261104T211106Z` | `852d9adac1653ccefb88da730182d53b0a4cb753b2d8851387c1405d5fbdf489` |
| `0509_chatwoot_version_analyses` | 2026-11-04T21:11:29.767Z | `20261104211129` | `563f4ce0987a33876d5340000b28c90c`, 4966 | 512 | #339 | `apply-0509-dtd-cargo-20261104T211128Z` | `081a57aa5d6107a1cbf18dd11b11a800ca06cd984c15f6eead1cedbe119906d3` |

- **OK literal de Sam:** «Doy el mandato», en el chat del Director General, a «¿Das el mandato para terminar las fases 2, 3 y 4 sin detenerme?», 2026-11-03 ~20:10Z. El punto 2 del texto que vio nombra las dos: «Aplicar, primero en prueba y luego en dtd-cargo, de a una y con lectura previa». Registrado a nombre del Director General; el texto íntegro está en `AUTORIZACION.txt` de cada evidencia.
- **Ensayo en prueba:** aplicadas de a una a las 20:34Z sobre `55a65a602`, con lectura previa, apply y verificación PASÓ, sin cambio de blobs. Evidencia: `apply-0507-dtd-cargo-staging-20261104T203428Z` y `apply-0509-dtd-cargo-staging-20261104T203444Z`. Según el Director General, sobre esa imagen `/api/cron/chatwoot-versiones` respondió 200 con `al_dia`, 4.19.1 contra 4.19.1, y dejó una fila.
- **Respaldo previo:** el más reciente en `/srv/backups/dtd-cargo` al cerrar es `dtd-cargo-20261104T123031Z`, de la ventana de publicación, unas 8,7 horas antes. No hay uno posterior. Son dos tablas nuevas, sin datos que restaurar.
- **Merge:** #339, 2026-11-04T20:33:11Z, `55a65a602`, por el Director General, con CI verde en `db2176c13`.
- **Publicación:** todavía no. La web publicada sigue en `fe35eb2d1`, que no usa estas tablas. El cron `chatwoot-versiones` entra con el crontab nuevo, en la ventana de esa publicación.
- **Motor de IA:** las 3 variables `DTD_CHATWOOT_IA_GLM_*` están vacías, según el Director General. La llave es gasto de Sam y queda fuera del mandato, así que el análisis usa el respaldo sin IA. El **NO VERIFICADO** de la API de pago sigue en pie.
- **Lectura de esta nota:** COMMIT y md5 salen de `IDENTIDAD.txt` y `registro.txt` de cada evidencia. Del ledger se leyó el `version` de estas dos y el total: 512. La fila de cada una sale de ese total y del orden. El md5 y los bytes se comprobaron contra el archivo al sellar.
- **Espera:** salieron de `pendingBelowCutoff` y de las declaraciones de símbolos. Su cabecera «NO APLICADA A PRODUCCIÓN» no se corrige: la identidad se prueba por md5. Las pruebas que afirmaban la espera ahora afirman que salió. Los comentarios condicionales del código («sin la 0507…») siguen siendo ciertos para otro entorno y no cambian.

## 2026-11-04 y 2026-11-05 · Publicada con la tanda B y primera corrida del cron en producción

**Publicación, según el Director General:**

| Qué | Dato |
|---|---|
| Hora | 2026-11-04 22:53:29Z |
| Imagen | `sha-92e2bb706`; la anterior, `fe35eb2d1` |
| Crontab | `80db6fa307ad621f`, 22 crons, con `chatwoot-versiones` a las 13:15Z |
| Respaldo | `dtd-cargo-20261104T225143Z` |
| Evidencia | `/srv/ops/evidencias/ventana-tanda-b-20261104T225143Z` |

**Primera corrida, leída por el Subdirector** el 2026-11-05 a las 13:22:22Z en `dtd-cargo-db-1`, dentro de una transacción con `ROLLBACK` y sin datos de personas. `chatwoot_version_checks` tenía 1 fila:

| `checked_at` | Estado | Instalada | Publicada | Filas |
|---|---|---|---|---|
| 2026-11-05 13:15:02Z | `al_dia` | 4.19.1 | 4.19.1 | 1 |

Con eso se cierra la prueba de `chatwoot-versiones` en producción, que hasta entonces solo había corrido en prueba. Siguen igual el **NO VERIFICADO** de la API de pago del motor y el `pnpm verify` de los criterios de aceptación.

**Tandas C y D.** Producción pasó a `sha-1aafa150e` con la tanda C, y a `sha-7a8afdd2c` el 2026-11-06 a las 02:01Z con la tanda D, según el Director General. La D no cambió el crontab, según él; de la C no tengo ese dato.

## 2026-11-06 · Los correos de SDD-0583 como pieza propia

**Por qué.** Los correos de DTD (`rails/zz_dtd_correo.rb` y `correo/views`) corren en el VPS desde el 2026-10-30 y están en `main` desde la #373. El runbook ya los tiene en su tabla de piezas, pero `PIEZAS` no, así que «Analizar con IA» y el informe sin IA no avisaban si una versión nueva cambia los mailers o las plantillas que DTD reemplaza. Si dejan de cargar, los avisos a agentes vuelven a copiar el nombre del contacto y el texto de los mensajes. Lo había anotado el handoff de SDD-0583 en FUERA DE ALCANCE.

**Encargo:** del Director General, 2026-11-06. Él decidió el 2026-11-05 que fusionarla pide OK de Sam, porque está fuera del mandato. La fusión es de él.

**Qué cambia.** Una pieza nueva, `correo`. Depende de lo que el inicializador toca en Chatwoot 4.19.1, leído en el repositorio público con la etiqueta `v4.19.1`:

| Ruta | Por qué |
|---|---|
| `app/mailers/` | `ApplicationMailer` con `layout 'mailer/base'`, `prepend_view_path ::EmailTemplate.resolver` y `append_view_path app/views/mailers`; DTD antepone sus vistas y un `prepend` sobre `#mail` |
| `app/views/mailers/administrator_notifications/`, `agent_notifications/` y `email_delivery_test_mailer/` | Las plantillas que DTD reemplaza |
| `app/views/devise/mailer/` y `app/views/layouts/mailer/` | Las de Devise y el diseño común |
| `app/models/email_template.rb` | El resolver de plantillas guardadas en la base, al que DTD le gana |
| `config/initializers/devise.rb` | `config.parent_mailer = 'ApplicationMailer'`: por eso los asuntos de Devise pasan por DTD |
| `Gemfile.lock` | Versión de ActionMailer y Devise |

Las vistas de `correo/views` no entran en la superficie que viaja al motor, porque `FUENTES_SUPERFICIE` no recorre subcarpetas. El inicializador sí, como los demás `.rb`.

**Allowlist:** `lib/studio/chatwoot/analisis.ts`, solo `PiezaId` y la pieza nueva; `lib/studio/chatwoot/__tests__/analisis.test.ts`; esta sección; `.agents/handoffs/0588-piezas-correos.md`; y una línea en `.agents/handoffs/0583-chatwoot-vps-e1.md` que cierra su FUERA DE ALCANCE.

**Evidencia:**

| Comprobación | Resultado |
|---|---|
| `analisis`, `analisis-superficie`, `analisis-motor`, `actions` y `ActualizacionesPanel` | PASÓ: 76 de 76 |
| Mutantes: sin la pieza, sin el layout, sin `devise.rb`, sin `app/mailers/`, con todas las vistas de mailers, y descripción sin el inicializador | PASÓ: 6 de 6 caen por la prueba nueva, con el control en verde antes y después |
| eslint de los dos archivos | PASÓ |
| `pnpm verify` sobre `5ec159f43`, con turno del Director General, de 02:18:50Z a 03:08:15Z | **FALLÓ, por dos vencimientos ajenos al cambio.** PASÓ: harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, e2e y build. En `test`, 14 799 de 14 802: vencieron a los 600 s `prueba-migraciones-produccion.sh` en los dos intentos y las pruebas con dobles de `entorno-prueba-scripts.test.mjs` en el reintento. Son scripts bash con el pool lleno, y el diff no toca `infra/ops` ni `scripts` |
| Las dos pruebas vencidas, a solas y con un solo worker, 03:08Z a 03:12Z | PASÓ: 32 de 32, en 92,7 s y 119,5 s |
| migrations-applied, sql-tests y schema-rebuild | NO DISPONIBLE: el worktree no tiene `.env.local` y Docker está apagado. El cambio no toca SQL |
