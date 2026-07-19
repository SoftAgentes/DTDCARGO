---
sdd: "0163"
title: "Orden accionable al operario · el operario ve y ejecuta los servicios de la llegada + modalidad de envío en la prealerta"
status: proposed
author: "Sam (founder) + Motor de Crecimiento (re-auditoría 2026-07-18)"
created: 2026-07-19
updated: 2026-07-19
supersedes: null
superseded_by: null
related: ["0098", "0057", "0105", "0150", "0153", "0154", "0155", "0162", "0245", "0067"]
confidencialidad: interno
---

# DTD-0163 — Orden accionable al operario

> **El eslabón que cierra el pipeline de la Entrega (sistema 3 del Motor de Crecimiento).**
> Hoy el cliente pide servicios de la llegada (Validación, Inspección al recibir, Etiquetado,
> HOLD, Re-Empaque) en el portal, pero **el operario que recibe la caja en China no los ve**: solo
> la oficina los ve en Studio. La caja se recibe "a ciegas" y el servicio pedido depende de que
> alguien avise por fuera del sistema. Esta spec le da al operario **la orden** — el checklist de
> lo que hay que hacer con esa caja — y deja **traza de ejecución** (quién/cuándo), que es lo que
> el sistema 5 (Contratación) necesita para medir desempeño.
>
> Nace del brief a Cloud Design [`docs/marketing/servicios-infografias/HANDOFF-CLOUD-DESIGN.md`](../../marketing/servicios-infografias/HANDOFF-CLOUD-DESIGN.md) §4
> (entregable D, "orden al operario") y del programa [`docs/marketing/motor-crecimiento.md`](../../marketing/motor-crecimiento.md) (F2-T02).

## 1. Resumen en una línea

Cuando el operario recibe una caja por escaneo en `/m/cn/recibir`, ve **los servicios que el
cliente pidió para esa compra** como un checklist, los **marca ejecutados** dejando traza a su
nombre (PIN), y — aparte — la prealerta del portal gana un **selector de modalidad de envío**
(marítimo activo · aéreo deshabilitado "próximamente").

## 2. Problema (medido 2026-07-18, re-auditoría del Motor de Crecimiento)

- **El operario recibe a ciegas.** `app/m/cn/recibir/actions.ts` → `lookupForReceptionAction`
  (líneas 52-151) devuelve solo `boxCode, prealertaCode, clientMarkbox, clientName, supplierName,
  expected`. **No lee `prealerta_service_requests`.** Verificado: grep `addon|service_request` en
  `app/m/cn` = **0 matches**.
- **Las solicitudes solo tienen eje de oficina.** `prealerta_service_requests` (migr
  `0150_prealerta_addons.sql`) tiene `status` (`solicitada→en_proceso→atendida→descartada→invalida`)
  y `processed_by`/`processed_at` que **sella el staff** (`auth.users`) desde
  `updateServiceRequestAction` (`app/studio/(app)/proveedores/actions.ts:45-93`). **No hay ninguna
  columna de ejecución física por el operario** — ni `executed_by_operario_id`, ni `executed_at`,
  ni estado de checklist.
- **Consecuencia:** la promesa "pídelo antes de que la caja llegue a bodega y lo hacemos al
  recibir" no tiene enforcement. El servicio se ejecuta (o no) por coordinación humana fuera del
  sistema, y **no queda traza de quién lo hizo** — por eso el sistema 5 no puede medir productividad
  del operario (KPIs de puesto en 0/18 instrumentados) ni el sistema 6 puede facturar con evidencia
  de ejecución.
- **La prealerta no distingue modalidad.** La tabla `prealertas` (migr `0105_portal_compras.sql:83-101`
  + sus ALTERs) **no tiene campo marítimo/aéreo**. El brief §4 pide el selector como paso 1 de la
  "Nueva compra".
- Contexto: es el eslabón que mantiene a 0153/0154/0155 en `in-progress` con ~0% de adopción real
  (7 recepciones, 1 con `prealerta_id`) — el operario no tiene incentivo de usar `/m/cn/recibir`
  (escaneo) sobre `/m/cn/nueva` (tipeo) si el escaneo no le da nada extra. La orden al operario SÍ
  le da algo: la lista de lo que hay que hacer.

## 3. Decisión del founder (2026-07-19)

**Escribir esta spec YA** (antes del piloto), porque desbloquea tres sistemas del Motor de
Crecimiento: la Entrega (3) la vuelve accionable, el Manual (4) documenta el "cómo se ejecuta cada
servicio" sobre esta orden, y la Contratación (5) mide al operario con la traza que deja.
**Implementación:** tras el **Gate 1 de Cloud Design** (§4 del brief — el founder aprueba naming +
estados + wireframe del flujo del portal antes del arte final), para no construir la UI dos veces.

## 4. Alcance — tres cortes

