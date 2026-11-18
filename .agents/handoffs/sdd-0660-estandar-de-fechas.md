# Handoff — SDD-0660 estándar de fechas del Studio (2026-11-18)

- **Owner:** Claude Worker, sesión lanzada por el Director General (claim `local-0660-fechas`).
- **Ruta:** `.claude/worktrees/nostalgic-gagarin-f2c120` · **Rama:** `sdd-0660-estandar-de-fechas` · **Base:** `main` en `9b64478b1`.
- **Encargo:** Sam, reunión con la oficina del 2026-11-18: un solo estándar para los campos de fecha del ERP, sin las rayas del campo de mes del navegador.
- **Spec:** [`docs/specs/0660-estandar-de-fechas/spec.md`](../../docs/specs/0660-estandar-de-fechas/spec.md).
- **Permisos:** PR sin fusionar. Sin migraciones, producción ni staging. `pnpm install`, `pnpm verify`, Docker y e2e solo con turno del DG.

## Hecho en esta PR (tanda 1)

- `<DateField>` (`app/studio/_components/ui/DateField.tsx`) + lógica pura `lib/studio/util/date-mask.ts` + estilos `.studio-date-field__*` en `studio.css`.
- Contrato `app/studio/_components/__tests__/fechas-contract.test.ts` con 40 archivos pendientes congelados.
- Registro CMP `docs/governance/components/date-field.json` (`proposed`) y sección «Fechas» en `app/studio/CLAUDE.md` (antes decía usar el nativo).
- `nomina/_components/form-bits.tsx`: `Field` asocia la etiqueta también con `<DateField>`.

### Migrados en la tanda 1

Conversaciones `GenerateDigestsPanel` (mes) · Club `FeaturedSupplierDrawer` (mes) · Contabilidad `ActivosFijosTab` (mes), `StatementDrawer` (mes y fecha de línea), `ReportesTab` (desde/hasta) · Fiscal `FiscalClient` (mes), `WithholdingsView` (mes), `WithholdingDrawer` · Gastos `GastosClient` (mes) · Nómina `AmonestacionDrawer`, `CuotaPrestamoDrawer`, `EmpleadoDrawer` (2), `FeriadoDrawer`, `GenerarCorteDrawer` (2), `GenerarFiniquitoDrawer`, `PagoPrestadorDrawer`, `PrestamoDrawer`, `ReglasDrawer`, `RevisarSolicitudDrawer` · Calculadora `TariffDrawer` (2) · Tarifas `RateDrawer` (2) · Inspecciones `InspeccionDrawer` · Documentos `DocsPanel` · Servicios `ServiceSubEditors` (además, su etiqueta «Vigente desde» quedó asociada al campo).

Con esto **ya no queda ningún `type="month"` en el Studio**.

### Pruebas tocadas (sin debilitar)

- `contabilidad/__tests__/reportes-tab.test.tsx`: el campo visible muestra `10/03/2025`; se agregó la comprobación de que el oculto sigue en `2025-03-10`.
- `nomina/_components/__tests__/conservar-lo-escrito.test.tsx`: ahora también llena y compara los campos de `<DateField>` (antes los nativos de fecha estaban cubiertos; sin este cambio quedaban fuera) y comprueba que `granted_on` llega en ISO.
- `nomina/_components/__tests__/ReglasDrawer.test.tsx` no se tocó: consulta `[name="vigente_desde"]`, que ahora es el oculto, y por eso el oculto lleva `min`/`max` informativos.

### Cambio de comportamiento a revisar

- Tras un envío con `<form action>` sin `key`, el campo nativo se vaciaba con el reinicio de React 19; `<DateField>` conserva la fecha (es estado de React). Los formularios migrados que se vacían tras éxito usan `key` (Servicios) o cierran el drawer, así que no se nota; anotarlo si aparece en la tanda 2.

## VALIDACIÓN

Ver el cierre en la PR. Hasta el turno de PC del DG: `docs:check` y `sdd:check` PASÓ; vitest, typecheck, lint, `components:check`, `/ui-check` y `pnpm verify` NO EJECUTADO (el worktree no tenía `node_modules`).

## PENDIENTES DE ESTA TAREA

- Correr con turno: `pnpm install --frozen-lockfile`, vitest de los archivos tocados, typecheck, lint, `pnpm components:index` (regenera `generated/component-registry.json`), `/ui-check` y `pnpm verify`.
- Tanda 2: el resto de días (lista congelada), incluida Bitácora cuando se fusione la rama de ajustes de pantalla.
- Tanda 3: `<DateTimeField>` para los 4 `datetime-local`, con la prueba de zona de CAL-01.
- Tanda 4: `AuditLogSection`, `inspecciones/builder-fields` y `components/document-import`.
- `readOnly` en `<DateField>` para `AsistenciaDrawer`.

## FUERA DE ALCANCE DETECTADO

- `app/studio/CLAUDE.md` conserva voseo previo («debés», «parametrizá», «controlá» en `icons.tsx`). No es de esta tarea.
- `ServiceSubEditors` tenía otras etiquetas sin `htmlFor` (precio, moneda); solo se asoció la de la fecha.

## Impacto documental

Spec nueva, índice de specs, registro CMP y `app/studio/CLAUDE.md`. Nada en `BRAND.md` ni en el Norte.
