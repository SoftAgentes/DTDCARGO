---
sdd: "0540"
title: "Entorno de prueba de DTD Cargo con base separada en el VPS (diseño)"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-10-16
updated: 2026-10-16
supersedes: null
superseded_by: null
related: ["0505", "0506", "0518"]
confidencialidad: interno
---

# SDD-0540 — Entorno de prueba («prueba/DTD Cargo») con base separada

> Diseño de un entorno de prueba permanente en el VPS: Sam abre un link, prueba una rama con datos que no son de clientes, la aprueba y recién entonces autoriza subirla a producción. Esta SDD **no implementa infraestructura**: compara alternativas, recomienda una, fija el plan por fases y deja las decisiones de Sam.

## 0 · Pedido, alcance y cómo leer esta spec

**Pedido de Sam (literal, citado por el Director):** «Necesitamos un link o entorno de prueba … desarrollarlos y probarlos primero en local y, una vez aprobados ahí, autorizar subirlos al VPS.» Y también: «Acuérdate que estamos en prueba». El Director lo anotó como un entorno de staging («prueba/DTD Cargo») con base separada, como tarea propia con su SDD.

**Lectura del pedido (inferencia, la confirma Sam en D1):** tres peldaños. **Local** es donde el Worker programa y corre sus pruebas. **Prueba** es un link en el VPS, aislado de producción, donde Sam mira y aprueba. **Producción** es el VPS real, y a ella solo se llega con la autorización de Sam.

**Dentro del alcance:** situación actual con evidencia, alternativas, recomendación, plan por fases con criterios medibles y decisiones para Sam.

**Fuera del alcance:** crear DNS, levantar contenedores, tocar el servidor, Vercel o GitHub, leer producción y cambiar código de producto. Cada fase del §3 tiene su propio encargo.

**Archivos que cambia esta SDD (allowlist):** esta spec, el índice `docs/specs/README.md` (regenerado con `pnpm docs:index`) y el handoff `.agents/handoffs/0540-entorno-prueba-staging.md`.

**Convención de evidencia.** Las rutas `archivo:línea` se refieren a `origin/main` en `6da8aebc` (2026-10-15). Lo que vive en el servidor, en un panel o en GitHub y no se pudo mirar desde el repo va marcado **NO VERIFICADO**. Esta sesión no tuvo SSH, panel ni secretos.

---

## 1 · Situación actual

### 1.1 Producción: la base ya vive en el VPS y la web está en traslado

- **Servidor.** Contabo Cloud VPS 8, US East, IP `217.216.54.70`, 8 vCPU compartidos, 24 GB de RAM, 300 GB SSD, $22,70/mes (`docs/runbooks/servidor-contabo.md:5`). Lo comparte con otro proyecto, `rent-awada-pruebas` (`.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md:379`).
- **Base y archivos.** Supabase self-hosted, proyecto compose `dtd-cargo` en `/srv/dtd-cargo` (`infra/dtd-cargo/compose.yml:32`; runbook §1.9, `servidor-contabo.md:266-279`). El paso 1 del corte se ejecutó el 2026-10-13: 279 PASÓ y 0 FALLÓ en la base, y Storage copiado (`.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md:619-633`).
- **Web.** Hasta el paso 2 servía Vercel contra la base del VPS. El paso 2 (DNS de `dtdcargo.com` al VPS, router del web, Vercel en pausa) estaba fijado para el 2026-10-15 a las 22:00 de Caracas (`servidor-contabo.md:741-753`). El encargo dice que el corte «está en curso». **NO VERIFICADO** desde esta sesión si el paso 2 terminó y si el proyecto de Vercel quedó en pausa.
- **Migraciones en el VPS.** Se aplican con `psql` dentro de `dtd-cargo-db-1`: la migración y su fila del ledger van en una sola transacción y la identidad se comprueba por md5 contra el blob (`.agents/handoffs/0506-bitacora-adjuntos-entidad.md:158-187`). El runbook formal de producción sigue escrito para el conector de Supabase Cloud (`docs/runbooks/aplicar-migraciones-prod.md:3-4,82-100`). El servidor pide reescribirlo (`servidor-contabo.md:831-835`), y hasta ahora se aplicó por excepciones explícitas de Sam (`0506-…md:151-154`).
- **Despliegue de la web en el VPS.** Se fija la etiqueta en `.env` y se corre `docker compose pull web && docker compose up -d web cron` (`servidor-contabo.md:288-294`; `compose.yml:44-47`). La imagen la construye CI. El workflow **no despliega** (`.github/workflows/build-image.yml:9-11`).

### 1.2 Las Preview de Vercel escriben en la base de producción

- El 2026-10-13 Sam decidió que Vercel apunte al VPS **en Production y en Preview** (`servidor-contabo.md:614,688`). Desde entonces, un Preview de cualquier rama trae la URL de Supabase de producción y la `SUPABASE_SERVICE_ROLE_KEY` de producción.
- El propio runbook lo advierte: «Ojo: desde el paso 1, un preview de Vercel escribe en la base del VPS» (`servidor-contabo.md:848-849`). Y propone desconectar la integración de Git de Vercel, porque cada PR construye un Preview (`servidor-contabo.md:842-847`).
- **Consecuencia:** un flag «solo en Preview» aísla la pantalla, no los datos. Crear un cliente, subir un archivo o encolar un aviso desde un Preview deja filas y archivos reales en producción. El runbook de e2e ya prohíbe usar un «Preview persistente» para fixtures (`docs/runbooks/e2e-supabase-efimero.md:9-15`).
- **NO VERIFICADO:** si después del paso 2 la pausa del proyecto de Vercel (`servidor-contabo.md:751`) también detiene los Preview de las PR nuevas.

### 1.3 El staging de la Fase 2 ya no existe

- Era una copia de producción con PII real: 305 usuarios, 266 tablas y 638 archivos. Vivía en el proyecto `dtd-cargo-staging`, con los hosts `staging.dtdcargo.com` y `supabase-staging.dtdcargo.com` (`servidor-contabo.md:303-351`).
- Llevaba allowlist de IP en Traefik (`infra/dtd-cargo/compose.staging.yml:26-40`) y un Mailpit sin salida a internet para los correos de Auth (`compose.staging.yml:42-68`).
- **Se destruyó el 2026-10-13** con evidencia: 0 contenedores, 0 volúmenes, 0 redes y 0 datos (`servidor-contabo.md:865`; `0505-…md:311-320`). Es la condición H6 de la revisión de privacidad: un staging con PII real es efímero (`docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md:87-91`).
- **Qué quedó.** En el servidor quedaron el compose, el `.env` con secretos solo del staging y dos imágenes `dtdcargo:staging-*` (`0505-…md:315-318`). Sam borró después los registros DNS (`0505-…md:634`, punto 4). El estado actual del servidor está **NO VERIFICADO**.
- **Medido entonces:** el staging vacío usaba **1,4 GB de RAM** con `db auth rest realtime storage imgproxy functions auth-templates` (`servidor-contabo.md:349-351`). El web del staging, 141 MiB (`0505-…md:503`).
- **Lo que sirve hoy.** La herramienta sigue en el repo y es reutilizable: `infra/ops/staging/new-env.sh`, que genera los secretos en el servidor sin mostrarlos (`new-env.sh:1-22`), y `infra/ops/staging/destroy-staging.sh`, que borra con guardas. El proyecto debe terminar en `-staging`, no puede ser `dtd-cargo` y exige `--confirm` (`destroy-staging.sh:9-23`).

