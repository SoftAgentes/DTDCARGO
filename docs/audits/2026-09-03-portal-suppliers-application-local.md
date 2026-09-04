# Auditoría local · proveedores Portal por principal y tenant

Fecha: 2026-09-03

Alcance: SDD-0388, CRUD de proveedores en la capa de aplicación y fixtures
locales.

Fuera de alcance: acciones de compras/prealertas, aplicar 0417, Cloud, datos
reales, push, `main`, despliegue y limpieza.

## Hallazgo reproducido

Alta, edición y borrado resolvían Shipping Mark con una RPC histórica. El alta
obtenía el tenant mediante una segunda RPC; edición, comprobación de compras y
borrado lógico no fijaban tenant en sus filtros. Una relación incoherente podía
llegar al dominio antes de que la migración 0417 aportara la defensa RLS
preparada.

La prueba RED falló 5/5: confirmó DML con principal inválido, tenant legado en el
INSERT y ausencia del filtro tenant en duplicados, edición y borrado.

## Correctivo local

- Las tres acciones derivan un único principal canónico antes del dominio.
- Principal inválido produce cero consultas o DML de proveedores/compras.
- Duplicados, edición, comprobación de compras y borrado lógico fijan
  `tenant_id`, Shipping Mark, id y vigencia según corresponda.
- El INSERT deriva tenant y Shipping Mark del principal; conserva secuencia,
  perfil extendido, validaciones, mensajes y revalidaciones.

## Evidencia ejecutada

- Prueba focal SDD-0388: RED 5/5; GREEN 5/5.
- Test histórico de detalle de compra: 9/9 verde.
- Conjunto Portal actual: 870/870 en 62 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó una migración nueva. 0417 continúa preparada y sin aplicar.

## Revisión focal de datos personales

- Datos ya existentes: nombre, ciudad, contacto, WeChat, notas y perfil del
  proveedor. No se agregaron campos, categorías, terceros ni destinos.
- **CORRECTO:** la aplicación minimiza el acceso al principal autenticado y fija
  tenant/cliente antes de leer o escribir el CRUD cubierto.
- **NO VERIFICABLE:** contenido real, retención, borrado operativo, backups,
  transferencias y comportamiento de Cloud/0417, porque no se consultaron datos
  alojados ni se aplicó la migración.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
