---
sdd: "0547"
title: "Panel de publicaciones del Studio: el estado del servidor propio en lugar de Vercel"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-10-17
updated: 2026-10-17
supersedes: null
superseded_by: null
related: ["0541", "0505", "0050", "0540"]
confidencialidad: interno
---

# SDD-0547 — Panel de publicaciones del Studio sin Vercel

> La Torre de control (`/studio/debug`, pestaña Estado) mostraba las publicaciones leyendo la API de Vercel. Desde el 2026-10-16 la web se publica sola en el servidor propio ([SDD-0541](../0541-publicacion-automatica-vps/spec.md)) y Vercel está en pausa, con la integración de Git desconectada. Esta spec decide de dónde lee el Studio el estado real, lo implementa del lado del Studio y deja escrito el cambio que le toca a la sesión de Contabo.

## 0 · Pedido, alcance y cómo leer esta spec

**Pedido.** Sam al Director, el 2026-10-17: «arranca también la del panel de Vercel». Sale del pendiente «Tarea aparte: el panel de publicaciones del Studio» del [handoff de la 0541](../../../.agents/handoffs/0541-publicacion-automatica-vps.md) y del [plan de retiro](../../../.agents/handoffs/plan-retiro-vercel-supabase-20261016.md).

**Lo que entrega esta PR (Studio):**
- el lector del estado y su contrato (§4);
- la card nueva «Publicaciones del servidor»;
- el retiro del código de Vercel que quedó muerto en el panel;
- las pruebas, también sin datos y con error.

**Lo que NO entrega (cambio coordinado, §5):**
- el escritor del estado en `infra/ops/web/publicar-web.sh`;
- el montaje en `infra/dtd-cargo/compose.yml`.

Los dos archivos son de la sesión «Contabo VPS y dockerización de proyectos». Además, `compose.yml` es una huella que **bloquea** la publicación (`infra/ops/web/publicar-web.sh:54`). Por eso los cambia esa sesión, en su PR, cuando pueda instalarlos. Hasta entonces la card dice «Sin datos» y el resto de la pestaña sigue igual.

**Convención de evidencia.** Las rutas `archivo:línea` de la situación actual son de `main` en `c2fabdcc`. Las de `publicar-web.sh` son de ese mismo commit.

## 1 · Situación en `main`

| Qué | Evidencia | Efecto hoy |
|---|---|---|
| La lista de publicaciones pide `https://api.vercel.com/v6/deployments` con `VERCEL_API_TOKEN` y `VERCEL_PROJECT_ID` | `lib/studio/vercel-deploys.ts:84-89`, `:101`; `app/studio/(app)/debug/page.tsx:19,72` | En el servidor no están esas variables: la card pide configurarlas «en Vercel Dashboard» (`EstadoTab.tsx:195-236`). Con el token, mostraría publicaciones viejas de un proyecto en pausa |
| Error de la API | `EstadoTab.tsx:239` | «No pude consultar Vercel API: HTTP …» |
| «Deploy actual» | `EstadoTab.tsx:177-192` | En el servidor, `Branch` dice «— (local)», porque `VERCEL_GIT_COMMIT_REF` no existe (`lib/studio/env-status.ts:122`). Es falso: es producción |
| Ayuda de mocks | `EstadoTab.tsx:416-435` | Recomienda `vercel env pull` |
| Variables vigiladas | `lib/studio/env-status.ts:97-103` | Siete `VERCEL_*` salen como «no configurada» en el servidor |
| Bot local de deploy | `app/studio/_components/deploy/DeployWebBot.tsx:38,202,390` | Dice «Subir cambios pendientes a Vercel», «URL temporal» y «Vercel ya está deployando» |
| `.env.example` | `.env.example:420` | Documenta `VERCEL_API_TOKEN` «para que el panel consulte el estado del deploy» |

**Lo que el servidor ya sabe (SDD-0541).** `publicar-web.sh` guarda en `/srv/ops/web/estado/` qué corre (`publicada`), la vuelta atrás (`anterior`), las imágenes rechazadas (`rechazados`) y las esperas aceptadas. También deja una carpeta de evidencia por publicación y avisa por Uptime Kuma. Nada de eso lo ve el contenedor web, y no debe verlo tal cual: los motivos son texto libre con rutas del servidor y fragmentos de errores de Docker o de `psql` (`publicar-web.sh:171,214,248,345`).

