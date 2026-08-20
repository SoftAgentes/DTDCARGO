---
sdd: 0273
title: El rol y el alcance se cambian desde la ficha, con motivo y confirmación
status: in-progress
author: Claude (ventana 2026-08-19)
created: 2026-08-19
updated: 2026-08-19
supersedes: null
superseded_by: null
related: [0272, 0250, 0252, 0139, 0085]
confidencialidad: interna
---

# SDD-0273 · El rol y el alcance se cambian desde la ficha, con motivo y confirmación

Slice 1 del rediseño de Usuarios y roles acordado con el founder el 2026-08-19.
Los slices 2 a 4 van en specs propias.

## Problema

**Cambiar de rol es la segunda operación más fuerte del módulo, y se disparaba
sola.**

Medido sobre `app/studio/(app)/usuarios/_components/MembersTable.tsx`:

- El rol y el almacén se cambiaban desde dos `<select>` metidos en la fila que
  llamaban `f.requestSubmit()` dentro del `onChange`. Elegir una opción —con el
  mouse, o recorriendo la lista con el teclado— **aplicaba el cambio**. No hay
  confirmación, no hay deshacer, y la operación queda escrita en la auditoría.
- La ficha (SDD-0250) mostraba rol y almacén como **datos de sólo lectura**, con
  una nota al pie que decía "el rol y el almacén se cambian desde la tabla". La
  ficha existía para ser el lugar de la persona y no podía tocar lo más
  importante de la persona.

Y hay un segundo problema, invisible desde la UI:

- **`changeUserRoleAction` y `changeWarehouseScopeAction` no le pasaban `reason`
  al RPC.** El adaptador D1 lo acepta y el RPC lo guarda, pero como nadie lo
  mandaba, el cambio quedaba registrado **sin el porqué**. AUD-01 §3 pide
  exactamente lo contrario. Ningún test lo miraba: los que había afirmaban que
  la acción devolvía `ok`, y eso pasa igual con el motivo en null.
  (`disableUserAction` sí lo leía desde antes — sólo que la UI nunca se lo
  mandaba, así que siempre caía a la frase enlatada de `d1Reason`.)

  ⚠️ **Dónde aterriza el motivo, porque es fácil nombrar la tabla equivocada.**
  No va a `user_role_audit`: esa tabla **no tiene columna `reason`** (migr 0201
  — `tenant_id`, `actor_user_id`, `target_user_id`, `action`, `old_value`,
  `new_value`, `created_at`) y la escribe un trigger `AFTER UPDATE` sobre
  `user_tenants` que nunca ve el motivo. El `p_reason` del RPC viaja a
  `append_audit_event` y aterriza en **`audit_events`**. O sea: el trigger
  guarda el **qué**, y el carril D1 guarda el **porqué**, con el mismo actor.

## Decisión

El rol y el alcance se editan **en la ficha**, en una sección propia, y aplicar
un cambio exige un gesto explícito más una confirmación con motivo.

- Los `<select>` **no aplican nada solos**. Hay un botón **Aplicar** que se
  habilita sólo si algo cambió.
- Aplicar abre un `ConfirmDialog` que **nombra a la persona, el cambio concreto
  y su consecuencia**, con **motivo obligatorio** de 8 caracteres o más. Ese
  número se importa de `D1_REASON_MIN_LENGTH`, no se copia: si el umbral del
  helper sube, la UI sube con él.
- El texto por defecto **no afirma de dónde vino el cambio**. Mientras el Slice
  2 no entre, los `<select>` de la fila siguen aplicando sin mandar motivo, así
  que un fallback que dijera "desde la ficha de usuario" le habría escrito una
  procedencia falsa a cada cambio hecho desde la tabla.
- El motivo viaja hasta el RPC y queda en la auditoría junto al actor.

### Por qué la acción se invoca a mano y no con `useActionState`

`ConfirmDialog` entrega el motivo por `onConfirm(reason: string)` — un
**callback**, no un campo de formulario. Un `<form action={…}>` no puede verlo.

