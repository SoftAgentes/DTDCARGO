# Handoff · SDD-0544 · Producto mínimo para el entorno de prueba (Fase 2 de la SDD-0540)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-16, de ~15:20 a 16:40 UTC (Caracas: 11:20 a 12:40) |
| Task ID / owner | `0544-prueba-producto-minimo` / subagente Worker lanzado por la sesión Director, claim `worker-0540-fase2-aa291c19` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-aa291c1998d15f394` |
| Rama | `worktree-agent-aa291c1998d15f394` |
| Base | `origin/main` `dc84d94f` (merge de la #253) |
| SDD | [0544](../../docs/specs/0544-prueba-producto-minimo/spec.md), `proposed`. Reserva local `codex/sdd-reserve-0544-prueba-producto-minimo` (`5097f6da`), sin publicar |
| Estado de la tarea | lista para revisión |
| Permisos | commits selectivos, push de la rama propia y PR en borrador contra `main`, sin fusionar (cada merge se publica solo, SDD-0541). Prohibidos: producción, SSH, DNS, GHCR con credenciales, secretos reales, `pnpm verify` completo y suites Docker sin turno |

## OBJETIVO ORIGINAL

La Fase 2 de la SDD-0540 con SDD propia:
1. GA y Ads apagables en el build, con 0 archivos de `.next/static` con `G-25CD7BZH98` o `AW-561290482`, producción igual, prueba de contrato y control rojo; `build-image-prueba.yml` manda el apagado y `build-image.yml` queda igual.
2. Aviso visible «Entorno de prueba» con `APP_ENV=staging` en el Studio, el Portal, la PWA y el sitio público, con tokens de la marca, ausente con `production`, prueba de render en los cuatro y `/ui-check`.
3. Correos y avisos sin salida en prueba (D9, modo simulado), con evidencia de código, y cierre con `APP_ENV=staging` de lo que pudiera enviar.
4. El hallazgo de la Fase 1: la consulta de cédulas en modo simulado en staging.

**Número de SDD.** `sdd:next` propuso la 0543 (`421 refs + worktrees; spec siguiente: 0543`). No la usé: el encargo dice que la está tomando la sesión de los consolidados. Reservé la **0544** con la función `prepareReservation` del mismo script (`scripts/next-number.mjs`), que crea las dos refs de forma atómica y sólo si no existen. El inventario confirmó 0543 y 0544 libres en ese momento. **Efecto:** como `sdd:next` toma el máximo + 1, la próxima sesión que reserve sin conocer esto recibirá la 0545 y la 0543 quedará como hueco hasta que la sesión de los consolidados la use. El índice regenerado ya muestra la 0543 en «Huecos».

## COMPLETADO

### 1. `NEXT_PUBLIC_GA_ID=off` (`components/Analytics.tsx`)

- `GA_ID`, `ADS_ID` y `WHATSAPP_CONVERSION` comparan `process.env.NEXT_PUBLIC_GA_ID === "off"` directo, cada uno. Con `off` quedan vacíos.
- `fireWhatsAppSignals` y `trackLead` no hacen nada sin ID, aunque otro script deje un `gtag`.
- **Por qué la comparación va así:** el bundler reemplaza la variable por el literal, el minificador pliega la comparación y descarta la rama con los IDs. Un `.trim()` en medio no se pliega (lo midió la 0518 y lo repite el control de la prueba nueva).

### 2. Aviso «Entorno de prueba»

- `components/AvisoEntornoPrueba.tsx`, componente de servidor. Se monta una vez, primero en el `<body>` de `app/layout.tsx`.
- Sólo con `resolveAppEnv() === "staging"`. Los Preview de Vercel quedan afuera: escriben en producción.
- Estilos `.entorno-prueba` en `app/globals.css`: franja dorada de 4px arriba y pestaña centrada «Entorno de prueba · No es el sitio real», o sólo «Entorno de prueba» en menos de 640px. `--color-status-warning` con `--on-warning`. Fija, `pointer-events: none`, `z-index: 2000`, con `safe-area`.
- **Páginas prerenderizadas:** `Dockerfile` declara `ARG APP_ENV` en la etapa build, antes de `next build`. Es ARG y no ENV: no queda en la imagen.

### 3. Salidas simuladas

- **Inventario con evidencia** en el §1.3 de la spec. Con las claves vacías, **ningún camino envía**: Resend en mock, Auth a Mailpit, push no-op sin VAPID, Telegram sin token, Kommo sin conexión ni token, sin API de WhatsApp, y `cedulave` sin URL no consulta.
- **Cierres con `APP_ENV=staging`:** como prueba va a tener consolidados reales, lo que alcanza a un cliente o a un tercero no puede depender sólo de una llave vacía.
  - `resendSend` y `resendBatchSend` devuelven `mock_no_key` con `code: "app_env_staging"` sin llamar a Resend, aunque haya llave. `resendGetReceivedEmail` no cambia.
  - El panel de entorno muestra Resend en `mock` en staging.
- **Sin cambio, con su motivo en el §2.5 de la spec:** push (sólo llega a dispositivos suscritos en prueba), Telegram (un bot de prueba sólo le escribe a quien lo inició), Kommo, WhatsApp y Auth.
- El buzón de Mailpit para los correos de la app no se hizo: no hacía falta (SDD aparte si se pide).

### 4. Consulta de cédulas

- `providerRegistry.getCneProvider()` devuelve en staging `proveedorCneSimulado`, que responde «no encontrado» sin red. La ficha cae al piso manual.
- **Precisión del hallazgo:** `cedulave` sin `IDENTITY_CNE_URL` ya devolvía `null` sin `fetch` (`cne-cedulave.ts:126-127`). La consulta externa sólo pasaba con la URL puesta. Se cierra igual, como pide el encargo; el handoff de la 0540 no decía lo contrario.

### 5. Workflow y documentación

- `build-image-prueba.yml`: build-args fijos `APP_ENV=staging` y `NEXT_PUBLIC_GA_ID=off`; la comprobación del bundle falla si `.next/static` nombra los IDs y exige JS ahí; el resumen informa el conteo en todo `.next`. `build-image.yml` sin tocar.
- `docs/runbooks/entorno-prueba.md` (tres lugares), `docs/marketing/README.md` (Analítica), spec 0544 e índice regenerado.

## `/ui-check` · aviso «Entorno de prueba»

Rúbrica de `.claude/commands/ui-check.md` aplicada en línea, sólo lectura, sobre `components/AvisoEntornoPrueba.tsx`, el bloque `.entorno-prueba` de `app/globals.css` y `app/layout.tsx`. Evidencia visual: capturas en Chromium (Playwright) con el bloque CSS real, los tokens de `:root` y `lib/font-files/archivo-latin-wght.woff2`, sobre encabezados de muestra. Medido: pestaña de 296 × 24 px en 1280 px y de 158 × 24 px en 390 px; `pointer-events: none`.

```
🎨 UI-CHECK · aviso «Entorno de prueba»
Hallazgos (5):
1 ⭐ [media] app/globals.css .entorno-prueba — la pestaña (24px bajo la franja de 4px) se
   superpone al centro de arriba de los encabezados. En /m tapa el final del eyebrow
   «Almacenista · DTD» (el título y los controles quedan libres); en el Studio, el borde de
   arriba del buscador. No atrapa clics. Si molesta al verlo en prueba: en < 640px bajar a
   11px con padding var(--s-1) var(--s-2), o anclarla a la izquierda.
