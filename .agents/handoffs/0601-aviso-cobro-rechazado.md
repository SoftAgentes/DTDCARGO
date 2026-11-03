# SDD-0601 · aviso del cobro no registrado

Owner: `worker-aviso-cobro` · Rama: `codex/0601-aviso-cobro-rechazado` · Worktree: `DTD-worktrees/0601-aviso-cobro-rechazado` · Base: `3f3749cc3` · Fecha: 2026-11-03

## OBJETIVO ORIGINAL

Sam, literal, transmitido por el Director General: «Mejorarlo antes de usar el ERP», sobre «No se pudo registrar el cobro.». Encargo: SDD y rama nuevas, que el aviso diga por qué y a quién acudir, y traer la frase exacta para pedirle OK antes de publicarla. Número tomado con el inventario.

## COMPLETADO

- **Reserva:** `sdd:next --reserve aviso-cobro-rechazado --expect 0601`. Las dos refs son locales; no se publicaron.
- **Medición en prueba:** el motivo real llega con HTTP 400 y código `23514`, y la factura no cambia. Detalle en la spec.
- **Código:** `avisoDeCobroNoRegistrado` en `lib/studio/collections-actions.ts`, con tres avisos. Los textos están en la spec, **pendientes del OK de Sam**.
- **Pruebas:** bloque «aviso del cobro no registrado · SDD-0601» en `collections-identify.test.ts`. El caso «error interno cualquiera» de la prueba de carrera cambia al texto nuevo, porque el cambio es justo ese; no se debilita: sigue comprobando que no se muestre el texto de la base.

## VALIDACIÓN

| Comprobación | Estado |
|---|---|
| Pruebas nuevas contra el código viejo | FALLÓ, 9 de 13, que era lo esperado. Las 4 que pasan afirman el texto de la 0497 y que un rechazo con mensaje propio no cambia |
| `collections-identify.test.ts` entero, con un worker | PASÓ, 34 de 34 |
| `scripts/__tests__/spec-migration-refs.test.ts` | PASÓ, 5 de 5 |
| ESLint de los dos `.ts` | PASÓ |
| `docs:check`, `sdd:check`, `governance:check`, `components:check` | PASÓ |
| Rechazo real en prueba, con el JWT de `accounting` | PASÓ: HTTP 400, `23514`, «La venta original requiere revisión.», factura igual y recibos de 2 a 2 |
| Sin respuesta | Leído en `postgrest-js` 2.106.1, `status: 0` y `code: ""`. No lo provoqué en prueba |
| El aviso en pantalla, `tsc`, `verify`, mutantes, Docker | NO EJECUTADO: la imagen no tiene este código, y hay un `verify` ajeno |

## COMMITS

Se leen en la rama.

## PR / BRANCH

Sin publicar. No hay PR hasta el OK de Sam a la frase.

## PENDIENTES DE ESTA TAREA

- OK de Sam a los textos, por el Director General. Si cambia el texto, se cambian el código y la prueba.
- Publicar la rama y abrir la PR, cuando el Director lo diga.
- Mirar el aviso en pantalla: requiere la imagen de esta rama en prueba. NO EJECUTADO.
- `verify`, y las pruebas fuera de este archivo: NO EJECUTADO, por el `verify` ajeno.

## FUERA DE ALCANCE DETECTADO

Está en la sección «Fuera de alcance» de la spec. Lo más importante: **no encontré pantalla para reparar una venta inválida,** así que el administrador que reciba el aviso podría no poder arreglarla sin ayuda técnica; y la RPC de cobro no tiene clave de idempotencia.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

Spec 0601 e índice de specs. Graphify, Archify y Obsidian: NO EJECUTADOS, los publica el Director desde main.

## HANDOFF AL DIRECTOR

Los textos para el OK y el estado van en el mensaje de cierre.
