---
sdd: "0668"
title: "Portal: el cliente ve su código anterior, como dato informativo"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0258", "0341", "0405", "0646", "0664"]
confidencialidad: interno
---

# SDD-0668 — Portal: el cliente ve su código anterior

> Un cliente del legado entra al portal y ve un Shipping Mark nuevo (`DTD-8xxx`). Tiene que poder ver también el de antes y saber que la carga rotulada con él sigue llegando.

Los ejemplos son inventados (`DTD-Z901` como código anterior, `DTD-8901` como vigente). No hay códigos reales.

## Pedido

Decisión de Sam del 2026-11-18, por el Director General: **el cliente sí puede ver su código viejo en el portal, solo como dato informativo.** Sale de la SDD-0664 (que queda para el Studio) porque toca lo que el cliente ve y la frontera público↔ERP. Solo spec por ahora: Sam pidió esperar antes de más código.

## Lo que se encontró

Leído en el repositorio. **No se consultó producción.** **[verificado en código]** es lo que el código dice; **[sin medir]** depende de producción.

- **[verificado en código]** El portal **ya muestra** los códigos anteriores. `app/portal/(app)/perfil/page.tsx` (SDD-0258) pinta, bajo el Shipping Mark del perfil, «Tu código anterior» o «Tus códigos anteriores», la lista, y el texto «Siguen funcionando. Si tu proveedor rotuló una caja con él, llega igual». Sin historial no ocupa nada.
- **[verificado en código]** Los datos llegan por `get_portal_private_profile_context()` (migración 0405, SDD-0341): una función ligada a `auth.uid()`, sin ids de entrada, que devuelve `previous_markboxes` del propio cliente. La consume `lib/portal/profile-private-context.ts`. El portal no lee tablas del ERP ni importa `@/lib/studio`: la frontera se respeta.
- **[verificado en código]** Esa función lee **todas** las filas de `client_markbox_history` del cliente, ordenadas de la más reciente a la más vieja. No mira `restored_at`.
- **[verificado en código]** Desde la 0552 (SDD-0646) un cliente puede recuperar su propio código retirado: la fila del historial no se borra, queda con `restored_at`. Consecuencia: **si a un cliente se le devuelve su código de vendedor (SDD-0664, fase 5), el portal le mostraría ese mismo código como «anterior»**, además de como vigente.
- **[verificado en código]** La función no sigue fusiones: los códigos de una ficha absorbida (`merged_into_client_id`, 0341) no aparecen como anteriores de la que sobrevive.
- **[verificado en código]** Solo se muestra en Perfil. El inicio del portal y el encabezado enseñan el Shipping Mark vigente y nada más.
- **[sin medir]** Que un cliente del legado lo vea hoy en producción: depende de que su ficha tenga historial (la medición está en la SDD-0664).

## Propuesta

### Lo que no pide migración

1. **Comprobar** con una cuenta de prueba del legado que el bloque aparece, y dejarlo cubierto con una prueba de la página de Perfil.
2. **No repetir el vigente.** La página descarta de la lista cualquier código igual al Shipping Mark actual (sin distinguir mayúsculas) y los repetidos. Cubre el caso del código recuperado sin tocar la base.
3. **Texto.** Revisar que el bloque diga con claridad que es informativo: el código vigente es el que debe dar a su proveedor; el anterior sigue llegando.
4. **Decisión de Sam:** si además de Perfil debe verse en el inicio del portal, junto al Shipping Mark. Es un cambio de esa pantalla por el mismo camino (la misma función), sin tocar la frontera.

### Lo que sí pediría migración (no se escribe aquí)

- Que la función devuelva también los códigos de las fichas absorbidas por fusión, y que excluya en la base las filas restauradas. Es redefinir `get_portal_private_profile_context()`: número del Director y OK nominal de Sam, por el runbook de producción.
- Mientras tanto, el punto 2 cubre lo restaurado; las fusiones quedarían sin mostrarse en el portal (en el Studio sí se resuelven, SDD-0664).

## No entra

- Dejar que el cliente elija o cambie su código. Es informativo.
- Buscar o enlazar por el código anterior dentro del portal.
- Cambios en el Studio (SDD-0664).
- Leer tablas del ERP desde el portal o importar `@/lib/studio`.

## Reglas que se conservan

- Frontera público↔ERP y sus límites de ESLint.
- La función sigue ligada a `auth.uid()`: el portal nunca le pasa un id de cliente.
- Marca del portal: Nunito + Sora, «Shipping Mark» de cara al usuario; tuteo, sin voseo.
- Datos personales: el código anterior es del propio cliente; no se muestra el de nadie más. Si la propuesta cambiara qué se devuelve, pasa por `revisar-datos-ve`.

## Preguntas para Sam

1. ¿Alcanza con verlo en Perfil, o lo quieres también en el inicio del portal?
2. Si un cliente tuvo más de un código anterior, ¿se muestran todos o solo el de vendedor?

## Allowlist (cuando se apruebe)

- `app/portal/(app)/perfil/page.tsx` y su prueba
- `lib/portal/profile-private-context.ts` y su prueba
- `app/portal/(app)/page.tsx` (solo si la respuesta 1 es «también en el inicio»)
- `docs/specs/0668-portal-codigo-anterior/`, `docs/specs/README.md`, handoff propio

## Criterios de aceptación

1. Un cliente con un código anterior lo ve en Perfil, con el texto de que sigue funcionando.
2. Un cliente que recuperó su código de antes no lo ve repetido como «anterior».
3. Un cliente sin historial no ve el bloque.
4. El portal sigue sin importar `@/lib/studio`, `@/lib/db` ni `@supabase/*` fuera de lo que ya permite la frontera.
