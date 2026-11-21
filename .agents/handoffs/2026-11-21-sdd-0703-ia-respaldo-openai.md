# Handoff · SDD-0703 · OpenAI como respaldo no chino de Anthropic

**Pedido (Dir_DTD, por decisión de Sam del 2026-11-21):** escribir **solo la spec** del respaldo OpenAI para la
Oficina_Virtual (`soporte-chatwoot`) y las funciones con datos de clientes A3, A4 y A5. Rama
`claude/sdd-0703-openai-respaldo-741f7a`, desde `origin/main` en `9ae885c88`. Sin código de producto.

## Qué se hizo

- `docs/specs/0703-ia-respaldo-openai/spec.md` (status `proposed`).
- `docs/specs/README.md` regenerado con `pnpm docs:index`.

## Hallazgos que cambian el diseño (revisables)

- **El motor de la 0639 no existe en el código** (`lib/studio/ia/` ausente): las fases 2-4 dependen de implementarlo.
- **La Oficina no llama a un proveedor desde el ERP**: el cable habla con el runtime de Hermes
  (`runtime-cliente.ts:55-66`). Por eso OpenAI en la Oficina es **configuración de Hermes**, no un adaptador del ERP,
  y puede ir primero (P-3).
- **La 0626 §7 dice «piso glm-5.3»**: choca con la D-2. La spec pide corregirla en otra PR; no la toqué.
- **0700 y 0702 no están en `main`**: las leí en `origin/sdd/0626-tapar-datos-entrada` y
  `origin/sdd/0626-modelo-real`. El número 0703 está libre (sin ref ni carpeta).
- Los detalles de OpenAI (salida estructurada, PDF, retención, `insufficient_quota`, topes) están marcados **NV**: no
  se verificaron contra su documentación ni su panel.

## Comprobaciones

- `pnpm sdd:check`: PASÓ (los choques históricos listados son los ya conocidos).
- `pnpm docs:check`: PASÓ tras regenerar el índice.
- Pruebas de producto, `pnpm verify`, vitest: NO EJECUTADO (solo documentación; sin turno de PC).

## Decisiones abiertas para Sam (con recomendada, en la spec §11)

P-1 modelo (gama media, el que gane la evaluación) · P-2 Agentes A6 (no) · P-3 orden (Oficina primero) ·
P-4 retención (cero si es elegible, si no «no guardar la respuesta» y riesgo aceptado) · P-5 máscara 0700 en A3-A5 (no).

## Impacto documental y pendientes

- Corregir 0626 §7 (quitar el piso chino) y anotar en el runbook de la oficina la verificación de la cadena del perfil.
- Añadir a la 0639 una nota «ver 0703» cuando Sam apruebe esta spec.

## FUERA DE ALCANCE DETECTADO

- El motor de la 0639 sigue sin implementarse; A3/A4 aún muestran texto crudo del proveedor en mensajes/logs (0638 §5.2).

## Actualización (pedido de Dir_DTD)
- Spec §5.2 y §5.3: la Oficina hoy apunta a `claude-sonnet-5-5` sin respaldo; si Anthropic cae basta la tarjeta interna
  (`runtime:*`), sin pausa automática (decisión de Sam). §5.3 nombra `docs/specs/0626-oficina-runtime/privacidad.md`
  (hallazgo 13, línea 158, y línea 282, aún con Z.AI + DeepSeek) como documento a corregir al aplicar el cambio.
