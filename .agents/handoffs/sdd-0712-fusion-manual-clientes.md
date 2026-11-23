# Handoff — SDD-0712 búsqueda amplia y fusión manual de clientes (2026-11-23)

- **Encargo:** de Dir_DTD, pedido de Sam del 2026-11-23. Aprobación textual de Sam sobre la propuesta dibujada
  (incluidos el botón ⇄ y el bloque «Códigos anteriores»): «Sí, apruebo».
- **Rama:** `sdd-0712-fusion-manual-clientes` · reserva `refs/dtd/reservations/0712`. Carril **con revisión previa**
  (migración + escritura de datos personales).
- **Migración 0572: ESCRITA, NO APLICADA.** Aplicarla pide el OK nominal de Sam y el runbook de producción.
  No se leyeron filas de producción.

## Qué entrega

- Migración `0572_fusion_manual_clientes.sql`: `norm_busqueda`, `client_search_for_merge`, `client_merge_preview`,
  `merge_clients_manual` (motivo 4–1000, escribir el Shipping Mark que se anula, `dtd.audit_reason` + evento
  `client_merge_manual`). **No** reescribe `merge_clients` (0361).
- Studio: pestaña «Buscar y fusionar», panel a la derecha (`DrawerShell`) con ficha que se queda, la que se anula,
  vista previa sin montos y avisos, ⇄ para invertir; los pares detectados usan el mismo panel; «Códigos anteriores»
  de la ficha suma los códigos de fichas fusionadas.

## Evidencia (PASÓ / FALLÓ / NO EJECUTADO)

- `tsc --noEmit`: PASÓ. `eslint` de lo tocado: PASÓ (0 avisos tras quitar setState síncronos en efectos).
- `vitest` del contrato de la migración sobre PGlite (`fusion-manual-clientes.pglite.test.ts`): PASÓ, 9/9:
  verde (46 aserciones, cadena real 0341→0351→0358→0361→0572), rojo sin la 0572 y 7 mutantes que mueren con su aserción.
  Casos: búsqueda sin acentos/parcial por Shipping Mark (vigente y anterior), nombre, teléfono, correo y documento;
  comodines como texto; otro tenant, aliado, borrado y fusionado fuera; vista previa sin montos; rechazos (Shipping
  Mark mal tecleado, motivo corto, misma ficha, otro tenant, aliado, rol sin permiso); auditoría con motivo humano y
  ajuste restaurado; esposos con portal (se revoca uno); anon sin EXECUTE.
- `vitest` de `client-merge-manual`, estática de la migración, `markbox-history-types`, `client-codigos-ficha` y los
  50 archivos `contract` (733 pruebas): PASÓ. `pnpm sdd:check` y `pnpm docs:check`: PASÓ.
- `pnpm verify` completo: NO EJECUTADO (el portón es el CI, indicado por Dir_DTD).
- Doble de la auditoría: el contrato sustituye `append_audit_event` y el trigger de la 0455 por dobles que anotan lo
  recibido y el `dtd.audit_reason` visto al retirar la ficha. El trigger real de la 0455 NO se ejercitó aquí.
- Interfaz (`FusionPanel`, `BuscarYFusionar`, `DuplicadosClient`): sin prueba de componente ni revisión visual en
  navegador. NO EJECUTADO. Conviene mirarla con `/ui-check` antes de publicar.
- Un bug real salió en el contrato: `array || 'texto'` en la vista previa; corregido con `array_append(... ::text)`.

## Revisión posterior (2026-11-23, pedida por Sam)

Segunda pasada sobre la migración y la interfaz, con `/ui-check`. Encontró y corrigió:

- **El aviso del portal podía mentir.** La vista previa decía «el acceso pasa a la que se queda» cuando la ficha que se
  queda tenía una fila de portal REVOCADA: `merge_clients` (0361 §5.1) mira si hay fila, no si está activa, y en ese
  caso revoca el acceso vivo. Ahora la vista previa calca esa regla y avisa `portalLost` («nadie queda con acceso;
  usa Invertir»). El contrato lo comprueba contra la fusión real.
- **Dos personas sin nada en común pasaban sin aviso** (justo el caso de los esposos), y dos fichas con el mismo nombre
  y sin teléfono ni correo no se marcaban como «solo por nombre». Ahora hay `nothingInCommon` y `sameNameOnly` se
  calcula sobre coincidencias reales.
- **El panel no dejaba comparar.** Solo decía «tiene documento / correo». Ahora muestra documento, correo, teléfono y
  fecha de creación de cada ficha (lo mismo que el listado de Clientes), y en qué coinciden.
- **Búsqueda sin separadores:** «DTD9001», «dtd 9001» y «V19695856» ahora encuentran «DTD-9001» y «V-19695856».
- **CI:** al contrato le faltaba el valor por defecto de `apply_fix` (psql lo exige; PGlite no): corregido.
- Interfaz: el buscador se reinicia tras fusionar, se ve cuál resultado está elegido, «Buscando…», tope de 25
  avisado, `Aviso` para el error, ayuda bajo el campo de confirmación, «⇄ Invertir» con texto.

Evidencia tras la revisión: contrato en PGlite 12/12 (52 aserciones, rojo y 10 mutantes), `tsc`, `eslint` de
`clientes/`, y 53 archivos de pruebas (776) en verde. Sigue NO EJECUTADO: revisión en navegador y `pnpm verify`.

Comprobado leyendo la 0267/0294: el evento `client_merge_manual` cumple el contrato real de `append_audit_event`
(tipo `client` activo, `event_type` y `correlation_id` válidos, sensibilidad `restricted`, sin claves prohibidas).
El trigger de la 0455 sigue sin ejercitarse de verdad.

Hallazgos que NO se corrigieron (decisión de Sam o del Director):

- `merge_clients(uuid, uuid)` sigue con EXECUTE para `authenticated`: por la API se puede fusionar sin motivo ni
  confirmación. Es anterior a esta tarea; cerrarlo es reescribir permisos de la función viva.
- La regla de `merge_clients` que revoca un acceso vivo porque la otra ficha tiene una fila revocada parece un defecto
  de la 0361. Aquí solo se avisa; arreglarlo es otra migración.
- Los conteos de embarques y facturas de la vista previa usan el Shipping Mark vigente de cada ficha, no sus códigos
  anteriores: pueden quedar cortos en fichas con historial.
- La búsqueda recorre todos los clientes del tenant sin índice. Bien para miles; a revisar si crece.

## Impacto documental

- Spec `docs/specs/0712-fusion-manual-de-clientes/spec.md` (draft) e índice `docs/specs/README.md` regenerado.
- Revisión `revisar-datos-ve` (fusionar es escritura de datos personales): el Director/revisor debe correrla sobre la
  PR; no la corrí como skill. Puntos a mirar: motivo y fusión quedan en auditoría; no hay montos ni PII en Git.

## Pendiente de esta tarea

- Aplicar la 0572 en producción: solo con OK nominal de Sam.
- El código anterior de Legacy del DTD-8221: Dir_DTD lo pide a Sam como consulta autorizada; si no está en
  `client_markbox_history`, habría que recuperarlo de otra fuente (el bloque «Códigos anteriores» ya lo muestra
  cuando exista).
- Pasar `status` de la spec a `approved` cuando Sam lo indique.

## FUERA DE ALCANCE DETECTADO

- «Códigos anteriores» de fichas fusionadas salen sin fecha: `merge_clients` no la guarda. Si Sam la quiere, hay que
  registrar la fusión en `client_markbox_history` (cambio en la función viva, aparte).
- La fusión no deshace: no existe restauración desde el Studio (`recovery: no_studio_restore`).
