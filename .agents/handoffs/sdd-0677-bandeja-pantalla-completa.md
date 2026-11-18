# Handoff · SDD-0677 — Bandeja: pantalla completa y abrir Chatwoot sin error

- **Owner:** Worker (Claude), sesión hija del DG (`local_25e2dded-…`). Claim `worker-sdd-0677`.
- **Ruta:** `.claude/worktrees/focused-driscoll-4273ab`
- **Rama:** `claude/sdd-0677-bandeja-pantalla-completa`, con base en `main` `bab0dafcc`.
- **SDD:** [0677](../../docs/specs/0677-bandeja-pantalla-completa/spec.md). El DG asignó el número; la reserva está en el primer commit de la rama.
- **Permisos:** una PR a main. No fusiono. Sin migraciones, sin config de Chatwoot, sin tocar los archivos de la #686.

## Objetivo

El pedido de Sam: que la Bandeja sea compacta y se amplíe a toda la pantalla al abrirse, y saber por qué a veces da error al abrir Chatwoot y que se recupere sola.

## Hecho

- **Diagnóstico** en la spec §1, con archivo:línea:
  - H1, la más probable: las sesiones de Chatwoot se acumulan y sale el 409 con `MAX_USER_SESSIONS=5`;
  - H2: la marca `dtd_cw_sso` es vieja y la sesión del panel ya murió;
  - H3: Chatwoot se reinicia y el enlace se pidió una sola vez;
  - H4: el tope de rack-attack, como inferencia;
  - H5, descartada: el enlace de un solo uso reusado.

  Se descartaron las cabeceras, `www` y las cookies SameSite. Explica también por qué el arreglo anterior (E2-D12, E2-D48) no cubre estos casos.
- **Rediseño** en `BandejaClient.tsx`:
  - la capa a pantalla completa, con «Reducir» y Esc;
  - la preferencia se recuerda en el navegador;
  - el iframe no se vuelve a montar al cambiar de modo;
  - el foco va al título o al botón;
  - el fondo no se desplaza.
- **Recuperación:**
  - dos reintentos del enlace ante `service` (1,5 s y 4 s);
  - un vigilante de carga de 20 s;
  - el aviso `<Aviso>` «La bandeja no abrió» con «Abrir de nuevo»;
  - el freno: el tercer «Abrir de nuevo» en 5 minutos no pide otro SSO;
  - la línea de ayuda fija para lo que Studio no puede ver dentro del marco.
- Los textos en es-VE y zh-CN. Se quitaron las claves que ya no se usan: `state.error.*`, `action.retry` y `action.relogin`.
- Las pruebas en `BandejaClient.test.tsx`: 9 casos nuevos de pantalla completa y recuperación, y 2 casos existentes ajustados al texto nuevo.
- `/ui-check` (advisory): se corrigieron el token `--bg` por `--bg-base` y el contraste del «Abriendo…», de `--ink-mute` a `--ink-soft`. Los botones del sistema (`studio-btn-ghost`, `ActionButton`) y el aviso `<Aviso>` cumplen.

## Validación

| Comprobación | Estado |
|---|---|
| `node scripts/build-docs-index.mjs` | PASÓ (índice regenerado) |
| `node scripts/check-numbering.mjs` | PASÓ |
| `git diff --check` | PASÓ |
| `pnpm install --frozen-lockfile` (turno del DG) | PASÓ |
| vitest `app/studio/(app)/bandeja` (6 archivos) | PASÓ 94/94; BandejaClient 21/21 |
| Mutantes: sin reintento, sin freno, sin vigilante, sin bloqueo del desplazamiento, iframe que se vuelve a montar al cambiar de modo | 5/5 en rojo; el control inofensivo, en verde |
| vitest de contratos y guía (`app/studio/_components/__tests__`, `guia`, `Aviso`, `(app)/__tests__`, `crm/__tests__`, `lib/i18n`) | PASÓ 651/651 |
| `tsc --noEmit` | PASÓ (también después del ajuste de lint) |
| eslint de los 4 archivos | PASÓ, sin avisos |
| `pnpm verify` | NO EJECUTADO: el turno cubría install, vitest, tsc y eslint. Queda el CI de GitHub |
| Logs del VPS (DG) | Ningún contenedor se reinició (H3 improbable). Los logs no registran los 409 ni los 429: H1 y H2 quedan como hipótesis, con medición propuesta en la spec |

## Pendientes de esta tarea

1. La PR #690 está lista para que el DG lance la revisión independiente.
2. Smoke en el navegador: pantalla completa, Esc con el foco fuera del marco, y el nivel de capas con la guía (z 85, debajo de la guía 89/90).

## FUERA DE ALCANCE DETECTADO

- **H1 de raíz**, para que decidan Sam y el DG:
  - subir `MAX_USER_SESSIONS` en el VPS;
  - un botón «Cerrar mis otras sesiones y entrar», que cierra también la app móvil del agente;
  - que `DASHBOARD_SCRIPTS` avise `dtd:sin-sesion` o `dtd:demasiadas-sesiones` para reabrir solo.

  Las tres son puertas del VPS o necesitan el OK de Sam.
- **Medir H1 y H2** (spec §1, M1 a M4): M1 (sesiones por agente, solo números) es la primera.
- **H4:** medir `req.ip` de rack-attack detrás de Cloudflare (E2-I3).
- Los textos de color `--ink-mute` en párrafos de otras pantallas tienen el mismo problema de contraste. No se tocaron.

## Impacto documental

Spec nueva y el índice de specs regenerado. No cambia ningún runbook. Si se elige una opción de H1, va en `infra/chatwoot/README.md`.
