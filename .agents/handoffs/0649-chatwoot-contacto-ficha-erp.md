# Handoff — SDD-0649 Shipping Mark y segmento del ERP en el contacto de Chatwoot

Fecha: 2026-11-16 · Rama: `claude/quizzical-villani-eb5dfc` · PR #622 · Reserva: `codex/sdd-reserve-0649-chatwoot-contacto-ficha-erp` + `refs/dtd/reservations/0649`.

## Hecho
- Spec `docs/specs/0649-chatwoot-contacto-ficha-erp/spec.md`: D1 a D5 resueltas por Sam («Sí, como recomiendas»). D4 queda en (b): su recomendación era condicional y la frecuencia del borrado no está medida.
- Antecedente revisado a pedido de Sam: ni en la sesión del Director General, ni en otras sesiones, ni en el repo había una aprobación previa de esto. Lo parecido es la SDD-0244, que pone el Shipping Mark en el contacto de **Kommo**.
- Código según la lista exacta de la spec, §6. Manejador `marcarContactoErp`, apagado salvo con `CHATWOOT_ATRIBUTOS_CONTACTO=1`. **Sin migración**: usa la RPC de la 0505 y lee solo `clients.markbox` con service_role.
- Runbook: sección «Segmento y Shipping Mark en el contacto» en `docs/runbooks/chatwoot-bandeja.md`.

## Comprobaciones
- `sdd:check`: PASÓ. `docs:check`: PASÓ.
- Vitest, typecheck, lint y `pnpm verify` locales: NO EJECUTADOS. El worktree no tiene `node_modules`, y instalar o correr pruebas en la PC pide turno del Director General. El portón es el CI de la PR #622.
- Revisión independiente del Director General sobre `07cca5b7f`: sin defectos en el código. Dejó dos anotaciones:
  - **Lectura y escritura de `custom_attributes`:** la forma de `GET /contacts/{id}` (`payload.custom_attributes`) y la mezcla del `PATCH` salen del código de Chatwoot 4.19.1, no de una prueba contra un Chatwoot real. Se comprueban en el smoke contra 4.19.1, antes de encender.
  - **`shippingMarkVisible` descarta códigos con espacios** (y vacíos o de más de 40 caracteres): una ficha con un código así queda sin Shipping Mark en Chatwoot, aunque su segmento sí se escribe.
- Antes de encender D1: medir si un Agente de Chatwoot CE ve los Shipping Marks de contactos de bandejas de las que no es miembro (spec §4).

## Pendiente de esta tarea
- CI de la PR en verde y revisión independiente, que lanza el Director General.
- Puertas, cada una con OK nominal de Sam: fusionar y desplegar; crear los dos atributos en Chatwoot (D1); cargar `CHATWOOT_ATRIBUTOS_CONTACTO=1` y recrear `web`; smoke con el número de prueba (runbook).

## FUERA DE ALCANCE DETECTADO
- Conteos de solo lectura del Archivo Kommo: el guion está en la carpeta de notas del Subdirector de Chatwoot (`0590-por-que-no-veo-kommo-conteos.rb`). Lo corre el Director General; Sam lo aprobó el 2026-11-16.
- Historial de Kommo en la ficha de Studio y en la Ficha DTD (opción A del informe de esa carpeta): sin decidir.
- Prueba de fotos, videos, voz y enlaces con el número de prueba: propuesta, sin OK.
- Consentimiento y baja de marketing: hay un borrador en la misma carpeta; la tabla de consentimientos pide su propia SDD.
- D4 (a), limpiar el atributo al borrar la ficha: si un conteo muestra que el borrado es frecuente.

## Impacto documental
- Runbook `chatwoot-bandeja.md` y `.env.example` actualizados. El índice de specs se regeneró.
