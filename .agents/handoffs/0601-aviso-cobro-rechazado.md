# SDD-0601 · aviso del cobro no registrado

Owner: `worker-aviso-cobro` · Rama: `codex/0601-aviso-cobro-rechazado` · Worktree: `DTD-worktrees/0601-aviso-cobro-rechazado` · Base: `3f3749cc3` · Fecha: 2026-11-03

## OBJETIVO ORIGINAL

Sam, literal, transmitido por el Director General: «Mejorarlo antes de usar el ERP», sobre «No se pudo registrar el cobro.». Encargo: SDD y rama nuevas, que el aviso diga por qué y a quién acudir, y traer la frase exacta para pedirle OK antes de publicarla. Número tomado con el inventario.

## COMPLETADO

- **Reserva:** `sdd:next --reserve aviso-cobro-rechazado --expect 0601`. Las dos refs son locales; no se publicaron.
- **Medición en prueba:** el motivo real llega con HTTP 400 y código `23514`, y la factura no cambia. Detalle en la spec.
- **Código:** `avisoDeCobroNoRegistrado` en `lib/studio/collections-actions.ts`, con tres avisos. Los textos están en la spec.
- **OK de Sam a los textos:** literal, «Apruebo las tres», en el chat de Director General, 2026-11-03 ~18:05Z, viendo las tres frases exactas y la excepción a ERR-01. También vio el aviso de que hoy no existe pantalla para reparar esa factura. Lo transmitió el Director General y se registra a su nombre.
- **Decisiones del Director General:** la excepción a ERR-01 queda aceptada para este aviso, declarada en la spec con su alcance. La falta de clave de idempotencia y la pantalla de reparación van abajo, en «FUERA DE ALCANCE DETECTADO».
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
| `tsc` y `verify` | NO EJECUTADO: esperan el turno del Director General, detrás de `/entrar` |
| El aviso en pantalla | NO EJECUTADO, y **condición antes de publicar**: prueba tiene una sola ranura, reservada para la tanda A, y el Director General decidió no redesplegar por esto |
| Mutantes, Docker | NO EJECUTADO |

## COMMITS

Se leen en la rama.

## PR / BRANCH

Rama publicada y PR en borrador contra `main`, con autorización del Director General. La PR la integra el Director.

## PENDIENTES DE ESTA TAREA

- `tsc`, `verify` y las pruebas fuera de este archivo: NO EJECUTADO. El turno va detrás de `/entrar`, y avisa el Director General. Traer `main` en ese turno, una sola vez.
- **Condición antes de publicar:** mirar el aviso en pantalla. NO EJECUTADO. Se mira en la subida de la tanda A, que subirá `main` entero; si la PR ya está en `main` para entonces, se comprueba ahí sin otro despliegue. No redesplegar prueba por esto: orden del Director General, porque prueba tiene una sola ranura y la tanda A la necesita.
- Borrar las dos refs de la reserva 0601: solo cuando la spec esté en `main`, según el procedimiento.
- El claim `worker-aviso-cobro` queda liberado hasta el turno. Antes de tocar la rama: `claim --owner worker-aviso-cobro` y `guard`.

## FUERA DE ALCANCE DETECTADO

- **Clave de idempotencia en `register_collection_receipt`:** no conformidad heredada con ERR-01, por decisión del Director General. Es migración aparte; el aviso solo lo mitiga, pidiendo revisar antes de reintentar.
- **Pantalla para reparar una venta inválida:** no encontré ninguna, así que el administrador que reciba el aviso podría no poder arreglarla sin ayuda técnica. Sam lo vio al aprobar.
- El resto está en la sección «Fuera de alcance» de la spec.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

Spec 0601 e índice de specs. Graphify, Archify y Obsidian: NO EJECUTADOS, los publica el Director desde main.

## HANDOFF AL DIRECTOR

Los textos para el OK y el estado van en el mensaje de cierre.
