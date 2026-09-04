# Auditoría local · activación y completitud Portal

Fecha: 2026-09-03

Alcance: SDD-0392, activación y completitud de perfil con fixtures locales.

Fuera de alcance: perfiles, fotos, direcciones o envíos reales; Storage, Cloud,
push, `main`, despliegue y limpieza.

## Hallazgo reproducido

Ambos derivados resolvían `client_id` y Shipping Mark mediante RPCs separadas.
Las lecturas de cliente, envíos y direcciones no fijaban todos los identificadores
del mismo principal. Una relación incoherente podía alcanzar el dominio.

La prueba RED falló 3/3: confirmó acceso con un vínculo tenant/cliente cruzado,
ids legados y ausencia de tenant/Shipping Mark en filtros relevantes.

## Correctivo local

- Activación y completitud derivan un único principal canónico.
- Principal inválido corta antes de clientes, envíos o direcciones.
- Aprobación/foto/dirección legacy fijan tenant + id de cliente.
- Envíos fijan tenant + Shipping Mark; direcciones fijan tenant + id + Shipping
  Mark, además de borrado lógico.
- Razones de activación, fallbacks y booleanos se conservaron.
- El comando transaccional de borrado 0427 no cambió.

## Evidencia ejecutada

- Reproducción RED: 3/3 fallos causales.
- Focales + tests históricos: 18/18 verdes.
- Conjunto Portal: 886/886 en 66 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración.

## Revisión focal de datos personales

- Datos ya existentes: Shipping Mark, aprobación Portal, foto de identidad,
  dirección y existencia de envíos. No se agregaron campos, categorías, terceros
  ni destinos.
- **CORRECTO:** los derivados cubiertos minimizan el acceso al principal
  autenticado y fijan tenant/cliente antes de consultar el dominio.
- **NO VERIFICABLE:** contenido real, retención, borrado operativo, backups,
  objetos de Storage y comportamiento de Cloud, porque no se consultaron datos
  alojados.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
