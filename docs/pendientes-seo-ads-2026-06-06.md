# Pendientes — SEO · Ads · Performance (sesión 2026-06-06)

> ⚠️ **SUPERADO (2026-06-07).** Este checklist quedó atrasado. El estado actual + el plan de acción vivo están en **[`docs/marketing/plan-accion-digital.md`](marketing/plan-accion-digital.md)** (incorpora todo lo de hoy: migración de dominio, rename, GA4 verificado, Ads migrado, etc.). Se conserva como registro histórico.
>
> Checklist original (sesión 06-06):

---

## 🔴 TUYO — manual (lo único que falta para que RINDA en resultados)

- [ ] **Search Console** → Inspección de URLs → **Solicitar indexación**:
  - [ ] El hub `https://dtdcargo.com/importar-de-china`
  - [ ] Las 13 geo-ciudades nuevas de hoy (puerto-la-cruz, maturin, puerto-ordaz, san-cristobal, merida, punto-fijo, coro, margarita, ciudad-bolivar, acarigua, valera, cumana, san-fernando)
  - [ ] **"Validar corrección"** del aviso del video (`uploadDate`) en el reporte correspondiente
- [ ] **Google Ads** → conversión "Click WhatsApp":
  - [ ] Dar **"Aceptar y finalizar"** para guardarla (si no lo hiciste)
  - [ ] Confirmar que pase de "No se registran conversiones" a **"Activa"** (tarda horas)
- [ ] **Reseñas** → mandar el mensaje de WhatsApp con el link de Google a clientes conformes

---

## 🟡 OPCIONAL — lo hace Claude cuando quieras

- [ ] **Performance 96 → ~99** (móvil): separar `globals.css` del CSS del Studio (CSS render-blocking, mete el LCP en verde) + `browserslist` moderno (−14 KiB de JS legacy)
- [ ] **Artículos de blog SEO** — el gran movimiento de contenido que falta (pasa por el CMS del Studio, `news_posts`)
- [ ] **Limpiar el lío de Google**: elegir UNA propiedad GA4 oficial (sugerencia: `G-25CD7BZH98`) + borrar los 2 contenedores GTM que no se usan (`GTM-KWRDZS4`, `GTM-PD3JF2GW`)
- [ ] **Accesibilidad** — fix del heading-order del footer (h4 saltado; invisible, sube el score). *Contraste = decidido mantener el tono sutil.*
- [ ] **Consistencia geo ↔ calculadora**: los geo de ciudades lejanas dicen *"el recargo por km que ves en la calculadora"*, pero el dropdown de la calc ahora es **solo casco-central** (decisión founder, per-km en revisión). → o reactivar esas ciudades en la calc, o suavizar el texto de esos geo.

---

## ⚠️ DEUDA TÉCNICA — no es del SEO

- [ ] **Gate del harness rojo**: error `react-hooks/set-state-in-effect` en `lib/studio/hooks/use-realtime-refresh.ts` y `use-realtime-table.ts` (Realtime del Studio, pre-existente). NO es de SEO/Ads.
- [ ] **`chore/seo-faq`** quedó con un commit de merge en la historia (contenido idéntico a prod; `git reset --hard origin/main` lo deja lineal — cosmético).
- [ ] **Commit de calculadora** (`48a850b`, otra ventana) está en `chore/seo-faq` pero **no deployado a main** → lo sube esa ventana.

---

## ✅ Hecho hoy (referencia, todo en prod)

- **SEO**: 18 geo-ciudades + hub `/importar-de-china` con silo · og:image + twitter en las 30 páginas · titles ≤60 + descripciones ≤160 · VideoObject `uploadDate` válido · links internos del geo en `<Link>` (SPA).
- **Performance**: lazy-load de los 3 videos + posters WebP → móvil **69 → 96** (LCP 6.6s → 2.7s).
- **Google Ads**: conversión "Click WhatsApp" (`AW-561290482/qbu2CILjn7ocEPK50osC`) cableada en `Analytics.tsx` + CSP desbloqueado (googleadservices.com + doubleclick.net + google.com).
- **Ramas**: `chore/seo-faq` reconciliada con prod; commits selectivos sin pisar la otra ventana.
