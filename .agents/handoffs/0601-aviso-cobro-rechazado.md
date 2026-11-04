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
| `tsc` completo sobre `bc69344b6` | PASÓ, exit 0 |
| `pnpm verify` sobre `bc69344b6` | **FALLÓ, exit 1**, solo por el paso `test`. 16 de 17 pasos corrieron. Detalle abajo |
| CI «Calidad local sin secretos» sobre `bc69344b6` | PASÓ. Es el único check de la cabeza |
| El aviso en pantalla | NO EJECUTADO, y **condición antes de publicar**: prueba tiene una sola ranura, reservada para la tanda A, y el Director General decidió no redesplegar por esto |
| Mutantes | NO EJECUTADO |

**Detalle de `verify`,** 2026-11-04, 01:01Z a 01:58Z, con Docker `running` en 51 de 51 muestras:

- **`test`:** FALLÓ en sus dos intentos, por tiempo, con una prueba distinta cada vez, que venció los 600 s: «prueba-migraciones-produccion.sh sale con 0 FALLÓ» (`infra/ops/tests/migraciones.test.mjs`) en el primero y «las pruebas con dobles salen con 0 FALLÓ» (`scripts/__tests__/entorno-prueba-scripts.test.mjs`) en el segundo. Cada intento dio 13.561 pasadas, 1 fallida y 1 omitida. La memoria bajó hasta 1,7 GB libres. No es verde: la prueba de cada archivo sí pasó en el otro intento y aislada.
- **Esos dos archivos aislados,** mismo SHA, con un worker: PASÓ, 30 de 30 en 93,65 s y 2 de 2 en 112,25 s.
- **`migrations-applied`:** NO DISPONIBLE. Dio SKIP porque el worktree no tiene `.env.local`, y no copio secretos. `verify` lo marca como crítico sin medir.
- **`sql-tests`:** PASÓ, 251 contratos. **`schema-rebuild`:** PASÓ, 475 migraciones aplicadas y 18 solo de ledger.
- **`e2e`:** PASÓ, 227 pasadas, 2 flaky y 20 omitidas. Los flaky son `e2e/auth.spec.ts:81` y `e2e/company-photo-carousel.spec.ts:93`, ajenos a cobranzas.
- **`build`, `lint`, `typecheck`, `harness` y el resto:** PASÓ.

## COMMITS

Se leen en la rama.

## PR / BRANCH

Rama publicada y PR en borrador contra `main`, con autorización del Director General. La PR la integra el Director.

## PENDIENTES DE ESTA TAREA

- Cruzar el índice con `main` y publicar este registro: cuando avise el Director General, que hace ese cruce una sola vez al final. `main` ya se movió después de `bc69344b6`, y solo choca `docs/specs/README.md`.
- **Condición antes de publicar:** mirar el aviso en pantalla. NO EJECUTADO. Se mira en la subida de la tanda A, que subirá `main` entero; si la PR ya está en `main` para entonces, se comprueba ahí sin otro despliegue. No redesplegar prueba por esto: orden del Director General, porque prueba tiene una sola ranura y la tanda A la necesita.
- Borrar las dos refs de la reserva 0601: solo cuando la spec esté en `main`, según el procedimiento.
- El claim `worker-aviso-cobro` queda liberado. Antes de tocar la rama: `claim --owner worker-aviso-cobro` y `guard`.

## FUERA DE ALCANCE DETECTADO

- **Clave de idempotencia en `register_collection_receipt`:** no conformidad heredada con ERR-01, por decisión del Director General. Es migración aparte; el aviso solo lo mitiga, pidiendo revisar antes de reintentar.
- **Pantalla para reparar una venta inválida:** no encontré ninguna, así que el administrador que reciba el aviso podría no poder arreglarla sin ayuda técnica. Sam lo vio al aprobar.
- El resto está en la sección «Fuera de alcance» de la spec.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

Spec 0601 e índice de specs. Graphify, Archify y Obsidian: NO EJECUTADOS, los publica el Director desde main.

## HANDOFF AL DIRECTOR

Los textos para el OK y el estado van en el mensaje de cierre.
