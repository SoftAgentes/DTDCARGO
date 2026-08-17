---
sdd: 0260
title: El portal avisa que la acción está en curso también a quien no ve la pantalla
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0042, 0093, 0138, 0215]
confidencialidad: interna
---

# SDD-0260 · El portal avisa que la acción está en curso también a quien no ve la pantalla

## Problema

**`aria-busy` no existe en ningún botón del Portal del Cliente.** Cero, en las 30
rutas de `app/portal/**`.

Medido el 2026-08-14 con un extractor que parsea el bloque de apertura de cada
`<button>` (no por nombre de archivo):

| Señal | Cantidad |
|---|---|
| Botones deshabilitados por un estado de carga (`pending` / `isPending` / `busy`) | **27** |
| De ésos, con `aria-busy` | **0** |
| Archivos con `useActionState` | 19 |
| `aria-live` en todo el portal | 2 |

[BTN-01 v1.1 §5](../../governance/policies/btn-01.md), fila **Loading**, dice
textual:

> Bloquea repetición, conserva ancho, muestra verbo en progreso y **`aria-busy`**.

De las cuatro obligaciones, el portal cumple **tres**: `disabled={pending}` bloquea
la repetición, el ancho se conserva y el verbo en progreso está ahí
("Registrando compra…", "Subiendo…", "Reenviando…"). **La cuarta no se cumple en
ningún caso.**

### Qué cuesta, en concreto

El cliente que usa lector de pantalla pulsa "Registrar compra", y **no recibe
ninguna señal de que algo esté pasando**. El cambio de etiqueta a "Registrando
compra…" es visual: nada lo anuncia. Peor: al pasar el botón a `disabled` el
navegador **le quita el foco** y lo manda al `<body>`, así que la persona pierde
además su lugar en el formulario. Desde su punto de vista el botón se
desvaneció sin decir nada.

Esto pega en el flujo de plata del portal — registrar una compra, aceptar una
factura, reportar un pago — no en pantallas secundarias.

### El patrón ya está resuelto en la casa

[`app/studio/_components/ui/ActionButton.tsx`](../../../app/studio/_components/ui/ActionButton.tsx),
componente **`canonical`** del registro CMP-01, lo hace bien:

- línea 195 → `aria-busy={isPending}`
- líneas 219-220 → un `role="status" aria-live="polite"` que **anuncia** el cambio

El portal no puede consumirlo: `ActionButton` vive bajo `app/studio/`, y el portal
no importa de ahí. Ver §"Fuera de alcance".

## Alcance

Superficie: **Portal del Cliente** (`app/portal/**`), los dos temas.
Riesgo: **routine** — es aditivo, no cambia ninguna mutación.
Acción: agregar un atributo de accesibilidad. **No** cambia lógica de negocio,
**no** toca la base de datos, **no** toca permisos.

### Allowlist exacta — 22 botones

Cada uno lleva `aria-busy={<su estado de carga>}` en el `<button>`. Nada más.

| # | Archivo:línea | Etiqueta de carga |
|---|---|---|
| 1 | `app/portal/_components/AdvanceToCotizacionButton.tsx:27` | Avanzando… |
| 2 | `app/portal/_components/PortalPushOptIn.tsx:177` | Activando… |
| 3 | `app/portal/_components/ReferralInviteForm.tsx:114` | Enviando… |
| 4 | `app/portal/(app)/academia/_components/MarkLessonButton.tsx:42` | Guardando… |
| 5 | `app/portal/(app)/compras/[code]/etiquetas/ServiceSection.tsx:254` | Pidiendo… |
| 6 | `app/portal/(app)/compras/nueva/NewPurchaseForm.tsx:210` | Registrando compra… |
| 7 | `app/portal/(app)/compras/nueva/NewPurchaseWizard.tsx:281` | Registrando compra… |
| 8 | `app/portal/(app)/compras/nueva/PurchaseStepDetalle.tsx:237` | Guardando… |
| 9 | `app/portal/(app)/cotizaciones/CotizacionRequestForm.tsx:191` | Enviando… |
| 10 | `app/portal/(app)/facturas/[code]/_components/InvoicePaymentReports.tsx:110` | Cancelando… |
| 11 | `app/portal/(app)/facturas/[code]/aceptar/AcceptanceForm.tsx:174` | Registrando… |
| 12 | `app/portal/(app)/facturas/[code]/reportar/PaymentReportForm.tsx:216` | Enviando… |
| 13 | `app/portal/(app)/mensajes/PortalMessageForm.tsx:51` | Enviando… |
| 14 | `app/portal/(app)/perfil/AvatarEditor.tsx:65` | Subiendo… |
| 15 | `app/portal/(app)/perfil/CedulaPhotoRow.tsx:91` | Subiendo… |
| 16 | `app/portal/(app)/perfil/DataChangeEditor.tsx:207` | Enviando… |
| 17 | `app/portal/(app)/perfil/PortalAddresses.tsx:280` | Guardando… |
| 18 | `app/portal/(app)/perfil/PortalAddresses.tsx:315` | *(vía prop — ver nota)* |
| 19 | `app/portal/(app)/proveedores/SuppliersClient.tsx:413` | Guardando… |
| 20 | `app/portal/(app)/proveedores/SuppliersClient.tsx:507` | Creando… |
| 21 | `app/portal/(app)/reclamos/_components/PortalClaims.tsx:192` | Enviando… |
| 22 | `app/portal/(auth)/login/LoginForm.tsx:294` | Reenviando… |

