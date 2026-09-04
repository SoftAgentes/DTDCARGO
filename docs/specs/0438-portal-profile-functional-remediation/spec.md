---
sdd: "0438"
title: "Remediación funcional del cupo y la evidencia de perfil"
status: in-progress
author: "Codex"
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related:
  - "SDD-0435"
  - "migration:0361"
  - "migration:0445"
confidencialidad: interno
---

# SDD-0438 — Remediación funcional del cupo y la evidencia de perfil

## 1. Problema

La migración aplicada `0445_portal_profile_edit_limit.sql` introdujo un ledger
privado para limitar a tres los cambios efectivos de perfil y la RPC self-scope
`portal_set_identity_photo(text)`. Dos invariantes quedaron incompletas:

1. reemplazar `cedula_photo_path` conserva el veredicto de identidad calculado
   sobre la evidencia anterior;
2. `merge_clients` reasigna `client_change_requests.client_id`, pero el ledger
   puede seguir ligado a la ficha retirada y regalar cupo al superviviente.

`0445` ya está aplicada y por tanto es inmutable. El correctivo se entrega como
la migración posterior `0446`.

## 2. Alcance

### Incluye

- invalidar en la misma transacción `doc_verify_status`,
  `doc_verify_source`, `doc_registry_name`, `doc_verified_at` y
  `doc_verified_by` cuando el portal cambia la foto de identidad;
- mantener el asiento de `client_profile_edits` unido a una solicitud cuyo
  `client_id` sea reasignado;
- transferir al superviviente todos los asientos de la ficha retirada cuando
  `clients.merged_into_client_id` confirma una fusión;
- reparar de una vez asientos ligados a fichas ya fusionadas;
- conservar firma, self-scope, `SECURITY DEFINER`, `search_path = ''`, RLS y
  grants estrechos de `0445`;
- contrato SQL desechable con reemplazo, fusión, conflicto pendiente, conteo,
  tenant negativo y ACL.

### Fuera de alcance

- reescribir o renumerar `0445`;
- código, UI, documentos o tests de la PR #23;
- retención, purga, URLs firmadas, rollback de Storage o acceso desde China;
- aplicar `0446` en Cloud, desplegar, pushear, abrir o fusionar una PR.

Las remediaciones de privacidad y operación de archivos se trabajan en un
carril separado. Esta spec no las declara resueltas.

## 3. Decisiones

### D1 · La evidencia manda sobre el veredicto derivado

`portal_set_identity_photo(text)` conserva su API pública. Después de validar
sesión, self-scope, prefijo, existencia en Storage y cupo, actualiza la ruta e
invalida los cinco campos de verificación en un solo `UPDATE`. La auditoría sólo
registra booleanos de presencia/invalidation; no copia nombre, ruta ni documento.

### D2 · Una fusión conserva la suma, no recalcula la historia

El ledger es vitalicio. La fusión puede dejar al superviviente con más de tres
asientos históricos si ambas fichas ya habían consumido cupo; eso no es un nuevo
consumo ni una razón para perder filas. El agregado mantiene `remaining_count`
en cero y la prueba exige igual cardinalidad e IDs distintos antes y después.

Dos triggers internos separan los hechos:

- la reasignación de una solicitud mueve su asiento 1:1;
- `merged_into_client_id` mueve los asientos restantes, incluidos reemplazos de
  foto sin `request_id` y reservas conflictivas conservadas para revisión.

Ambos validan que el destino exista, esté activo y pertenezca al mismo tenant.
Un error aborta la transacción completa de `merge_clients`.

### D3 · El histórico se repara sin inventar consumos

El backfill sólo cambia `client_id` y `tenant_id` de asientos cuya ficha ya
apunta a un superviviente válido. No inserta, borra, libera ni aplica cupos.

## 4. Seguridad y datos

- Las funciones de trigger son `SECURITY DEFINER`, owner `postgres`,
  `search_path = ''` y no conceden `EXECUTE` a `public`, `anon`,
  `authenticated` ni `service_role`.
