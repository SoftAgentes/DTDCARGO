# `docs/organizacion/` — Organización de la empresa

> Cómo se organiza DTD Cargo: puestos, áreas, quién decide qué y qué hacen las personas y
> los agentes de IA. Dueño: Sam (founder) · Estado: en construcción · Fecha: 2026-10-19.

| Documento | Qué es | Estado |
|---|---|---|
| [`organigrama-paperclip.md`](organigrama-paperclip.md) | Propuesta de organigrama (personas y agentes) para Paperclip: diagnóstico, puestos, asignación de personas, el CEO, riesgos y respuestas de Sam | borrador · faltan los titulares por confirmar |
| [`assets/01-organigrama-dtd-cargo.svg`](assets/01-organigrama-dtd-cargo.svg) | Organigrama gráfico por puestos | borrador |
| [`hermes-oficina.md`](hermes-oficina.md) | Diseño histórico aprobado de Hermes y Paperclip; cambios posteriores y límites remiten a SDD-0564 D11 | histórico · no usar como lista de ejecución |
| [`plan-maestro-oficina.md`](plan-maestro-oficina.md) | Evidencia fechada, plantilla de contratación ordinaria y comprobaciones pendientes para el Director | revisado 2026-10-20 · estado vivo no verificado |
| [`guia-continuar-con-hermes.md`](guia-continuar-con-hermes.md) | Guía de continuación para Sam, sin repetir configuraciones ni contrataciones documentadas | revisada 2026-10-20 · estado vivo no verificado |
| [`oficina-conocimiento/`](oficina-conocimiento/README.md) | Biblioteca de la empresa para los agentes (se publica en solo lectura en el VPS) | vigente |
| [`oficina-agentes/`](oficina-agentes/README.md) | Identidades (`SOUL`), contexto e instrucciones de Paperclip por puesto | vigente |

## Reglas de esta carpeta

- **Puestos, no personas.** Quién ocupa cada puesto vive en el ERP (`nomina_positions`,
  Studio › Nómina). Aquí no van nombres ligados a evaluaciones, cargas ni perfiles de
  empleados, ni correos, teléfonos o sueldos: el repositorio lo leen los agentes y viaja al
  proveedor del modelo. Los análisis por persona se le entregan a Sam fuera del repositorio.
- Los gráficos van en `assets/`.
- **Montos fuera de Git.** Presupuestos sugeridos sí; sueldos, saldos o costos reales no.
- Lo que se apruebe aquí y cambie reglas del repositorio o de gobierno pasa por una SDD
  (`docs/specs/`) con número asignado por el Director.
