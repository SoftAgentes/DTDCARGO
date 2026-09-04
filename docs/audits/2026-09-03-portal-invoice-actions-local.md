# Auditoría local · acciones de facturas Portal

Fecha: 2026-09-03

Alcance: SDD-0397, aceptación legal y creación/cancelación de reportes de pago
con fixtures locales.

Fuera de alcance: aceptaciones, pagos, comprobantes, avisos o datos reales,
Cloud, push, `main`, despliegue y limpieza.

## Hallazgo y correctivo

Aceptación y reporte derivaban sólo el cliente, construían un cliente
`service_role` y volvían a leer su tenant con privilegios. La cancelación usaba
el helper legado antes de enviar el RPC de sesión. RED 5/5 confirmó elevación
con principal inválido, tenant legado y envío del comando por el camino anterior.

Ahora los tres flujos derivan el principal completo. Aceptación y reporte cortan
antes de construir admin y usan tenant + Shipping Mark canónicos sin releer
`clients`; cancelación exige el mismo principal antes del RPC. Se conservaron
evidencia legal, idempotencia, Storage, avisos y comandos auditados.

## Evidencia ejecutada

- Reproducción RED: 5/5 fallos causales.
- Focales + contratos históricos: 61/61 verdes.
- Conjunto Portal: 903/903 en 71 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración; no se enviaron comandos o avisos reales.

## Revisión focal de datos personales

- Datos ya existentes: Shipping Mark, factura, monto, método/fecha/nota de pago,
  comprobante, IP, user-agent y evidencia de aceptación.
- **CORRECTO:** las acciones cubiertas validan el principal completo antes de
  elevar y minimizan el scope administrativo al tenant/cliente autenticado.
- **NO VERIFICABLE:** contenido real, validez operativa de evidencias, retención,
  Storage, backups y Cloud, porque no se consultaron datos alojados ni proveedores.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
