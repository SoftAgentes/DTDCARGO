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

El Director ordenó medir primero `app/portal`, `app/registro`, `app/entrar` y `app/invitar`, porque es lo único en uso real, y llevarle la lista antes de ampliar el alcance. Con esa lista, a la pregunta «¿Incluyo el portal en este encargo como primer tramo?», Sam respondió, literal: «Sí, portal primero».

**Límite del Director:** nada que toque portal o registro entra a `main` antes de publicar. La revisión de prueba y el argumento de cero cambios de producto en esas pantallas dependen de eso.

## Causa

React 19 vacía los campos sin estado de un `<form action={...}>` al terminar la acción, sin mirar qué devolvió. En `react-dom`, `startHostTransition` llama a `requestFormReset` justo antes de la acción. Devolver `{ error }` o `{ fieldErrors }` no cuenta como fallo.

Un campo sin estado es uno sin `value` ni `checked`. Con `defaultValue` vuelve a ese valor, y sin él queda vacío. Los campos con estado no se pierden.

Viola FRM-01, «Cambios sin guardar se conservan» (`frm-01.md:26`), y ERR-01, que pide decir «qué se conservó» (`err-01.md:25`).

## Medición: rutas en uso real

Componentes reales con la acción simulada: se llena el formulario, la acción responde con error y se compara cada campo. Ningún formulario rehidrata desde la respuesta del servidor. Se confirmó además en Chrome 152, con escritura real, en `CotizacionRequestForm`.

### Pierden lo escrito: 13 formularios en 12 archivos

| Formulario | Qué se pierde | Un error real que lo provoca |
|---|---|---|
| `cotizaciones/CotizacionRequestForm` | servicio, descripción, CBM, peso, cajas; origen y destino vuelven a su valor inicial | «Tu sesión expiró»; errores por campo |
| `compras/nueva/NewPurchaseForm` | descripción, valor, tracking; WeChat y cajas vuelven al inicial | «Tu sesión expiró»; «No pudimos registrar la compra» |
| `compras/nueva/NewPurchaseWizard` | nota; WeChat vuelve al inicial | las mismas |
| `compras/nueva/PurchaseStepDetalle` | los cuatro campos vuelven a lo ya guardado | «No pudimos guardar el detalle» |
| `compras/[code]/etiquetas/ServiceSection` | notas y consentimiento | «Ya pediste ese servicio» |
| `reclamos/PortalClaims` | tipo, descripción, envío | errores por campo; «No se pudo enviar el reclamo» |
| `mensajes/PortalMessageForm` | el mensaje | **«El mensaje es muy largo»: lo borra justo al avisar** |
| `proveedores/SuppliersClient`, agregar | nombre, WeChat, contacto, notas | «Ya tienes un proveedor con ese nombre» |
| `proveedores/SuppliersClient`, editar | los cuatro vuelven al valor guardado | «No pudimos guardar los cambios» |
| `perfil/PortalAddresses`, agregar | los seis campos | errores por campo |
| `facturas/[code]/aceptar/AcceptanceForm` | las dos casillas | «No pudimos procesar la aceptación» |
| `invitar/[token]/AcceptInvitationForm` | nombre, apellido y clave | errores por campo |
| `entrar/EntrarForm` | el correo | «Ingresa un email válido» |

### Conservan

| Formulario | Evidencia |
|---|---|
| `registro/RegisterForm` | Medido: sus 3 campos visibles del primer paso siguen tras un envío que dispara el reinicio de React. Todo su estado vive en `useState`, reflejado en campos ocultos. La respuesta de error del servidor no se ejercitó: el envío se bloquea antes por validación. **No se toca** |
| `facturas/[code]/reportar/PaymentReportForm` | Por lectura de código, sin medir: usa `onSubmit` |
| `perfil/DataChangeEditor`, `perfil/empresa/BillingIdentityForm`, `ReferralInviteForm` | Por lectura de código, sin medir: todos sus campos tienen estado |

### Sin campos que perder

`entrar/[code]/EntrarButton`, `AdvanceToCotizacionButton`, `PortalAccountMenu`, `perfil/BillingIdentityCard`, `perfil/AvatarEditor` y los formularios de una sola acción de `PortalAddresses`.

### Se deja igual a propósito

`perfil/CedulaPhotoRow`: un solo archivo que se envía al elegirlo. Si no se vaciara tras un error, volver a elegir el mismo archivo no dispararía `onChange` y no se podría reintentar. El vaciado es lo correcto ahí.

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

### La clave se sigue vaciando

