# Handoff · SDD-0586 paso 10.5 — guion de ensayo y aplicación de la 0520, preparado y sin correr

- **Owner:** Claude Worker «10.5», en la sesión iniciada por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`), que coordina con el Director General.
- **Claim:** `worker-10.5-docs-0520`.
- **Ruta y rama:** `DTD-worktrees/0586-0520-runbook-ensayo`, rama `codex/0586-0520-runbook-ensayo`, desde `main` en `be3e89652` (la #433 fusionada).
- **Pedido:** el DG, comunicado por el Subdirector el 2026-11-08. Pidió el guion de la 0520 con las correcciones N1 a N9 de la revisión de la #433, en el mismo formato y por host, sin correr nada, en la rama de la 1b o en una PR de docs aparte, lo que menos choque. Va aparte: la #434 está en revisión, y así no cambia su cabeza ni vuelve a correr su CI.

## Lo hecho

- `docs/runbooks/chatwoot-portal-0520-ensayo.md`: identidad, orden migrate-first (preparar sobre la cabeza final de la #434, aplicar y después fusionar con `--match-head-commit`), comandos por host, códigos 0 a 7 y 255, cierre, smoke (el cron no se dispara en producción), vuelta atrás y evidencia.
- `docs/runbooks/chatwoot-portal-0520-antes.sql` (A1 a A5) y `-despues.sql` (D1 a D5). No leen ninguna tabla de negocio. D2 mide EXECUTE para `public`, `anon`, `authenticated` y `service_role`, y normaliza el `search_path`.
- Identidad con `preparar.mjs` sobre `32e858800` (la cabeza de la #434), sin tocar ninguna base: blob `29a3bbeaf3b0…`, md5 `03bcee54616204644a6981d33ec7764c`, 12500 bytes. El md5 de `aplicar.sql` es `31ea8f03…` en producción y `2d66435c…` en prueba.

## Validación

| Comprobación | Estado |
|---|---|
| Las dos mediciones en PGlite, sobre el fixture del contrato de la 0520 (con la 0519 aplicada y su fila en el ledger), antes y después, con tres controles: sin la 0520, con la 0520 y un EXECUTE de más para `anon` | PASÓ, 18 de 18. El arnés corrió desde el worktree de la 1b, que tiene la 0520 y `node_modules` |
| `docs:check` y `git diff --check` | ver el cuerpo de la PR |
| Los roles de Supabase reales, el ledger real y `service_role` en `destrabar` | NO VERIFICADO: PGlite no los reproduce |

## FUERA DE ALCANCE DETECTADO

Nada nuevo.

## Estado

En curso: PR de docs en borrador. Se corre solo con el OK nominal de Sam para la 0520, que pide el DG.
