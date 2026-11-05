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

> ⚠️ **Nota del 2026-10-19 · la tabla es anterior al traslado.** Desde el corte
> del 2026-10-14 (02:00Z), la base y el Storage de producción viven en el
> servidor propio de Contabo (fila «Contabo GmbH»), y desde el 2026-10-16 la web
> también; Vercel está en pausa. Supabase Cloud guarda la copia del momento del
> corte hasta su pausa (2026-10-28) y su borrado posterior, que pide otro OK de
> Sam; Vercel conserva sus logs hasta el retiro. Las filas de Supabase, Vercel y
> Contabo no se reescriben en esta nota: su actualización es el hallazgo H14 de
> [`revision-traslado-contabo-2026-10-09.md`](revision-traslado-contabo-2026-10-09.md),
> pendiente. Fuente del corte: [`servidor-contabo.md`](../../runbooks/servidor-contabo.md) §3.6.

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
| **Contabo GmbH — contratado, todavía sin datos** | Recibiría **todo** lo que hoy tiene Supabase (base y Storage) desde el ensayo de la Fase 2 del traslado; hoy solo aloja el proxy y un servicio de prueba | Empresa en Alemania · servidor en EE. UU. (US East, Carlstadt NJ) · subencargado Contabo Inc. (St. Louis) | DPA (art. 28 RGPD) **concluido por el portal el 2026-10-09**, con cláusulas tipo de la UE módulo 3 hacia Contabo Inc.; leído el mismo día: brechas «sin demora indebida», borrado al terminar incluidos los respaldos. anexo 1 **corregido** el mismo día (cubre todas las categorías de personas; de las especiales solo «biométricos»); revisión del abogado hecha según Sam (2026-10-09) | [`revision-traslado-contabo-2026-10-09.md`](revision-traslado-contabo-2026-10-09.md) H3 · [`servidor-contabo.md`](../../runbooks/servidor-contabo.md) |
| **Backblaze (B2) — contratado el 2026-10-12, todavía sin datos reales** | Recibirá los respaldos diarios de la base (dump completo, con todos los campos de persona) y de la configuración del servidor, **cifrados con `age` antes de salir del VPS**: Backblaze solo guarda archivos ilegibles; la clave privada la tiene solo Sam, fuera del servidor. Retención 30 días con borrado real (`hard_delete`). La clave del servidor solo alcanza el bucket `dtdcargo-respaldos` | EE. UU. · región `us-east-005`, medida por la API el 2026-10-13 | ❓ DPA de Backblaze: no se ha leído ni archivado | `infra/ops/backup/set-remote.sh` · `infra/ops/tests/prueba-respaldo-b2.sh` (12 PASÓ contra el bucket real, 2026-10-13) · [`revision-traslado-contabo-2026-10-09.md`](revision-traslado-contabo-2026-10-09.md) H3 y H7 |
| **Equipo propio en Yiwu (China)** | Regla propuesta: Shipping Mark y datos de mercancía; cero fotos de identidad. El ACL actual de `client-docs` no demuestra separación regional | 🇨🇳 China | Relación laboral; mecanismo PIPL y consentimiento separado pendientes si se habilita una excepción | 🔴 **PIPL aplica**; gate regional NO IMPLEMENTADO — ver [`fotos-identidad-cliente-v1.md`](fotos-identidad-cliente-v1.md) |

## 2 · Los que NO reciben datos personales (verificado)

