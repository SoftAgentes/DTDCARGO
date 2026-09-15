# director-cierre-20260915 — Cierre de la sesión Director del 14 y 15 de septiembre

- Fecha: 2026-09-15.
- Owner / sesión escritora: `director-cierre-20260915` (Claude Code, Opus 5), sesión Director.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/director-cierre-20260915`.
- Rama: `codex/director-cierre-20260915`, desde `origin/main` `0d22c8247b08b28380a12de3bab83cc82eac1aa9`.
- Estado de tarea: cerrada por pedido de Sam. Sin trabajo en curso de esta sesión.
- Pedido de cierre (Sam, 2026-09-15, texto literal): «Requiero de ti que cierres ya, que vamos a
  continuar. No dejes nada abierto: cierra el trabajo aquí para comenzar mañana otra vez. Si está todo
  limpio, si falta por cometer o por los smoke, no los vamos a hacer ahorita, así que dálos por
  terminados por ahora.»
- Lectura del pedido: los smokes y lo que falta quedan **diferidos**, no hechos. Cerrar no autoriza
  merge, limpieza, migraciones ni lanzar Workers; esas autorizaciones siguen pendientes y están abajo.

## OBJETIVO ORIGINAL

Coordinar la ola posterior al bloque C: integrar sus PRs, aplicar las migraciones con OK nominal,
cerrar los hallazgos de borrado de clientes (revocación del Portal y auditoría) y el e2e de `verify`
sin Supabase público, y dejar la sesión cerrada con un estado reconstruible para mañana.

## COMPLETADO

### Integrado en `main` (todas con autorización explícita de Sam)

| PR | Merge | Fecha (UTC) | Contenido |
|---|---|---|---|
| #118 | `027da333` | 2026-09-14 15:15 | Registro de 0453 aplicada |
| #117 | `2b1d7d84` | 2026-09-14 15:32 | Handoff Director de la ola post bloque C |
| #119 | `08af6abc` | 2026-09-14 18:52 | SDD-0468: enlace del proveedor y Excel |
| #120 | `4d8dee12` | 2026-09-15 15:55 | SDD-0467: borrar un cliente revoca el Portal (0454) |
| #121 | `c70956bf` | 2026-09-15 16:18 | Registro de 0454 aplicada |
| #122 | `42f80bea` | 2026-09-15 18:35 | SDD-0469: borrado de cliente auditado (0455) |
| #124 | `f99dcdc2` | 2026-09-15 19:14 | Registro de 0455 aplicada |
| #123 | `0d22c824` | 2026-09-15 19:30 | SDD-0470: e2e de `verify` sin Supabase público |

### Producción (Supabase `xpfuzqombmjmxvprjgmi`)

- `0453` aplicada el 2026-09-14, `0454` el 2026-09-15 a las 15:58:57 y `0455` a las 18:34:59, cada
  una con OK nominal. La evidencia está en `.agents/handoffs/0453-aplicacion-prod-20260914.md`,
  `0454-aplicacion-prod-20260915.md` y `0455-aplicacion-prod-20260915.md`.
- Advisors de seguridad sin cambios en todas las aplicaciones.
- No se leyeron filas de negocio, datos personales ni conteos.

### Limpieza hecha con autorización

- Worktrees y ramas de #113, #115, #116, #117, #118, #119, #120 y #121, con purga por `rmdir` de los
  esqueletos de junctions de pnpm.
- Reservas SDD borradas: 0465, 0466, 0467 y 0468.

## VALIDACIÓN

- PASÓ: `main` = `origin/main` = `0d22c824`. Estado combinado de GitHub: `success`.
- PASÓ: Vercel y «Calidad continua» en verde sobre `f99dcdc2` (#124) y `0d22c824` (#123, run
  `35014085082`).
- PASÓ: `corepack pnpm sdd:next` → spec siguiente **0472**, migración siguiente **0456**. Solo
  colisiones ADVISORY históricas de `refs/dtd/pr/104` y `preview/portal-nueva-compra`.
- PASÓ: ningún worktree registrado tiene claim de sesión (`harness-session-claim.json`) aparte del
  de este cierre, que se libera al publicar. Ningún worktree tiene cambios sin commit.
- PASÓ: sin tareas en segundo plano de esta sesión corriendo; el último monitor terminó.
- NO EJECUTADO: `corepack pnpm verify`; esta rama solo agrega este handoff.

## COMMITS

- «commit que contiene este documento»: handoff de cierre de la sesión Director.

## PR / BRANCH

- Rama `codex/director-cierre-20260915` con PR en borrador contra `main`. Sin merge: requiere OK de
  Sam.

## PENDIENTES DE ESTA TAREA

Todos quedan diferidos para la próxima sesión, en este orden sugerido.

1. **Merge de la PR de este cierre**, con OK de Sam.
2. **Smoke de 0454 y 0455 (diferido por Sam):** en Studio › Clientes, borrar un cliente de prueba con
   motivo y otro sin motivo. Comprobar el evento `client_deleted` en Administración › Auditoría y que
   el acceso al Portal quede revocado. Las specs 0467 y 0469 siguen en `in-progress` hasta ese smoke.
3. **Hueco de seguridad en `clients` (prioridad alta), sin lanzar.** Se había propuesto como
   SDD-0471, pero **ese número ya lo tomó otra sesión** (PR #125). Hay que reservar la **SDD-0472**.
   - Hallazgo: `authenticated` tiene DELETE y UPDATE sobre `clients` y la policy «clients by tenant»
     solo exige tenant.
   - Consecuencia: cualquier miembro del equipo, con cualquier rol, puede borrar físicamente un
     cliente por PostgREST o editar cualquier columna sin control de rol.
4. **Retención de 30 días**, decidida por Sam el 2026-09-15 y sin lanzar: se conservan 30 días el
   email y las fechas de un vínculo del Portal revocado.
5. **Tres decisiones de SDD-0470 para Sam:**
   - si `attachments-gastos-pilot-network` también se omite sin Supabase;
   - si se abre una spec para correr e2e con variables sintéticas;
   - qué política seguir con WebKit en Windows.
6. **Limpieza, con autorización:**
   - worktrees y ramas `codex/borrado-cliente-auditado` (#122), `codex/verify-e2e-sin-supabase`
     (#123), `codex/0455-aplicacion-prod-20260915` (#124) y, después de su merge, este cierre;
   - ramas de reserva solo locales `codex/sdd-reserve-0469-borrado-cliente-auditado` (`c66e1e95`) y
     `codex/sdd-reserve-0470-verify-e2e-sin-supabase` (`c66b0381`). Sus stubs quedaron superados por
     las specs completas de `main`.
7. **Sigue con gate humano:** smokes A a C de 0415, 0414, 0422 y 0423; PR #114 (espera el smoke de
   L14); y las decisiones anteriores (ramas conservadas, resto de la PR #21, barrido DDP, E2E hosted,
   skills-lock y cierre de SDD-0235).

## FUERA DE ALCANCE DETECTADO

- **PR #125, de otra sesión:** «SDD-0471: conocimiento Director, Graphify y Obsidian verificable»,
  borrador, head `2d6a5734`, abierta el 2026-09-15 a las 20:15. «Calidad local sin secretos» falla en
  «Unitarios» (run `35018803558`): `expected [ 'GRAPHIFY_PYTHON' ] to deeply equal []`. Modifica
  `AGENTS.md` y las skills Director y Worker. El Director no la revisó; tiene worktree
  `knowledge-graphify-obsidian-20260915` y reserva local `codex/sdd-reserve-0471-knowledge-graphify-obsidian`.
- Carpeta sin commit `DTD Cargo/` en el checkout principal: no se tocó; falta que Sam diga de quién es.
- SDD-0320 figura como `done`, pero su código no está en `main`.
- ConfirmDialog no pone `aria-busy` en el botón mientras está en `pending` (BTN-01 §5).
- El largo del motivo del borrado se mide en unidades UTF-16 en TS y en caracteres en SQL.
- Un UPDATE directo que fija `merged_into_client_id` y `deleted_at` a la vez se audita como
  `client_merged`; va con la SDD del hueco de `clients`.
- Flaky: `calculadora-semantic-colors.spec.ts:53`.
- Proceso de WebKit huérfano visto en una corrida local de e2e.
- Ramas locales preexistentes conservadas: `codex/portal-colors-reception-integration-20260906` y
  `codex/pr28-e2e-harness-validation-20260906` (upstream borrado).

## HANDOFF AL DIRECTOR

- Al abrir mañana: `git fetch origin`, `node scripts/director-status.mjs` y leer este documento.
- Primera acción: pedir a Sam el OK de merge de este cierre y agrupar las demás autorizaciones de
  «Pendientes».
- Antes de reservar la spec del hueco de `clients`, correr `corepack pnpm sdd:next`: #125 puede haber
  movido la numeración.
- Espera en el baseline de migraciones: 0415, 0414, 0422 y 0423; `cutoff` 238. No hay migraciones en
  vuelo con plazo de 24 h.
- El claim `director-cierre-20260915` se libera al publicar.