2  [baja] Fuente Archivo (capa marca) también sobre Studio, Portal y PWA, que usan Nunito y
   Sora. Es un elemento global, fuera de los wrappers: se ve igual en las cuatro superficies.
3  [baja] 12px/16px y z-index 2000 literales: no hay token global de letra chica ni escala de
   z-index en :root. Mismo criterio que .cookie-card. La escala --s-*/--r-* va con respaldo.
4  [baja] /tarifas/embed dentro del Portal de prueba muestra su propio aviso en el iframe.
5  [baja] Al imprimir desde prueba, el aviso sale en cada página. Se deja a propósito.
✅ Lo que está bien: sólo tokens de color (--color-status-warning, --on-warning), 0 hex; tono
   «Atención» de BRAND.md; 5,24:1 AA; se entiende por el texto, no sólo por el color;
   mayúsculas por text-transform (eyebrow); sin AI slop; no tapa clics; safe-area; copy en
   tuteo neutro y verdadero (no dice «datos ficticios»: entran consolidados reales).
Veredicto: OK con ajustes menores (no bloqueante).
```

## VALIDACIÓN

Corridas sobre la cabeza `26bce9f0` más la documentación sin commit de este cierre (sin código).

| Comprobación | Resultado |
|---|---|
| Sonda Turbopack (Next 16.2.11, `next build` de un proyecto mínimo con el `Analytics.tsx`, `tmp-sdd0544-probe/`, nunca en el índice y borrada al terminar) | **PASÓ.** `.next/static` con `G-25CD7BZH98` / `AW-561290482`: esta rama + `off` → **0 / 0**; `main` + `off` → **1 / 1** (control rojo); esta rama + vacío → 1 / 1 = `main` + vacío; con un ID propio, igual en las dos (1 / 1 y el ID). En `.next/server` sólo queda el texto fuente en un `.js.map`, que el standalone no copia: `page.js.nft.json` lista 111 archivos y 0 mapas |
| Vitest de lo nuevo y lo vecino (75 archivos: Analytics, aviso, Resend y sus consumidores, newsletter, notificaciones, identidad, registro, usuarios, workflow, runbook, `ci-workflow-contract`) | **PASÓ**: `Test Files 75 passed (75)`, `Tests 1010 passed (1010)` |
| Controles rojos (versión de `main` del archivo de producto, prueba nueva, restaurado desde el commit) | **PASÓ, todos rojos:** Analytics 6 fallan y los 4 de «producción sin cambios» pasan; aviso 4 fallan («presente con staging» en las cuatro superficies); Resend 3 fallan (staging con llave llama a la red); CNE 5 fallan: 3 de comportamiento (staging con URL, con `cedulave` y con el valor vacío: `fetch` llamado una vez) y 2 porque `main` no tiene el provider simulado; el caso `verifik` pasa también en `main`, porque su stub nunca usa la red; workflow + Dockerfile 4 fallan |
| `corepack pnpm typecheck` | **PASÓ** (exit 0) |
| `corepack pnpm exec eslint` de los 13 archivos de código y pruebas tocados | **PASÓ** (exit 0) |
| `corepack pnpm docs:check` | **PASÓ**: «índice sincronizado con 529 specs» |
| `corepack pnpm sdd:check` | **PASÓ**: `[OK] numbering: sin números repetidos` |
| `git diff --check` y `git diff --cached --check` en cada commit | **PASÓ** |
| `next build` del repo completo | **NO EJECUTADO**: el encargo lo pide sólo si es imprescindible, y la sonda de Turbopack mide el criterio. Comando pendiente: `DTD_STANDALONE=1 NEXT_PUBLIC_GA_ID=off APP_ENV=staging corepack pnpm exec next build` y después `grep -rlF -e G-25CD7BZH98 -e AW-561290482 .next/static \| wc -l` (esperado 0). Lo mide de verdad la primera corrida de `build-image-prueba.yml` |
| `pnpm verify` | **NO EJECUTADO**: lo excluye el encargo (corrida pesada) |
| Primera corrida de `build-image-prueba.yml` con este código | **NO EJECUTADO**: el entorno `prueba` de GitHub y sus variables son de la Fase 3 |
| Aviso en `prueba.dtdcargo.com` | **NO EJECUTADO**: Fase 3 |
| `corepack pnpm knowledge:status` | **NO DISPONIBLE**: `structural INVALID` (4769 pendientes), `semantic INVALID` (1255), `archify PENDING` (`ARCHIFY_RUNTIME_MISSING`), `obsidian PENDING`. El worktree no tiene `graphify-out/` |
| `knowledge:visual` / `knowledge:visual:check` | **NO DISPONIBLE**: falta el runtime de Archify 2.16.0 en el worktree |

## COMMITS

- `da3f7747` · `feat(web): SDD-0544 — NEXT_PUBLIC_GA_ID=off apaga GA y Ads en el build`
- `44e0130f` · `feat(web): SDD-0544 — aviso «Entorno de prueba» con APP_ENV=staging`
- `b8650289` · `feat(studio): SDD-0544 — Resend y la consulta de cédulas, simulados en staging`
- `84db6a0a` · `ci: SDD-0544 — la imagen de prueba se construye sin GA y con APP_ENV=staging`
- `26bce9f0` · `test(studio): SDD-0544 — la prueba de CNE en staging mide primero la red`
- el commit que contiene este documento (spec, índice, runbook, marketing y handoff).

## PR / BRANCH

Rama `worktree-agent-aa291c1998d15f394`, PR en **borrador** contra `main` (la URL va en la descripción de la PR y en el reporte al Director). Sin fusionar: desde el 2026-10-16 cada merge a `main` se publica solo en la web real (SDD-0541).

## PENDIENTES DE ESTA TAREA

1. **Primera imagen de prueba con este código.** `gh workflow run build-image-prueba.yml --ref <rama o main> -f sha=<sha>`. El paso «Comprobar el bundle sin red» tiene que dar `GA ahí: 0 · Ads ahí: 0`. El resumen dice cuántos archivos de todo `.next` los nombran: si no es 0, `verificar-aislamiento.sh --exigir-sin-ga` va a fallar (ver riesgo 2 de la spec).
2. **Sam ve el aviso** en el sitio público, el Studio, el Portal y `/m` de `prueba.dtdcargo.com` (Fase 3), y decide el hallazgo 1 del `/ui-check`.
3. **D9 y D11 por nombre.** Se aplicaron con la recomendación del §4 de la 0540; Sam las confirma antes de la Fase 3, como pide el §8 de esa spec.
4. CI de la PR.

## FUERA DE ALCANCE DETECTADO

1. `lib/studio/newsletter/sender.ts:125,263`: con `mock_no_key` el mensaje dice «RESEND_API_KEY no está configurada». En staging con una llave puesta por error, el correo igual no sale, pero el texto no dice por qué.
2. `infra/ops/staging/verificar-aislamiento.sh:278,290-292`: cuenta GA y Ads en todo `/app/.next` y los deja como AVISO salvo `--exigir-sin-ga`, con un texto que remite a «la Fase 2». Contar en `.next/static` y exigir por defecto lo decide la sesión de Contabo, dueña del script.
3. `infra/ops/web/smoke-web.sh:106-112` exige GA en los chunks: con esta fase falla en prueba a propósito. El runbook ya lo dice.
4. La reserva de la 0544 está sólo en este clon (`codex/sdd-reserve-0544-prueba-producto-minimo`, `5097f6da`). La PR hace visible la spec; la ref de reserva no se publicó porque el encargo pedía la reserva local.

## Impacto documental y conocimiento

- **Documentos canónicos actualizados:** spec 0544 (nueva), `docs/specs/README.md` (regenerado), `docs/runbooks/entorno-prueba.md` (estado de la Fase 2, el punto de GA del smoke y la lista de fases) y `docs/marketing/README.md` (Analítica: `off`).
- **Sin cambios:** la spec 0540 (su §3 · Fase 2 sigue siendo el plan; esta SDD lo ejecuta) y `infra/ops/**` (de la sesión de Contabo, ver FUERA DE ALCANCE 2).
- **Graphify, Archify y Obsidian:** NO DISPONIBLE en este worktree. Pendiente global tras integrar: la estructura de Graphify debe incorporar los archivos nuevos (`components/AvisoEntornoPrueba*.tsx`, las pruebas nuevas y la spec 0544). Nada de esta rama está en `semanticPilot`. El Director publica desde `main` integrado.

## HANDOFF AL DIRECTOR

1. Revisar la PR en borrador. Toca el layout raíz y `app/globals.css` (aviso), `components/Analytics.tsx`, `lib/studio/mail/resend-api.ts`, `lib/studio/identity/index.ts`, `lib/studio/env-status.ts`, el `Dockerfile` y `build-image-prueba.yml`. Producción: sin aviso (`APP_ENV=production`), GA igual, Resend y CNE iguales; el `Dockerfile` sólo suma un `ARG` que `build-image.yml` no manda.
2. **Merge = publicación** (SDD-0541): la autorización tiene que cubrir ese efecto. Tras el merge, la imagen de producción se reconstruye; no hay migraciones.
3. La 0543 queda como hueco del índice hasta que la sesión de los consolidados entregue su spec; al fusionar su PR, el índice se regenera.
4. Pasarle a la sesión de Contabo los FUERA DE ALCANCE 2 y 3 y el pendiente 1.
5. Ownership: el claim `worker-0540-fase2-aa291c19` se libera al cerrar. El worktree y la rama se conservan.
