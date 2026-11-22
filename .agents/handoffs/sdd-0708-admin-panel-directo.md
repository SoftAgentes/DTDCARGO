# Handoff — SDD-0708 · Administración sin tarjeta puente y reorganización

- **Owner:** Worker (Claude) para Dir_DTD · sesión `local-admin-panel-reorganizar`
- **Ruta:** `.claude/worktrees/rediseno-0603-retomar-c82740` · **Rama:** `claude/admin-panel-reorganizar-6688cc`
- **Base:** `main` `8c15a4bb0`
- **Objetivo:** quitar el doble clic de Administración (tarjeta «Abrir X →») y proponer un orden más claro del panel.
- **SDD:** `docs/specs/0708-studio-admin-panel-directo/spec.md` (número asignado por Dir_DTD el 2026-11-22).
- **Permisos del encargo:** spec, fase 1 tras la elección de Sam, push de la rama propia y PR; no fusionar.

## Estado

- Decisión de Sam (2026-11-22, textual): «Elijo B (el menú acompaña) y el menú ordenado por tema (R1).» D-3/D-4 con
  las recomendaciones de la spec (Rutas en los dos menús, Marca fuera, Apariencia en Equipo y seguridad).
- COMPLETADO: fase 1. Catálogo `_components/admin-sections.ts`, menú `_components/AdminNav.tsx`, marco `layout.tsx`
  (sin guardias nuevas; a quien no pasa `admin` le deja la página sola), `page.tsx` sin tarjeta puente y con
  redirección de `?section=` con ruta propia, «Volver» retirado de 5 subpáginas, `WorkflowsSection.tsx` borrado.
- Revisión independiente de `e1b71224f`: APPROVED sin bloqueantes. Correcciones pedidas por Dir_DTD, en un commit:
  sin doble encabezado (`AdminHeader` solo en `/studio/admin`; eyebrows con el grupo del menú), conteo 30 en la spec,
  comentario de `page.tsx`, `oficina-virtual` en la prueba y prueba de «ninguna sección en blanco».
- PENDIENTE DE ESTA TAREA: capturas: después de publicar, Dir_DTD (en producción, con Sam). `pnpm verify` con turno.
- PENDIENTE (ver con datos reales): la columna de contenido queda en ~1024 px; confirmar si las tablas anchas de Rutas
  y Notificaciones piden scroll horizontal.

## Validación (turno de PC dado por Dir_DTD)

- `pnpm install --frozen-lockfile`: PASÓ.
- `tsc --noEmit -p .`: PASÓ (0 errores).
- `eslint --max-warnings=0` de los 10 archivos tocados: PASÓ.
- `vitest admin-sections.test.ts`: PASÓ 14/14 (ronda 2) · `oficina-virtual-nombre.test.ts`: PASÓ 7/7.
- `/ui-check` del diff (ronda 2): OK con ajustes menores; ver el cuerpo de la PR.
- `docs:check` y `sdd:check`: PASÓ.
- `pnpm verify`: NO EJECUTADO (pide turno aparte). Capturas: NO EJECUTADO (sin Supabase local en este worktree).

## Impacto documental

- Nuevo: la spec 0708 y su fila en `docs/specs/README.md`. Sin otros documentos canónicos afectados.

## FUERA DE ALCANCE DETECTADO

- Visibilidad de las secciones legales dentro de Administración frente al módulo `legal`: nota privada para el
  Director en la carpeta de notas compartidas (no va a Git).
- `WorkflowsSection.tsx` figura en la lista de archivos de la fase 2 de la SDD-0686: si una PR abierta de esa fase lo
  edita, chocará con el borrado.
- Importar (carga masiva), Flujos automáticos a nivel empresa y las pantallas reales de Marca: specs propias.
