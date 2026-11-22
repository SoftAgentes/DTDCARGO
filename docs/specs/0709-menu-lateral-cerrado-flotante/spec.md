---
sdd: "0709"
title: "Studio · Menú lateral cerrado: un icono por grupo y lista flotante"
status: in-progress
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-22
updated: 2026-11-22
supersedes: null
superseded_by: null
related: ["0686", "0603", "0655", "0708"]
confidencialidad: interno
---

# SDD-0709 — Menú lateral cerrado: un icono por grupo y lista flotante

> Pedido de Sam (2026-11-22), textual: «Sí, quiero el menú flotante por grupo con el sidebar cerrado; ábrelo como SDD
> aparte, sin frenar el tren». Antes: «en cerrado se amplían demasiado las subcategorías… me abre demasiados íconos y la
> gente no se va a acordar. Me gustó más la propuesta del menú flotante, o sea, que se achican a "operaciones
> comerciales" y otros». El repo es público: sin datos de clientes, correos ni montos.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia.

## 1. Problema

Con el menú cerrado, `StudioSidebar.tsx` pinta **todos** los módulos visibles como iconos sueltos con tooltip (**C**
`renderLeaf` con `collapsed`; `renderParent` aplanaba los hijos). Un admin ve unos 55 iconos en una columna de 64 px:
hay que pasar el mouse por cada uno para saber qué es, y varios comparten icono (`warehouse`, `tag`, `calc`, `shield`…).
Es lo que Sam describió: demasiados iconos que nadie recuerda.

## 2. Comportamiento

**Menú cerrado**

- Quedan **cinco botones**, uno por grupo de `lib/studio/modules.ts` (`GROUP_ORDER`): OPERACIÓN, COMERCIAL, FINANZAS,
  MARKETING y SISTEMA, cada uno con su icono propio (`lib/studio/sidebar-grupos.ts`). Un grupo sin módulos visibles para
  el rol no aparece.
- Arriba va el **Dashboard**, suelto. Justificación: es la pantalla de inicio y se usa varias veces al día; meterlo en
  un grupo sumaría un clic a lo más frecuente. Es el único módulo suelto; no se repite dentro de la lista de OPERACIÓN.
- El grupo del módulo activo se marca en **azul de acción**: icono en `--accion-soft`, fondo suave de ese mismo color y
  una barra de 3 px al borde. `--accion-soft` sobre `--bg-sidebar` mide ≥ 7:1 en los temas (SDD-0686).
- Pasar el mouse **no abre** nada: solo muestra el tooltip con el nombre del grupo (el tooltip propio que ya existía).

**Lista flotante**

- Al **oprimir** un grupo se abre al lado (fixed, a la derecha del botón) con los módulos del grupo **que el rol puede
  ver**: mismo filtro que el menú abierto (flags, RBAC, scope de almacén, `hidden`, `dentroDe`, regla de CRM).
- Los **padres** (Almacenes, Despacho) salen como subgrupo con su título y los hijos debajo, sangrados.
- El módulo activo lleva `aria-current="page"` y el chip blanco del menú abierto. «CRM» conserva el contador de la
  Bandeja y «Gastos» el de alertas.
- Elegir un módulo **navega y cierra** la lista. Una sola lista abierta a la vez. Cambiar de ruta, expandir el menú o
  redimensionar la ventana también la cierran.
- Si no cabe hacia abajo, sube lo justo; si es larga, scroll interno.

**Menú abierto: no cambia** (acordeón, clusters, contadores, slider de ancho).

## 3. Accesibilidad

| Requisito | Cómo |
|---|---|
| Botón de grupo | `<button aria-haspopup="menu" aria-expanded aria-controls aria-label="<grupo>">` |
| Lista | `role="menu"` con `role="menuitem"` (enlaces); subgrupos con `role="group"` y su título |
| Teclado | Enter/Espacio o ↓/→ abren y llevan el foco al módulo activo (o al primero); ↑/↓ mueven con vuelta; Inicio/Fin; Esc cierra y devuelve el foco al botón; Tab cierra |
| Ratón/toque | clic afuera cierra; el mouse encima no abre |
| Toque | botón de 44 px y ítems de 36 px de alto (mínimo del Studio: 32 px) |
| Foco | contorno de 2 px en `--accion-soft` (≥ 4,5:1 sobre el navy; en el chip blanco, `--accion`) |
| Contraste | texto de la lista `--ink-side-strong` sobre `--bg-sidebar`; chip activo `--on-warning` sobre blanco; ambos ≥ 4,5:1, medidos en la prueba |
| Movimiento | sin transiciones con `prefers-reduced-motion` |

## 4. Criterios de aceptación

1. Menú cerrado: `GROUP_ORDER.length` botones de grupo, en ese orden, y **ningún enlace de módulo** salvo el Dashboard
   (contrato: falla si vuelven los iconos sueltos).
2. Pasar el mouse no abre la lista; oprimir sí, con `aria-expanded` y `aria-controls` coherentes.
3. La lista trae los módulos del grupo y los padres como subgrupo.
4. ↑/↓/Inicio/Fin, Esc (foco al botón), clic afuera, Tab y elegir módulo cierran como se describe.
5. El grupo del módulo activo (y solo ese) lleva `data-activo`; el módulo activo, `aria-current`.
6. Un rol con pocos módulos no ve grupos vacíos.
7. Menú abierto sin cambios; las pruebas de tooltip y de CRM siguen verdes.
8. Contraste y alto mínimo medidos en prueba; `prefers-reduced-motion` respetado.

## 5. Alcance y allowlist

**Dentro (exacta):**

- `docs/specs/0709-menu-lateral-cerrado-flotante/spec.md` e índice de specs regenerado (`pnpm docs:index`)
- `lib/studio/sidebar-grupos.ts` (nuevo: icono por grupo, módulo suelto)
- `app/studio/(app)/_components/GrupoFlotante.tsx` (nuevo)
- `app/studio/(app)/_components/StudioSidebar.tsx`
- `app/studio/studio.css` (bloque `.studio-sb-grupo-*` y `.studio-sb-flot*`)
- `app/studio/(app)/_components/__tests__/StudioSidebar-cerrado-flotante.test.tsx` (nuevo)
- `.agents/handoffs/sdd-0709-menu-cerrado-flotante.md`

**Fuera:** migraciones, RLS, permisos (`lib/studio/rbac*.ts`), `lib/studio/modules.ts` (el registro y el menú abierto no
cambian), i18n (los nombres de grupo ya existen en `chrome.sidebar.group.*`), topbar, Portal y sitio público.

## 6. Riesgos y decisiones

- **El grupo no se abre al pasar el mouse** (pedido de Sam y requisito de accesibilidad): el costo es un clic más que el
  hover, a cambio de que no se abra solo al cruzar la columna. **I**
- **Iconos de grupo** (truck, users, invoice, spark, cog) salen del set actual; si Sam quiere otros se cambian en un solo
  archivo. Propuesta mía, sin decisión de Sam.
- El Dashboard suelto es una decisión de esta spec; si Sam prefiere solo los cinco grupos, se quita
  `MODULO_SUELTO_CERRADO` y el Dashboard queda dentro de OPERACIÓN.
- `color-mix` ya se usa en `studio.css`; no suma soporte de navegador nuevo.

## 7. Verificación

`pnpm verify` (lint, tipos, tests, build), más `pnpm docs:check` y `pnpm sdd:check`. Revisión visual con el menú cerrado,
claro y oscuro, antes de publicar (pendiente de Sam; esta spec no publica).