## 2 · Alternativas comparadas

| Criterio | (a) API de GitHub: corridas de `build-image.yml` y `publicable.yml`, y `:publicable` en GHCR | (b) Archivo de estado que escribe el vigilante, montado en solo lectura | (c1) Montar `/srv/ops/web/estado` y las evidencias | (c2) Socket de Docker o acceso al host | (c3) Tabla en la base | (c4) API de Uptime Kuma |
|---|---|---|---|---|---|---|
| ¿Muestra lo que el servidor de verdad hizo? (publicada, retenida, vuelta atrás, congelado) | No. Solo lo que GitHub decidió. No ve retenciones por migraciones ni vueltas atrás | **Sí**, lo escribe quien lo hace | Sí | Sí | Sí | Solo el último mensaje (200 caracteres) |
| Secretos nuevos | Sí: el repo es privado (`gh repo view` → `PRIVATE`), hace falta un token de lectura en el `.env` de la web | **Ninguno** | Ninguno | Ninguno | Ninguno | La clave de Kuma |
| Acceso del contenedor web | Red a `api.github.com` y `ghcr.io` | **Una carpeta en solo lectura con un archivo** | Carpetas con texto libre, rutas y `.env.bak` cerca | Control del host: descartado por la condición del encargo | Escritura del root del VPS en la base | Red interna a Kuma |
| Texto libre hacia la pantalla | Mensajes de commit | **Ninguno: códigos y SHA** (§4.4) | Sí | Sí | Depende | Sí |
| Funciona sin red y sin cuotas | No (rate limit, caídas de GitHub) | **Sí** | Sí | Sí | Sí | Sí |
| Cambio coordinado con Contabo | Token en el `.env` | Escritor y montaje | Montaje | — | Migración y escritor | Clave en el `.env` |

**Decisión: (b)**, más lo que la instancia sabe de sí misma (`NEXT_PUBLIC_BUILD_SHA` y `APP_URL`, que ya vienen en la imagen y el compose).
- Es la única opción que muestra la verdad del servidor sin secretos nuevos.
- No le da al contenedor más que un archivo pequeño de solo lectura.
- No depende de la red.
- La (a) no ve lo que más importa: por qué una versión no salió.

El handoff de la 0541 ya la había recomendado.

## 3 · Diseño

```text
publicar-web.sh (root, timer de cada minuto)
  └─ escribe con mv atómico → /srv/dtd-cargo/estado-publicacion/publicaciones.json   (host, 644)
                                     │ compose: ./estado-publicacion:/var/lib/dtd-cargo/publicacion:ro
                                     ▼
web (usuario node) → lib/studio/publicaciones-loader.ts → valida (publicaciones-types.ts)
  └─ /studio/debug › Estado › «Publicaciones del servidor»   (solo admin: debug/layout.tsx)
```

- **Se monta la carpeta, no el archivo.** El escritor reemplaza el archivo con `mv`. Un montaje de archivo suelto conserva el inodo viejo y seguiría mostrando el estado anterior.
- **La carpeta va dentro del directorio del compose** (`./estado-publicacion`, relativa):
  - producción la ve en `/srv/dtd-cargo/estado-publicacion`;
  - prueba, con su propio directorio, ve la suya, vacía. Así prueba no muestra el estado de producción.
  - Si la carpeta no existe, Docker la crea vacía al montar, y la card dice «Sin datos».
- **Ruta en el contenedor:** `/var/lib/dtd-cargo/publicacion/publicaciones.json`, constante `RUTA_ESTADO_PUBLICACIONES` en `lib/studio/publicaciones-loader.ts`. No es una variable de entorno a propósito: una variable nueva obligaría a tocar `infra/dtd-cargo/.env.example`, que también es huella (`huellas-fuera-de-imagen.sh:73`).

## 4 · Contrato del archivo (versión 1)

El ejemplo canónico es [`ejemplo-publicaciones.v1.json`](ejemplo-publicaciones.v1.json). La prueba `lib/studio/__tests__/publicaciones-types.test.ts` exige que se acepte completo, sin descartar nada.

### 4.1 Campos

