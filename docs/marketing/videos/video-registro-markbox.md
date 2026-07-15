# Video tutorial — Regístrate y genera tu MARKBOX (Canva)

- **Fecha:** 2026-07-11
- **Formato:** vertical 1080×1920 (Reel / TikTok / Story)
- **Producción (decisión del founder):** el cuerpo del video es la **grabación del demo interactivo** `docs/marketing/videos/registro-demo.html` (hecho en la sesión demo-registro, 2026-07-09), no tarjetas estáticas. Las 7 tarjetas generadas en Canva quedan como intro/cierre opcionales.
- **Grabación automatizada:** script Playwright (scratchpad `record-demo.js`): sirve `docs/` en `localhost:8791`, recorre login → registro → autollenado (Persona natural) → MARKBOX `DTD-9999` → guía → portal impersonado (`?as=DTD-5452` + swap de texto en DOM a `DTD-9999` / "Pérez" para continuidad). Oculta los botones REC y el panel de guion. Salida: MP4 H.264 1080×1920, ~46 s, en `Downloads/dtd-demo-registro-markbox-2026-07-11.mp4`.
- **Narración:** usar los 7 pasos del `SCRIPT_STEPS` embebido en el propio demo (tono directo, tuteo).
- **Variantes grabadas (2026-07-11, en `Downloads/`):**
  - `dtd-demo-registro-markbox-2026-07-11.mp4` — dark · Persona natural (~46 s)
  - `dtd-demo-registro-markbox-claro-2026-07-11.mp4` — tema claro · Persona natural (~48 s; portal también en claro, forzado tras el auto-dark del demo)
  - `dtd-demo-registro-markbox-empresa-2026-07-11.mp4` — dark · Empresa (razón social + RIF J-, ~48 s)
  - El login siempre es navy (fijo por diseño, igual que el real). Grabador parametrizado: `DEMO_THEME=dark|light` · `DEMO_TYPE=persona|empresa`.
- **Regla de término:** público = **MARKBOX** (se aclara "tu shipping mark"); NO usar "casillero" — el flujo real de `/registro` nunca lo dice.
- **Fuente de verdad del flujo:** `app/registro/RegisterForm.tsx` + `app/registro/actions.ts` (registro express 1 paso, MARKBOX al instante, cuenta nace activa).

## Guion escena por escena

| # | Duración | En pantalla (texto grande) | Apoyo / narración |
|---|---|---|---|
| 1 | 0–4 s | **¿Compras en China?** Crea tu MARKBOX gratis en 1 minuto. | Hook. Logo DTD Cargo pequeño arriba. |
| 2 | 4–9 s | **Paso 1 · Entra a dtdcargo.com/registro** | URL bien visible, estilo barra de navegador. |
| 3 | 9–14 s | **Paso 2 · Elige tu tipo de cliente** | Dos tarjetas: "Persona natural — importas a título personal" / "Empresa — importas para tu negocio". |
| 4 | 14–20 s | **Paso 3 · Completa tus datos** | Lista: Nombre completo · Cédula (V/E/P) o RIF · Email · Teléfono WhatsApp. Nota: "Sin foto ni dirección — eso va después, en tu perfil." |
| 5 | 20–24 s | **Paso 4 · Toca "Crear cuenta y generar MARKBOX"** | Botón CTA idéntico al real. |
| 6 | 24–31 s | **¡Listo! Tu MARKBOX al instante** → tarjeta grande estilo la real (fondo vino, código mono): **DTD-0042** | "Tu shipping mark · 唛头 — la marca que va en tus cajas en China." + "Te llega un correo de bienvenida con tu código." |
| 7 | 31–38 s | **¿Y ahora?** Entra al portal con tu email (enlace de acceso, sin contraseña) | Bullets: "Completa tu perfil antes de tu primera compra" · "Registra cada compra = tu prealerta". |
| 8 | 38–43 s | **DTD Cargo — De China a Venezuela, puerta a puerta.** dtdcargo.com/registro | Cierre con logo + WhatsApp +58 412 166 8021. |

## Resultado en Canva (2026-07-11)

- **Video final ensamblado** (hook 4 s + demo 45 s + cierre 5 s, fundidos, 54 s): `Downloads/dtd-video-registro-markbox-FINAL-2026-07-11.mp4`, subido a Canva (cuenta fatimasaheli) vía Chrome.
- **Diseño de video en Canva:** "Video Registro + MARKBOX · DTD Cargo" — https://www.canva.com/design/DAHPF-j-zPs/k1Qnb0zRuyEhYzCC1cVwvg/edit (1080×1920, clip completo en la página). Ahí se agrega música/subtítulos y se descarga como MP4.
- Las 7 tarjetas de escena generadas con el kit de marca siguen como diseños individuales (reusables como carrusel).

## Notas de marca

- Colores/fuentes: kit de marca DTD Cargo en Canva (`kAGErV9aP6Y`); wine como acento del MARKBOX (como la tarjeta real de éxito).
- La escena 6 replica la jerarquía de la pantalla real de éxito: check verde → "¡Felicitaciones!" → tarjeta MARKBOX hero.
- El código de ejemplo `DTD-0042` es ficticio; el formato por compra (`DTD-0042-1-2` = MARKBOX-proveedor-compra) se menciona solo si hace falta una versión extendida.