### 1.4 La imagen se construye solo para `main`, con los valores de producción adentro

- `build-image.yml` corre en `push` a `main` y en `workflow_dispatch` (`build-image.yml:18-22`). Publica `sha-<sha>` y, solo desde `main`, `:main` (`build-image.yml:58-68`).
- Las `NEXT_PUBLIC_*` se inlinean en el bundle durante `next build` (`Dockerfile:46-61`; `build-image.yml:13-16`), y el workflow las toma de las **variables del repositorio**, que son las de producción (`build-image.yml:87-99`). La CSP también se arma en el build, con `NEXT_PUBLIC_SUPABASE_URL` (`next.config.ts:17`).
- **Consecuencia 1: una imagen de `main` no sirve para prueba.** Llevaría adentro la URL y la anon de producción, y el navegador de quien prueba le hablaría a la base real.
- **Consecuencia 2: hoy no hay imagen de prueba posible sin construir en el servidor.** En la Fase 2 la imagen del staging se construyó en el VPS, por excepción y porque el servidor todavía no tenía producción («Con producción ahí, la imagen sale de GHCR», `0505-…md:501`). Después se verificó que el bundle tuviera el host del staging y ninguno de producción (`0505-…md:502`).
- **Hallazgo:** un `workflow_dispatch` sobre una rama ya publica `sha-<sha>` con los valores de producción. Así se hizo `sha-09cf4f3c…` (`0505-…md:649`). Por su etiqueta, esa imagen de una rama sin revisar no se distingue de una de `main`. Ver §6.

### 1.5 Lo que la app ya trae para correr sin integraciones

| Salida | Sin su clave | Evidencia |
|---|---|---|
| Correo de la app (Resend) | modo mock: `mock_no_key`, sin HTTP. El log del envío queda | `lib/studio/mail/resend-api.ts:11-12,44-51`; `app/studio/(app)/mailing/actions.ts:163` |
| Anthropic | cliente mock | `lib/studio/agents/runtime/llm-client-factory.ts:21` |
| SeaRates | modo mock | `app/api/studio/searates/probe/route.ts:17` |
| Kommo (pg_cron) | `kommo_run_sync` y el drain se saltan si no hay `kommo_cron_key` en Vault | `supabase/migrations/0472_kommo_functions_base_url.sql:106,151` |
| Kommo (alta de cliente) | ensayo por defecto; escribe solo con `KOMMO_PUSH_DRY_RUN="false"` | `supabase/functions/kommo-push-client/index.ts:109-110` |
| Panel de entorno del Studio | muestra `APP_ENV`, el SHA del build y cada integración como `active`, `missing` o `mock` | `lib/studio/env-status.ts:92-96,106-130` |
| Entorno de ejecución | `APP_ENV=staging` es un valor reconocido; un valor desconocido cae a `production` | `lib/runtime/app-env.ts:35,53-65` |

El staging de la Fase 2 lo comprobó en el servidor: con todas las claves de integración vacías, 19 de 19 crons respondieron 200 y nada salió hacia los clientes (`0505-…md:242`).

### 1.6 Lo que hoy se filtraría a producción desde un entorno de prueba

Son condiciones que **cualquier** entorno no productivo construido con el código actual tiene que neutralizar:

1. **Google Analytics y Ads.** En un build de producción, un `NEXT_PUBLIC_GA_ID` vacío cae al ID de la propiedad real, `G-25CD7BZH98`, y se carga la etiqueta de Ads `AW-561290482` con la conversión «Click WhatsApp» (`components/Analytics.tsx:36-38,46-47`). La imagen Docker siempre es un build de producción. **No existe un valor que lo apague**: prueba contaminaría los reportes y las conversiones de la campaña. Hace falta un cambio de producto (§3, Fase 2).
2. **La URL de las Edge Functions de Kommo.** Si existe `kommo_cron_key` y falta `functions_base_url`, `kommo_run_sync` le pega a las functions de **Supabase Cloud** (`0472_…sql:112-114,157-159`). En prueba no debe existir ninguna de las dos claves.
3. **El bot de Telegram.** `telegram-webhook.sh set` registra un webhook con el token del bot (`servidor-contabo.md:750`). Si alguien corriera eso desde prueba con el token real, el bot de producción dejaría de recibir sus mensajes. Prueba nunca lleva el token de producción.
4. **Las variables de entorno de GitHub heredan las del repo.** Una variable de entorno de GitHub con el mismo nombre que una del repo la reemplaza. Si falta en el entorno, se usa la del repo: inferencia por el orden de precedencia documentado de GitHub, **NO VERIFICADO** en este repo. Con los mismos nombres, olvidar una variable de prueba produce en silencio una imagen que habla con producción. El §2.5 lo resuelve con nombres distintos y un guard.
5. **`NEXT_PUBLIC_SITE_URL`.** Unos 25 archivos tienen `?? "https://dtdcargo.com"` (`0505-…md:615`). Si la imagen de prueba no lleva `NEXT_PUBLIC_SITE_URL` propia, los enlaces y los canónicos apuntan a producción.
6. **`robots.txt`.** No distingue el entorno: siempre responde `allow: /` y un sitemap con la URL del build (`app/robots.ts:3-4,31`). Si prueba quedara alcanzable, se indexaría. El §2.4 lo resuelve con una cabecera `X-Robots-Tag` en Traefik.

### 1.7 No verificado desde esta sesión

Estado del paso 2 del corte y de la pausa de Vercel. RAM y disco libres del VPS hoy, y lo que consume `rent-awada-pruebas`. Restos del staging viejo en el servidor. Visibilidad del paquete de GHCR: `build-image.yml:15-16` habla de «imagen pública», pero `servidor-contabo.md:288-292` pide `docker login` con `read:packages`, así que las dos fuentes se contradicen. Cuota de minutos de Actions y de almacenamiento de GHCR. Valor real de `DISABLE_SIGNUP` en el `.env` de producción (la plantilla dice `false`: `infra/dtd-cargo/.env.example:274`).

---

## 2 · Propuesta

### 2.1 Tres peldaños

| Peldaño | Dónde | Quién | Base | Para qué |
|---|---|---|---|---|
| Local | worktree del Worker | Worker | PGlite y Docker efímero (`scripts/check-schema-rebuild.mjs`; `package.json:49`) | programar, `pnpm verify`, contratos SQL |
| **Prueba** | VPS, proyecto `dtd-cargo-staging`, `https://prueba.dtdcargo.com` | el Director lo pide, la sesión de Contabo despliega y Sam prueba | Supabase propio de prueba con **datos sintéticos** | ver la rama con los ojos de Sam y ensayar migraciones |
| Producción | VPS, proyecto `dtd-cargo`, `https://dtdcargo.com` | Director y sesión de Contabo, **con la autorización de Sam** | producción | operar |

Regla nueva que propone esta SDD (la decide Sam en D6): **una PR que cambia la base o una pantalla que Sam tiene que aprobar pasa por prueba antes de producción.** Las PR solo de docs o de harness no pasan por prueba.

### 2.2 Dónde vive prueba: alternativas

