---
sdd: "0602"
title: "Las redirecciones propias no mandan a la dirección donde escucha el servidor"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-04
updated: 2026-11-04
supersedes: null
superseded_by: null
related: ["0505", "0597", "0473"]
confidencialidad: interno
---

# SDD-0602 · Las redirecciones propias no mandan a la dirección donde escucha el servidor

## Pedido

**Director General, 2026-11-04:** defecto medido en producción sobre `dac99762e`. En el contenedor, `request.url` lleva `https://0.0.0.0:3000`, y varias rutas arman con eso su destino. Pidió SDD corta, arreglo sin depender de `HOSTNAME`, pruebas con rojo causal, mutantes y una medición real contra el servidor de producción construido, siguiendo la redirección.

**Autorización de Sam, literal, transmitida por el Director General:** «Sí, con la tanda A». Respondió a su pregunta de si autorizaba la PR y que saliera en esa misma publicación. No cubre más que eso: cualquier texto público o migración sigue sin autorización, y este arreglo no pide ninguno.

**Límites:** PR en borrador contra `main`, sin traer `main` ni publicarla en la cola antes de su aviso. Va antes de publicar la tanda A. Sin tocar producción ni prueba.

## Qué pasaba

El contenedor corre con `HOSTNAME=0.0.0.0` (`Dockerfile`, `infra/dtd-cargo/compose.yml`), y ahí `request.url` y `req.nextUrl.origin` traen esa dirección, no el dominio público.

| Sitio | Quién lo sufre | El daño, medido en la imagen real |
|---|---|---|
| `app/portal/(auth)/callback/route.ts` | quien abre un enlace del portal | 307 a `https://0.0.0.0:3000/portal`. La sesión queda creada, pero el navegador no llega: Chromium da `ERR_ADDRESS_INVALID` |
| `lib/studio/mail/unsubscribe-request.ts` | quien se da de baja de un correo | 303 a `https://0.0.0.0:3000/email/baja…`. La baja se ejecuta y nunca ve la confirmación |
| `app/ir/bitacora/tarea/[id]/route.ts` | quien abre un push o la campanita de Bitácora | 307 a `https://0.0.0.0:3000/studio/bitacora…` |
| `app/p/[token]/packlist/route.ts` | el proveedor que baja su Excel sin documento compartido | **500.** `fetch` le habla TLS al propio puerto HTTP: `fetch failed`, `ERR_SSL_WRONG_VERSION_NUMBER` |
| `lib/studio/document-import/http.ts` | nadie de forma visible | `https://0.0.0.0:3000` contaba como origen propio con credenciales: preflight 204 |

`proxy.ts` no lo sufre, y no porque use el dominio real: su `Location` sale relativo (`/studio/login`, `/entrar`). Eso fue la pista del arreglo.

**Por qué nadie lo vio:** las pruebas corren con una URL bien formada, `smoke-web` no mira estas rutas, y el 307 sale igual. El dominio solo se ve siguiendo la redirección.

**Búsqueda:** además de los cinco sitios, el resto de `req.url` y `nextUrl` en `app/` y `lib/` lee `searchParams` o `pathname`, y las otras redirecciones van a URL firmadas de Storage. La guarda de abajo convierte esa búsqueda en una prueba.

## Decisión

**`Location` relativo para las redirecciones propias: `lib/http/local-redirect.ts`.** El navegador lo resuelve contra la URL que tiene abierta, así que sale bien en cualquier dominio. Es lo que ya hacen `proxy.ts` y `app/marca/doc/[...ruta]/route.ts`. `localRedirect` solo acepta una ruta propia: rechaza `https://…`, `//otro.test`, `/\otro.test` y espacios, porque el navegador lee los dos últimos como otro dominio y quita tabs y saltos de línea antes de resolver.

**Packlist: la plantilla se lee del disco,** trazada en `next.config.ts`. Traerla por la red no tiene sentido: la plantilla está en la misma imagen.

**Lista de orígenes: sigue necesitando un origen absoluto.** El dominio real entra por `NEXT_PUBLIC_SITE_URL`. Solo se deja de sumar la dirección de escucha (`0.0.0.0`, `[::]`). `req.nextUrl.origin` se conserva fuera de eso porque en `next dev` y en un preview de Vercel sí es el origen real.