| Proveedor | Por qué no |
|---|---|
| **Google Analytics 4 / Google Ads** | Excluido de rutas privadas y puertas de acceso mediante `PRIVATE_PREFIXES` + `isPrivatePath()`. `isAnalyticsExcludedUrl()` apaga ambos tags ante query no aprobada o credenciales en el fragmento; el guard de History activa `ga-disable-*` antes de una navegación cliente sensible. Defensa adicional: `sanitizePath()` + allowlist de atribución. Verificado en [`components/Analytics.tsx`](../../../components/Analytics.tsx) y sus pruebas sintéticas. |
| **SeaRates** | Códigos de contenedor y BL, tarifas. No lleva datos de persona. `lib/shared/ocean-rate.ts` · `lib/studio/naviera-tracking/` |
| **WhatsApp (wa.me)** | Solo son enlaces `wa.me` que abren la app del usuario. DTD no envía nada por API |
| **Z.AI (GLM) — «Analizar con IA», SDD-0588 paso 3.4, todavía sin llave en el servidor** | Solo código: el diff **público** de `chatwoot/chatwoot` entre dos versiones y la superficie propia de DTD (initializers y compose de `infra/chatwoot`, índice de rutas de `lib/studio/chatwoot`). Nunca datos de clientes, `.env*`, `secretos/` ni valores de variables: `rutaExcluida` y `pareceSecreto` lo cortan antes de armar el paquete, con prueba negativa. La llave es propia de Studio (`DTD_CHATWOOT_IA_GLM_KEY`); sin ella el informe sale «sin IA». Usar la llave real es una puerta con OK de Sam. `lib/studio/chatwoot/analisis.ts` · `analisis-superficie.ts` · `__tests__/analisis*.test.ts` |

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

## 2 bis · Chatwoot (SDD-0583, en preparación, 2026-10-29)

Chatwoot CE corre en el mismo servidor de Contabo (fila de arriba): **no es un tercero**, es software propio. Lo que sí hay que contar son las salidas de Chatwoot hacia afuera. Revisión completa: [`revision-chatwoot-e1-2026-10-29.md`](revision-chatwoot-e1-2026-10-29.md). Al escribir esta sección no tenía datos reales; desde el 2026-10-31 entran clientes por Instagram.

| Destino | Qué recibiría | Estado en `infra/chatwoot/compose.yml` | Evidencia |
|---|---|---|---|
| `hub.2.chatwoot.com` (Chatwoot Inc., EE. UU.) | consulta de versión: id de instalación, versión, host y edición. Sin telemetría: **no** conteos de conversaciones ni mensajes | `DISABLE_TELEMETRY=true` | `lib/chatwoot_hub.rb:59-67` y `:88` (imagen 4.19.1) |
| Relay de push del mismo hub | título y cuerpo de cada notificación a la app móvil | **apagado** (`ENABLE_PUSH_RELAY_SERVER=false`) | `push_notification_service.rb:115` |
| Gravatar (Automattic, EE. UU.) | MD5 del correo de cada contacto | **apagado** (`DISABLE_GRAVATAR=true`) | `avatar_from_gravatar_job.rb:5-9` |
| MaxMind | descarga de base de geolocalización por IP | **no se usa** (sin `IP_LOOKUP_API_KEY`) | `app/services/geocoder/setup_service.rb:7-10` |
| Hostinger (SMTP) | correos de aviso a los agentes; pueden llevar nombre del contacto y extracto del mensaje | activo; reducir en E2.7 (H8) | `config/initializers/mailer.rb` |
| Cloudflare | **todo el tráfico del panel en claro** (conversaciones y adjuntos), como ya pasa con la web y Supabase de DTD | **activo**: `chat.dtdcargo.com` va con proxy desde el 2026-10-29, por decisión de Sam (sin proxy, el VPS no deja entrar: solo acepta tráfico web de Cloudflare). Falta la fila de Cloudflare en la tabla 1 para todo DTD | runbook `chatwoot-servidor.md` §4 · revisión E1 H9 |
| Backblaze (B2) | respaldos de Chatwoot **cifrados con `age`** (base, adjuntos y claves) | prefijo `chatwoot/`, 30 días | `infra/chatwoot/respaldo.sh` |
| Meta (WhatsApp e Instagram; Messenger pendiente) | las conversaciones de esos canales. De Instagram, además, lo que Meta entrega del perfil de quien escribe: nombre, usuario, un código de la cuenta, foto, seguidores y si sigue a la cuenta | **Instagram, activo:** `@dtdcargo.ve` (bandeja 5) recibe clientes reales desde el 2026-10-31; Sam, por el Director General, el 2026-11-05: «Dejarlo conectado». **WhatsApp, activo** en las bandejas 1 y 2; el número principal sigue en 4.5. **Messenger, pendiente:** bandeja 4 creada el 2026-10-31, sin entrantes al 2026-11-05 | `app/services/instagram/message_text.rb:10` y `webhooks_base_service.rb:26` (imagen 4.19.1); conteos por bandeja del 2026-11-05 (SDD-0587) |

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
