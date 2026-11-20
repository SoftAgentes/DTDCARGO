---
sdd: "0684"
title: "Microsoft Clarity en el sitio público, fase 1: código apagado"
status: in-progress
author: "Claude (Worker)"
created: 2026-11-19
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0518", "0544", "0581"]
confidencialidad: publico
---

# SDD-0684 — Microsoft Clarity en el sitio público, fase 1: código apagado

> Deja listo el código de Microsoft Clarity para las páginas públicas de dtdcargo.com, con la misma guarda que GA, la CSP pública, el consentimiento enlazado al banner y el corte al entrar a una zona privada. Se fusiona **apagado**: sin `NEXT_PUBLIC_CLARITY_ID` no carga nada.

## Pedido

Sam decidió el 2026-11-18 instalar Microsoft Clarity en la web pública y, más adelante, en el Portal del Cliente. La evaluación es `docs/marketing/clarity-evaluacion.md` (PR #670, fusionada). Esta SDD cubre **solo la fase 1** (§5, fila 1): código apagado.

**Fuera de alcance** (cada punto necesita el OK concreto de Sam):

- crear la cuenta de Clarity, aceptar los términos y poner el ID real en la variable de repositorio o en producción (fase 3);
- cambiar `/privacidad` o `/cookies` (fase 2, con abogado);
- el Portal del Cliente (fase 5, SDD propia).

## Etiquetas de evidencia

- **C**: leído en el código de este repo (rama de esta SDD, base `main` en `b3ae00ed4`).
- **D**: documentación oficial de Microsoft citada en la evaluación.
- **P**: medido por una prueba de esta SDD.
- **I**: inferencia. No se probó.

## Diseño

### 1. Variable de entorno y apagado

- `NEXT_PUBLIC_CLARITY_ID` es la única fuente del ID (`lib/clarity.ts`, `clarityIdFromEnv`). **C**
- Ausente, vacía, con solo espacios u `off` (sin importar mayúsculas) ⇒ apagado: el componente no renderiza nada, no instala listeners y la CSP no nombra a Clarity. **P**
- Un valor que no tiene forma de ID (alfanumérico, 6 a 32) también apaga. El ID se interpola en un `<script>` inline; un valor con comillas o `</script>` no llega a esa cadena. **P**
- **Sin ID de respaldo** (lo contrario de GA en la SDD-0518). La prueba lee el fuente y falla si aparece un `??` o `||` tras la variable. **P**
- Es `NEXT_PUBLIC_*`: queda fijado en el build. Para apagarlo sin desplegar, se pausa el proyecto desde el panel de Clarity (evaluación §2.3). **D**

### 2. Componente `components/Clarity.tsx`

- Componente cliente montado junto a `<Analytics />` en `app/layout.tsx`. Usa `next/script` con `lazyOnload` (evaluación §2.5: menos riesgo para el INP). **C**
- **Guarda:** `isClarityExcludedUrl` = `isAnalyticsExcludedUrl` de GA (`PRIVATE_PREFIXES`, `/track/<código>`, query no aprobada, credenciales en el fragmento) **más** `/registro`, `/entrar`, `/abrir` y `/cotizador` (ver §6). Se evalúa con la URL completa del navegador; en el servidor no se renderiza nada. **P**
- **Snippet:** el oficial, con dos cambios. (1) Antes de nada pregunta a `window.__dtdClarityAllowed()`, que evalúa la guarda sobre `location.href` en ese momento; si la función no existe o dice que no, no hace nada. Motivo: `next/script` con `lazyOnload` inserta el script después de `load` aunque el componente ya se haya desmontado. (2) Encola `consentv2` leyendo `dtd_cookie_consent` con la misma regla exacta que GA (nombre y valor completos, una sola cookie visible): concedido solo con `granted`; si no, denegado. **P**
- **Apagado plegado en el build** (patrón de la SDD-0544): `CLARITY_BUILD_OFF` compara contra `process.env.NEXT_PUBLIC_CLARITY_ID` directo, así que con `off` o vacío el minificador descarta la rama y `clarity.ms` no llega a `.next/static`. Contrato: `components/Clarity.apagado-build.test.ts` (con control rojo: un `.trim()` en medio deja `clarity.ms`). Los orígenes de la CSP viven en `next.config.ts` y no en `lib/clarity.ts` por el mismo motivo. **P**
- Nunca se llama a `clarity('identify', …)` ni se ponen etiquetas con datos de la persona. **C**

### 3. Consentimiento (Consent API v2)

**Modo: el de la evaluación (§3.4, pasos 1-4).** El DG lo confirmó el 2026-11-19 («B, como dice la evaluación fusionada»), después de una indicación anterior más estricta («sin cargar antes del consentimiento») que él mismo corrigió por imprecisa. **Sam confirma este modo, junto con el encendido, antes de prenderlo.**

- El proyecto está en «requiere consentimiento» (según la sesión que evaluó Clarity, Sam ya lo dejó así, con Balanced): sin decisión, Clarity corre **sin cookies**. **D**
- En las páginas públicas permitidas el script **carga sin cookies** y encola `consentv2` con `{ ad_Storage: "denied", analytics_Storage: "denied" }`, salvo que la cookie sea `granted` exacta; con `granted`, `analytics_Storage: "granted"`. Valores parecidos (`granted-x`, cookie ajena con prefijo) no conceden. **P** (unitaria y e2e)
- En caliente (`useSyncExternalStore` sobre la cookie, la misma fuente que el banner): aceptar ⇒ `clarity('consentv2', {ad_Storage:'denied', analytics_Storage:'granted'})`; revocar después de haber aceptado ⇒ `clarity('consent', false)`. Rechazar sin haber aceptado no llama a nada, porque ya corría sin cookies. **P** (unitaria y e2e con el banner real)
- `ad_Storage` va siempre `denied`: no usamos publicidad de Microsoft. **C**
- **Consecuencia (D, I):** como el banner se abre solo en `/entrar` y `/registro` (y desde «Preferencias de cookies» en el pie), la mayoría de las sesiones serán por página y sin cookies: mapas e interacciones sí, recorridos completos no. Abrir el banner en más páginas es una decisión aparte de UX y de marca (evaluación §3.4).

### 4. Corte al pasar del público a una zona privada

Un script cargado no se descarga. Si Clarity ya cargó en una página pública y la persona pasa con navegación cliente a `/portal`, seguiría grabando el DOM privado. La documentación no trae una orden para detener solo la grabación (evaluación §2.2, **I**). El corte es doble:

1. **Clic** en un enlace del mismo origen hacia una URL excluida, con Clarity cargado: listener en captura sobre `document` (corre antes de React y de `next/link`), `preventDefault` + `stopPropagation`, `clarity('consent', false)` y **navegación completa** (`location.assign`). El documento nuevo arranca sin Clarity, y la página privada nunca se pinta en el documento con Clarity. Ctrl/⌘+clic, `target=_blank` y `download` los resuelve el navegador en otro documento. **P**
2. **Red de seguridad** para lo que no es un clic (`router.push`, atrás/adelante, cambio de fragmento): `pushState`/`replaceState` hacia una URL excluida, `popstate` o `hashchange` que deja la URL excluida ⇒ `clarity('consent', false)` y **recarga completa**. **P**

*Límite conocido (I):* en la red de seguridad, Next ya pintó la página privada cuando llama a `pushState`; entre el render y el corte hay un tramo de milisegundos en que la etiqueta real podría observar mutaciones del DOM. `consent false` va antes de la recarga. El camino normal (enlaces) no tiene ese tramo. La revisión de grabaciones al azar de la fase 4 debe buscar páginas privadas.

### 5. CSP (`next.config.ts`)

- Nueva `publicCspHeader` = `cspHeader` + `https://www.clarity.ms https://*.clarity.ms` en `script-src`, `connect-src` e `img-src`, **solo si hay ID**. Sin ID es idéntica a `cspHeader`. **P**
- Se aplica en el catch-all público. Una regla nueva, mutuamente excluyente con él, da la CSP estricta de siempre a las rutas privadas que no tenían regla propia: `studio`, `portal`, `back`, `invitar`, `acceso`, `entrar`, `abrir`, `verificar`, `p`, `interno`, `registro`, `cotizador`, `/track/<código>` y `/m` exacto. `/m/*`, `/marca*`, los embeds, Bandeja, Bitácora, ficha y cierre de chat conservan sus reglas, derivadas de `cspHeader`. **P**
- `default-src` y `frame-ancestors` no se tocan. **P**
- **`c.bing.com` queda fuera.** Es el dominio que planta las cookies de terceros de Microsoft (`MUID` y otras), que también sirven para su publicidad, y nosotros mandamos `ad_Storage: "denied"` siempre. Si al encender (fase 3) el panel no recibe datos sin él, se agrega con una SDD que lo diga. **D**, **I** sobre el efecto.
- La prueba mide con el matcher de rutas de Next (`getPathMatch`) que **cada ruta recibe exactamente una CSP** y que toda ruta excluida por la guarda recibe una CSP sin Clarity (paridad). **P**

### 6. Enmascarado

Modo del proyecto: **Balanced** (se configura en el panel, fase 3). Además, `data-clarity-mask="True"` en:

| Dónde | Archivo |
|---|---|
| Columna de resultado de la calculadora LCL/DDP (`/tarifas`) | `components/CalculadoraForm.tsx` |
| Resultado de la calculadora FCL (`/fcl`) | `components/FclCalculator.tsx` |
| Modal del estimado (`/estimacion` redirige a `/tarifas`): nombre y teléfono | `components/EstimadoModal.tsx` |
| Formulario de contacto completo | `components/ContactoForm.tsx` |
| Bloque «Estimado guardado» con el código EST (fuera de la columna de resultado; según su comentario no se pinta en `/tarifas`, pero se enmascara igual) | `components/CalculadoraForm.tsx` |

Los demás formularios públicos (academia, boletín) solo tienen inputs, que Clarity enmascara siempre (**D**). `/registro`, `/entrar`, `/abrir` y `/cotizador` están excluidos del todo.

**`/cotizador` excluido (revisión independiente de la #710).** Es pública, pero con `DOCUMENT_IMPORT_ENABLED` encendida muestra como **texto** el contenido de documentos importados (`components/document-import/DocumentEditor.tsx`: nombre del archivo, Shipping Mark, productos, códigos y marcas). En Balanced eso se grabaría legible, y choca con «las páginas públicas no llevan datos de clientes». Se eligió la opción más segura: excluir la ruta en la guarda (`CLARITY_EXTRA_PRIVATE_PREFIXES`) y, por paridad, en la CSP privada (`PRIVATE_CSP_SEGMENTS`). Enmascarar la raíz de `CotizadorClient` habría dejado pasar la URL y cualquier texto nuevo fuera de esa raíz. **P** (guarda, CSP y paridad; un mutante que quita `/cotizador` hace fallar 5 pruebas). GA sigue midiendo `/cotizador`, porque no graba el DOM.

**Búsqueda de otras rutas públicas con datos como texto** (2026-11-19, grep en `app/` y `components/` de lectores de archivos, `/api/public/` y ecos de nombre, correo o teléfono fuera de las zonas privadas). Resultado:

- `DocumentEditor` y `DocumentImportPanel` solo se usan en `/cotizador` (ahora excluida), en el Portal y en `/p/[token]` (ya excluidos).
- `DocumentImportEntry` solo se usa en el Portal.
- `CalculadoraForm`, `FclCalculator` y `EstimadoModal` quedan enmascarados según la tabla.
- `ContactoForm`, `AcademiaLeadForm` y `NewsletterCard` no devuelven como texto lo que escribe la persona. El contacto lo arma en el mensaje de WhatsApp, que sale del sitio.
- `/email/baja` muestra textos fijos; un parámetro con token o correo excluye la vista por la regla de query de GA.
- `/admin/cbm-estudio` e `/ir/bitacora/tarea/[id]` son route handlers: no renderizan el layout, así que no cargan Clarity.
- `/llenado` y `/calculadora-terrestre` muestran medidas y montos que escribe la persona, no datos personales. Balanced enmascara los números. **I**

**Atributos `href` dentro de nodos enmascarados: NO VERIFICADO.** El bloque del estimado guardado tiene un enlace `href="/registro?est=<código EST>"`. La documentación de enmascarado que cita la evaluación habla del **texto** de los nodos y de los campos. No dice si Clarity también reemplaza atributos como `href` en un nodo con `data-clarity-mask="True"`, ni si un clic en un enlace guarda su destino. No se pudo medir sin un proyecto real.

Hasta medirlo se cuenta como riesgo. Lo atenúan dos cosas:

1. Según el comentario del código, el bloque no se pinta en `/tarifas`, la única página pública que usa `CalculadoraForm`.
2. Un clic en ese enlace va a `/registro`, que está excluida: el corte hace navegación completa y la URL de destino no se graba como página.

En la fase 3, antes de encender, hay que revisar una grabación de prueba con un `href` sintético dentro de un nodo enmascarado. Si el atributo aparece, se quita el código de la URL o se excluye la página.

### 7. Imagen Docker y workflows

Producción ya no se despliega con Vercel: la imagen se construye en GitHub Actions y corre en el VPS; las `NEXT_PUBLIC_*` entran como build-arg. Igual que `NEXT_PUBLIC_GA_ID`:

- `Dockerfile`: `ARG NEXT_PUBLIC_CLARITY_ID` y su `ENV` en la etapa build. **C**
- `.github/workflows/build-image.yml` (producción): `NEXT_PUBLIC_CLARITY_ID=${{ vars.NEXT_PUBLIC_CLARITY_ID }}`. Mientras la variable de repositorio no exista, llega vacía y Clarity queda apagado. **C**, **P** (contrato)
- `.github/workflows/build-image-prueba.yml`: `NEXT_PUBLIC_CLARITY_ID=off` como build-arg fijo, y la comprobación del bundle sin red exige 0 archivos de `.next/static` que nombren `clarity.ms`. **P** (contrato con controles rojos en `scripts/__tests__/build-image-prueba-workflow.test.mjs`)
- `infra/ops/staging/verificar-aislamiento.sh`: `NEXT_PUBLIC_CLARITY_ID` entra en la lista de integraciones que el `.env` de prueba debe tener vacías o ausentes. **C**
- `infra/ops/web/smoke-web.sh` no cambia: comprueba GA en producción, y Clarity está apagado. Cuando se encienda (fase 3), conviene agregarle la comprobación. **I**

## Pruebas

| Prueba | Qué mide |
|---|---|
| `components/Clarity.test.tsx` | Entorno (apagado y sin respaldo), guarda, render, snippet (consentimiento inicial con cookie exacta), guarda en ejecución (`__dtdClarityAllowed`), consentimiento en caliente, corte por clic y red de seguridad, restauración de `history`. |
| `components/Clarity.apagado-build.test.ts` | Con `off` o vacío, `clarity.ms` no queda en el código minificado; con ID sí; control rojo con `.trim()`. |
| `lib/runtime/__tests__/next-config-clarity.test.ts` | CSP con y sin ID, una sola CSP distinta por ruta (con el matcher de Next), Clarity solo en las tres directivas públicas, sin `c.bing.com`, privadas iguales a la estricta, paridad con la guarda. |
| `scripts/__tests__/build-image-prueba-workflow.test.mjs` | Build-arg fijo `off` en prueba, conteo de `clarity.ms` en el bundle y variable de repositorio en producción, con mutantes que deben fallar. |
| `e2e/clarity-no-fuga.clarity.ts` (`pnpm test:e2e:clarity`) | Con un `next dev` propio, ID sintético, Supabase sintético y una etiqueta FALSA que late contra `*.clarity.ms` (nada sale a internet): en público carga y la primera señal es `consentv2` denegado salvo con `granted` exacto; el banner real manda `consentv2` concedido al aceptar y `consent false` al rechazar; ninguna petición en rutas excluidas aun con consentimiento, comprobando que el cliente hidrató; el latido se corta al pasar del público a `/entrar` por `next/link` y a `/portal` por `router.push`. |

La e2e no entra en `pnpm test:e2e`: la suite general corre sin ID, que es como se fusiona. Se comprobó que detecta un corte roto: con el corte desactivado a mano (mutante), los dos casos de navegación fallan con 34 latidos después de entrar a la zona privada. `/verificar` quedó fuera de la e2e porque su página necesita `service_role` en el servidor y no hidrata en local; la cubre la prueba unitaria de la guarda.

## Encendido (fases 2 y 3, no en esta SDD)

1. Publicar el texto de `/privacidad` y `/cookies` (evaluación §3.5). Según la sesión que evaluó Clarity, Sam ya aprobó el texto de las cookies; el cambio de las páginas lo asigna el DG en otra PR.
2. Proyecto en clarity.microsoft.com con una cuenta de la empresa: enmascarado **Balanced** y **«requiere consentimiento»** (según esa misma sesión, Sam ya lo dejó así); acceso solo para el equipo de Venezuela.
3. La **variable de repositorio** `NEXT_PUBLIC_CLARITY_ID` (GitHub → Settings → Secrets and variables → Actions → Variables) ya existe y vale `off` (la creó la sesión que evaluó Clarity, por decisión de Sam). Para encender, Sam la cambia por el ID real y se reconstruye la imagen de producción. `prueba` ya va con `off` fijo. Encender en producción, y el modo de consentimiento de §3, necesitan la **confirmación y el OK nominal de Sam**.
4. Medir LCP, INP y CLS de `/`, `/tarifas` y `/calculadora` antes y después.

## Criterios de aceptación

- [x] Sin ID (ausente, vacío, espacios, `off`) no se carga nada y la CSP no cambia.
- [x] Sin ID de respaldo en el código; ningún ID real en el repo.
- [x] Guarda de GA + `/registro`, `/entrar`, `/abrir` y `/cotizador` (contenido de documentos como texto; corrección de la revisión de la #710).
- [ ] `href` dentro de nodos enmascarados: NO VERIFICADO; se mide con una grabación de prueba en la fase 3, antes de encender.
- [x] CSP de Clarity solo en el sitio público y solo en `script-src`, `connect-src`, `img-src`.
- [x] Consent API v2 enlazada a `dtd_cookie_consent` (sin cookies hasta `granted`; `consent false` al revocar).
- [x] `clarity.ms` fuera del bundle con el apagado; `off` fijo en la imagen de prueba; producción desde la variable de repositorio.
- [x] `data-clarity-mask` en resultados, ecos de datos y formulario de contacto.
- [x] Corte al pasar del público a una zona privada.
- [x] Pruebas unitarias y e2e de no-fuga.

## Corrección previa al encendido: exclusiones de Google Analytics en el registro

La política de la fase 2 dice que Google Analytics 4 y Clarity no cargan en páginas cuya dirección lleve tokens o enlaces personales. Para que eso sea cierto, las exclusiones de GA se alinean con las de Clarity en el registro: `/registro/link`, `/registro/activar` y `/registro/correo` entran en `PRIVATE_PREFIXES` (`components/Analytics.tsx`). `/registro` a secas sigue cargando GA, porque ahí se mide la conversión de registro. **P**: `__tests__/analytics.test.ts` (prefijos, y `/registro/linkedin` no se confunde) y `components/Analytics.registro.test.tsx` (render real: carga en `/registro`, nada en las tres subrutas).

Se revisaron las demás rutas públicas con un segmento dinámico fuera de `/studio`, `/portal` y `/m`. Las que no son de marketing ya estaban excluidas, o son manejadores sin página (`/ir/…`, `/api/…`). **D**

Va en su propia PR, antes del tren de encendido, y se publica en la misma imagen.