| | A · Proyecto compose aparte en el mismo VPS | B · VPS pequeño aparte | C · En la laptop o el PC de Sam con túnel | D · Preview de Vercel contra una base de prueba | E · Un entorno por PR |
|---|---|---|---|---|---|
| Aislamiento de datos | base, Auth, Storage, functions y secretos propios; redes y routers por nombre de proyecto (`compose.yml:14-25`; `servidor-contabo.md:336-338`) | total | total | base propia, pero Vercel guarda claves en Secret que no se dejan leer (`servidor-contabo.md:584`) | total por PR |
| Riesgo para producción | comparte CPU, RAM, disco y Traefik. Se acota con límites por contenedor (§2.8) | ninguno | ninguno | ninguno sobre la base si las variables de Preview cambian. Hoy apuntan a producción (§1.2) | igual que A, multiplicado |
| Prueba el mismo stack que producción | **sí**: mismas imágenes y mismo compose (`compose.supabase.yml`) | sí | sí | no: la web corre en Vercel y producción ya no | sí |
| Costo extra | $0 mientras la suma de límites no pase de 20 GB (`servidor-contabo.md:282-286`) | un plan más de Contabo (precio **NO VERIFICADO**) y otro servidor que endurecer, vigilar y actualizar | $0, pero el equipo tiene que estar encendido y Docker Desktop se arranca a mano | plan de Vercel, que Sam está retirando (`servidor-contabo.md:823-857`) | ~1,4 GB de RAM por PR solo en Supabase (`servidor-contabo.md:349-351`): no cabe |
| Link estable para Sam | sí | sí | depende del túnel y del equipo | sí, uno por PR | sí, uno por PR |
| Tiempo para tenerlo | ~1 día con la herramienta de la Fase 2 | días: hay que repetir la Fase 1 completa (`servidor-contabo.md:42-301`) | horas, frágil | horas, va contra el retiro de Vercel | semanas |

**Recomendación: A.** Es el único que prueba el mismo stack que producción sin costo nuevo. La herramienta de la Fase 2 ya está medida, y la convivencia de los dos proyectos detrás del mismo Traefik ya funcionó (`0505-…md:142`).

**Disparador para pasar a B** (lo decide Sam): que la suma de límites del VPS pase de 20 GB, que un incidente de prueba afecte a producción o que prueba vuelva a necesitar datos reales.

Nombres propuestos:
- **Hosts:** `prueba.dtdcargo.com` y `supabase-prueba.dtdcargo.com` (D3).
- **Proyecto compose:** `dtd-cargo-staging`, con los datos en `/srv/dtd-cargo-staging`. El sufijo `-staging` no es cosmético: es lo que habilita las guardas de `destroy-staging.sh` (`:20-23`) y la guarda de destino de los imports (`servidor-contabo.md:395-398`).

### 2.3 Qué datos lleva (pasado por `revisar-datos-ve`)

Método de la skill `.claude/skills/revisar-datos-ve/SKILL.md`: cada afirmación lleva estado ENCONTRADO, CORRECTO o NO VERIFICABLE y su evidencia (`SKILL.md:16-29`). Tampoco se ejecuta nada contra producción (`SKILL.md:110-112`). No se rehace el inventario. Se usa el de la revisión del traslado (`revision-traslado-contabo-2026-10-09.md:34-49`): documentos de identidad, fotos de cédula y de rostro, firmas, fachadas de vivienda, geolocalización, datos financieros y de nómina, voz y video, sesiones grabadas, IP, y terceros que no son usuarios (receptores de POD, contactos de proveedores chinos, 2.942 leads de Kommo).

| Opción | Qué es | Evaluación |
|---|---|---|
| **A · Sintéticos** (recomendada) | esquema desde las migraciones de `main` y una semilla determinista de datos inventados | No hay tratamiento nuevo de datos personales: no aplican finalidad ni temporalidad sobre titulares reales. Ya hay piezas en el repo: `supabase/seed.ts:1-13` («cero nombres reales»), `scripts/seed.ts:1-19` (catálogos) y `pnpm seed:e2e` (`package.json:21-23`). **CORRECTO** como dirección; la semilla completa de prueba **no existe** todavía (Fase 1). |
| B · Copia seudonimizada | dump de producción transformado antes de cargarlo | **ENCONTRADO, no recomendable.** (1) Los campos de texto libre (notas, observaciones, transcripciones de bitácora, `bitacora_meetings.transcript`) y los JSON sin tipar llevan PII que una regla de columnas no ve (`checklist-datos-ve.md`, punto 1). (2) Los archivos de Storage (cédulas, rostros, firmas, fachadas, voz) no se pueden seudonimizar: habría que excluirlos, y la prueba pierde justo lo que más se prueba. (3) Cada columna nueva con PII (hoy son 484 archivos de migración y 266 tablas, `servidor-contabo.md:768`) tiene que sumarse al transformador; si no, se filtra **sin que falle nada**, y eso no es un invariante. (4) Usar la copia para probar es una **finalidad nueva**. La SC 332/2001 limita los datos a fines predeterminados y su conservación al período necesario (`marco-legal-ve.md:74-75`). La PIPL pide el mínimo alcance (art. 6, `marco-legal-cn-pipl.md:46-48`) y volver a pedir el consentimiento si cambia la finalidad (art. 14, `:64-65`). (5) La referencia de la skill trae la seudonimización solo como **medida de seguridad** (art. 51, `:188-190`): en ella no hay base para tratar una copia seudonimizada como si ya no fuera información personal. Se trata como PII, con todas sus reglas. |
| C · Copia real efímera, por excepción | como la Fase 2: OK nominal de Sam con fecha, y destrucción al cerrar | Ya tiene precedente y condiciones (H6, `revision-traslado-…md:87-91`; §5.1 `:183`). Solo para un incidente que no se reproduzca con sintéticos. Mientras dure, prueba vuelve a la allowlist de IP (§2.4). **Hoy no hay script**: `import-from-cloud.sh` lee de Cloud, que quedó congelado tras el corte (`servidor-contabo.md:370-379`). Copiar del VPS de producción a prueba pide una herramienta nueva, que esta SDD no diseña. |
| D · Tablas de referencia no personales | complemento de A: tarifas, ciudades, servicios públicos y configuración de la calculadora, copiadas de producción con una **lista cerrada de tablas y columnas** | Útil para probar precios reales. Antes hay que revisar columna por columna que ninguna identifique a una persona: **NO VERIFICABLE** hasta hacer esa lista. Necesita OK de Sam, porque lee producción aunque no lea PII (D2). |

**China (PIPL).**
- El equipo de Yiwu trata datos en China, y hoy esos datos salen de allí sin el mecanismo del art. 38 (`revision-traslado-…md:127-131`).
- Una copia real o seudonimizada en prueba sería un tratamiento más de esos datos, con una finalidad distinta. Si además el equipo de China la consulta, la información vuelve a verse en China. Por el art. 55 eso pide una evaluación de impacto previa cuando hay datos sensibles o transferencia al extranjero (`marco-legal-cn-pipl.md:196-199`).
- Con sintéticos no hay información personal de titulares reales: el equipo de China puede probar la PWA `/m/cn` sin ese problema.
- La semilla usa nombres chinos **inventados**: nunca se copian los de proveedores reales.

**Reglas de la semilla (criterios de la Fase 1):**
- Correos solo en dominios reservados (`@example.test` o `.invalid`).
- Teléfonos en un rango no asignable. Así, un enlace `wa.me` armado con el teléfono de un cliente (`lib/studio/estimado-linking.ts:52`; `lib/studio/quote-types.ts:414`) no le escribe a una persona real.
- Cédulas y RIF con formato válido pero inventados, marcados con `PRUEBA` en el nombre.
- Archivos de Storage generados (placeholders), nunca fotos reales.
- Determinista e idempotente.
- Una prueba del repo falla si aparece un correo fuera de los dominios reservados o un teléfono fuera del rango.

