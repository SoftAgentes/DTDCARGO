---
sdd: "0596"
title: "Un error no borra lo que la persona escribió"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-02
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0595", "0592", "0537", "0103"]
confidencialidad: interno
---

# SDD-0596 · Un error no borra lo que la persona escribió

## Pedido

Sam, 2026-11-02, literal: «Haz esta tarea aquí: "Que un error no borre lo escrito en los paneles"».

El Director ordenó medir primero `app/portal`, `app/registro`, `app/entrar` y `app/invitar`, porque es lo único en uso real, y llevarle la lista antes de ampliar el alcance.

**Decisión de Sam, literal: «Sí, portal primero».** Respondió a la pregunta «¿Arreglamos primero el portal, antes que los paneles de Nómina?». En la sesión de trabajo la pregunta llegó como «¿Incluyo el portal en este encargo como primer tramo?».

**Límite del Director:** nada que toque portal o registro entra a `main` antes de publicar. La PR del tramo 1 espera a que termine la salida a producción. La revisión de prueba y el argumento de cero cambios de producto en esas pantallas dependen de eso.

## Causa

React 19 vacía los campos sin estado de un `<form action={...}>` al terminar la acción, sin mirar qué devolvió. En `react-dom`, `startHostTransition` llama a `requestFormReset` justo antes de la acción. Devolver `{ error }` o `{ fieldErrors }` no cuenta como fallo.

Un campo sin estado es uno sin `value` ni `checked`. Con `defaultValue` vuelve a ese valor, y sin él queda vacío. Los campos con estado no se pierden.

Viola FRM-01, «Cambios sin guardar se conservan» (`frm-01.md:26`).

## Medición: rutas en uso real

Componentes reales con la acción simulada: se llena el formulario, la acción responde con un error y se compara cada campo. Ningún formulario rehidrata desde la respuesta del servidor. En Chrome 152, con escritura real, se confirmó `CotizacionRequestForm`, y los archivos de `NewPurchaseForm` y `PaymentReportForm`.

La respuesta de error de un servidor real, con server action, sigue pendiente de turno.

### Qué pierde `main` y qué conserva cada formulario con el arreglo

13 formularios en 11 archivos.

| Formulario | Conserva tras el error | Un error real que lo provoca |
|---|---|---|
| `entrar/EntrarForm` | `email`. No hay clave ni código: es un enlace mágico (`EntrarForm.tsx:70`) | «Ingresa un email válido» |
| `invitar/[token]/AcceptInvitationForm` | `first_name`, `last_name`. **`password` vuelve vacío** | errores por campo |
| `cotizaciones/CotizacionRequestForm` | `service`, `description`, `origin`, `destination`, `cbm`, `weightKg`, `boxes` | «Tu sesión expiró»; errores por campo |
| `compras/nueva/NewPurchaseForm` | `supplierWechat`, `description`, `boxes`, `estValueUsd`, `trackingCn`, y los archivos | «Tu sesión expiró»; «No pudimos registrar la compra» |
| `compras/nueva/NewPurchaseWizard` | `clientNote`, `supplierWechat`, y `doc_whatsapp` | las mismas |
| `compras/nueva/PurchaseStepDetalle` | `description`, `boxes`, `estValueUsd`, `trackingCn`, y los archivos | «No pudimos guardar el detalle» |
| `compras/[code]/etiquetas/ServiceSection` | `notes`, `trackings`, `consent` | «Ya pediste ese servicio» |
| `reclamos/PortalClaims` | `claim_type`, `description`, `shipment_id`, y `evidence` | errores por campo; «No se pudo enviar el reclamo» |
| `mensajes/PortalMessageForm` | `body` | **«El mensaje es muy largo»: `main` lo borra justo al avisar** |
| `proveedores/SuppliersClient`, agregar | `name`, `wechat`, `contact`, `notes` | «Ya tienes un proveedor con ese nombre» |
| `proveedores/SuppliersClient`, editar | los cuatro | «No pudimos guardar los cambios» |
| `perfil/PortalAddresses`, agregar | `label`, `line`, `city`, `state`, `reference`, `isDefault` | errores por campo |
| `perfil/PortalAddresses`, editar | los seis | errores por campo; «No se pudo actualizar la dirección» |

