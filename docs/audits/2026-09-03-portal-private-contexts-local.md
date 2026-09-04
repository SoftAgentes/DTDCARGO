# Auditoría local · contextos privados Portal

Fecha: 2026-09-03

Alcance: SDD-0398, siete fachadas privadas de Portal y scopes de consultas de
compras/proveedores/documentos con fixtures locales.

Fuera de alcance: conversaciones, facturas, embarques, compras, documentos o
datos reales, Cloud, push, `main`, despliegue y limpieza.

## Hallazgo y correctivo

Siete fachadas derivaban sólo el cliente antes de construir `service_role`; cinco
releían su tenant desde `clients` con privilegios. El hub y el detalle operativo
de compra no pasaban siempre el tenant ya autenticado a compras, proveedores y
presencia documental. RED 12/12 fijó esa arquitectura anterior.

Ahora las siete fachadas exigen el principal completo antes de elevar. Se
eliminaron las cinco relecturas admin de tenant y se propagan tenant + Shipping
Mark canónicos a las consultas RLS cubiertas. Se conservaron fallbacks seguros,
contratos de salida, firma de documentos, conversaciones y derivados internos.

## Evidencia ejecutada

- Reproducción RED arquitectónica: 12/12 fallos causales.
- Focales + contratos históricos: 51/51 verdes.
- Conjunto Portal + Prealertas: 1.068/1.068 en 81 archivos.
- Suite global posterior: 7.274/7.274 en 573 archivos, sin reintento.
- TypeScript, ESLint focal y lint global: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración; no se consultaron filas o Storage real.

## Revisión focal de datos personales

- Datos ya existentes: identidad Portal, Shipping Mark, conversaciones,
  facturas, embarques, compras, proveedores, evidencias y documentos.
- **CORRECTO:** las fachadas cubiertas validan el principal completo antes de
  elevar y conservan tenant + Shipping Mark durante las lecturas.
- **NO VERIFICABLE:** contenido real, retención, URLs firmadas, Storage, backups
  y comportamiento de Cloud, porque no se consultaron sistemas alojados.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
