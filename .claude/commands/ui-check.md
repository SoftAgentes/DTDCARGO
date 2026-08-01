# /ui-check — review liviano de UI/UX pre-commit (no bloqueante)

Corré el **check liviano de UI/UX** que exige la regla del founder ANTES de commitear una pantalla nueva o un cambio visual sustancial. Es **advisory, NO bloqueante**: señala, no traba. Reemplaza el prompt manual que se reescribía a mano en cada feature.

**Argumento (opcional):** ruta/glob de la pantalla a revisar (ej. `app/studio/(app)/reclamos`). Vacío = **el diff actual** (lo que cambió vs `main`).

## Qué hace

1. **Detectá el alcance visual.** Si hay argumento, usalo. Si no, sacá los archivos UI del diff:
   ```
   git diff --name-only main...HEAD -- '*.tsx' '*.css' 'app/**' 'components/**'
   git status --short -- '*.tsx' '*.css'
   ```
   Si no hay archivos UI cambiados → "Sin cambios visuales que revisar" y terminá.

2. **Cargá los guardrails** (no inventes criterio): `BRAND.md` (las 6 reglas) + el norte vigente (`docs/design/studio/_norte/CLAUDE.md` — marca) si el cambio es del Studio/portal/móvil. Recordá el split de marca: público=Archivo+MARKBOX, Studio/portal/móvil=Nunito+Sora+"Shipping Mark".

3. **Corre esta rúbrica sobre esos archivos** (inline, read-only; o delega a `design-critic` para una segunda lente). Pásale las rutas concretas:
   - **Marca:** solo tokens `var(--*)` (cero hex inventados); fuentes correctas por capa; **cero AI slop** (gradientes coloridos, glassmorphism, emojis decorativos, border-left random, undraw.co, centrado por default).
   - **Componentes del sistema primero** (Btn/Input/Badge/Card/Drawer/EmptyState…) antes de inventar.
   - **Spacing & jerarquía:** escala de 4px (`var(--s-*)`), sin px arbitrarios; jerarquía tipográfica clara; left-align.
   - **Estados:** hover/focus/disabled/empty/loading presentes y consistentes.
   - **Accesibilidad:** contraste, target táctil, `<label>` clicable, foco visible.
   - **Anchos fijos → MEDIDOS, no estimados.** Si el cambio fija un ancho de columna, chip o celda (`grid-cols-[…px]`, `w-[…px]`, `min-w-`), el ancho tiene que salir de medir el **string más largo posible** con la tipografía real, no de calcularlo a ojo:
     ```js
     const el = document.createElement('span');
     el.style.cssText = "position:fixed;left:-9999px;white-space:nowrap;" +
       "font:700 12.5px var(--font-jetbrains-mono), ui-monospace, monospace";
     document.body.appendChild(el);
     el.textContent = '−USDT 1,284,500.00';        // el peor caso REAL, no el típico
     el.getBoundingClientRect().width;              // → 116px
     ```
     Y agregá `whitespace-nowrap`: así un string más largo **desborda a la vista** en vez de re-maquetar la fila en silencio. *(SDD-0177: las columnas de monto salieron a 100px estimados; `−USD 128,450.00` mide 105 → el monto se partía en dos renglones y la fila crecía de 46px a 72px. Ningún test lo vio.)*
   - **Tono/copy:** tuteo venezolano (cero voseo), sin "responsabilidad", CTAs con verbo directo.

4. **Reportá** como checklist priorizado (alta/media/baja), cada hallazgo con **archivo:línea** y la corrección concreta dentro del sistema. Marcá con ⭐ el #1.

## Reglas

- **No bloqueante:** es un check liviano (spacing, jerarquía, AI slop, hover states). No frenes el commit; señalá y dejá que el founder decida.
- **Si algo viola la marca de forma dura** (hex inventado, fuente prohibida, AI slop) → formato `BRAND-CHECK` (ver `BRAND.md`) y proponé la alternativa que respeta el sistema.
- **Read-only:** no edites en el check. Si el founder pide aplicar una corrección, eso es otro paso.
- Español, terse, #1 con ⭐.

## Salida

```
🎨 UI-CHECK · <pantalla/diff>
Hallazgos (N):
1 ⭐ [alta] archivo:línea — qué + corrección
2  [media] …
✅ Lo que está bien: …
Veredicto: OK para commit · OK con ajustes menores · revisar antes (no bloqueante)
```
