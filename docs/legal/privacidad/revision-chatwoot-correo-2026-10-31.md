# Revisión de datos personales · Correo de `vzla@` en Chatwoot (E4 · 4.8) · 2026-10-31

> Skill `revisar-datos-ve`, puerta **PC-2** del paso 4.8 del programa [SDD-0582](../../specs/0582-chatwoot-piloto/checklist.md). Diseño: [`e4-correo.md`](../../specs/0582-chatwoot-piloto/e4-correo.md).
> **Alcance:** solo lo que agrega conectar el buzón `vzla@` (con su alias `info@`) a Chatwoot por IMAP y SMTP, opción B elegida por Sam. Lo general de Chatwoot está en la [revisión E1](revision-chatwoot-e1-2026-10-29.md) y no se repite.
> **Evidencia:**
> - Código de la imagen `v4.19.1-ce`, leído dentro del contenedor.
> - Prueba PC-1 sobre una bandeja temporal en `notificaciones@` (§6.1 del diseño), leída solo con conteos, horas y dominios. No se leyó el buzón `vzla@`.
> **Esto no es asesoría legal.** Es un inventario técnico y una lista de preguntas para el abogado.

## 1 · Resumen

| Estado | Puntos |
|---|---|
| `ENCONTRADO`, para resolver antes o durante PC-3 | 5 (H1–H5) |
| `CORRECTO` | 5 |
| `NO VERIFICABLE` | 4 |

Marcos: **Venezuela** (CRBV arts. 28 y 60; Ley Especial contra los Delitos Informáticos, arts. 20–22). La **PIPL** aplica si alguien que lee la bandeja trabaja desde China (N1 de E1, sigue abierto).

## 2 · Inventario: lo que entra a Chatwoot por cada correo de `vzla@`

| Dónde queda | Qué es | Finalidad | Retención | Quién más lo ve |
|---|---|---|---|---|
| `contacts.email`, `contacts.name` | dirección y nombre del **remitente**, sea cliente o no | responderle | no definida (H7 de E1) | miembros de la bandeja |
| `messages.content` y `content_attributes.email.text_content` / `html_content` | cuerpo del correo, **con el hilo citado** | la conversación | no definida | miembros de la bandeja; respaldos 30 días |
| `content_attributes.email.from`, `to`, `cc`, `bcc`, `subject`, `headers`, `references` (`app/presenters/mail_presenter.rb:91-110`) | direcciones de **terceros en copia** y encabezados | armar el hilo | no definida | miembros de la bandeja |
| `attachments` + `/app/storage` | **todos los adjuntos** (facturas, estados de cuenta, documentos) | la conversación | no definida | miembros; respaldos cifrados |
| `channel_email.imap_password`, `smtp_password` | clave de `vzla@` | entrar al buzón | mientras exista la bandeja | nadie: columna cifrada (C2 de E1) |

**Titulares que no son usuarios (punto 12):** son la mayoría.
- Remitentes de bancos y proveedores.
- Plataformas como Alibaba, porque `info@` es la dirección que la guía pone en el almacén de China (`lib/faqs.ts:235`).
- Personas en copia.
- Personas citadas en hilos viejos.
- Prospectos de los 4 avisos internos del ERP (`lib/studio/contact-lead-notify.ts:49`, `estimado-lead-notify.ts:64`, `packing-list-notify.ts:61`, `portal/sin-acceso-aviso.ts:120`).

## 3 · Hallazgos

**H1 · Chatwoot copia todo `vzla@`, no solo lo de clientes — ENCONTRADO (minimización).**
- **El problema:** IMAP busca en `INBOX` sin filtrar por destinatario (`base_fetch_email_service.rb`, `fetch_available_mail_sequence_numbers`). Con la opción B, cada correo de banco, proveedor o plataforma queda copiado en Chatwoot, con sus adjuntos.
- **Lo que hace la regla «no-cliente» de §4.1:** saca esas conversaciones de la cola, pero **no las borra**; el dato sigue en la base y en los respaldos. El principio de proporcionalidad (CRBV art. 28, como lo lee la jurisprudencia de la Sala Constitucional) pide no tratar más de lo necesario.
- **Arreglo concreto, en este orden:**
  1. reglas que resuelven (diseño §4.1);
  2. un plazo corto de borrado para lo etiquetado «no-cliente» o «sistema», dentro de H7 de E1;
  3. si el volumen de terceros resulta alto en la primera semana, pasar a la **opción A**: `info@` como buzón propio.
- **Decide Sam** con el abogado el plazo de borrado.