| Campo | Tipo | Obligatorio | Qué es |
|---|---|---|---|
| `version` | número `1` | sí | Otra versión: la card dice «otra versión del formato» y no lo lee |
| `actualizado` | hora UTC `AAAA-MM-DDTHH:MM:SSZ` (milisegundos opcionales) | sí | Última vuelta del vigilante que escribió el archivo. Con más de 15 min de atraso, la card avisa «Sin vueltas recientes» |
| `corre` | SHA de 40 hex en minúsculas, o `null` | no | Commit de `DTD_WEB_IMAGE` (`sha_de_ref`) |
| `anterior` | SHA o `null` | no | Commit de `estado/anterior`, la vuelta atrás |
| `publicable` | SHA o `null` | no | `org.opencontainers.image.revision` de `:publicable` en la última vuelta |
| `vigilante` | objeto o `null` | no | `{ "estado", "motivo", "faltan" }` (§4.2) |
| `congelado` | objeto o `null` | no | `{ "desde": hora UTC, "automatico": true \| false }`. Sin el motivo escrito a mano: es texto libre |
| `historial` | arreglo | no | Eventos, el más nuevo primero, como máximo 20 (§4.3) |

Un campo con otra forma se toma como `null`. Una entrada del historial sin `hora`, `sha`, `origen` o `resultado` válidos se descarta, y la card dice cuántas se descartaron. Sin `version` o sin `actualizado` válidos, la card dice «no tiene el formato esperado». El archivo pesa como máximo 128 KB. Si pasa de ahí, no se lee.

### 4.2 `vigilante.estado` y `motivo`

| `estado` | Cuándo | `motivo` |
|---|---|---|
| `al-dia` | `corre` = `publicable`, o se acaba de publicar | `null` |
| `retenida` | `:publicable` no se publicó por una puerta, una falla con vuelta atrás o un rechazo previo | uno de §4.4 |
| `detenido` | La vuelta no llegó a evaluar la imagen (ensayo, disco, descarga, imagen inválida) | uno de §4.4 |
| `congelado` | Existe `CONGELADO` | `null`. El detalle va en `congelado` |

Con `motivo: "migraciones"`, `faltan` lleva los nombres de las migraciones que faltan en el ledger (`^[0-9]{4}[a-z]?_[a-z0-9_]+$`, sin `.sql`).

### 4.3 Eventos del historial

```json
{ "hora": "2026-10-17T17:39:02Z", "sha": "<40 hex>", "origen": "vigilante | a-mano",
  "resultado": "publicada | retenida | vuelta-atras | vuelta-atras-fallida | vuelta-atras-a-mano",
  "motivo": "<código de §4.4> | null", "faltan": ["0492_…"] }
```

- **`publicada`.** `publicar_imagen` devuelve 0 (`publicar-web.sh:434-448`). `origen` es el tercer argumento de esa función.
- **`retenida`.** La función termina con `MOTIVO` antes de abrir la evidencia, o con `rc = 3` (`:410-415`, `:427-433`). **Un solo evento por cada par (digest, motivo)**, con la misma clave que `avisar_una_vez` (`:144-149`). Si no, el vigilante agregaría uno por minuto.
- **`vuelta-atras`.** La versión nueva falló y la vuelta atrás quedó bien (`:450-461`). El `motivo` es el de la falla.
- **`vuelta-atras-fallida`.** Falló también la vuelta atrás (`:462-467`, `:562-566`).
- **`vuelta-atras-a-mano`.** `volver` salió bien (`:554-560`). El `sha` es el de la versión a la que se volvió.

### 4.4 Códigos de motivo y su origen en `publicar-web.sh`