**Descartado:**
- **Origen configurado para las redirecciones.** Se implementó primero, como pedía el encargo (`publicOrigin`, en la historia de la rama hasta `8558bbc82`). Pedía reglas por entorno: en local, `.env.example` propone el dominio de producción, y en un preview saltar al canónico ejecutaría allá lo que se estaba probando (la lección de `resolveNewsletterSiteUrl`). El Director General aceptó el relativo: no depende de una variable horneada ni de esas reglas.
- **`X-Forwarded-Host`:** obliga a confiar en una cabecera que depende de la configuración del proxy, para lograr lo mismo.
- **Plantilla por el origen público:** desde el contenedor saldría a la red, y en prueba chocaría con la lista de IP (inferido, no medido).

### `NEXT_PUBLIC_SITE_URL`: cómo llega y qué pasa si falta

**Cómo llega:** como build arg, y Next la hornea. Leído en las imágenes reales, el 2026-11-04:

| Imagen | Variable de origen | Horneado en `.next/server` | En el entorno de ejecución |
|---|---|---|---|
| `:main` (`ec56a4ac4`) | `vars.NEXT_PUBLIC_SITE_URL` = `https://dtdcargo.com`, `build-image.yml:112` | `https://dtdcargo.com` en 381 archivos; `prueba.dtdcargo.com` en 0 | no la trae |
| `:prueba-sha-56cb9f6d5…` | `vars.PRUEBA_SITE_URL` = `https://prueba.dtdcargo.com`, `build-image-prueba.yml:132`, con guarda en `:81` y `:90` | `https://prueba.dtdcargo.com` en 373 archivos; `https://dtdcargo.com` en 7 | no la trae |

**Si falta:**
- **Las redirecciones ya no la leen.** Medido sirviendo la imagen bajo un dominio distinto del horneado: se quedan en el dominio con el que llegó la petición.
- **La imagen no se construye.** Medido con `--build-arg NEXT_PUBLIC_SITE_URL=` sobre `cb1f3f99b`: `ERR_INVALID_URL`, `Failed to collect page data for /_not-found`, exit 1, sin imagen. Lo causa `app/layout.tsx`. Es el mismo fallo que el runbook registra del 2026-10-13.
- **Lo único que sigue dependiendo de ella** es la lista de orígenes: un `POST` a `/api/document-import` desde el dominio real necesita que esté bien. Como sin ella no hay imagen, ese caso no se puede dar en el contenedor.

## Aceptación

1. Con `request.url` en `0.0.0.0:3000`, ninguna redirección propia lleva host, y seguirla termina en el dominio con el que llegó la petición.
2. Tras el canje, las cookies de la sesión salen en la respuesta relativa y `/portal` abre con sesión, siguiendo la redirección en un navegador real.
3. El proveedor baja su Excel completo, sin salir a la red, y un fallo de lectura responde 502 con su aviso.
4. `https://0.0.0.0:3000` no abre la importación de documentos; el dominio real, sí.
5. Si vuelve el patrón, una prueba falla: `new URL(x, req.url)`, `req.nextUrl.origin`, `NextResponse.redirect` armado, o un clon de `nextUrl` en un route handler.
6. Sin migraciones, sin textos públicos y sin variables nuevas.

## Allowlist

