# Handoff · Íconos de canal con color en Chatwoot (variante B)

- Owner: Worker (Claude), pedido directo de Sam el 2026-11-23. Vio las dos variantes y respondió, textual: «Va la B: el portal en azul DTD». Rama `claude/chatwoot-canales-color`, base `main`.
- COMPLETADO:
  - `infra/chatwoot/panel/canales-color.html`: un `<style>` para `DASHBOARD_SCRIPTS`. WhatsApp #25d366, Messenger #0866ff (#4d8fff en oscuro), Instagram #e4405f, y el portal (bandeja 10, `a[href$="/inbox/10"] .i-woot-api`) en `--accion` #1f4fa8 / #7faaf0.
  - Prueba `lib/studio/chatwoot/__tests__/canales-color.test.ts`.
  - Runbooks: `chatwoot-agentes.md` §4 (cómo cargarlo, comprobar y volver atrás) y `chatwoot-versiones.md` (qué vigilar en una subida).
- EVIDENCIA (VPS, solo lectura, Chatwoot 4.20.1):
  - las clases `i-woot-*` son máscaras con `background-color: currentColor` (`dashboard-*.css`);
  - el menú usa `router-link` (`SidebarGroupLeaf.vue`) hacia `/app/accounts/1/inbox/<id>`;
  - el modo oscuro es `body.dark` (`themeHelper.js`);
  - `CHATWOOT_INBOX_PORTAL_ID` = 10 en el web de producción.
- VALIDACIÓN:
  - prueba nueva corrida con node, replicando las aserciones porque el worktree no tiene `node_modules`: 4/4 PASÓ;
  - vitest NO EJECUTADO; el portón es el CI.
  - Sin captura en el panel real: NO EJECUTADO hasta cargarlo.
- PENDIENTES: revisión independiente (la lanza Dir_DTD), fusión, OK nominal de Sam para pegarlo en `DASHBOARD_SCRIPTS` y la comprobación visual de Sam.
- FUERA DE ALCANCE DETECTADO:
  - Chatwoot 4.20.1 trae `useBrandIcon` (íconos de marca a color) en `ChannelIcon.vue`, pero el menú lateral no lo usa; activarlo exigiría tocar la imagen.
  - El renombre de «Conversaciones del portal» es la fase 5 de la SDD-0707.
