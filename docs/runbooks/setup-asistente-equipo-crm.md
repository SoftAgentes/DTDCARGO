# Runbook · Dar de alta a alguien en el asistente del equipo

> **Qué resuelve:** poner a una persona de oficina a usar el asistente de IA del CRM, con
> el contexto de DTD ya cargado y sin que empiece a usarlo mal.
>
> **Cuenta:** `doortudoorservices@gmail.com` (Plan Pro) · **Proyecto:** `DTD Cargo · CRM y Marketing`
>
> **El paquete de contexto** (lo que el asistente sabe) vive en
> [`equipo-crm/`](../../equipo-crm/README.md). Este runbook es cómo se le entrega a una persona.

## Antes de empezar

La cuenta ya está configurada (2026-08-03): memoria activada, entrenamiento de modelos
apagado, instrucciones en los dos niveles, los 7 documentos cargados, 5 skills y los
conectores de Gmail, Drive, Calendar y Canva.

**No hay que repetir nada de eso por cada persona.** Es una sola cuenta compartida.

## Pasos

1. **Verificar que tiene usuario del Studio.** Si lo tiene, entra a `/marca` sin código y
   no hay que repartir claves. Si no, hay que darle el código de acceso desde
   **Studio › Marketing › HUB de marca** (`/studio/marketing/hub`).
2. **Mandarle el mensaje A** (abajo). Por WhatsApp o correo.
3. **La contraseña va por otro canal.** Nunca en el mismo mensaje que el correo — o mejor,
   siéntate con la persona y que la escriba ella.
4. **Pedirle que mande el mensaje B** como primer mensaje dentro del proyecto. Siembra la
   memoria con su nombre y su rol.
5. **Verificar que quedó adentro del proyecto:** que le mande una consulta de prueba y
   confirme que arriba del chat dice `DTD Cargo · CRM y Marketing`.

---

## Mensaje A · para la persona

```
Equipo, les montamos un asistente de IA para el CRM. Ya está configurado con
nuestros servicios, precios, el ERP, la web y las reglas de cómo hablamos.

CÓMO ENTRAR
1. Van a claude.ai y entran con la cuenta de la oficina
   (doortudoorservices@gmail.com — la clave se las paso aparte).
2. En el menú de la izquierda: Proyectos → "DTD Cargo · CRM y Marketing".
3. Escriben ahí adentro.

⚠️ IMPORTANTE: siempre trabajen DENTRO del proyecto. Arriba del chat tiene que
decir "DTD Cargo · CRM y Marketing". Si le dan a "Nuevo chat" en la barra
lateral, se abre uno suelto que no ve nuestros documentos y les va a responder
más flojo.

PARA QUÉ SIRVE
- Armar respuestas de WhatsApp listas para pegar (les pone [corchetes] en lo
  que ustedes deben rellenar).
- Resolver dudas: qué incluye cada servicio, cuánto tarda, qué se puede enviar,
  qué enlace mandarle al cliente.
- Apoyo de marketing: textos, piezas, presentaciones.

TRES REGLAS
1. Lo que les dé es un BORRADOR. Revísenlo antes de mandárselo a un cliente,
   sobre todo si lleva un número, un plazo o una promesa.
2. Los precios NO salen de ahí. Salen de dtdcargo.com/tarifas (o /fcl para
   contenedor completo). Si les da un precio de memoria, está mal.
3. No le peguen datos personales de clientes si no hace falta. Para armar un
   mensaje basta el nombre de pila.

Si no sabe algo, se los va a decir y les va a indicar a quién preguntar
(Operaciones o Comercial). Eso está bien — es preferible a que invente.

MATERIAL DE MARCA (logos, colores, plantillas, fotos):
dtdcargo.com/marca — entran con su usuario del ERP, sin código.
```

## Mensaje B · el primero que ella escribe dentro del proyecto

```
Hola. Soy [nombre] y trabajo en [Comercial / Operaciones / Marketing] de DTD Cargo.
Mi día a día es [atender el CRM de Kommo y WhatsApp / hacer piezas y contenido].
Recuérdalo para las próximas conversaciones.

Para arrancar: dame las 5 preguntas de calificación que le hago a un lead nuevo,
y el mensaje de primer contacto listo para pegar.
```

---

## Cómo verificar que quedó bien

Que mande esta consulta y compare:

```
Un cliente me escribió: "cuánto me sale el DDP de 3 metros cúbicos hasta Maracaibo
y cuándo me llega?". Ármame la respuesta.
```

| Debe pasar | Señal de que algo está mal |
|---|---|
| Dice **"Puerta a Puerta"**, no "DDP" | Repite "DDP" al cliente |
| **No inventa el precio**, manda a `/tarifas` | Suelta un monto |
| Plazo 60-90 días **y aclara que lo define la naviera** | Promete una fecha |
| **Escala** la cobertura de Maracaibo a Operaciones | Afirma que sí llega y a qué precio |
| Tutea (tú tienes / puedes) | Vosea (vos tenés / mirá) |

**Si falla cualquiera de esas, casi siempre es que está fuera del proyecto.** Que revise el
encabezado del chat.

## Cuando alguien se va

- **Quitarle el usuario del Studio** cierra su acceso a `/marca` automáticamente (la sesión
  del ERP es una de las dos llaves).
- **Cambiar la contraseña de la cuenta de Claude**, porque es compartida.
- Si se le había dado el **código de marca**, rotarlo desde el HUB.

## Errores conocidos

- **Trabajar fuera del proyecto.** Es el error #1. Las instrucciones de cuenta sí aplican
  (tuteo, nunca "DDP", precios estimados), pero los 7 documentos no se consultan.
- **Pedirle precios.** No los tiene y no debe tenerlos — cambian. Van de `/tarifas` o `/fcl`.
- **Pegarle datos personales de clientes.** Ver `equipo-crm/05-reglas-y-limites.md`.

## Mantenimiento

Los documentos derivan de fuentes vivas del repo. Si cambia un servicio
(`lib/shared/shipment-public.ts`), un módulo (`lib/studio/modules.ts`), una ruta
(`next.config.ts`) o un guion (`docs/marketing/`), hay que **editar el `.md` en
`equipo-crm/` y volver a subirlo al proyecto**. No se sincroniza solo.

Para reemplazar un documento: en el proyecto, hover sobre la tarjeta → la ✕ lo borra →
`+` › **Agregar contenido de texto** y se pega el nuevo.
