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

## Cómo retirarla

En **Ajustes → Integraciones → Dashboard apps**, borra «Ficha DTD». Studio no guarda nada propio de la app, así que no hay datos que limpiar.
