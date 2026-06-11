# Handoff: App de teléfono DTD-Cargo (paquete completo)

## Overview
Paquete de diseño de **la app de teléfono** de DTD-Cargo: **un solo APK** para todos los
usuarios y todos los tenants. La app pide siempre usuario + contraseña; el backend
devuelve `tenant + role + permissions` y la app **rutea al área correcta** (operario de
recepción, almacenista, transportista, o picker multi-rol). Incluye la lógica de
**sesión persistente** (login único → PIN/biometría para el día a día) y recuperación
de acceso por admin.

Este bundle reúne los prototipos de diseño + la spec escrita para reimplementar el
paquete en un codebase real.

## About the Design Files
Los `.html`/`.jsx` de este bundle son **referencias de diseño hechas en HTML** — prototipos
que muestran el look y el comportamiento buscado, **no código de producción para copiar
tal cual**. La tarea es **recrear estos diseños en el entorno del codebase destino**
(React Native, Flutter, Swift/Kotlin, PWA, etc.) usando sus patrones y librerías. Si aún
no existe entorno, elige el más adecuado (para "un APK multiplataforma offline-first", una
PWA instalable o React Native/Capacitor son buenas opciones) e implementá ahí.

Son **React in-HTML sin build** (Babel en el navegador) montados sobre el sistema de
diseño del ERP (`erp/tokens.css`, `erp/icons.jsx`). Abrilos en un navegador para verlos.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, spacing e interacciones son los finales del
sistema DTD-Cargo. Recreá la UI pixel-perfect usando las librerías/patrones del codebase
destino, respetando los tokens (abajo) y `CLAUDE.md`.

## Cómo leer este bundle
1. **`CLAUDE.md`** — guardrails de marca (reglas absolutas: paleta, tipografía, anti-AI-slop).
2. **`HANDOFF-MOBILE.md`** — **la spec completa del paquete**: principio de un APK, ruteo por
   rol, modelo de tokens, PIN/biometría, recuperación por admin, apps/flujos existentes,
   offline-first, endpoints conceptuales y orden de implementación. **Empezá acá.**
3. **Este README** — resumen de pantallas, tokens y archivos.

---

## Screens / Views

### A. Sesión (spec visual: `Login y Sesión · Operario.html`)
Canvas con 6 estados, cada uno una pantalla de teléfono (≈300×636):

1. **Primer ingreso** — hero navy (gradiente `--ink → #1F3055`) con logo `-reverse`;
   campos Usuario + Contraseña (con toggle ojo), toggle **"Recordar este dispositivo"** (ON),
   botón **Entrar** (wine), link "¿Olvidaste la contraseña? → Pide un reset a tu supervisor".
2. **Dispositivo vinculado + crear PIN** — badge éxito + "Quedó vinculado a este teléfono",
   teclado numérico, dots de PIN, toggle "Activar huella / Face ID".
3. **Desbloqueo diario · PIN** — avatar "RB", "Hola, Ramón · Sesión activa · sin contraseña",
   teclado + dots, chip "Usar huella", "¿No sos Ramón? · Cerrar dispositivo".
4. **Desbloqueo biométrico** — pantalla navy full, glifo de huella en círculo wine-soft,
   "Desbloqueá con tu huella", botón fallback "Usar PIN".
5. **Sesión expirada → re-login** — ícono reloj (warning), "Pasaron 90 días sin actividad",
   botón "Volver a iniciar sesión", nota verde "Tus datos siguen seguros".
6. **Reset desde el ERP (admin)** — panel ancho (720×460): fila del operario con acciones
   **Resetear PIN / Forzar re-login / Revocar acceso** + panel "PIN temporal generado"
   (`4821`, vence 24 h) + nota: recuperación por admin para operarios, email/SMS solo Portal.

### B. Apps/flujos de operario (prototipos completos)
- **`Operario · App.html`** — **APK único (entry oficial):** login usuario+contraseña → auth
  mock → ruteo por rol → multi-rol abre picker "¿Qué haces hoy?" (Soy almacenista / Soy
  transportista) → home del modo, con sesión persistente (PIN). **Modo Bodega** = Recibir
  contenedor + Despachar camión; **Modo Chofer** = Rutas asignadas + Iniciar ruta. Cambio
  de modo en el menú ☰.
- **`Bodeguero VE.html`** — recibir contenedor (lista → escaneo de cajas con progreso) +
  despachar camión (Camión → Chofer → **Items "¿Qué cargás?"** → pase QR/handoff).
- **`Operario VE.html`** — chofer/entrega: rutas asignadas → cargar camión sellado →
  confirmar → ruta GPS → docs → firma → POD.
- **`Camionero.html`** — ruta activa con GPS, foto de fachada, llegada y POD por parada.
- **`Operario CN.html`** — recepción/inspección Yiwu (ES/中文): escaneo o manual → fotos →
  identificar → datos (HS/CBM/peso) → confirmar.
- **`Despacho · Vista 3.html`** — variante avanzada de despacho con cola por ruta.