> No es asesoría legal: es un inventario técnico para decidir. Las decisiones sobre la base de licitud y sobre el mecanismo PIPL siguen con el abogado (`revision-traslado-…md:240-244`).

### 2.4 Cómo se protege el acceso

Con datos sintéticos, el riesgo deja de ser «se filtra PII». Ahora es otro:
1. que un cliente confunda prueba con el sitio real;
2. que un buscador lo indexe;
3. que alguien abuse de la API;
4. que prueba se use como trampolín hacia producción.

Capas propuestas, todas medibles:

| Capa | Qué | Evidencia o motivo |
|---|---|---|
| Sin registro público | `DISABLE_SIGNUP=true` y `ENABLE_ANONYMOUS_USERS=false` en GoTrue | `compose.supabase.yml:199,213`. Las altas de la app usan la API admin (`app/registro/actions.ts:347`), así que el registro de prueba sigue funcionando. Inferencia: GoTrue limita `DISABLE_SIGNUP` al endpoint público, se mide en la Fase 3 |
| Cuentas creadas por script | admin, operarios VE y CN con PIN, y clientes del Portal; las claves nacen en el servidor | mismo criterio que `new-env.sh:1-6` |
| No indexar | middleware de Traefik con `X-Robots-Tag: noindex, nofollow` en los dos routers | `app/robots.ts` no distingue el entorno (§1.6, punto 6) |
| Cookie de sesión propia | `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE` de prueba distinta de la de producción | `lib/db/session-cookie.ts:20-28` no fija `domain`, así que la cookie queda solo para su host. Inferencia sobre los valores por defecto de `@supabase/ssr`: se mide en la Fase 3 |
| Puerta de entrada | ver la tabla siguiente | — |

| Puerta | Cómo | A favor | En contra |
|---|---|---|---|
| **IP allowlist en los dos hosts** (lo que hizo la Fase 2) | `compose.staging.yml:26-40` tal como está | probada; nadie sin la IP ve nada | La IP de la casa de Sam cambió tres veces en tres días, y cada cambio dejaba todo en 403 hasta que una sesión con SSH lo corregía (`servidor-contabo.md:339-344`; `compose.staging.yml:32-33`). Un teléfono con datos móviles probando la PWA `/m` no entra. Necesita `STAGING_INTERNAL_IPS` para que el web llegue a su propio Supabase (`compose.staging.yml:34-40`) |
| **Clave en el web y API sin allowlist** (recomendada con datos sintéticos) | `basicAuth` de Traefik solo en `prueba.dtdcargo.com`, con usuarios en `htpasswd`/bcrypt generados en el servidor y guardados por Sam en su gestor. `supabase-prueba` queda abierto como producción y, sin `apikey`, responde 401 (`0505-…md:137`) | entra desde cualquier red, también un teléfono o la oficina de Yiwu. La anon de prueba solo está en el bundle, detrás de la clave | `basicAuth` **no sirve en el host de la API**: supabase-js manda su propio `Authorization: Bearer`, que choca con Basic. **NO VERIFICADO:** que el service worker de la PWA y el manifiesto carguen detrás de Basic (se mide en la Fase 3). Los webhooks entrantes (Telegram, Resend) no pueden mandar Basic: si algún día se encienden en prueba, necesitan una ruta con su propio secreto |
| Tailscale | routers con `IPAllowList 100.64.0.0/10` (`servidor-contabo.md:160-174`) | lo más cerrado | Tailscale todavía no está instalado (`servidor-contabo.md:864`). Cada persona que prueba, y cada teléfono, tiene que instalarlo. Let's Encrypt por HTTP-01 no valida un host de la tailnet |
| Cloudflare Access | login por correo delante de los dos hosts | buena experiencia | exige pasar el DNS de `dtdcargo.com` al proxy de Cloudflare, que sigue sin decidir (`servidor-contabo.md:206-209`), y cambia `REQUEST_IP_HEADER` (`:228-237`) |

**Recomendación:** «clave en el web y API sin allowlist», mientras prueba lleve **solo** datos sintéticos, más las capas de la primera tabla. Si alguna vez entra una copia real (opción C del §2.3), se vuelve a la allowlist de IP en los dos hosts durante la excepción. Lo decide Sam en D4.

### 2.5 Cómo llega una rama a prueba

Una rama necesita cuatro piezas en prueba. Hoy solo la primera puede salir de CI:

| Pieza | Cómo llega | Por qué así |
|---|---|---|
| Imagen del web | GHCR, construida con los valores de prueba | las `NEXT_PUBLIC_*` se fijan en el build (§1.4). Construir en el VPS ya no se permite con producción allí (`0505-…md:501`) |
| `compose*.yml` y `supabase/volumes/` | la sesión de Contabo los copia por `scp` desde su checkout **en el SHA exacto** y verifica el sha256 | así se hace hoy para producción (`servidor-contabo.md:745`) |
| Edge Functions (`supabase/functions`) | igual, armadas como en producción (README de `infra/dtd-cargo`, `compose.supabase.yml:24-30`) | el servidor no tiene el repo (`compose.supabase.yml:28-30`) |
| Migraciones nuevas | scripts generados desde el blob en el SHA, con md5 (§2.6) | mismo método que producción (`0506-…md:171-178`) |

**Workflow nuevo `build-image-prueba.yml`** (Fase 1). Su contrato:
- **Disparo:** solo `workflow_dispatch`, con entrada `sha`. Nunca `push` ni `pull_request`: una PR no publica nada sola.
- **Entorno:** `environment: prueba` en GitHub, con variables **de nombre distinto**: `PRUEBA_SITE_URL`, `PRUEBA_SUPABASE_URL`, `PRUEBA_SUPABASE_ANON_KEY`, `PRUEBA_AUTH_COOKIE`, `PRUEBA_VAPID_PUBLIC_KEY`. Así no puede heredar en silencio el valor de producción (§1.6, punto 4).
- **Guard antes de construir:** falla si `PRUEBA_SUPABASE_URL` no es exactamente `https://supabase-prueba.dtdcargo.com`, si alguna variable de prueba está vacía o si un valor contiene `supabase.dtdcargo.com` o la ref de Cloud `xpfuzqombmjmxvprjgmi`.
- **Etiquetas:** solo `prueba-sha-<sha completo>`. Nunca `sha-*` ni `:main`, para que ninguna imagen de prueba se confunda con una de producción.
- **Comprobación después del build:** en un contenedor `--network none`, al menos 1 archivo de `.next` con el host de prueba y 0 con el de producción o la ref de Cloud. Es lo que se midió a mano en la Fase 2 (`0505-…md:502`).
- **GA:** la imagen de prueba se construye con GA apagado. Hoy eso no es posible (§1.6, punto 1): es un requisito de la Fase 2.
- **Prueba de contrato:** una prueba del repo falla si el trigger incluye `push` o `pull_request`, si las etiquetas pierden el prefijo o si se quita el guard. Ya hay pruebas de contrato de workflows (`scripts/__tests__/ci-workflow-contract.test.mjs`).

**Quién y con qué comandos:**

