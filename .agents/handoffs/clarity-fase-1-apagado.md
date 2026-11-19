# Handoff — Microsoft Clarity, fase 1: código apagado (2026-11-19)

- **Encargo:** del Director General, por decisión de Sam del 2026-11-18. Solo la fase 1 de
  `docs/marketing/clarity-evaluacion.md` (§2 y §5, fila 1).
- **SDD:** `docs/specs/0684-clarity-fase-1-apagado/spec.md`.
- **Rama:** `claude/busy-albattani-55e395`. PR sin fusionar.
- **Estado al fusionar:** APAGADO. Sin `NEXT_PUBLIC_CLARITY_ID` no carga ningún script, la CSP
  queda igual que antes y `clarity.ms` no llega al bundle. No hay ningún ID en el repo.
- **Encender en producción necesita el OK nominal de Sam** (DG, 2026-11-19).

## Qué cambió

| Archivo | Cambio |
|---|---|
| `lib/clarity.ts` | `clarityIdFromEnv`: ausente, vacío, espacios, `off` o forma inválida ⇒ `""`. Sin respaldo. |
| `components/Clarity.tsx` | Componente cliente con `next/script` (`lazyOnload`). Guarda de GA + `/registro`, `/entrar`, `/abrir`, `/cotizador`. Consent API v2: carga sin cookies; `consentv2` concedido solo con `dtd_cookie_consent=granted` (publicidad siempre denegada); `consent false` al revocar. Corte público → privado: clic ⇒ navegación completa; `router.push`/atrás/fragmento ⇒ `consent false` + recarga. Apagado plegado en el build (patrón SDD-0544). |
| `app/layout.tsx` | `<Clarity />` junto a `<Analytics />`. |
| `next.config.ts` | `publicCspHeader`: Clarity en `script-src`, `connect-src` e `img-src` solo con ID. Regla nueva y excluyente para las rutas privadas con la CSP estricta. `c.bing.com` fuera. `default-src` y `frame-ancestors` sin cambios. |
| `components/CalculadoraForm.tsx`, `FclCalculator.tsx`, `EstimadoModal.tsx`, `ContactoForm.tsx` | `data-clarity-mask="True"` en resultados, modal del estimado y formulario de contacto. |
| `Dockerfile` | `ARG` + `ENV NEXT_PUBLIC_CLARITY_ID`. |
| `.github/workflows/build-image.yml` | `NEXT_PUBLIC_CLARITY_ID=${{ vars.NEXT_PUBLIC_CLARITY_ID }}`. |
| `.github/workflows/build-image-prueba.yml` | `NEXT_PUBLIC_CLARITY_ID=off` fijo y el bundle sin red exige 0 archivos de `.next/static` con `clarity.ms`. |
| `infra/ops/staging/verificar-aislamiento.sh` | `NEXT_PUBLIC_CLARITY_ID` en la lista de integraciones vacías en prueba. |
| `playwright.clarity.config.ts`, `e2e/clarity-no-fuga.clarity.ts`, `package.json` | e2e de no-fuga (`pnpm test:e2e:clarity`) con `next dev` propio, Supabase sintético y etiqueta falsa. |
| `docs/marketing/clarity-evaluacion.md` | Línea de seguimiento hacia la SDD-0684. |
| `.gitignore` | `/.next-clarity-e2e/`. |
| `.env.example` | `NEXT_PUBLIC_CLARITY_ID=` documentada (vacía = apagado). |

## Decisión de consentimiento

Se aplica el modo de la evaluación (§3.4): en las páginas públicas permitidas el script carga **sin
cookies**; con `dtd_cookie_consent=granted` exacta pasa a `consentv2` concedido (publicidad siempre
denegada) y al revocar se llama a `consent false`. El DG lo confirmó el 2026-11-19 («B, como dice la
evaluación fusionada»), corrigiendo una indicación anterior suya («sin cargar antes del
consentimiento») que él mismo llamó imprecisa. Durante unos minutos el código tuvo la variante
estricta; se revirtió antes de cualquier commit y las pruebas finales son de esta variante.

**Sam confirma este modo, junto con el encendido, antes de prenderlo** (anotado en la spec).

