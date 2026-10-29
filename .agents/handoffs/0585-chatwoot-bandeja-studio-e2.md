# Handoff — SDD-0585, paso 2.1 del programa SDD-0582 (PoC del iframe)

- **Fecha:** 2026-10-29
- **Worker:** Claude, owner `claude-0582-e2-poc`
- **Rama:** `codex/0582-e2-poc`, en el worktree `DTD-worktrees/0582-e2-poc`
- **Base:** apilada sobre `codex/0582-e1-chatwoot-vps` (PR #329), punta `16546aa2d`
- **Reserva:** SDD-0585, local, con `refs/heads/codex/sdd-reserve-0585-chatwoot-bandeja-studio-e2` en `24af1975`; sin publicar, igual que las reservas de 0583 y 0584.

## Resultado

**Sí, iframe.** La matriz completa y las decisiones E2-D1 a E2-D6 están en [`spec.md`](../../docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md) y en el [registro de la PoC](../../docs/specs/0585-chatwoot-bandeja-studio-e2/poc-iframe-2026-10-29.md).

| | Chrome 156 | Edge 156 | Firefox | Safari |
|---|---|---|---|---|
| Iframe | PASÓ | PASÓ | NO DISPONIBLE | PASÓ (WebKit de Playwright, indicador) |
| SSO | PASÓ | PASÓ | NO DISPONIBLE | PASÓ (indicador) |
| Micrófono / nota de voz | PASÓ | PASÓ | NO DISPONIBLE | NO DISPONIBLE (WebKit de Windows sin captura de medios) |

**Cabeceras:**
- **Studio:** solo en la ruta de la bandeja, excluida del catch-all:
  - `frame-src https://chat.dtdcargo.com`;
  - `Permissions-Policy` con `microphone=(self "https://chat.dtdcargo.com")`;
  - iframe con `allow="microphone"`.
- **Traefik:** sin cambios. `frame-ancestors 'self' https://dtdcargo.com` ya es correcto, porque Studio vive en `dtdcargo.com/studio` y `www` redirige al apex. **No** se agrega `https://studio…`.

**Lo que manda sobre el diseño de 2.2:**
1. **Mismo sitio, como invariante (E2-D1).** Desde otro sitio, el SSO no entra en ningún motor: la cookie del panel es Lax por omisión (S4).
2. **SSO solo cuando hace falta (E2-D5).** Con `MAX_USER_SESSIONS=5`, el sexto login de navegador da 409 y la pantalla para elegir sesión dentro del iframe (S5). Además, rack-attack corta a 5 logins por IP cada 5 minutos.

## Reproducir

```bash
cd infra/chatwoot/pruebas/iframe-poc
POC_TRABAJO=<carpeta fuera del repo> bash levantar.sh
PLAYWRIGHT_MODULE=<checkout>/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs \
  node matriz.mjs <POC_TRABAJO>/poc.json chrome edge webkit firefox
bash levantar.sh --bajar
```

- Arranque: ~65 s.
- Matriz: ~4 min.
- Es una corrida pesada: una a la vez.
- El token de la Platform App local queda en `<POC_TRABAJO>/secretos` (0600). Es local y sintético, y se borra con `--bajar` y la carpeta.

## Validación

| Comprobación | Resultado |
|---|---|
| `matriz.mjs` (corrida final 2026-10-29T19:35Z) | PASÓ en Chrome y Edge (I1–I3, S1–S3, M1–M3) y en S5. WebKit: I y S en PASÓ, M en NO DISPONIBLE. Firefox: NO DISPONIBLE |
| Controles | Los cinco controles bloquean (I2, I3, M2, M3, S4). Un falso verde evitado: en WebKit, el ícono de «grabando» aparece sin micrófono (E2-R6) |
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `node scripts/check-numbering.mjs` | PASÓ: sin números repetidos; avisos históricos conocidos |
| `node scripts/avance-checklist.mjs …/checklist.md` | Avance 5,0 % (falta 95,0 %); 2.1 entre «entregados sin aceptar» |
| `bash -n` / `node --check` de los scripts | PASÓ |
| `pnpm verify` | NO EJECUTADO: no hay cambio de producto, solo scripts de prueba locales y documentos |

## Pendientes de esta tarea

- **Aceptación de 2.1:** OK de Sam o del Director. La fila pasa a `aceptado` en un commit aparte.
- **Firefox:** correr `matriz.mjs … firefox` si Sam autoriza descargar el Firefox de Playwright (~90 MB, cdn.playwright.dev). Si no, va al QA de 2.6 con Firefox de escritorio.
- **Safari real** (macOS o iOS): en 2.6.
- **E2-NV1:** `clipboard-write`, `autoplay` y el websocket de ActionCable dentro del iframe. Pasan a 2.2.

## Impacto documental

- Nuevos: `docs/specs/0585-…/{spec.md,poc-iframe-2026-10-29.md}`.
- Fila 2.1 del checklist.
- Índice de specs regenerado. El hueco 0584 es de esta base: la PR #331 no está debajo, y el driver del índice lo resuelve al integrar.
- `docs/runbooks/chatwoot-servidor.md` §3 dice «El otro lado del iframe … es de E2»: se actualiza en 2.2, cuando la cabecera exista.

## FUERA DE ALCANCE DETECTADO

- **rack-attack detrás de Cloudflare (E2-I3, NV).** El `req.ip` de Chatwoot podría ser la IP de Cloudflare, y entonces los topes por IP (login 5 cada 5 min, `req/ip`) se comparten entre usuarios. Le toca a E1 o E3: medirlo en el VPS con OK y, si hace falta, `trusted_proxies`.
- **`ensayo-local.sh` de E1 no copia `marca/`** a su carpeta de prueba (`preparar_carpeta`), así que el ensayo monta una carpeta vacía en `/app/public/dtd-marca`. Es inofensivo, pero el ensayo no cubre la marca.
- **Sesiones huérfanas:** un intento de SSO desde otro sitio crea la sesión en el servidor aunque el navegador no guarde la cookie (E2-R3), y cuenta para `MAX_USER_SESSIONS`.
