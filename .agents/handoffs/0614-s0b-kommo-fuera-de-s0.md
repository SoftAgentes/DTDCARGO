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

Corrida del turno de máquina del 2026-11-07, de 19:29:51Z a 19:44:48Z, sobre `5f867f8f7`. Las
pruebas se escribieron antes de correrlas. El rojo se tomó con los seis archivos de producto en su
versión de `main` `7e75f7708` (`git checkout origin/main -- …`), restaurados desde HEAD después.

**4 archivos en rojo, 11 de 68 pruebas fallidas:**

| Prueba | Rojo antes del cambio |
|---|---|
| `CommercialCard.test.tsx` | Con el resumen oculto, la tarjeta se pintaba (1). El control ya pasaba |
| `direccion/__tests__/queries.test.ts` | El smoke traía `{ pipeline: 1500, leadsActivos: 1 }` y leía `kommo_leads` (1). `resumenComercialKommo` no existía (2): es un rojo por función nueva, no por comportamiento |
| `dashboard-types.test.ts` | `newLeads` sin `oculto`, en el editor, en la config guardada, en el default y con fuente «leads» accesible (6) |
| `CrmEmbudosSlot.test.tsx` | El aviso decía «los leads siguen en las otras pestañas del CRM» (1) |

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Las 4 pruebas de S0b (verde, `5f867f8f7`) | PASÓ: 68 de 68 |
| M1: la tarjeta sin el `return null` | PASÓ: muere (1 rojo) |
| M2: el resumen de Dirección con `oculto: false` | PASÓ: muere (1 rojo) |
| M3: `newLeads` sin `oculto` | PASÓ: muere (6 rojos) |
| M4: la validación no descarta lo oculto | PASÓ: muere (3 rojos) |
| M5: el catálogo accesible no descarta lo oculto | PASÓ: muere (3 rojos) |
| M6: Embudos vuelve a remitir a las otras pestañas | PASÓ: muere (1 rojo) |
| Vecinas, antes del merge: dashboard, direccion, crm, `fase-c-rename` e `invoice-read-boundary` | FALLÓ y se corrigió: 1 de 261. `crm-rename.test.ts` recorre los `.tsx` de `crm/_components`, y el nombre de la prueba nueva de Embudos decía «Kommo» en texto visible. Arreglado en `910d05999`; `crm-rename` y la prueba de Embudos dan 27 de 27 |
| `tsc --noEmit` (`5f867f8f7`) | PASÓ: exit 0, 279 s |
| ESLint sobre los 10 archivos de código y pruebas | PASÓ: exit 0 |
| Después del merge de `main` `eef75ebef` (`3ba3d3172`): direccion, dashboard, crm, reportes, cotizador e `invoice-read-boundary` | PASÓ: 26 archivos, 354 pruebas, incluidas las de S0 de la #415 |
| `tsc` después del merge | NO EJECUTADO: S0 y S0b no comparten archivos de código. Lo cubre el CI de la PR |
| `build-docs-index --check`, `check-numbering` y `git diff --check`, después del merge | PASÓ: 596 specs |
| `/ui-check` | OK para commit, con 3 hallazgos menores. (1) En Dirección, la sección «Operación + comercial» queda solo con Operación, a todo el ancho; su comentario en `direccion/page.tsx:169` queda viejo, pero ese archivo está fuera de la allowlist. (2) Con 5 KPI la grilla `auto-fit` no deja huecos. (3) El aviso de Embudos cumple el estado «sin migración» |
| Revisión en el navegador | NO EJECUTADO: el Studio pide sesión |
| `pnpm verify` | NO EJECUTADO: el portón ahora es el CI «Calidad continua» (orden del Director General) |

`node_modules` de S0b: instalación propia (`corepack pnpm install --frozen-lockfile --offline`, 1 min
58 s). Reemplaza la junction a la #415, que quité con `cmd /c rmdir` antes de instalar.

## COMMITS

- `2a6f319e4` feat(studio): S0b oculta las cifras de Kommo de Dirección y el Dashboard.
- `6f1ad3b35` docs(studio): enmienda S0b con su allowlist y handoff.
- `5f867f8f7` docs(studio): tabla antes → después por pantalla y rol.
- `910d05999` test(studio): la prueba de Embudos no dice «Kommo» en texto visible.
- `3ba3d3172` Merge origin/main `eef75ebef` (#415). El único conflicto fue §13 de la spec 0614: se
  conservan las dos entradas, S0 y después S0b. La §5 se combinó sola. La spec queda +59 −0 contra
  `main` y el índice se regeneró.
- El commit de este handoff, con los resultados.

## PR / BRANCH

[PR #419](https://github.com/SoftAgentes/DTDCARGO/pull/419), en borrador contra `main`. Rama
`claude/0614-s0b-kommo-fuera-de-s0`. Se publicó en `5f867f8f7` antes de que entrara la #415, por
orden del Director General.

## PENDIENTES DE ESTA TAREA

- La fusión la hace el Director General. Después: limpiar este worktree y la rama, con evidencia.
- El worktree de la #415 (`angry-ellis-1ec8c1`) lo limpia el Subdirector cuando esta sesión quede
  inactiva. S0b ya no depende de él.

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
