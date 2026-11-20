# Handoff — SDD-0695 datos duplicados y fuentes únicas

- **Owner:** Worker `datos-duplicados-9e6364`, sesión hija de Dir_DTD.
- **Ruta:** `.claude/worktrees/datos-duplicados-9e6364`.
- **Rama:** `claude/datos-duplicados-9e6364`, sobre la reserva `codex/sdd-reserve-0695` (9b00a1665).
- **Objetivo:** el encargo de Sam del 2026-11-20 tiene tres partes: un diagnóstico de los datos duplicados
  o viejos, recomendaciones para que no vuelva a pasar y la spec. Esto es la fase 1 (diagnóstico) y la
  fase 2 (spec).
- **SDD:** 0695, asignada por Dir_DTD. Está relacionada con la 0694 (PR #725, ahora de este Worker) y con
  la 0696 (dirección del cliente final de un aliado, reservada, que va después).
- **Permisos del encargo:**
  - solo lectura del código;
  - conteos agregados de producción, con el OK previo de Dir_DTD;
  - publicar la rama y una PR en **borrador**.
  - No incluye migraciones, arreglos de datos, merges, `pnpm install`, vitest ni `pnpm verify`.

## Hecho

- Medición en `main` (6a7787d08; la reserva 9b00a1665 no cambia código) de D-1 a D-10, con archivo:línea (spec §2). Tres subagentes de solo
  lectura midieron D-3 a D-6 y D-9, y este Worker comprobó por muestreo las líneas de mayor riesgo:
  - `0077:70`;
  - `fiscal/queries.ts:225-226`;
  - `reports/queries.ts:740`;
  - `dashboard-kpi-queries.ts:57`;
  - la ausencia de `person_id` en `/registro` y en el Studio;
  - `updateClientAction` sin propagación;
  - la ausencia de `exc0674` en `rename_client_markbox`;
  - el alta del Studio sin búsqueda de duplicados.
- Spec `docs/specs/0695-datos-duplicados-fuentes-unicas/spec.md`, en estado `proposed`.
- Conteos de producción: son 21 consultas (Q1 a Q21), con 25 sentencias. El SQL vive fuera del repo, en
  las notas de Dir_DTD. Dir_DTD lo revisó y lo corrió el 2026-11-20, en una sesión de solo lectura. Los
  números se quedaron en el chat. En la spec §3 solo va la lectura cualitativa.

## Validación

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `node scripts/check-numbering.mjs` | PASÓ |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio es solo de docs y el encargo no da turno de PC |

## Pendientes de esta tarea

1. Las respuestas de Sam a P-1 a P-8 (spec §9), una por una. La primera es la P-7 (prioridad).
2. Que la revisión independiente apruebe la #728.
4. Las correcciones de revisión de la #725 (SDD-0694), cuando lleguen.

## Fuera de alcance detectado

- `next_receipt_code(uuid)`: la 0079:90 redefine con la misma firma la función de la 0008:150 (WR de China
  frente a R de cobros). Es una colisión de nombre ya documentada en `cn/actions.ts:164`.
- Varias cabeceras de migración dicen «NO APLICADA A PRODUCCIÓN» (0506, 0513, 0551, 0552, 0559, 0562 y
  0566), pero `migrations-baseline.json` no tiene pendientes. Conviene que Dir_DTD compare las cabeceras
  con el ledger.
- `warehouse_receipts_ve.eta` casi no tiene escritor: `createReceiptVe` no tiene llamadores
  (`naviera/actions.ts:548-549`).

## Impacto documental

- Spec nueva y el índice `docs/specs/README.md`.
- La F-1 propone un documento vivo nuevo, `docs/architecture/fuentes-unicas.md`. Todavía no se crea:
  depende de que Sam apruebe la spec.

## Revisión independiente (2026-11-20, sobre 3b9933453): CHANGES_REQUESTED, corregida

- **3. Repo público.** El escenario de acceso con un correo anterior salió de la spec en c96d2eb12, con un
  commit normal. Ahora está en la nota privada `sdd-0695-correo-de-acceso-NO-GIT.md`, en la carpeta de notas
  de Dir_DTD, fuera del repo. La P-2 está replanteada.
- **1. Correo.** La §4.5 usa una sola semántica, la de la 0559 (verificada en `0559:704-713` y
  `app/entrar/actions.ts:233-244`): el correo anterior deja de entrar en el acto. Las cuentas sin fila en
  `client_email_checks` reciben esa fila antes del cambio. La spec llama trigger al trigger. La aceptación 5
  cubre la cuenta invitada.
- **2. Solape con la 0694.** La §5 tiene la tabla de dueñas:
  - la guardia de la dirección es de la 0694;
  - `merge_clients` es de la 0694 F-2, y la F-6 va después;
  - `clientCompleteness` es de la 0694 F-1, y la F-8 va después.

  La P-9 salió: la cerró la decisión 8 de la 0694.
- **4. Referencias.**
  - Los 17 defaults quedaron listados en la spec.
  - Las consultas Q están descritas en la §3, con su lectura cualitativa.
  - «21 consultas, 25 sentencias».
  - La cita de la 0576 está corregida.
  - `shipment_rate_snapshots` queda aclarado.
- **5. Gobernanza.**
  - CAL-01 y DAT-01 son no conformidades del código actual, y las corrige la spec. NUM-01 no aplica.
  - La allowlist es exacta para F-0 a F-6. La F-7 y la F-8 necesitan un inventario previo.
  - La aceptación 3 se prueba por capa: SQL y TypeScript.
  - La aceptación 2 tiene casos negativos permanentes.
  - La F-2 tiene plan B.
- **6.** La validación dice PASÓ. Los correlativos se cuentan como «una veintena de funciones», con el conteo
  crudo de apariciones y archivos.
- **Conteos.** Q20 y Q21 dieron cero: la F-2 queda como **preventiva**. Q9 muestra daño actual, y la F-3 puede ir
  en paralelo.

## Pedido de Dir_DTD (2026-11-20): regla de una predeterminada

- Se agregó la §4.10 y la fase F-9: un constraint trigger diferido que exige una predeterminada cuando
  hay filas vivas, y el traspaso al borrar. La aceptación es la 9.
- Arreglar las fichas actuales sin predeterminada es una operación de datos aparte, con el OK nominal de
  Sam. En la spec solo va el diseño.

## Tercera vuelta (sobre a1aacbf17), corregida

- **1. §4.5.** La fila se crea con `pending_email` igual al correo **anterior**, y después se hace el update al
  nuevo. Es la secuencia que verifiqué contra `0559:714-731`. Las dos cosas van en una RPC de una sola
  transacción. La aceptación 5 trae un `.test.sql` con un caso de control.
- **2 a 5. §4.10 y F-9.**
  - La F-9a lleva el cambio de predeterminada a una RPC atómica y pasa Mi perfil y la tarjeta del Studio a
    usarla.
  - La F-9b trae los triggers:
    - `before insert` para marcar la primera fila;
    - `after update of deleted_at` para promover otra al borrar;
    - un constraint trigger diferido que se limita a `is_default`, `deleted_at` y `client_id`, revisa
      `old` y `new`, y es `security definer`;
    - un preflight que aborta si queda algún cliente sin predeterminada.
  - El arreglo de esas fichas va aparte y lleva el OK nominal de Sam.
- **6.** Los conteos de la spec dicen solo «hay» o «no hay». Q12 y Q17 aparecen como «medido».
- **7.** La tabla de dueñas tiene filas para la persona de la ficha fusionada y para la regla de la
  predeterminada. La tabla se cita en la 0694.

## Cuarta vuelta (sobre 70511ef4c), corregida

- **F-9a.** La RPC `client_delivery_address_save` cubre el alta, la edición y la elección de predeterminada.
  También cubre `updateAddressAction` del portal (`address-actions.ts:89-92`). Desmarcar la única
  predeterminada se rechaza con un error de campo, y si el cambio afecta cero filas da error. Tiene
  `revoke` de public y anon, y `search_path` fijo.
- **El correo.** La RPC `client_email_change_service` es `security definer` y solo la ejecuta
  service_role (`0559:145`). Crea la fila y hace el update en la misma transacción.
- **El preflight.** Hace `lock table` en la misma transacción y el error solo lleva el conteo.
- **Los triggers.** El `before insert` y la promoción son invoker, y el chequeo es el único definer. La
  promoción lleva `when` y limpia `is_default` de la fila borrada.
- **La persona fusionada.** La F-3 decide sin tocar `merge_clients`: con una sola persona rige el
  `coalesce` de siempre, y con dos queda marcada en `persona_por_revisar` para la oficina.
- **Plan B de la F-2.** Dice quién avisa y dónde queda escrito. La allowlist pone la F-9 después de la F-8.

## Quinta vuelta (sobre 343a36dec), corregida

- **Mi perfil.** `addAddressAction`, con su rama «misma dirección», `updateAddressAction` y
  `setDefaultAddressAction` pasan a la RPC. La prueba de contrato prohíbe `setDefaultDeliveryAddress` y
  `clearDefaultForClient` fuera de ella.
- **La fila borrada.** Un `before update` limpia `is_default` en la misma fila y un `after` promueve la
  siguiente. La aceptación 9 corre con `set role authenticated`.
- **El correo.** `p_actor` llega por `set_config('request.jwt.claim.sub', …, true)`, así que el audit
  registra al operador. La RPC es la única que escribe `clients.email` en ese flujo.
- **`persona_por_revisar`.** Pasa a la F-3 como la vista mínima `client_person_review`.
- **Plan B.** El aviso está en la allowlist de la F-2 (`facturacion/page.tsx` y `Aviso.tsx`).

## Sexta vuelta (sobre 4c91ef618), corregida

- **Un solo camino de escritura.** Las RPC `client_delivery_address_save` y `_service` nacen en la 0694 F-2.
  La F-9a mueve a ellas el resto de los llamadores, y la prueba de contrato no deja excepciones para la
  0694. Las dos tablas de dueñas quedaron actualizadas (la 0694 va en 04de4d326).
- **`p_actor`.** Se valida en la RPC: no puede ser nulo ni de otro tenant, tiene que tener permiso y tiene
  que existir. Sale de `auth.getUser()` después de `moduleEditDenial`.
- **`set_config`.** Hay una prueba en una segunda transacción, con la definición real de `auth.uid()`.
- **Correo vacío con acceso activo.** Se rechaza.

## Aprobación de Sam (2026-11-20)

- Sam escribió «Apruebo la 0695». La spec pasa a `status: approved`. La PR #728 sigue sin fusionar: la integración es de Dir_DTD.
