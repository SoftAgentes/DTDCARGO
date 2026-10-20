# Handoff · SDD-0564 — paso 7: lectura del repositorio (A1)

| Campo | Valor |
|---|---|
| Task ID | `2026-10-20-sdd-0564-vps-paso-7-repositorio` |
| Owner / sesión | Worker «Oficina Paperclip» (Claude Code) · claim `oficina-paperclip` |
| Rama | `codex/oficina-paperclip-vps-paso-6` (va junto con el paso 6) |
| SDD | [0564](../../docs/specs/0564-instalacion-piloto-paperclip-hermes/spec.md), §D1 (A1) y §D9 paso 7 |
| Estado | hecho |

## Autorización (literal)

Sam, 2026-10-20: «Sí, arranca el paso 7 de la SDD-0564: llave de despliegue de GitHub de solo
lectura para que los agentes lean el repositorio.»

## Qué se hizo

| Pieza | Estado |
|---|---|
| Llave | ed25519 generada **en el VPS** para `agentes` (`~/.ssh/dtdcargo_lectura`, 600). La parte privada no salió del VPS |
| GitHub | Deploy key en `hailuwaycom-sketch/DTDCARGO`, id `167037577`, título «oficina-paperclip VPS agentes (solo lectura, SDD-0564)», **`read_only=true`**, creada el 2026-10-20T08:11:40Z con `gh api` y la sesión de Sam |
| Huella de github.com | `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` (coincide con la publicada por GitHub) |
| Alias SSH | `github-dtdcargo` con `IdentitiesOnly yes` |
| Clon | `~agentes/repos/DTDCARGO`, `main` en `5af1e933` (2026-10-20), 6.244 archivos, 280 MB, sin bajar los archivos de LFS; `core.hooksPath=/dev/null`, `pull.ff only`, `push.default nothing` |
| Prueba de escritura | `git push --dry-run` → «ERROR: The key you are authenticating with has been marked as read only.» |
| Secretos en el clon | Solo `.env.example`; no hay `.env` |

## Consideraciones

- Se eligió A1 (llave de lectura) y no A1-b (copia filtrada). Por eso **el clon incluye
  `.agents/handoffs/`**, con detalles operativos del servidor de DTD (sin secretos), y ese contenido
  viaja al proveedor del modelo cuando un agente lo lee (SDD-0564 §D1).
- El clon no se actualiza solo. Lo actualiza `git pull` como `agentes`, a mano o con una tarea que
  se decida en el paso 8.
- Para revocar el acceso: borrar la deploy key `167037577` en GitHub › Settings › Deploy keys, y la
  llave del VPS.
