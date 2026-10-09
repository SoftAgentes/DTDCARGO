# Inventario de terceros — DTD Cargo

> Punto 8 de [`AUDITORIA-2026-07.md`](AUDITORIA-2026-07.md). Levantado desde el
> código, julio 2026. **Documento vivo:** se actualiza cada vez que se conecta un
> proveedor nuevo.
>
> Antes de conectar uno más, llenar
> [`evaluacion-proveedores.md`](../../../.claude/skills/revisar-datos-ve/references/plantillas/evaluacion-proveedores.md).

**Por qué importa acá y no en Chile o Europa.** Venezuela no tiene la figura legal
del "encargado del tratamiento": no hay un régimen administrativo que reparta
responsabilidades. Lo que hay es la **Ley Especial contra los Delitos
Informáticos**, cuyos arts. 20 a 22 tipifican la obtención y la revelación
indebida de data personal con **prisión de dos a seis años**, aumentada de ⅓ a ½
con fin de lucro. Es responsabilidad **penal de personas**. El contrato con cada
tercero no es papeleo: es lo único que delimita quién responde.

---

## 1 · Los que reciben datos personales

| Proveedor | Qué recibe | País | Contrato | Evidencia |
|---|---|---|---|---|
| **Supabase** | **Todo**: tablas con campos de persona y buckets (documentos de identidad, comprobantes, POD, audio) | EE. UU. · `us-east-1`, verificado en Cloud 2026-09-04 | ❓ contrato, subprocesadores y retención | `lib/db/server.ts` |
| **Vercel** | Hosting y logs de request: IP, user-agent, rutas | EE.UU. | ❓ | `next.config.ts` |
| **Resend** | Nombre y correo del destinatario + cuerpo del mensaje (bienvenida, estimados, facturas) | EE.UU. | ❓ | `lib/studio/mail/resend-api.ts` |
| **Cloudflare Workers AI** | 🔴 **El audio completo de las reuniones**, en base64, para transcribir con Whisper | EE.UU. / red global | ❓ | [`lib/studio/bitacora/transcribe.ts:61`](../../../lib/studio/bitacora/transcribe.ts) |
| **Anthropic** | Contenido de reuniones y de conversaciones con clientes, para extraer actas y resúmenes | EE.UU. | ❓ | `lib/studio/bitacora/extract.ts` · `lib/studio/agents/runtime/llm-client-anthropic.ts` |
| **OpenRouter** | Ídem, como ruta alternativa de modelo | EE.UU. | ❓ | `lib/studio/agents/runtime/llm-client-factory.ts` |
| **Kommo** | Espejo de contactos y leads: nombre, correo, teléfono | ❓ | ❓ | `kommo_contacts`, `kommo_leads`, `kommo_users` (`0082`, `0139`) |
| **Nominatim / OpenStreetMap** | 🔴 **La dirección del cliente**, en texto, para geocodificar | Alemania (Fundación OSM) | ❌ **ninguno** | [`lib/studio/geocoding.ts:10`](../../../lib/studio/geocoding.ts) |
| **Telegram** | Notificaciones al equipo; el cuerpo puede llevar nombre de cliente y código de envío | ❓ | ❓ | `lib/studio/telegram/send-message.ts` · `lib/studio/notify/send-user-telegram.ts` |
| **AWS — seleccionado, no conectado** | Todavía no recibe datos; recibiría bytes de adjuntos, UUID y metadata técnica mínima para scan y respaldo | EE.UU. · `us-east-1` | DPA publicado; cuenta/aceptación **NO VERIFICABLES** | [`evaluacion-proveedor-respaldo-externo.md`](evaluacion-proveedor-respaldo-externo.md) · [`aws-adjuntos-expediente-contractual.md`](aws-adjuntos-expediente-contractual.md) |
| **Contabo GmbH — contratado, todavía sin datos** | Recibiría **todo** lo que hoy tiene Supabase (base y Storage) desde el ensayo de la Fase 2 del traslado; hoy solo aloja el proxy y un servicio de prueba | Empresa en Alemania · servidor en EE. UU. (US East, Carlstadt NJ) · subencargado Contabo Inc. (St. Louis) | DPA (art. 28 RGPD) **concluido por el portal el 2026-10-09**, con cláusulas tipo de la UE módulo 3 hacia Contabo Inc.; leído el mismo día: brechas «sin demora indebida», borrado al terminar incluidos los respaldos. **Anexo 1 por corregir** (solo cubre «Users» como personas afectadas); revisión del abogado pendiente | [`revision-traslado-contabo-2026-10-09.md`](revision-traslado-contabo-2026-10-09.md) H3 · [`servidor-contabo.md`](../../runbooks/servidor-contabo.md) |
| **Equipo propio en Yiwu (China)** | Regla propuesta: Shipping Mark y datos de mercancía; cero fotos de identidad. El ACL actual de `client-docs` no demuestra separación regional | 🇨🇳 China | Relación laboral; mecanismo PIPL y consentimiento separado pendientes si se habilita una excepción | 🔴 **PIPL aplica**; gate regional NO IMPLEMENTADO — ver [`fotos-identidad-cliente-v1.md`](fotos-identidad-cliente-v1.md) |