**H2 · Las reglas no tocan rebotes ni respuestas automáticas — ENCONTRADO (medido en PC-1).**
- **El problema:** `AutomationRuleListener` ignora las conversaciones y los mensajes con `auto_reply`. Medido: el rebote de prueba quedó abierto, sin etiqueta, en su propia conversación (P4).
- **Por qué importa:** los rebotes citan el correo original completo, así que duplican datos del cliente en una conversación que nadie mira.
- **Arreglo:**
  - resolverlos y borrarlos con una tarea periódica de DTD por la API, con conteo antes y después;
  - o que el agente los resuelva a mano mientras sean pocos.
- Decisión 6 del diseño (§8).

**H3 · Direcciones en copia y hilos citados — ENCONTRADO (punto 12).**
- **El problema:** `cc`, `bcc` y el texto citado guardan datos de personas que nunca escribieron a DTD.
- **Por qué no se puede evitar:** es inherente al correo; no hay opción para no guardarlos.
- **Arreglo:**
  - declararlo en `/privacidad` junto con el punto 1 de §5 de la revisión E1;
  - aplicarle el mismo plazo de borrado.

**H4 · Los avisos del ERP con datos de prospectos se duplican en Chatwoot — ENCONTRADO.**
- **El problema:** los 4 avisos a `info@` llevan nombre, contacto y detalle del prospecto. Con la opción B quedan una vez más en Chatwoot, además del ERP y del webmail.
- **Arreglo:** PC-4. Mandarlos a los admins y no a `info@` (cambio de código con su PR). Mientras tanto, la regla «sistema» los resuelve, con el límite de H1.

**H5 · El canal legal necesita un responsable, no solo una etiqueta — ENCONTRADO (medido en PC-1).**
- **Lo que pasa hoy:** los asuntos «Privacidad» y «Gerencia» tienen plazos (`lib/legal-public.ts:73` y `:77`). En la prueba, la regla le puso la etiqueta y prioridad urgente en 6 s (P8), pero **no asignó a nadie**.
- **Arreglo en PC-3:** la regla real agrega `assign_agent` (o `assign_team`) con la persona que Sam nombre, para que el plazo de los derechos ARCO tenga dueño.

## 4 · Correcto

- **C1 · El buzón queda intacto.**
  - Chatwoot lee con `BODY.PEEK` y no marca ni borra.
  - Medido en P5: lo que trajo sigue sin leer en el webmail.
- **C2 · Sin histórico.**
  - Solo entra lo recibido desde el día anterior a la conexión (`Time.zone.today - 1`, `base_fetch_email_service.rb:160`).
  - El archivo viejo de `vzla@` no se copia, salvo que alguien corra la recuperación con más días a propósito.
- **C3 · Clave cifrada y fuera del `.env`.**
  - La clave de `vzla@` vive en columnas cifradas.
  - El guion de prueba la toma del entorno sin imprimirla (`infra/chatwoot/correo/bandeja-prueba.rb`).
- **C4 · Logs sin direcciones.**
  - El filtro de E1 (`zz_dtd_redaccion_logs.rb`) también tapa el buzón en los logs de IMAP.
  - Medido en PC-1: las líneas dicen `IMAP connection established for [correo]`.
- **C5 · Sin terceros nuevos.**
  - El correo ya lo trata Hostinger, y Chatwoot corre en el VPS propio.
  - Lo único nuevo es que el contenido del buzón pasa a la base de Chatwoot y a sus respaldos cifrados en Backblaze.
  - Cloudflare ve el panel (H9 de E1, aceptado por Sam).

## 5 · No verificable

- **N1 · Volumen y mezcla de `vzla@`.** Cuántos correos son de clientes y cuántos de terceros. Se mide la primera semana de PC-3, por dominio y sin guardar direcciones.
- **N2 · Imágenes remotas.** La vista usa `vue-letter` con `lettersanitizer` (`components-next/message/bubbles/Email/Index.vue:3-5`). No se comprobó si carga imágenes remotas al abrir un correo; si lo hace, un píxel de rastreo le daría al remitente la IP del agente y la hora. Se prueba en PC-3 con un correo propio que traiga una imagen remota.
- **N3 · Quién lee `vzla@` hoy.** Define los miembros de la bandeja (decisión 3 del diseño).
- **N4 · Respuesta automática en `vzla@`.** Si hay una encendida, le contesta a cada cliente que escriba. Lo confirma Sam antes de PC-3.

## 6 · `/privacidad` e inventario

- **`/privacidad`:** el punto 1 de §5 de la revisión E1 («DTD atiende por … correo con una herramienta propia») ya cubre el correo. Hay que sumar H3: el correo puede guardar a otras personas que vengan en copia o citadas.
- **Inventario de terceros:** fila nueva en §2 bis (IMAP y SMTP de Hostinger hacia Chatwoot).

---

Este reporte no es asesoría legal. Se sugiere que otro modelo revise el mismo alcance: un modelo no encuentra sus propios puntos ciegos.
