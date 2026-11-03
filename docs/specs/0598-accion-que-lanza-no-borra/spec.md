---
sdd: "0598"
title: "Un corte de red no borra el formulario"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-02
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0596"]
confidencialidad: interno
---

# SDD-0598 · Un corte de red no borra el formulario

## Pedido

Sam, 2026-11-02, literal: «Haz esta tarea aquí: "Que un corte de red no borre el formulario del portal"».

Es el hallazgo que SDD-0596 dejó sin arreglar. SDD-0596 cubre la acción que **responde** con un error. Esta cubre la que **lanza**.

**Límite:** nació apilada sobre la rama de SDD-0596 (PR #358), porque toca los mismos formularios. #358 ya está en `main` y esta PR apunta a `main` desde el 2026-11-03. La integra el Director General.

## Causa

Si una acción lanza, `useActionState` guarda el error y lo relanza al pintar. El error llega a la barrera más cercana y el formulario se desmonta con todo lo escrito. Da igual si los campos tienen estado: por eso también se pierde `RegisterForm`, que conserva bien una respuesta de error.

Hay tres formas de llegar ahí:

- **Corte de red:** `fetch` rechaza y Next rechaza la promesa de la acción (`server-action-reducer.js:304`, Next 16.2.11).
- **Error inesperado en el servidor:** la acción lanza en vez de devolver `{ error }`.
- **Página de una versión anterior:** tras publicar, el servidor ya no reconoce la acción y el cliente lanza `UnrecognizedActionError` (`server-action-reducer.js:78`).

En el portal, además, la pantalla de error dice «Tu información está a salvo y no se perdió nada» (`app/portal/(app)/error.tsx:66`) justo cuando se perdió todo. `/registro`, `/entrar` e `/invitar` no tienen barrera propia.

**Una trampa para el arreglo:** `redirect()` también rechaza la promesa en el cliente (`server-action-reducer.js:226`, `:233`). Un `try/catch` ciego convertiría cada redirección en un aviso de error.

## Medición

**Corte real en Chrome 152.** Componentes reales dentro de la barrera real del portal. La acción sale por `fetch` a un servidor local que cierra la conexión sin responder, así que el error es el del navegador: `TypeError: Failed to fetch`.

| | Sin arreglo | Con arreglo |
|---|---|---|
| `CotizacionRequestForm` | Sin formulario. «Esta página no cargó… no se perdió nada» | Formulario intacto, aviso honesto con el foco y a la vista, URL sin cambios |
| `NewPurchaseForm` con 2 archivos | Sin formulario | Campos y los 2 archivos intactos, rótulos correctos |
| Error 500 | No medido | Igual que el corte |
| Reintento con la red de vuelta | No aplica | Envía lo mismo y muestra el éxito, sin aviso |

**Con componentes reales y acción que rechaza:** `app/portal/la-accion-lanza.test.tsx`, 18 formularios y el reenvío del enlace. Sin arreglo, 19 de 20 en rojo; el que pasa es el control de la respuesta con error.

**No pasa por el router de Next:** la Server Action real y `redirect()` de verdad quedan para `next dev`, con turno.

## Inventario

Con el parser de TypeScript: 26 archivos de portal, registro, `entrar` e `invitar` llaman a 25 acciones. Se cubren los **18 formularios con campos, en 16 archivos**. El aviso depende de lo que hace un reintento, leído en cada acción.

### Reintentar duplica: el aviso manda a revisar antes

Cada intento genera un registro nuevo. No hay nada en la base que lo impida.

| Formulario | Acción | Evidencia |
|---|---|---|
| `NewPurchaseForm`, `NewPurchaseWizard` | `createPrealertaAction` | Código nuevo en cada intento (`proveedores/actions.ts:568`) |
| `CotizacionRequestForm` | `requestCotizacionAction` | Código nuevo y otro aviso al asesor (`cotizaciones/actions.ts:71`, `:95`) |
| `PortalClaims` | `createPortalClaimAction` | Código nuevo (`reclamos/actions.ts:99`) |
| `PortalMessageForm` | `sendPortalMessageAction` | RPC `portal_post_message`, leída sólo desde la acción: se trata como mensaje nuevo (`mensajes/actions.ts:22`) |
| `PortalAddresses`, agregar | `addAddressAction` | Inserta otra fila (`address-actions.ts:49`) |

### La acción tiene candado: el reintento lo dice

| Formulario | Acción | Evidencia |
|---|---|---|
| `SuppliersClient`, agregar; `SupplierPicker` | `createSupplierAction` | «Ya tienes un proveedor con ese nombre» (`proveedores/actions.ts:354`) |
| `ServiceSection` | `requestPrealertaServiceAction` | «Ya pediste ese servicio para esta compra» (`proveedores/actions.ts:702`) |
| `ReferralInviteForm` | `inviteReferralAction` | «Ya invitaste a ese correo» (`lib/portal/referral-invite.ts:89`) |
| `RegisterForm` | `registerClientAction` | Por documento, correo y teléfono (`registro/actions.ts:171`, `:208`) |
| `AcceptInvitationForm` | `acceptInvitationFormAction` | «Esta invitación ya fue aceptada» (`invitar/[token]/actions.ts:71`), que la pantalla muestra como éxito |

### Sobrescribe: se puede repetir

| Formulario | Acción | Evidencia |
|---|---|---|
| `PortalAddresses`, editar | `updateAddressAction` | Actualiza la misma fila |
| `SuppliersClient`, editar | `updateSupplierAction` | Actualiza la misma fila |
| `DataChangeEditor` | `updateMyProfileAction` | El segundo intento responde `no_changes` (`perfil/actions.ts:332`) |
| `BillingIdentityForm` | `saveBillingIdentityAction` | RPC `portal_upsert_my_billing_identity` |
| `PurchaseStepDetalle` | `updatePrealertaDetalleAction` | Los campos se sobrescriben. **Los adjuntos no:** cada intento sube el archivo otra vez (`proveedores/actions.ts:100`). Un documento repetido se ve y no daña la compra |
| `EntrarForm` | `requestMagicLink` | Otro enlace, con límite de envíos (`entrar/actions.ts:142`) |

### Sin tocar

- **Ya lo resuelve:** `PaymentReportForm`, con `try/catch` e identificador de intento (`PaymentReportForm.tsx:107`, `:130`). `PortalAddresses`, borrar, con su propio `catch`.
- **Sin nada escrito que perder:** `EntrarButton`, `AdvanceToCotizacionButton`, `AvatarEditor`, `CedulaPhotoRow`, `BillingKindSelector`, `BillingIdentityCard`, `MarkLessonButton`, `InvoicePaymentReports`, borrar proveedor y cancelar solicitud de datos. Si lanzan, van a la pantalla de error. Ver «Fuera de alcance».
- **`AcceptanceForm`:** dos casillas, no algo escrito. Cada intento de aceptar sigue siendo un acto explícito, como decidió SDD-0596.

## Decisión

### El ayudante

`lib/shared/use-action-keeping-draft.ts`:

```tsx
const [state, formProps, pending] = useActionKeepingDraft(serverAction, initial, "…");
<form {...formProps}>
```

- **Atrapa lo que lanza** y responde `{ error: aviso }`.
- **Deja seguir lo que no es un fallo:** `unstable_rethrow` relanza `redirect()` y `notFound()`.
- **Página desactualizada:** dice que nada se registró y que hay que copiar y recargar. Reintentar nunca funcionaría.
- **`actionKeepingDraft`, sin hook:** para `RegisterForm`, cuyo `action` ya era una función de cliente, y `SupplierPicker`, que no es un `<form>`.

### Dos `useActionState`

Sólo una Server Action sin envolver sirve de `action` en el HTML del servidor. Antes de hidratar, o si el JavaScript no cargó, el navegador envía por ahí con POST y su resultado llega como `serverState`. Una vez hidratado, `onSubmit` toma el envío por el envoltorio.

`action` y `onSubmit` se entregan juntos, en `formProps`: un `action` solo enviaría sin atrapar nada y su resultado no llegaría a `state`.

### El aviso no afirma lo que no sabe

Si se perdió la respuesta, la acción pudo haberse registrado. Decir «falló» sería falso y empujaría a duplicar. Cada aviso dice que no se pudo confirmar, qué se conservó y qué hacer (ERR-01, `err-01.md:25`):

| Clase | Ejemplo |
|---|---|
| Duplica | «No pudimos confirmar si tu cotización se registró. Lo que escribiste sigue aquí. Antes de enviarla de nuevo, revisa Cotizaciones en otra pestaña.» |
| Candado | «No pudimos confirmar si el proveedor se guardó. Lo que escribiste sigue aquí. Intenta de nuevo: si ya quedó, te lo avisaremos.» |
| Se repite | «No pudimos confirmar si los cambios se guardaron. Lo que escribiste sigue aquí. Intenta de nuevo.» |
| Invitación | «…Tu nombre sigue aquí; la clave hay que escribirla otra vez…» |

Dice «en otra pestaña» porque salir de la pantalla sí borraría lo escrito.

### El foco va al aviso

Sólo cuando la acción lanzó (`use-action-keeping-draft.ts:69`). El botón deshabilitado ya soltó el foco, y en cuatro formularios el aviso está arriba: quien envió desde abajo no lo vería. Las respuestas con error no cambian. `RegisterForm` y `SupplierPicker` no lo llevan: su aviso está junto al botón.

### Dos ajustes para que el aviso sea cierto

- **`CotizacionRequestForm`** no anunciaba sus errores: ahora tiene `role="alert"`. Es el único de los 18 sin él.
- **`EntrarForm`:** si fallaba «Pedir otro enlace», volvía al formulario con el correo vacío mientras el aviso decía que seguía ahí. Ahora conserva el último correo usado. Sirve también con una respuesta de error.

### Descartado

- **Envolver la acción y usar un solo `useActionState`:** el HTML del servidor queda con `action="javascript:throw…"`, medido en la prueba. Sin JavaScript, o si no cargó, el formulario no hace nada: en una conexión mala es justo cuando más importa.
- **Reintentar solo:** duplicaría.
- **Una barrera por formulario:** también desmonta.
- **`navigator.onLine`:** no ve una respuesta perdida y no es fiable.
- **Identificador de intento en la base:** es lo correcto para ERR-01, pero exige migraciones. Ver «Fuera de alcance».

## Datos personales

Clasificación con `.claude/skills/revisar-datos-ve/SKILL.md`, limitada a lo que cambia este tramo. Sin filas de producción: todas las medidas usan datos de prueba. No es asesoría legal: es un inventario técnico para saber qué preguntarle a un abogado.

| Punto | Estado | Evidencia |
|---|---|---|
| Sin campos nuevos ni almacenamiento en el navegador | `CORRECTO` | El ayudante sólo envuelve la acción (`use-action-keeping-draft.ts:26`) |
| El detalle del error no llega a la pantalla | `CORRECTO` | El aviso es un texto fijo; `error` no se muestra (`use-action-keeping-draft.ts:30`) |
| La clave no reaparece tras un corte | `CORRECTO` | `AcceptInvitationForm.tsx:55`, probado en `la-accion-lanza.test.tsx` |
| Lo escrito y los archivos siguen en la página tras un corte | `ENCONTRADO` | Es el propósito del cambio, igual que en SDD-0596: quedan en la página abierta |
| `EntrarForm` guarda el último correo en memoria | `ENCONTRADO` | `EntrarForm.tsx:90`: sólo en el estado del componente, y es el que la persona escribió |
| Un reintento puede registrar dos veces los mismos datos | `ENCONTRADO` | En las cinco acciones de «Reintentar duplica». El aviso lo previene; no lo impide |
| Antes de hidratar, los datos no pasan por la URL | `NO VERIFICABLE` | Falta `next dev`, con turno |
| Equipo compartido y restauración del navegador | `NO VERIFICABLE` | Dependen del navegador y del equipo |

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| FRM-01, conservación | **no conformidad → corregida en el tramo**, cuando la acción lanza | `frm-01.md:26` |
| ERR-01, qué se conservó | cumplimiento, en estos avisos | `err-01.md:25` |
| ERR-01, primer error con foco; A11Y-01 | cumplimiento, cuando la acción lanza y usa el hook | `err-01.md:28`, `a11y-01.md:24` |
| ERR-01, conectividad | **no conformidad, reducida** | `err-01.md:18` pide estado de conexión y reintento seguro: hay aviso, pero el reintento no es seguro en cinco acciones |
| ERR-01, reintento | **no conformidad, sin corregir** en esas cinco acciones | `err-01.md:31`. Lo corrige un identificador de intento, con migraciones |
| FRM-01, doble envío | cumplimiento | `frm-01.md:27`, probado |
| CMP-01, BTN-01 | no aplica | Un hook; los botones no cambian |

## Fuera de alcance

1. **Identificador de intento en las cinco acciones que duplican.** Es lo que corrige `err-01.md:31`. Exige migraciones, con aprobación concreta de Sam. No se decide aquí.
2. **Un envío que se cuelga sin responder.** No hay tiempo límite: el formulario se queda en «Enviando…». Next atiende las acciones en cola, así que soltarlo no bastaría.
3. **Archivo por encima de `bodySizeLimit`** (`next.config.ts:234`). Medido con 13 MB: responde 500, muestra el aviso y conserva lo escrito y el archivo. Reintentar con el mismo archivo vuelve a dar 500; sin él, entra. El aviso no dice que la causa es el tamaño.
4. **`app/portal/(app)/error.tsx`:** dice «no se perdió nada» sin saberlo y tiene un voseo, «Volvé». Se sigue viendo en los botones de una sola acción y en errores de pantalla.
5. **Botones de una sola acción:** si lanzan, la pantalla de error reemplaza la página, con lo que otro formulario de esa página tuviera escrito.

## Allowlist

- `lib/shared/use-action-keeping-draft.ts` (nuevo)
- `lib/shared/__tests__/use-action-keeping-draft.test.tsx` (nuevo)
- `app/portal/la-accion-lanza.test.tsx` (nuevo)
- `app/entrar/EntrarForm.tsx`
- `app/invitar/[token]/_components/AcceptInvitationForm.tsx`
- `app/registro/RegisterForm.tsx`
- `app/portal/_components/ReferralInviteForm.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/ServiceSection.tsx`
- `app/portal/(app)/compras/nueva/NewPurchaseForm.tsx`, `NewPurchaseWizard.tsx`, `PurchaseStepDetalle.tsx`, `SupplierPicker.tsx`
- `app/portal/(app)/cotizaciones/CotizacionRequestForm.tsx`
- `app/portal/(app)/mensajes/PortalMessageForm.tsx`
- `app/portal/(app)/perfil/PortalAddresses.tsx`, `DataChangeEditor.tsx`, `empresa/BillingIdentityForm.tsx`
- `app/portal/(app)/proveedores/SuppliersClient.tsx`
- `app/portal/(app)/reclamos/_components/PortalClaims.tsx`
- `docs/specs/0598-accion-que-lanza-no-borra/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/sdd-0598-accion-que-lanza.md`

## Aceptación

1. Si la acción lanza, el formulario sigue montado, con lo escrito y los archivos, salvo la clave de `AcceptInvitationForm`.
2. El aviso dice que no se pudo confirmar, qué se conservó y qué hacer, según lo que haría un reintento.
3. `redirect()` y `notFound()` siguen su camino, sin aviso.
4. Una página de una versión anterior dice que nada se registró y que hay que recargar.
5. Un envío en curso bloquea el siguiente, y el reintento manda lo mismo.
6. Una respuesta con error se muestra igual que antes, y no mueve el foco.
7. Antes de hidratar, el formulario envía por POST, sin datos en la URL.

## Verificación (2026-11-02, en el worktree; sin producción)

| Comprobación | Resultado |
|---|---|
| `la-accion-lanza.test.tsx`, sin el arreglo | FALLÓ, como se esperaba: 19 de 20 en rojo |
| `la-accion-lanza.test.tsx` y `use-action-keeping-draft.test.tsx`, con el arreglo | PASÓ, 31 de 31 |
| HTML del servidor con una referencia de Server Action de prueba, e hidratación | PASÓ: `method="POST"`, sin `javascript:`, sin diferencias al hidratar. No es una Server Action real |
| `conservar-lo-escrito.test.tsx` de SDD-0596 | PASÓ, 29 de 29 |
| `entrar-dos-filas.test.tsx`, `NewPurchaseWizard.test.tsx` | PASÓ, 8 de 8 y 13 de 13 |
| Chrome 152, corte real | PASÓ, ver «Medición» |
| ESLint de los 19 archivos | PASÓ |
| `tsc` limitado a los archivos tocados | Sin errores en ellos. 1 error ajeno, de la configuración limitada: `DocumentImportPanel.tsx`, módulo CSS |
| `docs:check`, `sdd:check` | Ver el cuerpo de la PR |
| `/ui-check` del diff | Sin clases, tokens ni maquetación nuevos; copy en tuteo. Un hallazgo fuera del diff: `error.tsx` |

### Con `next dev` y Server Action real (2026-11-03)

Sobre `2204318f5`, la punta de #362, que contiene `16b62342f` de esta rama. Ruta temporal sin commit, `next dev --webpack`, Chromium de Playwright y un Supabase sintético que rechaza todo. Sin producción ni red externa. **El diseño de los dos `useActionState` no cambia.**

| Caso | Resultado |
|---|---|
| HTML del servidor | PASÓ: `method="POST"`, `multipart/form-data`, campos `$ACTION_`, sin `javascript:` |
| Sin JavaScript, la acción responde | PASÓ: POST nativo, URL sin datos, resultado visible, también el de error |
| `form.submit()` con JavaScript, el envío de antes de hidratar | PASÓ: POST, URL sin datos, resultado visible al hidratar y sin errores de hidratación |
| Después de ese POST | PASÓ: el siguiente envío va por `onSubmit` y su estado sigue la cadena del POST (1, luego 2). Una acción que lanza da el aviso y no desmonta |
| La acción responde con error | PASÓ: aviso visible y campo intacto. El foco no va al aviso |
| La acción lanza | PASÓ: aviso, campo y archivo intactos, foco en el aviso |
| Red cortada y `next dev` parado | PASÓ: aviso y campo intactos, por el router real. Reintentar con la red de vuelta entra |
| `redirect()` | PASÓ: navega, sin aviso |
| `notFound()` | PASÓ: muestra la 404, sin aviso |
| Identificador de acción desconocido | PASÓ: 404 con `x-nextjs-action-not-found`, aviso de página desactualizada y campo intacto. Se alteró la cabecera con Playwright; no se renombró la acción |
| Doble clic, dos clics a 50 ms, Enter dos veces | PASÓ: la acción corre una vez. Tres `requestSubmit()` en el mismo instante corren tres veces, porque `pending` aún no se pintó; ningún gesto de una persona llega ahí |
| `/entrar` | PASÓ: antes de hidratar va por POST con el correo fuera de la URL. Con la red cortada: aviso, correo intacto y foco en el aviso |
| `/registro`, red cortada en el último paso | PASÓ: aviso y datos intactos. El foco queda en `body`: no usa el ayudante. Su HTML trae `action="javascript:throw…"`, porque su `action` es una función de cliente, igual que antes: antes de hidratar no envía nada |
| Archivo de 13 MB | Medido: ver «Fuera de alcance» |

**Límite medido:** sin JavaScript, si la acción lanza, responde 500 y lo escrito se pierde. `onSubmit` sólo existe después de hidratar, así que este diseño no lo cubre.

`EntrarButton` y `AdvanceToCotizacionButton` salen de lo pendiente: esta PR no los toca, y usan su propio `useActionState`.

**Pendiente de turno:** mutantes y `pnpm verify` sobre la punta de #362, que incluye las pruebas vecinas y el `tsc` completo.

**Sin medir:** `next start`, donde el error llega enmascarado; lector de pantalla, portal con sesión real, envío colgado, y los avisos con los estilos reales del portal.

## Estado

Implementado en la PR #360, en borrador, contra `main`. La integra el Director General, antes de #362.