| Código | Ramas de `publicar-web.sh` (en `c2fabdcc`) | Texto en la card |
|---|---|---|
| `migraciones` | `:222-233` | Faltan migraciones en la base. La web no sale antes que su migración. |
| `ledger` | `:210`, `:214`, `:216` | No se pudo leer el registro de migraciones de la base. |
| `huellas` | `:248`, `:258-261` | El servidor no tiene la misma copia de compose o cron que ese commit. |
| `sharp` | `:271` | La conversión de imágenes (sharp) no funciona dentro de la imagen. |
| `etiquetas` | `:207`, `:244`, `:250` | La imagen no trae las etiquetas de publicación (es anterior a la SDD-0541). |
| `imagen` | `:185-188` | La imagen no es válida: commit, digest u origen inesperados. |
| `descarga` | `:171` (desde `vigilar`, `publicar` o la vuelta atrás) | No se pudo bajar la imagen de GitHub. Puede haber vencido el acceso al registro. |
| `disco` | `:179`, `:181` | Queda poco disco libre en el servidor. |
| `ensayo` | `:175` | Hay un ensayo de la web puesto en el servidor. |
| `env` | `:285`, `:296-303`, `:392`, `:394` | La configuración de la web en el servidor no se pudo cambiar con seguridad. |
| `sin-vuelta-atras` | `:401` | La versión anterior no está disponible: no habría vuelta atrás. |
| `salud` | `:347` | La versión nueva no arrancó sana. |
| `prueba-rapida` | `:351` | La prueba rápida falló dos veces. |
| `compose` | `:341`, `:345` | Docker compose falló al cambiar el contenedor de la web. |
| `rechazada` | `:500-503` | Ya se había rechazado. Se vuelve a intentar con el próximo merge. |
| `otro` | cualquier código que el panel no conozca | Motivo no reconocido. La evidencia está en el servidor. |

### 4.5 Reglas de seguridad del contrato

1. **No hay texto libre.** Todo valor tiene una de estas formas:
   - SHA de 40 hex;
   - hora UTC;
   - un código de las listas;
   - un nombre de migración;
   - `true` o `false`.

   El lector valida cada forma con una expresión regular o con una lista cerrada. Un valor con otra forma se descarta: una ruta, un error de Docker o una URL con credenciales no llega a la pantalla aunque el escritor la escriba por error. Lo mide la prueba «un secreto puesto en cualquier campo no aparece en el resultado».
2. **Los textos los escribe el Studio, por código** (ERR-01: sin rutas internas ni errores crudos). La card tampoco nombra la ruta del archivo.
3. **Archivo `644` y carpeta `755`, de root.** El contenedor corre como `node` (`Dockerfile:135`) y solo necesita leerlos. El montaje es `:ro`.
4. **Escritura atómica.** Se escribe un temporal en la misma carpeta, se le da `chmod 644` (`mktemp` crea con `600` y `node` no podría leerlo) y después `mv -f`.

## 5 · Cambio coordinado con la sesión de Contabo (no está en esta PR)

| # | Qué | Dónde | Nota |
|---|---|---|---|
| K1 | Función que escribe `publicaciones.json` (§4), con el historial en un archivo propio de `${ESTADO}` (por ejemplo, `historial.jsonl`). Se llama al final de `vigilar`, `publicar`, `volver`, `congelar` y `descongelar` | `infra/ops/web/publicar-web.sh` | Como todos los valores tienen forma fija, `printf` alcanza. No hace falta `jq`. La carpeta de destino es `${DIR}/estado-publicacion` (`DIR=/srv/dtd-cargo`), con `install -d -m 755` |
| K2 | Cada `MOTIVO=` lleva también su código de §4.4 (por ejemplo, una variable `CODIGO`) | `publicar-web.sh` | El texto libre de `MOTIVO` sigue yendo al journal, a la evidencia y a los avisos, como hoy. Al JSON va solo el código |
| K3 | Pruebas del escritor: forma válida contra el ejemplo, escritura atómica, permisos `644`, sin texto libre, un solo evento `retenida` por motivo | `infra/ops/tests/prueba-publicar-web.sh` | Se puede validar el archivo producido con `parseEstadoPublicaciones` (lo exporta `lib/studio/publicaciones-types.ts`) |
| K4 | Montaje `- ./estado-publicacion:/var/lib/dtd-cargo/publicacion:ro` en el servicio `web` | `infra/dtd-cargo/compose.yml` | **Es huella bloqueante** (`publicar-web.sh:54`). En la misma ventana del merge hay que copiar `compose.yml` al servidor, o la siguiente publicación queda retenida con motivo `huellas`. La propia publicación siguiente recrea el contenedor con el montaje |
| K5 | Instalar y comprobar: `ls -l /srv/dtd-cargo/estado-publicacion/` → `-rw-r--r-- root`; dentro del web, `node -e` lee y parsea el archivo; `/studio/debug` muestra «Al día» y el commit que corre | VPS | Con el OK que corresponda según el runbook de la 0541 |

Hasta K5, en producción la card dice «Sin datos. El servidor no ha dejado el estado de las publicaciones.». Es la conducta esperada y está probada.

