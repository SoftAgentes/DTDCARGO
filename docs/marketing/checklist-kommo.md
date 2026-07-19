# Checklist Kommo — lo que falta para encender el CRM (founder)

> **Una página, en orden.** El embudo único YA quedó configurado (29-jun: se reusó "Atencion a
> leeds" con 6 etapas — ver [`../runbooks/kommo-consolidacion-embudo-unico.md`](../runbooks/kommo-consolidacion-embudo-unico.md)).
> **Sincronizado con prod 2026-07-19** (auditoría del Motor de Crecimiento): 4 pasos ya estaban
> hechos de facto y el estado real de los flags no era el que el doc creía. Detalle abajo.

> **⚠️ Lo que la auditoría destapó (19-jul):**
> - Los flags del write-back estaban en prod como `writeback_enabled=true, dry_run=false`
>   **fuera de orden** — el paso 5 (cron del drain + validación en dry-run) nunca ocurrió, así que
>   armado en real pero SIN cron = no escribió nunca, pero listo para escribir de una.
> - **Corregido el 19-jul:** se volvió a `dry_run=true` (con OK del founder) para que el orden
>   seguro se cumpla. El write real vuelve solo tras el paso 5.
> - La conexión está en `status='error'` desde el sync fallido del 18-jul → el drain y el push
>   rehúsan hasta que el sync vuelva a `active` (paso 1).
> - El error del push de alta NO es un 401 de token: es **Kommo 400 code 205** (derechos de
>   cuenta / payload). Diagnosticar antes de prender el push real.

| # | Paso | Quién | Dónde / cómo | Estado |
|---|---|---|---|---|
| 1 | **Sync del espejo** en verde (`status='active'`) — hoy en `error` desde el 18-jul | Coordinación (o esperar el cron diario 7am UTC) | `/studio/kommo` — el espejo debe mostrar el embudo con sus 6 etapas | 🟡 en error |
| 2 | **Crear los custom fields** de la tarjeta: Tipo comercial · Cadencia esperada · Volumen estimado · Canal de origen · Motivo de pérdida | **Tú** (navegador, Kommo → Leads → Configurar → Campos) | Lista exacta: [`embudo-ventas.md`](embudo-ventas.md) §3 | ⬜ |
| 3 | **Cargar el mapa de etapas** (enviado → "Tomar decisión (Estimado)" · aceptado → "Servicio Logrado con éxito" · rechazado → "Ventas Perdidos") | **Tú** en `/studio/kommo → Dirección → "Mapa de etapas"` | No escribe nada mientras el write-back esté apagado — solo deja lista la intención | ✅ hecho (stage_map cargado en prod) |
| 4 | **Elegir el campo del Shipping Mark** (campo de TEXTO en leads; crearlo si no existe) | **Tú** en `/studio/kommo → Dirección → "MARKBOX en Kommo"` | [`../runbooks/activar-crm-kommo.md`](../runbooks/activar-crm-kommo.md) Track Founder §1 | ✅ hecho (`markbox_field_id` elegido) |
| 5 | **Programar el cron del drain** del write-back (unblock #1) + validar en dry-run | Coordinación + tú viendo | Runbook maestro §A.2-A.3 — el SQL exacto está ahí | ⬜ **el bloqueo técnico real** |
| 6 | **Prender el write real** (`writeback_enabled=true, dry_run=false`) | Coordinación **con tu OK** tras ver el dry-run | Runbook §A.4 · rollback en cualquier momento: volver a dry-run | ⬜ (revertido a dry-run el 19-jul — se re-prende tras el paso 5) |
| 7 | **Migrar los leads de los 10 embudos viejos** al único (de menor a mayor volumen) + campo "Tipo de servicio" | **Tú** (bulk edit en Kommo, contigo delante — NUNCA desatendido) | Mapa embudo→destino: [`../runbooks/kommo-consolidacion-embudo-unico.md`](../runbooks/kommo-consolidacion-embudo-unico.md) §Mapa | ⬜ |
| 8 | **Decisión del cementerio** (los ~2.225 atascados en "Atención al cliente"): ⭐ bulk → Perdido "limpieza 2026" / re-trabajar / triage por fecha | **Tú** | Las 3 opciones: runbook consolidación §Caso especial. Nota: la pestaña **Recuperación** de `/studio/kommo` (SDD-0157) ya trabaja esos contactos aunque el lead esté en Perdido — limpiar el tablero NO pierde a nadie | ⬜ |
| 9 | **Repartir la cartera** (hoy 99,9% en 1 asesor): asignar Responsable por lead activo | **Tú** (bulk edit por lotes en Kommo) | Con el embudo ya limpio (paso 7-8) son muchos menos leads reales | ⬜ |
| 10 | **`kommo-sync` con nombres de asesor** (en vez de "Asesor #id") | Coordinación | Runbook maestro §B.7 — independiente de los demás pasos | ✅ hecho (sync v6 con `kommo_users` poblado) |

**Estado real (19-jul):** hechos de facto = 3, 4, 10. Bloqueo técnico único = **paso 5** (cron del
drain). Requieren tu navegador = 2, 7, 8, 9. Paso 1 = destrabar el sync (`status='error'`).

**Orden recomendado:** 1 (sync verde) → 2-4 (config inerte, 3-4 ya hechos) → 5 (dry-run) → 6 (write
real con tu OK) → 7-9 (limpieza con el tablero ya automatizado). El vínculo de los ~405 clientes
(`kommo_lead_id` = 0 hoy) va junto al paso 6 — sin llave, el write-back no encuentra a quién
escribir (ver Motor de Crecimiento F1-T02/T03).

**Regla de oro:** nunca borrar un embudo con leads dentro; el write-back en dry-run hace que
reestructurar Kommo no dispare nada — la ventana ideal para los pasos 7-9 es ANTES del paso 6 o
en cualquier momento con dry-run puesto.
