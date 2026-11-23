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
Clientes › Mantenimiento › «Posibles duplicados» (SDD-0246) solo empareja coincidencias exactas (correo, últimos 7 dígitos del teléfono, RIF, nombre completo). Un cliente con el nombre parcial, con otros acentos o sin ningún dato en común no aparece. Sam pidió (2026-11-23): búsqueda por Shipping Mark, nombre parcial sin acentos ni mayúsculas, teléfono y correo en toda la base; fusión manual de dos fichas cualesquiera (ejemplo: esposo y esposa con dos códigos); «Ver fichas» en un panel a la derecha con vista previa. Con la propuesta dibujada y su ejemplo DTD-8221 ↔ DTD-9001, Sam aprobó textualmente: «Sí, apruebo» (2026-11-23), incluyendo el botón ⇄ para elegir cuál ficha se queda y el bloque «Códigos anteriores» en la ficha.

## Alcance
1. **Búsqueda**: RPC `client_search_for_merge(p_q)` (tenant de la sesión, sin acentos ni mayúsculas, tope 25) por Shipping Mark, nombre, teléfono, correo y documento; excluye aliados, borrados y ya fusionados.
2. **Fusión manual**: botón «Fusionar cliente» en Posibles duplicados; se eligen dos fichas con buscador, ⇄ invierte cuál se queda (el 8221 puede anularse y quedar el 9001). Reutiliza `merge_clients` sin modificarla.
3. **Panel derecho** (`DrawerShell`): ficha que se queda, ficha que se anula y vista previa con conteos (embarques, facturas, accesos, direcciones, conversaciones) **sin montos**; avisos de riesgo (acceso al portal que se revoca, documento/correo que no pasan). Reemplaza los enlaces «Ver ficha» de la lista de detectados.
4. **Confirmación**: escribir el Shipping Mark que se anula; motivo obligatorio (4–1000 caracteres); si coincide solo por nombre, mantener presionado.
5. **Auditoría**: wrapper `merge_clients_manual(survivor, merged, motivo)` que llama a `merge_clients` y registra `append_audit_event` (quién, par, motivo).
6. **Códigos anteriores**: la ficha muestra bloque «Códigos anteriores» (renombrados `client_markbox_history`, fusionados, migración Legacy) con origen y fecha; al fusionar, el código anulado queda listado.

## Fuera de alcance
Cambiar `merge_clients`; fusionar aliados (lo impide el trigger de 0362); deshacer fusiones; recuperar el código de Legacy si no está guardado en ningún lado (pendiente de medir en prod con consulta autorizada).

## Riesgos y reglas
- Fusionar dos personas distintas: un solo acceso al portal (el de la anulada se revoca), un solo RIF/correo/teléfono si ambas tienen, saldo sumado, verificación y aceptaciones legales no se heredan, sin deshacer. Se muestran en el panel antes de confirmar.
- Datos personales: pasa por `revisar-datos-ve`. Carril con revisión previa. La migración se escribe pero NO se aplica sin OK nominal de Sam.
- Sin montos ni filas reales en Git.

## Diseño
Mockup aprobado en la conversación (búsqueda, selector de dos fichas con ⇄, panel de vista previa). Reutiliza `DrawerShell` y el patrón de `ClientCombobox`.
