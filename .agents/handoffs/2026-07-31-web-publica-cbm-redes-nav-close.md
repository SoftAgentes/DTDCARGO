# Cierre · web pública: ayuda del CBM, redes sociales y CTA del nav

**Fecha:** 2026-07-31 · **Rol:** integrador (checkout principal) · **Estado:** CERRADO

## Alcance

Tres pedidos del founder en una sola sesión, todos de web pública. Ramas
separadas, integradas a `main` al cerrar.

| Rama | Commit | Qué |
|---|---|---|
| `fix/cbm-ayuda-panel` | `29fc72a9` | el panel de ayuda del CBM no se cerraba nunca |
| `feat/redes-sociales` | `3586f6ca` | color de marca en iconos sociales + YouTube y TikTok en el flotante |
| `feat/nav-cta-registro` | `9969e054` | "Regístrate" pasa a ser el CTA del nav |

Merges: `b58f2cb7`, `8f6a5b4f`, `a0f4b5de`. Publicado `42707235..a0f4b5de`.

## 1 · El panel del CBM nunca se ocultaba

El popover llevaba la clase `flex` de Tailwind. Un popover cerrado se oculta con
el `display:none` del user-agent, y **cualquier clase de display de autor le gana
por especificidad** — así que el panel estaba visible desde que cargaba la página
(765×588 px en la esquina), la × cambiaba el estado interno pero no lo escondía, y
ni `Esc` ni el clic afuera lo cerraban. Los tres síntomas que reportó el founder
("sale a cada rato", "tapa la pantalla", "no le veo la X") eran ese único bug.

⚠️ **El estado de React SIEMPRE decía "cerrado" mientras el panel se veía.** Para
diagnosticar esto hay que mirar el `display` computado, no `aria-expanded` ni el
estado del componente. Aplica a cualquier `[popover]` o `<dialog>` del repo.

Cura: los dos estados viven juntos en `.glass-pop` (`app/globals.css`), donde no
se pueden desincronizar. Rediseño encima (elegido por el founder): vidrio
BD-031, panel de 431 → 266 px, × de 19×18 al 60 % → 44×44 reales, abre **arriba**
del botón porque el campo de CBM está justo debajo, caret que ancla el panel a su
botón, y entrada de 150 ms que respeta `prefers-reduced-motion`.

Token nuevo **`--glass-bg-strong`**: el `--glass-bg` normal asume fondo claro y
este panel flota sobre fondo MIXTO (papel + la tarjeta navy de la calculadora),
donde la tinta caía a 4.22:1. Medido sobre los 3 fondos reales: 12.4–16.5:1 en
texto, 7.9–10.5:1 en el acento wine.

## 2 · Redes sociales

Pie de página: cada icono toma el color de su red al `hover` / `focus-visible` /
`active` (los tres estados por separado: mouse, teclado y táctil, donde el hover
no llega o se queda pegado). Enlaces, orden y estado en reposo intactos.

Flotante: YouTube y TikTok se suman al speed dial. Nacen del **mismo píxel** que
Instagram (la dot wine del WhatsApp) y se despliegan escalonados 45 ms; al cerrar
se van los tres juntos. Repiten el patrón de `.fab-ig` en vez de refactorizar a un
`.map()` — el founder pidió explícitamente no tocar WhatsApp ni Instagram.

**BRAND-EXCEPTION** (autorizada por el founder, 2026-07-31): `#E1306C`, `#FF0000`,
`#25F4EE`, `#25D366` no son de la paleta DTD. Confinados a tokens `--social-*` en
`globals.css`, nunca sueltos en JSX. Contraste sobre el navy del pie (umbral 3:1
de WCAG 1.4.11): 3.8 · 4.12 · 11.98 · 8.31. El cian es el TikTok que se lee sobre
navy; su negro corporativo desaparecería.

## 3 · CTA del nav

El único botón de color, en las tres superficies, es ahora **"Regístrate"**.
"Contáctenos" baja a enlace de texto y se corre a la izquierda: casi todo el
contacto entra por WhatsApp, que ya tiene su botón flotante.