### Archivos

`FileField` (`PortalFormField.tsx:86`) no se puede rellenar por seguridad del navegador, así que el caso importaba. Medido en Chrome 152, con archivos reales puestos con `DataTransfer` en `NewPurchaseForm`:

| | Tras el error | Reintento |
|---|---|---|
| **`main`** | El campo queda con 0 archivos, pero **el rótulo sigue en verde con el nombre del archivo** | Envía un archivo vacío de 0 bytes |
| **Con el arreglo** | El campo sigue con 1 archivo y el rótulo dice la verdad | Envía `captura-chat.pdf` y `packing-list.pdf`, y la descripción |

Es peor que perder texto: el servidor descarta en silencio el archivo vacío (`proveedores/actions.ts:144`), así que en `main` la compra se registra sin el documento mientras la pantalla decía que estaba.

**La pantalla no necesita decir que hay que volver a elegirlo:** con el arreglo, el archivo no se pierde. Medido en `NewPurchaseForm`. `NewPurchaseWizard` y `PurchaseStepDetalle` usan el mismo `FileField`, y `PortalClaims` un `type="file"` propio (`PortalClaims.tsx:177`); no se midieron con archivos en Chrome.

### Ya conservaban: medidos, no se tocan

| Formulario | Medición, con respuesta de error |
|---|---|
| `registro/RegisterForm` | Tras llenar los pasos y llegar a la respuesta de error: 12 campos ocultos intactos (`RegisterForm.tsx:438`), con el aviso a la vista. Su estado vive en `useState` |
| `facturas/[code]/reportar/PaymentReportForm` | Chrome 152: `amount`, `method`, `paid_at`, `note` y el archivo `proof` siguen, con el aviso a la vista |
| `perfil/DataChangeEditor` | 3 campos intactos, con el aviso a la vista |
| `perfil/empresa/BillingIdentityForm` | 2 campos intactos, con el aviso a la vista |
| `ReferralInviteForm` | 2 campos intactos, con el aviso a la vista |

### Sin campos que perder

`entrar/[code]/EntrarButton`, `AdvanceToCotizacionButton`, `PortalAccountMenu`, `perfil/BillingIdentityCard`, `perfil/AvatarEditor` y los formularios de una sola acción de `PortalAddresses`.

### Se deja igual a propósito

- **`facturas/[code]/aceptar/AcceptanceForm`:** ver «La aceptación legal sigue siendo un acto explícito».
- **`perfil/CedulaPhotoRow`:** un solo archivo que se envía al elegirlo, y que se vacía a mano (`CedulaPhotoRow.tsx:60`). Si no se vaciara tras un error, volver a elegir el mismo archivo no dispararía `onChange` y no se podría reintentar. Tampoco conviene que la foto de una cédula se quede en el campo.

### Hallazgo sin arreglar: cuando la acción lanza

Si la acción **lanza** en vez de responder, el error llega a la pantalla de error y el formulario se desmonta: se pierde todo. Medido en `CotizacionRequestForm`, simulando un corte de red. Por lectura, también debería pasar con un cuerpo por encima de `bodySizeLimit` (`next.config.ts:234`); eso no se midió.

No se arregla aquí porque reintentar podría duplicar el envío: ERR-01 pide «Reintentar no duplica la mutación» (`err-01.md:31`), y estas acciones no son idempotentes. `PaymentReportForm` ya lo resuelve, con `try/catch` y un identificador de intento (`PaymentReportForm.tsx:107`, `:130`).

**Recomendación:** tramo y decisión aparte. Atrapar el error, conservar lo escrito y avisar con honestidad que el envío pudo haberse registrado, empezando por las acciones que crean algo.

## Inventario completo

Con el parser de TypeScript: 132 archivos de `app/` usan `<form action={...}>`, y 76 tienen campos sin estado. Corrige una primera cifra de 34, hecha con una búsqueda de texto que sólo veía `defaultValue`.

