---
sdd: "0394"
title: Mutaciones de direcciones Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0138", "0377", "0392"]
confidencialidad: interno
---

# SDD0394 · Mutaciones de direcciones Portal por principal y tenant

## Evidencia y autoridad

La numeración 0394 se comprobó contra 15 refs. Alta, edición y predeterminada ya
derivan un cliente canónico, pero pierden tenant y Shipping Mark al llamar los
helpers compartidos. En una sesión híbrida, las policies de equipo pueden ampliar
un UPDATE por id si la aplicación no conserva el principal completo.

El borrado ya está cerrado por el comando transaccional 0427/SDD-0377 y queda
fuera de cambios. Este slice usa sólo fixtures: no autoriza direcciones reales,
Cloud, push, `main`, deploy o limpieza.

## Contrato acotado

- Derivar el principal completo en alta, edición y predeterminada.
- Cortar antes del dominio ante principal inválido o incoherente.
- Pasar tenant + Shipping Mark a los helpers Portal; fijar además cliente/id
  según cada mutación.
- Mantener compatibilidad de helpers para callers Studio sin scope Portal.
- Conservar validación, trigger de sellado, mensajes y revalidación.
- No cambiar borrado 0427, schema, RLS ni UI.

## Allowlist exacta

- `app/portal/(app)/perfil/address-actions.ts`.
- `lib/studio/client-address-queries.ts`.
- `app/portal/(app)/perfil/address-actions.scope.test.ts`.
- `lib/studio/__tests__/client-address-portal-scope.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra mutaciones sin scope completo y principal inválido alcanzando helpers.
- [x] Principal inválido produce cero consultas/DML de direcciones.
- [x] Alta, edición y predeterminada fijan tenant/cliente/Shipping Mark.
- [x] Callers Studio conservan firma compatible sin scope Portal obligatorio.
- [x] Borrado 0427 permanece intacto.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] Producción permanece no verificada y sin datos reales.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa explícita quedó corregida. No hay cambio
visual ni nueva categoría de datos personales.