⚠️ **Esto NO viene del Norte.** Se verificó: el Norte v4.6 **no norma el nav
público**; lo único que dice de él es una línea del handoff del hero (v3.7,
2026-06-13) que ya no coincide con producción. Tampoco hay spec SDD ni doc de
marketing que fije la jerarquía del nav. Y "Regístrate" **nunca** estuvo en el nav
de escritorio — el único commit que tocó esa palabra en `Nav.tsx` fue `0b31c90f`
(barrido de voseo a tuteo), sobre el menú móvil. Es una decisión de producto
nueva, no la restauración de algo que se cayó. Queda documentada en el docblock
del componente para que no se deshaga por creerla un accidente.

Regresión que introdujo el propio cambio y se arregló acá: sumar "Contáctenos"
empujó la fila 30 px más allá del ancho de ventana a 1024 px (1039 de contenido en
1024 de viewport) → scroll horizontal y logo tocando el primer enlace. Se comparó
contra `main` para confirmar que era nuevo. Cura: gap y tipografía apretados SOLO
entre `lg` y `xl`. Verificado en 8 anchos (1024→1920): cero desborde; separación
logo↔menú a 1024 de 0 → 44 px.

## Rutas propias

```
app/globals.css
components/CbmAyuda.tsx
components/Footer.tsx
components/WhatsAppFAB.tsx
components/Nav.tsx
e2e/cbm-ayuda.spec.ts   (nuevo)
```

## Verificación

- `pnpm typecheck` · `pnpm lint` (0 errores) · `pnpm test` → **4249 tests verdes**.
- `node scripts/verify.mjs`: `e2e` **21 passed** (incluye los 2 nuevos de
  `cbm-ayuda.spec.ts`), `schema-rebuild` OK.
- Medición en navegador (Chromium) a 1366×768, 1024×768 y 390×844: geometría,
  contraste y ciclos abrir/cerrar. No se dio nada por bueno "a ojo".
- `e2e/cbm-ayuda.spec.ts` **validado con mutación**: reintroduciendo el
  `display:flex` falla con *"Expected: hidden / Received: visible"*. Vitest no lo
  habría agarrado — el bug vive en la cascada CSS real y jsdom no la aplica.

## 🔴 Bloqueo heredado (NO es de este trabajo)

`node scripts/verify.mjs` cierra en **FAIL por `sql-tests`**: 6 contratos rotos
(`0271`–`0276`), todos con `SDD-0118 … drift en <migración>`.

**Comprobado que es preexistente:** se corrió `scripts/run-sql-tests.mjs` sobre
`origin/main` puro (`42707235`, en detached HEAD, sin ninguno de estos cambios) y
**fallan exactamente los mismos 6**. Este trabajo es 100 % CSS/TSX y no toca SQL
ni migraciones, así que no lo causó ni lo puede arreglar.

`main` está rojo en ese paso desde antes de este cierre. Huele al patrón de
CRLF byte-exacto del ledger ya documentado en memoria (`.gitattributes` LF
rompiendo los CRLF del ledger). **Siguiente responsable: la ventana dueña de las
migraciones 0271–0276 / SDD-0118.**

## Migraciones / deploy

Ninguna migración creada ni aplicada. Nada tocado en Supabase. El deploy sale
solo: push a `main` → Vercel → producción.

## Pendientes que aparecieron de paso (no atendidos)

1. ⚠️ **Dos migraciones con el número 0297** en `supabase/migrations/`
   (`0297_container_types_activos_y_capacidad_util.sql` y
   `0297_legal_docs_body_hash.sql`) — colisión multi-ventana.
2. Por **teclado no se llega a las redes del flotante**: el stack solo abre con
   hover o clic y los enlaces quedan fuera del recorrido de Tab. Preexistente
   (Instagram ya era así); el founder pidió replicar esa metodología. Los mismos
   enlaces sí son accesibles desde el pie de página.
3. Sigue abierto el barrido **MARKBOX → "Shipping Mark"** en la web pública
   (BD-029).
4. El glifo blanco del FAB de WhatsApp mide **1.54:1** contra el brillo de su
   esfera (preexistente, fuera de alcance). El de YouTube se dejó en 3.08:1.

## Siguiente responsable

Ninguno para este trabajo — está en producción. El rojo de `sql-tests` queda para
la ventana de SDD-0118.
