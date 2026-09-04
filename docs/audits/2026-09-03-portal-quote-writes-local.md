# Auditoría local · escrituras de cotizaciones Portal

Fecha: 2026-09-03

Alcance: SDD-0395, solicitar cotización y avanzar estimado con fixtures locales.

Fuera de alcance: cotizaciones, estimados o avisos reales, Cloud, push, `main`,
despliegue y limpieza.

## Hallazgo y correctivo

Ambas acciones derivaban sólo el cliente antes de elevar. La solicitud releía el
tenant con admin; el avance confiaba en el tenant de la fila y filtraba sólo por
Shipping Mark. RED 3/3 confirmó construcción admin con principal inválido, tenant
legado y ausencia de tenant en lectura/UPDATE.

Ahora ambas derivan el principal completo antes de construir admin. Correlativo,
lectura, INSERT, UPDATE y aviso usan tenant + Shipping Mark canónicos; no se
relee identidad desde una fila privilegiada. Se conservaron validación,
idempotencia, mensajes, revalidación y redirect.

## Evidencia ejecutada

- Reproducción RED: 3/3 fallos causales.
- Focales + contratos históricos: 18/18 verdes.
- Conjunto Portal: 895/895 en 69 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración; no se enviaron avisos.

## Revisión focal de datos personales

- Datos ya existentes: Shipping Mark, nombre, servicio, origen/destino,
  descripción, volumen/peso/cajas y nota. No se agregaron campos, categorías,
  terceros ni destinos.
- **CORRECTO:** las escrituras cubiertas validan y fijan el principal completo
  antes de elevar privilegios.
- **NO VERIFICABLE:** contenido real, retención, avisos efectivos, backups y
  comportamiento de Cloud, porque no se consultaron datos alojados ni se llamó a
  proveedores externos.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
