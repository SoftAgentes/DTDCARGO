# Handoff — SDD-0602 · Las redirecciones propias no mandan a la dirección donde escucha el servidor

Fecha: 2026-11-04. Task ID: `sdd-0602-origen-publico`.
Owner / sesión escritora: `origen-publico-sad-jones` (Worker Claude Code, la misma sesión de las SDD-0597 y 0600).

Estado: **PR en borrador, esperando el aviso del Director General para entrar en la cola, después de la #364.** Sin traer `main` a propósito: el cruce se midió con `merge-tree` contra `615adf39e` y no hay conflictos. `verify` no se corrió: pide turno.

- **Worktree:** `DTD-worktrees/origen-publico`, con `node_modules` propio.
- **Rama:** `codex/origen-publico`, desde `ec56a4ac4`.
- **SDD:** `docs/specs/0602-origen-publico/spec.md`. Reservada con `sdd:next --reserve`: rama `codex/sdd-reserve-0602-origen-publico` y ref `refs/dtd/reservations/0602`, sin publicar.

## OBJETIVO ORIGINAL

Director General: el contenedor lleva `https://0.0.0.0:3000` en `request.url`, y `/portal/callback`, la baja de correo y `/ir/bitacora` redirigen ahí. Entregar SDD corta, arreglo sin depender de `HOSTNAME`, pruebas con rojo causal, mutantes y medición real contra el servidor de producción construido, siguiendo la redirección.

**Autorización de Sam, literal, transmitida por el Director General:** «Sí, con la tanda A». Respondió a su pregunta de si autorizaba la PR y que saliera en esa misma publicación. No se amplía a nada más.

## COMPLETADO

- **Reproducido en la imagen real antes de tocar nada.** Además de las redirecciones, destapó que el Excel del proveedor daba 500.
- **Redirecciones con `Location` relativo:** `lib/http/local-redirect.ts`. Primero se hizo con origen configurado, como pedía el encargo; recomendé el relativo y el Director General lo aceptó. Queda en la historia de la rama.
- **Excel del proveedor:** la plantilla se lee del disco.
- **Lista de orígenes:** deja de sumar la dirección de escucha.
- **Guarda:** `__tests__/sin-origen-de-la-peticion.test.ts`, con dos excepciones declaradas y comprobadas.

## VALIDACIÓN

El detalle está en la spec. Por SHA:

| Comprobación | SHA | Resultado |
|---|---|---|
| Medición de la base | `ec56a4ac4` | Reproduce el defecto: 9 de 9 redirecciones a `0.0.0.0`, Chromium `ERR_ADDRESS_INVALID`, Excel 500 |
| Medición de la imagen final | `ac6d20191` | PASÓ: redirecciones, sesión con token y con PKCE, Chromium, Excel completo, preflight |
| Bajo un dominio distinto | `ac6d20191` | Dos corridas de 9 de 9. Una con 8 de 9, por un `curl` exit 28 que no se repitió y no está explicado |
| Build sin la variable | `cb1f3f99b` | El build muere con `ERR_INVALID_URL`, sin imagen |
| Control rojo | `ac6d20191` | PASÓ: 19 causales, más 15 de las pruebas de baja existentes, que esperaban host |
| Mutantes | `ac6d20191`, `cb1f3f99b` | PASÓ: 48 de 48 |
| `pnpm verify` | | NO EJECUTADO: pide turno |
| `pnpm knowledge:status` | | NO EJECUTADO en este worktree |

Entre `ac6d20191` y la cabeza solo cambian una prueba de la guarda y documentación: la imagen medida tiene el código final de la app. El cierre de `typecheck`, `eslint`, `docs:check` y `sdd:check` está en la PR.

## COMMITS

Los SHA quedan en la PR. La historia conserva el primer intento:

1. Reserva de la SDD.
2. `publicOrigin` y los cinco sitios con origen configurado, por daño, más la guarda y sus pruebas.
3. `fix(web): … Location relativo`: reemplaza a `publicOrigin`.
4. `fix(studio): … la dirección donde escucha el servidor no es un origen`.
5. `test(web): …` de la guarda.
6. `docs(sdd): …` spec y handoff.

## PR / BRANCH

- Rama: `codex/origen-publico`.
- PR en borrador contra `main`. La fusiona el Director General, antes de publicar la tanda A.

## PENDIENTES DE ESTA TAREA

- [ ] Turno de `verify` del Director General.
- [ ] Traer `main` una vez, cuando él avise. `docs/specs/README.md` choca en GitHub cada vez que se mueve `main`, porque allá no está el driver.
- [ ] Comprobar en prueba, al subir `main` para la tanda A, el enlace desde `/correo/` hasta `/portal`. Lo hace quien publique.
- [ ] Al comprobarlo, borrar la nota de memoria `entrar-plan-b-429`.

## FUERA DE ALCANCE DETECTADO

- La cookie de sesión sale sin `Secure`. Medido en la imagen, igual antes y después.
- `smoke-web` sigue sin mirar estas rutas.
- La imagen de prueba trae `https://dtdcargo.com` literal en 7 archivos de `.next/server`. Sin revisar.
- Desde cuándo daba 500 el Excel del proveedor: inferido que desde el corte al servidor propio.
- El `curl` exit 28 en `/studio/login` móvil, una vez.

## HANDOFF AL DIRECTOR

- **Reporto al Director General.** Orden e integración, suyos.
- **Sin migraciones, sin textos públicos, sin variables nuevas.** No se tocó producción ni prueba.
- **Impacto documental:** la spec y este handoff. Ningún runbook dice que las redirecciones lleven dominio. `docs/runbooks/servidor-contabo.md` ya explica por qué la variable es obligatoria en el build, y sigue siendo cierto.
- **Conocimiento:** Graphify y Archify no se regeneraron. Queda para la integración.
- **Limpieza pendiente, de quien corresponda:** imágenes locales `dtd-origen:base` y `dtd-origen:relativo`. Las de `ghcr.io/softagentes/dtdcargo` bajadas para leer el dominio horneado.
