# Marketing — DTD Cargo

> **Tree canónico de TODO lo externo para captar clientes:** SEO, publicidad (Google Ads), analítica (GA4/GTM), CRM, contenido, captación de leads, marca→web.
>
> **Convención (decisión founder, 2026-06-07):** todo lo de marketing / publicidad / SEO que hagamos **de aquí en adelante vive en este tree** (`docs/marketing/`). Cualquier agente que trabaje un tema de marketing **rutea acá**. El material que ya existe en otras carpetas **NO se mueve** — se **indexa** más abajo (sección "Material existente").

## Cómo usar este tree

- **Colores de avisos (2026-09-05):** [SDD-0441](../specs/0441-colores-semanticos-marca/spec.md) aplica la política de [BRAND.md](../../BRAND.md) a la calculadora: recargo informativo neutro y derivación al asesor con atención dorada. Tarifas y fórmulas no cambian.


- **Punto de entrada = este README** (índice + estado + reglas).
- **Plan maestro de acción** (digital + Google Ads, con la auditoría de los 4 activos + las 5 prioridades y su estado): [`plan-accion-digital.md`](plan-accion-digital.md).
- **Identidad y estrategia** (propósito · misión · visión · valores · objetivos + norte interno): [`estrategia.md`](estrategia.md) · identidad pública/legal + NAP + nombres: [`identidad.md`](identidad.md) · línea de ventas cliente-ancla: [`ventas.md`](ventas.md) · **embudo de ventas operativo + mapa de etapas Kommo (MARKBOX) + campos del Kanban**: [`embudo-ventas.md`](embudo-ventas.md) · **sistema de adquisición (oferta + canal + proceso de prospección, manual del asesor)**: [`adquisicion.md`](adquisicion.md) · **precios de la competencia verificados (motores de precio de Asiaven e Import2Ven, mínimos del mercado, dónde queda DTD)**: [`competencia-precios.md`](competencia-precios.md).
- **Motor de Crecimiento DTD** — marco de los 6 sistemas (adquisición · ventas · entrega · manual de operaciones · contratación · control financiero) + dónde entra cada trabajo: [`sistemas-negocio.md`](sistemas-negocio.md) · **el programa de construcción (re-auditoría ultra 18-jul + brechas + hoja de ruta por dueño + decisiones + metodología de activación §M)**: [`motor-crecimiento.md`](motor-crecimiento.md) · **el ritual del viernes que lo mueve (agenda de 30 min lista para correr)**: [`revision-del-motor.md`](revision-del-motor.md) · base conceptual (transcripciones de 2 expertas): [`research/expertos-sistematizacion.md`](../../research/expertos-sistematizacion.md) · prompt histórico que generó la v1: [`prompt-sesion-5-sistemas.md`](prompt-sesion-5-sistemas.md).
- **Infografías de servicios** (copy fuente por servicio, nuestro proceso China→VE; alimenta Cloud Design + web/PDF): [`servicios-infografias/`](servicios-infografias/README.md).
- **La calculadora explicada, para atención al cliente** (guía gráfica de 5 minutos: qué es el CBM, la regla del peso —1.000 kg incluidos por m³— y la del mínimo —piso de $50, no de metros; con baterías, piso × multiplicador vigente—, con ejemplos verificados contra el motor real y guiones de respuesta): [`calculadora-explicada.html`](calculadora-explicada.html). Es HTML: doble clic, sin internet. **Si cambian las tarifas en Admin › Calculadora pública, esta guía queda vieja** — los números están fechados adentro.
- **Sistema Editorial Técnico DTD Cargo** (pauta aplicada en Canva Brand Hub; reglas de composición y 3 plantillas piloto para redes): [`sistema-editorial-tecnico-dtd/`](sistema-editorial-tecnico-dtd/README.md).
- **Logs detallados por área** en archivos hermanos a medida que crezca: [`seo.md`](seo.md) (activo), **[20 preguntas SEO/AEO desde el CRM](seo-aeo-preguntas-crm.md)** (contenido fuente basado en 401 conversaciones), [`redes.md`](redes.md) (activo), `ads.md`, `analytics.md`, … (se crean al tocar cada área).
- **Leer estos docs sin abrir el repo:** dentro del ERP en **Studio › Marketing › Documentos** (`/studio/marketing/docs`, SDD-0158, se actualiza solo) · **offline** (un HTML portable, doble clic sin internet) corriendo **`pnpm marketing:reader`** → genera `outputs/lector-marketing-dtd.html` (o `node scripts/build-marketing-reader.mjs "C:/ruta/Lector.html"` para otro destino). Ambos leen ESTOS `.md` — la fuente de verdad sigue siendo este tree.
- La **memoria del agente** (cross-sesión) referencia este tree como fuente de verdad; este tree es lo versionado y compartido por git.
- El **puntero en `AGENTS.md`** (sección Marketing) hace que todos los agentes lleguen acá automáticamente.

