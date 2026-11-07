# Handoff · SDD-0614 S0b — Kommo fuera de las tres zonas de S0 (PR 0b de la 6.6)

- **Owner:** Claude Worker «S0 · ocultar Kommo» (el mismo de la #415). Encargo del Director General,
  traído por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`) el
  2026-11-07. Claim: `s0b-angry-ellis`.
- **Ruta:** `DTD-worktrees/0614-s0b-kommo-fuera-de-s0`, creada con
  `node scripts/harness-worktree.mjs start 0614-s0b-kommo-fuera-de-s0`. No es el árbol de la #415.
- **Rama:** `claude/0614-s0b-kommo-fuera-de-s0`, desde `origin/main` `7e75f7708`. `start` la creó
  como `codex/…` y la renombré al nombre que propuso el Subdirector, antes del primer commit.
- **SDD:** [0614](../../docs/specs/0614-crm-reemplazos-kommo/spec.md), enmienda S0b: §1.3, §2.1,
  §5 (PR 0b y allowlist), §8, §9 y §13. Decisión D-6.6-1.
- **Permisos del encargo:**
  - PR nueva, y no antes de que la #415 esté fusionada.
  - Antes de publicar, traer `main` con el driver y regenerar el índice.
  - Push en un comando aparte. Sin merge, sin producción y sin migraciones.
  - Correr pruebas solo con el turno de máquina del Subdirector, con 1 worker y de a una.

## OBJETIVO ORIGINAL

Ocultar, sin borrar, las cifras de Kommo que el Studio todavía muestra fuera de las tres zonas de
S0, por la misma D-6.6-1:

1. «Pipeline CRM» y «Leads activos» de Dirección (`CommercialCard.tsx:65,72`, desde
   `listKommoLeads` en `lib/studio/direccion/queries.ts`).
2. El KPI de leads del Dashboard (`leadsKpi`, `dashboard-kpi-queries.ts:244`, pedido en
   `dashboard/page.tsx:158`).
3. El texto de `CrmEmbudosSlot.tsx:47`, que remite a las pestañas de Kommo ocultas.

Con una enmienda en la spec y su allowlist exacta. Las pruebas tienen que dar rojo antes del cambio,
con mutantes donde aplique, y la pantalla pasa por `/ui-check`.

## COMPLETADO

Las líneas son de `main` `7e75f7708`, medidas antes de editar.

- **Dirección:**
  - `lib/studio/direccion/queries.ts`:
    - `CommercialSummary.oculto`.
    - `getDireccionData` ya no llama a `listKommoLeads`; se quitan la llamada y el import.
    - Devuelve `{ pipeline: 0, leadsActivos: 0, oculto: true }`.
    - La cuenta de antes queda como `resumenComercialKommo`, exportada y sin consumidor.
  - `CommercialCard.tsx`: con `oculto` devuelve `null`. `direccion/page.tsx` no se toca, y la
    sección «Operación + comercial» queda solo con Operación.
- **Dashboard:**
  - `dashboard-catalog.ts`: el tipo gana `oculto?: true` y la entrada `newLeads` lo lleva, con
    comentario. La entrada y `DEFAULT_CONFIG` no cambian.
  - `dashboard-types.ts`: `validateDashboardConfigInput` y `accessibleCatalog` descartan lo
    oculto.
  - Efectos:
    - El KPI no se ofrece en el editor.
    - Una config guardada no lo pinta.
    - El default no lo trae: el Dashboard por defecto pasa de 6 KPI a 5.
    - La página ya no pide la fuente «leads», así que `leadsKpi` no se llama, sin tocar
      `dashboard/page.tsx`.
  - `dashboard-kpi-queries.ts`: solo un comentario sobre `leadsKpi`.
- **Embudos:** `CrmEmbudosSlot.tsx`:
  - El estado sin la 0506 dice «Falta aplicar la migración 0506 en esta base.».
  - Sale «Mientras tanto, los leads siguen en las otras pestañas del CRM».
  - El comentario de cabecera ya no dice que Embudos «convive» con Kommo. Era el FUERA DE ALCANCE
    de la #415.
- **Spec:** enmienda S0b con su allowlist exacta (§5) e historial (§13).

## Rojos previos

PENDIENTE: se corren con el turno de máquina. Las pruebas se escribieron antes de correrlas. El rojo
se toma con los archivos de producto en su versión de `main`
(`git checkout origin/main -- <archivos de producto>`) y después se restauran desde HEAD.

## VALIDACIÓN

PENDIENTE: con el turno. Plan:

- Las cuatro pruebas de S0b, rojas contra `main` y verdes con el cambio.
- Un mutante por pieza:
  - la tarjeta sin el `return null`;
  - el resumen con `oculto: false`;
  - `newLeads` sin `oculto`;
  - la validación sin filtrar lo oculto;
  - el texto viejo de Embudos.
- Vecinas: `lib/studio/dashboard`, `lib/studio/direccion`, `app/studio/(app)/direccion`,
  `app/studio/(app)/dashboard`, `app/studio/(app)/crm`, `fase-c-rename` e `invoice-read-boundary`.
- `tsc`, ESLint sobre lo tocado, `check-numbering`, `build-docs-index --check`, `git diff --check`
  y `/ui-check`.

Ya corridos sin turno, porque no cargan la máquina:

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ: 596 specs |
| `node scripts/check-numbering.mjs` | PASÓ |
| `git diff --check` | PASÓ |

## COMMITS

Se anotan al commitear.

## PR / BRANCH

Rama `claude/0614-s0b-kommo-fuera-de-s0`. La PR se abre después de que la #415 esté fusionada.

## PENDIENTES DE ESTA TAREA

- Rojos previos, mutantes y validación con el turno de máquina.
- Traer `main` después de la fusión de la #415. La spec 0614 choca en §5 (bloque de S0) y §13
  (historial), y también el índice. Se resuelven a mano, conservando los dos lados, y se regenera
  el índice.
- Publicar, abrir la PR en borrador y mandarle al Subdirector el SHA, el numstat y los rojos.

## FUERA DE ALCANCE DETECTADO

- **Debilidad conocida de la #415:** `app/studio/(app)/cotizador/__tests__/sin-cruce-kommo.test.ts`
  es una prueba de texto, no de comportamiento: busca `findKommoContactsByPhone`, `kommoMatches` y
  «Coincide con el CRM» en el código sin comentarios. No la cambio ahora; lo decide el Director
  General.
- Sin otras cifras de Kommo a la vista en `app/studio` fuera del CRM. Lo revisé con `git grep` sobre
  los imports y las lecturas de `kommo_*`. Quedan las del cotizador (`patch_price` y
  `patch_stage`, en S2) y las de la propia pantalla del CRM, ya ocultas en S0.

## HANDOFF AL DIRECTOR

- **Cambio visible:** el Dashboard por defecto muestra 5 KPI en vez de 6 y Dirección pierde la
  tarjeta Comercial. No puse otro KPI ni otra tarjeta en su lugar porque sería una decisión de
  producto. R5 (S3) trae los KPI del CRM propio.
- La config de cada usuario en `user_dashboard_prefs` no se toca. `newLeads` se descarta al leerla
  y, si el usuario guarda desde el editor, ya no se guarda.

## Impacto documental

- Canónico: la spec 0614 (enmienda S0b). El índice no cambia (`docs:check` en verde).
- Graphify, Archify y Obsidian: NO EJECUTADO. Los publica el Director General desde `main`.