- La RPC pública conserva `EXECUTE` sólo para `authenticated` y deriva actor y
  cliente desde `auth.uid()`/`get_portal_client_id()`.
- El ledger conserva RLS sin policies y cero acceso directo para clientes.
- Las rutas y valores personales no entran al payload de auditoría.

Chequeo advisory de datos personales, limitado a este diff:

- `CORRECTO`: la nueva evidencia invalida el veredicto obsoleto y evita mantener
  como vigente un dato derivado inexacto; evidencia en migración y contrato SQL.
- `CORRECTO`: la reasignación no cruza tenant y no duplica rutas ni PII en logs.
- `NO VERIFICABLE`: retención y purga de rutas históricas, tratamiento por el
  equipo en China y ejecución real del backfill; pertenecen al carril separado
  o requieren evidencia fuera de este checkout.

Este chequeo técnico no es asesoría legal.

## 5. Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.01 | cumplimiento | La firma y significado de la RPC no cambian; sólo corrige su postcondición. |
| SGE-00.02 | cumplimiento | Fusión conserva cardinalidad e IDs del ledger; contrato fuerza el caso. |
| SGE-00.03 | cumplimiento | No agrega acción visible ni fricción; la historia vitalicia se conserva. |
| SGE-00.04 | cumplimiento | Sustitución mantiene evento atómico y registra invalidación sin PII. |
| SGE-00.05 | cumplimiento | Self-scope, tenant negativo, RLS y ACL tienen prueba contractual. |
| SGE-00.06 | cumplimiento | Targets inexistentes, retirados o cross-tenant fallan antes de mover asientos. |
| SGE-00.07 | cumplimiento | Ruta y veredicto cambian en una transacción; la fusión revierte si falla el trigger. |
| SGE-00.08 | no aplica | No cambia pasos ni frecuencia de una interfaz. |
| SGE-00.09 | cumplimiento | Reutiliza ledger, RPC y señal canónica `merged_into_client_id`. |
| SGE-00.10 | no aplica | No hay cambio de UI o interacción. |
| SGE-00.11 | no aplica | No cambia copy visible. |
| SGE-00.12 | no aplica | No interviene IA. |
| MP-01 | cumplimiento | Evidencia y ledger se conservan; no hay purga ni reescritura de historia. |
| AUD-01 | cumplimiento | La sustitución y su evento siguen atómicos; el payload es mínimo. |
| AUD-02 | no aplica | No cambia consulta, exportación, hold ni calendario de auditoría. |

## 6. Allowlist exacta

- `docs/specs/0438-portal-profile-functional-remediation/spec.md`
- `docs/specs/README.md` (generado)
- `supabase/migrations/0446_portal_profile_functional_remediation.sql`
- `supabase/tests/0446_portal_profile_functional_remediation.test.sql`

## 7. Criterios de aceptación

- [x] `0445_portal_profile_edit_limit.sql` permanece byte a byte sin cambios.
- [x] Reemplazar la foto deja los cinco campos `doc_verify_*`/registro en `NULL`.
- [x] La auditoría declara la invalidación sin copiar ruta, nombre o documento.
- [x] Una solicitud reasignada conserva exactamente un asiento asociado.
- [x] La fusión deja cero asientos en la ficha retirada y conserva cardinalidad.
- [x] El caso cross-tenant revierte sin mover asientos.
- [x] `authenticated` conserva sólo la RPC self-scope; los triggers no son API.
- [x] El contrato SQL `0446` pasa en PostgreSQL desechable.
- [x] `docs:check`, `governance:check`, `components:check`, numbering y rebuild
      local pasan.
- [ ] Aplicación Cloud permanece pendiente de autorización nominal separada.

## 8. Estado de entrega

Implementación y gates locales completos el 2026-09-04. La spec permanece
`in-progress` porque la aplicación nominal de `0446` en Cloud conserva su gate
independiente.
