# Handoff — SDD-0617 · 6.7, reemplazo de los Salesbots (solo diseño)

- **Owner:** Worker «E6 Salesbots 6.7», sesión `b565c293` (iniciada por el Subdirector Chatwoot `local_535053f4`).
- **Ruta:** `DTD-worktrees/0617-crm-reemplazo-salesbots` · **rama:** `codex/0617-crm-reemplazo-salesbots` · base `main` `3c14715ad`.
- **SDD:** [0617](../../docs/specs/0617-crm-reemplazo-salesbots/spec.md). El número lo reservó el DG (stub `2cfa005e2`).
- **Permisos:** solo diseño y PR en borrador. Nada en Kommo, Meta ni el Chatwoot vivo, y no se fusiona.

## Completado

- Tabla de los 15 Salesbots: qué hacía cada uno, qué lo reemplaza, dónde está ese reemplazo y su costo en Meta.
- La discrepancia de la 0587 §6.1 queda cerrada: 3 de los «Ping 23 h» escribían al cliente y 1 creaba una tarea.
- Costo de los «Ping 23 h»: US$0 con D8 (a), contra unos US$4 al mes si se automatizara el mensaje (**I**).
- Decisiones D-6.7-1 a D-6.7-3. Se propone bajar los días restantes de 1 a 0,5.

## Validación

`spec-migration-refs` PASÓ (5 de 5), `sdd:check` PASÓ y `docs:check` PASÓ después de `docs:index`. No hay código de producto, así que las pruebas de producto no aplican.

## Pendientes

- **Coordinación con E7, a cargo del Subdirector (§4):** al bot le toca solo contenido para la 7.4 y ninguna conducta.
- Que el DG decida D-6.7-1 a D-6.7-3.
- El cierre de la 6.7 espera que R6 de la 6.6 esté en main.

## FUERA DE ALCANCE DETECTADO

- `docs/runbooks/kommo-salesbots-inventario.md` dice «500 KG por CBM es FALSO». Para el cliente, la regla son 500 kg/m³. No lo corregí: es otro documento.
