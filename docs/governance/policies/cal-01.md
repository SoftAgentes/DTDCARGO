# CAL-01 v1.0 — Calendario operativo

| Control | Valor |
|---|---|
| Estado | aprobada — adopción parcial |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-005 |
| Base actual | [SDD-0141](../../specs/0141-calendario-norte/spec.md) |

## Contrato

- Mes responde “qué días”; semana, “cuándo y cuánto se solapa”; agenda, “qué sigue”.
- Hoy, selección, feriado y estado operativo tienen semántica distinta.
- Todo evento declara si es fecha local, instante con timezone o rango.
- La zona horaria se muestra cuando puede cambiar el día; no se corta un
  `timestamptz` en UTC para presentar fecha local.
- Filtros preservan URL/estado cuando afecta navegación compartible.
- Seleccionar día/evento abre detalle con vínculo al registro fuente.
- Reprogramar valida permisos, períodos, dependencias y conflictos; drag tiene
  alternativa DAT-01/formulario y DND-01.
- Eventos de solo lectura no aparentan ser movibles.
- Móvil prioriza agenda/día y conserva acceso a mes/semana sin celdas ilegibles.

## Estado actual

Existen Mes/Semana/Agenda, filtros y drawer. SDD-0217 cerró el riesgo off-by-one:
los `timestamptz` se convierten al día civil de la zona IANA del perfil, la zona
se muestra en pantalla y el query amplía límites antes del filtro local.

La adopción continúa parcial porque Semana/Agenda reutilizan el set mensual y
Slice 2 de SDD-0141 difirió reprogramación, exportar ICS y detectar impactos.
Zarpe, arribo y entrega actuales son hechos derivados, no fechas planificadas
editables: reprogramarlos sería falsear la fuente. DAT-01 permanece `no aplica`
en este flujo hasta que un SDD defina la entidad/fecha planificada, permisos,
dependencias y conflictos.

## Gate

Probar fin/inicio de mes/año, timezone VE/CN, medianoche, solapamiento, filtros,
sin eventos, error parcial, teclado, móvil y reprogramación con conflicto.
