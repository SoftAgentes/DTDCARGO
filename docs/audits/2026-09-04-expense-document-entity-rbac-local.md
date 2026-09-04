# Documentos de gastos · SDD-0406 / 0438 · evidencia local

Fecha: 2026-09-04

Alcance: consumidores del Portal/Studio, helper documental y PostgreSQL desechable

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgos reproducidos

- El enum PostgreSQL aceptaba `expense`, pero el Hub de Documentos no lo incluía
  ni podía enlazarlo al módulo Gastos.
- Reautorizar y finalizar adjuntos autenticaban al usuario, pero omitían el guard
  de edición que ya protegía reserva y restauración.
- Tras 0437, el helper documental devolvía `true` para `expense`: Comercial podía
  leer y mutar metadatos, binarios y colas del tenant sin permiso de Gastos.
- El helper anterior no expresaba vista/edición ni podía honrar overrides por
  tenant.

## Correctivo preparado

0438 instala `document_entity_authorized(text, uuid, text)`, ligado a membresía
activa del tenant exacto. Los cuatro tipos financieros conservan su candado
`accounting`/`admin`; `expense` replica defaults y overrides de `expenses`, con
el invariante de que `support` nunca edita.

La policy `ALL` de `documents` se divide en lectura, inserción y actualización.
Las policies de Storage, intents y restauración usan `view` o `edit` según la
operación; los tres triggers de respaldo para RPC privilegiadas exigen `edit`.
El wrapper previo queda sólo por compatibilidad y ninguna policy activa depende
de él.

En aplicación, `expense` queda tipado y enlazado a `/studio/gastos`; los endpoints
de reautorización y finalización ejecutan `moduleEditDenial(client, "expenses")`
antes de firmar o tocar la reserva. El bucket `erp-attachments` no cambia: sigue
sin policies amplias para `authenticated` y se opera mediante URLs exactas
firmadas por servidor.

## Evidencia ejecutada

- RED de aplicación: cuatro fallos causales en tipo, deep-link y dos mutaciones.
- RED SQL: Comercial veía las cuatro superficies de gastos en el estado de 0437.
- GREEN focal: 63/63 pruebas de tipo, Hub y endpoints; suite de dominio 64/64.
- Regresión completa: 576 archivos y 7.296/7.296 pruebas.
- GREEN SQL focal: defaults, overrides positivos/negativos, `support` read-only,
  usuario desactivado, tenant inyectado, Storage y tres RPC privilegiadas.
- SQL completo: 180/180 contratos con rollback total.
- Rebuild: 435 migraciones inventariadas, 417 aplicadas desde cero, 18
  sólo-ledger, 219 tablas y dos tenants del arnés.
- TypeScript y lint: verdes.
- Numeración revalidada contra 15 refs: spec 0406 y migración 0438 libres.

## Estado y límites

- Local: **CORRECTO** para documentos y adjuntos de gastos.
- Producción: **NO VERIFICABLE**; 0438 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %); el frente RBAC documental permanece
  abierto para entidades con otras matrices.
- Migraciones locales preparadas: 38 (0401–0438), tomando 0400 como último
  ledger alojado verificado previamente.