## Decisión

### El ayudante

`submitKeepingDraft(action, pending)` en `lib/shared/submit-keeping-draft.ts`, el puente permitido entre superficies. Es el patrón de `CityDrawer.tsx` y `TariffDrawer.tsx`, para no repetirlo en cada formulario.

Con `preventDefault` en `onSubmit`, React omite la acción y su reinicio (`react-dom`, `nativeEvent.defaultPrevented`). La validación nativa de `required` sigue corriendo antes, y `useFormStatus` sigue sabiendo que hay un envío en curso.

### En el portal, `action` y `onSubmit` juntos

Estas pantallas se renderizan en el servidor. Antes de hidratar, un `<form>` sin `action` enviaría sus campos por GET, en la URL. Por eso se conserva `action` y se añade `onSubmit`:

```tsx
<form action={formAction} onSubmit={submitKeepingDraft(formAction, pending)}>
```

Antes de hidratar sigue funcionando el envío con `action`. Después, `onSubmit` lo toma y no hay borrado. **Comprobar esto con una server action real y sin hidratar sigue pendiente de turno.**

### Claves y códigos no se conservan

- **`AcceptInvitationForm`** conserva nombre y apellido, pero vacía la clave tras un error (`AcceptInvitationForm.tsx:54`). FRM-01: «Datos sensibles indican propósito y no reaparecen innecesariamente» (`frm-01.md:28`). Probado en `conservar-lo-escrito.test.tsx:129`.
- **`EntrarForm`** no tiene clave ni código. Los otros formularios del tramo tampoco: lo comprueba `conservar-lo-escrito.test.tsx:155`, en su estado inicial o con el formulario abierto.

### La aceptación legal sigue siendo un acto explícito

**Recomendación: no conservar las dos casillas de `AcceptanceForm`. Queda fuera del arreglo y no cambia.**

- Lo que se pierde son dos clics, no algo escrito.
- La acción exige las dos casillas (`aceptar/actions.ts:134`) y sella los documentos vigentes al enviar (`aceptar/actions.ts:164`). Un error como «No pudimos procesar la aceptación ahora. Prueba de nuevo en un rato.» (`aceptar/actions.ts:84`) puede abrir un intervalo: al volver, marcar de nuevo acepta el texto vigente en ese momento, y no una casilla que quedó marcada de antes.
- Cada intento lleva sus dos marcas hechas por la persona. Probado en `conservar-lo-escrito.test.tsx:143`.

La decisión final sobre el texto legal es de Sam. Esto es técnico y no es asesoría legal.

### Descartado

- **Devolver los valores desde el servidor:** obliga a tocar cada acción, y no sirve para archivos.
- **Volver controlados todos los campos:** son cientos, y no sirve para archivos.
- **Sólo `onSubmit`, sin `action`, en el portal:** el riesgo de GET de arriba.
- **Un aviso de «vuelve a elegir el archivo»:** con el arreglo no hace falta; sería un texto falso.

### Formularios que quedan a la vista tras guardar

Sin el reinicio, debe limpiarlos cada uno. Revisados los 13: `PortalMessageForm` y `PortalClaims` ya llaman a `reset()` al terminar bien, y los demás pasan a otra pantalla o se cierran. `PortalMessageForm` está probado; los demás, por lectura.

## Datos personales

Clasificación con `.claude/skills/revisar-datos-ve/SKILL.md`, limitada a lo que cambia este tramo. Sin filas de producción: todas las medidas usan datos de prueba. No es asesoría legal: es un inventario técnico para saber qué preguntarle a un abogado.