Se sigue el precedente que ya existe en el repo
(`app/studio/(app)/gastos/_components/ExpenseRowActions.tsx`): armar el
`FormData` en JS e invocar la acción dentro de `startTransition`, con el error
viviendo **dentro** del diálogo en vez de saltar afuera.

**Las firmas de `actions.ts` no cambian.** Lo único que cambia del servidor es
que las dos acciones ahora pasan el `reason` que ya podían pasar.

### El orden: rol primero, alcance después

Si el rol cambia, puede cambiar si el alcance **aplica siquiera** (sólo
`operations`, `warehouse` y `support` tienen lado geográfico). Al revés se
escribiría un alcance para un rol que ya no lo usa.

### Prevenir en vez de informar (BTN-01 §6)

Cambiarte el rol o el alcance **a ti mismo** queda deshabilitado, con el motivo
a la vista y no escondido en el `title` de un control deshabilitado. El
anti-lockout del RPC sigue ahí como freno real; esto evita que el admin llegue
a confirmar algo que el servidor le va a rebotar.

## Lo que NO hace este slice

| No se hace | Por qué |
|---|---|
| Partir la ficha en 4 componentes de carpeta | Sólo se extrae `RolYAlcanceCard`, que es lo que nace. Partir el resto sin necesidad es mover código por moverlo. |
| Sacar los `<select>` de la fila de la tabla | Es el **Slice 2**. Hasta que entre, rol y almacén se pueden cambiar desde los dos sitios; el de la tabla sigue sin confirmación. Se dice acá para que no parezca olvido. |
| El bloque de historial en la ficha | `user_role_audit` no la lee ninguna query del repo. Antes de dibujarla hay que medir cuántas filas hay por persona en producción. |
| `canSubmit={dirty}` en el pie del drawer | El pie envía el formulario de **Datos de la persona**, que es otro formulario. Entra con el slice que toque ese bloque. |
| Aviso de cambios sin guardar (FRM-01) | Hueco reconocido: cerrar la ficha con Nombre/Cargo editados los descarta en silencio. **La primera versión de este slice lo empeoraba** —aplicar un cambio de rol cerraba la ficha entera y se llevaba lo tipeado— y eso sí se corrigió: aplicar ya no cierra nada. Lo que queda sin arreglar es el hueco viejo: cerrar a mano o por el scrim sigue descartando sin avisar. |

## Superficie tocada (allowlist exacta)

| Archivo | Qué |
|---|---|
| `app/studio/(app)/usuarios/actions.ts` | `reason` al RPC en rol y alcance |
| `app/studio/(app)/usuarios/_components/ficha/RolYAlcanceCard.tsx` | **nuevo** — selectores + Aplicar + confirmación con motivo |
| `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx` | sección nueva; rol y almacén dejan de ser datos muertos |
| `app/studio/(app)/usuarios/_components/MembersTable.tsx` | usa `SCOPED_ROLES` compartido; etiquetas unificadas |
| `lib/studio/user-types.ts` | `SCOPED_ROLES` sube de privado a compartido |
| `app/studio/(app)/usuarios/__tests__/cambio-de-rol-con-motivo.test.ts` | **nuevo** |
| `app/studio/_components/ui/ConfirmDialog.tsx` | el candado anti-doble-click deja de trabarse (ver abajo) |
| `app/studio/_components/ui/ConfirmDialog.test.tsx` | 2 pruebas del candado |
| `app/studio/(app)/usuarios/_components/ficha/RolYAlcanceCard.test.tsx` | **nuevo** — orden rol→alcance y los candados |
| `lib/studio/audit/d1-access-config-adapters.ts` | exporta `D1_REASON_MIN_LENGTH` |

Una etiqueta por acción: la misma server action se llamaba **"Desactivar"** en
la tabla y **"Suspender acceso"** en la ficha. Ahora es "Suspender acceso" /
"Reactivar acceso" en los dos sitios (BTN-01 §3, vocabulario).

