# Handoff — SDD-0663 y SDD-0666 · Subaliados y portal del aliado

Fecha: 2026-11-18 · Rama: `claude/admiring-saha-bfeb23` · PR #676 (borrador) · Tipo: solo specs (`proposed`)

## Hecho

- `docs/specs/0663-subaliados-como-jobs/spec.md`: tercera versión, con todas las decisiones de Sam del 2026-11-18. DTD le cobra solo al aliado; los subaliados son trabajos en su estado de cuenta (formato de jobs de QuickBooks); sección «Aliados» en Clientes; «Asignar a un aliado» en la franja «Cliente» de la SDD-0662, que crea el subaliado solo; los siguientes códigos de un subaliado conocido entran solos en el generador de lotes.
- `docs/specs/0666-portal-del-aliado/spec.md` (número reservado por el DG): portal del aliado con registro de clientes y subaliados, prealertas, varios usuarios, portal del cliente final con marca blanca en un dominio pendiente de Sam, aspecto gráfico y requisitos legales. Primer entregable: maqueta navegable.
- Merge de `origin/main` (resuelve el conflicto del índice) y `docs/specs/README.md` regenerado.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `node scripts/check-numbering.mjs` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio es solo documental |
| Producción | NO CONSULTADA |

## Pendientes de esta tarea

- Sam aprueba las dos specs.
- El DG asigna fases y números de migración (0663 F2; 0666 P2 a P7).
- Sam decide el dominio de marca blanca y la forma de la dirección de cada aliado.

## FUERA DE ALCANCE DETECTADO

- SDD-0255 §8.5: no existe la cláusula de tratamiento de datos para aliados; frena la salida de la 0666.
- SDD-0258 §7: `/verificar` con la forma impresa tecleada y el código de referido para aliados; verificar si siguen vivos.
- Infraestructura del dominio de marca blanca (DNS comodín, certificado, correo): tarea de ops con OK de Sam.

## Ronda de revisión (2026-11-18, CHANGES_REQUESTED del DG en 349055eab)

- B1: excepción EXC-0663 a la SDD-0543 formalizada en 0663 §3.4 (alcance solo subaliados ya conocidos, salvaguardas, registro L3, texto de la nota para la 0543).
- B2: estado actual de la 0543 corregido; el código original en la ficha comodín queda NV.
- B3: cambio de marca al aliado raíz (SDD-0336, `get_portal_brand()`) en 0663 §3.5, con fases.
- B4: revisión de datos personales sobre el diseño en 0666 §6; §8.5 en la aceptación y por fase.
- B5: restricción por rol en los datos y amarre por dirección en 0666 §4.3 y §4.4. Evidencia: con su token, un cliente no lee contenedor, buque ni naviera por PostgREST (RLS por `get_user_tenant_id()`); el portal los lee con el cliente admin en `lib/portal/consolidation-queries.ts`, que es donde va la restricción.
- B6: mensaje neutro al registrar subaliado (0666 §4.1).
- B7: la RPC de F2 exige `reassign_shipment_owner` y `moduleEditDenial(clients)`.
- B8: aceptación y allowlist por fase.
- N1: el dominio de marca blanca no se escribe en las specs ni en este handoff.
- N2–N6: relaciones 0531, 0664 y 0674; líneas sin embarque o de otra cuenta; usuarios múltiples con auditoría e invitación de un solo uso; anti-enumeración, Storage por aliado y sin SVG; misma app sin romper fronteras.
