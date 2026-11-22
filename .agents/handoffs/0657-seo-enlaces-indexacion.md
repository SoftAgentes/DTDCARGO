# Handoff · SDD-0657 — Enlaces internos e indexación de dtdcargo.com

- **Fecha:** 2026-11-18
- **Owner / sesión:** Claude (sesión de Sam). Claim `claude-seo-ff01b80d`, liberado al cerrar.
- **Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\seo-enlaces-indexacion`
- **Rama:** `codex/seo-enlaces-indexacion`. Base `1bf1dcaf5` (`origin/main` al empezar) más la reserva `0e71bd8f1`. Se fusionó `origin/main` (`97f4f0718`, nómina y Studio) sin conflictos.
- **SDD:** [`docs/specs/0657-seo-enlaces-indexacion/spec.md`](../../docs/specs/0657-seo-enlaces-indexacion/spec.md), `in-progress`. Reserva publicada como `codex/sdd-reserve-0657`, con push create-only.
- **PR:** [SoftAgentes/DTDCARGO#661](https://github.com/SoftAgentes/DTDCARGO/pull/661), en borrador hacia `main`.
- **Estado de la tarea:** lista para revisión.

## Encargo y permisos

- Sam, 2026-11-18: «Haz esta tarea aquí: “Enlaces internos e indexación de dtdcargo.com”».
- Permitido: commits locales en esta rama.
- Sam, 2026-11-18: «Sí, abre la PR». Con eso se autorizó publicar la rama y la reserva, y abrir la PR en borrador.
- No permitido: merge ni despliegue. No se tocó base de datos ni producción.

## OBJETIVO ORIGINAL

Que Google indexe las páginas públicas que Search Console marca como «Descubierta» o «Rastreada: actualmente sin indexar», atacando la causa medida: páginas sin enlaces internos, títulos que no nombran el tema y 404 de rastreo evitables.

## COMPLETADO

1. **Pie:**
   - Explora suma «Puerta a puerta» e «Importar por ciudad».
   - Ayuda suma «Brochure».
   - Enlaces rápidos suma «Calculadora FCL», «Llenado de contenedor» y «Flete terrestre».
   - Ahora toda ruta fija del sitemap tiene enlace en el pie o es una ficha de servicio de la portada.
2. **Enlaces dentro del contenido:**
   - `/puerta-a-puerta` → `/servicios/puerta-a-puerta` y `/importar-de-china`, y a la inversa.
   - `/fcl` → `/servicios/fcl` y `/llenado`.
   - `/servicios/fcl` → `/llenado`.
   - `/servicios/lcl` → `/tarifas`.
   - `/tarifas` → `/servicios/puerta-a-puerta` y `/servicios/lcl`.
3. **Títulos:** `/puerta-a-puerta`, `/servicios`, `/pre-alertas`, `/brochure` y `/fcl`. Con el sufijo quedan entre 43 y 54 caracteres.
4. **Descripciones de 160 caracteres o menos:** `/tarifas`, `/fcl`, `/servicios/fcl`, `/servicios/puerta-a-puerta`, `/servicios/lcl` y `/puerta-a-puerta`.
5. **404 de rastreo:**
   - `/favicon.ico` hace 301 a `/brand/favicon.ico`.
   - Cuatro FAQ ya no ponen dos puntos pegados a `dtdcargo.com/registro` ni a `dtdcargo.com/portal`, porque Google los rastreaba como `/registro:`.
6. **Documentación:**
   - El comentario del 301 de doortudoor en `next.config.ts` dice dónde vive ahora (Cloudflare).
   - Entrada nueva del 2026-11-18 en `docs/marketing/seo.md`; P-a marcada como hecha.
   - SDD-0657 e índice regenerado.

## VALIDACIÓN

Mi comprobación de que las pruebas nuevas son válidas:
- Las 8 pruebas nuevas FALLARON con los archivos de código de `HEAD` (cambios guardados con `git stash`) y PASARON con el cambio.
- Pruebas afectadas, corridas aparte: 6 suites y 36 pruebas PASARON (antes del arreglo de abajo). Tras el arreglo, las 5 suites tocadas PASARON (30 pruebas).

Primer `pnpm verify`:
- Dos fallos eran míos, y quedaron arreglados:
  - `components/sin-promesa-rastreo.test.tsx`: la lista exacta de «Enlaces rápidos» se actualizó con las 3 calculadoras nuevas, sin tocar lo que protege.
  - `app/__tests__/sin-promesa-rastreo-restantes.test.tsx`: se revirtió el cambio a `llms.txt`, porque la SDD-0528 fija esa línea.

Segundo `pnpm verify`, sobre el árbol final (`exit 1`, «14 de 17 pasos corrieron de verdad»):

| Paso | Estado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions | PASÓ |
| docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols | PASÓ |
| build | PASÓ |
| e2e | PASÓ con aviso: 172 PASARON; los 73 fallos son «Executable doesn't exist», porque falta el navegador mobile-safari |
| test | FALLÓ |
| migrations-applied | NO DISPONIBLE: el worktree no tiene `.env.local` y no se copian credenciales |
| sql-tests, schema-rebuild | NO DISPONIBLE: no hay Docker |

Detalle de `test`:
- Primera pasada: 1 fallo de 20 081 pruebas.
- Reintento: 3 fallos de 20 033. Los tres son *timeouts*:
  - `scripts/__tests__/entorno-prueba-scripts.test.mjs` (SDD-0540, bash con dobles): 600 s.
  - `infra/ops/tests/migraciones.test.mjs` (SDD-0546, bash con dobles): 600 s.
  - `lib/studio/__tests__/solo-superadmin-crea-admin.migration.test.ts`: 20 s, con errores de vitest «Timeout waiting for worker to respond» en la misma corrida. Corrida sola PASÓ (36 de 36).
- El diff de esta rama no toca `infra/`, `scripts/`, `lib/studio/` ni `supabase/` (`git diff --stat HEAD -- infra scripts lib/studio supabase` sale vacío). Se clasifican como del entorno (Windows con carga), no como regresión.

Tras el merge de `origin/main`:
- PASARON `pnpm typecheck`, eslint de los archivos tocados, `pnpm sdd:check`, `pnpm docs:check` (641 specs) y las 5 suites afectadas (38 de 38).
- `pnpm verify` completo no se repitió. Cuenta el CI de la PR.

## COMMITS

- `0e71bd8f1` — reserva de la SDD-0657 (stub).
- Commit `docs(DTD-0657)` que contiene este documento: SDD, bitácora SEO, índice y handoff.
- Commit `feat(DTD-0657)`: enlaces, títulos, descripciones, favicon, FAQ y pruebas.

## PR / BRANCH

- PR [SoftAgentes/DTDCARGO#661](https://github.com/SoftAgentes/DTDCARGO/pull/661), en borrador, desde `codex/seo-enlaces-indexacion` hacia `main`.
- Reserva publicada: `codex/sdd-reserve-0657`.

## PENDIENTES DE ESTA TAREA

1. Revisión del Director y CI verde en la PR (`gh pr ready` lanza la corrida que cuenta).
2. El merge y el despliegue los autoriza Sam aparte.
3. **Decisión de Sam**: fusionar o no `/puerta-a-puerta` con `/servicios/puerta-a-puerta`, con datos de Search Console de 3 o 4 semanas después del despliegue.
4. **Datos de Sam u operaciones** para diferenciar las 18 páginas de ciudad: tiempo real de entrega por ciudad, transportista local, casos de clientes y costo de última milla. No se inventan.
5. Después del despliegue: revisar en Search Console «Páginas → Por qué no se indexan» y medir la observación 6 de la aceptación.

## FUERA DE ALCANCE DETECTADO

- `SITE_DESCRIPTION` de la portada (169 caracteres) y la descripción de `/academia` (175) pasan de 160. Son copy de marca y quedan para Sam.
- La descripción de `/pre-alertas` (184/190) la fija la prueba de la SDD-0521. Recortarla es decisión de esa SDD.
- `public/llms.txt` enlaza `/portal` (307 sin sesión): lo fija la SDD-0528.
- Las noticias tienen pocos enlaces entrantes (`/noticias/yiwu-ventaja-estrategica` solo 1). Enlazarlas desde las fichas de servicio sería una tarea de contenido aparte.
- `nuevo.dtdcargo.com` aparece en las estadísticas de rastreo (11 solicitudes) y hoy no responde. Conviene revisar si su DNS sigue vivo en Cloudflare.
- Las pruebas bash de SDD-0540 y SDD-0546 pasan de 600 s en esta máquina Windows.

## Impacto documental

- Actualizados: `docs/marketing/seo.md`, `docs/specs/0657-…/spec.md`, `docs/specs/README.md` (índice regenerado) y el comentario de `next.config.ts`.
- No aplica a `docs/marketing/README.md`: el estado de SEO vive en `seo.md`.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR #661, pasarla a lista para revisión (`gh pr ready`) para que corra el CI e integrarla con el OK de Sam.
- **Cambios compartidos:** `components/Footer.tsx`, que aparece en todas las páginas públicas, y `next.config.ts` (un redirect nuevo).
- Sin migraciones.
- Sin sesiones consumidoras.
- Claim liberado al cerrar.
