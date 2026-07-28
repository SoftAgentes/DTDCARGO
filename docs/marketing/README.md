# Marketing — DTD Cargo

> **Tree canónico de TODO lo externo para captar clientes:** SEO, publicidad (Google Ads), analítica (GA4/GTM), CRM, contenido, captación de leads, marca→web.
>
> **Convención (decisión founder, 2026-06-07):** todo lo de marketing / publicidad / SEO que hagamos **de aquí en adelante vive en este tree** (`docs/marketing/`). Cualquier agente que trabaje un tema de marketing **rutea acá**. El material que ya existe en otras carpetas **NO se mueve** — se **indexa** más abajo (sección "Material existente").

## Cómo usar este tree

- **Punto de entrada = este README** (índice + estado + reglas).
- **Plan maestro de acción** (digital + Google Ads, con la auditoría de los 4 activos + las 5 prioridades y su estado): [`plan-accion-digital.md`](plan-accion-digital.md).
- **Identidad y estrategia** (propósito · misión · visión · valores · objetivos + norte interno): [`estrategia.md`](estrategia.md) · identidad pública/legal + NAP + nombres: [`identidad.md`](identidad.md) · línea de ventas cliente-ancla: [`ventas.md`](ventas.md) · **embudo de ventas operativo + mapa de etapas Kommo (MARKBOX) + campos del Kanban**: [`embudo-ventas.md`](embudo-ventas.md) · **sistema de adquisición (oferta + canal + proceso de prospección, manual del asesor)**: [`adquisicion.md`](adquisicion.md).
- **Motor de Crecimiento DTD** — marco de los 6 sistemas (adquisición · ventas · entrega · manual de operaciones · contratación · control financiero) + dónde entra cada trabajo: [`sistemas-negocio.md`](sistemas-negocio.md) · **el programa de construcción (re-auditoría ultra 18-jul + brechas + hoja de ruta por dueño + decisiones + metodología de activación §M)**: [`motor-crecimiento.md`](motor-crecimiento.md) · **el ritual del viernes que lo mueve (agenda de 30 min lista para correr)**: [`revision-del-motor.md`](revision-del-motor.md) · base conceptual (transcripciones de 2 expertas): [`research/expertos-sistematizacion.md`](../../research/expertos-sistematizacion.md) · prompt histórico que generó la v1: [`prompt-sesion-5-sistemas.md`](prompt-sesion-5-sistemas.md).
- **Infografías de servicios** (copy fuente por servicio, nuestro proceso China→VE; alimenta Cloud Design + web/PDF): [`servicios-infografias/`](servicios-infografias/README.md).
- **Sistema Editorial Técnico DTD Cargo** (pauta aplicada en Canva Brand Hub; reglas de composición y 3 plantillas piloto para redes): [`sistema-editorial-tecnico-dtd/`](sistema-editorial-tecnico-dtd/README.md).
- **Logs detallados por área** en archivos hermanos a medida que crezca: [`seo.md`](seo.md) (activo), [`redes.md`](redes.md) (activo), `ads.md`, `analytics.md`, … (se crean al tocar cada área).
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

### 📣 Publicidad — Google Ads
- Cuenta **"Dooortudoor services"** (ocid `579348138`).
- **2 campañas PAUSADAS** (reactivables): **DoorTuDoor Trafico** (Búsqueda, la probada, 4.231 conv) · **Importar de China-Venezuela** (Smart). **7 removidas** (archivo).
- Conversión **"Click WhatsApp"** (`AW-561290482/qbu2CILjn7ocEPK50osC`) cableada en `components/Analytics.tsx`.
- **Dominio de las Final URLs: ✅ MIGRADO al nuevo (2026-06-07).** Smart → `dtdcargo.com`. Search probada → `dtdcargo.com/estimacion` + sus **3 sitelinks** (`/servicios`, `/`, `/calculadora`). Campaña sigue **pausada**.
- **Reestructura (prioridad 3): copy-paste-ready en [`ads-reestructura-search.md`](ads-reestructura-search.md)** — 6 grupos temáticos + keywords frase/exacta + lista de negativas + RSAs + disciplina anti-pausa.
- ⚠️ **Cambiar la Final URL de un anuncio = SEO-neutral** (los ads son pagos, no afectan ranking orgánico).

### 📊 Analítica — GA4 + GTM
- Sin contenedores GTM en código → **gtag.js directo**: GA4 `G-25CD7BZH98` + Ads `AW-561290482` en `components/Analytics.tsx`.
- **GA NO carga en rutas privadas** (`/studio /portal /m /back /invitar`) → evita mandar PII a Google.
- ✅ **Flujo verificado en dtdcargo.com (2026-06-07):** propiedad única "dtdcargo.com" (cuenta DTD Cargo `396905128`), stream → `https://dtdcargo.com`, recibiendo datos. Cuenta vieja "DoorTuDoor" (`208873909`) = dormida.
- **Pendiente (founder):** borrar **2 contenedores GTM sin uso** (`GTM-KWRDZS4`, `GTM-PD3JF2GW`) — no se usan (es gtag directo). Ver memoria `project_google_analytics_ga4`.

### 📱 Redes / Canales sociales — detalle en [`redes.md`](redes.md)
- **Instagram `@doortudoor_`** — 5.003 seguidores · 128 posts · audiencia activa · destacados por intención (Q&A, Servicios, Visa) + reels educativos. 🟢 **El canal más fuerte** (fuente de contenido para reciclar).
- **YouTube `@doortudoor`** — 223 subs · 11 videos (podcast sobre China). 🔴 Abandonado → reactivar reciclando IG (prioridad 5). **Plan de reciclaje IG→YouTube en [`redes.md`](redes.md).**
- **Google Business Profile (Valencia)** — ⏳ verificar + reseñas (prioridad 2, founder). Tracción local.
- **Link-in-bio propio = `dtdcargo.com/enlaces`** (ruta `app/enlaces`, activo de marca): agrupa todos los enlaces bajo una URL, con atribución UTM + etiqueta de origen en WhatsApp. Cómo ponerlo en Instagram (+ botones nativos de cuenta profesional) y cómo editar los enlaces: [`link-in-bio.md`](link-in-bio.md).
- Plan/sistema en [`redes.md`](redes.md); contexto de prioridades en [`plan-accion-digital.md`](plan-accion-digital.md).

### 🤝 CRM — Kommo
Connector SDD-0043 (sync E2E en prod: leads/contactos/pipelines/webhooks). Fuente externa, no el CRM de prod. Ver memoria `project_sdd0043_kommo_connector`.
- **Diseño del embudo de ventas** (5 etapas), **mapa de etapas (MARKBOX)** para SDD-0084 y **campos del Kanban**: [`embudo-ventas.md`](embudo-ventas.md). Análisis triangulado (2 agentes + Codex) sobre el embudo real; recomendación lista para configurar en Kommo. Cómo ACTIVAR el write-back: [`../runbooks/activar-crm-kommo.md`](../runbooks/activar-crm-kommo.md).

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
4. **GA/analítica NO en rutas privadas** (PII → viola ToS de GA).
5. Anuncios pagos ≠ SEO orgánico: la Final URL de un ad no afecta ranking.

## Pendientes

- [ ] **Google Ads:** migrar Final URL de la Search probada → `dtdcargo.com/estimacion`; decidir reactivación (des-pausar = gasta).
- [ ] **GA4/GTM:** re-apuntar el stream `doortudoor.com → dtdcargo.com` + borrar 2 contenedores GTM sin uso.
- [ ] **SEO:** monitorear el traspaso del "Cambio de dirección" (~180 días) en Search Console.
