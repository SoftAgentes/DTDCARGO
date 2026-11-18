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

## VALIDACIÓN (turno de PC del DG, 2026-11-18)

| Comprobación | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | PASÓ (sin cambios en el lockfile) |
| vitest nuevas: `date-mask`, `DateField`, `fechas-contract` | PASÓ, 45/45 (`--pool=threads --maxWorkers=1`; con el pool por defecto los workers no arrancaron por carga) |
| vitest de los módulos migrados (32 archivos) | 316/320 en una corrida con 2 workers. De los 4 rojos, 1 real (`reportes-tab`: la etiqueta envolvía el campo) → corregido, 13/13. Los otros 3 (`conservar-lo-escrito` ×2, `CityDrawer`) y 2 archivos que no arrancaron (`ReglasDrawer`, `thread-solo-lectura`) pasaron aislados: 69/69 |
| typecheck (`tsc --noEmit`) | PASÓ |
| eslint de los archivos tocados | PASÓ (0 errores, 0 advertencias) |
| `components:index` / `components:check` | PASÓ |
| `governance:check`, `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `/ui-check` (página de prueba con `tokens.css` y `studio.css` reales, claro, oscuro y 375 px) | PASÓ con un ajuste aplicado (título «Noviembre De 2026» → «Noviembre de 2026») |
| Contraste medido | texto 16,5 / 13,1; formato gris 5,3 / 6,9; día elegido 10,6 / 6,6; error 6,3 / 8,3 (claro / oscuro) |
| `pnpm verify`, e2e | NO EJECUTADO (el DG no dio turno para verify) |

## PENDIENTES DE ESTA TAREA

- `pnpm verify` y la corrida completa en CI (la de la PR).
- El calendario se ancla al borde izquierdo del campo: en un campo pegado al borde derecho de un drawer podría salirse; revisarlo al migrar los drawers anchos en la tanda 2.
- Tanda 2: el resto de días (lista congelada), incluida Bitácora cuando se fusione la rama de ajustes de pantalla.
- Tanda 3: `<DateTimeField>` para los 4 `datetime-local`, con la prueba de zona de CAL-01.
- Tanda 4: `AuditLogSection`, `inspecciones/builder-fields` y `components/document-import`.
- `readOnly` en `<DateField>` para `AsistenciaDrawer`.

## FUERA DE ALCANCE DETECTADO

- `app/studio/CLAUDE.md` conserva voseo previo («debés», «parametrizá», «controlá» en `icons.tsx`). No es de esta tarea.
- `ServiceSubEditors` tenía otras etiquetas sin `htmlFor` (precio, moneda); solo se asoció la de la fecha.

## Impacto documental

Spec nueva, índice de specs, registro CMP y `app/studio/CLAUDE.md`. Nada en `BRAND.md` ni en el Norte.