1. El Director, o el Worker si el encargo le autoriza publicar, dispara el build: `gh workflow run build-image-prueba.yml --ref <rama> -f sha=<sha del head>` y espera con `gh run watch <id> --exit-status`.
2. La **sesión de Contabo** despliega por SSH con un script nuevo (Fase 1):
   `/srv/ops/staging/desplegar-prueba.sh --project dtd-cargo-staging --sha <sha> --image ghcr.io/hailuwaycom-sketch/dtdcargo:prueba-sha-<sha>`
   - **Guardas.** Rechaza el proyecto `dtd-cargo` y cualquiera que no termine en `-staging`. Rechaza etiquetas que no sean `prueba-sha-<40 hex>`.
   - **Antes de cambiar nada.** Hace `pull` y repite la comprobación del bundle. Corre `verificar-aislamiento.sh` (§2.7).
   - **Despliegue.** Respalda el `.env`, fija `DTD_WEB_IMAGE` y corre `docker compose -p dtd-cargo-staging -f compose.yml -f compose.supabase.yml -f compose.staging.yml up -d --no-deps web`.
   - **Smoke.** `smoke-web.sh --host prueba.dtdcargo.com`. Hoy ese script no manda credenciales: hay que sumarle la clave del web, ver Fase 1.
   - **Registro.** Escribe `/srv/dtd-cargo-staging/EN-PRUEBA.txt` (PR, SHA, desde cuándo, quién) y deja la evidencia en `/srv/ops/evidencias/prueba-desplegar-<ts>.txt`.
3. Sam abre `https://prueba.dtdcargo.com`. En el Studio, el panel de entorno muestra `staging`, el SHA y cada integración en `mock` (`lib/studio/env-status.ts:111-130`).

**Una sola ranura.** Prueba muestra una rama a la vez. El Director decide el turno, como decide los merges: una PR con migración ocupa la ranura hasta que Sam la apruebe o se descarte. Más ranuras multiplican la RAM (§2.8) y no comparten base (§2.6).

**Desplegar desde GitHub Actions por SSH:** no, por ahora. Pondría en GitHub una llave con acceso a Docker en el VPS, y Docker equivale a root (`servidor-contabo.md:116`). Si más adelante hace falta, la opción es una llave con `command=` en `authorized_keys`, que solo pueda correr `desplegar-prueba.sh`. Es otra decisión.

### 2.6 Migraciones: primero en prueba, después en producción

**Base de prueba siempre reconstruible:**
- `resetear-base-prueba.sh --to-sha <sha de main>` (Fase 1) borra solo los datos, con `destroy-staging.sh`, que conserva compose y `.env` (`destroy-staging.sh:9-17`).
- Levanta la base e iguala los default privileges a producción antes de aplicar nada (`servidor-contabo.md:356-366`).
- Aplica **todas** las migraciones de `main` en orden, cada una con `--single-transaction` y su fila del ledger. Así lo hace el rebuild (`scripts/check-schema-rebuild.mjs:21-23`), y midió 450 migraciones en 26 s (`servidor-contabo.md:352-355`).
- Carga la semilla y crea las cuentas.

Que la base se pueda reconstruir resuelve un problema real. Si una migración se ensaya en prueba y la PR cambia o se abandona, la base de prueba ya no es la de `main`: se resetea y listo.

**Paridad con producción.** Hay objetos que viven solo en producción, como `rls_auto_enable()` (`check-schema-rebuild.mjs:15-19,73`) y el event trigger `ensure_rls` (`servidor-contabo.md:713`). Una base hecha desde las migraciones no los tiene. Propuesta: una comparación **solo de metadatos** entre prueba y producción (cantidad y md5 de funciones, policies, grants y event triggers), con el mismo estilo de huella que ya usa el traslado (`servidor-contabo.md:399-409`), y recrear en prueba lo que falte. Lee el catálogo de producción, no filas: pide OK de Sam una vez (D2).

**Aplicar en prueba con el mismo método que en producción:**
- El generador de node arma el script desde el blob del SHA y comprueba md5, bytes, CRLF y el delimitador. El script lleva `\set ON_ERROR_STOP on`, `begin;`, el texto, el `insert` en `supabase_migrations.schema_migrations` y `commit;`. Lectura previa y verificación en `begin transaction read only … rollback` (`0506-…md:171-185`).
- El contenedor es `dtd-cargo-staging-db-1` y `created_by` lleva `servidor-propio:psql:prueba:SDD-NNNN`.
- La evidencia va a `/srv/ops/evidencias/apply-NNNN-dtd-cargo-staging-<ts>/` con `SHA256SUMS`.
- **El cuerpo de la migración es el mismo blob en los dos lados**: el md5 de `statements` en el ledger de prueba tiene que ser igual al de producción.
- Propuesta de Fase 1: pasar ese generador, que hoy vive en el scratchpad de la sesión Director, a un script versionado: `infra/ops/migrate/aplicar-migracion.sh --project <p> --sha <sha> --file <nombre>`. Se usa primero en prueba. Usarlo en producción requiere reescribir `aplicar-migraciones-prod.md` en otra PR (§6).

**Cómo cambia migrate-first.**

| Paso | Hoy | Con prueba |
|---|---|---|
| 1 | PR con la espera declarada (`pendingBelowCutoff`, `pending-migration-symbol-declarations.json`) y CI verde (`docs/runbooks/codex-engineering.md:252-258`) | igual |
| 2 | — | **base de prueba reseteada a `main`** |
| 3 | — | **ventana migrate-first ensayada:** imagen de prueba de `main` (app vieja) y migración aplicada en prueba (base nueva) → smoke A. Es exactamente lo que vive producción entre el COMMIT y el merge |
| 4 | — | **imagen de prueba del head de la PR** (app nueva y base nueva) → smoke B por rol, con las pantallas nombradas. Sam la mira y dice «aprobado en prueba» |
| 5 | lectura previa en producción | igual |
| 6 | OK nominal de Sam nombrando la migración | igual, y el pedido **cita la evidencia de prueba**: md5 de la migración, salida del apply, smokes A y B y SHA |
| 7 | apply en producción y merge con `--match-head-commit` a los pocos segundos | igual, y el md5 del ledger de producción tiene que ser el de prueba |

**Validez de la evidencia.** Vale para **un SHA**. Un commit nuevo que toque la migración o el código que la usa la invalida: se repiten los pasos 2 a 4.

**Opcional (Fase 4):** correr `check-migrations-applied.mjs` también contra el ledger de prueba. El script lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno (`scripts/check-migrations-applied.mjs:313-318`), así que basta otro entorno para que diga «aplicada en prueba».

**Supabase y Postgres.** Subir una imagen de Supabase o de Postgres también pasa primero por prueba. Es un beneficio que hoy no existe (`servidor-contabo.md:211-218` pide snapshot antes de esos cambios, pero no un ensayo).

### 2.7 Correos, push, Kommo, Resend, WhatsApp y Telegram: nunca a clientes reales

