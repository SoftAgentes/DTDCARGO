# HANDOFF NORTE · Rediseño del Ciclo del Cliente (reemplazo del "360°")

> **Para Claude Code:** este documento es la spec para implementar en Norte (producción web,
> `www.dtdcargo.com`) el rediseño que aprobamos en este proyecto. Este proyecto es la **fuente de
> verdad de la marca** (ver `CLAUDE.md` §Sincronización). Ante conflicto entre Norte y esto,
> **gana esto**. Aplicá en orden. No reinterpretes valores: usá los tokens de `erp/tokens.css`.

**Fecha:** 2026-06-13 · **Versión visible:** v3.7 · **Archivo de referencia (vivo):** `ciclo/Hero Web · Ciclo DTD.html`

---

## 0 · Qué cambia, en una línea

Se **elimina el badge circular "360° PUERTA A PUERTA"** del hero de `www.dtdcargo.com` (no se
entendía y no coincidía con el servicio) y se reemplaza por el **Ciclo del Cliente**: una cinta
en bucle, sobre **fondo blanco**, con un contenedor que la recorre y 4 estaciones nombradas.
Comunica el proceso real, repitiéndose "cada envío".

> **DECISIÓN FINAL (2026-06-13):** versión **SIN contenedor de fondo** (bucle limpio sobre
> blanco). Se evaluó una marca de agua del contenedor al 30 % y 45 % detrás del bucle y **se
> descartó** — el cliente eligió el bucle limpio. **No** agregar el contenedor de marca de agua
> detrás del bucle.

---

## 1 · Eliminar en Norte

| Qué | Por qué |
|---|---|
| Badge **"360°"** / "360° PUERTA A PUERTA" del hero (imagen o componente) | Reemplazado por el Ciclo del Cliente. Cero referencias a "360" en el hero. |
| El **contenedor grande estático** como única arte del hero | El contenedor ahora vive únicamente **viajando en la cinta** del bucle. No va una copia gigante estática ni una marca de agua de fondo. |

> El asset del contenedor (`assets/container.svg`) **se conserva** en el repo (se usa en otras
> piezas de marca), pero **en este hero NO se usa como fondo**. El único contenedor visible es el
> que viaja por la cinta (SVG ~44×30 inline).

---

## 2 · El concepto · 4 pasos (NO 5)

El ciclo es de **4 estaciones**, en este orden, en bucle:

| # | Etiqueta (visible) | Subtítulo | Ícono (outline 1.7px) |
|---|---|---|---|
| 1 | **Cotiza** | DDP | hoja de cálculo / calculadora |
| 2 | **Compra** | Prealerta | bolsa de compra |
| 3 | **Recibimos** | En China | caja / paquete |
| 4 | **Entregamos** | A tu puerta | casa / puerta |

🛑 **Regla de marca (no romper):** **Compra, Orden y Prealerta son el MISMO registro**
(`CLAUDE.md` §Terminología · Compra/Orden/Prealerta). Por eso **"Prealerta" es subtítulo de
"Compra"**, NO un quinto paso aparte. No agregar un nodo "Pre-alerta" separado. En el portal el
CTA sigue siendo **"Cotizar DDP"** / "Nueva compra" — el ciclo no cambia esos CTAs.

Centro del bucle: ícono de bucle (flechas circulares) + eyebrow **"Con Confianza"** (C mayúscula,
es palabra-valor de marca) + tagline **"de China a tu puerta"**.

---

## 3 · Tokens y estilo (paleta clara · fondo blanco)