> Detalle de layout/flujo de cada app: ver `HANDOFF-MOBILE.md` § "Apps y flujos que ya existen".

---

## Interactions & Behavior
- **Ruteo por rol** tras login: `operario` → recepción; `almacenista` → bodega;
  `transportista` → **directo a su ruta** (confirma carga asignada); **multi-rol** → picker.
- **Sesión persistente:** primer login con contraseña → tokens (access corto + refresh
  largo en almacenamiento seguro) → renovación silenciosa al abrir → PIN/biometría diario.
  Re-login solo si expira o el admin revoca.
- **Offline-first:** sesión/PIN sin red; cola de outbox para escaneos/fotos/POD/firmas;
  precarga del día; sync al volver la señal; servidor = verdad ante conflictos.
- **Cambio de modo (multi-rol):** vía menú ☰, no en el centro (cambiar es la excepción).
- **Navegación back:** cada sub-flujo vuelve al home del modo.

## State Management
- `session` (tokens, tenant, role, permissions), `unlocked` (PIN/biometría OK),
  `mode` (multi-rol: bodega|chofer), por flujo: `view`/`step`, `route`/`container`
  seleccionados, `outbox` (cola offline). En el prototipo todo es `useState` +
  `localStorage`; en real, contra el seam `window.DTDApi` / `window.DTDAuth`.

## Design Tokens (de `erp/tokens.css` — no re-derivar)
- **Color:** `--wine #7F0F1A` (deep `#5E0A12`, soft `#C2747F`), `--bg-base #FBFAF7`,
  `--bg-surface #FFFFFF`, `--bg-elevated #F2F0EC`, `--bg-sidebar/--ink #0F1E3D`,
  `--ink-soft #6B6B6B`, `--ink-mute #9B9B9B`, `--border #E8E6E2`. Semánticos:
  `--success #1F8A5B` · `--warning #B8893A` (dorado) · `--danger #A8323E` · `--info #2A6FDB`
  (cada uno con `-bg`). Único gradiente permitido: `linear-gradient(135deg, var(--ink), #1F3055)`.
- **Tipografía:** sistema → **Nunito Sans** (`--f-sans`) + **Sora** (`--f-display`);
  códigos → **JetBrains Mono** (`--f-mono`); chino → Noto Sans SC. Logo/branding →
  Archivo / Archivo Black. Ninguna otra.
- **Spacing:** escala 4px (`--s-1 4px` … `--s-16 64px`).
- **Radius:** `--r-xs 3` · `--r-sm 5` · `--r-md 7` · `--r-lg 10` · `--r-xl 14` · `--r-pill 999`.
- **Sombras:** `--shadow-xs … --shadow-pop`.

## Assets
- Logo (4 variantes oficiales, en `assets/`): `dtdcargo-isologo-primary/reverse/mono-light/mono-dark.png`.
  Sobre navy usar **`-reverse`** (cream nativo) — **nunca** `filter: invert` sobre el isólogo.
  Ver `BRAND-MIGRATION-2026-05.md`.
- Íconos: set `window.Icon` (`erp/icons.jsx`) — nunca emoji decorativo en UI de producto.
- La huella del flujo biométrico es un glifo SVG iconográfico propio (en el HTML de sesión).

## Screenshots (`screenshots/`)
Referencias renderizadas fieles:
- `01-sesion-canvas.png` — los 4 estados de sesión de teléfono (login on-brand, vinculado, PIN, biometría).
- `07-sesion-expirada.png` — estado 5 (sesión expirada → re-login).
- `08-reset-erp.png` — estado 6 (reset de acceso desde el ERP: PIN temporal 24 h).
- `05-camionero.png` — home del transportista (ruta del día + GPS).

> Las pantallas de **login** de cada app de operario (navy hero + teclado PIN) están
> representadas fielmente en `01-sesion-canvas.png`. Para ver cada app completa, abre su
> `.html` (los thumbnails por-app se omiten: el generador de miniaturas no carga la
> webfont Sora y parte el título del hero, un artefacto de captura — el render real es
> correcto).

## Files (en este bundle)
- **Docs:** `CLAUDE.md`, `HANDOFF-MOBILE.md`, este `README.md`.
- **Sesión:** `Login y Sesión · Operario.html` + `design-canvas.jsx`.
- **Apps:** `Operario · App.html` (entry único), `Bodeguero VE.html`, `Operario VE.html`, `Camionero.html`,
  `Operario CN.html`, `Despacho · Vista 3.html`.
- **Lógica:** `operario/{app,ve,bodeguero,bodeguero-despacho,camionero,avisos}.jsx`.
- **Sistema de diseño:** `erp/{tokens.css, icons.jsx, data.jsx, components.jsx, data-bridge.jsx, od-bridge.jsx, rates.jsx}`.
- **Assets:** `assets/dtdcargo-isologo-*.png` (sistema oficial v1.0; el raster viejo `dtdcargo-icon-navy.png` fue eliminado).

> Los `.html` referencian `erp/…`, `operario/…`, `design-canvas.jsx` y `assets/…` con rutas
> relativas, preservadas en este bundle para que abran en el navegador.