| Canal | Cómo sale en producción | Regla en prueba | Comprobación |
|---|---|---|---|
| Correo de Auth (enlace mágico, recuperación, invitación) | GoTrue → SMTP de Resend (`compose.supabase.yml:218-222`) | Mailpit sin relay (`compose.staging.yml:48-68`), con su web expuesta **detrás de la misma clave** en `prueba.dtdcargo.com/correo/`, para que Sam lea sus enlaces sin SSH | `MP_SMTP_RELAY_*` sin definir; un enlace mágico de un cliente sintético llega a Mailpit y a ningún otro lado |
| Correo de la app (avisos, mailing, bugs) | `resendSend` con `RESEND_API_KEY` (`resend-api.ts:48-58`) | `RESEND_API_KEY` vacía: `mock_no_key` y el log queda (`resend-api.ts:44-51`; `mailing/actions.ts:163`) | panel de entorno en `mock`. D9: un «buzón de prueba» que mande esos correos a Mailpit en vez de descartarlos (SDD aparte) |
| Push web | `web-push` con VAPID (`lib/studio/notify/vapid.ts:36-37`; `send-user-push.ts:107`) | par VAPID **propio** de prueba, o vacío. Nunca el de producción | `verificar-aislamiento.sh`: huella distinta |
| Telegram | Bot API con `TELEGRAM_BOT_TOKEN` (`lib/studio/telegram/send-message.ts:11-18`) | vacío. Si hace falta, un bot de prueba que Sam crea en BotFather. Nunca el token de producción (§1.6, punto 3) | huella distinta o vacía |
| Kommo, y WhatsApp a través de Kommo | token en Vault `kommo_token_dtd_v1` (`servidor-contabo.md:461-469`); pg_cron `kommo-sync-dtd` (`0084_kommo_cron_sync.sql:52`); writeback según `kommo_connections` (`lib/studio/kommo-writeback.ts:482-513`) | Vault **sin** `kommo_cron_key`, `kommo_token_dtd_v1` ni `functions_base_url`, así que los jobs se saltan (`0472_…sql:106,151`). `KOMMO_PUSH_DRY_RUN` sin definir. Semilla sin fila en `kommo_connections`. El webhook de Kommo nunca apunta a prueba | `select count(*) from vault.secrets where name in ('kommo_cron_key','kommo_token_dtd_v1','functions_base_url')` = 0 |
| WhatsApp directo | no hay API de WhatsApp en el código: la búsqueda de `graph.facebook` no dio resultados y el canal llega por Kommo. Los `wa.me` abren el WhatsApp de quien hace clic | semilla con teléfonos no asignables (§2.3) | prueba de la semilla |
| Anthropic, Cloudflare AI, SeaRates, AWS de adjuntos | claves en el `.env` | vacías → mock (§1.5); sin costo | panel en `mock` |
| Google Analytics y Ads | respaldo al ID real en producción (§1.6, punto 1) | **apagado: requiere la Fase 2** | 0 archivos de `.next/static` con `G-25CD7BZH98` o `AW-561290482` |
| Crons | contenedor `cron` (`compose.yml:119-137`) | arriba, con `CRON_SECRET` propio: con las claves vacías corren sin efecto externo (`0505-…md:242`) | log del cron con 200 |
| Respaldo | timer de producción | ninguno: la semilla se regenera desde el repo | — |

**`verificar-aislamiento.sh` (Fase 1),** que corre antes de cada despliegue y al crear prueba:
- Compara cada valor del `.env` de prueba con el de producción **por sha256, sin imprimir nada**. Falla si hay uno igual.
- Falla si una clave de integración de la lista de arriba no está vacía, salvo que la lista explícita de claves de prueba la permita.
- Comprueba Vault, la etiqueta de la imagen y el bundle.
- Su prueba en el repo tiene control rojo: con una clave copiada de producción, tiene que fallar.

### 2.8 Presupuesto de RAM y disco

| Servicio | Límite en producción | Propuesta en prueba |
|---|---|---|
| db | 4.096 MiB (`compose.supabase.yml:554`); `shared_buffers` 1 GB y 100 conexiones (`:539-548`) | 1.024 MiB; `shared_buffers` 256 MB, `max_connections` 60 (override de `command`) |
| web | 2.048 MiB (`compose.yml:78`) | 576 MiB (uso medido: 141 a 162 MiB, `0505-…md:503`; `servidor-contabo.md:734`) |
| realtime | 768 MiB (`compose.supabase.yml:341`) | 320 MiB |
| functions | 768 MiB (`:495`) | 256 MiB |
| imgproxy | 512 MiB (`:418`) | 256 MiB |
| storage | 512 MiB (`:393`) | 192 MiB |
| rest | 384 MiB (`:291`) | 128 MiB |
| auth | 256 MiB (`:259`) | 96 MiB |
| api-gw | 256 MiB (`:147`) | 96 MiB |
| mailpit | — (128 MiB en el overlay viejo, `compose.staging.yml:60`) | 64 MiB |
| auth-templates | 64 MiB (`compose.yml:154`) | 32 MiB |
| cron | 64 MiB (`compose.yml:137`) | 32 MiB |
| **Total de límites** | **9.728 MiB** (9,5 GiB) | **3.072 MiB** (3 GiB) |

- **Umbrales de la casa:** DTD Cargo ≤ 12 GB, y si la suma de límites del VPS pasa de 20 GB hay que subir de plan (`servidor-contabo.md:282-286`).
- **Con prueba:** DTD suma 12.800 MiB (12,5 GiB), apenas por encima de 12 GB, y lejos de los 20 GB del VPS si `rent-awada-pruebas` no pasa de unos 7 GB (su consumo está **NO VERIFICADO**). Sam decide si acepta ese medio GB (D10).
- **Con los límites de producción, prueba sumaría 9,9 GiB** y DTD rozaría 19,4 GiB. Por eso el overlay **tiene** que bajar los límites.
- **Uso real esperado:** el staging vacío usaba 1,4 GB (`servidor-contabo.md:349-351`); con el web y Mailpit, unos 1,6 GiB. Producción usaba 2 GB con 7,6 GB de límites antes de sumar el web (`servidor-contabo.md:788`).
- **Los límites propuestos son un punto de partida.** Se ajustan con la medición de la Fase 3, sin pasar de 3.072 MiB en total.

**Disco** (300 GB, `servidor-contabo.md:5`; el libre de hoy está **NO VERIFICADO**):

| Qué ocupa | Estimación |
|---|---|
| Imágenes del web de prueba | ~0,5 GB cada una (`servidor-contabo.md:735`); se conservan las 3 últimas |
| Imágenes de Supabase | 0 extra: mismas etiquetas que producción |
| Datos sintéticos y archivos de prueba | < 1 GB |
| Logs | 10 MB × 5 por contenedor (`compose.yml:36-40`) → ≤ 0,6 GB |
| **Tope propuesto** | **5 GB** |

Las dos imágenes viejas `dtdcargo:staging-*` (`0505-…md:318`) se pueden borrar.

**CPU.** Prueba no compila nada en el VPS, porque la imagen sale de GHCR. Reconstruir la base aplica las 484 migraciones del repo en uno o dos minutos (estimación a partir de los 26 s del rebuild con 450). Se hace fuera del horario de bodega y se registra.

### 2.9 Costo, mantenimiento, destruir y recrear

- **Costo en Contabo:** $0 extra mientras la suma de límites quede bajo 20 GB.
- **Costo en DNS y certificados:** dos registros A en Hostinger y certificados de Let's Encrypt, gratis.
- **Costo en GitHub:** cada imagen de prueba usa ~6 minutos de Actions (el build del 2026-10-13 tomó de 10:40 a 10:46Z, `0505-…md:434`) y espacio en GHCR. El plan y la cuota de los dos están **NO VERIFICADO** (§1.7).
- **Mantenimiento mensual estimado, 1 a 2 horas de sesión:**
  - borrar las imágenes de prueba más viejas que las 3 últimas;
  - actualizar la semilla cuando una migración cambia columnas que usa (la prueba de la semilla lo delata);
  - rotar la clave del web cuando alguien deja de probar;
  - subir primero en prueba las imágenes de Supabase;
  - anotar cada operación en el registro del runbook.