## Un defecto del `ConfirmDialog` que salió construyendo esto

Construir el primer consumidor que **valida del lado del cliente** destapó un
agujero en la primitiva compartida.

`confirmOnce()` levanta `requestSentRef` para que un doble click no mande dos
veces, y lo baja en un efecto que depende de `[error]`:

```js
if (pending || requestSentRef.current) return;
useEffect(() => { if (error) requestSentRef.current = false; }, [error]);
```

Si el consumidor emite **dos veces el mismo texto de error**, React no
re-renderiza —el valor no cambió—, el efecto no corre, y el candado se queda
arriba. **El botón confirmar queda muerto para siempre**, sin ninguna señal de
por qué. Con este slice se dispara sólo: el mensaje "el motivo necesita al menos
8 caracteres" es constante, así que dos intentos cortos seguidos bastan.

No se había visto porque los consumidores anteriores sólo muestran errores que
vienen del servidor, que casi siempre cambian de texto, y cierran el diálogo al
tener éxito.

**Arreglo:** editar el campo de motivo baja el candado — un cambio en el input
es, por definición, un intento nuevo. El doble click *sin tocar el campo* sigue
frenado, y hay una prueba para cada mitad.

Toca una primitiva compartida y por eso entra en la allowlist. El arreglo es de
tres líneas y no cambia su API; ningún consumidor tiene que adaptarse.

## Lo que salió de la revisión adversarial

38 agentes (4 lentes + refutación de cada hallazgo): **19 confirmados, 15
refutados**. Lo que se corrigió antes de cerrar:

| Hallazgo | Qué pasaba |
|---|---|
| Aplicar cerraba la ficha | `onCambio={onClose}` desmontaba el drawer al terminar bien, y se llevaba lo tipeado sin guardar en «Datos de la persona». Ahora no cierra: confirma en su propia sección con un `role="status"`. |
| El botón salía sin estilo | `.studio-btn` define layout pero **no** `background` ni `color` — los pone la variante. Sin `-ghost`, el botón heredaba el chrome nativo del navegador. |
| El motivo por defecto mentía | Decía "desde la ficha de usuario", y los `<select>` de la fila —vivos hasta el Slice 2— no mandan motivo: cada cambio hecho desde la tabla quedaba escrito con una procedencia falsa. |
| El error llegaba como código | `D1OperationError` hace `super(code)`, así que `.message` **es** el código: el admin leía "permission_denied" dentro del diálogo. Ahora se traduce. |
| `hayCambio` ignoraba `scopeAplica` | Se podía confirmar un cambio que no escribía nada. |
| El texto del alcance mentía para `admin` | Decía "sus módulos no tienen lado geográfico" cuando la razón es que el admin ve los dos almacenes. |
| El mínimo se conocía fallando | Ahora el label dice "mínimo N caracteres" (ERR-01: prevenir antes que informar). |
| El umbral estaba copiado a mano | `D1_REASON_MIN_LENGTH` se exporta y se importa; ya no hay un `8` suelto en el cliente. |

## Verificación

- `node scripts/verify.mjs` en verde.
- Prueba de fondo: los tests miran el **argumento** que recibe el adaptador, no
  que la acción devuelva `ok`. Quitar el `reason` del RPC del rol deja 2 tests
  en rojo — comprobado con la mutación aplicada y revertida.
- Mutación del arreglo del candado: quitar el `onInput` deja 1 prueba en rojo.
- Mutaciones del orden: quitar el `&& scopeAplica` de la escritura, o el
  `return` temprano cuando el rol falla, dejan 1 prueba en rojo cada una.
- El test NO dobla `d1Reason`: usa el helper real vía `importOriginal`, así que
  un umbral que suba en el adaptador no puede dejar la UI aceptando motivos que
  el servidor tira a la basura.
- Pendiente: `/ui-check` sobre la ficha con la sección nueva desplegada.
