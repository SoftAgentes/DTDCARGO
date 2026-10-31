# Handoff · SDD-0583 · respuesta automática de notificaciones@

- **Rama:** `claude/vigilant-haibt-767483` · **PR:** #343, apilada sobre `codex/0582-e1-chatwoot-vps` (PR #329).
- **Fecha:** 2026-10-31.

## Hecho

- `infra/hostinger/respuesta-automatica/vista-previa.html` tiene el asunto, la opción A con formato, la opción B solo texto, botones para copiar y los pasos para hPanel.
- `infra/hostinger/respuesta-automatica/README.md` dice qué acepta el editor de Hostinger (documentado y NO VERIFICADO), el diseño, los pasos, el texto anterior para volver atrás y lo pendiente.
- Diseño aprobado por Sam el 2026-10-31: «Aprobado, abre la PR».

## Evidencia

- Ayuda de Hostinger: el mensaje acepta texto enriquecido o sin formato y no guarda si tiene emojis. NO VERIFICADO: editor HTML, qué formato se conserva al pegar y límite de largo.
- Navegador integrado: el logo carga, el botón de copiar funciona sin errores y a 375 px no hay desborde.
- `pnpm docs:check`: PASÓ. `pnpm verify`: NO EJECUTADO, porque no hay código de producto.

## Pendiente de esta tarea

- Aplicarla en hPanel: la aplica Sam, o una sesión con su OK nominal. Después, la prueba de recepción del paso 7 del README.

## FUERA DE ALCANCE DETECTADO

- WhatsApp de la firma (8021, de leads según la enmienda del 0.8 de SDD-0582) frente al de clientes (5202). Afecta también la firma de `base.liquid` de Chatwoot.
- `base.liquid` vive en `claude/hostinger-config-4b501f`, que no desciende de la punta de E1. El enlace del README resuelve cuando esa rama se integre.

## Impacto documental

- Ninguno en docs canónicos. Cuando se aplique, conviene anotar el cambio en la investigación de SDD-0583 (fila nueva tras T-34).
