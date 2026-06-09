# Plan de Acción Digital + Google Ads — DTD Cargo

> Plan vivo. Parte del tree [Marketing](README.md). Reemplaza el checklist suelto `docs/pendientes-seo-ads-2026-06-06.md` (marcado como superado).
> **Última actualización:** 2026-06-07.

## Negocio

**DoorTuDoor / DTD Cargo** — importación **puerta a puerta DDP de China a Venezuela**. Operación en **Yiwu (China)** + **Valencia (Venezuela)**.
**Diferenciadores:** ruta **Yiwu** · **18 años** de experiencia · envíos **DDP** (el cliente paga cuando llega).
**Contacto público:** Fijo Valencia **+58 241 414 7886** (Lun–Vie 9–17) · CRM WhatsApp **+58 412 166 8021**.

## Auditoría de los 4 activos digitales (base, 2026-06)

| Activo | Estado | Lectura |
|---|---|---|
| **Sitio `dtdcargo.com`** | SEO técnico OK (title/meta/canonical, JSON-LD LocalBusiness 2 sedes, OG, responsive, indexable). Conversión 100% WhatsApp. | ⚠️ Falta profundidad de contenido: blog + páginas de servicio. *(Hoy ya hay 18 geo-páginas + hub `/importar-de-china`.)* |
| **Instagram `@doortudoor_`** | 5.003 seguidores · 128 posts · audiencia activa · destacados por intención (Q&A, Servicios, Visa) + reels educativos. | 🟢 **El canal más fuerte.** Es la fuente de contenido para reciclar. |
| **YouTube `@doortudoor`** | 223 subs · 11 videos · buen contenido (podcast sobre China). | 🔴 Prácticamente abandonado → reactivar reciclando IG. |
| **Google Ads** | 8 campañas muertas/duplicadas · solo concordancia amplia sin negativas · error de prender/apagar (reinició el aprendizaje). "DoorTuDoor Trafico" pausada. | ⚠️ Reestructura pendiente. *(Medición + dominio ya resueltos hoy.)* |

## Las 5 prioridades — estado REAL (reconciliado 2026-06-07)

### 1. Instalar GA4 + Tag + marcar clic a WhatsApp como conversión → ✅ **HECHO**
- GA4 `G-25CD7BZH98` + Google Ads `AW-561290482` (gtag.js directo) en `components/Analytics.tsx`. Excluye rutas privadas (anti-PII).
- Conversión **"Click WhatsApp"** (`AW-561290482/qbu2CILjn7ocEPK50osC`) dispara en cada clic a un link de WhatsApp.
- GA4: propiedad única **"dtdcargo.com"** (cuenta DTD Cargo), stream → `https://dtdcargo.com`, **recibiendo datos**.
- **Resta (tú):** confirmar en Google Ads que la conversión figure **"Activa"** (tarda horas). Borrar 2 contenedores GTM sin uso (`GTM-KWRDZS4`, `GTM-PD3JF2GW`) — no se usan (es gtag directo).

### 2. Verificar Google Business Profile (Valencia) + reseñas → ⏳ **TÚ**
- GBP requiere validación de dirección (postal/teléfono) → solo lo haces tú.
- Reseñas: mandar el link de Google a clientes conformes por WhatsApp. Tracción local gratis.

### 3. Reactivar + reestructurar la campaña SIN volver a pausarla → 🟡 **PREPARADO, falta reestructura**
- ✅ Hoy: "DoorTuDoor Trafico" con **Final URL + 3 sitelinks migrados al dominio nuevo** (`/estimacion`, `/servicios`, `/`, `/calculadora`). Lista para reactivar.
- **Falta:** ad groups temáticos · keywords con concordancia de **frase/exacta** (no solo amplia) · **lista de negativas** · RSAs nuevas alineadas a cada grupo.
- **Disciplina:** NO prender/apagar (reinicia el aprendizaje). Al reactivar, **dejar correr ≥2 semanas** sin tocar. Des-pausar = empieza a gastar → decisión de negocio.

### 4. Crear páginas de servicio para SEO → 🟡 **PARCIAL**
- ✅ Hoy: 18 geo-páginas "Importar de China a {ciudad}" + hub `/importar-de-china` (SEO programático por ciudad).
- **Falta:** páginas de **servicio** dedicadas a los 4 productos (consolidación · puerta a puerta DDP · reserva FCL · transporte terrestre) + **blog** (vía CMS Studio `news_posts`).

### 5. Reactivar YouTube reciclando contenido de Instagram → ⏳ **NO EMPEZADO**
- Cortar reels/Q&A de IG → Shorts de YouTube + re-subir el podcast de China en clips.

## Plan de acción (ordenado por prioridad · ⭐ = #1)

### 🔴 TÚ (consola/negocio — Claude no puede)
1. **⭐ Reactivar la Search** cuando decidas gastar (ya está limpia) — y **NO volver a pausar** ≥2 semanas.
2. **GBP Valencia:** verificar + pedir reseñas.
3. **Google Ads:** confirmar conversión "Activa" · borrar 2 GTM sin uso.
4. *(Pasivo)* Monitorear en Search Console: Cambio de dirección (~180d) + indexación.

### 🟡 CLAUDE (cuando quieras — produzco el contenido)
1. **⭐ Reestructura de la campaña** (prioridad 3): ad groups + keywords (frase/exacta) + negativas + RSAs. *La base; todo lo demás cuelga de acá.*
2. **Páginas de servicio SEO** (prioridad 4): los 4 productos + arrancar el blog.
3. **YouTube/contenido** (prioridad 5): plan de reciclaje IG → Shorts.
4. **Performance 96→99** + accesibilidad (footer heading-order).

## Reglas que no se rompen
- Anuncios pagos ≠ SEO orgánico (la Final URL de un ad no afecta ranking).
- No prender/apagar campañas (reinicia el aprendizaje del algoritmo).
- Nunca quitar el 301 `doortudoor.com → dtdcargo.com` · no dejar expirar el dominio viejo.
- GA/analítica fuera de rutas privadas (PII).

## Ver también
- [`seo.md`](seo.md) — bitácora SEO (rename, migración de dominio, geo, redirects).
- [`README.md`](README.md) — hub Marketing (índice de todas las áreas).
