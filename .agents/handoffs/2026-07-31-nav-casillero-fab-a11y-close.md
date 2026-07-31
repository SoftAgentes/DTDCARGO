# Cierre · nav, regla del "Casillero" y accesibilidad del FAB

**Fecha:** 2026-07-31 · **Rol:** integrador (checkout principal) · **Estado:** CERRADO

Segundo lote del día. El primero está en `2026-07-31-web-publica-cbm-redes-nav-close.md`.

| Commit | Publicado | Qué |
|---|---|---|
| `6ad09334` | `eafec42e..1007d542` | nav: Tarifas primero, "Acceder", "Ayuda" al final |
| `3e67c999` | `50d218aa..fcc0af3b` | "Casillero" atado, FAB por teclado, contraste del glifo |

## 1 · Nav

Orden nuevo: **Tarifas · Servicios · Pre-alertas · Actualidad · Acceder ·
Contáctenos · Ayuda ⌄ · [Regístrate]**. Tarifas primero porque es la pregunta con
la que llega el visitante. "Mi portal" → **"Acceder"**.

"Ayuda" se movió al final y por fin se lee como desplegable: el indicador era un
`▾` **gris de 9px** que no comunicaba nada; ahora es un chevron **wine de 11px**
que gira 180° al abrir, en escritorio y en el menú móvil. El panel pasó a dos
columnas con títulos (**Aprender** / **Soporte**) — opción C de tres que se
maquetaron para el founder en `C:\Users\Trabajo\Downloads\nav-opciones-dtd.html`.

⚠️ **El Norte del founder tiene material de nav público que NO está en el repo.**
En el lote anterior se reportó "el Norte no norma el nav público"; eso es cierto
para `docs/design/`, pero el founder mostró una captura de Cloud Design con el
nav (orden, "Acceder", chevron wine) que nunca se sincronizó. **Es drift de
NORTE-SYNC, no ausencia de diseño.** Al tocar el nav, pedir la captura vigente
antes de concluir que no hay norma.

## 2 · Regla del "Casillero" (founder)

**"Casillero" tachado va SIEMPRE pegado debajo de "Shipping Mark".** Es el gesto
pedagógico que ancla el término: el cliente ex-courier reconoce "casillero", lo
ve tachado, y entiende cómo lo llamamos nosotros.

Estaba suelto en el JSX del hero — y por eso **el CTA del cierre del home decía
"Shipping Mark" SIN el tachado**: la mitad del gesto se había perdido sin que
nadie lo notara. Ahora el par vive en
[`components/ShippingMarkCta.tsx`](components/ShippingMarkCta.tsx): no se mueve,
no se olvida, y un tercer CTA de registro hereda la regla con solo usar el
componente.

⭐ **El tachado usa `currentColor` + opacity, no un color fijo.** Este CTA
aparece sobre fondos opuestos: `btn-ghost` (texto oscuro sobre papel) en el hero
y `btn-primary` (texto blanco sobre wine) en el cierre. El `--color-grey-500` que
tenía se leía en el primero y **desaparecía** en el segundo — el mismo bug de
tokens que voltean de siempre. Medido con opacity 0.7: **6.05:1** en el hero y
**5.76:1** sobre el wine.

## 3 · FAB alcanzable por teclado

El speed dial ahora abre también al **recibir foco**. Las redes secundarias eran
inalcanzables por Tab: viven en `tabIndex={-1}` mientras el menú está cerrado, y
el menú solo abría con mouse o toque. Cierra solo cuando el foco sale del stack
entero (`relatedTarget`), para no colapsarlo al pasar de WhatsApp a Instagram.

## 4 · Contraste de los glifos

El glifo blanco del FAB de WhatsApp medía **1.54:1** contra el brillo de su
esfera.

⚠️ **Dato que conviene no re-descubrir: ni el verde oficial `#25D366` alcanza el
umbral — da 1.98:1 con blanco encima.** No hay forma de cumplir 3:1 conservando
el verde exacto de la marca. Como el glifo está centrado, manda el stop del 42%:
pasó a `#1FA350` → **3.27:1**. El brillo claro quedó arriba a la derecha, FUERA
del glifo, así que la esfera se sigue leyendo como WhatsApp. Si el founder ve el
verde muy oscuro, se revierte cambiando ese stop.

Además, `drop-shadow` sutil bajo los glifos de las cuatro esferas: les da borde
propio contra el relleno, que es lo que WCAG 1.4.11 valora en un gráfico.

## Rutas propias

```
components/Nav.tsx
components/ShippingMarkCta.tsx   (nuevo)
components/WhatsAppFAB.tsx
app/page.tsx
app/globals.css
```

## Verificación

`pnpm typecheck` limpio · `pnpm lint` sin errores · **4362 tests verdes**.

🔴 **La verificación VISUAL no se pudo hacer, y no por el código.** El dev server
devuelve 500 con un panic de Turbopack al lanzar PostCSS:

```
Failed to write app endpoint /page
- [project]/app/globals.css [app-client] (css)
- creating new process
- node process exited before we could connect to it with exit code: 0xc0000142
```

`0xc0000142` = STATUS_DLL_INIT_FAILED. **Causa real: la máquina tenía 295
procesos node ocupando 9 GB, con 1.5 GB libres de 32 GB.** No es el virtual store
de pnpm (`pnpm install` → "Already up to date"), es falta de recursos para lanzar
el subproceso. Vercel compila en su propia infra, así que el build de producción
no lo arrastra.

**Para la próxima ventana que se tope con esto:** contar procesos con
`Get-Process node` antes de culpar al código. La cura es cerrar ventanas o
reiniciar; matar los 295 a ciegas puede tumbar trabajo ajeno.

## Trabajo ajeno preservado

Este checkout está compartido: al cerrar había **4 archivos modificados y 7 sin
trackear que no son de esta ventana** (investigación de VPS, spec 0224,
decisiones de arquitectura, docs de privacidad, PROMPT-SESION-3). No se tocó
ninguno; el staging fue nominal, archivo por archivo. Antes del merge se
verificó que el commit entrante de `origin` no tocaba los 4 archivos abiertos.

## Falsas alarmas del lote anterior (cerradas)

1. **Colisión de las dos migraciones 0297** — no hay nada que arreglar y tocarlo
   rompería el gate. Las dos están aplicadas en prod con su basename exacto
   (ledger `20260731034447` y `20260731034549`). El repo tolera 9 números
   duplicados; los scripts usan el **basename** como identidad, no el número.
   Renombrar cualquiera la volvería invisible al gate → rojo en falso, el modo
   de fallo que mató a la 0228.
2. **Barrido MARKBOX → Shipping Mark** — ya estaba hecho. No queda ninguna
   aparición visible en la web pública; solo 3 keywords SEO deliberadas (con
   comentario "Alias heredado por SEO") e identificadores internos.

## Siguiente responsable

Ninguno para este trabajo. Pendiente de otra ventana: el rojo de `sql-tests`
(0271–0276, SDD-0118), comprobado preexistente sobre `origin/main` puro.
