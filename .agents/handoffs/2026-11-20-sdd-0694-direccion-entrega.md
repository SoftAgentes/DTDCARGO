# Handoff — SDD-0694, dirección de entrega (spec) — 2026-11-20

- **Owner:** Worker (Claude), sesión `worker-sdd-0694`. Lo asignó Dir_DTD.
- **Ruta:** `.claude/worktrees/agent-a87f6d5db08e82972`.
- **Rama:** `claude/sdd-0694-direccion-entrega`, creada desde `origin/main` 87ff55598.
- **Objetivo:** escribir **solo la spec** de la SDD-0694 para que Sam la apruebe. No hay código, ni migración,
  ni cambio de producto.
- **SDD:** `docs/specs/0694-direccion-de-entrega-faltante/spec.md`, con el número reservado en
  `codex/sdd-reserve-0694`. Queda en estado `proposed`.
- **Permisos del encargo:** push de la rama propia y PR en borrador. Sin merge, sin producción, sin `pnpm`.

## COMPLETADO

- La spec, con:
  - la medición con archivo:línea de las **cuatro** fuentes (`clients.address`, `client_delivery_addresses`,
    `clients.city`/`state` y `clients.address_reference`);
  - la tabla de escritores y lectores, con el cambio de cada uno;
  - las decisiones de Sam;
  - las fases, con F-1 = camionero, fila «Dirección» y «Perfil del cliente»;
  - el botón «Pedir», los avisos A-1 y A-2 (con la plantilla de Meta propuesta), `revisar-datos-ve`, la
    aceptación, la allowlist provisional y la gobernanza.
- Están incorporadas las dos correcciones de Dir_DTD que llegaron durante el trabajo:
  - la P-4 decidida por Sam;
  - las cuatro fuentes.

  Todas sus citas se verificaron. La única que se ajustó: la RPC `_complete_self` va en `0562:594-596` y
  `:611-613`.
- El índice `docs/specs/README.md` está regenerado.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ, tras regenerar el índice. La primera corrida FALLÓ por el índice desactualizado. |
| `node scripts/check-numbering.mjs` | PASÓ. Solo reporta los choques históricos ya conocidos. |
| `node scripts/build-governance-capsule.mjs --check` | PASÓ |
| `git diff --check` | PASÓ |
| `pnpm verify` y las pruebas de producto | NO EJECUTADO: el cambio es solo de docs, y el encargo prohíbe `pnpm`. |

## Evidencia y hallazgos clave

- **Ningún registro escribe la tabla nueva.**
  - El registro por enlace (RPC 0552/0562) escribe `clients.address`.
  - El del Studio también: `clientes/actions.ts:245`, `:392`.
- **El camionero lee la fuente vieja.** `dispatch-mobile-queries.ts:163`, `:199-200`.
- **La fusión pierde la ciudad y el estado.** `0361` no los toca.
- **«Perfil del cliente» lee `clients.address`.** Verificado en `client-types.ts:426`, a través de `page.tsx:292`.
- **El importador `legacy_import` no está en el repo.** No aparece en el código ni en el historial. Es NO VERIFICABLE.
- **El teléfono no está validado.** El registro solo exige que no esté vacío (`register-types.ts:256-257`).
  Se reutiliza `normalizeWhatsappPhone` (`quote-types.ts:399`).
- **No hay código que mande plantillas de WhatsApp.**

## Segunda vuelta (2026-11-20): decisiones nuevas de Sam

Llegaron por mensaje de Dir_DTD y van en la spec, con su cita y la fecha:

- **P-5 «En la primera compra»:** es la §4.6 y la fase nueva E-1. Se exige en el portal, al crear la compra o la
  prealerta, y lo valida el servidor. El Studio avisa sin bloquear al consolidar.
- **P-6 «Correo del sistema»:** está en la §4.4.
- **Dirección rápida opcional en el paso 2 del registro:** es la §4.7, en la fase F-2 junto con las RPC de
  enlace. Lleva sus criterios 10 y 11 y su allowlist.
  - También ajusta `app/privacidad/page.tsx:82` en F-2, y ese cambio va al DG antes.
- **P-7 «Dejarlos y mostrarlos»:**
  - es la fila nueva «Ciudad de entrega» en la ficha (F-1);
  - la fusión conserva la ciudad y el estado;
  - moverlos a la tabla queda fuera de alcance, para la SDD de datos duplicados.

## Tercera vuelta (2026-11-20): P-8 y cierre de las preguntas

- **P-8 «Usar el domicilio sellado».**
  - Es la decisión 9 de la §3 de la spec.
  - En la §4.2, el comprobante HTML del portal lee `invoices.client_fiscal_address` de esa factura (sellado
    por la 0466, `:315`), el mismo dato que el PDF (`invoice-client-doc.ts:69-84`).
  - Su aceptación es el punto 6 de la §7, con la prueba en `comprobante/page.test.tsx`. Su allowlist está en
    la §10, F-2.
- **La §9 queda cerrada:** las ocho preguntas están contestadas.
- **Condición previa a publicar el campo del registro.**
  - Antes hay que ajustar `app/privacidad/page.tsx:82`, y ese cambio va al DG.
  - Está en el encabezado de la spec, en la §4.7, en la fila F-2 de la §5 y en el punto 10 de la §7.

## Cómo retomar la #725 desde otra sesión

