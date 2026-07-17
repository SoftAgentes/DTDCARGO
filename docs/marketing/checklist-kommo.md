# Checklist Kommo — lo que falta para encender el CRM (founder)

> **Una página, en orden.** El embudo único YA quedó configurado (29-jun: se reusó "Atencion a
> leeds" con 6 etapas — ver [`../runbooks/kommo-consolidacion-embudo-unico.md`](../runbooks/kommo-consolidacion-embudo-unico.md)).
> Esto es lo que sigue, quién lo hace y dónde están los pasos finos. Actualizado 2026-07-17.

| # | Paso | Quién | Dónde / cómo | Estado |
|---|---|---|---|---|
| 1 | **Sync del espejo** para traer los IDs de las etapas nuevas | Coordinación (o esperar el cron diario 7am UTC) | `/studio/kommo` — el espejo debe mostrar el embudo con sus 6 etapas | ⬜ |
| 2 | **Crear los custom fields** de la tarjeta: Tipo comercial · Cadencia esperada · Volumen estimado · Canal de origen · Motivo de pérdida | **Tú** (navegador, Kommo → Leads → Configurar → Campos) | Lista exacta: [`embudo-ventas.md`](embudo-ventas.md) §3 | ⬜ |
| 3 | **Cargar el mapa de etapas** (enviado → "Tomar decisión (Estimado)" · aceptado → "Servicio Logrado con éxito" · rechazado → "Ventas Perdidos") | **Tú** en `/studio/kommo → Dirección → "Mapa de etapas"` | No escribe nada mientras el write-back esté apagado — solo deja lista la intención | ⬜ |
| 4 | **Elegir el campo del Shipping Mark** (campo de TEXTO en leads; crearlo si no existe) | **Tú** en `/studio/kommo → Dirección → "MARKBOX en Kommo"` | [`../runbooks/activar-crm-kommo.md`](../runbooks/activar-crm-kommo.md) Track Founder §1 | ⬜ |
| 5 | **Programar el cron del drain** del write-back (unblock #1) + validar en dry-run | Coordinación + tú viendo | Runbook maestro §A.2-A.3 — el SQL exacto está ahí | ⬜ |
| 6 | **Prender el write real** (`writeback_enabled=true, dry_run=false`) | Coordinación **con tu OK** tras ver el dry-run | Runbook §A.4 · rollback en cualquier momento: volver a dry-run | ⬜ |
| 7 | **Migrar los leads de los 10 embudos viejos** al único (de menor a mayor volumen) + campo "Tipo de servicio" | **Tú** (bulk edit en Kommo, contigo delante — NUNCA desatendido) | Mapa embudo→destino: [`../runbooks/kommo-consolidacion-embudo-unico.md`](../runbooks/kommo-consolidacion-embudo-unico.md) §Mapa | ⬜ |
| 8 | **Decisión del cementerio** (los ~2.225 atascados en "Atención al cliente"): ⭐ bulk → Perdido "limpieza 2026" / re-trabajar / triage por fecha | **Tú** | Las 3 opciones: runbook consolidación §Caso especial. Nota: la pestaña **Recuperación** de `/studio/kommo` (SDD-0157) ya trabaja esos contactos aunque el lead esté en Perdido — limpiar el tablero NO pierde a nadie | ⬜ |
| 9 | **Repartir la cartera** (hoy 99,9% en 1 asesor): asignar Responsable por lead activo | **Tú** (bulk edit por lotes en Kommo) | Con el embudo ya limpio (paso 7-8) son muchos menos leads reales | ⬜ |
| 10 | **Re-deploy `kommo-sync` a v4** (nombres de asesor en vez de "Asesor #id") | Coordinación | Runbook maestro §B.7 — independiente de los demás pasos | ⬜ |

**Orden recomendado:** 1 → 2-4 (todo config inerte, sin riesgo) → 5 (dry-run) → 6 (write real con
tu OK) → 7-9 (limpieza con el tablero ya automatizado) → 10 cuando se pueda.

**Regla de oro:** nunca borrar un embudo con leads dentro; el write-back apagado hace que
reestructurar Kommo no dispare nada — la ventana ideal para los pasos 7-9 es ANTES del paso 6 o
en cualquier momento con dry-run puesto.