| Archivo | Cambio |
|---|---|
| `lib/http/local-redirect.ts` | nuevo |
| `lib/http/__tests__/local-redirect.test.ts` | nuevo |
| `app/portal/(auth)/callback/route.ts` | redirige con `localRedirect` |
| `app/portal/(auth)/callback/route.test.ts` | nuevo |
| `app/ir/bitacora/tarea/[id]/route.ts` | redirige con `localRedirect` |
| `app/ir/bitacora/tarea/[id]/route.test.ts` | nuevo |
| `lib/studio/mail/unsubscribe-request.ts` | redirige con `localRedirect` |
| `lib/studio/mail/__tests__/unsubscribe-origen-publico.test.ts` | nuevo |
| `lib/studio/mail/__tests__/unsubscribe-route.test.ts` | `Location` esperado sin host |
| `lib/studio/mail/__tests__/unsubscribe-secreto-vacio.test.ts` | `Location` esperado sin host |
| `lib/studio/mail/__tests__/unsubscribe-marketing-literal.test.ts` | `Location` esperado sin host |
| `app/p/[token]/packlist/route.ts` | lee la plantilla del disco |
| `app/p/[token]/packlist/route.test.ts` | simula la lectura; casos nuevos |
| `next.config.ts` | traza la plantilla para esa ruta |
| `lib/runtime/__tests__/next-config.test.ts` | caso nuevo |
| `lib/studio/document-import/http.ts` | la dirección de escucha no es un origen |
| `lib/studio/document-import/http.test.ts` | casos nuevos |
| `__tests__/sin-origen-de-la-peticion.test.ts` | guarda nueva |
| `docs/specs/0602-origen-publico/spec.md` | esta spec |
| `docs/specs/README.md` | índice generado |
| `.agents/handoffs/sdd-0602-origen-publico.md` | handoff |

Sin migraciones, sin variables nuevas y sin tocar producción ni prueba.

## Validación

### Medición contra la imagen real (2026-11-04)

Imagen construida con el `Dockerfile` del repo, `HOSTNAME=0.0.0.0` y `NODE_ENV=production`, detrás de un borde TLS que imita a Traefik (conserva `Host` y fija `X-Forwarded-*`), con un doble de Supabase y datos inventados. Seguida con `curl -L` y con Chromium. **Primero la base, para que la medición sepa ver el defecto.**

| Camino | Base, `ec56a4ac4` | Final, `ac6d20191` |
|---|---|---|
| Callback: incompleto, vencido, PKCE en otro navegador, sin cliente | `Location: https://0.0.0.0:3000/…`; seguirla da `curl` exit 7 | `Location: /entrar?…`; seguida, 200 en el dominio público |
| Baja por ruta y por query | `https://0.0.0.0:3000/email/baja…`, exit 7 | `/email/baja?estado=invalido`; seguida, 200 |
| `/ir`: escritorio, móvil, id forjado | `https://0.0.0.0:3000/…`, exit 7 | `/studio/bitacora…`, `/m/erp/…`; seguida, sigue en el dominio y pide login |
| **Enlace de token, con cliente** | cookie de sesión sí, pero no llega: exit 7 | 307 `/portal`, cookie de sesión; seguida, **`/portal` 200** |
| **Canje PKCE, mismo navegador** | cookies sí, pero no llega: exit 7 | 307 `/portal`, cookie de sesión, y `code-verifier` retirada; seguida, **`/portal` 200** |
| Control: `/portal` sin sesión | 307 `/entrar` | 307 `/entrar` |
| Chromium, enlace y canje | `net::ERR_ADDRESS_INVALID` | `https://dominio-publico.test/portal`, 200, con la cookie |
| Chromium, enlace incompleto y baja | `net::ERR_ADDRESS_INVALID` | `/entrar?error=incompleto` y `/email/baja?estado=invalido`, 200 |
| Packlist, sin documento compartido | **500**, `ERR_SSL_WRONG_VERSION_NUMBER` | **200**, xlsx de 49.750 bytes |
| Preflight desde `https://0.0.0.0:3000` | 204 | **403** |
| Preflight desde el dominio real, y desde uno ajeno | 204, 403 | 204, 403 |
| `proxy.ts`: `/studio/resumen`, `/back/usuarios`, `/portal` | `/studio/login`, `/back/login`, `/entrar` | igual |

**Lo demás medido sobre la imagen final:**
- **Excel:** leído con exceljs: hoja `Packing List`, markbox y código escritos, y ningún texto de la plantilla perdido. La plantilla está en `public/templates`, el servidor corre con cwd `/app`, y `route.js.nft.json` la nombra (0 coincidencias en la base, 1 en la final).
- **La sesión la ve el servidor:** el doble recibió `GET /auth/v1/user` con el usuario del canje, y `/portal` volvió a dar 200 solo con esas cookies.
- **Dominio distinto del horneado (`otro-dominio.test`):** redirecciones y sesión se quedan en ese dominio; el preflight de ese dominio da 403, como corresponde. Tres corridas: dos con 9 de 9, y una con 8 de 9.
- **Mantenimiento:** `/mantenimiento/entrar` responde `307 /portal`, relativo. Por eso `maintenance.ts` es excepción de la guarda.

