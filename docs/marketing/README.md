# Marketing — DTD Cargo

> **Tree canónico de TODO lo externo para captar clientes:** SEO, publicidad (Google Ads), analítica (GA4/GTM), CRM, contenido, captación de leads, marca→web.
>
> **Convención (decisión founder, 2026-06-07):** todo lo de marketing / publicidad / SEO que hagamos **de aquí en adelante vive en este tree** (`docs/marketing/`). Cualquier agente que trabaje un tema de marketing **rutea acá**. El material que ya existe en otras carpetas **NO se mueve** — se **indexa** más abajo (sección "Material existente").

## Cómo usar este tree

- **Punto de entrada = este README** (índice + estado + reglas).
- **Plan maestro de acción** (digital + Google Ads, con la auditoría de los 4 activos + las 5 prioridades y su estado): [`plan-accion-digital.md`](plan-accion-digital.md).
- **Identidad y estrategia** (propósito · misión · visión · valores · objetivos + norte interno): [`estrategia.md`](estrategia.md) · identidad pública/legal + NAP + nombres: [`identidad.md`](identidad.md) · línea de ventas cliente-ancla: [`ventas.md`](ventas.md) · **embudo de ventas operativo + mapa de etapas Kommo (MARKBOX) + campos del Kanban**: [`embudo-ventas.md`](embudo-ventas.md).
- **Logs detallados por área** en archivos hermanos a medida que crezca: [`seo.md`](seo.md) (activo), [`redes.md`](redes.md) (activo), `ads.md`, `analytics.md`, … (se crean al tocar cada área).
- La **memoria del agente** (cross-sesión) referencia este tree como fuente de verdad; este tree es lo versionado y compartido por git.
- El **puntero en `AGENTS.md`** (sección Marketing) hace que todos los agentes lleguen acá automáticamente.

## Áreas

### 🎯 Identidad · Estrategia · Ventas — detalle en [`estrategia.md`](estrategia.md)
**Estado (2026-06-08):** identidad pública **cerrada** (propósito · misión · visión · valores · objetivos) — reemplaza las versiones de 2020. Norte **interno** = **2 contenedores/mes** (umbral de equilibrio operativo, **no se publica**) vía 2 motores: mayoristas recurrentes + aliados white-label. Identidad legal + NAP + convención de nombres en [`identidad.md`](identidad.md); plan de ventas cliente-ancla en [`ventas.md`](ventas.md). La versión-máquina (schema) se cablea en `app/layout.tsx` (Fase 2, pendiente).

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
- Plan/sistema en [`redes.md`](redes.md); contexto de prioridades en [`plan-accion-digital.md`](plan-accion-digital.md).

### 🤝 CRM — Kommo
Connector SDD-0043 (sync E2E en prod: leads/contactos/pipelines/webhooks). Fuente externa, no el CRM de prod. Ver memoria `project_sdd0043_kommo_connector`.
- **Diseño del embudo de ventas** (5 etapas), **mapa de etapas (MARKBOX)** para SDD-0084 y **campos del Kanban**: [`embudo-ventas.md`](embudo-ventas.md). Análisis triangulado (2 agentes + Codex) sobre el embudo real; recomendación lista para configurar en Kommo. Cómo ACTIVAR el write-back: [`../runbooks/activar-crm-kommo.md`](../runbooks/activar-crm-kommo.md).

### 📝 Contenido / Captación de leads
- **Alta de cliente web = `/registro`** (form mock + handoff WhatsApp con código `DTD-REG`; un asesor asigna el MARKBOX). Ver `project_public_registro_lead`.
- **Portal cliente = `/portal`** (passwordless). **Productos comerciales:** consolidación · puerta_a_puerta_DDP · reserva_FCL · transporte_terrestre.
- **Canales públicos = solo** CRM WhatsApp (`+58 412 166 8021`, primario) + Fijo Valencia (`+58 241 414 7886`). Ver `feedback_single_point_of_contact`.
- **WhatsApp Business — guía de configuración de perfiles corporativos** (logo, datos, web, catálogo de servicios por número): [`whatsapp-business.md`](whatsapp-business.md). 🟡 para llenar.

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