### Slice A · La orden al operario (el núcleo — backend + `/m/cn`)

El operario ve y ejecuta. **Reusa** `prealerta_service_requests` (no crea tabla nueva) y le agrega
el **eje de ejecución**, ortogonal al eje de oficina que ya existe:

- **Migración (número al implementar, ver §7):** `ALTER TABLE prealerta_service_requests ADD`
  - `executed_by_operario_id uuid references operario_pins(id)` — **FK a `operario_pins`, NO a
    `auth.users`** (el operario es sesión-PIN, no usuario Studio; espeja
    `warehouse_receipts_cn.created_by_operario_id`, migr `0020:65`).
  - `executed_at timestamptz`
  - `execution_note text` — nota corta del operario (ej. "faltaban 2 piezas para etiquetar").
  - El eje de oficina (`status`, `processed_by`, `quoted_amount_usd`) **no se toca**: una solicitud
    puede estar `atendida` (cotizada por el asesor) y aún no ejecutada, o ejecutada por el operario
    y pendiente de cobro — son dos cosas.
- **RPC `SECURITY DEFINER` `mark_service_request_executed_as_operario(p_operario_id, p_request_id,
  p_executed boolean, p_note text)`** — porque la RLS de la tabla da al operador solo SELECT+UPDATE
  como `auth.users` (migr `0150:229-237`) y el operario **no es** `auth.users`. Espeja el patrón de
  `receive_prealerta_as_operario` (migr `0245`): valida que el operario existe/activo, que la
  solicitud es del mismo tenant, y setea `executed_by_operario_id`/`executed_at` (o los limpia si
  `p_executed=false`, para deshacer un toque erróneo). Idempotente.
- **`lookupForReceptionAction` (extender, `app/m/cn/recibir/actions.ts:52-151`)** — además del
  `ReceptionLookup` actual, devolver las `prealerta_service_requests` **no descartadas** de esa
  prealerta (código del add-on → label vía `PREALERTA_ADDON_CODES`, `lib/studio/prealertas/addons.ts:19-27`)
  con su estado de ejecución. Solo lectura, sin cambiar el contrato de recepción.
- **Nueva action `markServiceExecutedAction(requestId, executed, note?)`** — resuelve el operario
  de la sesión-PIN (`getCurrentOperario`, `lib/auth/operario-session.ts`) y llama la RPC.
- **UI en `app/m/cn/recibir/_components/RecibirClient.tsx`** — la `ConfirmCard` (208-324) y/o la
  `DoneCard` (326-402) muestran el checklist: por cada servicio pedido, su nombre en es/中文 (el
  operario CN ya usa `t(lang,…)`), un check tocable y campo de nota opcional. El foco es **claridad
  operativa**, no comercial: el operario ve QUÉ hacer, nunca montos (los montos son del eje oficina).

### Slice B · Modalidad de envío en la prealerta (portal + backend chico)

- **Migración:** `ALTER TABLE prealertas ADD shipping_mode text NOT NULL DEFAULT 'maritimo' CHECK
  (shipping_mode IN ('maritimo','aereo'))`. Default `maritimo` (no rompe las prealertas existentes).
- **Portal (`app/portal/(app)/…` de "Nueva compra", `lib/studio/prealertas/`)** — paso 1 del flujo:
  selector **Marítimo (activo)** · **Aéreo (visible, deshabilitado, badge "próximamente")** — el
  aéreo no es seleccionable (el flete aéreo de carga está suspendido; ver `public/llms.txt`). El
  valor viaja al crear la prealerta.
- Es independiente de Slice A; puede ir antes o después.

### Slice C · Entrada "Nueva orden LCL / FCL" (solo diseño ahora; backend en spec futura)

El brief §4.2 pide una **entrada propia** en el portal para que el cliente inicie una orden de
Consolidado LCL o FCL (con su selector de modalidad FCL: en bodega / directo fábrica). **Cloud
Design diseña el flujo completo; el backend llega en una spec posterior** (decisión del brief:
"diseñar completo, no ocultar"). Esta spec lo deja declarado como `future_scope`, no lo construye.

## 5. No incluye (fuera de alcance, a propósito)

- **Cobro/facturación del servicio ejecutado** — es del sistema 6 (Financiero); la traza de
  ejecución que deja Slice A es el *insumo* para facturar con evidencia, pero el asiento y la
  factura no viven acá.
- **Los add-ons apagados `compactar` y `cotizar_medir`** — se apagaron en prod el 2026-07-19
  (decisión founder 18-jul); el checklist del operario **no los muestra** (no existen para el
  cliente). Los add-ons vigentes del checklist son los 5 de la llegada:
  `verificacion, inspeccion_recepcion, etiquetado_pieza, reempaque_unificar, hold_consolidar`.
- **El efecto físico del HOLD** (retener la caja, excluirla de consolidación, correr el reloj de
  bodegaje de 15 días) — es un gap propio, se trata aparte (backlog del Motor, no este slice).
