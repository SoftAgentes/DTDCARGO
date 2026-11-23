---
sdd: "0712"
title: "Búsqueda amplia y fusión manual de clientes"
status: draft
author: "founder"
created: 2026-11-23
updated: 2026-11-23
supersedes: null
superseded_by: null
related: ["0246","0258","0664"]
confidencialidad: interno
---

# DTD-0712 — Búsqueda amplia y fusión manual de clientes

> Que el equipo encuentre a cualquier cliente de la base y pueda fusionar dos fichas aunque el sistema no las detecte, viendo antes cómo quedaría, sin salir de la pestaña.

## Contexto
Clientes › Mantenimiento › «Posibles duplicados» (SDD-0246) solo empareja coincidencias exactas (correo, últimos 7 dígitos del teléfono, RIF, nombre completo). Un cliente con el nombre parcial, con otros acentos o sin ningún dato en común no aparece. Sam pidió (2026-11-23): búsqueda por Shipping Mark, nombre parcial sin acentos ni mayúsculas, teléfono y correo en toda la base; fusión manual de dos fichas cualesquiera (ejemplo: esposo y esposa con dos códigos); «Ver fichas» en un panel a la derecha con vista previa. Con la propuesta dibujada y un ejemplo suyo (dos fichas con el mismo nombre, una del sistema anterior y otra nueva), Sam aprobó textualmente: «Sí, apruebo» (2026-11-23), incluyendo el botón ⇄ para elegir cuál ficha se queda y el bloque «Códigos anteriores» en la ficha.

## Alcance
1. **Búsqueda**: RPC `client_search_for_merge(p_q)` (tenant de la sesión, sin acentos ni mayúsculas, tope 25) por Shipping Mark (el vigente, los renombrados y los de fichas fusionadas), nombre, teléfono, correo y documento, sin separadores; excluye aliados, borrados y ya fusionados.
2. **Fusión manual**: botón «Fusionar cliente» en Posibles duplicados; se eligen dos fichas con buscador, ⇄ invierte cuál se queda (puede quedarse la ficha nueva y anularse la del sistema anterior). Reutiliza `merge_clients` sin modificarla.
3. **Panel derecho** (`DrawerShell`): ficha que se queda, ficha que se anula y documento, correo, teléfono y fecha de cada ficha para compararlas, en qué coinciden, y vista previa con conteos (embarques, facturas, direcciones, conversaciones) **sin montos**; avisos de riesgo (no coinciden en nada, solo por nombre, acceso al portal que se revoca o que se pierde, documento/correo/teléfono que no pasan). Reemplaza los enlaces «Ver ficha» de la lista de detectados.
4. **Confirmación**: escribir el Shipping Mark que se anula; motivo obligatorio (4–1000 caracteres); si coinciden solo por nombre, un aviso en rojo lo advierte en el panel (la confirmación escrita reemplaza al «mantener presionado»).
5. **Auditoría**: wrapper `merge_clients_manual(survivor, merged, motivo, confirmación)` que llama a `merge_clients` y registra `append_audit_event` (quién, par, motivo).
6. **Códigos anteriores**: la ficha muestra bloque «Códigos anteriores» (renombrados `client_markbox_history`, fusionados, migración Legacy) con origen y fecha; al fusionar, el código de la ficha anulada queda listado (sin fecha: la fusión solo guarda la ficha retirada). Los renombres ya salían de `client_markbox_history` (0367); lo nuevo son los códigos de fichas fusionadas.

7. **Quién fusiona** (Sam, 2026-11-23, textual: «Admin, Operaciones y Comercial»): `merge_clients_manual` y la acción del servidor rechazan a los demás roles. Buscar y ver la vista previa siguen abiertos a la matriz `clients`.
8. **Orden de salida**: la 0572 se aplica ANTES de publicar la web con este cambio; sin ella «Posibles duplicados» no busca ni fusiona.

## Pendientes para Sam (no se cambian aquí)
- `merge_clients(uuid, uuid)` sigue ejecutable por `authenticated` con la matriz de cinco roles: por la API se puede fusionar sin motivo ni confirmación, y contabilidad y soporte todavía pueden por esa vía.
- `merge_clients` (0361 §5.1) revoca un acceso vivo al portal cuando la ficha que se queda tiene una fila revocada: nadie queda con acceso. Aquí solo se avisa (`portalLost`).
- Los códigos de fichas fusionadas salen sin fecha en «Códigos anteriores».

## Fuera de alcance
Cambiar `merge_clients`; fusionar aliados (lo impide el trigger de 0362); deshacer fusiones; recuperar códigos del sistema anterior que no estén guardados. Medido por el Director con una consulta de solo conteo autorizada por Sam: la ficha del ejemplo tiene 1 código anterior en `client_markbox_history`, así que ya se ve en su ficha.

## Riesgos y reglas
- Fusionar dos personas distintas: un solo acceso al portal (el de la anulada se revoca), un solo RIF/correo/teléfono si ambas tienen, saldo sumado, verificación y aceptaciones legales no se heredan, sin deshacer. Se muestran en el panel antes de confirmar.
- Datos personales: pasa por `revisar-datos-ve`. Carril con revisión previa. La migración se escribe pero NO se aplica sin OK nominal de Sam.
- Sin montos ni filas reales en Git: los datos de las pruebas son ficticios (`@example.test`, documentos y teléfonos inventados).

## Diseño
Mockup aprobado en la conversación (búsqueda, selector de dos fichas con ⇄, panel de vista previa). Reutiliza `DrawerShell` y el patrón de `ClientCombobox`.
