# Cierre técnico · SDD-0325 throttle fail-closed del acceso CBM

Fecha: 2026-09-02

Rol: worker
Estado: LISTO PARA PUBLICAR · BLOQUEADO EN EL GATE EXPLÍCITO DE PUSH

## Identidad Git

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`.
- Worktree: `C:\\Users\\Trabajo\\Desktop\\Developer\\software\\DTD-worktrees\\codex-saneamiento-integral`.
- Rama: `codex/saneamiento-integral`.
- Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Padre del lote: `b0c8bb83b3c63565bf88d594e9e8baa5048a61ff`.
- Commit previsto: `fix(admin): SDD-0325 — limitar intentos CBM`.
- Este worker no integra `main`; sólo publica su rama con autorización literal.

## Alcance cerrado

La entrada interna `POST /admin/cbm-estudio` ahora limita cada IP a cinco
intentos por ventana fija de 15 minutos antes de analizar o comparar el token.
La IP se normaliza con el helper compartido y se persiste únicamente como SHA-256
con el prefijo `cbm-estudio:`. Cinco UUID deterministas por ventana usan la llave
primaria existente de `portal_registro_throttle` para reservar cupos de forma
atómica también bajo ráfagas concurrentes.

- El sexto intento responde `429` con `Retry-After: 900`, sin formulario ni cookie.
- Un fallo del cliente administrativo o de la escritura responde `503` y cierra
  el acceso; no degrada a permitir intentos sin control.
- Los formularios malformados bajo el límite consumen un intento.
- GET, sesión firmada, cookie HttpOnly y contenido autorizado permanecen sin
  cambios de contrato.
- No se agregó dependencia ni migración. La purga existente de la tabla sigue
  eliminando registros por `created_at`.

## Allowlist exacta

- `app/admin/cbm-estudio/route.ts`
- `app/admin/cbm-estudio/route.test.ts`
- `docs/specs/0325-throttle-acceso-cbm/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-cbm-estudio-throttle-close.md`

## Verificación

- Contrato focal: 12/12 pruebas pasaron.
- ESLint focal, TypeScript y `git diff --check`: OK.
- `node scripts/verify.mjs`: exit 0; 14 de 15 gates realmente medidos y ninguno
  falló.
- Vitest: 508 archivos / 5.928 pruebas pasaron.
- Documentación y numeración: 317 specs, 396 migraciones, OK.
- Componentes y gobernanza: OK.
- SQL: 140 contratos, rollback total.
- Rebuild: 396 migraciones; 378 aplicadas desde cero y 18 sólo-ledger;
  aislamiento verificado sobre 219 tablas y 2 tenants.
- E2E: 150 pasaron, 18 se omitieron y cero fallaron. Tres workers WebKit no
  cerraron en Windows dentro de 300 s; el watchdog los terminó y el verificador
  clasificó el resultado como aviso conocido, no regresión.
- Build de producción: OK; 158 páginas estáticas generadas.
- `migrations-applied`: NO MEDIDO por ausencia deliberada de credenciales.

## Gates no cruzados

- No hubo escritura en Cloud o Producción, aplicación de migraciones, cambio de
  secretos, deploy ni integración a `main`.
- No se hizo push. Autorización literal requerida:
  `Autorizo git push -u origin codex/saneamiento-integral al remoto https://github.com/hailuwaycom-sketch/DTDCARGO.git`

## Limpieza pendiente

- Este worktree no se retira hasta publicar o integrar la rama y demostrar que
  todos sus commits están contenidos en la referencia de destino.
- Se preservan `codex/archive-cloud-handoff-20260828` y
  `codex/archive-primary-pnpm-20260902`; ambas contienen historia única todavía.
- Integrador siguiente: refrescar `origin/main`, validar divergencia, publicar la
  rama autorizada y ejecutar los gates posteriores como operaciones separadas.
