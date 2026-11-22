# Handoff — SDD-0708 · Administración sin tarjeta puente y reorganización

- **Owner:** Worker (Claude) para Dir_DTD · sesión `local-admin-panel-reorganizar`
- **Ruta:** `.claude/worktrees/rediseno-0603-retomar-c82740` · **Rama:** `claude/admin-panel-reorganizar-6688cc`
- **Base:** `main` `8c15a4bb0`
- **Objetivo:** quitar el doble clic de Administración (tarjeta «Abrir X →») y proponer un orden más claro del panel.
- **SDD:** `docs/specs/0708-studio-admin-panel-directo/spec.md` (número asignado por Dir_DTD el 2026-11-22).
- **Permisos del encargo:** spec y PR de la spec; no implementar hasta que Sam elija; no fusionar.

## Estado

- COMPLETADO: diagnóstico (origen `d0e8299dd`, SDD-0020), inventario de 27 secciones, opciones A/B (D-1), R1/R2 (D-2),
  D-3, D-4, allowlist de la fase 1 y aceptación.
- PENDIENTE DE ESTA TAREA: que Sam elija D-1 a D-4; luego implementar la fase 1 según la allowlist de §5.

## Validación

- `node scripts/build-docs-index.mjs --check`: PASÓ (686 specs).
- `node scripts/check-numbering.mjs`: PASÓ (sin números repetidos; los choques históricos 0342/0394 ya estaban).
- Pruebas de producto: NO APLICA (solo docs).

## Impacto documental

- Nuevo: la spec 0708 y su fila en `docs/specs/README.md`. Sin otros documentos canónicos afectados.

## FUERA DE ALCANCE DETECTADO

- Visibilidad de las secciones legales dentro de Administración frente al módulo `legal`: nota privada para el
  Director en la carpeta de notas compartidas (no va a Git).
- Importar (carga masiva), Flujos automáticos a nivel empresa y las pantallas reales de Marca: specs propias.
