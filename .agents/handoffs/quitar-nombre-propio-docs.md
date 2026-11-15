# Handoff · quitar-nombre-propio-docs

- **Owner / sesión:** worker-quitar-nombre-propio (subagente Worker lanzado por el Director General).
- **Ruta:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/quitar-nombre-propio`
- **Rama:** `claude/quitar-nombre-propio-docs`, desde `origin/main` `aee7d5d70`.
- **SDD:** no aplica (solo docs y pruebas, sin cambio de comportamiento). Referencia del rol: SDD-0622, fila 9.9.
- **Autorización:** Sam, «Sí, límpialo», por medio del Director General. Sin push ni PR en este encargo.

## Objetivo

Quitar del repo el nombre propio de la persona de contabilidad con CRM y sustituirlo por el rol
genérico que la PR #571 dejó en `docs/specs/0622-permisos-por-persona/spec.md` (fila 9.9):
«la persona de contabilidad con CRM». Las citas literales de Sam conservan el nombre sustituido
entre corchetes.

## Qué cambió

| Archivo | Cambio |
|---|---|
| `.agents/handoffs/sdd-0611-noticias-publicacion-automatica.md` | 2 citas literales con `[la persona de contabilidad con CRM]`; 2 menciones por el rol; «nadie llamado …» → «nadie con ese nombre» |
| `.agents/handoffs/sdd-0622-permisos-por-persona.md` | «caso …» → «caso contabilidad con CRM» (4 veces) y 2 menciones por el rol |
| `docs/marketing/whatsapp-business.md` | Filas #1 y #3 de la tabla y la sección «Quién es quién» por el rol |
| `docs/operaciones/prompt-cierre-permisos-2026-08-07.md` | Lista de accesos (l. 99) y fila de tabla (nombre y apellido → `*(la persona de contabilidad con CRM)*`) |
| `docs/operaciones/prompt-roles-y-permisos.md` | Fila de tabla (nombre y apellido → rol) |
| `docs/specs/0076-configuracion-servicios/assets/FASE-FUTURA-motor-flujo-interno-y-rbac.md` | Líneas 80 y 84 por el rol |
| `docs/specs/0272-cambio-de-correo-de-un-miembro/spec.md` | Nombre y apellido (l. 30-31) y 3 menciones más por el rol |
| `docs/specs/0275-tres-pendientes-medidos/spec.md` | 1 mención por el rol |
| `docs/specs/0611-noticias-publicacion-automatica/spec.md` | Cita literal con corchetes (l. 60) y 8 menciones por el rol |
| `docs/specs/0611-noticias-publicacion-automatica/privacidad.md` | 1 mención por el rol |
| `lib/news/autopublicar/__tests__/noticias-0518.migration.test.ts` | Solo el comentario de cabecera |
| `supabase/tests/0518_noticias_publicacion_automatica.test.sql` | Variable con el nombre propio → `revisor`; comentario y texto de una aserción |
| `supabase/tests/0525_noticias_ajustes_antes_de_encender.test.sql` | Variable con el nombre propio → `revisor`; comentario |
| `supabase/tests/0526_noticias_anon_solo_columnas_publicas.test.sql` | Solo el comentario |

En las pruebas no cambió la lógica, ningún UUID ni lo que afirma cada aserción. `revisor` no
choca con ningún identificador: en esos archivos solo aparece como literal `'revisor'` o
`'sin_revisor'`.

## Excepciones

- `supabase/migrations/0204_nomina_positions.sql` (líneas 111, 134 y 180) conserva el nombre:
  está aplicada y no se toca. Ninguna prueba compara contra esos textos (medido con
  `git grep` de `0204_nomina` y `sombrero` fuera de migraciones).

## Evidencia

- `git grep -n -i` del nombre (con y sin tilde) en la cabeza: solo las 3 líneas de la 0204.
- `git diff --check`: sin errores.
- `pnpm docs:check` (`node scripts/build-docs-index.mjs --check`): PASÓ, 617 specs.
- `pnpm sdd:check` (`node scripts/check-numbering.mjs`): PASÓ, sin números repetidos (choques históricos ya conocidos).
- Pruebas focales: NO EJECUTADO (las corre el Director General con turno). Archivos:
  `lib/news/autopublicar/__tests__/noticias-0518.migration.test.ts` y los contratos
  `supabase/tests/0518_…`, `0525_…`, `0526_….test.sql` (revisar qué arnés Vitest/PGlite carga 0525 y 0526).
- Sin node_modules en el worktree; no se corrió `pnpm install`. Los dos checks son node puro.

## Impacto documental

Docs actualizadas en su sitio canónico (specs, marketing, operaciones, handoffs). Graphify, Archify
y la preview de Obsidian: NO EJECUTADO en este encargo (sin node_modules y fuera del cierre pedido);
queda para el Director al integrar.

## Pendientes de esta tarea

- Corrida focal de las pruebas tocadas (Director General).
- Push y PR, cuando se autoricen.

## FUERA DE ALCANCE DETECTADO

- **Correos personales junto al rol** (no se copian aquí): `docs/specs/0272-cambio-de-correo-de-un-miembro/spec.md:30` y `:31`;
  `docs/operaciones/prompt-cierre-permisos-2026-08-07.md:31` y `:170-177`; `docs/operaciones/prompt-roles-y-permisos.md:106-112`.
- **Otros nombres propios de personal** en los mismos archivos: Yolimar (y su apellido), Fiorella (y apellido),
  Alberto (y apellido), Jose (y apellido) en las tablas de `docs/operaciones/`; Pedro en la 0272 (§Sucesión);
  Fátima, Fiorella y Yolimar en `FASE-FUTURA-motor-flujo-interno-y-rbac.md:80,84`; Yoli, José, Alberto y Javier en
  `docs/marketing/whatsapp-business.md`; Javier en `supabase/migrations/0204_nomina_positions.sql:180` (aplicada).
- **Nombre de una clienta («Alexandra»):** `docs/specs/0255-aliados-white-label/spec.md:100`;
  `docs/specs/0258-shipping-mark-historial-y-subinsignias/spec.md:31,46,49,172,213,219,222,228`;
  `lib/shared/markbox-chain.ts:15`; `supabase/migrations/0362_aliados_base.sql:20` (aplicada).
- `docs/marketing/whatsapp-business.md` muestra teléfonos de la empresa por persona; no se evaluó si son públicos.