El hero va sobre **fondo blanco** (`var(--bg-surface)` = #FFFFFF). El bloque del ciclo es
**transparente** (se funde con la página), sin tarjeta navy ni borde; solo sombras suaves bajo
las estaciones. Nada de hex inventados — todo sale de `erp/tokens.css`.

| Elemento | Valor (token) |
|---|---|
| Fondo página / hero | `var(--bg-surface)` (#FFFFFF) |
| Fondo del bloque ciclo | `transparent` |
| Pista (track) base | `rgba(15,30,61,0.09)`, `stroke-width: 16` |
| Pista flujo (animada) | `var(--wine)`, `dasharray 6 14`, `opacity .85` |
| Dot de estación | fondo `var(--wine)`, ícono `#F2F0EC`, **aro** `3px var(--bg-surface)`, sombra `0 8px 18px rgba(127,15,26,0.28)` |
| Etiqueta estación | `var(--ink)` (Sora 700) · número en `var(--wine)` |
| Subtítulo estación | `var(--ink-mute)` (Nunito Sans 600, uppercase, `0.08em`) |
| Centro · eyebrow + ícono | `var(--wine)` |
| Centro · tagline | `var(--ink)` (Sora 700) |
| Contenedor de marca (watermark) | **No se usa** en este hero (decisión final: sin contenedor de fondo). |

Tipografía (sistema): **Sora** (`--f-display`) en titulares/etiquetas, **Nunito Sans**
(`--f-sans`) en subtítulos/cuerpo. Wordmark "DTD Cargo" del nav sigue en **Archivo Black**
(`--f-brand-display`): `DTD` wine + `Cargo` navy, gap `0.15em`. Sin Inter/Roboto/etc.

### Geometría del bucle (viewBox 640×640)
- **Track (cinta):** `M230,200 H410 A90,90 0 0 1 500,290 V350 A90,90 0 0 1 410,440 H230 A90,90 0 0 1 140,350 V290 A90,90 0 0 1 230,200 Z`
- **Estaciones:** (250,200) y (390,200) arriba · (390,440) y (250,440) abajo. Las de abajo invierten el orden vertical (ícono debajo del texto) con `flex-direction: column-reverse`.
- **Contenedor viajero:** SVG ~44×30 (rect wine con líneas de corrugado), animado sobre el mismo path con `offset-path` + `offset-rotate: auto`.

### Animaciones (gatear con `prefers-reduced-motion: no-preference`)
- `track-flow`: `stroke-dashoffset` marcha 1.5s lineal infinito.
- contenedor viajero: `offset-distance 0→100%`, 12s lineal infinito.
- ícono central de bucle: `rotate 360deg`, 16s lineal infinito.
- En `reduced-motion` y en SSR/print: estado final visible (sin animación). El contenido NO depende del JS de animación.

---

## 4 · Layout del hero (referencia 1280×800)

- **Nav** (h72): wordmark "DTD Cargo" izquierda · links *Servicios / Rastrea / Nosotros* + botón **"Cotizar DDP"** (wine) a la derecha.
- **Columna texto** (izquierda, ~470px): eyebrow "Importación puerta a puerta · CN → VE" · H1 **"Con Confianza, de China a tu puerta."** (Confianza en wine) · subtítulo · CTAs **"Cotizar DDP"** (primary wine) + **"Rastrear envío"** (secondary).
- **Bucle** (derecha): el Ciclo del Cliente, fondo blanco, contenedor de marca al 45% detrás.
- Responsivo: en ≤ tablet, el bucle pasa **debajo** de la columna de texto (apilado), centrado, ancho máx ~520px. En móvil mantené las 4 estaciones legibles (no encojas tipografía por debajo de los mínimos del sistema).

---

## 5 · Implementación en el repo (Norte)

1. Crear un componente de producción, p. ej. `components/hero/CicloCliente.{jsx,tsx}` (seguí el
   patrón de componentes del repo; **no** Tailwind, **no** CSS-in-JS libs — estilos con tokens,
   igual que el resto). Reusar el ícono-set del sistema si existe equivalente; si no, los SVG
   outline van inline a 1.7px.
2. Sustituir el bloque del hero que hoy renderiza el badge 360 + contenedor estático por
   `<CicloCliente />`.
3. Datos del ciclo como array (`label`, `sub`, `icon`) — no hardcodear repetido. Mantener el
   orden de §2.
4. El watermark consume `assets/container.svg` del repo (mismo asset de marca). No duplicar.
5. Accesibilidad: el bucle es decorativo-informativo → las etiquetas de paso van como **texto
   real** (no solo SVG); `aria-hidden` solo en los adornos (pista, contenedor viajero, velo).
6. Verificar contraste: ink sobre blanco y wine sobre blanco cumplen; el watermark al 45% queda
   bajo el velo, no compite con el texto.

---

## 6 · Aceptación (checklist)

- [ ] Cero "360" en el hero (texto, alt, clases, assets).
- [ ] 4 estaciones, orden correcto, "Prealerta" como subtítulo de "Compra" (no 5º paso).
- [ ] Fondo del bloque blanco/transparente, fundido con la página; sin tarjeta navy.
- [ ] **Sin contenedor de marca de agua** detrás del bucle (bucle limpio sobre blanco).
- [ ] Animaciones suaves; con `reduced-motion` se ve el estado final.
- [ ] Tokens del sistema en todo (cero hex nuevos); fuentes Sora/Nunito/Archivo Black.
- [ ] Tagline "Con Confianza, de China a tu puerta." con C mayúscula.
- [ ] CTAs intactos: "Cotizar DDP" / "Rastrear envío".

---

## 8 · Activo de marca · variantes del ciclo (para usos varios)

Además del hero, los **3 conceptos del ciclo** quedan como activo de marca reutilizable, cada uno
en **fondo navy y fondo blanco** (6 piezas), con descarga PNG por pieza:

- **A · Anillo de proceso** (navy / blanco)
- **B · Órbita del isólogo** (navy usa isólogo *reverse*; blanco usa isólogo *primary*)
- **C · Cinta en bucle** (navy / **blanco = aprobado para el hero web**)

Archivo: `ciclo/Ciclo DTD · Variantes de marca.html` (+ `ciclo/cycles-themed.jsx`). Usos previstos:
**presentaciones, cursos de Alibaba, redes y plantillas de propuesta**. En Norte, exponerlo en el
hub de herramientas del Brand Book (§08, ya enlazado en este proyecto). Mismas reglas: 4 pasos,
"Prealerta" como subtítulo de "Compra", tokens v3.7.

---

## 9 · Al terminar (este rediseño)

1. Registrar en la bitácora de Norte: **"Hero rediseñado · Ciclo del Cliente reemplaza 360° · sync 2026-06-13 · v3.7"**.
2. Confirmar que no quedó ninguna copia del badge 360 en otras páginas (footer, about, landing de campañas). Si aparece en más vistas, aplicar el mismo `<CicloCliente />` o una variante compacta.
3. Si se necesita una **variante compacta** (badge de esquina, como el viejo 360 pero con el bucle): pedir spec — este handoff cubre la versión hero grande. El proyecto puede generar la compacta.

> **Nota de versiones del concepto:** se evaluaron 3 conceptos (A · anillo de proceso, B · órbita
> del isólogo, C · cinta en bucle). **Aprobado: C**, y dentro de C la variante **SIN contenedor de
> fondo** (se descartaron 30 % y 45 %). Los conceptos A/B quedan archivados en
> `ciclo/Ciclo del Cliente · DTD-Cargo.html` y la comparación de intensidades en
> `ciclo/Comparar Hero Web · Ciclo.html`, por si se retoman.
