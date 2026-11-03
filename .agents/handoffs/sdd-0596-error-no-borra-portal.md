# SDD-0596 · tramo 1: un error no borra lo escrito en el portal

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/error-no-borra-portal`. **Rama:** `codex/error-no-borra-portal`. **Base:** `7be2ed9e5`.
- **SDD:** 0596, asignada por el Director. Reserva local sin publicar: `codex/sdd-reserve-0596-error-no-borra-lo-escrito`, `refs/dtd/reservations/0596`.
- **Límite:** la retención terminó: la primera publicación ya salió, con producción en `dac99762e`. La integra el Director General; el Worker no fusiona.
- **Permisos:** PR en borrador. Sin merge, sin deploy, sin producción. Corridas pesadas con turno del Director General.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que un error no borre lo escrito en los paneles"». El Director pidió medir antes las rutas en uso real y llevarle la lista.

Decisión de Sam, literal: «Sí, portal primero», a la pregunta «¿Arreglamos primero el portal, antes que los paneles de Nómina?». En esta sesión la pregunta llegó como «¿Incluyo el portal en este encargo como primer tramo?».

## Resultado

Tras una respuesta con error, 13 formularios en 11 archivos de portal, `entrar` e `invitar` perdían lo escrito. Ahora lo conservan. Causa, lista de campos por formulario, decisión y tramos en `docs/specs/0596-error-no-borra-lo-escrito/spec.md`.

## COMPLETADO

- `lib/shared/submit-keeping-draft.ts`: el ayudante.
- Los 13 formularios conservan `action` y añaden `onSubmit={submitKeepingDraft(...)}`.
- `AcceptInvitationForm` conserva nombre y apellido y sigue vaciando la clave.
- `AcceptanceForm` queda igual que en `main`: las casillas no se conservan, a propósito.
- `app/portal/conservar-lo-escrito.test.tsx`: un caso por formulario, lo que no debe conservarse, envío, doble envío y limpieza al guardar.
- Medidos y sin tocar: `RegisterForm`, `PaymentReportForm`, `DataChangeEditor`, `BillingIdentityForm`, `ReferralInviteForm`. También sin tocar: `CedulaPhotoRow`, donde el vaciado es lo correcto.
- Archivos medidos en Chrome: con el arreglo se conservan, así que la pantalla no necesita pedir que se vuelvan a elegir.
- Datos personales clasificados con `revisar-datos-ve`, en la spec. `/ui-check` del diff, sin cambios visuales.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `conservar-lo-escrito.test.tsx`, ayudante desactivado, una corrida con `--maxWorkers=1` | FALLÓ, como se esperaba: 14 de 29 en rojo |
| La misma prueba con el ayudante | PASÓ, 29 de 29 |
| Chrome 152, `CotizacionRequestForm`, con clics y teclas reales | PASÓ: antes se perdían servicio, descripción, CBM y cajas; ahora se conservan, también al reintentar. Un `required` vacío bloquea el envío y la URL no cambia |
| Chrome 152, archivos en `NewPurchaseForm` | PASÓ con el arreglo: el reintento envía los archivos. En `main`, el rótulo muestra el archivo mientras el campo queda vacío |
| Chrome 152, `PaymentReportForm` | PASÓ: conserva todo, con el archivo |
| Componentes reales, `RegisterForm` y otros tres | PASÓ: nada perdido con una respuesta de error |
| Lectura de las pruebas vecinas (`NewPurchaseWizard`, `PurchaseStepDetalle`, `PortalAddresses`, `SuppliersClient`, `PortalClaims`, `entrar-dos-filas`, `action-result-contract`) | Ninguna depende de `action` ni del reinicio. **Por lectura, sin correrlas** |
| `docs:check`, `sdd:check` | Ver el cuerpo de la PR |
| Mutantes | **NO EJECUTADO:** el Director General los programó después de la pila, con su turno |
| `next dev` con server action real, y envío antes de hidratar (criterio 6) | **NO EJECUTADO:** mismo motivo. **Es la comprobación más importante que falta** |
| ESLint, `tsc`, suite y pruebas vecinas en local | Ver `pnpm verify`, abajo |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica el Director desde main |

Las medidas de arriba usan una acción simulada, con la forma de la respuesta de la acción real.

**Sin medir:** lector de pantalla, portal con sesión real, y archivos en `NewPurchaseWizard`, `PurchaseStepDetalle` y `PortalClaims`.

### `pnpm verify` sobre `5fd452355` (2026-11-03): el exit fue 1

Una corrida, 84,4 min y un mínimo de 2.475 MB libres. Al lanzarla: 0 pesadas ajenas, 8,3 GB libres y `docker info` OK. **`verify` no cerró en verde:** salió con exit 1 por `build`, con 14 de 17 pasos corridos de verdad.

| Paso | Resultado |
|---|---|
| `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions`, `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols` | PASÓ |
| `test` | FALLÓ en el primer intento: 8 de 13.361 pruebas, en 3 archivos de `app/p/[token]`, todas por tiempo agotado (`supplier-flow` 5 a 20 s; `prefill` 2 y `standard-format` 1, en `waitFor`). PASÓ en el reintento: 13.361 de 13.361 |
| Esos 3 archivos, aislados con `--maxWorkers=1` | PASÓ: 33 de 33, en 39,7 s. Ninguno está en el diff |
| `e2e` | FALLÓ en el primer intento: 5 fallidas, 4 flaky, 220 pasaron y 20 omitidas. PASÓ en el reintento: 229 pasaron, 0 fallaron y 20 omitidas. El proceso salió ≠ 0 porque un worker no cerró en 300 s; `verify` lo clasifica como el de WebKit y da OK con aviso |
| `e2e/sin-scroll-horizontal.spec.ts`, en mobile-chrome | FALLÓ en el primer intento y PASÓ en el reintento. No se arregla aquí |
| `e2e/company-photo-carousel.spec.ts`, en chromium | FALLÓ en el primer intento y PASÓ en el reintento. No se arregla aquí |
| `build` | FALLÓ: «couldn't find the Next.js package (next/package.json)». Causa abajo |
| `sql-tests`, `schema-rebuild` | NO EJECUTADO, SKIP: Docker se apagó solo a los 6,5 min (`idle: stopping VM`, 15:42:35Z) |
| `migrations-applied` | NO EJECUTADO, SKIP: el worktree no tiene `.env.local`. Es validación de release |

**Causa del rojo de `build`: entorno, del propio Worker.** 49 de los 1.768 enlaces de `node_modules`, `next` entre ellos, apuntaban a `accion-que-lanza\node_modules\.pnpm\…`, fuera del root, y `.modules.yaml` registraba ese almacén. Por la hora y el destino, es inferencia que vino de `corepack pnpm sdd:next --reserve` corrido el 2026-11-02 en un worktree con junction. `node_modules` se movió aparte, sin borrarlo, y se reinstaló desde vacío con `--frozen-lockfile --offline` en 38,8 s. Quedaron 1.768 de 1.768 dentro del worktree, sin cambios en Git.

**Pasos abiertos, medidos de a uno sobre el mismo SHA, sin relanzar `verify`.** Docker arrancado sin `--timeout`, con un contenedor mínimo despierto; mínimo de 1.508 MB libres.

| Paso | Resultado |
|---|---|
| `scripts/check-build.mjs` | PASÓ, exit 0, en 151 s |
| `scripts/run-sql-tests.mjs` | PASÓ, exit 0, en 194 s: 249 contratos |
| `scripts/check-schema-rebuild.mjs` | PASÓ, exit 0, en 57 s: de 491 migraciones, 473 aplicadas desde cero y 18 sólo-ledger |
| «Calidad local sin secretos» sobre `5fd452355`, [run 41665134249](https://github.com/SoftAgentes/DTDCARGO/actions/runs/41665134249) | PASÓ |

Esta PR no toca `supabase/`. Lo que se agregó después de `5fd452355` es este registro y el merge de `main`: el resultado no se volvió a medir sobre esa cabeza con `verify`.

## COMMITS

- `384b95d65`: `fix(portal): SDD-0596 — un error no borra lo escrito en el portal`.
- `71106aa3d`: spec y handoff, primera versión.
- `5fd452355`: merge de `main` en `642d4f83c`; la cabeza medida.
- El commit que contiene esta versión no se autorreferencia.

## PR / BRANCH

Rama `codex/error-no-borra-portal`, en la PR en borrador [#358](https://github.com/SoftAgentes/DTDCARGO/pull/358) contra `main`. La integra el Director General.

## PENDIENTES DE ESTA TAREA

1. Con turno del Director General: `next dev` con server action real y sin hidratar, y mutantes. Si la PR entra antes, el criterio 6 sigue `NO VERIFICABLE`.
2. «Calidad local sin secretos» en verde sobre la cabeza con `main` traído.
3. Smoke en el portal con sesión real: provocar un error en una cotización y comprobar que lo escrito sigue ahí, con archivos adjuntos en una compra.

## FUERA DE ALCANCE DETECTADO

1. **Cuando la acción lanza:** corte de red o, por lectura, un cuerpo por encima de `bodySizeLimit`. Se pierde todo, y reintentar podría duplicar. Pide decisión; la recomendación está en la spec.
2. **ERR-01:** los mensajes no dicen qué se conservó, y `AcceptInvitationForm` no avisa que la clave se vació. No se cambian textos en este tramo.
3. **Tramo 2, Nómina:** 15 paneles arreglados en `codex/error-no-borra`, commits locales sin publicar, para una PR aparte. Sus mutantes también esperan turno. La integración la decide el Director.
4. **Tramo 3, resto del ERP y apps móviles:** 76 archivos en total tienen `<form action>` con campos sin estado. Sin tocar.
5. **`PortalMessageForm`** avisa «El mensaje es muy largo» sólo desde el servidor. Con el arreglo ya no se pierde el texto, pero un `maxLength` o un contador evitarían el viaje.

## HANDOFF AL DIRECTOR

- La decisión de Sam está registrada arriba y en la spec.
- **`AcceptanceForm`:** recomiendo no conservar las casillas, y por eso salió de la allowlist. Queda igual que en `main`.
- **Archivos:** no hace falta un aviso. `main` tenía un defecto peor: el rótulo mostraba un archivo que ya no estaba, y el servidor descartaba en silencio el archivo vacío del reintento.
- El ayudante es idéntico en las dos ramas, así que combinan en cualquier orden. La spec difiere desde este cierre: al traer `main` a Nómina, conservar su sección de verificación y su estado.
- Cuando des el turno, el orden es: `next dev` primero, porque puede cambiar el diseño; después los mutantes.
- `node_modules` viejo quedó en `%TEMP%\nm-358-viejo`, por si hace falta comparar. No se borra con `rm -rf`: sus enlaces apuntan al árbol nuevo a través de la junction de `accion-que-lanza`.

### Impacto documental

Spec 0596 nueva e índice regenerado. No cambian políticas.
