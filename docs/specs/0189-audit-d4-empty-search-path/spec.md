---
sdd: "0189"
title: "Auditoría D4 — search_path vacío en RPC logísticas R3"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0154", "0155", "0174"]
confidencialidad: interno
---

# SDD-0189 — Auditoría D4 · search_path vacío en RPC logísticas R3

## 1. Problema

El bridge D4 ya enruta los eventos legacy hacia el writer contractual, pero
cinco RPC `SECURITY DEFINER` conservaban `search_path = pg_catalog, public`.
Ese path es fijo, aunque no cumple el contrato estricto de path vacío.

Un cambio directo de configuración rompería `operario_action`: su cuerpo
vigente contiene dos casts de enum sin esquema.

## 2. Decisión

La migración correctiva:

1. exige las cinco firmas, owner `postgres`, `SECURITY DEFINER` y el path legacy;
2. obtiene el cuerpo instalado de `operario_action`;
3. cualifica únicamente `warehouse_receipt_event_type` y
   `warehouse_receipt_ve_status` como tipos `public`;
4. conserva el resto del cuerpo, las firmas, owner y ACL;
5. fija `search_path = ''` en las cinco RPC;
6. falla si las postcondiciones de path, owner o ACL service-role-only no se
   cumplen.

No se reimplementa la lógica logística ni se modifica una migración histórica.

## 3. Allowlist

- `supabase/migrations/0296_audit_d4_empty_search_path.sql`
- `supabase/tests/0296_audit_d4_empty_search_path.test.sql`
- esta spec, revisión, registro, mapa, índice generado y línea base.

No abre callers, UI, lógica de estiba, payloads, Cloud, Vercel ni Producción.

## 4. Aceptación

- las cinco funciones siguen siendo `SECURITY DEFINER` con owner `postgres`;
- las cinco quedan con `search_path = ''`;
- sólo `service_role` y owner conservan ejecución;
- `anon` y `authenticated` no ejecutan;
- los dos casts de enum quedan cualificados;
- las cinco firmas ejecutan en el fixture con path vacío;
- la prueba SQL termina en rollback;
- gates documentales y `diff --check` pasan.

## 5. Resultado y gate externo

El slice local retira la no conformidad D4 descrita por REV-AUD-021. La
migración `0296_audit_d4_empty_search_path` no está autorizada ni aplicada en
Producción; requiere autorización nominal individual separada.
