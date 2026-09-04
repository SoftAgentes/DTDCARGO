# Auditoría local · consumidores de compras Portal

Fecha: 2026-09-03

Alcance: SDD-0399, seis páginas de Compras/Proveedores, consultas RLS de
compras y el firmador de adjuntos, exclusivamente con fixtures locales.

Fuera de alcance: datos reales, contenido de Storage, Cloud, schema alojado,
push, `main`, despliegue y limpieza.

## Hallazgo y correctivo

Las páginas todavía reducían el principal Portal al objeto `client`. Aunque las
policies RLS ya acotan las entidades cubiertas, las llamadas de aplicación
perdían el `tenantId` autenticado y filtraban explícitamente sólo por Shipping
Mark. El firmador de adjuntos repetía ese alcance incompleto antes de construir
el cliente de Storage privilegiado.

Los seis consumidores ahora exigen el principal completo y propagan
`tenantId + Shipping Mark`. La consulta documental agrega el tenant a
`prealertaId + Shipping Mark` antes de firmar; el helper de solicitudes rechaza
un tenant suministrado que no coincida con el derivado de la sesión. No se
amplió ningún permiso ni se agregó una construcción de `service_role`.

## Evidencia ejecutada

- RED causal: 12/12 contratos fallaron sobre los consumidores anteriores.
- Focales e históricos: 47/47 verdes en cuatro archivos.
- Regresión Portal: 928/928 en 73 archivos.
- TypeScript, ESLint focal y lint global: verdes.
- Documentación, numeración, gobernanza, componentes y `git diff --check`:
  verdes.
- No se creó ni aplicó migración; no hubo lectura de filas o Storage real.

## Clasificación

- `SGE-00.05` — **cumplimiento:** autorización y minimización conservan tenant,
  cliente y Shipping Mark durante la lectura.
- Demás principios SGE-00 — **no aplica:** no cambia UI, acción, persistencia,
  auditoría ni comportamiento visible.
- Cloud/producción — **NO VERIFICABLE:** no se consultaron sistemas alojados.
