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

## Segunda ronda (re-revisión de f0c0e5eef, CHANGES_REQUESTED)

- H1: 0663 §3.4: antes de calificar como alta, el generador busca `<cadena del subaliado>-<número>` por valor; el cliente que ya existe resuelve sin alta. Caso de aceptación nuevo en F2.
- H2: 0666 §4.3: tabla L1–L9 con cada lectura con el cliente admin (consolidaciones, naviera, rastreo, próximo arribo, próximo zarpe y su tarjeta, club, referidos, academia, facturas y finanzas), y una prueba por lectura en P0.
- H3: 0663 §3.4: riesgo aceptado y revisión de impacto L2. (Corregido en la tercera ronda: la línea base no es MP-01; ver abajo.)
- No bloqueantes: guion y prueba del lote en la allowlist de F2; nota de cambio de la SDD-0336 en F3 y P5; D2 como recomendación pendiente de Sam; D-2 citada por 0637 mientras la #606 no se fusione; allowlist base de la 0666 completa por fase.

## Tercera ronda (re-revisión de 71058ccd9, CHANGES_REQUESTED)

- Sam autorizó nombrar `hailuway.com` en el repo público (respuesta «si» en el chat del DG, 2026-11-18, relayada por el DG). La 0666 lo vuelve a escribir.
- H2: 0666 §4.3 suma L10 (órdenes por aceptar), L11 (documentos firmados, con el BL), L12 (historial de avisos; las plantillas no nombran buque, texto editado NV), L13 y L14 (cotizaciones y estimados, 404). Descartadas por escrito: compras/[code], layout:70 y soporte (que igual responde 404 para el cliente final). Una prueba por lectura en P0 y archivos en la allowlist de P0.
- H3: la línea base de EXC-0663 es una `docs/governance/BASELINE-<fecha>.md` nueva en F2, sin tocar README §4.
- N1: candidatos por valor con `resolve_markbox`; fusionado sigue al vivo; borrado corta; dos rellenos cortan.
- Fecha estimada sin naviera: la de la oficina. Usos de `SITE_URL` U1–U12. L1 sin `seguimiento.ts`.
