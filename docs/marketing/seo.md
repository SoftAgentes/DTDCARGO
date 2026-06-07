# SEO — DTD Cargo (bitácora)

Historial y estado del SEO del **sitio público `dtdcargo.com`**. Parte del tree [Marketing](README.md).

## Estado actual (2026-06-07)

| Aspecto | Estado |
|---|---|
| Dominio | `dtdcargo.com` (nuevo). El viejo `doortudoor.com` redirige 301 (ver "Migración de dominio") |
| Sitemap | `dtdcargo.com/sitemap.xml` — 35 URLs (fuente: `app/sitemap.ts` + `lib/geo-zonas.ts` + posts DB) |
| Search Console | 2 propiedades: `dtdcargo.com` (dominio) + `https://doortudoor.com/` (url-prefix, la del traslado) |
| Analítica | GA4 `G-25CD7BZH98` (gtag.js, excluye rutas privadas) |

## Arquitectura SEO (dónde vive cada cosa)

- **Sitemap:** `app/sitemap.ts` (rutas fijas + geo-zonas + posts de noticias DB-backed).
- **Geo-páginas:** template `app/importar-de-china/[ciudad]/page.tsx` + data única por zona en **`lib/geo-zonas.ts`** (contenido verificado, no doorway pages). Agregar zona = un objeto ahí → ruta + sitemap + cross-links se generan solos.
- **Calculadora terrestre:** `app/calculadora-terrestre/page.tsx` + `components/UltimoKmCalculator.tsx` + tarifas en `lib/data/tarifas-terrestres-vzla.ts` (~80 destinos por zona 1-11, validado por operaciones DTD).
- **OG/social:** `lib/seo-og.ts` (`socialMeta`).
- **Redirects:** `next.config.ts` → `redirects()`.

## Cronología

### 2026-06-06 · Contenido SEO + geo-páginas
(memoria: `project_session_2026_06_06_seo_contenido`)
- **18 geo-ciudades** "Importar de China a {ciudad}" con contenido genuino por zona (ciudad+estado, km desde Valencia, casco vs recargo) + hub `/importar-de-china` con silo de links internos.
- `og:image` + twitter cards en las 30 páginas · titles ≤60 + meta-descriptions ≤160.
- **Performance:** lazy-load de 3 videos + posters WebP → móvil 69→96 (LCP 6.6s→2.7s).
- **VideoObject** (`components/WorkBand.tsx`): `uploadDate` ISO-8601 válido con zona horaria (`2026-06-05T12:00:00-04:00`).

### 2026-06-07 · Rename + migración de dominio + recuperación (esta sesión)
(memoria: `project_session_2026_06_07`)

**Rename `/cotizar → /estimacion`** (SDD-0061): redirect 308/301 permanente en `next.config.ts`. `/cotizar` ya no está en el sitemap; Google procesa el 308 solo y transfiere el ranking. Verificado en prod.

**Search Console (propiedad `dtdcargo.com`):**
- Sitemap re-enviado (`/sitemap.xml`).
- Indexación solicitada (cola prioritaria, ~10/día): `/estimacion`, `/calculadora-terrestre` + 6 geos metro (caracas, maracaibo, valencia, barquisimeto, maracay, puerto-la-cruz). Las 12 geos restantes las descubre el sitemap.
- 2 avisos del VideoObject (`uploadDate` falta zona horaria / valor no válido) → **validación iniciada** (el fix ya estaba en prod, eran avisos stale).

**Migración de dominio `doortudoor.com → dtdcargo.com`:**
- Verificado en vivo (curl): apex + www → **301 permanente path-preserving** (`/X → dtdcargo.com/X`). Server Vercel. **El 301 es el mecanismo que preserva el SEO.**
- **"Cambio de dirección" de Search Console ACTIVADO** (propiedad `https://doortudoor.com/` → destino `dtdcargo.com`, **iniciado 2026-06-07, ~180 días, reversible**). Checks obligatorios (301 home + verificación de ambos sitios) pasaron.
- Dato: el dominio viejo tenía huella orgánica **mínima** (~5 clics / 520 impresiones en 3 meses); su tráfico era casi todo pago (ads).

**Recuperación de páginas huérfanas** (6 redirects 301 en `next.config.ts`, en prod): páginas del sitio VIEJO sin slug equivalente en el nuevo que caían en 404 tras el 301:

| Slug viejo (doortudoor.com) | Impr. 3m | → Destino nuevo |
|---|---|---|
| `/como-calcular-metro-cubico-cbm-de-la-mercancia` | 397 | `/calculadora` |
| `/nosotros` | 21 | `/` |
| `/significado-del-incoterm-cif` | 18 | `/glosario` |
| `/mi-cuenta` | 15 | `/portal` |
| `/que-es-un-envio-puerta-a-puerta` | 12 | `/glosario` |
| `/icoterm-exw` | 10 | `/glosario` |

Cola larga (~30 páginas más, <10 impr c/u) = SEO despreciable, no se redirige individualmente.

**Geo↔calc:** se suavizó el texto `notaEntrega` de los 15 geos non-casco (sacó "recargo por km" + "al instante en la calculadora": impreciso + Cumaná/San Fernando no están en la calc) → "podés estimar ese tramo terrestre en nuestra calculadora; el costo exacto te lo confirma tu asesor por WhatsApp".

## 🛡️ Reglas SEO que NO se rompen

1. **Nunca quitar el 301** `doortudoor.com → dtdcargo.com`.
2. **No dejar expirar `doortudoor.com`** (registrado + redirigiendo ≥1 año).
3. **`doortudoor.com` NO debe volver a servir contenido propio.**
4. Al renombrar/eliminar una ruta pública con SEO → **siempre 301** del slug viejo (como `/cotizar`).
5. Anuncios pagos no afectan el SEO orgánico.

## Pendiente / monitoreo

- Monitorear el traspaso del "Cambio de dirección" en Search Console (~180 días): las URLs de `dtdcargo.com` deben ir reemplazando a las de `doortudoor.com` en los resultados.
- Si aparecen más páginas viejas con impresiones que caen en 404 → agregar su redirect en `next.config.ts`.
