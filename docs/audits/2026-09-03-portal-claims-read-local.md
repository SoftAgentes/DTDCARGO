# Auditoría local · reclamos Portal

Fecha: 2026-09-03

Alcance: SDD-0393, lista de reclamos con fixtures locales.

Fuera de alcance: reclamos o resoluciones reales, Cloud, push, `main`, despliegue
y limpieza.

## Hallazgo y correctivo

La última lectura Portal basada en la RPC histórica resolvía sólo Shipping Mark
y no fijaba tenant. RED 2/2 confirmó consulta con identificador legado y acceso
al dominio con relación tenant/cliente incoherente.

La lista ahora deriva el principal canónico, corta antes del dominio si no es
válido y fija tenant + Shipping Mark, conservando borrado lógico, orden, límite,
campos y mapeo.

## Evidencia ejecutada

- Reproducción RED: 2/2 fallos causales; GREEN focal: 2/2.
- Conjunto Portal: 888/888 en 67 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración.

## Revisión focal de datos personales

- Datos ya existentes: Shipping Mark, descripción, tipo, monto, seguro, envío,
  contenedor y resolución del reclamo. No se agregaron campos, categorías,
  terceros ni destinos.
- **CORRECTO:** la lectura minimiza el acceso al principal autenticado y fija
  tenant/cliente antes de consultar el dominio.
- **NO VERIFICABLE:** contenido real, retención, borrado operativo, backups y
  comportamiento de Cloud, porque no se consultaron datos alojados.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