- **Destruir:** `destroy-staging.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --evidence …` con sus guardas y su comprobación de cero restos (`servidor-contabo.md:521-537`). Con `--purge-config` borra también el `.env` de prueba.
- **Recrear desde cero:** `crear-prueba.sh` (Fase 1) orquesta lo que la Fase 2 hizo a mano: `new-env.sh` con `--set` (`servidor-contabo.md:323-331`), base, default privileges, migraciones de `main`, semilla, cuentas, `api-gw` **solo con el DNS resolviendo** (límite de 5 fallos por hora de Let's Encrypt, `servidor-contabo.md:344-348`), web y cron.
- **Resetear** es destruir solo los datos y recrear la base: es lo más frecuente (§2.6).

### 2.10 Vercel Preview mientras tanto

Hasta que prueba exista:
- **No se usan Preview de Vercel para probar escrituras.** Escriben en producción (§1.2).
- Para la lectura sí sirven, con esa advertencia.

Cuando prueba exista, la recomendación es **desconectar la integración de Git de Vercel**. El runbook ya lo proponía (`servidor-contabo.md:842-847`), y Vercel está en retiro (`servidor-contabo.md:823-857`).

Apuntar los Preview de Vercel a la base de prueba también es posible, pero obliga a mantener secretos de tipo Secret que no se dejan leer (`servidor-contabo.md:584`) y prueba un stack que ya no es el de producción. Lo decide Sam en D7.

---

## 3 · Plan por fases

Cada fase tiene su encargo y su autorización. «Worker» trabaja en el repo, con su rama y su PR. «Contabo» es la sesión que opera el VPS por SSH, con la llave del agente de Windows. «Sam» decide, paga y hace lo que pide su panel o su clave.

### Fase 0 · Decisiones (Sam y Director)

| Quién | Qué |
|---|---|
| Sam | responde D1 a D11 (§4) |
| Director | registra las respuestas literales en esta spec y la pasa a `approved` |

Aceptación: las once decisiones quedan escritas con su texto literal y su fecha. La spec queda en `approved` en su PR.

### Fase 1 · Repo: overlay, scripts, workflow y semilla (Worker, una PR)

| Entregable | Aceptación medible |
|---|---|
| `compose.staging.yml`: límites del §2.8, `command` de la base, `X-Robots-Tag`, puerta de acceso según D4, ruta de Mailpit y cabecera reescrita («prueba con datos sintéticos») | `docker compose -p dtd-cargo-staging -f compose.yml -f compose.supabase.yml -f compose.staging.yml config` valida con un `.env` falso; una prueba suma los `memory` del `config` y falla si pasan de 3.072 MiB; la prueba falla si falta `noindex` en un router |
| Plantilla `.env` de prueba, o bloque de `--set` documentado | una prueba con `new-env.sh` produce un `.env` con `APP_ENV=staging`, `DISABLE_SIGNUP=true`, hosts de prueba y **todas** las claves de integración del §2.7 vacías o ausentes |
| `infra/ops/staging/verificar-aislamiento.sh` | prueba con `.env` falsos: limpio → 0; con una clave copiada del «producción» falso → falla (control rojo); nunca imprime valores |
| `desplegar-prueba.sh`, `resetear-base-prueba.sh` y `crear-prueba.sh` | pruebas con el patrón de `infra/ops/tests/prueba-*.sh`: rechazan `dtd-cargo`, un proyecto sin `-staging` y una etiqueta sin `prueba-sha-`; `--dry-run` no toca nada; el reset contra un `supabase/postgres:17.6.1.136` efímero aplica todas las migraciones y deja el ledger con una fila por archivo (corrida pesada: pide turno al Director) |
| `infra/ops/migrate/aplicar-migracion.sh` (§2.6) | contra una base efímera: aplica una migración y su fila en una transacción; un error a la mitad no deja ni objeto ni fila; aborta si la línea útil no es `\set ON_ERROR_STOP on` o si el md5 del script no coincide |
| Semilla sintética (§2.3) | idempotente (dos corridas, mismos conteos); una prueba falla con un correo fuera de los dominios reservados o un teléfono fuera del rango; cubre los roles que se prueban: admin, operario VE, operario CN, cliente del Portal y proveedor CN |
| `.github/workflows/build-image-prueba.yml` (§2.5) | prueba de contrato del workflow (trigger, prefijo, guard, comprobación del bundle); sin secrets en `build-args` |
| `smoke-web.sh` con credenciales del web (opcional según D4) | sin la clave → 401; con la clave → 0 FALLÓ |
| Runbook: sección «Entorno de prueba» en `servidor-contabo.md`, o `docs/runbooks/entorno-prueba.md` | `pnpm docs:check`; los comandos del runbook coinciden con los scripts |

Validación de la PR: las pruebas de los scripts y las de contrato, más `pnpm verify` si toca código de producto. Esta fase no toca el servidor.

### Fase 2 · Producto mínimo para prueba (Worker, SDD propia)

| Entregable | Aceptación medible |
|---|---|
| GA y Ads apagables en el build (por ejemplo `NEXT_PUBLIC_GA_ID=off`) | build con el valor de apagado → 0 archivos de `.next/static` con `G-25CD7BZH98` o `AW-561290482`; producción sin cambios (mismo ID que hoy) |
| Si Sam lo aprueba (D11): aviso visible «Entorno de prueba» cuando `APP_ENV=staging` | prueba de render: presente en Studio, Portal, PWA y sitio público con `staging`; ausente con `production` |
| Si Sam lo aprueba (D9): buzón de prueba para los correos de la app | con `APP_ENV=staging`, `resendSend` entrega en Mailpit y no llama a `api.resend.com`; en producción, sin cambios |

### Fase 3 · Servidor: prueba arriba y vacía de clientes (Contabo, con Sam en DNS)

| Quién | Paso |
|---|---|
| Sam | registros A `prueba` y `supabase-prueba` → `217.216.54.70`, TTL 300, en Hostinger. Al Worker le bloquean los cambios de DNS (`0505-…md:404`) |
| Sam o Director | entorno `prueba` en GitHub con sus variables `PRUEBA_*`; la anon de prueba sale del `.env` del servidor, como se hizo con las de producción (`servidor-contabo.md:600`) |
| Contabo | medir antes: `free -m`, `df -h /`, `docker stats --no-stream` y `RestartCount` de los contenedores de producción |
| Contabo | limpiar los restos de 2026-10 con `destroy-staging.sh --purge-config`, con evidencia |
| Contabo | `crear-prueba.sh` con la imagen de prueba del SHA de `main` |
| Sam | smoke por rol |

Aceptación (todo con evidencia en el handoff):

1. `verificar-aislamiento.sh` PASÓ: 0 secretos iguales a producción y las claves de integración vacías.
2. Panel de entorno del Studio de prueba: `staging`, el SHA de `main` y todas las integraciones en `mock`.
3. Sin credenciales, el web responde 401 (o 403 con allowlist). Los dos hosts mandan `X-Robots-Tag: noindex`. `POST /auth/v1/signup` con la anon de prueba se rechaza.
4. Con una sesión abierta en `dtdcargo.com`, `document.cookie` en `prueba.dtdcargo.com` no la muestra.
5. Un enlace mágico de un cliente sintético llega a Mailpit, y no sale ningún otro correo.
6. RAM real de prueba ≤ 2 GiB tras el smoke. 0 `OOMKilled` y 0 reinicios en 24 h. Los contenedores de producción conservan su `RestartCount`. Disco de prueba ≤ 5 GB.
7. Smoke por rol de Sam, con las pantallas nombradas:
   - Studio: login, Clientes, Embarques;
   - PWA `/m/ve` y `/m/cn` con PIN, con foto de recepción;
   - Portal con enlace mágico leído en Mailpit;
   - una subida y su descarga;
   - Realtime de la bitácora.
   También el service worker y el manifiesto de la PWA detrás de la puerta elegida (§2.4).
8. Simulacro: `destroy-staging.sh` deja 0 restos y `crear-prueba.sh` vuelve a dejar prueba arriba en ≤ 30 minutos.

### Fase 4 · Primera rama y primera migración por prueba (Director, Worker, Contabo y Sam)

Con una PR real que traiga una migración:

1. Reset de la base de prueba a `main`.
2. Smoke A (app de `main` con la base migrada) y smoke B (head de la PR): PASÓ.
3. El md5 del cuerpo en el ledger de prueba es igual al md5 del blob.
4. Sam dice «aprobado en prueba».
5. El pedido de OK nominal para producción cita esa evidencia. Después del apply, el md5 del ledger de producción es igual al de prueba.
6. Desde el build hasta «link listo para Sam», ≤ 20 minutos.

### Fase 5 · Rutina (Sam y Director)

| Quién | Qué | Aceptación |
|---|---|---|
| Sam (D7) | desconectar la integración de Git de Vercel | una PR nueva no recibe el check ni el comentario de `vercel[bot]` |
| Director | proponer como conocimiento nuevo la regla «toda PR con migración pasa por prueba antes de producción», con destino y razón (AGENTS.md lo pide para reglas nuevas) | — |
| Contabo | mantenimiento mensual del §2.9 | anotado en el registro del runbook |

---

## 4 · Decisiones para Sam

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | ¿Los tres peldaños (local → prueba → producción) son lo que pediste? | sí · otra lectura | **Sí**: el Worker prueba en local, tú apruebas en el link de prueba y después autorizas producción. |
| D2 | Qué datos lleva prueba | sintéticos · sintéticos + tablas de referencia no personales · copia seudonimizada · copia real por excepción | **Sintéticos.** Más adelante, si quieres precios reales, las tablas de referencia con lista cerrada y tu OK para leer metadatos de producción una vez. **No** a la copia seudonimizada. La copia real, solo por excepción fechada y destruida al cerrar. |
| D3 | Nombre del link | `prueba.dtdcargo.com` · `staging.dtdcargo.com` | **`prueba.dtdcargo.com`** y `supabase-prueba.dtdcargo.com`: es la palabra que usas tú. |
| D4 | Cómo se entra | clave en el web y API sin allowlist · allowlist de IP · Tailscale · Cloudflare Access | **Clave en el web** mientras haya solo datos sintéticos: entras desde cualquier red y desde el teléfono. Allowlist de IP si alguna vez entra una copia real. |
| D5 | Quién sube una rama a prueba y si necesita tu OK cada vez | el Director pide y Contabo despliega, sin OK por despliegue · tu OK en cada uno | **Sin tu OK por despliegue a prueba:** no toca clientes ni producción. Tu OK sigue siendo obligatorio para producción y para cada migración en producción. |
| D6 | ¿Toda migración pasa primero por prueba? | obligatorio · cuando el Director lo pida | **Obligatorio**, con la evidencia de prueba citada en el pedido de OK nominal. |
| D7 | Vercel Preview | desconectar la integración de Git · apuntar Preview a prueba · dejarlo como está | **Desconectar** cuando prueba esté arriba. Hasta entonces, no usar Preview para probar escrituras. |
| D8 | Integraciones de prueba (Telegram, Kommo) | ninguna · bot de Telegram de prueba · cuenta de Kommo de prueba | **Ninguna al principio.** Un bot de prueba en BotFather (gratis) solo si hay que probar Telegram; Kommo de prueba solo con una necesidad concreta (costo **NO VERIFICADO**). |
| D9 | Correos de la app en prueba | modo mock (no salen y queda el log) · buzón de prueba en Mailpit (SDD aparte) | **Empezar con mock** y hacer el buzón de prueba en cuanto quieras revisar avisos a clientes desde prueba. |
| D10 | Presupuesto de RAM | prueba con ≤ 3 GiB de límites (DTD en 12,5 GiB) · más ajustado · VPS aparte | **≤ 3 GiB**, medido en la Fase 3; si el VPS se acerca a 20 GB, se pasa a un VPS aparte. |
| D11 | Aviso visible «Entorno de prueba» en todas las pantallas | sí (SDD pequeña) · no | **Sí**: evita que alguien opere en prueba creyendo que es el sitio real, o al revés. |

## 5 · Riesgos que quedan

- **Prueba comparte el VPS con producción.** Un fallo de prueba que llene el disco o abuse de la CPU afecta a los dos. Lo mitigan los límites del §2.8, el tope de disco y la medición de la Fase 3. Si no alcanza, el disparador del §2.2 lleva a un VPS aparte.
- **Paridad.** Una base hecha desde las migraciones no es idéntica a la de producción (§2.6). Un ensayo verde en prueba no garantiza el verde en producción si la comparación de metadatos no está al día. Por eso la lectura previa en producción se conserva.
- **La semilla envejece.** Si nadie la mantiene, prueba deja de cubrir las pantallas nuevas. Su prueba en CI lo delata.
- **Esta SDD no reemplaza** el OK nominal de Sam en producción, el runbook de producción ni la revisión de la PR por el Director.

## 6 · Fuera de alcance detectado

1. `components/Analytics.tsx:36-38`: cualquier build de producción sin ID de GA cae a la propiedad real y carga Ads, y no hay forma de apagarlo. Afecta a prueba, a los Preview y a cualquier imagen local (Fase 2 propone el cambio).
2. `build-image.yml:18-22,66-68`: un `workflow_dispatch` sobre una rama publica `sha-<sha>` con los valores de producción. Desplegar por error esa etiqueta en producción correría código sin revisar. Propuesta: limitar `sha-*` a `main` o darle otro prefijo a las ramas.
3. `0472_kommo_functions_base_url.sql:112-114`: sin `functions_base_url`, las llamadas de Kommo caen a la URL de Supabase Cloud. Es un respaldo abierto hacia un Cloud congelado.
4. `infra/dtd-cargo/.env.example:274`: la plantilla de producción deja `DISABLE_SIGNUP=false`, aunque las altas de la app usan la API admin (`app/registro/actions.ts:347`). El valor real del servidor está **NO VERIFICADO**. Hay que confirmar si el registro público de GoTrue tiene que estar abierto en producción.
5. `docs/runbooks/aplicar-migraciones-prod.md` sigue describiendo el conector de Cloud. Ya está anotado (`0505-…md:609`; `servidor-contabo.md:831-835`): aquí es una dependencia, no un hallazgo nuevo.
6. `app/robots.ts` no distingue el entorno (§1.6, punto 6).
7. Contradicción sobre la visibilidad de GHCR entre `build-image.yml:15-16` y `servidor-contabo.md:288-292` (§1.7).

## 7 · Criterios de aceptación de esta SDD (diseño)

- [x] Situación actual con evidencia `archivo:línea` y lo no verificado marcado (§1).
- [x] Alternativas comparadas y recomendación para el lugar, los datos (pasados por `revisar-datos-ve`), el acceso, el camino de una rama, las migraciones, las integraciones, la RAM y el disco, el costo y el ciclo de vida (§2).
- [x] Plan por fases con aceptación medible, separando Worker, Contabo y Sam (§3).
- [x] Decisiones para Sam, cada una con su recomendación (§4).
- [x] Sin cambios de infraestructura, producto ni producción. `pnpm docs:check`, `pnpm sdd:check` y `git diff --check` en el handoff.

## 8 · Registro de decisiones

| Fecha | Decisión | Texto literal de Sam | Registró |
|---|---|---|---|
| — | — | pendiente (Fase 0) | — |
