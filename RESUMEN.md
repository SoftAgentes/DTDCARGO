# RESUMEN · SDD-0138 Slice D — avatar + registrar empresa (Modo Forja)

**Rama:** `feat/portal-slice-d` (desde `main` 42eb9eb6, ya con A+B+C integrados)
**Worktree:** `DTD-worktrees/portal-slice-d`
**Commits:** `89676edc` migración 0199 · `e76c38fb` código · (+ este RESUMEN)
**Estado:** ✅ `verify.mjs` TODO VERDE + `next build` OK · **sin push**
**⚠️ Migraciones SIN APLICAR:** `0198` (direcciones, del merge anterior) **y ahora `0199`**
(columna `clients.avatar_path`). El Director puede aplicar las dos en la misma tanda
(dry-run `begin…rollback` primero, `get_advisors` después). Todo el código degrada
honesto mientras tanto.

## Qué trae el Slice D
1. **Avatar editable** en `/portal/cuenta` (Norte PortalProfile):
   - `AvatarEditor`: foto (signed URL 1h, bucket privado) o iniciales + "Cambiar foto".
   - `updateAvatarAction`: patrón `completeProfileAction` (sesión → admin scopeado →
     validar → subir → update con rollback → borrar el avatar viejo best-effort).
   - Storage: **reusa `client-docs`** con sub-path `avatar/` — sin bucket ni policies
     nuevas. Separado de la foto de cédula (verificación).
2. **Card "¿Importas para tu negocio?"** en `/portal/cuenta` (solo `doc_kind ≠ empresa`):
   CTA WhatsApp al asesor. **Mediado por el asesor** — consistente con el modelo de
   identidad read-only del portal. El alta self-service persona→empresa (por
   `person_id`, SDD-0106/0131) queda como evolución si el volumen lo pide.

## Estado de SDD-0138 (spec actualizada en este branch)
- ✅ Slice A identidad · ✅ B direcciones portal+Studio · ✅ C estimado last-mile · ✅ D avatar+empresa
- La spec puede pasar a `status: done` cuando se apliquen 0198+0199 (decisión Director).

## Para el Director
1. `git merge feat/portal-slice-d` → verify + build → push con OK del founder.
2. Aplicar migraciones **0198 + 0199** (dry-run tx primero; `get_advisors` security después).
3. `pnpm docs:index` si cambia el índice (la spec ya está indexada; solo cambió el cuerpo).
