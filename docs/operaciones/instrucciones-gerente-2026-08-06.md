# Instrucciones para el gerente · 2026-08-06

> Dos tareas. La primera tiene un paso que **no puedes hacer tú** y está marcado.
> Verificado contra el sistema real antes de escribir esto.

---

## Tarea 1 · Darle acceso de Administrador a José

### Antes de empezar: José YA tiene usuario

**No lo invites.** El sistema va a rechazar la invitación, y con razón.

`sistemaqb@gmail.com` ya está dado de alta desde el **3 de julio**, con rol
**Comercial**, activo. Lo que pasa es que **nunca ha entrado**.

Si intentas invitarlo te va a salir: *"Ese email ya es miembro del equipo. Cambia
su rol en la tabla si hace falta."* Eso no es un error: es el sistema evitando
que quede un usuario duplicado y roto.

### Lo que sí tienes que hacer

1. Entra a **Studio › Usuarios**.
2. Busca la fila de **sistemaqb@gmail.com**.
3. Cámbiale el rol de **Comercial** a **Admin**.

Con eso José queda con **acceso total**: puede invitar y desactivar usuarios,
cambiar roles y ver todos los módulos, incluidos los de dinero.

> Para hacer este cambio **tú tienes que ser Admin**. Si no ves la opción, es que
> tu usuario no tiene el permiso — avísale a Sam.

### ⛔ El paso que NO puedes hacer tú: la contraseña

Acá está el problema, y es del sistema, no tuyo.

**El Studio no tiene "¿olvidaste tu contraseña?".** El propio login lo dice:
*"escríbele a Sam"*. Tampoco hay pantalla para que un usuario se cambie la clave
una vez adentro. O sea: **la contraseña de José sólo la puede poner Sam**, desde
la administración de la base de datos.

**Qué tienes que hacer:** cambiarle el rol (los 3 pasos de arriba) y avisarle a
Sam que le falta la clave a José. Sin eso, José tiene el permiso pero no puede
entrar.

**Cuando Sam te pase la clave**, mándasela a José por un canal privado
(WhatsApp directo, no un grupo). Y avísale que **por ahora no la va a poder
cambiar él mismo** — eso está pendiente de arreglo.

---

## Tarea 2 · Que los clientes tengan su usuario del portal

Hoy hay **364 clientes sin acceso al portal**. No se puede con todos igual,
porque el enlace de acceso **se ata al correo**: sin correo no hay invitación
posible, ni siquiera por WhatsApp.

Se reparten en tres grupos:

| Grupo | Cuántos | Qué hacer |
|---|---|---|
| **A** · tienen correo | **228** | ✅ Invitar **ya**, desde el sistema |
| **B** · sin correo, con WhatsApp | 27 | 📞 Llamarlos, pedirles el correo, cargarlo, y recién ahí invitar |
| **C** · sin correo **ni** WhatsApp | 109 | ⚠️ No hay cómo contactarlos. Ver abajo |

### Paso 1 · Invitar a los 228 que ya se puede (empieza por acá)

1. Entra a **Studio › Administración**.
2. Busca la sección de **invitación al portal**.
3. Selecciona los clientes que tienen correo e invítalos.
4. El sistema les manda un correo con su enlace para entrar y crear su clave.

Se hace **por tandas**, no todos de un golpe — el sistema tiene un tope por
lote a propósito, para que si algo sale mal no se arruinen 228 correos.

> **Aprovecha y arregla uno puntual:** **DTD-9017 · Alain de Cardenas**
> (+58 424 4731021). Ese señor se registró el 15 de julio, recibió su correo, y
> **entró al portal** — pero el sistema no supo reconocerlo porque le faltó el
> vínculo interno. Invitándolo desde esta misma pantalla se arregla.

### Paso 2 · Llamar a los 27 para pedirles el correo

Son clientes que sólo tienen WhatsApp. El guion es simple: se les está
habilitando el portal para que vean sus envíos, y hace falta un correo para
mandarles el acceso.

Con el correo cargado en su ficha, quedan en el grupo A y se invitan igual que
los demás.

### Paso 3 · Reportar los 109 incontactables

Son fichas que vinieron de la importación vieja y **no tienen correo ni
teléfono**. El sistema no puede alcanzarlas por ningún canal.

No inventes datos ni los borres. Haz una lista y pásasela a Sam: hay que decidir
si se completan a mano con lo que haya en papel, o se retiran.

### Paso 4 · Los 4 que se quedaron sin su correo de bienvenida

Estos ya son clientes registrados a los que **el sistema les falló**: nunca
recibieron el correo con su código.

| Cliente | Qué pasó | Qué hacer |
|---|---|---|
| **Johana Matheus** · +58 412 2155899 | nunca le llegó | Reenviar desde **Studio › Mailing › Logs**, botón **Reenviar** |
| **ABDAL AKIL** · 424 6097153 | nunca le llegó | Igual |
| **Jose Diaz** · +58 412 9819792 | nunca le llegó | Igual |
| **Adrián Figueroa** · 424 3745436 | 🔴 **el correo rebotó** | **Llamarlo** y pedirle un correo nuevo. Reenviar al mismo no sirve |

En el caso de Adrián: el correo que tenemos **no existe o está mal escrito**.
Reenviar ahí no sólo no llega — nos daña la reputación de envío y hace que los
correos de los demás empiecen a caer en spam. Por eso el sistema no te va a
dejar reenviárselo.

---

## Resumen de qué depende de quién

| | Tarea | Quién |
|---|---|---|
| 1 | Cambiarle el rol a José → Admin | **Tú** |
| 2 | Ponerle la contraseña a José | **Solo Sam** |
| 3 | Invitar a los 228 al portal | **Tú** |
| 4 | Llamar a los 27 y cargarles el correo | **Tú** |
| 5 | Reenviar los 3 correos atascados | **Tú** |
| 6 | Llamar a Adrián por su correo nuevo | **Tú** |
| 7 | Decidir qué se hace con los 109 | **Sam** |
