# Runbook · Ficha DTD en Chatwoot (Dashboard App)

SDD-0585, paso 2.4. Explica cómo se registra en el Chatwoot del VPS la Dashboard App que muestra, al lado de cada conversación, la ficha del cliente de Studio.

> **Registrada el 2026-11-19** en el Chatwoot de producción, con el OK de Sam («Sí, regístrala»): cuenta 1, Dashboard App id 1, URL `https://dtdcargo.com/studio/ficha-chat`. La registró el DG. Cualquier cambio o retiro vuelve a necesitar el OK nominal de Sam, como cualquier cambio del VPS.
>
> **Doble marco (SDD-0680).** Dentro de `/studio/bandeja` la ficha queda enmarcada dos veces: `dtdcargo.com` › `chat.dtdcargo.com` › `dtdcargo.com/studio/ficha-chat`. `frame-ancestors` revisa **todos** los ancestros, así que con solo `https://chat.dtdcargo.com` el navegador la bloquea («Framing 'https://dtdcargo.com/' violates … frame-ancestors https://chat.dtdcargo.com») y la pestaña sale en blanco. Desde la SDD-0680 la cabecera de esa ruta es `frame-ancestors 'self' https://chat.dtdcargo.com`. Solo esa ruta: el resto de Studio sigue con `'none'`.

## Qué es

Chatwoot 4.19.1 monta la URL registrada en un `<iframe>` y le pasa el contexto de la conversación por `postMessage`. La página es `https://dtdcargo.com/studio/ficha-chat`, y Studio pinta en ella:
- el Shipping Mark;
- los códigos anteriores;
- los envíos en curso;
- el saldo y el vencido, solo para los roles que ya los ven en la ficha de Studio.

Diseño completo: [SDD-0585 §«Paso 2.4»](../specs/0585-chatwoot-bandeja-studio-e2/spec.md).

## Antes de registrarla

Cada punto tiene su propio OK:

1. **El código en `main`, ya desplegado en el VPS.** Ese despliegue trae la ruta, la cabecera `frame-ancestors 'self' https://chat.dtdcargo.com` (con `'self'` desde la SDD-0680, por el doble marco) y el hueco del proxy.
2. **La 0503 y la 0504 aplicadas** en la base del VPS, según el [runbook de producción](aplicar-migraciones-prod.md).
3. **Las variables `CHATWOOT_URL`, `CHATWOOT_PLATFORM_TOKEN` y `CHATWOOT_ACCOUNT_ID` cargadas** en el contenedor `web`. Es el mismo trío de la Bandeja.
4. **El flag `chatwoot_inbox` encendido** para el tenant.
5. **Cada agente vinculado** a su usuario de Studio, en Studio › Bandeja › Vínculos.

## Registro

1. Entra a `https://chat.dtdcargo.com` con el usuario administrador de la cuenta «DTD Cargo».
2. Ve a **Ajustes → Integraciones → Dashboard apps → Agregar una nueva**.
3. Llena el formulario:
   - **Nombre:** `Ficha DTD`.
   - **URL:** `https://dtdcargo.com/studio/ficha-chat`, sin parámetros. Chatwoot no admite plantillas en la URL y el contexto llega por `postMessage`.
4. Guarda. La pestaña «Ficha DTD» aparece en cada conversación.

## Cómo comprobarla

Hazlo con una conversación de prueba, sin datos reales:

| Caso | Esperado |
|---|---|
| Agente vinculado, con sesión en Studio y conversación con cliente único | El Shipping Mark, los envíos y, si el rol lo ve, el saldo |
| Teléfono del contacto sin cliente, o con más de uno | «Sin ficha» |
| Sin sesión de Studio en ese navegador | «Inicia sesión en Studio», con un enlace que abre otra pestaña |
| Sesión de Studio de otra persona en ese navegador | «Esta sesión de Studio es de otra persona» |
| Abrir `https://dtdcargo.com/studio/ficha-chat` suelta, fuera de Chatwoot | «Abre una conversación», sin datos |
| Dentro de Studio › Bandeja, pestaña «Ficha DTD» | Se ve la ficha; la consola no muestra errores de `frame-ancestors` (SDD-0680) |
| Enmarcarla desde otro sitio | El navegador la bloquea (`frame-ancestors`) |

Los logs de `web` solo tienen que mostrar líneas `[ficha-dtd] …` con códigos de error, nunca un teléfono, un código de cliente ni un nombre.

## Vincular a cliente (SDD-0676)

Sirve para una conversación «Sin ficha» de un canal que no trae teléfono: Instagram, Messenger o TikTok. Quien edita la Bandeja y ve Clientes (Admin y Comercial) ve el botón **Vincular a cliente**.

> **Estado al 2026-11-19.** La corrección de la 0566 está fusionada (#696) y la migración `0566_chatwoot_vincular_canal` está aplicada en producción el 2026-11-19 a las 12:05:23Z, con el OK nominal de Sam «OK, aplica 0566, 0565 y 0562» (md5 `d201a65bdc027b6a364285b7bc286097`, 56403 bytes, cuerpos vivos iguales; evidencia `/srv/ops/evidencias/apply-0566-dtd-cargo-20261119T120522Z`). Datos que me pasó el Director General: el md5 y los bytes los comprobé contra el archivo de `main`; el resto (hora, OK, evidencia) no lo verifiqué yo. **El smoke de abajo todavía no se ha hecho**: está pendiente con Sam. El relleno de las uniones del portal que ya existían tampoco: lleva un OK aparte.

### Cómo se usa

1. Abre la conversación en Chatwoot y la pestaña «Ficha DTD».
2. Oprime **Vincular a cliente** y busca por Shipping Mark, nombre o teléfono (3 caracteres o más).
3. Elige al cliente. La confirmación muestra su código y su nombre: revísalos antes de oprimir **Vincular**.
4. La ficha aparece completa. Desde ahí, cada vez que esa persona escriba por esa red, Studio la reconoce sola.

Si el chat ya estaba unido a otra ficha, la pestaña dice a cuál. Solo se mueve con **Mover aquí** y un motivo escrito.

### Cómo se deshace

En Studio, abre la ficha del cliente › conversaciones › **Canales vinculados** y oprime **Quitar** en ese canal, con un motivo. La tarjeta de lead que tenía ese contacto vuelve a su tablero del CRM, en la etapa donde estaba.

### Cómo comprobarlo

Con una conversación de prueba de Instagram, sin datos reales:

| Caso | Esperado |
|---|---|
| Admin o Comercial en una conversación «Sin ficha» | Botón «Vincular a cliente» |
| Soporte en la misma conversación | «Sin ficha», sin botón |
| Buscar con dos caracteres | «Escribe al menos 3 caracteres.» y ninguna búsqueda |
| Resultado de la búsqueda | Código, nombre y «Teléfono termina en …»; nunca el teléfono entero |
| Vincular | La ficha completa en la misma pestaña |
| El contacto vuelve a escribir | Sigue saliendo su ficha; en el CRM la actividad cae en la tarjeta del cliente, con el logo de la red al lado del suyo |
| La tarjeta de lead que tenía ese contacto | Ya no está en el tablero; su historial se ve en la tarjeta del cliente, en «Antes, como lead de …» |
| Vincular a otro cliente un chat ya unido | Aviso con la ficha actual y «Mover aquí», deshabilitado hasta escribir el motivo |
| Quitar el canal en la ficha del cliente | Las conversaciones de ese contacto vuelven a «Sin ficha» en el momento, sin esperar otro mensaje, y la tarjeta de lead reaparece en su etapa |
| Un mensaje nuevo en una conversación que ya tenía ficha | Nunca la deja «Sin ficha»: solo quitar la unión o borrar la ficha lo hacen |
| El chip «Portal» en la ficha del cliente | Sin botón «Quitar» |
| Auditoría | Cada vincular, mover y quitar deja su fila en `entity_audit_log` (tipo `chatwoot_contact_link`) con quien lo hizo |

Los logs solo muestran `[vincular] …` con códigos, nunca un nombre, un código de cliente ni un teléfono.

Sin la migración aplicada no se rompe nada: la ficha sigue cruzando solo por teléfono, «Vincular» une sin guardar el canal y «Mover aquí» responde que falta la migración.

### Smoke después de aplicar la 0566

Lo hace Sam con su **WhatsApp secundario** y su **Instagram secundario**, y una ficha de prueba propia (no la de un cliente real). Hace falta un usuario Admin o Comercial con su agente de Chatwoot vinculado. Al terminar, todo queda desvinculado.

> **No está ejecutado.** La 0566 ya está aplicada en producción (2026-11-19); falta hacer este smoke con Sam.

**Estado al 2026-11-19.** La 0566 está aplicada en producción, así que lo de abajo debe cumplirse entero. Si algo sale como antes de la migración (la ficha cruza solo por teléfono, «Vincular» une sin guardar el canal ni absorber la tarjeta de lead, o «Mover aquí» responde que falta la migración), el web o la base no están donde se cree: no repitas el paso y avisa al Director General.

**Orden (ya pasado).** El web de la corrección debía estar publicado antes de aplicar la 0566; en producción pasó al revés: El web de la #696 **no** estaba publicado antes del apply: la publicación anterior fue `f0169eed9` a las 10:56Z y la #696 entró a las 10:58Z. Quedó migrate-first (la base nueva con el web anterior) y el web con la #696 se publicó después, en `a30e7ca38`. Dato del Director General; no lo medí yo. Si el web anterior corrió esa ventana con la 0566 aplicada, pudo escribir segmento y Shipping Mark al contacto del portal en Chatwoot (solo con `CHATWOOT_ATRIBUTOS_CONTACTO=1`) y mostrar «Quitar» en su chip. No está medido: antes del smoke conviene mirar los contactos del portal en Chatwoot.

**Dónde hacerlo.** Sam ofreció dos lugares; los pasos A a D son los mismos en los dos.

| Camino | Cómo | Qué tener en cuenta |
|---|---|---|
| 1. Entorno de prueba, antes de producción | Ensayar la 0566 según [entorno-prueba.md](entorno-prueba.md), §4: base igual a `main`, aplicar la migración del head, smoke con la app anterior y después con la nueva. La evidencia vale para un SHA | NO VERIFICADO: que el entorno de prueba tenga un Chatwoot con el WhatsApp y el Instagram secundarios conectados. Si no los tiene, ahí se ensaya el apply y lo que se ve en Studio, y los pasos con chats reales (A, B y C) se hacen por el camino 2 |
| 2. Producción, directo | Con la 0566 ya aplicada en producción con su OK nominal, hacer A a D con una ficha de prueba | Se deja todo desvinculado al terminar, con «Quitar» (abajo). No se borran filas |

**Antes de empezar.** Anota el Shipping Mark de la ficha de prueba. Si el teléfono del WhatsApp secundario está en alguna ficha, Studio lo reconoce por teléfono y no ofrece «Vincular a cliente»: para la parte B usa un número que no esté en ninguna ficha, o sáltala.

**A. Instagram**

| Paso | Qué haces | Qué debes ver |
|---|---|---|
| A1 | Desde el Instagram secundario, escribe a la cuenta de DTD | Entra una conversación nueva en Chatwoot |
| A2 | Ábrela y entra a la pestaña «Ficha DTD» | «Sin ficha» y el botón **Vincular a cliente** |
| A3 | Busca la ficha de prueba por su Shipping Mark, elígela y oprime **Vincular** | La ficha completa en la misma pestaña |
| A4 | En Studio, ficha del cliente › conversaciones › **Canales vinculados** | Un chip «Instagram · unido a mano», con «Quitar» |
| A5 | En el CRM, busca la tarjeta del cliente | Lleva el logo de Instagram; la tarjeta de lead de ese Instagram ya no está en el tablero y su historial sale en «Antes, como lead de Instagram» |
| A6 | Escribe otra vez desde el Instagram secundario | La Ficha DTD sigue mostrando la ficha de prueba |

**B. WhatsApp**

| Paso | Qué haces | Qué debes ver |
|---|---|---|
| B1 | Desde el WhatsApp secundario, escribe al número de DTD | Conversación nueva; la Ficha DTD dice «Sin ficha» con el botón |
| B2 | Vincúlala a la **misma** ficha de prueba | La ficha completa |
| B3 | Ficha del cliente › **Canales vinculados** | Dos chips: Instagram y WhatsApp |
| B4 | CRM, tarjeta del cliente | Una sola tarjeta, con los dos logos |

**C. Quitar**

| Paso | Qué haces | Qué debes ver |
|---|---|---|
| C1 | En la ficha del cliente, **Quitar** en el chip de Instagram, con un motivo | El chip desaparece |
| C2 | Recarga la pestaña «Ficha DTD» de la conversación de Instagram, **sin** escribir otro mensaje | «Sin ficha» otra vez |
| C3 | CRM | La tarjeta de lead de Instagram volvió a su tablero, en la etapa donde estaba |
| C4 | Escribe otra vez desde Instagram | Sigue «Sin ficha»: nada la vuelve a unir sola |
| C5 | Repite C1 con el chip de WhatsApp | La conversación de WhatsApp vuelve a «Sin ficha» |

**D. El chat del portal (lo que cubre la corrección de la 0566)**

| Paso | Qué haces | Qué debes ver |
|---|---|---|
| D1 | En Chatwoot, abre una conversación del portal de un cliente y mira la «Ficha DTD» | La ficha de ese cliente |
| D2 | Responde desde Chatwoot, o entra como ese cliente al portal y escribe | El mensaje llega |
| D3 | Recarga la «Ficha DTD» de esa conversación | **Sigue** mostrando la ficha del cliente. Si dijera «Sin ficha», para y avisa: es el fallo que esta corrección evita |
| D4 | Desde otra ficha, «Vincular otra red» con el número de esa conversación del portal | Solo si ese contacto ya tiene su unión del portal: «El chat del portal es de la ficha de su cliente: no se desvincula ni se mueve.» |

El chip «Portal» aparece en la ficha de un cliente cuando escribe por el portal después de la 0566, o después de correr el relleno (`supabase/cargas/portal-uniones-0566/`, con OK aparte). En ese chip no hay «Quitar».

**Limpieza al terminar (sin borrar filas).** Vale para los dos caminos; en producción es la única forma prevista.

1. Ficha del cliente de prueba › conversaciones › **Canales vinculados**: oprime **Quitar** en cada chip, con un motivo como «Fin de la prueba». Es el paso C.
2. Comprueba que la lista de canales quedó vacía y que las dos conversaciones dicen «Sin ficha».
3. En Chatwoot, marca las dos conversaciones como resueltas.

Lo que **queda** y no se borra: las conversaciones de prueba en Chatwoot, la tarjeta de lead de cada chat en el CRM (de vuelta en su tablero) y las filas de auditoría de vincular y quitar, que son el rastro de la prueba. Borrar cualquiera de esas filas en producción es un borrado permanente: lo corre Sam o requiere su OK nominal, y no forma parte de este smoke.

**Auditoría.** Cada vincular, mover y quitar deja su fila en `entity_audit_log` (tipo `chatwoot_contact_link`); la de quitar dice cuántas conversaciones quedaron sin ficha. Contarlas en producción es una lectura que pide su propia autorización.

**Si algo no sale como dice la tabla:** no repitas el paso. Anota el paso y lo que viste, y avisa al Director General. El desarme (`supabase/desarmes/`, archivo `0566_desarme`) exige otro OK nominal.

## Cómo retirarla

En **Ajustes → Integraciones → Dashboard apps**, borra «Ficha DTD». Studio no guarda nada propio de la app, así que no hay datos que limpiar.
