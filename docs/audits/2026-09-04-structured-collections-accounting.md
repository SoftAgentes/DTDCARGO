# Contabilidad de Cobranzas · SDD-0436 · evidencia local

Fecha: 2026-09-04

Alcance: asiento de cobro, asiento de pago sin identificar, reclasificación y
anulación de asientos vinculados a recibos

Fuera de alcance: cobros, saldos, asientos o datos reales, permisos, RLS,
migraciones, Cloud, push, `main`, despliegues y limpieza

## Resultado

Las cuatro operaciones crean un logger canónico por invocación. Los siete
`console.error` libres se reemplazaron por eventos con correlador, operación,
etapa, estado operativo y error saneado. Los eventos no incluyen código de
recibo, factura, tenant, monto, moneda, cuenta o asiento.

La semántica financiera permanece igual: los asientos y sus anulaciones siguen
siendo best-effort; los cobros no ganan nuevos puntos de fallo y las respuestas
no cambian.

## Evidencia ejecutada

- RED: 13/13 fallos confirmaron los siete logs y eventos/loggers ausentes.
- GREEN focal: 27/27 pruebas del contrato y la identificación de pagos.
- Suite completa: 7.517/7.517 pruebas en 602 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: código 0, TypeScript y 158 rutas generadas.

El build usó una URL Supabase sintética cerrada en localhost; sus avisos de
fetch eran esperados. No consultó ni modificó cobros, recibos o asientos reales.

## Estado

- SDD-0436: **done local**.
- Logs retirados en este slice: **7**.
- Inventario legacy medido: **159** logs libres en `lib/studio`, `app/studio`,
  `app/api/studio` y `app/api/m`, excluyendo pruebas.
- Checklist general: **60/106 (56,6 %)**; la casilla de logs permanece abierta.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: no ejecutadas; el worktree se conserva.
