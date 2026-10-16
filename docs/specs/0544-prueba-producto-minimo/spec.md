---
sdd: "0544"
title: "Producto mínimo para el entorno de prueba: GA apagable, aviso visible y salidas simuladas"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-10-16
updated: 2026-10-16
supersedes: null
superseded_by: null
related: ["0540", "0518", "0505", "0046"]
confidencialidad: interno
---

# SDD-0544 — Producto mínimo para el entorno de prueba

> Fase 2 de la [SDD-0540](../0540-entorno-prueba-staging/spec.md): lo que el código de la app necesita para que `prueba.dtdcargo.com` no ensucie las estadísticas reales, no se confunda con el sitio real y no le mande nada a un cliente. La Fase 1 (overlay, scripts, semilla y `build-image-prueba.yml`) ya está en `main` (PR #246 y #251). La Fase 3, la instalación en el servidor, la hace la sesión de Contabo después.

## 0 · Pedido, alcance y cómo leer esta spec

**Encargo del Director (2026-10-16).** Cuatro entregables: GA y Ads apagables en el build; aviso visible «Entorno de prueba» con `APP_ENV=staging` (D11); correos y avisos sin salida en prueba (D9, modo simulado); y el hallazgo de la Fase 1 sobre la consulta de cédulas. Contexto: pronto se cargan en prueba los **consolidados reales** de Sam. Prueba no puede mandar nada a clientes reales ni ensuciar las estadísticas reales.

**Decisiones de Sam que aplica.** D9 y D11 de la 0540 siguen sin respuesta explícita: se aplican con la recomendación del §4 de la 0540 («empezar con mock» y «sí»), como dejó escrito el Director en el §8 de esa spec, y se confirman por nombre antes de la Fase 3.

**Fuera del alcance.** El buzón de Mailpit para los correos de la app (D9, opción «buzón de prueba»: otra SDD si se pide), el servidor, el DNS, GHCR y cualquier dato de producción.

**Archivos que cambia (allowlist).**

| Área | Archivos |
|---|---|
| GA y Ads | `components/Analytics.tsx`, `components/Analytics.apagado.test.tsx`, `components/Analytics.apagado-build.test.ts` |
| Aviso | `components/AvisoEntornoPrueba.tsx`, `components/AvisoEntornoPrueba.test.tsx`, `app/layout.tsx`, `app/globals.css`, `app/__tests__/aviso-entorno-prueba-superficies.test.tsx` |
| Salidas simuladas | `lib/studio/mail/resend-api.ts`, `lib/studio/env-status.ts`, `lib/studio/mail/__tests__/resend-api-prueba.test.ts`, `lib/studio/identity/index.ts`, `lib/studio/identity/__tests__/cne-entorno-prueba.test.ts` |
| Build de prueba | `.github/workflows/build-image-prueba.yml`, `Dockerfile`, `scripts/__tests__/build-image-prueba-workflow.test.mjs` |
| Documentación | esta spec, `docs/specs/README.md` (regenerado), `docs/runbooks/entorno-prueba.md`, `docs/marketing/README.md`, `.agents/handoffs/0544-prueba-producto-minimo.md` |

`.github/workflows/build-image.yml` (producción) **no se toca**.

**Convención de evidencia.** Las rutas `archivo:línea` de la situación actual se refieren a `main` en `dc84d94f`.

---

## 1 · Situación en `main`

### 1.1 GA y Ads no se pueden apagar en una imagen

`components/Analytics.tsx:36-38` toma `NEXT_PUBLIC_GA_ID?.trim()` y, si queda vacío en un build de producción, cae a `G-25CD7BZH98`. `ADS_ID` y `WHATSAPP_CONVERSION` son literales de módulo (`:46-47`). Toda imagen Docker es un build de producción. Ningún valor apaga la carga: `off` se usaría como ID y cargaría `gtag/js?id=off` y la etiqueta de Ads.

**Control rojo medido** con un proyecto Next mínimo (Next 16.2.11, `next build` con Turbopack, como `Dockerfile:88`), con el `Analytics.tsx` de `main` y `NEXT_PUBLIC_GA_ID=off`: **1** archivo de `.next/static` con `G-25CD7BZH98` y **1** con `AW-561290482`.

### 1.2 El sitio público se prerenderiza en el build

`app/page.tsx:27` declara `revalidate`, y la mayoría de las páginas públicas son estáticas. `APP_ENV` es una variable de runtime: viene del `.env` del servidor (`infra/dtd-cargo/compose.yml:62`). Una página prerenderizada lee el entorno **en el build**, donde la imagen no tiene `APP_ENV`. Un aviso que dependa sólo del runtime saldría en el Studio, el Portal y `/m` (rutas dinámicas), pero no en la portada.

### 1.3 Salidas hacia personas con `APP_ENV=staging` y las claves vacías

En prueba, `env-prueba.sh` borra toda clave de integración vacía y `verificar-aislamiento.sh` falla si alguna tiene valor (`verificar-aislamiento.sh:182-206`), salvo `--permitir`.

| Canal | Qué hace hoy sin su clave | Evidencia | ¿Sale algo? |
|---|---|---|---|
| Correo de la app (Resend) | `resendSend` y `resendBatchSend` devuelven `mock_no_key` sin HTTP; `sendEmail` deja el `mail_log` en `queued` con `error: "no_key"` | `lib/studio/mail/resend-api.ts:48-52,100-101`; `lib/studio/mail/send-email.ts:225-236` | no |
| Correo de Auth (GoTrue) | SMTP a Mailpit, sin relay | `infra/dtd-cargo/compose.staging.yml:68-78,101-105` | no |
| Push web | `ensureVapid()` sin las llaves → no-op; los dos envíos lo consultan primero | `lib/studio/notify/vapid.ts:32-48`; `send-user-push.ts:86`; `send-operario-push.ts:52` | no |
| Telegram | sin `TELEGRAM_BOT_TOKEN` devuelve error sin HTTP | `lib/studio/telegram/send-message.ts:18-24` | no |
| Kommo (y WhatsApp a través de Kommo) | las tres functions exigen fila en `kommo_connections` y el token en Vault; sin ellos responden 404/500 sin llamar a Kommo. El pg_cron se salta sin `kommo_cron_key` | `supabase/functions/kommo-writeback/index.ts:94-110`; `kommo-push-client/index.ts:137-150`; `kommo-sync/index.ts:67-72`; `0472_kommo_functions_base_url.sql:106,151` (SDD-0540 §1.5) | no |
| WhatsApp directo | no hay API en el código: búsqueda de `graph.facebook`, `api.whatsapp`, `twilio` y proveedores similares sin resultados. Los `wa.me` los abre quien hace clic | búsqueda en `app`, `lib`, `components`, `supabase/functions` | no |
| Consulta de cédulas (CNE) | `cedulave` sin `IDENTITY_CNE_URL` devuelve `null` **sin `fetch`**; con la URL puesta, consulta el servicio externo con la cédula | `lib/studio/identity/providers/cne-cedulave.ts:126-127,144`; `lib/studio/identity/index.ts:51,60` | no con la URL vacía |

**Conclusión.** Con las claves vacías, ningún camino envía. La protección depende de una sola condición operativa: que las claves sigan vacías. Con los consolidados reales cargados, una llave de Resend puesta por error (o con `--permitir`) le escribiría a clientes reales, y una `IDENTITY_CNE_URL` mandaría cédulas reales a un tercero.

**Precisión sobre el hallazgo de la Fase 1** (`.agents/handoffs/0540-fase-1-entorno-prueba.md`, FUERA DE ALCANCE 2). Decía que sin `IDENTITY_CNE_PROVIDER` la app «consultaría el servicio externo» desde prueba. Medido en el código: sólo con `IDENTITY_CNE_URL` puesta. Igual se cierra en staging, como pide el encargo.

---

## 2 · Diseño

### 2.1 `NEXT_PUBLIC_GA_ID=off`

- El valor exacto `off` deja vacíos `GA_ID`, `ADS_ID` y `WHATSAPP_CONVERSION`. Cada constante compara `process.env.NEXT_PUBLIC_GA_ID === "off"` directo.
- **Por qué así:** el bundler reemplaza la variable por el literal, el minificador pliega `"off" === "off"` y descarta la otra rama con los IDs. La 0518 midió que el minificador **no** pliega `"".trim()`: un `.trim()`, un `toLowerCase()` o un helper en medio dejarían los IDs en el chunk. Por eso sólo el valor exacto apaga, y el workflow lo manda literal.
- `fireWhatsAppSignals` y `trackLead` vuelven sin hacer nada si no hay ID, aunque otro script haya dejado un `gtag` en la ventana.
- **Producción sin cambios:** con el valor vacío o con un ID, el resultado es el de `main` (medido abajo).

### 2.2 Aviso «Entorno de prueba»

- `components/AvisoEntornoPrueba.tsx`, componente de servidor, montado **una vez** como primer hijo del `<body>` de `app/layout.tsx`. Es el único layout que pinta `<html>`: el sitio público, el Studio, el Portal y `/m` cuelgan de él.
- Aparece sólo con `resolveAppEnv() === "staging"`. Con `production`, `preview` o `local` no deja nada. Los Preview de Vercel quedan afuera a propósito: escriben en la base de producción (0540 §1.2).
- **Visual:** franja dorada de 4px pegada arriba y una pestaña centrada: «Entorno de prueba · No es el sitio real». En pantallas de menos de 640px, sólo «Entorno de prueba». Es el tono **Atención** de `BRAND.md`: `--color-status-warning` de relleno y `--on-warning` (navy fijo, BD-027) de texto, 5,24:1. Archivo 12px en negrita, mayúsculas por `text-transform` (eyebrow).
- **No tapa controles:** `position: fixed`, `pointer-events: none`, `z-index: 2000`, por encima de los modales más altos del repo (1000). Respeta `env(safe-area-inset-top)` para la PWA en iOS.
- **No dice «datos ficticios»:** prueba va a tener consolidados reales.
- **Páginas prerenderizadas (§1.2):** `build-image-prueba.yml` manda `APP_ENV=staging` como build arg y el `Dockerfile` lo declara `ARG APP_ENV` en la etapa build, antes de `next build`. Es `ARG` y no `ENV`: no queda en la imagen y el runner toma `APP_ENV` del `.env` del servidor. `build-image.yml` no lo manda: llega vacío, `resolveAppEnv` lo trata como ausente (`lib/runtime/app-env.ts:47-51`) y producción queda igual.

### 2.3 Correos de la app simulados en staging (D9, mock)

- `resendSend` y `resendBatchSend`: con `APP_ENV=staging` devuelven `{ ok: false, error: "mock_no_key", code: "app_env_staging" }` **sin llamar a `api.resend.com`, aunque haya llave**. Es el mismo resultado que ya tratan los consumidores como «registrado, no enviado».
- `resendGetReceivedEmail` (leer un correo entrante) no envía nada y no cambia.
- El panel de entorno (`lib/studio/env-status.ts`) muestra Resend en `mock` en staging, que es la verdad.
- **Por qué en el código y no sólo en el `.env`:** con consolidados reales, que nada le llegue a un cliente no puede depender de dejar una llave vacía.

### 2.4 Consulta de cédulas simulada en staging

`providerRegistry.getCneProvider()` devuelve, con `APP_ENV=staging`, un provider simulado que responde «no encontrado» sin red, cualquiera sea `IDENTITY_CNE_PROVIDER` o `IDENTITY_CNE_URL`. El motor lo reporta `unavailable` y la ficha cae al piso manual del asesor, el mismo camino que producción sin URL. `isCneAutoEnabled()` no cambia: con la URL vacía, que es lo normal en prueba, no se ofrece el botón automático.

### 2.5 Lo que no cambia, y por qué

| Canal | Por qué no se toca |
|---|---|
| Push web | sin VAPID es no-op; con un par propio de prueba (lo permite la 0540 §2.7) sólo llega a los dispositivos que se suscribieron **en prueba**: quienes prueban. La semilla no trae suscripciones |
| Telegram | sin token no sale. Un bot de prueba (D8) sólo le escribe a quien lo inició; el token de producción lo bloquea `verificar-aislamiento.sh` por huella |
| Kommo | sin `kommo_connections` ni token en Vault no hay llamada posible; `verificar-aislamiento.sh` comprueba los dos en 0 |
| WhatsApp | no hay API; los `wa.me` los abre quien hace clic |
| Correo de Auth | ya cae en Mailpit sin relay (Fase 1) |

---

## 3 · Criterios de aceptación

- [x] Con `NEXT_PUBLIC_GA_ID=off`, 0 archivos de `.next/static` con `G-25CD7BZH98` o `AW-561290482`. Medido con Turbopack en un proyecto mínimo con el `Analytics.tsx` de esta rama: 0 y 0.
- [x] Control rojo: con el código de `main`, `off` no apaga. Medido: 1 y 1.
- [x] Producción sin cambios: con el valor vacío, 1 y 1 en esta rama y en `main`; con un ID, el mismo resultado en las dos.
- [x] Prueba de contrato del apagado: render y disparos, y el código minificado por el SWC de Next, con un control que mete `.trim()` y deja los IDs.
- [x] `build-image-prueba.yml` manda `NEXT_PUBLIC_GA_ID=off` y `APP_ENV=staging`, y falla si `.next/static` nombra los IDs. `build-image.yml` sin tocar, con prueba de contrato.
- [x] Aviso presente con `staging` y ausente con `production` en el sitio público, el Studio, el Portal y `/m` (render de servidor de cada cadena de layouts), con control rojo sobre el layout de `main`.
- [x] El aviso pasa por `/ui-check` (resultado en el handoff).
- [x] Inventario de salidas con evidencia de código (§1.3).
- [x] Resend no llama a la red en staging aunque haya llave, con control rojo; producción sin cambios.
- [x] La consulta de cédulas no sale a la red en staging aunque haya URL, con control rojo; producción sin cambios.
- [ ] La imagen de prueba real se construye con este código y su comprobación del bundle da 0 en `.next/static` (primera corrida de `build-image-prueba.yml`, después del merge o sobre la rama).
- [ ] Sam ve el aviso en las cuatro superficies de `prueba.dtdcargo.com` (Fase 3).

## 4 · Riesgos

- **Sólo `off` exacto apaga.** `OFF` o ` off ` se toman como un ID. El workflow lo manda literal y su prueba de contrato lo exige.
- **El mapa de fuentes del servidor** (`.next/server/**/*.js.map`) conserva el texto original con los IDs. No se sirve al navegador, y el standalone sólo copia lo que lista la traza (en la sonda: 111 archivos, 0 mapas). Si una imagen real lo trajera, el resumen del workflow lo muestra en «todo `.next`» y `verificar-aislamiento.sh --exigir-sin-ga` fallaría (cuenta en todo `/app/.next`).
- **El aviso tapa el centro de arriba** de los encabezados en prueba. No captura clics. Es el precio de que se vea siempre.
- **Embeds:** `/tarifas/embed` dentro del Portal de prueba muestra su propio aviso dentro del iframe.

## 5 · Fuera de alcance detectado

1. `lib/studio/newsletter/sender.ts:125,263`: con `mock_no_key` el mensaje dice «RESEND_API_KEY no está configurada». En staging con una llave puesta por error el correo igual no sale (§2.3), pero el texto no explica por qué. Cambio de una línea, si se quiere.
2. `infra/ops/staging/verificar-aislamiento.sh:278,290-292` cuenta GA y Ads en todo `/app/.next` y los marca AVISO salvo `--exigir-sin-ga`, con un texto que todavía remite a «la Fase 2». Contar en `.next/static` y exigir por defecto es decisión de la sesión de Contabo, dueña del script.
3. `infra/ops/web/smoke-web.sh:106-112` exige GA en los chunks: en prueba, con esta fase, falla a propósito (lo dice el runbook).
