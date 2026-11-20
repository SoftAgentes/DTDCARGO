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

## PENDIENTES DE ESTA TAREA

- La aprobación de Sam y su respuesta a P-8 (el comprobante HTML), que Dir_DTD pasa cuando Sam conteste.
- `gh pr ready` cuando Sam apruebe: en borrador, el CI no corre.

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
- Si Sam exige la dirección antes (P-5) o se enciende A-2, hay que revisar `app/privacidad/page.tsx`. Un
  texto aprobado que cambia va al DG antes.

## HANDOFF AL DIRECTOR

- La PR es en borrador y trae solo docs.
- Para implementar F-1 hacen falta:
  - el número de la migración de copia;
  - el OK de Sam a la spec.
