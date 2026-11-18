# Handoff — SDD-0663 y SDD-0666 · Subaliados y portal del aliado

Fecha: 2026-11-18 · Rama: `claude/admiring-saha-bfeb23` · PR #676 (borrador) · Tipo: solo specs (`proposed`)

## Hecho

- `docs/specs/0663-subaliados-como-jobs/spec.md`: tercera versión, con todas las decisiones de Sam del 2026-11-18. DTD le cobra solo al aliado; los subaliados son trabajos en su estado de cuenta (formato de jobs de QuickBooks); sección «Aliados» en Clientes; «Asignar a un aliado» en la franja «Cliente» de la SDD-0662, que crea el subaliado solo; los siguientes códigos de un subaliado conocido entran solos en el generador de lotes.
- `docs/specs/0666-portal-del-aliado/spec.md` (número reservado por el DG): portal del aliado con registro de clientes y subaliados, prealertas, varios usuarios, portal del cliente final con marca blanca en `hailuway.com`, aspecto gráfico y requisitos legales. Primer entregable: maqueta navegable.
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
- Confirmar con Sam la forma exacta de la dirección del aliado (`aa.hailuway.com`).

## FUERA DE ALCANCE DETECTADO

- SDD-0255 §8.5: no existe la cláusula de tratamiento de datos para aliados; frena la salida de la 0666.
- SDD-0258 §7: `/verificar` con la forma impresa tecleada y el código de referido para aliados; verificar si siguen vivos.
- Infraestructura de `hailuway.com` (DNS comodín, certificado, correo): tarea de ops con OK de Sam.
