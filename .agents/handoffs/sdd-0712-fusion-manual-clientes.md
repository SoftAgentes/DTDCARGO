# Handoff — SDD-0712 búsqueda amplia y fusión manual de clientes (2026-11-23)

- **Encargo:** de Dir_DTD, pedido de Sam del 2026-11-23. Aprobación textual de Sam sobre la propuesta dibujada
  (incluidos ⇄ y «Códigos anteriores»): «Sí, apruebo».
- **Rama:** `sdd-0712-fusion-clientes-v2` · reserva `refs/dtd/reservations/0712`. Carril **con revisión previa**.
- **Reemplaza a la PR #797**, que se cierra sin fusionar. Sus pruebas llevaban datos con pinta de reales; Sam
  decidió (textual, vía Dir_DTD) «Limpiar del todo (Recomendado)». Esta rama se rehízo desde `main` en commits que
  nunca tuvieron esos datos. La purga del historial de la PR vieja en GitHub la pide Sam.
- **Migración 0572: ESCRITA, NO APLICADA.** Pide el OK nominal de Sam y el runbook de producción.
- **🔴 Orden de salida:** aplicar la 0572 ANTES de publicar la web con esta PR. `DuplicadosClient` ya no llama a
  `merge_clients`; sin la 0572, «Posibles duplicados» no busca ni fusiona.

## Qué entrega

- Migración `0572_fusion_manual_clientes.sql`: `norm_busqueda`, `client_codigos_familia` (interna),
  `client_search_for_merge`, `client_merge_preview`, `merge_clients_manual`. **No** reescribe `merge_clients` (0361).
- **Quién fusiona** (Sam, textual: «Admin, Operaciones y Comercial»): lo exigen la RPC y la acción del servidor.
  Buscar y ver la vista previa siguen abiertos a la matriz `clients`.
- Búsqueda por Shipping Mark (vigente, renombrados y de fichas fusionadas), nombre parcial, teléfono, correo y
  documento; sin acentos, mayúsculas ni separadores.
- Panel a la derecha (`DrawerShell`): datos de cada ficha para compararlas, en qué coinciden, conteos sin montos
  (incluyen códigos anteriores) y avisos: nada en común, solo por nombre, acceso al portal que se revoca, se pierde
  o se muda, documento/correo/teléfono que no pasan. ⇄ invierte cuál se queda.
- Para fusionar: motivo (queda en auditoría) y escribir el Shipping Mark que se anula.
- El panel dice el estado del portal de cada ficha: con acceso, invitado sin entrar, revocado o sin acceso.
- Los errores de las RPC se registran solo con su código, sin el mensaje (puede llevar el Shipping Mark).
- «Códigos anteriores» de la ficha suma los códigos de fichas fusionadas.

## Evidencia (PASÓ / FALLÓ / NO EJECUTADO)

- Contrato SQL de la 0572 en PGlite (cadena real 0341→0351→0358→0361→0572): PASÓ, 17/17: verde con 58 aserciones,
  rojo sin la 0572 y 15 mutantes que mueren con su aserción (entre ellos: contabilidad y soporte fusionan, comercial
  u operaciones dejan de fusionar, una invitación sin usar cuenta como acceso, la búsqueda sin tenant, aliados,
  comodines, el aviso de portal que calla, códigos renombrados y de fichas fusionadas).
- El mismo contrato en Postgres real: PASÓ en el CI («Contratos SQL en Postgres desechable») sobre f295f992b.
- Espera declarada: `supabase/migrations-baseline.json › pendingBelowCutoff` y
  `supabase/pending-migration-symbol-declarations.json`. Gate de símbolos: 0 ROJO, 1 AMARILLO (las tres RPC de la
  0572 en `clientes/merge-actions.ts`).
- `rbac-actions-guard.test.ts`: PASÓ. Inventario 503 → 505; EXCEPCIONES 24 → 26 (búsqueda y vista previa: solo leen,
  `moduleViewDenial` al tope, RPC `stable`), aceptado por Dir_DTD.
- `tsc --noEmit`, `eslint` de lo tocado, pruebas puras y estática de la migración, archivos `contract`: PASÓ.
  `pnpm sdd:check`, `pnpm docs:check`: PASÓ.
- Contrato en Postgres desechable (Docker): NO EJECUTADO en la PC; corre en el CI.
- `pnpm verify` completo: NO EJECUTADO (el portón es el CI).
- Interfaz en navegador y pruebas de componente: NO EJECUTADO. Se revisó por lectura con `/ui-check`.
- Auditoría: leído el contrato real (0267/0294), el evento `client_merge_manual` lo cumple. El contrato usa dobles
  para `append_audit_event` y para el trigger de la 0455: el trigger real NO se ejercitó.
- `revisar-datos-ve` sobre la PR: NO EJECUTADO por mí; le toca al revisor.

## Dato de producción (medido por Dir_DTD, no por esta sesión)

Con autorización de Sam, Dir_DTD corrió una consulta de solo conteo: la ficha del ejemplo de Sam tiene 1 código
anterior en `client_markbox_history`. Por tanto ya aparece en «Códigos anteriores» de su ficha. No se leyó el código.

## Pendiente de esta tarea

- Aplicar la 0572 en producción (OK nominal de Sam) y después publicar.
- Pasar `status` de la spec a `approved` cuando Sam lo indique.

## Pendientes para Sam (escritos en la spec, no cambiados)

- `merge_clients(uuid, uuid)` sigue ejecutable por `authenticated` con cinco roles: por la API se fusiona sin motivo ni
  confirmación, y contabilidad y soporte aún pueden por esa vía.
- La 0361 revoca un acceso vivo al portal si la ficha que se queda tiene una fila revocada. Aquí solo se avisa.

## FUERA DE ALCANCE DETECTADO

- Los códigos de fichas fusionadas salen sin fecha: `merge_clients` no la guarda.
- La búsqueda recorre todos los clientes del tenant y arma la familia de códigos por ficha, sin índice propio. Bien
  para miles de fichas; medir si la base crece.
- La fusión no se deshace desde el Studio.
