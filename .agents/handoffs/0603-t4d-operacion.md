# Handoff · SDD-0603, tramo 4d: avisos de Operación y marketing con `Aviso`

- **Owner:** Claude (Worker), sesión abierta por el Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Worktree:** `.claude/worktrees/0603-t4d-operacion-e26034`. **Rama:** `claude/0603-t4d-operacion-e26034`, desde `claude/tren-ae` `4441f65ac` (tren #540, ola 1, trae `Aviso`).
- **SDD:** 0603 (BD-037) sobre el componente de SDD-0628. Detalle, allowlist, medición, «no aplica», roles y gate VIS-01 en `docs/specs/0603-claridad-controles/tramo-4d.md`. No se edita `spec.md`.
- **Encargo:** adoptar `Aviso` en los avisos hechos a mano de los 50 archivos del grupo. Autorizados el push de la rama y la PR lista para revisión contra main. Prohibidos fusionar, la imagen de prueba y producción. Auto-fix apagado (corrección del DG del 2026-11-14, transmitida por el Subdirector).

## Hecho

- 78 `<Aviso>` en 44 de los 50 archivos. Los 6 restantes no tienen aviso real: BitacoraClient, DispatchDashboardClient, RulesView, TemplatesView, MarkdownLite y NewOperarioDrawer.
- Pills, estados y errores de campo no se tocan, y los textos no cambian. La excepción son los glifos «✓» y «⚠», que reemplaza el icono de `Aviso`.
- Contrato nuevo `app/studio/_components/__tests__/avisos-t4d-contract.test.ts`: sin contornos de estado en línea ni `role` alert/note crudos, salvo excepciones contadas, y un piso de 78 avisos. Tiene 4 mutantes.
- `EditOperarioDrawer.test.tsx`: tres `note` pasan a `status`.
- `CreateOdDrawer` `CapBar`: `--ink-inv-soft` pasa a `--ink-side-soft` sobre `--bg-sidebar`. Era un error de contraste en oscuro que ya existía; lo destapó el cambio (ver tramo-4d.md).

## Decisiones

- **Criterio de aviso:** también son avisos los errores de acción o de formulario entero sin caja, como `<p role="alert">` o un texto rojo «No se pudo…». Los errores bajo un campo siguen como texto.
- **Tonos:** las marcas `[VERIFICAR]` pendientes de EditarNoticiaForm pasan de rojo a `atencion` y siguen en `status`, para no anunciarse en cada tecla. «No hay clientes cargados» (ClaimDrawer) y `StrandedCreditsBanner` van `urgente`.
- **Ejecución:** se repartió en cuatro subagentes con archivos disjuntos. Uno entregó al inicio un informe que no coincidía con el disco, así que su diff se revisó línea por línea. Los demás se compararon con `git diff --stat`.

## Validación

- `pnpm install`: con turno del Subdirector, unos 62 s.
- Vitest focal de las 13 carpetas del grupo más `app/studio/_components/__tests__`: PASÓ, 54 archivos y 638 pruebas, tras el arreglo de `CapBar`. Antes, las 24 pruebas vecinas: PASÓ, 280 pruebas.
- Mutantes del contrato: 4 de 4 muertos (vuelve el contorno, vuelve el `role="alert"` crudo, cambia el import, se quita un Aviso).
- `tsc --noEmit`: PASÓ. ESLint `--max-warnings=0` sobre los 48 `.ts`/`.tsx` tocados: PASÓ. `docs:check` y `sdd:check`: PASARON. `git diff --check`: limpio.
- `/ui-check`: sin hallazgos altos. Hallazgo bajo: varios márgenes heredados (6, 10 y 14 px) no están en la escala de 4 px.
- `pnpm verify` local: NO EJECUTADO; lo cubre el CI de GitHub (regla del DG).
- Vista en pantalla en claro, oscuro y compacto: NO EJECUTADA.

## Impacto documental

Nuevo `tramo-4d.md`. Sin cambios en documentos canónicos (`BRAND.md`, `spec.md`, CLAUDE, registro de componentes). Graphify y Archify no se regeneraron en este worktree; quedan para el cierre del Director.

## Revisión independiente

- APROBÓ la #548 en `c29f344df`, sin cambios requeridos (2026-11-14, transmitido por el Subdirector Rebrand).

## Pendientes de esta tarea

- Para la revisión visual de Sam: CampaignActions ahora muestra su mensaje de resultado en tono éxito; antes era texto neutro.

- Revisar en la imagen de prueba antes de fusionar, sobre todo TemplateEditorDrawer («Mandar prueba»), el estado de cuenta (el título ya no va en mayúsculas), Step3Article y ClientDrawer («Cerrar» dentro del aviso).
- Cuando la #540 entre a main, traer origin/main una sola vez. El DG lo hace al armar el tren.

## FUERA DE ALCANCE DETECTADO

- `RegisterReferralDrawer.tsx` tiene voseo en un texto visible («acreditá…»).
- `DriverDrawer.tsx` (tms, fuera de la allowlist) hereda el `FormError` de TruckDrawer, que ahora pinta con `Aviso`. No se editó.
- `CreateOdDrawer.tsx:411`: la pista de CapBar usa `--ink-inv-mute` sobre `--bg-sidebar` y en oscuro casi no se ve. No es texto, así que `dark-theme-contrast-contract` no la mira. La revisión independiente lo confirmó.
- El regex `CONTORNO` de `avisos-t4d-contract.test.ts` no ve fallbacks (`var(--danger, …)`) ni plantillas de texto. Lo anotó la revisión independiente.
- Las tarjetas de alerta de flota de GpsLiveTab usan tono con borde izquierdo propio. Si se quieren como `Aviso`, hay que decidir el anuncio (`alert` al renderizar).