**Nota sobre el #18:** `PortalAddresses.tsx:315` es `PendingTextButton`, un botón
reutilizable que recibe sus etiquetas por prop y lee `useFormStatus()`. Es el
único punto compartido de los 22 — arreglarlo cubre a todos sus consumidores de
una vez.

### Los 5 que quedan FUERA, y por qué

Están deshabilitados por el mismo `pending`, pero **no son el botón que ejecuta**:
son la salida o el paso alterno, deshabilitados para que nadie se vaya a la mitad.
`aria-busy` en ellos mentiría — anunciaría "ocupado" sobre un control que no está
haciendo nada.

| Archivo:línea | Texto |
|---|---|
| `app/portal/(app)/compras/[code]/etiquetas/ServiceSection.tsx:262` | Cancelar |
| `app/portal/(app)/compras/nueva/PurchaseStepDetalle.tsx:245` | Lo lleno después — ir al paso 3 |
| `app/portal/(app)/perfil/DataChangeEditor.tsx:214` | Cancelar |
| `app/portal/(app)/proveedores/SuppliersClient.tsx:421` | Cancelar |
| `app/portal/(app)/proveedores/SuppliersClient.tsx:515` | Cancelar |

## ⚠️ Lo que este SDD cierra y lo que NO

Esto importa para no cantar victoria de más.

**Cierra:** la no conformidad literal con BTN-01 §5. El atributo va a estar donde
la política lo pide, y es verificable con un script.

**NO cierra por sí solo:** que la persona *se entere*. `aria-busy` sobre un botón
que además pasa a `disabled` **puede no ser anunciado** por el lector de
pantalla, justamente porque el elemento sale del foco. Por eso el `ActionButton`
canónico del Studio lo empareja con un `role="status" aria-live="polite"`
(líneas 219-220): **ese** es el que habla.

**No lo medí con un lector de pantalla real** — queda como `no verificable` en
esta spec, no como supuesto. Ver criterio de aceptación 4.

Si al verificar resulta que el anuncio no llega, la corrección es sumar la región
`aria-live` (el portal hoy tiene 2 en total) — pero eso se decide **con la medida
en la mano**, no antes.

## Criterios de aceptación

1. Los **22** botones de la allowlist tienen `aria-busy` enlazado a su estado de
   carga. Ni uno más, ni uno menos.
2. Los **5** excluidos **no** lo tienen.
3. El extractor del §"Cómo se verifica" reporta `SIN aria-busy: 0` sobre la
   allowlist, y sigue reportando los 5 excluidos como tales.
4. **Verificación con lector de pantalla real** (NVDA o el Narrador de Windows)
   sobre **un** caso del flujo de plata — se propone `NewPurchaseForm.tsx:210`
   ("Registrando compra…"). Resultado esperado: se anuncia el cambio de estado.
   **Si no se anuncia, se registra el hallazgo y se abre el slice de `aria-live`.**
   Este criterio puede cerrar como `no conforme` sin invalidar los 3 anteriores.
5. `pnpm typecheck`, `pnpm lint` y `pnpm test` en verde. `node scripts/verify.mjs`
   como cierre canónico.
6. Cero cambios de comportamiento visual: ninguna captura del portal cambia.

## Cómo se verifica

El extractor que produjo la allowlist es reproducible. Parsea el bloque de
apertura de cada `<button>` respetando llaves anidadas, y marca los que tienen
`disabled={…pending…}`:

```bash
node scripts/check-portal-aria-busy.mjs
```