## 6 · Lo que cambia en el Studio (esta PR)

- **`lib/studio/publicaciones-types.ts`** (nuevo). Contiene:
  - los tipos;
  - `parseEstadoPublicaciones`;
  - los textos y tonos por código;
  - `shaCorto`, que da 8 caracteres, como los avisos del vigilante;
  - `urlCommit`, `vigilanteSinVueltas` y `tiempoRelativo`.

  Es puro: no toca el disco.
- **`lib/studio/publicaciones-loader.ts`** (nuevo). `cargarEstadoPublicaciones(ruta?, reloj?)` nunca lanza. Devuelve `{ ok: false, motivo }` en estos casos:
  - `sin-archivo`;
  - `ilegible`, también cuando hay una carpeta en lugar del archivo;
  - `demasiado-grande`;
  - `formato`;
  - `version`.

  Con datos devuelve `{ ok: true, estado }`, y en los dos casos agrega `leidoEn`.
- **`app/studio/(app)/debug/_components/PublicacionesServidor.tsx`** (nuevo, server component). Muestra:
  - el vigilante, con su `Badge` de texto e icono;
  - la última vuelta y el aviso «Sin vueltas recientes»;
  - lo que corre en el servidor, lo publicable y la vuelta atrás, con enlace al commit;
  - el aviso si esta instancia no coincide con lo que registra el servidor;
  - el historial en `<ul>`, con resultado, origen, motivo, migraciones faltantes, hora (`<time>`) y enlace.
- **`EstadoTab.tsx`**:
  - «Deploy actual» pasa a «Esta instancia». En el servidor ya no dice «(local)»: dice qué falta (`APP_URL` o `NEXT_PUBLIC_BUILD_SHA`). La fila «Rama» solo sale en local o si se conoce.
  - «Deploys recientes» pasa a «Publicaciones del servidor».
  - La ayuda de mocks ya no recomienda `vercel env pull`.
- **`page.tsx`.** Usa `cargarEstadoPublicaciones()` en lugar de `listRecentDeploys(10)`.
- **`lib/studio/vercel-deploys.ts`.** Se borra: no tiene otro consumidor.
- **`lib/studio/env-status.ts`.** Deja de listar las siete `VERCEL_*`:
  - `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` y `VERCEL_TEAM_ID` ya no las lee nadie;
  - `VERCEL_ENV`, `VERCEL_URL` y `VERCEL_GIT_*` siguen como respaldo en `lib/runtime/app-env.ts`, que no se toca. El servidor no las define.
- **`.env.example`.** Se quita `VERCEL_API_TOKEN`.
- **El bot local de deploy (`DeployWebBot.tsx`).** Cambia solo el texto:
  - el título dice «a GitHub»;
  - el destino «Preview» dice «rama en GitHub»;
  - después de subir a `main`: «GitHub construye la imagen y el servidor la publica sola en unos 5 minutos, si pasa sus puertas», con el enlace a la card;
  - después de subir a una rama: «no se publica sola: para llevarla a producción, abre una PR».
- **Comentarios que nombraban el panel de Vercel:**
  - `deployActions.ts`;
  - `lib/studio/deploy/git-runner.ts`;
  - `debug/actions.ts`;
  - `debug/layout.tsx`.

**No cambia:**
- `app/api/debug/health/route.ts` y la forma de su respuesta (`vercelUrl`, `branch`), que la consumen el vigía externo y `fetchRemoteHealth`;
- `lib/runtime/app-env.ts`;
- la lógica de `deployActions.ts`.

## 7 · Seguridad, fronteras y datos personales

- **Fronteras ESLint.**
  - Todo lo nuevo vive en `lib/studio/` y `app/studio/`. El público no lo importa.
  - `node:fs` solo está en el loader, que solo usa el server component `page.tsx`.
- **Acceso.** `/studio/debug` sigue detrás de `requireModuleView("admin")` (`debug/layout.tsx`).
- **Contenedor.** No recibe el socket de Docker, ni el host, ni carpetas con texto libre.
- **Secretos.** Ninguno nuevo. Se quita del `.env.example` uno que ya no se usa.
- **Datos personales.** No aplica `revisar-datos-ve`. El archivo lleva SHA, horas, códigos y nombres de migración. No lleva personas, IP ni datos de negocio.

