# Handoff · SDD-0603, tramo 5c: filas y avisos de Tracking, Almacén CN, Documentos y Cobranzas

- **Owner:** Claude (Worker), sesión abierta por el Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Worktree:** `.claude/worktrees/0603-t5c-pantallas-210ac5`. **Rama:** `claude/0603-t5c-pantallas-210ac5`, desde `claude/rebrand-base-main` = `origin/main` `da8d123ee`.
- **SDD:** 0603 (BD-037), con `Aviso` de SDD-0628. Detalle por archivo, excepciones, aceptación y gate VIS-01 en `docs/specs/0603-claridad-controles/tramo-5c.md`. `spec.md` no se edita.
- **Encargo:** aplicar BD-037 a los 14 archivos de la allowlist (`rebrand-0603-allowlist-t5c-da8d123ee.txt`), con pruebas focales, contrato con mutantes, `/ui-check`, y PR lista para revisión. Sin Auto-fix, sin traer main, sin fusionar, sin imagen de prueba ni producción.

## Hecho

- Filas: «Abrir <código>» real en la cola de Cobranzas y en las tarjetas de Tracking; la fila sale del Tab. La tarjeta seleccionada de Tracking va en tinta (`studio-btn-dark` + `aria-current`), no en vino.
- Avisos: 20 `<Aviso>` en 12 archivos, en lugar de las cajas hechas a mano. Se quitó la región viva de lo que cambia al escribir («Quedaría así» de tarifa) y la caja de la sugerencia de tarifa.
- Controles: «Recepción huérfana» pasa a secundario, quitar ítem a `studio-icono-btn` (antes 26 px) y el vínculo de Documentos a `studio-link-quiet`.
- Pruebas nuevas: `CobranzasClient.abrir.test.tsx`, `ActiveShipmentList.abrir.test.tsx` y `claridad-t5c-contract.test.ts`, este último con cuenta exacta por archivo, sin comentarios, y 7 mutantes.

## Decisiones

- Cobranzas: la fila deja de ser `role="button"` (queda `tabIndex={-1}` y clic con el ratón), para no duplicar en el lector un botón con toda la fila. Embarques mantiene su `<button tabIndex={-1}>`; Tracking lo copia porque su prueba de adjuntos ubica la tarjeta por `closest("button")`.
- Selección de Tracking en tinta: aplica la excepción aprobada de la spec (selección con relleno de tinta) sobre el botón, sin invertir la tarjeta entera, para no tocar los colores de `StatusBadge` y adjuntos.
- Documentos: el árbol de carpetas y los chips de vista no se tocan, porque la spec los marca «sin decidir».

## Validación

Turno de la PC dado por el Subdirector Rebrand el 2026-11-14 («te toca el turno ahora»). `pnpm install --frozen-lockfile`: 42,8 s.

- Vitest focal (`cobranzas`, `tracking`, `cn/_components`, `dashboard`, `embarques`, `documentos`, más los contratos `claridad-t5c`, `avisos`, `dark-theme-contrast`, `claridad-controles` y `external-effect-boundaries`, `pantallas-muestran-la-denegacion` y `fechas-caracas-formularios`): PASÓ, 39 archivos y 383 pruebas.
- `tsc --noEmit`: PASÓ después de corregir un comentario JSX dentro de un ternario en `DocumentosHubClient.tsx`. Ninguna prueba renderiza ese archivo, así que Vitest no lo vio; lo vio tsc.
- ESLint de lo tocado: PASÓ.
- Mutantes dentro del contrato: 7 de 7 muertos. Entre ellos, `<Aviso>`→`<p>`, y que un `<Aviso` o un `role="alert"` citados en un comentario no cuentan.
- Mutantes sobre los archivos reales: 3 de 3 muertos (`<Aviso>`→`<p>` en `RecordatoriosDrawer`; `tabIndex={-1}`→`{0}` en `CobranzasClient` y en `ActiveShipmentList`).
- `/ui-check`: sin hallazgos de prioridad alta. Media: la tarjeta de Tracking crece unos 44 px. Bajas: la flecha de `studio-tracking-row` junto a «Abrir»; la acción de `Aviso` en `-sm`.
- `pnpm verify` local: NO EJECUTADO. Lo cubre el CI de GitHub (regla del DG, 2026-11-13).
- Vista en pantalla con datos, en claro y en oscuro: NO EJECUTADA.
- Incidente controlado: un `git checkout --` para revertir un mutante deshizo `ActiveShipmentList.tsx` antes del primer commit. Se restauró desde la copia tomada justo antes y el diff quedó idéntico (+37/−10), con las pruebas en verde. Desde entonces los mutantes se corren solo sobre código con commit.

## Impacto documental

Nuevo `tramo-5c.md`. Sin cambios en documentos canónicos. Graphify y Archify no se regeneraron en el worktree; quedan para el cierre del Director.

## Pendientes de esta tarea

- Verlo en la imagen de prueba antes de fusionar: Cobranzas, Tracking (lista, cambio de destino, plan), Almacén CN (nueva recepción, tarifa), Documentos, editor del Dashboard y asistente de borrado, en claro, oscuro y compacto.

## FUERA DE ALCANCE DETECTADO

- Pendientes por choque con PRs abiertas #318 y #515: `cn/AlmacenCnClient.tsx`, `cn/ReceiptRowActions.tsx`, `tracking/[id]/page.tsx`, `tracking/[id]/FooterActions.tsx`, `tracking/[id]/ShipmentDataPanel.tsx`, `cobranzas/recibo/[code]/page.tsx`.
- «Atención requerida» del Dashboard está en `DashboardWidgets.tsx`, que no estaba en la allowlist.
- La flecha «›» de `studio-tracking-row` en Cobranzas convive con «Abrir»: es CSS.
- Selección en vino en el árbol y los chips de Documentos: falta decidir el patrón (spec, «parecen pestañas»).