| Punto | Estado | Evidencia |
|---|---|---|
| Sin campos nuevos ni datos nuevos capturados | `CORRECTO` | El diff de los formularios sólo añade `onSubmit`, y en `AcceptInvitationForm` una referencia; p. ej. `CotizacionRequestForm.tsx:78` |
| Sin almacenamiento en el navegador | `CORRECTO` | Sin `localStorage`, `sessionStorage`, `indexedDB` ni `document.cookie` en los archivos tocados. El ayudante sólo arma el `FormData` (`submit-keeping-draft.ts:24`) |
| Sin destinos nuevos: el dato sale por la misma acción | `CORRECTO` | `submit-keeping-draft.ts:25` |
| La clave no reaparece tras un error | `CORRECTO` | `AcceptInvitationForm.tsx:54` |
| La foto de cédula no se conserva | `CORRECTO` | `CedulaPhotoRow.tsx:60` |
| Lo escrito y los archivos siguen en la página tras el error, hasta enviar bien o salir | `ENCONTRADO` | Es el propósito del cambio, no un defecto: direcciones, contactos, mensajes y documentos quedan en la página abierta, igual que mientras se escribían. `PortalAddresses.tsx:398`, `PortalFormField.tsx:86` |
| Antes de hidratar, los datos no pasan por la URL | `NO VERIFICABLE` | El diseño conserva `action`, pero leer el código no lo demuestra. Falta `next dev`, con turno |
| Equipo compartido, autocompletado y restauración del navegador al volver atrás | `NO VERIFICABLE` | Dependen del navegador y del equipo; no se miden en el repositorio |

El cambio no captura ni mueve datos nuevos: sólo deja de borrar en la pantalla lo que la persona ya escribió. Lo que sí cambia es cuánto tiempo sigue visible en una página abierta.

## Tramos

| Tramo | Estado | Integración |
|---|---|---|
| **1. Portal, entrar e invitar: 13 formularios en 11 archivos** | PR en borrador | **Retenida: espera a que termine la salida a producción** |
| 2. Nómina: 15 paneles | Rama `codex/error-no-borra`, commits locales, sin publicar | PR aparte; la decide el Director |
| 3. Resto del ERP y apps móviles | Sin tocar | Más adelante. Algunos pueden querer el vaciado, como un login con su clave |
| Cuando la acción lanza | Sin tocar | Decisión aparte: ver el hallazgo de arriba |

Los tramos 1 y 2 traen el mismo ayudante en la misma ruta, así que combinan sin conflicto en cualquier orden. No se mezclan en una PR.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| FRM-01, conservación | **no conformidad → corregida en el tramo**, con las respuestas de error | «Cambios sin guardar se conservan» (`frm-01.md:26`) |
| FRM-01, doble envío | cumplimiento | «Pending bloquea doble submit» (`frm-01.md:27`): medido, antes el formulario sí dejaba pasar el segundo |
| FRM-01, datos sensibles | cumplimiento | La clave se sigue vaciando (`frm-01.md:28`) |
| ERR-01, qué se conservó | **no conformidad, reducida** | `err-01.md:25`: ahora lo escrito sigue a la vista, pero los mensajes no lo dicen, y `AcceptInvitationForm` no avisa que la clave se vació. No se cambian textos en este tramo |
| ERR-01, reintento | **no conformidad, sin corregir** | `err-01.md:31`, cuando la acción lanza |
| CMP-01, BTN-01 | no aplica | Una función, no un componente; los botones no cambian |
| Resto | no aplica | Sin permisos, migraciones ni cambios visuales |

`/ui-check` del diff: sin clases, tokens, textos ni maquetación nuevos. Un hallazgo bajo, el de la clave, en la fila de ERR-01.

## Allowlist del tramo 1

- `lib/shared/submit-keeping-draft.ts` (nuevo)
- `app/portal/conservar-lo-escrito.test.tsx` (nuevo)
- `app/entrar/EntrarForm.tsx`
- `app/invitar/[token]/_components/AcceptInvitationForm.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/ServiceSection.tsx`
- `app/portal/(app)/compras/nueva/NewPurchaseForm.tsx`, `NewPurchaseWizard.tsx`, `PurchaseStepDetalle.tsx`
- `app/portal/(app)/cotizaciones/CotizacionRequestForm.tsx`
- `app/portal/(app)/mensajes/PortalMessageForm.tsx`
- `app/portal/(app)/perfil/PortalAddresses.tsx`
- `app/portal/(app)/proveedores/SuppliersClient.tsx`
- `app/portal/(app)/reclamos/_components/PortalClaims.tsx`
- `docs/specs/0596-error-no-borra-lo-escrito/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/sdd-0596-error-no-borra-portal.md`

