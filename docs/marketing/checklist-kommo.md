# Checklist CRM (Kommo) — qué falta de verdad

> **Medido contra producción el 2026-08-13.** Todos los números de esta página
> salen de consultar la base, no de recordar. Si vuelves acá dentro de un mes y
> no dice "medido el <fecha de hoy>", **desconfía y vuelve a medir** — esta
> página estuvo congelada del 19-jul al 13-ago declarando como "el bloqueo
> técnico real" un paso que se había cerrado el 11-ago.

## Dónde estamos

**El CRM ya escribe a Kommo desde el ERP y funciona.** Lo que era el bloqueo
—el drenaje de la cola— se cerró el 11-ago; el write-back está en real desde
entonces. El embudo quedó en **1** (eran 12) con **7 etapas** (eran 75).

| | Valor en prod |
|---|---|
| Conexión | `active` · último sync 13-ago 07:00 UTC |
| Write-back | `writeback_enabled = true` · `dry_run = false` → **escribe en real** |
| Embudos / etapas | **1** / **7** — sin huérfanos |
| Leads / contactos | 3.168 / 3.190 |
| Contactos con teléfono | **1.701** de 3.190 |
| Vínculos lead↔contacto | 3.180 |
| Asesores espejados | 5 |
| Cola de escritura | 4 enviadas · **0 pendientes** |

**Reparto del embudo:** Ventas Perdidos 2.877 · Logrado con éxito 244 · Contacto
inicial 19 · Negociación 12 · Recontacto 11 · Incoming 3 · Estimado enviado 2.

## Los pasos

| # | Paso | Quién | Estado medido |
|---|---|---|---|
| 1 | Sync del espejo en verde | cron 7am UTC | ✅ `active` |
| 2 | **Crear los 5 campos comerciales** de la tarjeta: Tipo comercial · Cadencia esperada · Volumen estimado · Canal de origen · Motivo de pérdida | **Tú** (Kommo → Leads → Configurar → Campos) | ⬜ **ninguno existe.** Los 20 campos de lead que hay hoy son de tracking (`utm_*`, `gclid`, `fbclid`, `finance`, `Priority`) más `Shipping Mark - j102`. Lista exacta: [`embudo-ventas.md`](embudo-ventas.md) §3 |
| 3 | Cargar el mapa de etapas | Tú | ✅ 4 claves en `stage_map` |
| 4 | Elegir el campo del Shipping Mark | Tú | ✅ en lead (`1570535`) **y** en contacto (`1570723`) |
| 5 | Programar el cron del drenaje | Coordinación | ✅ hecho el 11-ago (`*/15`), más *nudge* desde el ERP: la latencia bajó de **14 min 38 s** a segundos |
| 6 | Prender el write real | Coordinación con tu OK | ✅ `enabled=true`, `dry_run=false` |
| 7 | Migrar los leads de los embudos viejos al único | Tú | ✅ 1 embudo, 0 leads huérfanos |
| 8 | Decisión del cementerio | Tú | ✅ de facto: 2.877 en "Ventas Perdidos". La pestaña **Recuperación** los sigue trabajando aunque estén en Perdido |
| 9 | **Repartir la cartera** | **Tú** (bulk edit en Kommo) | ⬜ **2 asesores de 5 tienen carga.** Con el embudo ya limpio son ~47 leads activos, no miles |
| 10 | `kommo-sync` con nombres de asesor | Coordinación | ✅ 5 en `kommo_users` |

## Lo que queda, en una línea

**Sólo dos pasos, y los dos son tuyos en el navegador de Kommo: el 2 (crear los
5 campos comerciales) y el 9 (repartir la cartera).** Todo lo técnico está
cerrado.

## ⚠️ El vínculo cliente↔Kommo: no es una ganancia automática

La versión vieja de esta página decía *"el vínculo de los ~405 clientes va junto
al paso 6"*, como si fuera un paso más. **Medido, no lo es.**

| | |
|---|---|
| Clientes en el ERP | 449 |
| …con `kommo_contact_id` | **33** |
| …con `kommo_lead_id` | **1** |
| …con teléfono de 10 dígitos usable | 256 |
| **Emparejables por teléfono contra Kommo** | **61** (⇒ **28** nuevos sobre los 33 que ya están) |
| De esos, ambiguos (más de un contacto Kommo con el mismo teléfono) | 7 |

Cruzar teléfonos —que ahora es barato, con el índice `phone_last10` de la
migración 0363— sube el vínculo de 33 a ~61 de 449. **13,6%.** No es un
problema de implementación: la mayoría de los clientes de DTD nunca fueron
contactos de Kommo, porque la cartera es anterior al CRM o entró por fuera.

**Qué SÍ y qué NO depende de esto:**

- **No depende:** mover de etapa, reasignar, etiquetar, y todo el tablero. Esos
  verbos trabajan directo sobre `kommo_leads`, sin pasar por `clients`.
- **Sí depende:** empujar automáticamente a Kommo el **Shipping Mark**, el saldo
  pendiente y la carga en tránsito del cliente. Sin llave no hay a quién
  escribirle.

Decidir si eso vale una campaña de vinculación manual es una decisión de
negocio, no un pendiente técnico. Se documenta acá para que nadie lo vuelva a
listar como "un paso que falta".

## Reglas que no se rompen

- Nunca borrar un embudo con leads dentro.
- La bandeja de entrada (**Incoming leads**) no acepta que le muevan un lead
  *hacia* ella por API — Kommo devuelve `400 NotSupportedChoice`. El ERP ya la
  excluye como destino; si la ves ofrecida en algún lado, es un bug.
- Los créditos de IA de Kommo se agotan alrededor del **18-ago** (renovación el
  29-ago). Si el agente se apaga, dejan de entrar leads nuevos que mirar —
  detalle en [`kommo-consumo-y-limites.md`](kommo-consumo-y-limites.md).

## Dónde está el resto

- Foto completa y pendientes: [`kommo-estado-y-pendientes.md`](kommo-estado-y-pendientes.md)
- Consumo, límites y ping de 23 h: [`kommo-consumo-y-limites.md`](kommo-consumo-y-limites.md)
- Cómo se opera desde el ERP (normativo): [`../specs/0256-crm-outbox-operable/spec.md`](../specs/0256-crm-outbox-operable/spec.md)
- Consolidación del embudo: [`../runbooks/kommo-consolidacion-embudo-unico.md`](../runbooks/kommo-consolidacion-embudo-unico.md)