## 2 · Los que NO reciben datos personales (verificado)

| Proveedor | Por qué no |
|---|---|
| **Google Analytics 4 / Google Ads** | Excluido de rutas privadas y puertas de acceso mediante `PRIVATE_PREFIXES` + `isPrivatePath()`. `isAnalyticsExcludedUrl()` apaga ambos tags ante query no aprobada o credenciales en el fragmento; el guard de History activa `ga-disable-*` antes de una navegación cliente sensible. Defensa adicional: `sanitizePath()` + allowlist de atribución. Verificado en [`components/Analytics.tsx`](../../../components/Analytics.tsx) y sus pruebas sintéticas. |
| **SeaRates** | Códigos de contenedor y BL, tarifas. No lleva datos de persona. `lib/shared/ocean-rate.ts` · `lib/studio/naviera-tracking/` |
| **WhatsApp (wa.me)** | Solo son enlaces `wa.me` que abren la app del usuario. DTD no envía nada por API |

**Límite de la evidencia de Google (SDD-0371, 2026-09-05):** el título de esta
sección no certifica ausencia de datos personales en el proveedor. Se reprodujo
en la PR #24 una credencial anidada que atravesaba el filtro al mezclar escapes
válidos y porcentajes malformados. La remediación inspecciona esos escapes sin
devolverlos como texto seguro por un error de decodificación y elimina valores
sensibles de `sanitizeSearch()`. Pruebas sintéticas cubren los nueve parámetros
de atribución, carga inicial, navegación y helpers; el navegador usa el módulo
real `next/script`, adaptador de navegación y respuesta inerte interceptada.
No se enviaron datos a Google. Retención, contratos, configuración interna y
comportamiento del proveedor real siguen **NO VERIFICABLES** en esta revisión.
Evidencia acotada por archivo/línea en el
[handoff](../../../.agents/handoffs/pr24-analytics-remediation-20260905.md).

---

## 3 · Los tres que hay que resolver primero

### 🔴 Nominatim — dirección de cliente a un tercero sin contrato

Es el caso de libro del "proveedor que nadie contó": un servicio **gratuito** al
que se le manda un dato personal —**el domicilio de una persona**— sin acuerdo,
sin evaluación y sin figurar en la política de privacidad.

Opciones, por costo creciente: (a) dejar de geocodificar automático y hacerlo a
mano cuando haga falta; (b) seudonimizar antes —mandar solo calle y ciudad, sin
número ni referencia—; (c) contratar un geocodificador con acuerdo de datos.

### 🔴 Cloudflare Workers AI — audio de reuniones

El audio de una reunión es de las cosas más sensibles que se pueden mandar: lleva
**voz** (biométrico bajo PIPL art. 28) y todo lo que se dijo, incluidos datos de
clientes y del equipo que nadie revisó antes de subir.

Hay que responder tres cosas: quién queda grabado y si lo sabe · qué dice la
política de Cloudflare sobre uso y retención del audio que procesa · cuánto tiempo
vive el archivo en el bucket `bitacora` (hoy: **para siempre**, ver H-4).

### 🟠 Supabase — región verificada; contrato y retención pendientes

Toda la PII del negocio está ahí. El proyecto DTD Cargo reportó región
`us-east-1` en Cloud el 2026-09-04. El contrato, subprocesadores, retención y
disposición de copias siguen `NO VERIFICABLES`; el alojamiento en EE. UU. debe
evaluarse y declararse aparte de cualquier acceso operativo VE-China.

---

## 4 · Lo que falta para cerrar el punto 8

Por cada proveedor de la tabla 1, conseguir y archivar:

- [ ] Contrato o acuerdo de datos firmado, con fecha.
- [ ] Cita textual de su política sobre **uso propio de los datos** y
      **compartición con terceros** (con fecha y enlace — las políticas cambian).
- [ ] Si permite **subcontratar** y bajo qué condiciones.
- [ ] Qué pasa **al terminar** el servicio: ¿suprime o devuelve?
- [ ] País de procesamiento y si se puede elegir región.
- [ ] Cómo y en cuánto tiempo **nos avisa a nosotros** de una brecha.

**Y una casilla aparte, que no es un proveedor de software:**

- [ ] **Transportistas terceros con credenciales del ERP.** Un camionero externo
      con PIN en `operario_pins` fotografía cédulas y rostros de clientes de DTD.
      Es la relación de mayor exposición penal del inventario y **no tiene ningún
      documento que la regule**.

---

*Documento interno. No es asesoría legal — los contratos los revisa un abogado.*
