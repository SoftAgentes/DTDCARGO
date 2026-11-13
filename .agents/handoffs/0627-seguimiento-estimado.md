# Handoff · SDD-0627 · Seguimiento estimado

- Fecha: 2026-11-13
- Owner: Worker `w-0627-seguimiento` (sesión hija del Subdirector «Portal del cliente»)
- Worktree: `.claude/worktrees/sdd-0627-seguimiento-estimado-f4dc4e`
- Rama: `claude/sdd-0627-seguimiento-estimado-f4dc4e` · base `main` = `11f90a32e`
- Spec: `docs/specs/0627-seguimiento-estimado/spec.md` (`in-progress`)
- Reserva: `refs/dtd/reservations/0627` y `refs/heads/codex/sdd-reserve-0627-seguimiento-estimado` → `f7a5ff6ba` (locales; el stub entró a la rama por cherry-pick)
- Permisos: commits, push de la rama propia y PR. Sin merge, sin producción.
- Estado de la tarea: lista-para-revision (ver VALIDACIÓN)

## OBJETIVO ORIGINAL

«Cuando salga el envío, estimamos los tiempos y sobre eso le vamos avisando al cliente» (Sam,
2026-11-13): ETA desde el zarpe, stepper del Portal con fechas estimadas, avisos por hito apagados
detrás de una bandera y con ensayo en seco.

## COMPLETADO

- **Medición previa:** `sailings.transit_days` (0096) es la fuente por ruta atada al contenedor;
  `carrier_tariffs.transit_days` (0330, texto) y `rates.transit_days` (0005) no se atan al
  contenedor. El zarpe con fecha ya existe (evento `shipped` de la 0477). **Sin tabla ni migración.**
- `lib/portal/seguimiento-estimado.ts`: estimador puro (zarpe real → ETA de puerto → aduana, bodega
  VE, reparto, entrega). Días de mar: `transit_days` → `eta − etd` → default por puerto (LGU 67) → 67, calibrado
  con el rastreo real (CMA CGM a La Guaira, 59–75 días de la carga a la ETA).
- `getShipmentNaviera` lee `sailings.transit_days` (`transitDays?` opcional).
- Detalle del envío en el Portal: «Est. 12 dic» en las etapas que faltan, con `aria-label`, nota
  «Fechas estimadas…» y «Entrega estimada» desde el zarpe. Antes del zarpe, nada cambia.
- `lib/studio/notifications/avisos-por-hito.ts`: `AVISOS_POR_HITO_LIVE = false` (declarada en
  `scripts/feature-constants.json`); al zarpar, `carga_en_camino` uno por cliente y contenedor;
  `resolveShipmentEta` suma la ETA estimada como cuarta fuente. Apagada, nada lee ni escribe.
- Ensayo en seco: acción `ensayarAvisosZarpe(consolidationId)` en Naviera. Cuenta envíos,
  destinatarios, envíos sin Shipping Mark y la regla del tenant; no inserta ni envía; sólo números.
- `/ui-check`: OK con un ajuste menor (espaciado de la nota), aplicado.

## VALIDACIÓN

Se completa en el commit final y en la PR. Pruebas focalizadas ya corridas (PASÓ):

- `lib/portal/__tests__/seguimiento-estimado.test.ts` — 12
- `lib/studio/notifications/__tests__/avisos-por-hito.test.ts` — 10
- `lib/studio/notifications/__tests__/resolve-shipment-eta.test.ts` — incluye 4 nuevas
- `app/studio/(app)/naviera/__tests__/ensayo-avisos-zarpe.test.ts` — 4 · `zarpe-avanza-envios.test.ts` sin cambios, verde
- `app/portal/(app)/envios/[code]/_components/__tests__/PortalShipmentDetailEstimado.test.tsx` — 3
- `PortalTrackingEnConstruccion.test.tsx` y `envios/__tests__/principal-tenant.test.tsx` — verdes
- `node scripts/check-feature-constants.mjs` — PASÓ (7 banderas)
- `pnpm docs:index` — regenerado

