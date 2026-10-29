# Handoff — SDD-0582 piloto de Chatwoot

- **Owner:** Claude Worker «Chatwoot piloto», sesión de Sam del 2026-10-28 (claim `claude-chatwoot-piloto`).
- **Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\chatwoot-piloto`
- **Rama:** `codex/chatwoot-piloto`, base `origin/main` ec5786bb8.
- **SDD:** 0582, reservada con `sdd:next --reserve chatwoot-piloto` (rama `codex/sdd-reserve-0582-chatwoot-piloto`
  y ref `refs/dtd/reservations/0582`, ambas solo locales; la reserva no está publicada).
- **Objetivo:** especificar el piloto de Chatwoot autohospedado con WhatsApp Cloud API y bot propio, y las
  puertas para salir de Kommo. Solo documentación: nada instalado, nada tocado en Kommo, Meta ni producción.

## ACTUALIZACIÓN 2026-10-29 — de piloto a programa

**Pedido.** Sam pidió un programa completo, con estas piezas:
- Chatwoot dentro de Studio;
- historial;
- canales;
- bot;
- actualizaciones;
- permisos;
- metodología de % y días.

El plan pasó por una segunda revisión de Codex, y Sam respondió «Sí, incorpóralas». Después agregó:
- **quitar Kommo del ERP sin rastro,** al corte, exportando y borrando los datos;
- **una guía interactiva** «Antes en Kommo → Ahora aquí».

**Entregado (paso 0.1 del checklist):**
- `spec.md` reescrita como spec del programa: alcance del 100%, decisiones A–K, prohibiciones, gobernanza, metodología y allowlist.
- `checklist.md` con la línea base v1: 99,75 persona-días, 10 etapas y 78 pasos.
- `instrucciones-ia.md` y `investigacion-2026-10-28.md`, con registro por afirmación y etiquetas C/D/T/R/I/NV, sin datos personales.
- `scripts/avance-checklist.mjs` con sus pruebas en `scripts/__tests__/avance-checklist.test.mjs`.

**Validación 2026-10-29:**
- **Vitest** `scripts/__tests__/avance-checklist.test.mjs`: PASÓ, 12/12.
- **Control rojo:** con un mutante que cuenta `entregado` como aceptado, FALLÓ como debe. Restaurado, vuelve a verde.
- **`docs:check`** (`build-docs-index --check`): PASÓ, con 565 specs.
- **`sdd:check`** (`check-numbering`): PASÓ. Solo da los avisos de choques históricos conocidos.
- **`git diff --check`:** PASÓ.
- **`pnpm verify`:** NO EJECUTADO, porque no cambia código de producto.

**Primer reporte del script:**

```
Etapa 1 de 10 · E0 Preparación y puertas · paso 0.1 · Avance 0,0 % (falta 100,0 %) · Esfuerzo: real 0 d, restante 98,5 d
Entregados sin aceptar: 0.1
```

**Pendientes de esta tarea:**
- Aceptación de 0.1 por Sam, al revisar la PR #327.
- Arrancar E0 en una sesión Worker. Los pasos 0.2–0.7 necesitan a Sam: decisiones, inventario de Meta, inventario de Kommo, inventario de correo, prueba de extracción con OK de lectura de PII y expedientes.

**FUERA DE ALCANCE DETECTADO (nuevo):**
- Anthropic y OpenAI no listan a Venezuela; Anthropic, desde el 2026-11-12. Puede afectar `lib/studio/agents/runtime`. Lo revisa el Director.
- `kommo_unsorted.raw` guarda texto de clientes.

## OBJETIVO ORIGINAL

Sam: «Piloto de Chatwoot». Luego pidió explicar la conexión con WhatsApp y dijo que quiere salir de Kommo por el
costo de su IA. Citas literales en la spec, sección «Pedido de Sam».

## COMPLETADO

- `docs/specs/0582-chatwoot-piloto/spec.md` con status `proposed`: contexto verificado, reglas de Meta, fases 0-3,
  decisiones para Sam, privacidad, aceptación y allowlist.
- `docs/specs/README.md` regenerado con `docs:index`.

## VALIDACIÓN

- `node scripts/build-docs-index.mjs --check` (docs:check): PASÓ, 565 specs.
- `node scripts/check-numbering.mjs` (sdd:check): PASÓ, sin números repetidos; avisos históricos conocidos.
- `git diff --check`: PASÓ.
- `pnpm verify`: NO EJECUTADO; el cambio es solo de documentación.
- Graphify, Archify y `knowledge:status`: NO EJECUTADOS; no hay `node_modules` en el worktree. Impacto
  documental: una spec nueva; queda para el Director al integrar.

## PR / BRANCH

Rama `codex/chatwoot-piloto` publicada; PR draft SoftAgentes/DTDCARGO#327 (autorizada por Sam: «Sí, abre la PR»).

## PENDIENTES DE ESTA TAREA

- Decisiones 1-4 de la spec (máquina, ruta de corte, dueño de la WABA, tope de gasto del bot).
- Publicar la reserva y la rama y abrir la PR cuando Sam lo autorice.
- Antes de la fase 1: `revisar-datos-ve`, inventario de terceros y texto de `/privacidad`.

## FUERA DE ALCANCE DETECTADO

- `/privacidad` dice que los datos se tratan en Venezuela (`app/privacidad/page.tsx:262-264`), pero la base vive
  en Contabo, en EE. UU. Ya se había registrado en la revisión del traslado a Contabo.
- La PDF del DPA de Contabo está sin seguimiento en la raíz del checkout principal.

## HANDOFF AL DIRECTOR

Spec documental lista para revisión. Hay que coordinar la publicación de la reserva 0582 antes de integrar.
