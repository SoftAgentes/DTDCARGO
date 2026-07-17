---
sdd: "0157"
title: "Modo consolidación del operario · pedir contenedor → oficina autoriza → estibar"
status: in-progress
author: "founder"
created: 2026-07-17
updated: 2026-07-17
supersedes: null
superseded_by: null
related: ["0155", "0154", "0153", "0047"]
confidencialidad: interno
---

# DTD-0157 — Modo consolidación del operario

## 1. Resumen en una línea

El operario del hub (China) puede **pedir abrir un contenedor** desde `/m/cn`; la
**oficina lo autoriza** desde el Studio (con aviso); recién ahí el contenedor pasa a
`consolidando` y el operario puede **estibar por lotes** (SDD-0155). Hoy el operario
**no tiene forma de abrir un contenedor** — solo la oficina, en `/studio/naviera`.

## 2. Problema (medido 2026-07-17)

- `/m/cn/estibar` solo **lista** consolidaciones ya en `consolidando` y estiba en
  ellas; **no puede crear una** (verificado en código + operación real).
- Abrir un contenedor vive solo en Studio (`createConsolidation`, guardado por
  `moduleEditDenial('naviera')`). El operario que físicamente consolida en el galpón
  no tiene acceso a Studio.
- Consecuencia: si la oficina no abrió el contenedor antes, el operario queda
  bloqueado — no puede empezar a montar aunque la carga esté lista.
- (Contexto: el bug de grant `next_consolidation_ref` que bloqueaba abrir contenedor
  para TODOS se corrigió en la migración 0247; este spec es la capa de **flujo**,
  no el permiso.)

## 3. Decisión del founder (2026-07-17)

El operario **debe** tener modo de consolidado, **gated por autorización de la
oficina**. Dos variantes discutidas:

1. **Pre-autorización:** la oficina habilita/autoriza desde arriba y al operario le
   **aparece el botón** de consolidar.
2. **Solicitud + autorización (⭐ recomendada):** el operario toca **"Consolidar"**,
   se crea una **solicitud**, y en Studio aparece **"autorizar consolidado"** (una
   notificación). La oficina autoriza y el contenedor queda `consolidando`.

La #2 es la recomendada: es **operario-iniciada** (quien tiene la carga enfrente
arranca), deja **rastro auditable** (quién pidió, quién autorizó) y encaja con el
patrón de avisos ya existente (Telegram/push de operario).

## 4. Alcance

### Incluye
- Acción **"Consolidar"** en `/m/cn` (o `/m/cn/estibar`) que crea una solicitud.
- Estado nuevo del contenedor: `solicitada` (o `pendiente_autorizacion`) previo a
  `consolidando`.
- **Bandeja/aviso en Studio** ("Autorizar consolidado") con Autorizar / Rechazar.
- Al autorizar → contenedor pasa a `consolidando` → aparece en la estiba del operario
  (reusa el flujo SDD-0155 tal cual).
- Aviso al operario cuando la oficina autoriza (push/Telegram del operario).
- Auditoría en `entity_audit_log`: `consolidation_requested`, `consolidation_authorized`,
  `consolidation_rejected`.