- **El backend de la orden LCL/FCL** (Slice C) — spec futura.

## 6. Riesgos y bordes

- **Dos ejes en la misma tabla.** Mezclar ejecución (operario) y resolución comercial (oficina) en
  `prealerta_service_requests` podría confundir. Mitigación: columnas separadas + la UI de cada lado
  muestra solo su eje (el operario nunca ve montos; la oficina ve ambos). Documentar en el tipo
  `PrealertaServiceRequest` (`lib/studio/prealertas/addons.ts:254-270`).
- **Solicitud creada DESPUÉS de recibir la caja** (`timing='tardia'`, trigger `0150:114-154`) — el
  checklist debe mostrarla igual con un aviso "pedida tarde", porque el servicio quizás ya no se
  puede ejecutar. No bloquear la recepción por esto.
- **Recepción sin prealerta** (`/m/cn/nueva`, tipeo) — no tiene solicitudes que mostrar; el
  checklist simplemente no aparece. Esta spec **no** fuerza migrar a escaneo; hace el escaneo más
  útil para empujar la adopción por valor, no por mandato.
- **Frontera pública↔ERP** — todo esto vive en el ERP (`app/m`, `app/studio`, `lib/studio`); el
  portal del cliente (Slice B) usa `lib/studio/prealertas/` que ya es su backend. Sin cruces
  prohibidos.

## 7. Migraciones (regla del repo)

- Última migración del árbol: `0250_referral_settings.sql`. La siguiente **libre en este worktree**
  sería `0251` — **pero** la memoria del proyecto marca `0251-0253` como *dormantes* en la rama
  `review-no-olvidar` (sin push). Al implementar, **numerar contra `origin/main` + todas las ramas**
  (regla `0150:31-32`) para no colisionar; probablemente `0254+`.
- **No se crean los archivos de migración en esta spec** (está `proposed`, la implementación es
  posterior). Crearlos ahora dispararía el gate `migrations-applied` de `verify.mjs` (falla si un
  archivo del repo no está aplicado en prod). Se escriben en el slice de implementación y se aplican
  **con OK del founder nombrando cada una**, vía [`docs/runbooks/aplicar-migraciones-prod.md`](../../runbooks/aplicar-migraciones-prod.md).

## 8. Criterios de aceptación

1. Al hacer lookup de una caja en `/m/cn/recibir`, el operario ve la lista de servicios de la
   llegada pedidos para esa prealerta (los 5 vigentes), con su estado de ejecución.
2. El operario marca un servicio como ejecutado y queda registrado `executed_by_operario_id` (su
   PIN) + `executed_at`; puede deshacer y agregar una nota. La escritura pasa por la RPC
   `SECURITY DEFINER` (no por RLS-as-auth-user).
3. El eje de oficina (`status`, `quoted_amount_usd`, `processed_by`) no cambia de comportamiento:
   la bandeja del staff (`ServiceRequestsTab`) sigue igual, y ahora además puede ver la traza de
   ejecución (solo lectura).
4. El operario **nunca** ve montos en `/m/cn`.
5. La "Nueva compra" del portal ofrece el selector de modalidad (marítimo activo · aéreo
   deshabilitado); la prealerta persiste `shipping_mode`; las prealertas viejas quedan `maritimo`.
6. `node scripts/verify.mjs` verde, con las migraciones aplicadas a prod (gate `migrations-applied`).
7. Tests: el contrato de la RPC de ejecución (marca/deshace/idempotente/tenant ajeno rechazado) y el
   lookup extendido.

## 9. Plan de implementación (al aprobar, tras Gate 1 de Cloud Design)

1. **Slice B** primero (más chico, sin dependencia de diseño de checklist): migración `shipping_mode`
   + selector en el portal.
2. **Slice A**: migración del eje de ejecución + RPC + `lookupForReceptionAction` extendido +
   `markServiceExecutedAction` + checklist en `RecibirClient` (esperando el wireframe del Gate 1
   para el layout del checklist).
3. Volver 0153/0154/0155 a revisión de cierre: con la orden al operario, el escaneo tiene valor
   completo → validar con el **embarque piloto** (F2-T01 del Motor) y, si opera, pasar esas specs a
   `done`.

## 10. Decisiones abiertas (founder, al implementar)

- ¿El checklist del operario permite marcar **"no se pudo ejecutar"** con motivo (distinto de "no
  ejecutado todavía")? — útil para la traza de calidad, pero suma un estado.
- ¿La ejecución del operario **dispara un aviso** al cliente ("tu Validación está lista, 3 fotos")?
  — encaja con el motor SDD-0156, pero es un evento nuevo configurable; se puede diferir.
- Orden LCL/FCL (Slice C): ¿spec propia inmediatamente después, o espera a que el flujo de "Nueva
  compra" esté operando?