Consecuencia: el banner se abre solo en `/entrar` y `/registro` (y desde el pie), así que la
mayoría de las sesiones serán por página y sin cookies.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` en el worktree | PASÓ (1 min 25 s) |
| vitest focal: `Clarity.test.tsx`, `Clarity.apagado-build.test.ts`, `next-config-clarity.test.ts`, `next-config.test.ts`, `build-image-prueba-workflow.test.mjs`, `Analytics*`, `CookieConsentBanner*` | PASÓ: 11 archivos, 279 pruebas |
| `pnpm test:e2e:clarity` (chromium) | PASÓ: 14/14 (incluye el banner real: aceptar ⇒ `consentv2` concedido, rechazar ⇒ `consent false`) |
| Mutante: corte desactivado (clic y red de seguridad) | La e2e FALLA como debe: 34 latidos después de entrar a `/entrar` y a `/portal`. Se corrió sobre el mismo código del corte que quedó (el cambio de modo no lo tocó). |
| `docs:check` / `sdd:check` (sueltos) | PASÓ / PASÓ |
| `pnpm typecheck` (con turno del DG, después de la revisión) | PASÓ |
| vitest focal después de la revisión: Clarity, contrato del bundle, CSP, `next-config`, workflows, `env-example-contract`, Analytics, banner y `CalculadoraForm*` | PASÓ: 16 archivos, 299 pruebas (antes de la revisión: 12 archivos, 280 pruebas, sobre `035c4dd47`) |
| Mutante: quitar `/cotizador` de la guarda y de la CSP | FALLAN 5 pruebas, como debe |
| `pnpm verify` completo | NO EJECUTADO limpio: la única corrida se cortó con la sesión a las 12:36Z (sus pasos posteriores dieron `0xC0000142`, sin medir). Lo cubre el CI de la PR |
| e2e general | NO EJECUTADO |

Notas de las pruebas:

- La primera corrida de la e2e daba verde **sin probar nada**: con `127.0.0.1` Next dev bloquea los
  recursos de `/_next` y el cliente no hidrata; las rutas con Supabase tampoco hidrataban sin él.
  Se pasó a `localhost`, se usa el Supabase sintético y cada caso de ruta excluida exige ahora que el
  runtime de Clarity haya montado (`__dtdClarityAllowed` definido).
- `/verificar` quedó fuera de la e2e: su página necesita `service_role` y no hidrata en local. La
  cubre la prueba unitaria de la guarda.
- `next dev` con otra carpeta de salida agrega `.next-clarity-e2e/…/types` a `tsconfig.json`; se
  revirtió y quedó anotado en la config.

## Lo que Sam debe hacer para encender el script

En este orden, cada paso con su OK:

1. **Aprobar y publicar antes el texto de la política** (`/privacidad` y `/cookies`, evaluación
   §3.5). La sesión que evaluó Clarity dice que Sam ya aprobó el texto de las cookies; cambiar las
   páginas es otra PR que asigna el DG.
2. **El proyecto en clarity.microsoft.com** con una **cuenta de la empresa**, en modo
   **Balanced** y **«requiere consentimiento»**. Según esa misma sesión, Sam ya lo dejó así.
   Acceso al panel solo para el equipo de Venezuela. Antes de aceptar los términos, releer en la
   página viva la cláusula de contenido financiero.
3. **Cambiar la variable de repositorio** `NEXT_PUBLIC_CLARITY_ID` (GitHub → Settings → Secrets and
   variables → Actions → **Variables**; no un secret: el ID es público). Ya existe y vale `off`: la
   creó la sesión que evaluó Clarity, por decisión de Sam. Para encender, se cambia por el ID del
   proyecto y se **reconstruye la imagen** de producción. Es `NEXT_PUBLIC_*`: sin rebuild no toma
   efecto. `prueba` ya va con `off` fijo en `build-image-prueba.yml`; no hay que tocarla.
   *(El encargo original decía Vercel; producción ya no usa Vercel.)*
4. **Confirmar el modo de consentimiento** (carga sin cookies; cookies solo con `granted`) junto
   con el OK nominal de encendido.
5. Medir LCP, INP y CLS de `/`, `/tarifas` y `/calculadora` antes y después.

## Pendiente de esta tarea

- Un `pnpm verify` completo limpio, o el CI verde de la PR.
- Fase 3, antes de encender: comprobar en una grabación de prueba si Clarity guarda el `href` de un enlace dentro de un nodo enmascarado (spec §6, NO VERIFICADO).

## Revisión independiente (cabeza `035c4dd47`): cambios hechos

1. `/cotizador` excluida en la guarda y en la CSP privada (muestra contenido de documentos como
   texto). Grep de otras rutas públicas con datos como texto: ninguna más; detalle en la spec §6.
   Además se enmascaró el bloque «Estimado guardado» (código EST) de `CalculadoraForm`.
2. `href` dentro de nodos enmascarados: declarado NO VERIFICADO en la spec §6, con su atenuante y
   la medición pendiente.
3. Este handoff, con los resultados reales.
- Revisión independiente de la PR (la lanza el DG).

## FUERA DE ALCANCE DETECTADO

- **`/marca…` sin barra en el catch-all de headers:** el lookahead `marca` del catch-all (en `main`
  desde antes) deja sin ningún header de seguridad cualquier ruta que empiece por `marca` y no sea
  `/marca` ni `/marca/…` (por ejemplo `/marcas`). Hoy no existe ninguna ruta así (sería un 404),
  pero una futura `/marcas` saldría sin CSP. Se arregla con `marca(?:/|$)` en el lookahead.
- **`/tarifas/embed` y `/fcl/embed` reciben la CSP dos veces** (reglas `/x` y `/x/:path*`, ambas
  con `:path*` que acepta vacío). Es la misma CSP y no cambia nada, pero sobra una de las dos.
- **`smoke-web.sh`** no comprueba Clarity. Cuando se encienda (fase 3), conviene agregar la
  comprobación de que la etiqueta aparece en producción.
- **Banner de cookies:** mientras el banner solo se abra en `/entrar` y `/registro`, casi todas las
  sesiones de Clarity serán por página y sin cookies (sin recorridos completos). Es una decisión de
  UX y marca aparte.
- **Overlay de errores en `next dev`:** en `/servicios` sin Supabase real el overlay de Next tapa el
  banner y roba los clics por coordenadas (la e2e usa `dispatchEvent`). Es ruido de dev, no de
  producción.
