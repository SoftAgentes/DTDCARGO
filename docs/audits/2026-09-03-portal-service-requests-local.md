---
title: Solicitudes de recepción Portal por principal y tenant
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0381 · solicitudes de recepción Portal

## Estado

Correctivo local verificado, no publicado ni aplicado. Numeración 0381/0429
consultada en 15 refs tras d13f0968. No Cloud, datos reales, push, main,
despliegues ni limpieza final.

## Reproducción causal

El catálogo efectivo después de reconstruir425migraciones mostró tres policies
Portal PSR heredadas de0150. Sonda independiente,22 comprobaciones, con
0006/0080/0105/0118/0150/0229/0230/0417 reales:

- Portal A lee una solicitud B del mismo Shipping Mark, aunque0417 esconde
  el padre B. Editar sólo sus notas falla23514 por el trigger del padre.
- Cambiar simultáneamente tenant_id a A y prealerta_id a una compra A
  actualiza una fila B conservando su id: reasignación cross-tenant confirmada
  después como owner. USING sólo examinaba markbox; WITH CHECK y trigger NEW.
- Cliente retirado y vínculo incoherente conservan lecturas de solicitudes.
- Controles Portal propios y equipo aprobados; rollback preservó todas las filas.
  Contenedor propio retirado tras verificar ID/nombre/label.

RED persistente apply_fix=false: exit3/P0001 por lectura ajena, tras los ocho
controles causales; no es un error de importación ni de archivo ausente.
Soft delete propio falla42501 antes del correctivo y conserva la fila.
No se presenta como arreglado ni se habilita lectura de históricos para sortearlo.

Aplicación: transporte en memoria ejecuta filtros realmente, sin RLS simulada.
RED20 fallos/4 controles; implementación mínima→35/35 (24 nuevos+11 add-ons).
Falla cerrado si un opts.markbox explícito está ausente/vacío, no corresponde
al principal o el vínculo no es activo/vivo/coherente. Añade filtro tenant.
La llamada Studio sin propiedad markbox mantiene su comportamiento.

## Delta

- 0429 sólo altera SELECT/INSERT/UPDATE Portal, manteniendo consentimiento,
  trigger, ACL, políticas de equipo/servicio, índices, filas e históricos.
- Preflight exige RLS y seis policies conocidas con rol/comando/forma esperados.
  No certifica equivalencia semántica completa de definiciones previas.
- Consulta: sólo contexto y filtros de solicitudes, sin modificar las tres
  páginas Portal ni la del Studio, su mapeo, orden y límite500.
- Sin helpers globales, nuevas RPC, campos, log con PII ni mutaciones alojadas.

## Verificación local

- 100 aserciones SQL focales, incluidas 16 derivas e idempotencia: aprobadas.
- 171 contratos SQL y reconstrucción de 426 migraciones: aprobados.
- 7.173 pruebas unitarias en 554 archivos: aprobadas sin reintento.
- TypeScript, lint focal, docs, numeración, componentes, gobernanza y diff:
  aprobados.

Los E2E 150/18 de SDD-0378 no se presentan como prueba autenticada de este
nuevo delta.

## Límites y continuación

- Aplicación nominal0429 y verificación posterior, publicación y smoke externos.
- Soft delete PSR 42501 y protección de campos operativos no se cierran aquí.
- Lecturas de perfil y solicitudes de cambios son el siguiente inventario
  independiente. No declarar vulnerable cada helper sólo por su nombre.
- 29 migraciones preparadas 0401–0429 según el último ledger 0400, sin nueva
  consulta Cloud. Checklist original 56/106; no se suman subpasos nuevos.