## 8 · Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| ERR-01 | cumplimiento | Errores y motivos traducidos por código, sin rutas ni errores crudos. «Sin datos» dice qué pasó y qué hacer |
| LOD-01 | cumplimiento (vacío y error); no aplica (carga) | Server component sin espera en el cliente. Estado vacío («Sin publicaciones registradas todavía.») y de error («Sin datos» con su motivo) probados |
| A11Y-01 | cumplimiento | Historial en `<ul>`/`<li>`; horas en `<time dateTime>`; estados con texto e icono (`Badge`), no solo color; zona «Sin datos» con `role="status"` |
| VIS-01 / BRAND | cumplimiento | Solo tokens `var(--*)`; tonos de `Badge` permitidos; atención en dorado (`warning`) y error en rojo solo donde hay falla real (vuelta atrás). Tuteo, sin voseo, sin emojis |
| BTN-01 | no aplica | No hay botones nuevos. El bot local cambia solo de texto |
| CMP-01 | no aplica | No hay componente compartido nuevo. `PublicacionesServidor` es local del módulo y usa `Badge` |
| SGE-00, MP-01, AUD-01/02 | no aplica | Solo lectura, sin acciones ni auditoría |

## 9 · Decisiones para Sam

1. **El bot local de deploy (botón «Push» de esta card, solo en `pnpm dev`).**
   - Hace `git add -A` y, con «Producción», `git push` directo a `main` (`deployActions.ts:164-195`).
   - Desde la SDD-0541, eso publica en producción en unos 5 minutos, sin PR ni revisión.
   - Esta spec solo corrige sus textos. **Recomendación: retirarlo en otra SDD.** El camino de hoy es la PR.
   - NO VERIFICADO: si el ruleset de `main` rechaza ese push.
2. **`VERCEL_API_TOKEN`.**
   - Después de esta PR, nada del código lo lee.
   - El plan lo revoca el 30 de octubre, y se puede adelantar.
   - Revocarlo es un paso de Sam en Vercel. Esta spec no lo hace.

## 10 · Aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | La pestaña Estado no consulta Vercel ni nombra a Vercel en ningún texto o enlace | Cumplido. `EstadoTab.test.tsx` › «ningún texto ni enlace de la pestaña nombra a Vercel» |
| 2 | Sin archivo, con una carpeta en su lugar, enorme, con JSON roto o de otra versión: la pestaña se pinta y la card dice «Sin datos» y el motivo | Cumplido. `publicaciones-loader.test.ts`, `PublicacionesServidor.test.tsx`, `EstadoTab.test.tsx` |
| 3 | Con datos: vigilante, qué corre, publicable, vuelta atrás e historial con motivo, faltantes y enlace; avisos de vigilante detenido, instancia distinta y congelado | Cumplido. `PublicacionesServidor.test.tsx` |
| 4 | Ningún texto libre del archivo llega a la salida del lector | Cumplido. `publicaciones-types.test.ts` › canario |
| 5 | El ejemplo canónico de esta spec se acepta completo | Cumplido. `publicaciones-types.test.ts` |
| 6 | «Esta instancia» en el servidor no dice «(local)» | Cumplido. `EstadoTab.test.tsx` |
| 7 | El bot local no promete un deploy de Vercel | Cumplido. `DeployWebBot.test.tsx` |
| 8 | Mutantes: el motivo sin lista cerrada, los faltantes sin filtro por motivo, el loader sin `sin-archivo`, el mensaje del bot invertido y «(local)» en el servidor hacen fallar sus pruebas | Cumplido. Cinco mutantes, todos mueren (handoff) |
| 9 | En producción la card muestra el estado real | Cumplido en el servidor y en el contenedor (2026-10-17 20:15:38Z). `node -e` dentro de `dtd-cargo-web-1`, como `node`, lee y parsea el archivo: versión 1, corre y publicable `4577b0a7`, vigilante al-dia, un evento «publicada». El montaje es de solo lectura (`touch` da «Read-only file system»). **Pantalla NO VERIFICADA:** mirar `/studio/debug` pide una sesión de admin, que se le pidió a Sam |

## 11 · Allowlist de archivos

