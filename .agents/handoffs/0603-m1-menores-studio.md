# Handoff · SDD-0603 · Pendientes menores del Studio

- **Owner:** Claude (Worker), sesión abierta por el Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Worktree:** `.claude/worktrees/0603-m1-menores-studio-31c0c1`. **Rama:** `claude/0603-m1-menores-studio-31c0c1`, desde `claude/rebrand-base-main` = `origin/main` `651bdbd73`.
- **SDD:** 0603 (BD-037) y enmienda de SDD-0628. Detalle por punto, decisiones, medidas y gate VIS-01 en `docs/specs/0603-claridad-controles/menores-studio.md`. `spec.md` de 0603 no se edita.
- **Encargo:** resolver los 10 pendientes que dejaron las revisiones de los tramos 4 y 5, dentro de la allowlist `rebrand-0603-allowlist-m1-studio-651bdbd73.txt` (17 archivos), con pruebas vecinas, contratos con mutantes y `/ui-check`. Autorizados el push de la rama y la PR lista para revisión contra main. Sin Auto-fix, sin traer main, sin fusionar, sin imagen de prueba ni producción.
- **Ampliación autorizada (Subdirector, 2026-11-14):** `app/studio/(app)/__tests__/avisos-finanzas-contract.test.ts`, solo para que `form-bits` pase a 1 aviso, salga de `EXCEPCIONES` y los totales vayan de 43/62 a 44/63.

## Hecho

1. `Aviso` acepta `tabIndex` y `ref`. Ficha `aviso.json` (API, caso de prueba y `form-bits` como consumidor) y registro generado, actualizados. Nota de enmienda en SDD-0628.
2. `ErrorBox` de Nómina es `<Aviso tono="error" compacto tabIndex={-1}>`.
3. Botones dentro de avisos: «Cargar gasto» (Gastos) y «Ver embarque» (cotizador) pasan a secundario. «Emitir igual (sin aceptación)» de `InvoiceDetailClient` no cambia; el archivo queda sin diff.
4. `AlertBanner` de Gastos: la franja lleva la frase fija y la lista sale a un `<ul>` fuera de la región viva. `AlertBanner` se exporta para su prueba.
5. «Atención requerida» del Dashboard: franja plana a mano, sin región viva, con «Abrir» secundario.
6. Pista de `CapBar`: `--ink-side-soft`.
7. `avisos-t4d-contract`: regex `CONTORNO` ampliado, cuenta exacta, 10 excepciones con motivo y mutantes nuevos.
8. `RecordatoriosDrawer` con `compacto`; `AsistenteBorrado` con una sola región `status`; sangría de `ActiveShipmentList`.
9. `ExchangeRatesSection`: BCV y error en `Aviso`; «fuera de rango» como mensaje del campo.
10. «acreditá» → «acredita».

## Decisiones para la revisión

- «Emitir igual» se queda en `warning`: es la confirmación en línea de la acción pedida y no es vino.
- El Dashboard no usa `<Aviso>`: sería región viva, y con error, `alert` al abrir el tablero. «Abrir» es texto visible nuevo, el mismo del tramo 5.
- «Fuera de rango» no es `Aviso`: aparece al escribir. Queda ligado al campo con `aria-describedby`.
- En `AsistenteBorrado`, `Nota` es siempre `urgente`: la advertencia (de un paso o de una lectura fallida) pasa de `status` a `alert`.
- En Gastos, «Cargar gasto» y «Marcar cargado» quedan los dos en `ghost -xs`.

## Validación

| Comprobación | Estado |
|---|---|
| `git diff --check` | PASÓ |
| `node scripts/build-component-registry.mjs` y `validate-component-registry.mjs` | PASÓ (6 componentes, agregado reproducible) |
| Diff dentro de la allowlist, más la ampliación, pruebas vecinas y documentos | PASÓ (`git status` contra la lista) |
| `pnpm install`, vitest focal, `tsc --noEmit`, eslint del diff | NO EJECUTADO: en espera del turno de la PC |
| Mutantes sobre archivos reales | NO EJECUTADO: van después del vitest, sobre código con commit |
| `/ui-check` | NO EJECUTADO |
| `pnpm verify` | NO EJECUTADO: el portón es el CI de GitHub |
| Vista en pantalla (claro, oscuro, compacto) | NO DISPONIBLE: va en la imagen de prueba |

## Impacto documental

Nuevo `menores-studio.md`. Enmienda en `docs/specs/0628-aviso-studio/spec.md` (API de `Aviso`, `updated`). `aviso.json` y `component-registry.json`. `app/studio/CLAUDE.md` describe `Aviso` sin las dos props nuevas y no está en la allowlist: queda como pendiente de actualización. Graphify y Archify no se regeneraron; quedan para el cierre del Director.

## Pendientes de esta tarea

- Turno de la PC, pruebas, mutantes, `/ui-check`, push y PR.
- Verlo en la imagen de prueba antes de fusionar: un error de formulario en Nómina, el banner de Gastos, un cotizador convertido, el Dashboard, la creación de OD, el asistente de borrado y Tasas de cambio.

## FUERA DE ALCANCE DETECTADO

- `app/studio/CLAUDE.md`: sumar `tabIndex` y `ref` a la descripción de `Aviso`.
- `EmpleadoDrawer.tsx:123` usa `ErrorBox` para una advertencia (`accessWarning`); ahora se ve como aviso de error.
- `GpsLiveTab`: tarjetas de alerta con borde izquierdo de estado; les sirve la solución del Dashboard.
- `CapBar`: el relleno contra la pista queda por debajo de 3:1 en los dos temas; pide un token nuevo.
- `RegisterReferralDrawer`: «crédito advisory» es un anglicismo en texto visible.
- `dark-theme-contrast-contract` salta los fondos pintados con un token de tinta; por eso no vio la pista de `CapBar`.
