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

## Antes → después, por pantalla y por rol (para Sam)

Los roles salen del código, en `main` `7e75f7708`. El Studio tiene siete roles: `admin`,
`commercial`, `operations`, `accounting`, `warehouse`, `support` y `marketing`
(`lib/studio/user-types.ts:13-20`). `admin` siempre pasa (`lib/studio/rbac.ts:343`). Dirección
no es un rol: es un módulo solo de `admin`.

Qué ve cada rol depende de la matriz `ROLE_MODULE_ACCESS` (`rbac.ts`):

| Módulo | Roles que lo ven |
|---|---|
| `tracking` (`:62`) | commercial, operations, accounting, warehouse, support |
| `naviera` (`:74`) | operations, accounting |
| `kommo` (`:99`), el CRM | commercial |
| `direccion` (`:114`) | solo admin |
| `invoices` (`:118`) | accounting |

Los KPI del Dashboard se filtran por rol con `canAccessModule(role, …)`, sin los permisos por
usuario (`app/studio/(app)/dashboard/page.tsx:107`).

**El Dashboard por defecto** es `DEFAULT_CONFIG` (`lib/studio/dashboard/dashboard-catalog.ts:103`),
filtrado por rol. Antes traía seis KPI:

- «Embarques activos» (`tracking`, `:53`)
- «On-time delivery» (`tracking`, `:54`)
- «Ingresos del mes» (`invoices`, `:60`)
- «Leads en pipeline» (`kommo`, `:65`)
- «Facturas vencidas» (`invoices`, `:61`)
- «CBM en tránsito» (`naviera`, `:55`)

| Pantalla | Rol | Antes | Después |
|---|---|---|---|
| Dashboard, por defecto | admin | Los seis KPI | Cinco: Embarques activos, On-time delivery, Ingresos del mes, Facturas vencidas y CBM en tránsito. Sin «Leads en pipeline» |
| Dashboard, por defecto | commercial | Tres: Embarques activos, On-time delivery y **Leads en pipeline** | Dos: Embarques activos y On-time delivery. Pierde su único KPI comercial del default |
| Dashboard, por defecto | operations | Embarques activos, On-time delivery y CBM en tránsito | Igual (no veía `kommo`) |
| Dashboard, por defecto | accounting | Embarques activos, On-time delivery, Ingresos del mes, Facturas vencidas y CBM en tránsito | Igual (no veía `kommo`) |
| Dashboard, por defecto | warehouse, support | Embarques activos y On-time delivery | Igual |
| Dashboard, por defecto | marketing | Ninguno de los seis (no ve `tracking`, `invoices`, `kommo` ni `naviera`) | Igual |
| Dashboard, config guardada que trae `newLeads` (`user_dashboard_prefs`) | admin, commercial | «Leads en pipeline» aparece donde el usuario lo puso | No aparece. Los demás KPI quedan en su orden. Si `newLeads` era lo único guardado, la config queda vacía y se usa el default (`page.tsx:111-113`). La fila de la base no se toca |
| Dashboard, config guardada que trae `newLeads` | operations, accounting, warehouse, support, marketing | Ya no lo veían: el filtro por rol lo descartaba | Igual |
| Editor del Dashboard («Configurar dashboard», `DashboardEditorDrawer.tsx:64`) | admin, commercial | Ofrece «Leads en pipeline» (`newLeads`) | Ya no lo ofrece. El resto del catálogo sigue igual |
| Editor del Dashboard | los demás roles | No lo ofrecía (no ven `kommo`) | Igual |
| Dirección › tarjeta «Comercial» | admin (`direccion/page.tsx:55` manda a los demás al Dashboard) | Tarjeta con «Pipeline CRM» (USD en etapas abiertas) y «Leads activos» (sin cerrar), las dos del espejo de Kommo y con enlace a `/studio/crm` | La tarjeta no aparece. En «Operación + comercial» queda solo la de Operación |
| CRM › Embudos, aviso «Los embudos todavía no están activos.» | Entran al CRM los que ven `kommo`: commercial y admin, más quien tenga un permiso por usuario (`crm/page.tsx:62`). El tablero lo ven solo admin y commercial (`CrmEmbudosSlot.tsx:26`, `crm-tablero.ts:39`); a los demás les sale «Tu rol no usa el CRM propio.» | «Falta aplicar la migración 0506 en esta base. Mientras tanto, los leads siguen en las otras pestañas del CRM.» | «Falta aplicar la migración 0506 en esta base.» |

Sobre el aviso de Embudos: solo sale en una base sin la 0506. Producción la tiene aplicada desde el
2026-11-04 (§1.1 de la spec), así que en producción no lo ve nadie. Sí aparece en un entorno de
prueba sin esa migración.

## HANDOFF AL DIRECTOR

- **Cambio visible:** el Dashboard por defecto muestra 5 KPI en vez de 6 y Dirección pierde la
  tarjeta Comercial. No puse otro KPI ni otra tarjeta en su lugar porque sería una decisión de
  producto. R5 (S3) trae los KPI del CRM propio.
- La config de cada usuario en `user_dashboard_prefs` no se toca. `newLeads` se descarta al leerla
  y, si el usuario guarda desde el editor, ya no se guarda.

## Impacto documental

- Canónico: la spec 0614 (enmienda S0b). El índice no cambia (`docs:check` en verde).
- Graphify, Archify y Obsidian: NO EJECUTADO. Los publica el Director General desde `main`.
