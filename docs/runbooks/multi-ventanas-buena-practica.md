# Varias tareas en paralelo

Dueño: Director de ingeniería · Estado: sustituido · Fecha: 2026-09-05.

Invoca `$director` para reconstruir el estado y planificar; `$worker` para ejecutar
una asignación. Prompt completo y cierre en [ingeniería](codex-engineering.md#asignación-y-handoff).

Director mantiene control de integración; cada Worker conserva rama/worktree,
commits selectivos, validación y handoff. Publicación de rama propia según permisos
del encargo. No hacer push main desde ninguna ventana. «Cerrar» no equivale a
autorizar merge o producción. No copiar entornos/secretos automáticamente.

El gate ya incluye build: reportar pasos omitidos, sin repetir build por rutina.
La coordinación de migraciones/release y limpieza se rige por el runbook vigente.