**No explicado:** en una de las tres corridas bajo `otro-dominio.test`, `curl` agotó sus 25 s al seguir `/ir` móvil hasta `/studio/login` (exit 28). El `Location` fue el correcto, el log del contenedor no trae errores y no se repitió en las otras dos. Esa pantalla no está en este diff. Queda como rojo sin explicar, no como carga: no medí carga en esa corrida. Si se repite, se mira.

**No cubre:** es un doble de Supabase, no GoTrue real, y un borde propio, no Traefik ni Cloudflare. Falta comprobarlo en prueba cuando suba `main` allí, siguiendo el enlace desde `/correo/` hasta `/portal`: lo hace esta misma sesión, cuando el Director General avise.

### Pruebas

| Comprobación | Resultado |
|---|---|
| Control rojo, los cinco archivos de la app como en la base, sobre `ac6d20191` | PASÓ: 19 causales. Callback 6, baja 4, Bitácora 3, packlist 3, lista 2, guarda 1. Las redirecciones reciben `https://0.0.0.0:3000/…` donde esperan la ruta, y packlist muere con `fetch failed` |
| Las tres pruebas de baja que ya existían, en rojo contra la base | 15 de 31. Esperaban un `Location` con host. Se cambió el literal esperado, sin aflojar nada: siguen comparando exacto |
| Mutantes | PASÓ: 48 de 48, con `git status` limpio al final. 47 mueren sobre `ac6d20191`. El otro, «excepción de más», sobrevivió, destapó un hueco de la guarda y muere desde `cb1f3f99b` |
| Cada mutante, contra una sola suite | Las cuatro rutas mueren con su propia prueba, sin la guarda; y la guarda sola ve el callback, Bitácora, la baja y el packlist |
| `pnpm verify` | NO EJECUTADO en esta rama, por decisión del Director General: lo cubre el `verify` que él corre sobre el commit fijo de `main` antes de publicar la tanda A, con esta PR adentro. Si destapa algo de aquí, vuelve a esta spec |

Ver en la PR el cierre de `typecheck`, `eslint`, `docs:check` y `sdd:check` sobre la cabeza.

## Fuera de alcance detectado

Los tres primeros los lleva el Director General en su lista. Aquí no se tocan.

- **La cookie de sesión sale sin `Secure` ni `HttpOnly`.** Cómo se midió: `curl -D -` a `/portal/callback` por el borde TLS, en las imágenes de la base y la final, leyendo los atributos del `Set-Cookie` sin imprimir el valor. En las dos: `Path`, `Expires`, `Max-Age`, `SameSite`. El código solo fija el nombre (`lib/db/session-cookie.ts`). `HttpOnly` no encaja si el cliente del navegador la lee (inferido del uso de `createBrowserClient`); `Secure` sí podría ir. No se midió en producción.
- **`smoke-web` sigue sin mirar estas rutas.** Cómo se midió: `grep -cE 'portal/callback|email/unsubscribe|/ir/|packlist' infra/ops/web/smoke-web.sh` da 0. Una línea que falle si `/portal/callback` responde con host `0.0.0.0` habría detectado este defecto al publicar.
- **La imagen de prueba trae `https://dtdcargo.com` literal en 7 archivos de `.next/server`.** Cómo se midió: `grep -rlF https://dtdcargo.com .next/server | wc -l` dentro de `:prueba-sha-56cb9f6d5602217520ed1e43169d7e50a715920d`, sin red. Solo se contaron: no abrí esos archivos ni sé si alguno es un enlace que saca de prueba a producción.
- **Desde cuándo daba 500 el Excel del proveedor:** inferido que desde el corte al servidor propio; no leí filas ni logs de producción.
