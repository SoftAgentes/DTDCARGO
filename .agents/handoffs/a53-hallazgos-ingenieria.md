# Handoff · a53-hallazgos-ingenieria

- **Fecha:** 2026-09-10
- **Owner / sesión:** `codex-a53-hallazgos-ingenieria-20260910`
- **Task ID:** `a53-hallazgos-ingenieria`
- **Estado:** lista-para-revisión
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/a53-hallazgos-ingenieria`
- **Rama:** `codex/a53-hallazgos-ingenieria`
- **Base revisada:** `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2` (`origin/main`)
- **SDD reutilizada:** `docs/specs/0441-colores-semanticos-marca/` (`in-progress`, `updated: 2026-09-10`)

## OBJETIVO ORIGINAL

Cerrar los seis hallazgos de INGENIERÍA que el dictamen
`codex/medicion-tokens-a53-a56:docs/audits/2026-09-10-medicion-31-y-30.md`
dio por ciertos o reformuló, sin resolver los dos conflictos reservados a Sam:
`KpiCard` (A5.3-3) y 40/44 px en `/compras` (A5.6-8). El defecto prioritario era
evitar que un fallo al deshacer conservara el check verde del toast original.

## COMPLETADO

1. **Toast — dictamen A5.3-2.** Mientras `actionState === "failed"`, el icono
   exterior usa el tono `error`, sin depender del tono original success/warning
   (`ToastProvider.tsx:781-783`). Se conservó el mensaje interior con
   `role="alert"`. La prueba de regresión (`ToastProvider.test.tsx:438-469`)
   parte de un check success, provoca el rechazo de Deshacer y exige que el
   check desaparezca y sea sustituido por la X de error.
2. **RateDrawer — dictamen A5.3-2.** El error general ahora usa el mismo
   `StatusIcon tone="danger"` de los errores de campo y conserva `role="alert"`
   (`RateDrawer.tsx:470-490`). La prueba focal está en
   `RateDrawer.test.tsx:36-45`.
3. **Badge — dictamen A5.3-1.** Se retiró `dot` del contrato público y de todas
   las aperturas del `Badge` canónico; el `StatusIcon` incondicional permanece
   (`Badge.tsx:15-20,62`). El barrido AST encontró **82** atributos reales
   (8 explícitos + 74 shorthand), uno más que el 8 + 73 del dictamen; además se
   retiraron cuatro props de wrappers que quedaron muertas. No se tocaron los
   dos homónimos válidos. `Badge.test.tsx:6-18` fija el contrato sin `dot` y el
   único icono semántico.
4. **PortalClaims — dictamen A5.3-5.** Los seis estados existentes reutilizan
   `claimStatusTone` y `StatusIcon`, sin crear semántica nueva
   (`PortalClaims.tsx:259,287`). La prueba recorre reportado, evaluación,
   aprobado, pagado, resuelto y rechazado y exige texto + SVG, sin el punto
   legado (`PortalClaims.test.tsx:14-58`). Consumidor y prueba quedaron en la
   allowlist.
5. **Comentario CSS — dictamen A5.3-4.** `app/globals.css:969-974` ya describe
   el tratamiento neutral real en claro/oscuro y la superficie warning; se
   modificó únicamente el comentario, no las reglas CSS.
6. **Aritmética — dictamen A5.3-6.** `spec.md:52-66` registra que la allowlist
   congelada tenía 76 rutas y que el merge agregó después el handoff editorial
   `.agents/handoffs/pr31-publication-review-20260907.md`: `76 + 1 = 77`.
   Queda explícito que fue no conformidad literal de entrega, no consumidor de
   producto ni cambio visual. La allowlist correctiva quedó en 142 rutas
   no vacías, 142 únicas.

Clasificación de gobernanza: **cumplimiento** de ERR-01, A11Y-01 y VIS-01 al
dar texto + icono de error y conservar regiones `alert`; **cumplimiento** de
CMP-01 al retirar una prop pública sin efecto; **no aplica** FRM-01; sin
excepciones ni no conformidades nuevas.

## VALIDACIÓN

- **PASÓ — preflight:** guard del harness; raíz, rama y base exactas; árbol
  inicial limpio; claim adquirido por esta sesión.
- **PASÓ — instalación:** `corepack pnpm install --frozen-lockfile`; pnpm
  12.3.4, 813 paquetes, lockfile sin cambios.
- **PASÓ — RED/GREEN Toast:** antes del arreglo, la nueva prueba falló 1/18
  porque seguía presente el SVG de check; después pasó 18/18.
- **PASÓ — RED/GREEN RateDrawer:** antes del arreglo, la prueba falló 1/1 por
  ausencia de la X danger; después pasó 1/1.
- **PASÓ — suite focal conjunta:** `corepack pnpm vitest run` sobre los tests de
  ToastProvider, Badge, RateDrawer y PortalClaims: 4 archivos, 22 pruebas.
- **PASÓ — Badge sin cambio visual:** render SSR antes y después produjo markup
  idéntico para `dot={true}` y `dot={false}`, un SVG en ambos casos y el mismo
  SHA-256 `df4c76b1ad738a6e87ce9690a48beee1c98925b6dd39751b2c7bda25753ec9ac`.
  `PortalSidebar.tsx` conserva su prop `SidebarLeaf.dot` leída en sus dos ramas
  y `WhatsAppFAB.tsx` conserva `data-has-dot`; ambos tienen diff cero.
- **PASÓ — tipos:** `corepack pnpm typecheck`.
- **PASÓ — docs/SDD:** `corepack pnpm docs:check` y
  `corepack pnpm sdd:check`; 395 specs y 403 migraciones, con las exenciones
  históricas reportadas por el checker. `corepack pnpm docs:index` regeneró el
  índice (395 specs, 54 huecos); `docs/specs/README.md` quedó idéntico y no se
  editó a mano.
- **PASÓ — alcance/higiene:** 70 rutas de producto modificadas, cero fuera de
  `allowlist.txt`; allowlist 142/142 sin duplicados;
  `git -c core.whitespace=cr-at-eol diff --check <base>` pasó. La opción evita
  tratar como whitespace nuevo los CRLF preexistentes de `LineMatchDrawer.tsx`.
- **FALLÓ / INCOMPLETO — `corepack pnpm verify`:** no es un verde global. Antes
  de E2E pasaron harness 12/12, lint (0 errores; 8 warnings preexistentes), RSC
  boundary (1.596 módulos), typecheck, 4 Edge Functions, Vitest (516 archivos,
  6.501 pruebas), docs, numeración, 5 constantes, 5 fuentes de componentes, 28
  políticas, 145 contratos SQL con rollback y schema-rebuild (385 migraciones
  + 18 sólo-ledger, 219 tablas y 2 tenants). El paso E2E ejecutó su último caso
  visible pero el proceso no emitió resumen ni terminó: quedó un worker de
  Playwright huérfano por más de cuatro minutos y se interrumpió el árbol propio.
- **NO DISPONIBLE — migraciones aplicadas:** el propio gate omitió la comprobación
  por ausencia de `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- **NO DISPONIBLE — E2E autenticado:** `playwright test --list` confirmó 186
  pruebas. En la ejecución se observaron 153 pasadas, 15 fallidas y 18 omitidas;
  los 15 fallos son cinco casos de auth/global-search repetidos en Chromium,
  mobile-chrome y mobile-safari y el servidor reportó ausencia de
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Las 18 omisiones
  son journeys Tier 3/seed. No se atribuyen estos límites a la rama.