`AcceptInvitationForm` conserva nombre y apellido, pero vacía la clave tras un error, como hacía hasta ahora. FRM-01: «Datos sensibles indican propósito y no reaparecen innecesariamente» (`frm-01.md:28`).

### Descartado

- **Devolver los valores desde el servidor:** obliga a tocar cada acción, y no sirve para archivos.
- **Volver controlados todos los campos:** son cientos, y no sirve para archivos.
- **Sólo `onSubmit`, sin `action`, en el portal:** el riesgo de GET de arriba.

### Formularios que quedan a la vista tras guardar

Sin el reinicio, debe limpiarlos cada uno. Revisados los 13: `PortalMessageForm` y `PortalClaims` ya llaman a `reset()` al terminar bien, y los demás pasan a otra pantalla o se cierran.

## Tramos

| Tramo | Estado | Integración |
|---|---|---|
| **1. Portal, entrar e invitar: 13 formularios** | Esta PR | **Retenida: no entra a `main` antes de publicar** |
| 2. Nómina: 15 paneles | Rama `codex/error-no-borra`, commit local, sin publicar | La decide el Director |
| 3. Resto del ERP y apps móviles | Sin tocar | Más adelante. Algunos pueden querer el vaciado, como un login con su clave |

Los tramos 1 y 2 traen el mismo ayudante en la misma ruta, así que combinan sin conflicto en cualquier orden.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| FRM-01 | **no conformidad → corregida en el tramo** | «Cambios sin guardar se conservan» (`frm-01.md:26`) |
| ERR-01 | **no conformidad → corregida en el tramo** | El mensaje dice qué se conservó (`err-01.md:25`): ahora se conserva todo |
| FRM-01, doble envío | cumplimiento | «Pending bloquea doble submit» (`frm-01.md:27`): medido, antes el formulario sí dejaba pasar el segundo |
| FRM-01, datos sensibles | cumplimiento | La clave se sigue vaciando (`frm-01.md:28`) |
| CMP-01, BTN-01 | no aplica | Una función, no un componente; los botones no cambian |
| Resto | no aplica | Sin permisos, datos nuevos, migraciones ni cambios visuales |

## Allowlist del tramo 1

- `lib/shared/submit-keeping-draft.ts` (nuevo)
- `app/portal/conservar-lo-escrito.test.tsx` (nuevo)
- `app/entrar/EntrarForm.tsx`
- `app/invitar/[token]/_components/AcceptInvitationForm.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/ServiceSection.tsx`
- `app/portal/(app)/compras/nueva/NewPurchaseForm.tsx`, `NewPurchaseWizard.tsx`, `PurchaseStepDetalle.tsx`
- `app/portal/(app)/cotizaciones/CotizacionRequestForm.tsx`
- `app/portal/(app)/facturas/[code]/aceptar/AcceptanceForm.tsx`
- `app/portal/(app)/mensajes/PortalMessageForm.tsx`
- `app/portal/(app)/perfil/PortalAddresses.tsx`
- `app/portal/(app)/proveedores/SuppliersClient.tsx`
- `app/portal/(app)/reclamos/_components/PortalClaims.tsx`
- `docs/specs/0596-error-no-borra-lo-escrito/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/sdd-0596-error-no-borra-portal.md`

## Aceptación del tramo 1

1. Tras una respuesta con error, cada formulario conserva lo escrito, salvo la clave de `AcceptInvitationForm`.
2. El reintento envía lo mismo sin reescribir nada.
3. La validación nativa de `required` sigue corriendo antes del envío.
4. Un segundo envío durante el primero no llama a la acción.
5. Un formulario que queda a la vista se limpia al enviar bien.
6. Antes de hidratar, el envío no pasa los datos por la URL.

## Verificación (2026-11-02, en el worktree; sin producción)

| Comprobación | Resultado |
|---|---|
| Prueba de los formularios, sobre el código sin arreglar | 15 de 17 en rojo |
| La misma prueba con el arreglo | 17 de 17 |
| Chrome 152, `CotizacionRequestForm`, sin arreglo | Se pierden servicio, descripción, CBM y cajas |
| Chrome 152, con arreglo | Todo se conserva, también al reintentar; un `required` vacío bloquea el envío y lleva el foco a ese campo; la URL no cambia |

**Pendiente de turno del Director:** mutantes, ESLint, tipos, pruebas vecinas en local y `next dev` con server action real, incluido el criterio 6.

**Sin medir:** archivos de `FileField`, porque sin reinicio deberían conservarse, pero no se comprobó; lector de pantalla; Studio y portal con sesión real.

## Estado

Implementado en la PR retenida de este tramo. No se integra antes de publicar.
