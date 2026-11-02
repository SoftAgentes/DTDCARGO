# SDD-0595 · el primer error recibe el foco

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`, misma sesión de las PR #347, #349 y #350.
- **Ruta:** `DTD-worktrees/foco-primer-error`. **Rama:** `codex/foco-primer-error`, sacada de `codex/foco-trampa-drawershell` (#350) en `c1a624c2a`.
- **SDD:** 0595, asignada por el Director como spec propia. Su reserva (`codex/sdd-reserve-0595-foco-primer-error-paneles`, `refs/dtd/reservations/0595`) sigue local y sin publicar; la spec de esta rama reemplaza al stub.
- **Orden:** el Director integra primero la #350, y esta no va antes.
- **Permisos:** PR en borrador. Sin merge, sin deploy, sin producción. Corridas pesadas con turno del Director.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Llevar el foco al primer error en todos los paneles"». El encargo pedía un tramo pequeño: medir cuántos paneles faltan, ordenarlos por riesgo, corregir un tramo y decidir con evidencia si el caso de Enter se resuelve en el hook o panel por panel.

## Resultado

**«Todos los paneles» no se completa en esta PR.** Esta PR cubre el primer tramo, por la regla de no hacer barridos: 17 de los 64 paneles que no marcaban `aria-invalid` (15 de Nómina y 2 de flota). Quedan 47, listados por riesgo en la spec.

**Enter se resuelve en el hook**, y eso sí alcanza a todos los paneles que ya marcan sus campos o tienen un aviso enfocable. La decisión, las tablas de medición y los tramos futuros están en `docs/specs/0595-foco-primer-error-paneles/spec.md`.

## COMPLETADO

- `nomina/_components/form-bits.tsx`: `Field` asocia la etiqueta, marca `aria-invalid` y liga el mensaje; `ErrorBox` es enfocable.
- `tms/_components/TruckDrawer.tsx`: `FieldText` y `FieldSelect` marcan su error y lo ligan al mensaje.
- `useDialogA11y.ts`: el foco va al aviso enfocable o al primer campo con error, también tras enviar con Enter si la persona sigue en ese campo.
- Pruebas nuevas: `form-bits.test.tsx`, `PrestamoDrawer.foco.test.tsx`, `TruckDrawer.campos.test.tsx` y más casos en `useDialogA11y.test.tsx`.
- Spec 0595 e índice.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Medición en Chrome 152 con clics y teclas reales, antes y después | PASÓ: tabla en la spec. Acciones simuladas, sin sesión real ni lector de pantalla |
| Seis archivos de prueba del tramo, con `CityDrawer` y `TransportistasPanel`, `--pool=threads` | PASÓ, 72 de 72, antes de la tanda de mutantes. El código no cambió después |
| Control de la tanda: cuatro archivos, `--maxWorkers=1` | PASÓ, 40 de 40, antes y después |
| Mutantes del hook y de `Field`: E1 a E10 y F1 a F10 | PASÓ, 20 de 20 mueren |
| Mutantes de flota: T1 | PASÓ, muere |
| Mutantes de flota: T2 a T6 | **NO EJECUTADO:** venció el tope propio de 6,5 min dentro del turno. Cubren el campo numérico y de texto, `FieldSelect`, el `id` del mensaje y marcar sin error. Hay pruebas escritas para todos, pero no se comprobó que fallen |
| ESLint de los siete archivos | PASÓ |
| `tsc` acotado a las pruebas y sus importaciones (configuración temporal) | PASÓ, 0 errores |
| `merge-tree` con `origin/main` y con #349 | Ver la descripción de la PR. Combinar y probar no se ejecutó: no hay turno |
| `docs:check`, `sdd:check`, `governance:check`, `components:check` | PASÓ |
| Consumidores directos del hook (`ConfirmDialog`, `PinViewDialog`, etc.) con este cambio | **NO EJECUTADO:** sin turno. Pasaron con el hook de #350, antes de este tramo |
| Suite completa y `pnpm verify` | NO EJECUTADO: sin turno. El CI de la PR es la primera corrida de toda la suite con el cambio |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica el Director desde main |

### Registro de turnos

- Lancé una primera tanda de mutantes sin turno, creyendo que por ser focales no lo pedían. **El Director lo corrigió:** esas corridas también cuentan, y competían con la 0497.
- Cuando leí su mensaje, la tanda seguía viva. La maté a mitad del mutante F2, que había dejado sin `id: controlId` a `form-bits.tsx`. Restauré esa línea y comprobé todos los puntos que tocan los mutantes contra su forma original, antes de seguir. Quedaron 0 procesos.
- La tanda detenida alcanzó a dar resultado en E1 a E10 y F1. Las siguientes corrieron con turno del Director, de 14:26:16Z a 14:34:53Z.

## COMMITS

Sólo los dos últimos son de esta tarea. `e18ea4bf5` y `c1a624c2a` son de la #350.

- Commit de código: `fix(studio): SDD-0595 — el primer error recibe el foco en Nómina y flota`.
- Commit de este handoff y la spec, que no se autorreferencia.

## PR / BRANCH

Rama `codex/foco-primer-error`, en PR en borrador contra `main`. Hasta integrar la #350, su diff incluye los commits de esa PR. El número queda en la propia PR.

## PENDIENTES DE ESTA TAREA

1. Integrar antes la #350.
2. «Calidad local sin secretos» en verde sobre la cabeza de la PR.
3. Turno de `pnpm verify`.
4. Mutantes T2 a T6, si el Director da el turno.
5. Smoke en el Studio con sesión real: en Nómina, provocar un error por campo y comprobar a dónde va el foco, tras un clic y tras Enter.

## FUERA DE ALCANCE DETECTADO

1. **Un error borra lo escrito.** Medido en `PrestamoDrawer`: tras una respuesta con errores por campo se vacían empleado, monto, cuota, cuotas y concepto. Es lo que hace React 19 con `<form action>` en campos sin estado. Por lectura de código, 34 archivos del Studio lo combinan; 12 son de Nómina. Viola FRM-01 (`frm-01.md:26`). **Es más grave que el defecto de foco y queda propuesto como tarea.** Con este tramo, quien se equivoca recibe el foco en el primer error, pero en un formulario ya vacío.
2. Los 47 paneles restantes, en la spec por niveles de riesgo.
3. `Field` no marca el grupo de radios de `GenerarFiniquitoDrawer`.
4. Los campos de Nómina usan `<input type="number">` y no `NumericInput`. No se midió contra NUM-01.

## HANDOFF AL DIRECTOR

- Revisar sólo los dos últimos commits. La decisión a mirar es la del caso de Enter en el hook compartido.
- El hallazgo 1 de fuera de alcance merece prioridad propia, con su spec.

### Impacto documental

Spec 0595 nueva e índice regenerado. `docs/specs/README.md` puede chocar con otras PR que agreguen specs: se resuelve con el driver local y regenerando el índice. No cambian políticas.
