---
sdd: 0331
title: Retirar consultas de identidad por URL insegura
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0046
  - SDD-0191
confidencialidad: interno
---

# SDD-0331 — Retirar consultas de identidad por URL insegura

## Problema

La verificación de identidad del Studio conservaba dos caminos que podían sacar
datos personales del sistema:

1. un provider CNE habilitable por entorno enviaba nacionalidad y cédula por
   `GET`, sin exigir HTTPS y con el documento en query params;
2. la UI construía enlaces HTTP hacia CNE o SENIAT y, para personas, prellenaba
   la cédula en la URL.

El provider estaba deshabilitado por defecto, pero podía activarse sólo con una
variable de entorno. Los enlaces manuales sí estaban disponibles en la tarjeta.
No existe en el repositorio una evaluación aprobada del proveedor, contrato,
retención ni endpoint HTTPS oficial comprobado.

## Decisión

1. Se eliminan el motor de consulta, los providers, la Server Action automática,
   sus variables de entorno y sus tests obsoletos.
2. Se retiran los enlaces CNE/SENIAT y cualquier prellenado de documento.
3. Se conserva la foto mediante signed URL privada y la acción manual con RBAC,
   filtro defensivo de tenant y resultado advisory.
4. Los valores históricos de `doc_registry_name` pueden seguir mostrándose como
   «Nombre registrado previamente», sin generar consultas nuevas.
5. Un contrato recorre `app/` y `lib/` para impedir la reaparición del provider,
   las URLs o la acción automática sin una decisión nueva.

## Condiciones para una integración futura

- nueva SDD y revisión de datos personales;
- proveedor identificado y evaluado, con contrato, región y retención;
- HTTPS verificado;
- documento fuera de path y query string; autenticación en headers y payload
  protegido cuando el contrato técnico lo permita;
- timeout, límites, auditoría minimizada y fallback manual;
- activación explícita, no sólo por presencia accidental de una variable.

## Gobernanza

- `cumplimiento`: minimización y fail-closed; no se transmiten cédulas, RIF o
  nombres a un tercero sin evaluación.
- `cumplimiento`: ERR-01; se elimina un camino latente que podía activarse con
  configuración incompleta.
- `cumplimiento`: FRM-01; las acciones manuales conservan estados ocupado,
  éxito/error y prevención de doble envío mediante `ActionButton`.
- `cumplimiento`: LOD-01; la tarjeta mantiene una única acción primaria y separa
  el veredicto negativo reversible.
- `no aplica`: migración, datos históricos, Cloud o despliegue.

## Allowlist exacta

- `.env.example`
- `app/studio/(app)/clientes/actions.ts`
- `app/studio/(app)/clientes/[markbox]/page.tsx`
- `app/studio/(app)/clientes/_components/IdentityVerificationCard.tsx`
- `app/studio/(app)/clientes/__tests__/identity-actions.test.ts`
- `app/studio/(app)/clientes/__tests__/identity-privacy-contract.test.ts`
- `lib/studio/identity/index.ts` (eliminado)
- `lib/studio/identity/types.ts` (eliminado)
- `lib/studio/identity/name-match.ts` (eliminado)
- `lib/studio/identity/notify-mismatch.ts` (eliminado)
- `lib/studio/identity/providers/cne-cedulave.ts` (eliminado)
- `lib/studio/identity/providers/cne-verifik.ts` (eliminado)
- `lib/studio/identity/__tests__/auto-enabled.test.ts` (eliminado)
- `lib/studio/identity/__tests__/cne-cedulave.test.ts` (eliminado)
- `lib/studio/identity/__tests__/name-match.test.ts` (eliminado)
- `lib/studio/identity/__tests__/verify-identity.test.ts` (eliminado)
- `docs/legal/privacidad/inventario-terceros.md`
- `docs/legal/privacidad/registro-tratamiento.md`
- `docs/legal/privacidad/mapa-de-borrado.md`
- `docs/specs/0046-verificacion-identidad/spec.md`
- `docs/specs/0331-retirar-consultas-identidad-inseguras/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-identity-privacy-close.md`

## Aceptación

- Ningún archivo ejecutable de `app/` o `lib/` contiene las URLs de consulta,
  `IDENTITY_CNE_*` o `verifyIdentityAction`.
- La tarjeta conserva foto privada, estado histórico y veredicto manual.
- La acción manual conserva RBAC y filtro explícito de tenant.
- La documentación viva distingue la integración retirada del procesamiento
  manual vigente.
- Tests focales, TypeScript, lint, documentación y gobernanza pasan localmente.

## Fuera de alcance

- Borrar estados históricos `doc_verify_*` o solicitudes retenidas por terceros.
- Sustituir CNE/SENIAT por otro proveedor.
- Aplicar cambios en Cloud, Vercel o Producción.