## Allowlist del tramo 2

- `lib/shared/submit-keeping-draft.ts` (nuevo)
- `app/studio/(app)/nomina/_components/__tests__/conservar-lo-escrito.test.tsx` (nuevo)
- En `app/studio/(app)/nomina/_components/`: `AmonestacionDrawer.tsx`, `AsistenciaDrawer.tsx`, `CuotaPrestamoDrawer.tsx`, `EmpleadoDrawer.tsx`, `EnviarComunicacionDrawer.tsx`, `FeriadoDrawer.tsx`, `GenerarCorteDrawer.tsx`, `GenerarFiniquitoDrawer.tsx`, `GenerarInvitacionDrawer.tsx`, `PagoPrestadorDrawer.tsx`, `PrestadorDrawer.tsx`, `PrestamoDrawer.tsx`, `PuestoDrawer.tsx`, `ReglasDrawer.tsx`, `RevisarSolicitudDrawer.tsx`
- `docs/specs/0596-error-no-borra-lo-escrito/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/sdd-0596-error-no-borra-nomina.md`

## Aceptación del tramo 1

1. Tras una respuesta con error, cada formulario conserva lo escrito y los archivos, salvo la clave de `AcceptInvitationForm`.
2. El reintento envía lo mismo sin reescribir nada.
3. La validación nativa de `required` sigue corriendo antes del envío.
4. Un segundo envío durante el primero no llama a la acción.
5. Un formulario que queda a la vista se limpia al enviar bien.
6. Antes de hidratar, el envío no pasa los datos por la URL.
7. `AcceptanceForm` vuelve a pedir las dos casillas después de un error.
8. El rótulo de un archivo nunca muestra uno que el campo ya no tiene, tras una respuesta con error.

## Verificación (2026-11-02, en el worktree; sin producción)

| Comprobación | Resultado |
|---|---|
| `conservar-lo-escrito.test.tsx`, con el ayudante desactivado, una corrida con `--maxWorkers=1` | 14 de 29 en rojo: los 13 formularios y el doble envío |
| La misma prueba con el ayudante | 29 de 29 |
| Chrome 152, `CotizacionRequestForm`, sin arreglo | Se pierden servicio, descripción, CBM y cajas |
| Chrome 152, con arreglo | Todo se conserva, también al reintentar; un `required` vacío bloquea el envío y lleva el foco a ese campo; la URL no cambia |
| Chrome 152, archivos en `NewPurchaseForm`, sin arreglo | 0 archivos en el campo, rótulo con el nombre, reintento con un archivo vacío |
| Chrome 152, archivos en `NewPurchaseForm`, con arreglo | 1 archivo en cada campo elegido; el reintento envía los dos archivos y la descripción; la URL no cambia |
| Chrome 152, `PaymentReportForm` | Todo se conserva, con el archivo |
| Componentes reales, `RegisterForm`, `DataChangeEditor`, `BillingIdentityForm`, `ReferralInviteForm` | Nada perdido, con el aviso a la vista |
| Componentes reales, `CotizacionRequestForm` cuando la acción lanza | Pantalla de error, formulario desmontado |

Todas estas medidas usan una acción simulada, con la forma de la respuesta de la acción real.

**`pnpm verify` sobre `5fd452355`:** salió con exit 1 por `build`, por un `node_modules` con enlaces fuera del root. Reparado, `build`, `sql-tests` y `schema-rebuild` pasaron de a uno sobre el mismo SHA. El detalle por comprobación, con los primeros intentos, está en el handoff.

**Pendiente de turno:** `next dev` con server action real, incluido el criterio 6, y mutantes.

**Sin medir:** lector de pantalla, portal con sesión real, y archivos en `NewPurchaseWizard`, `PurchaseStepDetalle` y `PortalClaims`.

## Estado

Implementado en la PR de este tramo. La retención por la salida a producción terminó; la integra el Director General.
