# RESUMEN — ventana "construcción de norte"

**Rama:** `feat/construccion-norte` · **Worktree:** `DTD-worktrees/construccion-norte`
**Estado:** implementado + `node scripts/verify.mjs` **TODO VERDE** (2924 tests). Sin commit, sin push, sin migración aplicada a prod (gated al Director).

## SDD-0122 — Registro de cliente interno: persona/empresa + completitud

### Qué hace
El alta de cliente **interno** (`/studio/clientes`) ahora distingue **persona (cédula)** de **empresa (RIF)** como ya lo hacía el registro público, persiste `doc_kind` + `contact_name`, y muestra un panel **"qué falta para completar"** el perfil. El MARKBOX sigue autollenándose (sin cambios).

### Archivos tocados
| Archivo | Cambio |
|---|---|
| `supabase/migrations/0191_clients_contact_name.sql` | **NUEVO** · columna `clients.contact_name` (aditiva, nullable). **NO aplicada a prod.** |
| `docs/specs/0122-registro-cliente-persona-empresa/spec.md` | **NUEVO** · spec SDD-0122 (status in-progress). |
| `lib/studio/client-types.ts` | `contact_name` en `Client`; `doc_kind`+`contact_name` en `ClientInput`; `CEDULA_REGEX`/`formatCedula`/`normalizeDocByKind`; validación de documento por tipo; `DOC_KIND_OPTIONS`/`docKindLabel`; helper puro `clientCompleteness()`. |
| `lib/studio/client-queries.ts` | `contact_name` en `CLIENT_COLUMNS`. |
| `app/studio/(app)/clientes/actions.ts` | parsea+persiste `doc_kind` y `contact_name` (create/update). |
| `app/studio/(app)/clientes/_components/ClientDrawer.tsx` | selector Persona/Empresa, documento dinámico (Cédula/RIF), campo contacto (empresa), aviso "qué falta" al crear. |
| `app/studio/(app)/clientes/[markbox]/page.tsx` | badge de tipo, fila Tipo/Contacto, card "Perfil del cliente · qué falta", gate de la card de identidad relajado (aparece con documento). |
| `lib/studio/__tests__/client-types.test.ts` | +14 tests (validación por tipo + completitud). |
| `lib/studio/client-search-action.test.ts` | mock `Client` + `contact_name`. |
| `app/studio/(app)/clientes/__tests__/client-unique-doc.test.ts` | form de test manda `doc_kind: "empresa"`. |

### Decisiones (founder)
- Contacto de empresa = **columna dedicada** `contact_name` (migración 0191), no en notas.
- "Qué falta" aparece en el **detalle** (card) + **al crear** (toast informativo con link "Completar perfil").

### Sin migración aplicada + números libres
- Migración **0191** y **SDD-0122** elegidos libres mirando TODAS las ramas (web-norte ocupa migr 0190 / SDD-0120-0121).
- `docs/specs/README.md` (índice) **NO** regenerado — lo hace el Director tras merge.

### Pendiente para el Director (integración)
1. Aplicar migración `0191_clients_contact_name.sql` a prod (o vía branch dry-run).
2. `pnpm build` antes de push (verify no caza el blocker de barrel "use server").
3. Regenerar `docs/specs/README.md` (`pnpm docs:index`).
4. Merge `feat/construccion-norte` → `main` con OK del founder.

### No hecho (fuera de alcance, anotado en la spec)
- Badge de completitud en el **listado** (founder eligió detalle + al crear).
- Ancla `person_id` en el alta interna (SDD-0106 Fase 2).
- Verificación automática SENIAT (SDD-0046 Slice C).
