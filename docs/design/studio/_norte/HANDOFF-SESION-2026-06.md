# Handoff sesión · 2026-06 · DTD Cargo → Norte (Claude Code)

> Versión: **v4.2 → v4.3** (esta sesión). Marca y producto comparten número visible.
> Compacto de lo entregado en esta sesión. Aplicar sobre el repo de producción ("Norte")
> respetando `CLAUDE.md` (tokens, fuentes, sin AI slop) y la versión vigente del Brand Book.
> Convención de handoff: este proyecto manda; ante conflicto, gana esto.

## 1 · Portal del Cliente — Próxima salida de contenedor
- **Nuevo:** tarjeta "Próxima salida" como primer bloque del Home (`portal/app.jsx` → `NextSailingCard`).
  Cuenta al **cut-off** (cierre de carga), granularidad en días; urgencia en **warning dorado** <48 h.
- **Eco** del mismo dato en "Nueva compra / prealerta" (`SailingDeadlineNote` en `PortalSuppliers`).
- Se **cargó `erp/modules/naviera-data.jsx`** en `Portal del Cliente.html` (antes no estaba).
  La salida se elige por el puerto del cliente (de su carga suelta), con fallback a la más cercana.

## 2 · Portal del Cliente — Panel de Tweaks
- `tweaks-panel.jsx` integrado en `portal/app.jsx` (PortalApp). 3 controles de "sensación":
  **Densidad** (`data-density`), **Titulares** (`--f-display`: Sora↔Archivo Black),
  **Forma** (remapeo de radios, sin pasar de 20px). Solo visible al activar Tweaks.

## 3 · Registro de Cliente (`portal/registro.jsx`) — reestructura de identidad
- **Acceso por correo + contraseña** (no por Shipping Mark): login del Portal y pantalla de éxito
  del registro ahora muestran **Correo** + contraseña (= cédula/RIF). El Shipping Mark sigue siendo
  el código operativo de cajas (tarjeta roja), ya no la credencial.
- **Cédula con prefijo** `V / E / P` (venezolano / extranjero / **pasaporte**); el usuario escribe
  solo el número (pasaporte admite alfanumérico). Se guarda `V-…`/`E-…`/`P-…`.
- **Teléfono con selector de código de país** (`PhoneInput`): **Venezuela (+58) por defecto**,
  EE.UU. (+1) segundo, +56 países. **Autodetecta** el código si el usuario teclea `+34…`
  (mueve el prefijo a la izquierda). Aplica a WhatsApp y oficina.
- **Foto de cédula/RIF → opcional** ("lo puedes hacer en el portal más adelante"); no bloquea.
- **Tel. de oficina → "recomendado"** (segundo número de contacto, no WhatsApp).
- Asteriscos de campo obligatorio en **rojo** (`var(--danger)`) — cambio en `erp/components.jsx`
  (Input/Select) + `SectionLabel`. Afecta todo el sistema (consistente).
- **Nota de dirección de entrega** (paso 2): aclara que es donde recibe la mercancía.
- Pantalla de éxito: aviso + guía **fusionados en un solo botón** que abre la guía; subtítulo
  centrado; saludo "Bienvenido a la familia de **DTD Cargo**".

## 4 · Academia DTD — vista del alumno (NUEVO)
- `portal/academia-data.jsx` (mock value-ladder: Curso 0 → Domina Yiwu → 0-a-Contenedor → 1688,
  con módulos/lecciones/`free_preview`, progreso por `client_markbox`, diplomas A/B/C/D) +
  `portal/academia.jsx` (`window.PortalAcademia`).
- **7 pantallas mobile-first:** Gate (no-miembro), Inicio, Detalle de curso, Reproductor,
  Mis diplomas, Cursos/Cohortes, Club (esbozo fase 2).
- Entregado en **dos formas** (mismo código): standalone iPhone (`Portal Academia · Alumno.html`)
  + pestaña **"Academia"** dentro de `Portal del Cliente.html` (`PortalAcademiaView`).
- Construir sobre `app/portal/(app)/academia/`. Video = placeholder (incrustar el real).
  Diplomas: 4 variantes + folio (JetBrains Mono) + QR a `dtdcargo.com/verificar`.

## 5 · Hub de Enlaces — link-in-bio de Instagram (NUEVO, canónico)
- `Enlaces · DTD-Cargo.html` (diseño inmersivo). **Eliminadas** las variantes A/B/C y el comparador.
- Va en **Brand Hub · Mensajería/Redes**; servir en `dtdcargo.com/enlaces` (esa URL en la bio de IG).
- Atribución: WhatsApp con etiqueta de origen (CRM) + enlaces web con UTM (analítica).
- Meta Open Graph/Twitter + `assets/og-enlaces.png` (1200×630). En prod: URL absoluta del og:image,
  reemplazar hrefs locales por URLs reales, sumar GA4/Plausible para clics.
- Ver `handoff-enlaces/HANDOFF.md` para el detalle de publicación.

## 6 · Vistas Móviles · visor unificado por persona (NUEVO)
- `Vistas Móviles · DTD-Cargo.html` (standalone): índice lateral (8 personas) + galería de
  iPhones lado a lado. Cada bezel embebe el **archivo móvil real** vía iframe (siempre al día):
  Portal Cliente Mobile, Academia (`academia-embed.html` — sin doble marco), Mobile ERP,
  Operario · App (login con PIN), Operario CN, Operario VE, Bodeguero VE, Camionero.
- `academia-embed.html` (NUEVO): monta `window.PortalAcademia` a pantalla completa para embeber
  sin el marco iPhone del standalone.
- En Norte: servir como página interna de revisión (QA de experiencia por rol). Las rutas de los
  iframes deben apuntar a las vistas móviles reales del repo.

## Archivos nuevos/clave de esta sesión
```
portal/academia-data.jsx · portal/academia.jsx        (Academia alumno)
Portal Academia · Alumno.html · frames/ios-frame.jsx  (standalone iPhone)
Enlaces · DTD-Cargo.html · assets/og-enlaces.png      (link-in-bio)
Vistas Móviles · DTD-Cargo.html · academia-embed.html  (visor móvil por persona)
handoff-enlaces/                                       (paquete del hub)
tweaks-panel.jsx                                        (panel de tweaks portal)
~ portal/app.jsx, portal/registro.jsx, erp/components.jsx, Portal del Cliente.html  (editados)
```
