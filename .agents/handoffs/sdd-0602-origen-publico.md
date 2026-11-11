# Handoff — SDD-0602 · Las redirecciones propias no mandan a la dirección donde escucha el servidor

Fecha: 2026-11-04. Task ID: `sdd-0602-origen-publico`.
Owner / sesión escritora: `origen-publico-sad-jones` (Worker Claude Code, la misma sesión de las SDD-0597 y 0600).

Estado: **PR en borrador, con `main` traído una vez en su turno (`d62b06f6b`, después de la #364). La saca de borrador, la vigila y la fusiona el Director General.** Choque real solo en `lib/runtime/__tests__/next-config.test.ts`: dos altas al final, se conservan las dos. El índice de specs se regeneró sobre el merge. `verify` no se corre en esta rama: lo cubre el del Director General sobre el commit fijo de `main`.

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
| Bajo un dominio distinto | `ac6d20191` | Dos corridas de 9 de 9. Una con 8 de 9, por un `curl` exit 28. Rojo sin explicar, no carga: si se repite, se mira |
| Build sin la variable | `cb1f3f99b` | El build muere con `ERR_INVALID_URL`, sin imagen |
| Control rojo | `ac6d20191` | PASÓ: 19 causales, más 15 de las pruebas de baja existentes, que esperaban host |
| Mutantes | `ac6d20191`, `cb1f3f99b` | PASÓ: 48 de 48 |
| `pnpm verify` | | NO EJECUTADO en esta rama, por decisión del Director General: lo cubre el que él corre sobre el commit fijo de `main` antes de publicar la tanda A, con esta PR adentro. Si destapa algo de aquí, me llama |
| `pnpm knowledge:status` | | NO EJECUTADO en este worktree |

Entre `ac6d20191` y el último commit propio solo cambian una prueba de la guarda y documentación: la imagen medida tiene el código final de esta spec, sin lo que trajo `main` después.

**Sobre el merge con `d62b06f6b`, `86abe5600`:** la guarda (31 pruebas, con las 3 rutas nuevas de `main` en su barrido), las pruebas de esta spec con `app/entrar` y `next-config` (229 en 15 archivos, un worker), `typecheck`, `eslint` de lo resuelto, `docs:check` y `sdd:check`: PASÓ. El diff contra `main` sigue siendo de 21 archivos. La imagen no se volvió a medir sobre el merge.

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

- [x] Traer `main` una vez y publicar, con el aviso del Director General. `docs/specs/README.md` choca en GitHub cada vez que se mueve `main`, porque allá no está el driver.
- [ ] Seguir en prueba el enlace desde `/correo/` hasta `/portal`, cuando suba `main` allí y él avise. Lo hago yo.
- [ ] Al comprobarlo, borrar la nota de memoria `entrar-plan-b-429`.

## FUERA DE ALCANCE DETECTADO

Los tres primeros los lleva el Director General en su lista. No se tocan aquí.

- **La cookie de sesión sale sin `Secure`.** Medido con `curl -D -` a `/portal/callback` por el borde TLS, en las imágenes de la base y la final, leyendo los atributos sin imprimir el valor: `Path`, `Expires`, `Max-Age`, `SameSite` en las dos. No se midió en producción.
- **`smoke-web` sigue sin mirar estas rutas.** `grep -cE 'portal/callback|email/unsubscribe|/ir/|packlist' infra/ops/web/smoke-web.sh` da 0.
- **La imagen de prueba trae `https://dtdcargo.com` literal en 7 archivos.** `grep -rlF https://dtdcargo.com .next/server | wc -l` dentro de `:prueba-sha-56cb9f6d5602217520ed1e43169d7e50a715920d`, sin red. Solo se contaron; no los abrí.
- Desde cuándo daba 500 el Excel del proveedor: inferido que desde el corte al servidor propio.
- El `curl` exit 28 en `/studio/login` móvil, una vez: rojo sin explicar, no carga. Si se repite, se mira.

## HANDOFF AL DIRECTOR

- **Reporto al Director General.** Orden e integración, suyos.
- **Sin migraciones, sin textos públicos, sin variables nuevas.** No se tocó producción ni prueba.
- **Impacto documental:** la spec y este handoff. Ningún runbook dice que las redirecciones lleven dominio. `docs/runbooks/servidor-contabo.md` ya explica por qué la variable es obligatoria en el build, y sigue siendo cierto.
- **Conocimiento:** Graphify y Archify no se regeneraron. Queda para la integración.
- **Arnés y logs de la medición:** en las notas compartidas de la sesión, carpeta `medir-0602`, fuera del repo. Ya borré sus imágenes y contenedores; reconstruir la imagen tarda unos minutos con la caché de Docker.
