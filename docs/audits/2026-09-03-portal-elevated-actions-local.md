# Auditoría local · acciones elevadas de Referidos y Reclamos

Fecha: 2026-09-03

Alcance: SDD-0396, invitación de referidos y creación de reclamos con fixtures
locales.

Fuera de alcance: invitaciones, correos, reclamos, evidencias o datos reales,
Cloud, push, `main`, despliegue y limpieza.

## Hallazgo y correctivo

Ambas acciones resolvían sólo el cliente y después construían un cliente
`service_role` para volver a leer su tenant. RED 4/4 confirmó que un principal
inválido no impedía la elevación, que se usaba el tenant legado y que el embarque
de un reclamo no fijaba tenant + Shipping Mark en su lectura administrativa.

Ahora ambas derivan el principal completo antes de construir admin y cortan sin
DML cuando no existe. Referidos usa tenant, cliente y Shipping Mark canónicos
sin releer `clients`. Reclamos fija tenant + Shipping Mark al validar el
embarque y registra el tenant, cliente y usuario canónicos.

## Evidencia ejecutada

- Reproducción RED: 4/4 fallos causales.
- Focales GREEN: 4/4.
- Conjunto Portal: 899/899 en 70 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración; no se enviaron correos ni adjuntos.

## Revisión focal de datos personales

- Datos ya existentes: nombre, correo, Shipping Mark, tipo/descripción del
  reclamo, referencia de embarque y evidencias opcionales.
- **CORRECTO:** las acciones cubiertas validan el principal completo antes de
  elevar y minimizan el scope administrativo al tenant/cliente autenticado.
- **NO VERIFICABLE:** contenido real, entrega de correo, retención, Storage,
  backups y comportamiento de Cloud, porque no se consultaron datos alojados ni
  se llamó a proveedores externos.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