## Áreas

### 🎯 Identidad · Estrategia · Ventas — detalle en [`estrategia.md`](estrategia.md)
**Estado (2026-06-08):** identidad pública **cerrada** (propósito · misión · visión · valores · objetivos) — reemplaza las versiones de 2020. Norte **interno** = **2 contenedores/mes** (umbral de equilibrio operativo, **no se publica**) vía 2 motores: mayoristas recurrentes + aliados white-label. Identidad legal + NAP + convención de nombres en [`identidad.md`](identidad.md); plan de ventas cliente-ancla en [`ventas.md`](ventas.md). La versión-máquina (schema `@graph`) ya está cableada en `app/layout.tsx` (hecho; `foundingDate: 2015`).

### 🧲 Adquisición de clientes — detalle en [`adquisicion.md`](adquisicion.md)
**Estado (2026-07-17):** sistema definido (deep research 6 líneas + verificación adversarial + merge con lo
construido; dump con fuentes en `research/INVESTIGACION-adquisicion-clientes.md`). **UNA oferta** (**Puerta a
Puerta** "pagas al llegar" empaquetado + tarifa preferencial por cadencia; "DDP" se retira como nombre — solo
aclaración "(todos los gastos pagados)") · **UN canal primario** (calor propio: base
existente + referidos; soporte IG→DM→WhatsApp; $0 pauta en Fase 1) · **UN proceso** (rutina diaria del asesor:
SLA <5 min, 5 preguntas de calificación, 10 toques cálidos/día, cadencia D0→D18 + nurture, manual nivel
principiante). Cubre el TOP del embudo; el medio sigue en [`embudo-ventas.md`](embudo-ventas.md). Los estimados
web ya avisan al equipo (fuga #1 cerrada 2026-07-17). **Herramientas y material de trabajo:** guiones del asesor
listos para pegar → [`guiones-asesor.md`](guiones-asesor.md) · lista de ~60
prospectos → [`prospectos-ancla.md`](prospectos-ancla.md) · copy de la oferta para aprobar →
[`oferta-borradores.md`](oferta-borradores.md) · pasos que faltan en el CRM → [`checklist-kommo.md`](checklist-kommo.md) ·
campaña de recuperación → `/studio/kommo` › Recuperación (SDD-0157). Pendientes founder en `adquisicion.md` §10.

### 🔍 SEO — detalle en [`seo.md`](seo.md)
**Estado (2026-06-07):** dominio migrado `doortudoor.com → dtdcargo.com` (301 path-preserving + "Cambio de dirección" de Search Console **activo**). Rename `/cotizar → /estimacion` (308). 18 geo-páginas "Importar de China a {ciudad}". Sitemap 35 URLs. 6 redirects de recuperación de páginas viejas huérfanas. → ver `seo.md` para la cronología completa y las reglas.

**SEO/AEO desde el CRM (2026-07-22):** top 20 operativo, respuestas directas, cruce de palabras
clave y tres ideas futuras revisados en [`seo-aeo-preguntas-crm.md`](seo-aeo-preguntas-crm.md).
Estado: aprobado editorialmente con condiciones; todavía no autorizado para el sitio público. Fuente:
análisis sin PII de 401 conversaciones de Kommo (SDD-0062); las posiciones 1–6 tienen señal explícita
de alta frecuencia y 7–20 quedan marcadas como prioridad editorial hasta instrumentar conteo.

### 📣 Publicidad — Google Ads
- Cuenta **"Dooortudoor services"** (ocid `579348138`).
- **2 campañas PAUSADAS** (reactivables): **DoorTuDoor Trafico** (Búsqueda, la probada, 4.231 conv) · **Importar de China-Venezuela** (Smart). **7 removidas** (archivo).
- Conversión **"Click WhatsApp"** (`AW-561290482/qbu2CILjn7ocEPK50osC`) cableada en `components/Analytics.tsx`.
- **Dominio de las Final URLs: ✅ MIGRADO al nuevo (2026-06-07).** Smart → `dtdcargo.com`. Search probada → `dtdcargo.com/estimacion` + sus **3 sitelinks** (`/servicios`, `/`, `/calculadora`). Campaña sigue **pausada**.
- **Reestructura (prioridad 3): copy-paste-ready en [`ads-reestructura-search.md`](ads-reestructura-search.md)** — 6 grupos temáticos + keywords frase/exacta + lista de negativas + RSAs + disciplina anti-pausa.
- ⚠️ **Cambiar la Final URL de un anuncio = SEO-neutral** (los ads son pagos, no afectan ranking orgánico).

### 📊 Analítica — GA4 + GTM
- Sin contenedores GTM en código → **gtag.js directo**: GA4 `G-25CD7BZH98` + Ads `AW-561290482` en `components/Analytics.tsx`.
- **GA/Ads NO cargan en rutas privadas o de acceso** (`/studio /portal /m /back /invitar /acceso /entrar /abrir`, entre otras), ni cuando la URL lleva query no aprobada o credenciales en el fragmento. La allowlist conserva sólo atribución (`utm_*`, `origen`, `gclid`, `gbraid`, `wbraid`); el guard de History apaga ambos tags antes de una navegación cliente sensible. Contratos sintéticos: `__tests__/analytics.test.ts` y `components/Analytics.test.tsx`.
- **Remediación local SDD-0371 (2026-09-05):** la inspección también bloquea credenciales anidadas cuando un valor de atribución mezcla escapes válidos y porcentajes malformados. La decodificación sólo sirve para inspeccionar; la atribución legítima conserva su valor original, incluidos porcentajes y Unicode. El sanitizador omite valores sensibles como defensa adicional. Evidencia y límites en el [handoff de remediación](../../.agents/handoffs/pr24-analytics-remediation-20260905.md); esta validación local no acredita un despliegue ni el procesamiento interno de Google.
- ✅ **Flujo verificado en dtdcargo.com (2026-06-07):** propiedad única "dtdcargo.com" (cuenta DTD Cargo `396905128`), stream → `https://dtdcargo.com`, recibiendo datos. Cuenta vieja "DoorTuDoor" (`208873909`) = dormida.
- **Pendiente (founder):** borrar **2 contenedores GTM sin uso** (`GTM-KWRDZS4`, `GTM-PD3JF2GW`) — no se usan (es gtag directo). Ver memoria `project_google_analytics_ga4`.

### 📱 Redes / Canales sociales — detalle en [`redes.md`](redes.md)
- **Instagram `@dtdcargo.ve`** — 20 mil seguidores · audiencia activa · destacados por intención (Q&A, Servicios, Visa) + reels educativos. 🟢 **El canal más fuerte** (fuente de contenido para reciclar). ⚠️ Migrado desde `@doortudoor_`, que **ya no existe** (verificado en vivo 2026-08-04) — los 5.003 seguidores que decía este README eran el dato viejo de la cuenta anterior.
- **TikTok `@dtdcargo.ve`** — **2.827 seguidores · 2.287 me gusta** (medido 2026-08-19) · link → `dtdcargo.com/enlaces`. 🟡 Vivo pero sin plan; `redes.md` no lo registraba.
- **YouTube `@dtdcargo`** — **225 subs · 10 videos** (medido 2026-08-19). 🔴 **Y NO está muerto:** un solo video tiene **23.962 vistas** y su descripción manda a `www.doortudoor.com` y al WhatsApp **`04148870000`, que no es ninguno de los nuestros**. Detalle y textos de reemplazo en [`redes.md`](redes.md) § "YouTube NO está muerto". **Prioridad alta y no depende de Google.**
- **Google Business Profile (Valencia)** — ⏳ reclamar + corregir datos + reseñas. **Plan completo y orden de operaciones en [`google-configuracion.md`](google-configuracion.md)** (inventario de cuentas, por qué sale el nombre viejo, y las 3 fases: config → geo → SEO).
- **Link-in-bio propio = `dtdcargo.com/enlaces`** (ruta `app/enlaces`, activo de marca): agrupa todos los enlaces bajo una URL, con atribución UTM + etiqueta de origen en WhatsApp. Cómo ponerlo en Instagram (+ botones nativos de cuenta profesional) y cómo editar los enlaces: [`link-in-bio.md`](link-in-bio.md).
- Plan/sistema en [`redes.md`](redes.md); contexto de prioridades en [`plan-accion-digital.md`](plan-accion-digital.md).

### 🤝 CRM — Kommo
Connector SDD-0043 (sync E2E en prod: leads/contactos/pipelines/webhooks). Fuente externa, no el CRM de prod. Ver memoria `project_sdd0043_kommo_connector`.
- **Diseño del embudo de ventas** (5 etapas), **mapa de etapas (MARKBOX)** para SDD-0084 y **campos del Kanban**: [`embudo-ventas.md`](embudo-ventas.md). Análisis triangulado (2 agentes + Codex) sobre el embudo real; recomendación lista para configurar en Kommo. Cómo ACTIVAR el write-back: [`../runbooks/activar-crm-kommo.md`](../runbooks/activar-crm-kommo.md).
- **Blueprint integral de EI/IAE por etapa + fuente de conocimiento + arquetipos + Salesbot/difusión + automatizaciones:** [`kommo-ia-fuente-conocimiento-pipeline.md`](kommo-ia-fuente-conocimiento-pipeline.md). Auditoría live read-only del 2026-08-05; nada del blueprint está aplicado todavía.
- ⭐ **Estado verificado del CRM + checklist de pendientes:** [`kommo-estado-y-pendientes.md`](kommo-estado-y-pendientes.md). Foto medida en vivo el 2026-08-10 — plan y consumo real de créditos (con el desglose que separa clientes de pruebas), los 4 agentes con sus etapas y límites, el volumen, por qué no llegan las alertas rojas, el bloqueo *"Cannot run two different agents in the same status"* y el checklist completo.
- 🔴 **Los 4 agentes estuvieron PARADOS del 07 al 10-ago por límite de créditos** (7.281/7.250) — 63 leads entraron sin atender, 18 ya perdidos. Medido en vivo el 2026-08-10: [`agentes-ia-configuracion.md`](agentes-ia-configuracion.md). ⚠️ No es sólo recargar: a 19-28 créditos por respuesta el plan da ~10 respuestas/día contra ~16 leads/día.
- **Guion de entrada por Instagram** (el canal más fuerte y el único sin guion): [`instagram-entrada.md`](instagram-entrada.md). Trae los **dos tiempos**: respuesta pública al comentario + DM. ⭐ **El 32% de los contactos nuevos entra por Instagram/Facebook** (72 de 226 en 30 días, medido 2026-08-10) y ningún agente atiende ese canal. ⭐ **El comentario SÍ se responde desde Kommo** —clic en el nombre del autor dentro del bloque del comentario→ *"Comentar para @usuario"*; no hay que ir a Meta. 🔴 **El copy publicitario NO sale de ninguna automatización: lo escribe una persona del equipo a mano** (confirmado 2026-08-10; descartados Salesbots, difusiones, agentes, automatizaciones de Meta y apps de terceros). ⚠️ **`SalesBot:` en Kommo no prueba que haya un bot** — así firma cualquier saliente que entra por webhook sin usuario asociado, o sea todo lo que se responde desde la app de Instagram.

#### 🧠 El conocimiento que consume la IA — **hay DOS bases, y no son la misma**

Este índice no las mencionaba y era un hueco: cambiar una sin la otra las desincroniza.

| Base | Ruta | Quién la consume | Cómo se actualiza |
|---|---|---|---|
| **KB del AI Agent de Kommo** | [`../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`](../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md) | IAE `DTD Cargo asistente de ventas` (#326244), activa en WhatsApp `Importador de China` para `Incoming leads`, `Contacto inicial` y `Recontacto` | Editar el `.md` → convertir a DOCX → **subir a Kommo reemplazando el anterior**. No basta con commitear. Proceso en [`../runbooks/kommo-reconfig.md`](../runbooks/kommo-reconfig.md). |
| **Paquete del equipo** | [`../../equipo-crm/README.md`](../../equipo-crm/README.md) | La cuenta Claude del equipo (`doortudoorservices@gmail.com`) | Editar el `.md` → borrar el archivo viejo del Proyecto y subir el nuevo. |

- ⭐ **Cómo llevar la conversación** (leer el mensaje entrante · una pregunta por mensaje · la
  cadena de profundización · las objeciones · los datos falsos que circulan):
  [`conversacion-crm.md`](conversacion-crm.md). Evidencia y fuentes en
  [`research/INVESTIGACION-conversacion-ventas-crm.md`](../../research/INVESTIGACION-conversacion-ventas-crm.md).
- ⭐ **Agentes de IA por etapa** — quién es cada arquetipo, por qué se eligió, su astucia, sus
  preguntas y lo que nunca hace → [`agentes-ia-por-etapa.md`](agentes-ia-por-etapa.md). **El cliente
  siempre habla con Manuel**, la identidad que el equipo ya usa hace años; los arquetipos son capa
  interna. Empieza acá quien vaya a escribir un prompt de agente.
- 🎓 **Manual del asesor** — el programa de entrenamiento de la **persona**, no de la IA: 4 módulos
  y **30 ejercicios con solución**, para hacer solo y sin formador al lado →
  [`manual-asesor/`](manual-asesor/README.md). Se hace un módulo por semana, en orden, y el
  Módulo 1 se repite al mes. **No se carga en el asistente de IA** (es pedagogía, le agregaría ruido).
- ⚠️ **Regla de coherencia (SDD-0063/0064):** lo que diga la KB de Kommo debe coincidir con
  `lib/faqs.ts` y con la web pública. Cambiar uno sin el otro rompe un gate declarado.
- ⚠️ **Un hueco en la KB de Kommo produce SILENCIO, no un "no sé":** el AI Agent solo responde
  cuando encuentra información relevante en sus Sources. Por eso los temas sin redactar se marcan
  explícitamente como escalamiento.

### 📝 Contenido / Captación de leads
- **Centro editorial = `/noticias`**, nombre público **Actualidad** y portada
  **“Actualidad, guía y noticias”**. Conserva el motor existente de las SDD-0088/0089;
  no existe un `/blog` paralelo. Rediseño y gates en [`../specs/0167-actualidad-centro-editorial/spec.md`](../specs/0167-actualidad-centro-editorial/spec.md).
- **Newsletter de Actualidad = solo email**. El formulario vive en `/noticias` y
  artículos; no usa WhatsApp como canal de suscripción. Backend local: tabla
  privada `newsletter_subscribers`, endpoint `/api/newsletter/subscribe`,
  honeypot, throttle, lista de exclusión e idempotencia. El alta y la baja ya
  fueron verificadas con la migración 0259. El envío administrativo vive en
  `/studio/marketing/newsletter`: borrador → revisión → aprobación admin →
  prueba interna → lotes manuales de hasta 100. Migraciones privadas 0259 y 0260
  aplicadas; RLS, grants y RPC verificados el 2026-07-22. Preview 0260 READY en
  `dtdcargo-pkge69mpf-hailu-wey.vercel.app`; flujo autenticado de borrador,
  prueba interna, revisión y aprobación verificado. La campaña de prueba quedó
  cancelada con cero envíos reales. Lote controlado validado después: un correo
  interno entregado, cero externos y cero fallos. La baja reveló un gate: el
  correo del Preview apuntó a la ruta pública anterior de marketing y no actualizó
  `newsletter_subscribers`; el registro interno se reparó tras el consentimiento.
  El host y la confirmación visual quedaron corregidos en el Preview READY
  `dtdcargo-jnag8kgv4-hailu-wey.vercel.app` (pantalla pública `/email/baja`,
  `noindex`, token retirado de la URL, estados Actualidad/marketing/error y reflujo
  1440/390 px en tema claro/oscuro). La repetición controlada creó y entregó un
  solo correo a `vzla@dtdcargo.com`, con cero destinatarios externos; el enlace
  llegó al endpoint del Preview, pero terminó en `estado=invalido` y el suscriptor
  permaneció `subscribed`, sin reparación manual. El gate de baja firmada sigue
  fallido. El diagnóstico desplegado en
  `dtdcargo-j6tgb6pxy-hailu-wey.vercel.app` confirmó que la huella recibida por
  correo coincidía con la emitida, pero Outlook retiró `?token=...` y la API
  recibió el token ausente. La corrección transporta un token opaco cifrado en
  `/api/email/unsubscribe/[token]`, conserva compatibilidad con enlaces HMAC
  anteriores y no requiere migración. La baja firmada quedó validada de punta a
  punta en `dtdcargo-3jtv0vceu-hailu-wey.vercel.app`: un correo interno
  `delivered`, cero externos, ruta dinámica `303`, confirmación de Actualidad y
  persistencia `unsubscribed` con `signed_link`, sin reparación manual. La
  verificación detectó dos ajustes adicionales, también sin migración. Ambos
  quedaron validados el 2026-07-22: el Preview
  `dtdcargo-jscugtgxl-hailu-wey.vercel.app` resuscribió el correo interno y dejó
  `unsubscribed_at`/`unsubscribe_reason` en `null`; después, el Preview temporal
  `dtdcargo-mmsf7a59p-hailu-wey.vercel.app` reprodujo de forma firmada el evento
  `email.delivered` ya existente y persistió `last_delivered_at =
  2026-07-22T21:57:02.499Z`. No se envió otro correo, la ruta temporal se retiró
  y las campañas reales permanecen deshabilitadas. Falta autorizar producción
  por separado.
  Publicar una noticia nunca envía una campaña.
- **Alta de cliente web = `/registro`** (registro REAL: crea el cliente con Shipping Mark/MARKBOX vía `rpc('next_markbox')` + opt-in email + aviso a admins — `app/registro/actions.ts`; ya no es mock).
- **Portal cliente = `/portal`** (passwordless). **Productos comerciales:** consolidación · puerta_a_puerta_DDP · reserva_FCL · transporte_terrestre.
- **Canales públicos = solo** CRM WhatsApp (`+58 412 166 8021`, primario) + Fijo Valencia (`+58 241 414 7886`). Ver `feedback_single_point_of_contact`.
- **WhatsApp Business — guía de configuración de perfiles corporativos** (logo, datos, web, catálogo de servicios por número): [`whatsapp-business.md`](whatsapp-business.md). 🟢 **lista para ejecutar** (checklist §7 en 0/10; faltan solo 3 fotos; ⚠️ sus etiquetas §4.4 ceden ante el pipeline de `adquisicion.md` — unificación pendiente en el Motor).
- **Condiciones de cotización — copy web + correo** (el precio online es estimado/referencial; calza con "Pagas al llegar\*" y la integración de rates): [`condiciones-cotizacion.md`](condiciones-cotizacion.md). ✅ copy listo (pulido por redactor), pendiente cablear cuando exista el cotizador online. **Incluye la FAQ del cliente sobre peso/tamaño (sin números).**
- **Manual de vendedores — cómo cotizar el peso** (INTERNO, con números + anti-trucos + negociación + 3 diálogos con precios reales): [`manual-vendedores-peso.md`](manual-vendedores-peso.md). Calibrado con 33 contenedores reales; límites vigentes: gracia **1.000 kg/m³** · recargo **$2/kg** · tope por envío **9.000 kg** (anti-abuso, density-aware ≈400 kg/m³) · tope contenedor **68 m³ / 27.000 kg**. La evidencia (densidades reales) vive en el informe confidencial (`docs/legal/casos/`) + brief legal v3.1.

### 🎨 Marca → Web
Brand Book vigente = el de mayor versión en `docs/design/studio/_norte/` (hoy **v3.7**; el book es UNO solo, los anteriores se borran). Publicado privado en `/marca/brand-book`; hub interno del equipo = `/interno/marca` (el kit público `/brand` se relocalizó ahí). Fuentes web = Archivo (Nunito/Sora es capa ERP, no toca la web). Ver `feedback_norte_brand_to_web`.

## Material existente (NO mover — solo enlazar)

| Qué | Dónde |
|---|---|
| Checklist SEO/Ads (jun-2026) | `docs/pendientes-seo-ads-2026-06-06.md` |
| Brand Book (vigente, único) | `docs/design/studio/_norte/` |
| SEO contenido (geo-páginas, 2026-06-06) | memoria `project_session_2026_06_06_seo_contenido` |
| SEO post-rename + migración dominio (2026-06-07) | memoria `project_session_2026_06_07` |
| GA4 setup | memoria `project_google_analytics_ga4` |
| Kommo CRM | memoria `project_sdd0043_kommo_connector` |
| Lead capture `/registro` | memoria `project_public_registro_lead` |
| Marca → web | memoria `feedback_norte_brand_to_web` |
| Modelo de productos | memoria `brand_product_model_dtd` |

## 🛡️ Reglas que NO se rompen

1. **Nunca quitar el 301** `doortudoor.com → dtdcargo.com` (transfiere la autoridad SEO).
2. **No dejar expirar `doortudoor.com`** — registrado + redirigiendo ≥1 año (idealmente indefinido).
3. **`doortudoor.com` NO debe volver a servir contenido propio** (sería duplicado / autoridad dividida).
4. **GA/analítica NO en rutas privadas, puertas de acceso ni URLs con credenciales o códigos.**
5. Anuncios pagos ≠ SEO orgánico: la Final URL de un ad no afecta ranking.

## Pendientes

- [ ] **Google Ads:** migrar Final URL de la Search probada → `dtdcargo.com/estimacion`; decidir reactivación (des-pausar = gasta).
- [ ] **GA4/GTM:** re-apuntar el stream `doortudoor.com → dtdcargo.com` + borrar 2 contenedores GTM sin uso.
- [ ] **SEO:** monitorear el traspaso del "Cambio de dirección" (~180 días) en Search Console.

### 🤖 CRM · IA — abierto tras la auditoría live del 2026-08-05

- [x] **DOCX v6 subido y conectado.** En la auditoría live aparece
  `DTDCARGO-Kommo-KnowledgeSource-v6-2026-08-05.docx` con 34 subsecciones. Falta el control
  editorial completo y retirar fuentes duplicadas; subir una fuente no demuestra que todas sus
  respuestas sean correctas.
- [x] ~~¿El agente dice que es un bot?~~ **RESUELTO (founder, 2026-08-03): no es obligatorio.**
  Operamos en Venezuela, que no tiene normativa sobre divulgación de bots, y no nos atamos a la
  ley de California ni al Reglamento de IA de la UE. Lo que sí se mantiene: si el cliente
  **pregunta** si es una persona, el agente lo dice; y la salida a humano siempre disponible.
- [x] **Config actual inspeccionada:** una IAE activa, 25 pautas, 6 Acciones, límite de 10
  respuestas y WhatsApp en tres etapas. La arquitectura especializada por columna sigue pendiente.
- [x] **Tres textos sueltos auditados:** `Descripción del negocio` conserva 2008/2010/2015;
  `Datos clave` y `Productos y servicios` mezclan hechos con instrucciones de comportamiento.
- [ ] **Sanear la fuente:** decidir la política de condiciones por volumen/frecuencia, retirar la
  promesa `casi 24 horas`, separar hechos de pautas y eliminar duplicación.
- [x] **11 Salesbots legacy auditados en modo lectura.** Contienen marca, años, personas, reglas y
  flujos obsoletos; varios tienen cientos de sesiones activas. Ninguno se reutiliza tal cual.
- [ ] **Aprobar cuarentena y retiro de Salesbots legacy.** Primero cortar lanzamientos y resolver
  sesiones activas; después borrar uno por uno. Construir solo dos bots nuevos en v1: reenganche
  individual y recordatorio de datos faltantes. Detalle en el blueprint integral.
- [x] ~~Manual de entrenamiento del asesor (persona, no IA)~~ ✅ **HECHO 2026-08-03** →
  [`manual-asesor/`](manual-asesor/README.md). **Falta lo humano:** decidir quién lo corre, cuándo
  arranca la primera semana y quién revisa los ejercicios del Módulo 1.
- [x] ~~`manual-vendedores-peso.md` contradice al código (1.000 kg/m³ vs 500).~~ ❌ **La nota
  estaba al revés y la corrijo:** el manual tenía razón. **Producción cobra 1.000 kg/m³ y $2/kg
  desde el 2026-07-06**; el `CONFIG` de `lib/calculadora.ts` era el **respaldo stale** (500 / $1),
  que solo entra si la RPC no responde. Lo arregló el commit `535aa0ec` — o sea que ante una caída
  de Supabase el sitio cobraba otro precio en silencio, y con el peso incluido a la mitad le habría
  cobrado excedente al doble de clientes. ⭐ **Lección: el `CONFIG` del código NO es la fuente de
  verdad de las tarifas — lo es la RPC `public_calculator_config`.**
- [x] ~~**La tarifa pública sube a $850/CBM el 4-sep-2026** (migración `0336`, decisión founder
  2026-08-05): revisar los documentos que citan **$800**.~~ ✅ **HECHO 2026-09-18**, uno por uno:
  - **No se tocan** los ejemplos del «precio desnudo»: [`conversacion-crm.md`](conversacion-crm.md),
    `equipo-crm/07-como-conversar.md` y [`manual-asesor/01-diagnostico.md`](manual-asesor/01-diagnostico.md).
    Enseñan que el error es no preguntar, no el número; cambiarlo les quitaba el sentido.
  - **Se recalcularon con fecha** los que se presentan como vigentes:
    [`manual-vendedores-peso.md`](manual-vendedores-peso.md), [`calculadora-explicada.html`](calculadora-explicada.html)
    y `public/interno/guia-peso.html`. Cada ejemplo sin baterías se corrió en el motor de la
    calculadora con los valores públicos del 2026-09-18 ($850/m³, mínimo $50, 1.000 kg/m³, $2/kg).
    El explicativo corrige además el mínimo en cajas: con $850 son **2**, no 3.
  - [x] ~~El recargo de baterías quedó en ×1,3 **en revisión**: el ERP mostraba ×1,5 y faltaba saber
    si fue decisión de Sam.~~ ✅ **RESUELTO 2026-09-18** ([SDD-0480](../specs/0480-respaldo-bateria-espeja-erp/spec.md)):
    Sam lo confirmó — «Sí, ×1,5 es correcto — Lo subí a propósito.» `calculadora-explicada.html`
    pasa a **×1,5 (+50%)** y su ejemplo con baterías, corrido en el motor, a $1.700 × 1,5 =
    **$2.550** (+$850). El respaldo del código (`CONFIG.recargoBateriaMult`) también quedó en 1,5,
    anclado en su test.
  - **Precedencia del mínimo con baterías (SDD-0502, 2026-09-23):** el piso se completa
    **antes** del recargo de litio. Con el mínimo vigente de $50 y la configuración actual
    ×1,5, una carga mínima con baterías sale en **$75**. Si Administración cambia el mismo
    campo a ×2, pasa a **$100** automáticamente; no existe otro multiplicador ni un $100
    fijo en el motor. El desglose muestra por separado el ajuste que completa $50 y el
    recargo de batería calculado sobre esos $50.
  - **Nota fechada, sin retocar la foto** de los competidores del 2026-08-01:
    [`competencia-precios.md`](competencia-precios.md) §5 y [`adquisicion.md`](adquisicion.md).
    La ventaja en tarifa base baja de 13 % a 7,6 % contra AsiaVen.
