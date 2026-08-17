# Checklist CRM (Kommo) — qué falta de verdad

> **Medido contra producción el 2026-08-14.** Todos los números de esta página
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
| Conexión | `active` · último sync 14-ago 07:00 UTC |
| Write-back | `writeback_enabled = true` · `dry_run = false` → **escribe en real** |
| Embudos / etapas | **1** / **7** — sin huérfanos |
| Leads / contactos | 3.179 / 3.201 |
| Contactos con teléfono | **1.711** de 3.201 |
| Vínculos lead↔contacto | 3.191 |
| Asesores espejados | 5 |
| Cola de escritura | 4 enviadas · **0 pendientes** · 0 en error |

**Reparto del embudo (activos):** Contacto inicial 21 · Negociación 12 ·
Recontacto 10 · Incoming leads 5 · Estimado enviado 2. El resto está cerrado
(Ventas Perdidos / Logrado con éxito).

**Ningún lead activo lleva más de 30 días sin moverse.** La cartera está fresca:
no hay nada podrido que rescatar.

## Los pasos

| # | Paso | Quién | Estado medido |
|---|---|---|---|
| 1 | Sync del espejo en verde | cron 7am UTC | ✅ `active` |
| 2 | **Crear los 5 campos comerciales** de la tarjeta: Tipo comercial · Cadencia esperada · Volumen estimado · Canal de origen · Motivo de pérdida | **Tú** (Kommo → Ajustes → Campos → Leads) | ⬜ **ninguno existe** (verificado 14-ago: los 20 campos de lead son de tracking y finanzas). **Nombre literal, tipo y opciones listos para copiar:** [`kommo-campos-y-cartera.md`](kommo-campos-y-cartera.md) §1 |
| 2b | **Crear los 2 campos de CONTACTO** para el agente de IA: Tiene saldo pendiente · Carga en tránsito | **Tú** (Kommo → Ajustes → Campos → **Contactos**) | ⬜ no existen. El ERP ya sabe calcularlos y encolarlos (SDD-0256 B4), pero nace inerte hasta que elijas los campos. ⚠️ Leer la advertencia de cobertura en [`kommo-campos-y-cartera.md`](kommo-campos-y-cartera.md) §2 antes de invertir tiempo acá |
| 3 | Cargar el mapa de etapas | Tú | ✅ 4 claves en `stage_map` |
| 4 | Elegir el campo del Shipping Mark | Tú | ✅ en lead (`1570535`) **y** en contacto (`1570723`) |
| 5 | Programar el cron del drenaje | Coordinación | ✅ hecho el 11-ago (`*/15`), más *nudge* desde el ERP: la latencia bajó de **14 min 38 s** a segundos |
| 6 | Prender el write real | Coordinación con tu OK | ✅ `enabled=true`, `dry_run=false` |
| 7 | Migrar los leads de los embudos viejos al único | Tú | ✅ 1 embudo, 0 leads huérfanos |
| 8 | Decisión del cementerio | Tú | ✅ de facto: 2.877 en "Ventas Perdidos". La pestaña **Recuperación** los sigue trabajando aunque estén en Perdido |
| 9 | **Repartir la cartera** | **Tú** (ahora también desde el ERP) | ⬜ **45 de 50 leads activos están en la cuenta genérica `DTD CARGO`** y 5 sin asignar. ⚠️ Y hay algo que decidir antes: de los "5 asesores", dos son cuentas tuyas duplicadas y dos parecen accesos externos viejos — **no hay 5 asesores reales**. Detalle y orden de reparto: [`kommo-campos-y-cartera.md`](kommo-campos-y-cartera.md) §3 |
| 11 | Reasignar asesor / etiquetar / dejar nota / crear tarea **desde el ERP** | Coordinación | ✅ SDD-0256 Fases 4 y 5. Studio → CRM → un lead → **Acciones** |
| 12 | Que el ERP no pise el trabajo del asesor | Coordinación | ✅ chequeo optimista: si el lead cambió en Kommo entre el clic y el envío, la orden **no se manda** y la pantalla lo dice con un botón de reintentar |
| 10 | `kommo-sync` con nombres de asesor | Coordinación | ✅ 5 en `kommo_users` |

## Lo que queda, en una línea

**Tres pasos, y los tres son tuyos en el navegador de Kommo: el 2 (los 5 campos
comerciales), el 2b (los 2 campos de contacto) y el 9 (repartir la cartera).**
Todo lo técnico está cerrado — y desde el 14-ago los cuatro verbos (etapa,
asesor, etiquetas, nota y tarea) se operan desde el ERP.

Todo lo del navegador está en un solo documento con los nombres literales listos
para copiar: **[`kommo-campos-y-cartera.md`](kommo-campos-y-cartera.md)**.

## ⚠️ El vínculo cliente↔Kommo: no es una ganancia automática

La versión vieja de esta página decía *"el vínculo de los ~405 clientes va junto
al paso 6"*, como si fuera un paso más. **Medido, no lo es.**

**Remedido el 2026-08-14** (los números de ayer eran otros; éstos salieron de
consultar hoy):

| | |
|---|---|
| Clientes vivos en el ERP | 447 |
| …con `kommo_contact_id` | **32** (7,2%) |
| …con `kommo_lead_id` | **1** |
| **Sumables cruzando teléfono (match único)** | **+21** |
| Ambiguos (más de un contacto Kommo con el mismo teléfono) | 7 |
| **Techo alcanzable hoy** | **53 de 447 · 11,9%** |

Cruzar teléfonos —barato con el índice `phone_last10` de la 0363— sube el
vínculo de 32 a 53 de 447. **11,9%**, no 13,6%. No es un problema de
implementación: la mayoría de los clientes de DTD nunca fueron contactos de
Kommo, porque la cartera es anterior al CRM o entró por fuera.

🔴 **Y el dato que decide si vale la pena:** de los 32 clientes que SÍ están
vinculados, **cero** tienen hoy saldo pendiente o carga en tránsito. Los 2
clientes con saldo y los 6 con carga navegando del ERP no están vinculados a
ningún contacto. O sea: el job del paso 2b, encendido hoy, **no le escribiría
nada a nadie**. Vincular primero, encender después.

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
