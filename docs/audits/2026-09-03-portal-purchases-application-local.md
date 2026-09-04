# Auditoría local · compras Portal por principal y tenant

Fecha: 2026-09-03

Alcance: SDD-0389, alta de compra, solicitud de servicio, detalle y helpers
consumidos por esas acciones, con fixtures locales.

Fuera de alcance: aplicar 0417, adjuntos o compras reales, Cloud, push, `main`,
despliegue y limpieza.

## Hallazgo reproducido

Las tres acciones resolvían Shipping Mark y tenant por RPCs separadas. La lectura
del proveedor, la compra por código y el catálogo de add-ons no fijaban tenant en
todos sus filtros explícitos. Un principal incoherente podía alcanzar el dominio
antes de que la migración 0417 aportara la defensa RLS preparada.

La reproducción falló 6/6: cuatro contratos de acciones confirmaron principal
inválido y scopes legados; dos contratos de helpers confirmaron la ausencia del
tenant en compra y catálogo.

## Correctivo local

- Alta, solicitud de servicio y detalle derivan un único principal canónico.
- Principal inválido corta antes de proveedor, compra, add-ons o DML.
- Proveedor y compra fijan tenant + Shipping Mark; el catálogo fija tenant.
- Compra, solicitud, actualización del proveedor y detalle persisten o filtran
  tenant + Shipping Mark derivados, nunca los enviados por el formulario.
- Adjuntos y eventos reciben esos mismos identificadores ya validados; se
  conservan consentimiento, reintentos, idempotencia y comportamiento best-effort.

## Evidencia ejecutada

- Reproducción RED: 6/6 fallos causales.
- Focales + test histórico: 15/15 verdes.
- Conjunto Portal + Prealertas: 1.025/1.025 en 72 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó una migración nueva. 0417 continúa preparada y sin aplicar.

## Revisión focal de datos personales

- Datos ya existentes: Shipping Mark, proveedor/contacto/WeChat, descripción,
  tracking, cajas, valor estimado, notas, consentimiento, servicios y adjuntos.
  No se agregaron campos, categorías, terceros ni destinos.
- **CORRECTO:** el flujo cubierto deriva el principal autenticado y fija
  tenant/cliente antes de leer, escribir o elevar para adjuntos/eventos.
- **NO VERIFICABLE:** contenido real, retención, borrado operativo, backups,
  objetos de Storage, transferencias y comportamiento de Cloud/0417, porque no se
  consultaron datos alojados ni se aplicó la migración.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