### No incluye (por ahora)
- Cambios al motor de estiba por lotes (SDD-0155 queda igual).
- Reglas de negocio de qué carga puede consolidarse (se hereda de naviera).
- Pre-autorización por rol (variante #1) — se puede sumar después si se quiere el
  atajo sin solicitud.

## 5. Modelo de datos (borrador)

- `consolidations.status`: agregar valores `solicitada` → (`consolidando` | `rechazada`).
  Hoy: `consolidando | listo | cerrado` (confirmar el enum real en 0096/naviera).
- Campos de traza: `requested_by_operario_id`, `requested_at`, `authorized_by`,
  `authorized_at` (nullable; en `consolidations` o en una tabla
  `consolidation_requests` si se prefiere separar la cola).
- La creación por el operario **no** usa `next_consolidation_ref` hasta autorizar
  (para no quemar el correlativo `DTD-CONSOL-NNNN` en solicitudes que se rechazan):
  el `ref` se asigna **al autorizar**. (Decisión a confirmar — ver §8.)

## 6. RPCs / Server (borrador)

- `request_consolidation_as_operario(p_operario_id, p_warehouse_id, p_container_type)`
  → crea la solicitud (`solicitada`), sin `ref`. SECURITY DEFINER, ACL `service_role`
  (lo llama el server del móvil con admin client, patrón de los otros RPC de operario).
- `authorize_consolidation(p_consolidation_id)` → server action de Studio
  (`authenticated` + `moduleEditDenial('naviera')`): asigna `ref` vía
  `next_consolidation_ref`, status `consolidando`, dispara aviso al operario.
- `reject_consolidation(p_consolidation_id, p_reason)` → status `rechazada` + aviso.

## 7. UI (borrador)

- **Operario** `/m/cn`: tarjeta/acción "Consolidar" → elegir tipo de contenedor →
  "Solicitud enviada · esperando autorización". Si ya hay una `consolidando`, entra
  directo a estibar (flujo actual).
- **Studio** `/studio/naviera` (tab Consolidación) o bandeja de avisos: fila
  "Solicitud de consolidado · <operario> · <galpón>" con **Autorizar / Rechazar**.
- Reusar `DrawerShell` + patrones de naviera existentes.

## 8. Preguntas abiertas

1. ¿El `ref` (`DTD-CONSOL-NNNN`) se asigna al **solicitar** o al **autorizar**?
   Recomendado: al autorizar, para no quemar correlativo en rechazos.
2. ¿La solicitud vive en `consolidations` (status `solicitada`) o en tabla aparte
   `consolidation_requests`? Recomendado: misma tabla + status, menos superficie.
3. ¿El aviso a la oficina va por la bandeja de notificaciones del Studio, Telegram, o
   ambos? (Ver patrón SDD-0148 chat interno / avisos.)
4. ¿Rol que puede autorizar? (naviera edit, o un rol específico de operaciones.)

## 9. Slices propuestos

- **Slice A — datos + solicitud:** migración (status `solicitada` + campos de traza),
  `request_consolidation_as_operario`, acción "Consolidar" en `/m/cn`, aviso a oficina.
- **Slice B — autorización:** bandeja/fila en Studio, `authorize_consolidation` /
  `reject_consolidation`, asignación de `ref` al autorizar, aviso al operario.
- **Slice C — pulido:** auditoría completa, estados de rechazo visibles al operario,
  (opcional) pre-autorización por rol (variante #1).

## 10. Notas

- Descubierto durante la prueba E2E del pipeline de captura de realidad (2026-07-17):
  el operario quedó bloqueado en el Paso 4 porque no podía abrir el contenedor.
- El permiso de `next_consolidation_ref` (bug 0211) se arregló aparte (migr 0247);
  este spec es el **flujo** operario↔oficina, no el permiso.

## 11. Estado de implementación (2026-07-17)

Construido Slice A **+ la autorización de Slice B** (el par pedir↔autorizar quedó
completo de una pasada). Decisiones tomadas de §8:

- **Q1 · ref al autorizar** (no al solicitar): la fila `solicitada` va sin `ref`
  (`consolidations.ref` → nullable, migr 0249); `next_consolidation_ref` se llama
  en `authorizeConsolidation`. No se quema correlativo en rechazos.
- **Q2 · misma tabla + status**: `consolidations` con `status='solicitada'` →
  (`consolidando` | `rechazada`). Sin tabla aparte.
- **Q3 · aviso**: la **bandeja en Studio** (tab Consolidación) es el canal duro;
  Telegram a la oficina (best-effort) al solicitar + Web Push al operario al
  autorizar (best-effort, reusa `sendPushToOperario` / `sendAdminTelegram`).
- **Q4 · rol**: `moduleEditDenial('naviera')` (quien edita naviera autoriza).

Archivos: `lib/studio/naviera/types.ts` (+2 status), `queries.ts` (campos de
traza + `ref` nullable), `app/m/cn/estibar/{actions.ts,page.tsx,_components/AbrirContenedorButton.tsx}`,
`app/studio/(app)/naviera/{actions.ts,_components/NavieraClient.tsx}`,
`lib/studio/naviera/consolidation-request-notify.ts`. Tests: 3 archivos nuevos.

Pendiente (Slice C): auditoría `entity_audit_log`, estado de rechazo visible al
operario (hoy la fila `rechazada` no se lista), pre-autorización por rol.