### Revisión independiente (sobre 23c6a7420), atendida

- M1: la página pasa «hoy»; las etapas vencidas dicen «Por confirmar» y la entrega «Pendiente de
  confirmar». Pruebas pura y jsdom con la ETA ya pasada.
- M2: llegada a puerto con la precedencia de `resolve-shipment-eta` (aduana real → `pod_eta` /
  `sailings.eta` → estimada).
- M3: terrestre con nota propia, sin zarpe ni puerto.
- B1: bandera en `avisos-por-hito-flag.ts` (sin ciclo). B2: fechas en `America/Caracas`, con las
  `date` puras ancladas a mediodía UTC. B3: rótulos distintos para «puerto» y «default».
- Por decisión del DG, la vista estimada va sin bandera. Ya no se corre `pnpm verify` local: lo
  reemplazan el CI de GitHub y la revisión independiente.

### Revisión del delta (sobre 912ffb740), atendida

- M2 (bloqueante): SeaRates cuenta sólo con `fetchStatus === "ok"`, en la página, la tarjeta
  Naviera y `resolve-shipment-eta` (helpers `etaPodVigente` y `etaPuertoConocida`).
- Prueba nueva de la página real (`envios/[code]/__tests__/eta-puerto-consistente.test.tsx`): ok,
  error, ETA pasada y `date` pura. Mutante verificado: sin el filtro en `page.tsx`, el caso «error»
  falla.
- ETA pasada: la tarjeta dice «por confirmar», igual que la nota. Prueba B2 a las 02:00 UTC.
  Límite anotado en la spec: con una ETA conocida, un zarpe atrasado ya no la corre.

## PENDIENTES DE ESTA TAREA

- CI de Calidad verde sobre la cabeza final y aprobación de la revisión independiente (portón del DG). `pnpm verify` local: NO EJECUTADO por decisión del DG.
- Calibrar con la operación aduana (+10) y reparto (+12/+14). Días de mar ya calibrados a La Guaira.
- **Límites (anotados en la spec, sin ampliar):** un solo puerto calibrado (La Guaira); Maracaibo
  (63–71) y Barranquilla (46–49) no tienen código en `ports` y caen al default de 67. El ancla es el
  evento de zarpe (0477), no la fecha de CARGA que registra la oficina.

## FUERA DE ALCANCE DETECTADO

- El catálogo describe `carga_en_camino` como «cuando un contenedor ya zarpado se carga desde el
  packing list» (SDD-0543). Con la 0627 encendida también sale al zarpar; al encender, conviene
  actualizar el `hint` y quitar `gancho: "pendiente"`.
- No hay botón del ensayo en la pantalla de Naviera (hoy es una acción de servidor).
- Que la 0477 y una regla activa de `carga_en_camino` existan en producción: NO MEDIDO (no se leyó
  producción).
- `pnpm sdd:next` tarda más de 2 minutos en esta PC (931 refs).

## HANDOFF AL DIRECTOR

- Revisión independiente de la PR; integra el DG por trenes. Sin migración: no frena publicación.
- Decisión para Sam/DG: las fechas estimadas del Portal no tienen bandera propia y se verán al
  integrar (en envíos ya embarcados con evento `shipped` o ETD). Encender `AVISOS_POR_HITO_LIVE`
  exige el OK nominal de Sam, con el ensayo corrido sobre el contenedor real.
- Archivos compartidos: `app/studio/(app)/naviera/actions.ts`, `resolve-shipment-eta.ts`,
  `naviera-tracking/queries.ts`. No toca archivos del T3 del Rebrand.
- Impacto documental: spec nueva + índice. Graphify/Archify: no regenerados en el worktree
  (cambio de producto acotado); queda para el cierre del DG desde main integrado.
