---
sdd: "0595"
title: "El primer error recibe el foco: primer tramo en Nómina y flota"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-02
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0592", "0537", "0103"]
confidencialidad: interno
---

# SDD-0595 · El primer error recibe el foco

## Pedido

Sam, 2026-11-02, literal: «Haz esta tarea aquí: "Llevar el foco al primer error en todos los paneles"».

La gobernanza pide adoptar por tramos con SDD propio y sin barrido masivo (`AGENT-BRIEF.md:38`). Esta spec cubre el primer tramo y deja los demás listados, sin tocarlos.

**Depende de SDD-0592 (PR #350):** usa el hook que esa PR deja, y no se integra antes que ella.

## Estado medido

**Inventario, por lectura de código.** 133 paneles usan `DrawerShell` o `useDialogA11y`, y 73 muestran errores por campo.

| Estado de esos 73 | Paneles |
|---|---|
| Ya marcaban `aria-invalid` | 9 |
| Cubiertos por este tramo | 17 |
| Quedan para tramos futuros | 47 |

**Por qué Nómina primero.** `Field` de `nomina/_components/form-bits.tsx` es un solo punto de cambio con 92 usos en 15 paneles de pagos, préstamos, finiquitos y datos de empleados. De esos usos, 91 envuelven un `input`, `select` o `textarea` nativo, y uno envuelve un grupo de radios.

**Defecto adicional en `Field`.** Su `<label>` no estaba asociado al control. En el árbol de accesibilidad, los campos se llamaban como su texto de ejemplo o su valor («300.00», «2026-11-02»), o no tenían nombre (Notas). Llevarle el foco a un campo sin nombre no le dice nada a quien usa lector de pantalla, así que asociarlo es parte de este tramo. FRM-01 lo pide: «placeholder es ejemplo, no etiqueta» (`frm-01.md:12`).

## Decisión

1. **`Field` asocia y marca.** Con un control nativo como hijo:
   - La etiqueta apunta al control.
   - Con error, el control lleva `aria-invalid` y `aria-describedby` hacia el mensaje.
   - Respeta el `id` y la descripción que el control ya tuviera.
   - Un grupo conserva su marcado.
2. **`ErrorBox` es enfocable** (`tabIndex={-1}`), sin entrar en el orden de Tab.
3. **`FieldText` y `FieldSelect` de flota marcan su error** y lo ligan al mensaje. Ya tenían la etiqueta asociada.
4. **`useDialogA11y` lleva el foco al primer error.** Primero a un aviso enfocable (`[role="alert"][tabindex="-1"]`), después al primer `[aria-invalid="true"]`. El «resumen o campo» de ERR-01 queda en ese orden.

### El caso de Enter: se resuelve en el hook

Con Enter desde un campo de texto, el campo no se deshabilita y el foco no se pierde, así que SDD-0592 no actuaba. Se usa un evento `submit` del panel para recordar dónde estaba el foco al enviar. Al terminar `pending`, el foco va al primer error **sólo si la persona sigue en ese mismo control**.

| Riesgo | Cómo se evita | Evidencia |
|---|---|---|
| Quitarle el foco a quien pasó a otro campo durante el envío | Se compara con el foco del momento del envío | Medido: Enter en Concepto, clic en Notas durante el envío, y el foco se queda en Notas |
| Mover el foco en un `pending` que no viene de enviar (autoguardado) | Sin evento `submit` no actúa | Prueba del hook |
| Que un envío anterior cuente para el siguiente | El recuerdo se borra al terminar cada `pending` | Prueba y mutante E2 |

**Descartado: el patrón panel por panel** de `PaymentReportForm.tsx:76-82`. Pide una referencia y un efecto en cada uno de los 73 paneles, para el mismo resultado. Sigue siendo válido donde ya existe, porque ahí el hook encuentra el foco ya movido y no actúa.

### Lo que no cambia

- Ningún texto, apariencia ni acción.
- La API del hook.
- Los demás paneles sólo cambian si ya marcan `aria-invalid` o tienen un aviso enfocable: ahí también se beneficia el caso de Enter.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| ERR-01 | **no conformidad → corregida en este tramo** | «El primer error bloqueante recibe foco mediante resumen o campo» (`err-01.md:28`). Sigue abierta en los 47 paneles de «Tramos futuros». |
| FRM-01 | **no conformidad → corregida en este tramo** | Primer error con foco (`frm-01.md:25`); la etiqueta no es el texto de ejemplo (`frm-01.md:12`). |
| A11Y-01 | **no conformidad → corregida en este tramo** | Punto 9, los errores «reciben foco/resumen cuando bloquean» (`a11y-01.md:24`). |
| CMP-01 | cumplimiento | Ningún componente nuevo ni `deprecated`; no cambia la API del hook. |
| BTN-01, AVS-01 | no aplica | Los botones no cambian; no hay avisos nuevos. |
| Resto | no aplica | Sin mutaciones, permisos, datos nuevos, migraciones ni cambios visuales. |

## Allowlist

- `app/studio/_components/ui/drawer/useDialogA11y.ts`
- `app/studio/_components/ui/drawer/useDialogA11y.test.tsx`
- `app/studio/(app)/nomina/_components/form-bits.tsx`
- `app/studio/(app)/nomina/_components/__tests__/form-bits.test.tsx` (nuevo)
- `app/studio/(app)/nomina/_components/__tests__/PrestamoDrawer.foco.test.tsx` (nuevo)
- `app/studio/(app)/tms/_components/TruckDrawer.tsx` (sólo `FieldText`, `FieldSelect` y `FieldError`)
- `app/studio/(app)/tms/_components/__tests__/TruckDrawer.campos.test.tsx` (nuevo)
- `docs/specs/0595-foco-primer-error-paneles/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/sdd-0595-foco-primer-error-paneles.md`

## Aceptación

1. Los campos de `Field` en Nómina tienen por nombre su etiqueta.
2. Con errores por campo, tras pulsar el botón, el foco va al primer campo con error; el campo está marcado y ligado a su mensaje.
3. Con Enter desde otro campo pasa lo mismo, si la persona sigue en ese campo.
4. Quien pasó a otro control durante el envío conserva el foco.
5. Con un error general, el foco va al aviso, también si el texto se repite.
6. Los campos de flota marcan su error y el foco llega al primero.

## Verificación (2026-11-02, en el worktree; sin producción)

Chrome 152 (panel de Claude Desktop) con ratón y teclado reales, los componentes reales y acciones simuladas, sin base. «Antes» es el código de la PR #350, sin este tramo.

| Situación | Antes | Después |
|---|---|---|
| `PrestamoDrawer`: nombre de los campos | texto de ejemplo, valor o ninguno | su etiqueta, en los 7 campos |
| `PrestamoDrawer`, sólo errores por campo, clic | foco en el botón; 0 campos marcados | foco en «Monto del préstamo», con su mensaje ligado; 2 marcados |
| `PrestamoDrawer`, Enter desde Concepto | no medible: el borrado de abajo dejó vacío un campo obligatorio y el navegador bloqueó el envío | foco en «Monto del préstamo» |
| `TariffDrawer`, Enter desde Días de salida | se queda en ese campo | foco en el primer campo con error |
| `PrestamoDrawer`, Enter y clic en Notas durante el envío | no medido | se queda en Notas |
| `PrestamoDrawer`, error general | no medido | foco en el aviso; Tab a «Cancelar» |
| `PrestamoDrawer`, el mismo error general otra vez | no medido | foco en el aviso |
| `TruckDrawer`, sólo errores por campo | foco en el botón; 0 marcados (medido en SDD-0592) | foco en «Patente», con su mensaje ligado; 2 marcados |

Pruebas y mutantes: en el handoff.

## Límites

- **Lector de pantalla:** no se probó con uno. La asociación de etiqueta y mensaje se comprobó en el DOM y en el árbol de accesibilidad.
- **Studio real:** sin sesión ni server actions reales; las acciones son simuladas.
- **Otros navegadores:** sólo Chrome.
- **Paneles de Nómina medidos:** `PrestamoDrawer`. Los otros 14 usan el mismo `Field`, sin medición individual.
- **Causa de terminación de `GenerarFiniquitoDrawer`:** es un grupo de radios y `Field` no lo marca. Con un error sólo ahí, el foco vuelve al botón, por el comportamiento de SDD-0592.

## Tramos futuros

No se tocan aquí. El nivel es una lectura del módulo, no una revisión de cada panel. Cada tramo lleva su SDD.

**Alto, dinero, fiscal y permisos (15):** `admin/BankAccountDrawer`, `cn/RateSnapshotDrawer`, `contabilidad/AccountDrawer`, `contabilidad/AssetDrawer`, `contabilidad/EntryDrawer`, `contabilidad/StatementDrawer`, `costing/CostEditorDrawer`, `costing/TemplateDrawer`, `cotizador/QuoteDrawer`, `proveedores/OrderSignalDrawer`, `proveedores/SupplierClaimDrawer`, `seniat/CreateFilingDrawer`, `tarifas/RateDrawer`, `usuarios/InviteUserDrawer`, `usuarios/UserDetailDrawer`.

**Medio, estados y datos de clientes (10):** `clientes/ClientDrawer`, `fidelizacion/ReferralSettingsDrawer`, `fidelizacion/RegisterReferralDrawer`, `inspecciones/InspeccionDrawer`, `mailing/RuleEditorDrawer`, `mailing/TemplateEditorDrawer`, `reclamos/ClaimDrawer`, `servicios/ServicioDrawer`, `tms/RouteDrawer`, `tracking/[id]/ChangeDestinationModal`.

**Bajo, el resto (22):** `academia/CohortDrawer`, `academia/CourseDrawer`, `academia/EnrollmentDrawer`, `academia/LessonDrawer`, `academia/ModuleDrawer`, `admin/CalendarEventDrawer`, `admin/OfficeDrawer`, `admin/WebhookDrawer`, `admin/agentes/InstallSkillDrawer`, `admin/rutas/RouteDrawer`, `bitacora/TaskDrawer`, `bugs/BugDrawer`, `club/ClubEventDrawer`, `club/EventRegistrationDrawer`, `club/FeaturedSupplierDrawer`, `club/GroupBuyDrawer`, `club/ParticipantDrawer`, `cn/NewReceiptDrawer`, `despacho/CancelOdDrawer`, `bug-reporter/BugReportModal`, `documents/DocsPanel`, `wiring/ProfileModal`.

Estos paneles ya no dejan salir el foco del modal, gracias a SDD-0592. Lo que les falta es que el foco llegue al campo con error.

## Hallazgo aparte: un error borra lo escrito

**No se corrige aquí.** Es otro defecto, y más grave para quien usa el panel.

Medido en `PrestamoDrawer`: tras una respuesta con errores por campo, se vacían empleado, monto, cuota, cuotas y concepto. Es lo que hace React 19 con `<form action>` en campos sin estado, aunque la acción devuelva un error. Viola «Cambios sin guardar se conservan» (`frm-01.md:26`).

`CityDrawer` y `TariffDrawer` ya lo evitan con envío manual. Por lectura de código, 34 archivos del Studio combinan `<form action>`, campos sin estado y errores; 12 son de Nómina. Hace falta su propia spec.

## Estado

Implementada en la PR de esta spec, sin fusionar. Se integra después de la #350. `pnpm verify` y la suite completa dependen del turno del Director.
