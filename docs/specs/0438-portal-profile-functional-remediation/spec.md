---
sdd: "0438"
title: "Remediación funcional del cupo y la evidencia de perfil"
status: in-progress
author: "Codex"
created: 2026-09-04
updated: 2026-09-06
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

El backfill sólo cambia `client_id`, conservando `tenant_id`, de asientos cuya ficha ya
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
- [x] El contrato SQL `0446` pasa en PostgreSQL desechable, incluida la cadena histórica de dos saltos.
- [ ] `docs:check`, `governance:check`, `components:check`, numbering y rebuild
      local pasan.
Release separado: aplicación Cloud pendiente de autorización nominal; no es una prueba preintegración.

## 8. Estado de entrega

La entrega inicial de 2026-09-04 tuvo validación local. La aceptación se reabre por la cadena histórica y permanece in-progress hasta revisión de esta corrección. Cloud es un gate de release independiente, no la causa del estado SDD.

## 9. Corrección de cadena histórica · 2026-09-06

Task pr26-profile-merge-chain-20260906. Base PR26 7f68d384; main incorporado74bb52ab.
El auditor reprodujo A→B→C con merge_clients0361 real antes de0446: B ya retirado
hacía abortar el guard de un solo salto aunque C era un superviviente válido.
No se afirma que esa cadena exista en producción: el caso es sintético.

Metadata list_migrations de producción consultada con autorización:409entradas,
0445 presente (20260904193612),0446 no consta. No se leyeron filas de negocio ni
se escribió en Cloud. El Director autorizó corregir0446 aún no aplicada;0445 es
inmutable. La ausencia del ledger no prueba ausencia de SQL manual sin registrar.

El nuevo bloque recorre cada origen con ledger hasta su terminal y detecta visitas
repetidas sin limitar arbitrariamente la longitud. Verifica tenant en todos los
saltos, incluido el origen contra el tenant del asiento. Rechaza destino ausente,
terminal retirado sin sucesor y nodo activo que señale una fusión. Solo reasigna
client_id; preserva todos los otros campos/IDs/estados/cuotas. No comprime ni borra
la historia clients.merged_into_client_id. Los triggers/RPC/ACL fuera del backfill
conservan el código original.

Un lock transaccional SHARE ROW EXCLUSIVE en clients y client_profile_edits evita
que el grafo o ledger cambien mientras se resuelven los terminales. Es reparación
única de release, no parte de cada petición. Debe planificarse la ventana y medirse
latencia/volumen antes de aplicar; no se afirma rendimiento sobre datos productivos.

Allowlist adicional aprobada:

- scripts/qa/profile-merge-chain.mjs
- .agents/handoffs/pr26-profile-merge-chain-20260906.md

Prueba reproducible, sin npm ni.env, con Docker PostgreSQL17 propio y sin red:

```powershell
node scripts/qa/profile-merge-chain.mjs --baseline-ref 7f68d38436a75ca3a84c087ca36d689f79ecd31e --privacy-ref 82fc49ff0a81c88929fdd0493ded27e9e8c1f0a2
```

El runner exige SHA completos y falla si falta el blob0447. Lee migraciones reales
0361/0445/0446 del checkout;0447 y baseline por git show. Soporte de tablas del
fixture0358 y auditoría del contrato0446; no es un rebuild integral. El cleanup
finally solo retira su contenedor creado por el propio runner. No usa directorios
ni credenciales de otra sesión. Para obtener refs faltantes, coordinar lectura/fetch
con Director; no cambia el código0447 ni aplica su política de Storage por separado.

Cobertura: RED original y GREEN corregido A→B→C,16saltos reales,fan-in,idempotencia,
ciclo,self-loop,destino inexistente/retirado,tenant intermedio/terminal/ledger,
origen activo inválido,rollback de un UPDATE válido previo y DDL/RPC/historia,
y0445→0446→0447 con fusiones reales repetidas,cuota agotada y ACL del ledger.

Gobernanza: cumplimiento de conservación, tenant y fallo atómico; no aplica UI.
Privacidad advisory: CORRECTO en0446 bloque backfill, solo reasigna vínculo interno,
no copia valores personales y mantiene tenant; NO VERIFICABLE retención/logs de
infraestructura y tiempos en producción. No se afirma cumplimiento legal.

Esta corrección no absorbe la incidencia Storage de PR27. No hay push/main/Cloud.
Verify/build masivo NO EJECUTADO por coordinación de recursos de PR28; evidencia
focal y estado final se conservan en el handoff propio. La revisión independiente
y aceptación permanecen pendientes.