---
sdd: 0330
title: Retirar el envío de direcciones de clientes a Nominatim
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0010
  - SDD-0191
confidencialidad: interno
---

# SDD-0330 — Retirar el envío de direcciones de clientes a Nominatim

## Problema

El drawer de Clientes enviaba la dirección completa escrita por el equipo al
servicio público de Nominatim para obtener coordenadas. El inventario de
privacidad ya clasificaba ese flujo como una transferencia a un tercero sin
contrato. Además, la integración no implementaba caché, timeout ni el máximo
global de una solicitud por segundo exigido por el proveedor.

La política pública de Nominatim también pide no enviar datos personales ni
material confidencial. Una dirección de entrega puede identificar el domicilio
de una persona, por lo que mejorar sólo el throttle no resuelve la frontera.

## Decisión

1. Se retira el helper y la Server Action que enviaban direcciones a Nominatim.
2. Se elimina del drawer únicamente el botón «Buscar desde dirección».
3. Se conservan la captura GPS explícita del navegador, la edición manual de
   latitud/longitud y la limpieza de coordenadas.
4. Un contrato recorre el código ejecutable de `app/` y `lib/` para impedir que
   vuelva a aparecer el host público de Nominatim sin una decisión nueva.
5. La documentación viva de privacidad deja de presentar a Nominatim como un
   receptor actual, pero conserva trazabilidad sobre el flujo retirado y sobre
   el histórico externo no verificable.

## Fuente del proveedor

- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/),
  consultada el 2026-09-02: máximo absoluto de 1 solicitud por segundo, caché
  recomendada/obligatoria según el uso y prohibición de enviar datos personales
  o confidenciales al servicio público.

## Gobernanza

- `cumplimiento`: minimización y fail-closed; la dirección deja de salir del
  sistema hacia un tercero sin contrato.
- `cumplimiento`: ERR-01; se previene la transferencia en vez de depender de un
  error tardío del proveedor.
- `cumplimiento`: FRM-01; los campos, la captura local y el guardado server-side
  de coordenadas no cambian.
- `no aplica`: componente nuevo, migración, Cloud, datos históricos o despliegue.

## Allowlist exacta

- `app/studio/(app)/clientes/actions.ts`
- `app/studio/(app)/clientes/_components/ClientDrawer.tsx`
- `app/studio/(app)/clientes/__tests__/geocoding-privacy-contract.test.ts`
- `lib/studio/geocoding.ts` (eliminado)
- `docs/legal/privacidad/inventario-terceros.md`
- `docs/legal/privacidad/registro-tratamiento.md`
- `docs/legal/privacidad/mapa-de-borrado.md`
- `docs/specs/0330-retirar-geocodificado-nominatim/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-nominatim-privacy-close.md`

## Aceptación

- Ningún archivo ejecutable de `app/` o `lib/` contiene el host público de
  Nominatim.
- El drawer no ofrece geocodificado automático y sí conserva captura GPS local.
- La documentación distingue estado actual de exposición histórica.
- Tests focales, TypeScript, lint, documentación y gobernanza pasan localmente.

## Fuera de alcance

- Borrar logs o solicitudes históricas en infraestructura de terceros.
- Contratar o configurar otro proveedor de geocodificación.
- Aplicar cambios en Cloud, Vercel o Producción.
