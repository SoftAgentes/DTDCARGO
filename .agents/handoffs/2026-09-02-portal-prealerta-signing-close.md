# Cierre técnico · SDD-0340 firmador acotado de adjuntos

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · SIN CAMBIOS A STORAGE

## Resultado

- La página Etiquetas ya no construye `service_role`.
- El firmador `server-only` recibe sólo prealerta id y Shipping Mark.
- Antes de elevarse, relee los documentos mediante la consulta existente sujeta
  a RLS; el caller nunca entrega un path de Storage.
- Sólo firma los paths retornados por esa lectura y, ante fallo, conserva
  metadatos con URL nula.
- El inventario RSC bajó de 9 rutas / 17 construcciones a 8 rutas / 16.

## Evidencia

- Pruebas focales: 2 archivos / 6 pruebas.
- Suite completa: 514 archivos / 5.905 pruebas.
- TypeScript, ESLint focal, `docs:check`, gobernanza, componentes y diff: OK.

## Gates preservados

- No se modificaron policies, objetos ni contenido de `prealerta-docs`.
- No hubo migración, Cloud, Producción, push, integración o deploy.