- **PASÓ — build de producción independiente:** `node scripts/check-build.mjs`
  terminó con exit 0, generó 160 páginas y restauró `tsconfig.json`. Se ejecutó
  aparte porque el E2E colgado impidió que `verify` alcanzara su último paso.
- **NO EJECUTADO — revisión visual `/ui-check`:** asignada al Director antes de
  integrar. Tampoco se certifican Supabase real, UAT ni producción.

## COMMITS

1. `f9cb1131` — `feat(studio): SDD-0441 — corrige icono al fallar acción`
2. `5b3f3ca4` — `feat(studio): SDD-0441 — agrega icono al error general de tarifas`
3. `2ad97632` — `feat(studio): SDD-0441 — retira la prop muerta Badge.dot`
4. `ac533997` — `feat(DTD-0441): alinea estados de reclamos con iconos`
5. `683b9f39` — `docs(DTD-0441): corrige comentario de badges del portal`
6. `docs(DTD-0441): registra cierre de allowlist histórica` — commit que
   contiene este documento; su SHA final queda en el PR para evitar recursión.

## PR / BRANCH

- Rama: `codex/a53-hallazgos-ingenieria`.
- Draft PR contra `main`: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/46
  (PR #46).
- Base remota verificada tras `git fetch origin`:
  `origin/main == 8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`.
- No se autoriza merge, deploy, migraciones, ruleset ni limpieza.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación. El límite de credenciales del E2E queda documentado
como NO DISPONIBLE y no es un defecto de esta rama.

## FUERA DE ALCANCE DETECTADO

- **A5.3-3:** `app/m/_components/KpiCard.tsx` colapsa `info`, `warning` e `ink`;
  Sam debe escoger señal no cromática o tratamiento de warning. Sin cambios.
- **A5.6-8:** `/compras` conserva 40 px frente a los 44 px declarados; Sam debe
  resolver qué decisión prevalece. Sin cambios.

## HANDOFF AL DIRECTOR

Revisar los seis commits sobre la base indicada y correr `/ui-check` antes de
integrar, prestando atención al reemplazo success/warning → danger durante un
fallo de acción y al icono del error general de tarifas. No confundir el build
independiente verde con un `verify` global verde: E2E autenticado fue NO
DISPONIBLE y el teardown quedó INCOMPLETO. El claim se liberará como último paso
de esta sesión, después de publicar el draft PR y terminar toda escritura.
