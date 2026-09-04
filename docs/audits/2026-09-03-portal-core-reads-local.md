# Auditoría local · lecturas núcleo Portal

Fecha: 2026-09-03

Alcance: SDD-0391, lista/detalle de envíos y facturas, documentos y próximo
arribo, con fixtures locales.

Fuera de alcance: datos o archivos reales, Storage, Cloud, push, `main`,
despliegue y limpieza.

## Hallazgo reproducido

Las seis lecturas resolvían sólo Shipping Mark mediante la RPC histórica y no
fijaban tenant en sus consultas. Una relación activa pero incoherente podía
alcanzar las tablas de dominio antes de la defensa RLS alojada.

La prueba RED falló 5/5: confirmó seis consultas con el Shipping Mark legado,
ausencia de tenant y acceso al dominio con relación tenant/cliente cruzada.

## Correctivo local

- Las seis lecturas derivan el principal canónico y cortan antes del dominio si
  sesión, vínculo, cliente vivo o coherencia tenant/cliente no son válidos.
- Envíos, facturas y documentos fijan tenant + Shipping Mark.
- Se conservaron códigos, exclusión de borradores, borrado lógico, orden, límites,
  mapeos y cálculo de ETA.
- Descargas, Storage y flujos Studio/admin no cambiaron.

## Evidencia ejecutada

- Reproducción RED: 5/5 fallos causales.
- Focales + tests históricos: 24/24 verdes.
- Conjunto Portal: 883/883 en 65 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración.

## Revisión focal de datos personales

- Datos ya existentes: Shipping Mark, facturas, líneas/montos, envíos, rutas,
  pesos/volúmenes, documentos y punteros privados. No se agregaron campos,
  categorías, terceros ni destinos.
- **CORRECTO:** las lecturas cubiertas minimizan el acceso al principal
  autenticado y fijan tenant/cliente antes de consultar el dominio.
- **NO VERIFICABLE:** contenido real, retención, borrado operativo, backups,
  objetos de Storage y comportamiento de Cloud, porque no se consultaron datos
  alojados.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