Se propone dejarlo como script del repo (no como paso del gate todavía: ver
"Sólo reglas aprobadas bloquean" en el AGENT-BRIEF — esto **sí** es una regla
aprobada, BTN-01 §5, así que promoverlo al gate es legítimo, pero conviene
hacerlo en un segundo paso, ya con el arreglo adentro y sin rojo de arranque).

## Matriz SGE-00

Una fila por principio aplicable, con evidencia — no un "cumple SGE-00" genérico.

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.01 Acción predecible | `no aplica` | No se toca ningún verbo ni resultado. |
| SGE-00.02 No perder trabajo | `no aplica` | Cambio aditivo, sin efecto sobre persistencia. |
| SGE-00.03 Riesgo ↔ fricción | `no aplica` | No cambia la fricción de ninguna acción. |
| SGE-00.04 Auditabilidad | `no aplica` | No hay mutación nueva. |
| SGE-00.05 Permisos y tenant | `no aplica` | No toca autorización ni datos. |
| SGE-00.06 Prevenir antes de informar | `no aplica` | — |
| **SGE-00.07 Estado visible y verdadero** | **`no cumple` hoy → lo corrige este SDD** | Es la ley que se está incumpliendo: *"Toda operación asíncrona relevante expone espera…"*. Hoy la expone **sólo en el canal visual**. |
| SGE-00.08 Frecuencia reduce pasos | `no aplica` | No agrega pasos. |
| SGE-00.09 Reutilizar el patrón | **`excepción` declarada** | El patrón canónico existe (`ActionButton`) y **no es alcanzable** desde el portal. Se repite el atributo en 22 puntos en vez de reusar. Motivo, alcance y salida en "Fuera de alcance". |
| **SGE-00.10 Accesible y equivalente** | **`no cumple` hoy → lo corrige este SDD** | WCAG 2.2 AA · 4.1.3 Mensajes de estado. |
| SGE-00.11 Decir qué pasó y qué sigue | `cumple` parcial | El verbo en progreso ya está en las 22; lo que falta es el canal asistivo. |
| SGE-00.12 IA propone | `no aplica` | — |

## Gobernanza

| Control | Valor |
|---|---|
| Política que obliga | **BTN-01 v1.1 §5** — estado `aprobada` → **bloquea** |
| Política de apoyo | A11Y-01 v1.1 (aprobada) · SGE-00.07 y .10 |
| Clasificación del hallazgo | **no conformidad** |
| Componente `canonical` involucrado | ninguno — el portal no consume ninguno de los 4 del registro CMP-01 |
| ¿Suma consumidores a un `deprecated`? | **No.** `LLMModeToggle` no se toca. |
| Excepción declarada | SGE-00.09 (ver matriz) — responsable: founder · revisión: al abrirse el SDD de promoción de `ActionButton` |

## Fuera de alcance (y por qué)

**Promover `ActionButton` a componente compartido.** Sería la solución de fondo:
un solo lugar con `aria-busy` + `aria-live` + anti-doble-click, y el portal
dejaría de reimplementar. Pero:

- mover un componente `canonical` de sitio es **CMP-01**, y CMP-01 exige su
  propio ciclo (evidencia, consumidores, reemplazo) — no se hace de contrabando
  dentro de un arreglo de accesibilidad;
- el AGENT-BRIEF es explícito: *"No se hace barrido masivo: la adopción avanza
  por slices con SDD propio"*;
- y arrastraría a 78 archivos del Studio que hoy lo importan por su ruta actual.

Queda como **SDD siguiente**, no como parte de éste. Este SDD cierra la no
conformidad; ése cierra la deuda de arquitectura.

**También fuera:** los otros 8 hallazgos bloqueantes de la
[auditoría del 2026-08-14](../../design/portal/2026-08-14-auditoria-ui-pro-portal.md),
incluido el `text-wine` de los errores de formulario (que va en SDD propio,
porque su causa es semántica y no de accesibilidad — mezclarlos haría desaparecer
dos síntomas sin saber si eran una causa o dos).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El atributo se pone y no se anuncia nada (falso cierre) | Criterio 4: se mide con lector real y puede cerrar como `no conforme` sin bloquear el resto. |
| Las líneas se corren al aplicar el cambio | La allowlist se re-genera con el extractor antes de tocar nada; las líneas de esta spec son del commit `e7e0c81e`. |
| Otro worktree numera 0260 en paralelo | El número salió de `pnpm sdd:next` (23 refs, locales y remotas) pero **no está reservado**: no se pushea sin OK del founder. El paso `numbering` de `verify.mjs` lo agarra al mergear. |
