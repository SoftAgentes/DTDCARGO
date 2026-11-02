# SDD-0592 · el foco no se sale del modal

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`, misma sesión de las PR #347 y #349.
- **Ruta:** `DTD-worktrees/foco-trampa-drawershell`. **Rama:** `codex/foco-trampa-drawershell`. **Base:** `1c2286f1f`.
- **SDD:** 0592, asignada por el Director. Su reserva (`codex/sdd-reserve-0592-foco-modal-errores-por-campo`, `refs/dtd/reservations/0592`) sigue local y sin publicar; la spec de esta rama reemplaza al stub.
- **Permisos:** PR en borrador. Sin merge, sin deploy, sin producción. Sin turno pesado: el Director lo tiene asignado a otras sesiones.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que el foco no se salga del modal con errores por campo"». Encargo: medir cuántos paneles se ven afectados y qué pasa con Tab durante un envío lento, decidir dónde reparar y corregirlo sin que el orden de los efectos le quite el foco al aviso de error.

## Resultado

El defecto va más allá de la calculadora y se repara en `useDialogA11y`. Causa, decisión, tablas de medición y límites están en `docs/specs/0592-foco-modal-errores-por-campo/spec.md`.

| Situación medida en Chrome 152 | Antes | Con el arreglo |
|---|---|---|
| `TruckDrawer`, sólo errores por campo | foco en `body`; Tab a un botón detrás del modal | foco en su botón; Tab dentro |
| `TruckDrawer`, envío lento | Tab a un botón detrás del modal, y ahí se queda | Tab al primer control; Mayús+Tab al último |
| `TariffDrawer`, sólo errores por campo | foco en `body`; Tab detrás | primer campo con error; Tab dentro |
| `CityDrawer`, sólo errores por campo | foco en `body`; Tab detrás; 0 campos marcados | primer campo con error; 3 marcados |
| `ConfirmDialog`, error del servidor | foco en `body`; Tab detrás | «Cancelar»; Tab cicla dentro |

**Efecto en todo el Studio:** el hook tiene unos 25 usos directos y 110 archivos usan `DrawerShell`. Sólo actúa con el foco perdido (`body`, ningún elemento activo o un control deshabilitado), así que quien tiene el foco en un control válido, también en un portal, no nota nada. Medí cuatro paneles; **los demás heredan el arreglo sin medición individual**.

## COMPLETADO

- `useDialogA11y.ts`: guarda de Tab con el foco perdido y vuelta del foco al terminar `pending`.
- `CityDrawer.tsx`: `aria-invalid` en sus cuatro campos.
- `useDialogA11y.test.tsx` (nuevo, 15 casos), más casos en `CityDrawer.test.tsx` y `TransportistasPanel.test.tsx`.
- Spec 0592 e índice.

La medición también cambió el código dos veces:

- `ConfirmDialog` devolvía el foco al panel y no a «Cancelar», porque el hook aún no escuchaba cuando se aplicó el foco inicial.
- Un mutante sobreviviente mostró que la comprobación de `isConnected` sobraba, y la quité.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Las tres pruebas tocadas, `--pool=threads` | PASÓ, 47 de 47 |
| Mutantes sobre el código final | PASÓ, 19 de 19 mueren: 15 del hook y 4 de `CityDrawer`, con control verde antes y después |
| Consumidores directos: `ConfirmDialog`, `PinViewDialog`, `ClientDrawer.confirm-delete`, `InvoiceDrawer` (2), `GenerateBLModal` | PASÓ, 48 de 48 en 6 archivos. **Muestra, no la suite** |
| Combinación con #347 y #349 (`merge-tree` sobre commits; panel, ciudad y hook) | PASÓ: sin conflictos, 51 de 51 |
| ESLint de los cinco archivos | PASÓ |
| `tsc` acotado a las pruebas y sus importaciones (configuración temporal) | PASÓ, 0 errores |
| `governance:check`, `components:check`, `docs:check`, `sdd:check` | PASÓ |
| Suite completa y `pnpm verify` en local | NO EJECUTADO: sin turno del Director. **El hook es compartido: el CI de la PR es la primera corrida de toda la suite con este cambio** |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica el Director desde main |

jsdom no suelta el foco al deshabilitar un botón e ignora `blur()` en un control deshabilitado. Las pruebas lo simulan habilitándolo un instante; el comportamiento real está medido en el navegador.

## COMMITS

- `e18ea4bf5` — `fix(studio): SDD-0592 — el foco no se sale del modal con errores por campo`.
- El commit que contiene este handoff y la spec no se autorreferencia.

## PR / BRANCH

Rama `codex/foco-trampa-drawershell`, en PR en borrador contra `main`. El número queda en la propia PR, para no reescribir este archivo después del push.

## PENDIENTES DE ESTA TAREA

1. «Calidad local sin secretos» en verde sobre la cabeza de la PR.
2. Decidir el turno de `pnpm verify`.
3. Smoke en el Studio con sesión real, en un panel de cada tipo: `DrawerShell`, uno con hook directo y `ConfirmDialog`. Provocar un error por campo, pulsar Tab y comprobar que el foco no sale.

## FUERA DE ALCANCE DETECTADO

1. **ERR-01 sigue abierto en dos casos:**
   - Con Enter desde un campo de texto, el foco se queda en ese campo aunque el error esté en otro (medido en `TariffDrawer`). Sigue dentro del panel. Pide el patrón de `PaymentReportForm.tsx:76-82` panel por panel.
   - Los paneles que no marcan `aria-invalid` devuelven el foco al botón, no al campo (medido en `TruckDrawer`). De los 110 archivos con `DrawerShell`, 9 lo llevan en el propio archivo; no conté los que lo heredan de campos compartidos. Los `FieldText` y `FieldSelect` de `TruckDrawer` no lo marcan.
2. `ConfirmDialog` no enfoca su propio aviso de error: devuelve el foco a «Cancelar». El aviso se anuncia al aparecer, según el rol; no lo probé con un lector de pantalla.
3. Durante el envío el foco sigue en `body` hasta que la persona pulsa Tab. No se sale, pero un lector de pantalla podría quedarse sin contexto mientras dura. Es inferencia.

## HANDOFF AL DIRECTOR

- Revisar sobre todo que el cambio en el hook compartido esté bien acotado. Las pruebas de «no le quita el foco a nadie» fijan ese límite.
- Combina con #347 y #349 sin conflictos, en cualquier orden. Con #349 integrada, un segundo error general idéntico vuelve al aviso; sin ella, vuelve al botón, siempre dentro del panel.
- El turno de `pnpm verify` es decisión tuya. No lo corrí.

### Impacto documental

Spec 0592 nueva e índice regenerado. `docs/specs/README.md` puede chocar con otras PR que agreguen specs: se resuelve con el driver local y regenerando el índice. No cambian políticas.
