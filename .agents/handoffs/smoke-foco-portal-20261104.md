# Smoke con sesión real: foco en el Studio y formularios del portal

- **Fecha:** 2026-11-04. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/id-intento-carrera`. **Rama:** `codex/smoke-foco-portal`, desde `main` en `fe35eb2d1`, sin publicar: va después de la publicación de las 12:45Z.
- **Alcance:** registrar el smoke que quedó pendiente en los handoffs de SDD-0537, 0592, 0595, 0596, 0598 y 0599, y corregir la espera de tres pruebas. No cambia el producto.
- **Autorización de Sam, literal, en esta sesión:** «Sí, prueba.dtdcargo.com», a la pregunta de si autorizaba entrar con las cuentas de prueba cuando llegara el turno. El turno lo dio el Director General, después de su `verify`.

## Resultado

**Sobre la imagen `prueba-sha-fe35eb2d1…`, 11:57Z a 12:07Z, con un solo Chromium: 82 PASÓ · 0 FALLÓ · 0 NO EJECUTADO.** Sin defectos de producto.

| Tramo | Resultado | Qué midió |
|---|---|---|
| Studio, `admin` | 23 PASÓ | Foco y Tab con errores reales del servidor o de la base |
| Portal, `DTD-9001` | 47 PASÓ | Cotización y compra con adjuntos: error del servidor, sin red y respuesta perdida |
| Corte de TCP real | 12 PASÓ | Matar el túnel con una subida de 6 MB a medias |

### Studio

| PR y SDD | Panel | Error provocado | Medido |
|---|---|---|---|
| #349, 0537 | `CityDrawer` | Identificador repetido, rechazado por el índice | Foco en el aviso con ratón, primer y segundo error, y con Enter. Tab no sale |
| #350, 0592; #353, 0595 | `TruckDrawer` | Patente de 22 caracteres | Foco en `plate`, inválido. Tab no sale. Con 1,5 s de latencia, Tab sigue dentro durante el envío y al terminar |
| #350, 0592 | `AccountDrawer`, hook directo | Código de cuenta repetido | Foco en un botón del panel, que no marca `aria-invalid`. Tab no sale |
| #350, 0592 | `ConfirmDialog`, «Quitar ruta» | Otra pestaña quitó la tarifa antes de confirmar | Foco en un botón del diálogo. Tab no sale |
| #353, 0595 | `PrestamoDrawer` | Monto 0 | Foco en `principal_usd` tras clic y tras Enter desde Concepto. Tab no sale |

Los conteos de ciudades, camiones, cuentas, préstamos y tarifas vivas quedaron iguales.

### Portal

| SDD | Caso | Medido |
|---|---|---|
| 0596 | Cotización, descripción de más de 2.000 caracteres | Lo escrito sigue y no se registra. Al corregir, una sola |
| 0598 | Cotización y compra, sin red | Aviso con foco y a la vista, sin pantalla de error, lo escrito y el archivo siguen. Al reintentar, una sola, sin decir «Ya estaba» |
| 0599 | Cotización y compra, respuesta perdida | El primer envío sí se registró. El reintento dice «Ya estaba», con el mismo código y sin gastar correlativo. Adjunto una vez. La cotización no manda otro aviso: `mail_logs` 2 → 3 → 3 |
| 0596 | Paso 2, 4 archivos, cajas en 0 | Campos y archivos siguen, y no sube nada. Era lo que faltaba medir en el asistente |
| 0599 | Paso 2, respuesta perdida | Al final `factura=1,foto=2,packing=1,whatsapp=1`, y las cajas corregidas |
| 0598 | Compra, 360x640 | Aviso con foco y a la vista |
| 0599 | Corte de TCP con la subida a medias | El servidor no la registró. Aviso con foco, nota y archivo siguen. Al reintentar, una sola |

Sin errores de página, y 0 líneas de error de estas acciones en el log del web. La entrada por el enlace de `/correo/` dejó en el portal las dos veces.

**Es esperado, no un rojo:** en Nómina lo escrito se borra tras el error. `codex/error-no-borra` no está en este commit.

## Límites

- **Corte con envío pequeño, sin medir:** ni `setOffline` ni matar el túnel llegaron a tiempo, y esos dos casos no midieron el reintento. No distinguí si Chromium reenvió. En ambos quedó una sola compra.
- **Corte de TCP después de que el servidor registró, sin medir:** ese orden solo está medido fallando la respuesta en el navegador, con CDP. Quien pulsó ve lo mismo, `Failed to fetch`; que ese corte equivalga a uno de TCP es inferencia.
- **Error general repetido, solo en `CityDrawer`:** el de `TariffDrawer` y `BulkPriceDrawer` no se puede provocar sin que falle la base. Sigue medido con acciones simuladas.
- **Fuera de este smoke:** lector de pantalla, otros navegadores, y reclamo, mensaje y dirección de la 0599. El paso 2 usó `noValidate`, porque el navegador frena cajas en 0.
- Una sola corrida por tramo: esto no mide intermitencia.

## Qué queda en prueba

De `DTD-9001`: 3 cotizaciones y 5 compras nuevas con sus adjuntos, 6 con la de la semilla. Una tarifa con borrado lógico: las vivas siguen en 169.

## Corrección de pruebas

`verify` del Director General sobre `fe35eb2d1`: `la-accion-lanza.test.tsx:238`, `MagicRequested`, rojo en el primer intento de `test` y verde en el reintento y aislada. No encontró el aviso en la espera de 1 s de `findBy`.

**Causa, inferida:** esa espera se vence con la suite entera corriendo. Al corregir `NewPurchaseWizard` subí la espera de un solo caso y dejé los demás.

| Evidencia | Resultado |
|---|---|
| Volcado del rojo en el `verify` | Botón con `aria-busy="true"` y «revisa tu correo»: el envío seguía en curso, no se perdió |
| La misma espera acortada a 10 ms, sin carga | Mismo estado: no encuentra el aviso, «revisa tu correo», `aria-busy="true"` |
| Tiempo del aviso, sonda sin carga, 1 corrida | 45 ms, con el botón libre al reenviar |
| Lo mismo con 16 procesos de carga, 2 corridas | 116 y 155 ms, con el botón libre. Corté en 2 de 8 para dar el turno del smoke |

**No medí el aviso pasando de 1 s:** las corridas con carga no se acercaron. Por eso sigue siendo inferencia. Si el rojo vuelve con la espera de 5 s, estaba mal.

**El cambio:** `configure({ asyncUtilTimeout: 5_000 })` en `la-accion-lanza`, `conservar-lo-escrito` y `use-action-keeping-draft`. Sale la excepción de `yaEstaba`. Esperar más solo cambia cuánto tarda un rojo.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Smoke, los tres tramos | PASÓ, 82 de 82. Registros en `side-session-notes/local_535053f4-40c2-4124-a280-63f4fc882820/smoke-foco/evidencia/`, fuera de Git |
| ESLint de las tres pruebas | PASÓ |
| `la-accion-lanza` y `use-action-keeping-draft`, un worker, con la espera de 5 s | PASÓ, 46 de 46, 14 s |
| Lo mismo con un mutante del hook: la acción sin atrapar lo que lanza | FALLÓ, como se esperaba: 26 de 46 en rojo, 145 s. Esperar más solo alarga el rojo |
| `conservar-lo-escrito`, un worker | PASÓ, 30 de 30 |
| `docs:check`, `sdd:check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: solo cambian pruebas y documentos |

## FUERA DE ALCANCE DETECTADO

1. **La espera de 1 s es de toda la suite.** Se podría subir en `vitest.setup.ts`, y también alcanzaría a otros archivos. No lo hice: es una decisión que afecta a todos.
2. **`migraciones.test.mjs` y `entorno-prueba-scripts.test.mjs`** agotaron sus 600 s en ese `verify`, en intentos distintos, y aislados pasan. Es lo que lleva a `verify` a exit 1. Ajeno a este cambio.
3. **Nómina sin SDD-0598:** `PrestamoDrawer.tsx:31` usa `useActionState` directo, por lectura. Espera la decisión de Sam sobre `codex/error-no-borra`.

## Impacto documental

Este handoff. Sin spec nueva, y no cambian políticas. Los handoffs de cada SDD quedan como evidencia fechada.