Sam quiere que el tema de las direcciones siga en una sesión aparte. Esta sesión termina aquí.

- **PR:** #725, en borrador, contra `main`. **Rama:** `claude/sdd-0694-direccion-entrega`. La cabeza es la
  que dice `git log -1` en `origin/claude/sdd-0694-direccion-entrega`.
  - Tiene un merge de `origin/main` que hizo otra sesión (`18f8d392c`). Se conserva.
- **Estado:**
  - la spec está en `proposed` y solo trae docs;
  - las ocho preguntas están contestadas;
  - falta el OK de Sam a la spec entera.
- **Al retomar:**
  1. Crea tu propio worktree desde la rama. Este worktree, `.claude/worktrees/agent-a87f6d5db08e82972`, es
     de otra sesión: no lo uses ni lo borres. Haz claim con tu sesión.
  2. Con el OK de Sam, pasa el `status` de la spec a `approved` y escribe la cita del OK arriba, como en la
     0689.
  3. Corre los checks con node: `build-docs-index.mjs --check`, `check-numbering.mjs` y
     `build-governance-capsule.mjs --check`. Después, `gh pr ready 725` para que corra el CI.
  4. **Para implementar F-1**, que es la prioridad (camionero, fila «Dirección», «Ciudad de entrega» y
     «Perfil del cliente»):
     - pídele a Dir_DTD el número de la migración de copia;
     - va en una tarea Worker aparte, con su propia rama, no en esta PR de spec;
     - la copia se aplica a producción solo con el OK nominal de Sam y el runbook.
  5. **Antes de F-2** (la dirección rápida del registro): el ajuste de `app/privacidad/page.tsx:82`, con el
     visto bueno del DG.
- **Lo que queda abierto fuera de la spec:**
  - ubicar el importador `legacy_import`, que vive fuera del repo;
  - la búsqueda de Dir_DTD de otros datos duplicados.

## PENDIENTES DE ESTA TAREA

- El OK de Sam a la spec y `gh pr ready 725`. En borrador, el CI no corre.

## FUERA DE ALCANCE DETECTADO

- **Otros datos duplicados.** Van con la búsqueda aparte de Dir_DTD.
- **El importador `legacy_import`.** Hay que ubicarlo fuera del repo para que deje de escribir `clients.address`.
- **`composeAddress`.** `lib/portal/register-types.ts:335` no tiene llamadores fuera de las pruebas: es código
  muerto.
- **El comentario de `app/registro/actions.ts:234-238`.** Dice que la dirección se pide «antes de la 1ª
  compra», y nada lo exige.
- **Nominatim.** No consta que la política pública lo liste como tercero: es NO VERIFICABLE y se revisa en F-2.

## Impacto documental

- Spec nueva e índice regenerado.
- No cambian documentos canónicos.
- **Ya decidido:** como Sam exige la dirección en la primera compra (P-5) y el registro la pide de forma
  opcional, `app/privacidad/page.tsx:82` se ajusta antes de publicar el campo. Ese cambio va al DG.
- A-2 también requiere revisar la política.

## HANDOFF AL DIRECTOR

- La PR es en borrador y trae solo docs.
- Para implementar F-1 hacen falta:
  - el número de la migración de copia;
  - el OK de Sam a la spec.

## Retomada por el Worker de la 0695 (2026-11-20)

- Dueño de las correcciones de revisión, por asignación de Dir_DTD. Trabaja en el worktree
  `DTD-worktrees/sdd-0694-revision` (rama local `codex/sdd-0694-revision`) y publica en
  `claude/sdd-0694-direccion-entrega`.
- Se citó en la §8 la tabla de dueñas compartida con la 0695 (#728). La ciudad y el estado quedan cerrados
  por la decisión 8.
- Validación: `docs:check`, `check-numbering` y `git diff --check` PASARON. `pnpm verify` NO EJECUTADO
  (solo docs).

## Revisión sobre c3f81665b (CHANGES_REQUESTED), corregida salvo el punto 1

- **1.** La P-8 y el domicilio sellado que queda null en el caso común: **no se tocó**. Dir_DTD le pregunta
  a Sam y pasa la respuesta.
- **2.** El aviso de dirección faltante es solo para VE. La región `cn` no admin no lo recibe y, como mucho,
  ve un marcador neutro (§4.6 y §7.11).
- **3.** El límite de 24 h usa la tabla `client_data_requests` y la RPC `client_data_request_claim`, con
  advisory lock e insert condicional. Las pruebas están en §7.7.
- **4.** `createPrealertaAction` es la única acción que crea la compra (el paso 1 del asistente). La
  dirección se pide antes y la acción la exige antes de insertar.
- **5.** Los consumidores de `PortalClient.address` quedaron medidos y anotados en la allowlist de la F-2.
- **6.** La base es `af0f635ad`. Se mergeó `origin/main` en la rama, sin reescribir la historia.
- Validación: `docs:check`, `check-numbering` y `git diff --check` PASARON. `pnpm verify` NO EJECUTADO.
- **Punto 1 (P-8), resuelto el 2026-11-20:** Sam decidió «Como QuickBooks: dos direcciones». Aquí el HTML
  y el PDF usan la misma fuente (`domicilioFiscalSellado`). Sellar siempre, «Entregar en» y la etiqueta de las
  facturas viejas pasan a la SDD-0698.
