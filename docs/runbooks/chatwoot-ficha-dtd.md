# Runbook · Ficha DTD en Chatwoot (Dashboard App)

SDD-0585, paso 2.4. Explica cómo se registra en el Chatwoot del VPS la Dashboard App que muestra, al lado de cada conversación, la ficha del cliente de Studio.

> **No está ejecutado.** Registrar la app cambia la configuración del Chatwoot de producción. Hace falta el OK nominal de Sam, como cualquier cambio del VPS.

## Qué es

Chatwoot 4.19.1 monta la URL registrada en un `<iframe>` y le pasa el contexto de la conversación por `postMessage`. La página es `https://dtdcargo.com/studio/ficha-chat`, y Studio pinta en ella:
- el Shipping Mark;
- los códigos anteriores;
- los envíos en curso;
- el saldo y el vencido, solo para los roles que ya los ven en la ficha de Studio.

Diseño completo: [SDD-0585 §«Paso 2.4»](../specs/0585-chatwoot-bandeja-studio-e2/spec.md).

## Antes de registrarla

Cada punto tiene su propio OK:

1. **El código en `main`, ya desplegado en el VPS.** Ese despliegue trae la ruta, la cabecera `frame-ancestors https://chat.dtdcargo.com` y el hueco del proxy.
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
| Enmarcarla desde otro sitio | El navegador la bloquea (`frame-ancestors`) |

Los logs de `web` solo tienen que mostrar líneas `[ficha-dtd] …` con códigos de error, nunca un teléfono, un código de cliente ni un nombre.

## Vincular a cliente (SDD-0676)

Sirve para una conversación «Sin ficha» de un canal que no trae teléfono: Instagram, Messenger o TikTok. Quien edita la Bandeja y ve Clientes (Admin y Comercial) ve el botón **Vincular a cliente**.

> **No está ejecutado en producción.** Pide la PR fusionada, la migración `0566_chatwoot_vincular_canal` aplicada según el [runbook de producción](aplicar-migraciones-prod.md) y el web desplegado, cada cosa con el OK nominal de Sam.

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
| Quitar el canal en la ficha del cliente | La conversación vuelve a «Sin ficha» y la tarjeta de lead reaparece en su etapa |
| Auditoría | Cada vincular, mover y quitar deja su fila en `entity_audit_log` (tipo `chatwoot_contact_link`) con quien lo hizo |

Los logs solo muestran `[vincular] …` con códigos, nunca un nombre, un código de cliente ni un teléfono.

Sin la migración aplicada no se rompe nada: la ficha sigue cruzando solo por teléfono, «Vincular» une sin guardar el canal y «Mover aquí» responde que falta la migración.

## Cómo retirarla

En **Ajustes → Integraciones → Dashboard apps**, borra «Ficha DTD». Studio no guarda nada propio de la app, así que no hay datos que limpiar.
