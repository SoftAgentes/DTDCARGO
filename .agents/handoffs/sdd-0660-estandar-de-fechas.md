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

### Revisión independiente sobre `8bb0bae32` (cambios pedidos por el DG)

- **B1** `form.reset()` no vaciaba `<DateField>` (el handoff anterior decía lo contrario y estaba mal): `DocsPanel` heredaba «Vence» y `RateDrawer` «Crear y empezar otra» heredaba la vigencia. Ahora escucha `reset` del formulario y vuelve a `defaultValue`. Prueba: `form.reset()` con y sin valor inicial.
- **B2** «−» a medio escribir ponía hoy (`18-11-2025` → 17/11/2026 silencioso). Ahora «-» es separador a medio escribir; + y − solo con campo vacío o fecha válida. Pruebas: `18-11-2025`, `18+`, `31022026+-`.
- **I1** Amonestación: `canNext` exige la validez de la fecha (`onValidityChange`) y la fecha es obligatoria. Prueba: `amonestacion-fecha.test.tsx`.
- **I2** A medio escribir `onChange` no avisa (Gastos ya no navega con el filtro vacío al reescribir el mes).
- **I3** Controlado: si el padre cambia la prop a `""`, el campo se limpia aunque haya texto a medio escribir.

### Segunda revisión sobre `f076196fe`

- **N1** El efecto controlado reescribía con el eco de lo propio: «31022026» encima de una fecha válida avisaba "", el padre guardaba "" y el texto desaparecía sin error (Estado de cuenta perdía la línea). Ahora el eco (`incoming === lastEmitted`, fijado en `apply` antes de avisar) no reescribe. Prueba controlada escribiendo encima sin vaciar; la prueba mata al mutante sin la guarda.
- **N2** Campos fuera de un `<form>`: dentro de un formulario (Club, Estado de cuenta, Amonestación) la validez del campo bloquea el envío. Fuera: Activos fijos («Depreciar mes»), Fiscal («Asentar período», «Anular asiento», CSV y PDF) y Gastos («Exportar») esperan a `onValidityChange`. Pruebas: `activos-fijos-mes`, `fiscal/periodo-a-medio-escribir`, `GastosClient.mes`.

### Tercera revisión sobre `b447e564b`

- **Bloqueante** Retenciones (el noveno consumidor controlado) quedó sin guarda: mi nota decía «Retenciones solo navega» y estaba mal. Con el mes a medio escribir o imposible seguían «Exportar CSV», «Exportar PDF» y los dos «Nuevo comprobante», y el comprobante se habría registrado en el período anterior (el drawer lo manda en un oculto que no muestra). Ahora el campo es obligatorio y esos cuatro botones esperan a `onValidityChange`. Prueba: `fiscal/_components/retenciones-periodo.test.tsx` (10/202, 13/2026 y estado vacío).
- Repaso con un script sobre `git grep "<DateField"`: 9 consumidores controlados; Club y Estado de cuenta envían con `type="submit"` dentro de su `<form>` (la validez del campo bloquea), y los otros 7 llevan `onValidityChange`. Los no controlados viajan todos dentro de un formulario.
- **Menor** El reset escucha el formulario del atributo `form` si lo hay.
- Nota de pruebas: user-event 14 no reemplaza una selección en un campo lleno hasta su `maxLength`; la prueba de N1 entrega el cambio con `fireEvent.change`, como el navegador.

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
| Tras la revisión: `DateField` + `amonestacion-fecha` | PASÓ 37/37 |
| Tras la revisión: Nómina, Reportes, Documentos, Tarifas, Gastos, contrato y máscara | PASÓ 97/97 (11 archivos) |
| Tras la revisión: eslint de lo tocado | PASÓ |
| Tras la revisión: typecheck | NO EJECUTADO localmente (la PC la tenía Embarques); lo cubre el CI de la PR |
| Segunda revisión: 20 archivos (componente, máscara, contrato, Fiscal, Gastos, Activos, Reportes, Nómina, Documentos, Tarifas, fechas Caracas) | PASÓ 164/164 |
| Segunda revisión: eslint de lo tocado | PASÓ |
| Tercera revisión: `app/studio/(app)/fiscal` (5 archivos, incluida la prueba nueva de Retenciones) | PASÓ 17/17 |
| `pnpm verify`, e2e | NO EJECUTADO (el DG no dio turno para verify) |

## PENDIENTES DE ESTA TAREA

- `pnpm verify` y la corrida completa en CI (la de la PR).
- El calendario se ancla al borde izquierdo del campo: en un campo pegado al borde derecho de un drawer podría salirse; revisarlo al migrar los drawers anchos en la tanda 2.
- Tanda 2: el resto de días (lista congelada), incluida Bitácora cuando se fusione la rama de ajustes de pantalla.
- Tanda 3: `<DateTimeField>` para los 4 `datetime-local`, con la prueba de zona de CAL-01.
- Tanda 4: `AuditLogSection`, `inspecciones/builder-fields` y `components/document-import`.
- `readOnly` en `<DateField>` para `AsistenciaDrawer`.

### No bloqueantes de la tercera revisión (pendientes, sin arreglar en esta PR)

- **Carrera de navegación en Gastos:** si llegan dos navegaciones seguidas, la vieja puede cambiar la prop `month` después de que la persona ya escribió otra cosa y reescribir el texto actual.
- **Gastos con un mes imposible** (13/2026): avisa `""` y el filtro pasa a «todos los meses», aunque el campo muestra el error.
- **Limpieza externa repetida con `""`:** si el padre ya tenía `""` y vuelve a poner `""` (por ejemplo, un «Limpiar» pulsado dos veces con algo a medio escribir), la prop no cambia y el texto no se limpia.

### CI sobre `0daf1f5fa`

- «Calidad local sin secretos» falló en Unitarios por 2 pruebas que fijan el registro CMP-01 en 6 componentes (`scripts/__tests__/component-registry.test.ts` y `policy-registry.test.mjs` del plugin). Ahora cuentan 7 con `date-field` y se regeneró el derivado `references/policy-registry.json` con `build-policy-registry.mjs`, como hizo SDD-0628 con `aviso`. Las dos pasan (11/11) y `validate-governance` dice 7 componentes.

## FUERA DE ALCANCE DETECTADO
- `run-forward-tests.mjs` del plugin de gobernanza da «29 !== 27» también sin este cambio: cuenta políticas (29 en `main`) contra una cifra vieja. No corre en el CI.

- `app/studio/CLAUDE.md` conserva voseo previo («debés», «parametrizá», «controlá» en `icons.tsx`). No es de esta tarea.
- `ServiceSubEditors` tenía otras etiquetas sin `htmlFor` (precio, moneda); solo se asoció la de la fecha.

## Impacto documental

Spec nueva, índice de specs, registro CMP y `app/studio/CLAUDE.md`. Nada en `BRAND.md` ni en el Norte.
