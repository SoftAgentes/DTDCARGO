# Auditoría local · lecturas Portal de pagos y eventos

Fecha: 2026-09-03

Alcance: SDD-0390, reportes de pago de una factura, hitos de un envío y actividad
reciente, con fixtures locales.

Fuera de alcance: datos o comprobantes reales, Cloud, push, `main`, despliegue y
limpieza.

## Hallazgo reproducido

Las tres lecturas resolvían sólo el Shipping Mark mediante la RPC histórica y no
fijaban tenant en sus filtros explícitos. Una relación activa pero incoherente
podía alcanzar reportes o eventos antes de que RLS aportara la defensa alojada.

La prueba RED falló 4/4: confirmó consultas con el Shipping Mark legado, ausencia
de tenant y acceso al dominio con una relación tenant/cliente incoherente.

## Correctivo local

- Las tres lecturas derivan el principal canónico y cortan antes del dominio si
  sesión, vínculo, cliente vivo o coherencia tenant/cliente no son válidos.
- Reportes fijan código de factura, tenant y Shipping Mark.
- Hitos y actividad fijan tenant del evento, tenant del envío y Shipping Mark del
  principal, conservando orden y límite.
- Los flujos Studio/admin permanecen sin cambios.

## Evidencia ejecutada

- Reproducción RED: 4/4 fallos causales.
- Focales + tests históricos: 38/38 verdes.
- Conjunto Portal: 878/878 en 64 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración.

## Revisión focal de datos personales

- Datos ya existentes: Shipping Mark, reporte/monto/método/fecha/comprobante,
  código y eventos del envío. No se agregaron campos, categorías, terceros ni
  destinos.
- **CORRECTO:** las lecturas cubiertas minimizan el acceso al principal
  autenticado y fijan tenant/cliente antes de consultar el dominio.
- **NO VERIFICABLE:** contenido real, retención, borrado operativo, backups,
  objetos de comprobantes y comportamiento de Cloud, porque no se consultaron
  datos alojados.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