| Área | Archivos |
|---|---|
| Lector y contrato | `lib/studio/publicaciones-types.ts` (nuevo), `lib/studio/publicaciones-loader.ts` (nuevo), `lib/studio/__tests__/publicaciones-types.test.ts` (nuevo), `lib/studio/__tests__/publicaciones-loader.test.ts` (nuevo), `docs/specs/0547-panel-publicaciones-servidor/ejemplo-publicaciones.v1.json` (nuevo) |
| Pantalla | `app/studio/(app)/debug/_components/PublicacionesServidor.tsx` (nuevo), `app/studio/(app)/debug/_components/EstadoTab.tsx`, `app/studio/(app)/debug/page.tsx`, `app/studio/(app)/debug/__tests__/PublicacionesServidor.test.tsx` (nuevo), `app/studio/(app)/debug/__tests__/EstadoTab.test.tsx` (nuevo) |
| Retiro de Vercel | `lib/studio/vercel-deploys.ts` (borrado), `lib/studio/env-status.ts`, `.env.example` |
| Bot local (textos) | `app/studio/_components/deploy/DeployWebBot.tsx`, `app/studio/_components/deploy/__tests__/DeployWebBot.test.tsx` (nuevo) |
| Comentarios | `app/studio/(app)/_actions/deployActions.ts`, `lib/studio/deploy/git-runner.ts`, `app/studio/(app)/debug/actions.ts`, `app/studio/(app)/debug/layout.tsx` |
| Documentación | esta spec, `docs/specs/README.md` (regenerado), `.agents/handoffs/0547-panel-publicaciones-servidor.md` |

**No se tocan:**
- `infra/ops/web/*`, `infra/dtd-cargo/*` (incluido su `.env.example`), `infra/ops/tests/*` y `.github/workflows/*`;
- `docs/runbooks/servidor-contabo.md` y `docs/runbooks/publicacion-automatica-web.md`;
- `lib/runtime/app-env.ts` y `app/api/debug/health/route.ts`.

## 12 · Fuera de alcance

- **K1-K5 (§5):** son de la sesión de Contabo.
- **Retirar el bot local de deploy:** decisión 1.
- **`app/studio/(app)/layout.tsx:42-47`.** Calcula el SHA del bug reporter con `??` sobre `NEXT_PUBLIC_BUILD_SHA` y `VERCEL_GIT_COMMIT_SHA`. Un build arg vacío daría `""`, mientras que `resolveBuildSha` lo trata. Es otra superficie.
- **El comentario de `infra/dtd-cargo/.env.example:193`.** Sigue nombrando `VERCEL_API_TOKEN` entre las variables «para scripts locales». No rompe nada, pero es huella: lo corrige Contabo cuando toque ese archivo.
- **Las notas sobre Vercel de `docs/runbooks/servidor-contabo.md:621,892,904-906`.** Siguen siendo ciertas: el token no hace falta y se revoca. Además, el runbook es de Contabo.

## 13 · Seguimiento

- 2026-10-17: reserva `codex/sdd-reserve-0547`. Implementación del Studio y pruebas en la rama `worktree-agent-a0f15ba72118d43b0`, PR en borrador. K1-K5 pendientes de la sesión de Contabo.
- 2026-10-17 19:17:49Z: **PR #264 integrada** por el Director (main traído, `5dc41943` → `9a2e76bf`, check verde), merge `e6ff3909`. Publicada a las 19:22:36Z con la prueba rápida 14/0. Autorización de Sam, dicha al Director: «Termina los PR y, si te toca subir a producción, sube a producción; te autorizo».
- 2026-10-17 20:10:02Z: **PR #265 integrada** (K1, K2 y K4 de la sesión de Contabo: el escritor en `publicar-web.sh` y el montaje en `compose.yml`), merge `4577b0a7`. En el servidor, la prueba del script dio 144/0 y los mutantes 50 muertos y 0 vivos.
- 2026-10-17 20:10:54Z: **K5 instalado** por la sesión de Contabo, con el candado de la publicación tomado. Instaló `publicar-web.sh` (700), `compose.yml` y `.env.example` (644), byte a byte iguales a `4577b0a7`, y `compose config -q` dio OK. Publicada a las 20:15:34Z, sin quedar retenida, con la prueba rápida 14/0. Evidencia en `/srv/ops/evidencias/publicacion-automatica/k5-0547-20261017T201054Z/` (SHA256SUMS). Prueba no se tocó: su compose relativo le da una carpeta vacía propia.
