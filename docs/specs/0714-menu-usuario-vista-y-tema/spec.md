---
sdd: "0714"
title: "Vista y tema en el menú del usuario, guardados en su cuenta"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-23
updated: 2026-11-23
supersedes: null
superseded_by: null
related: ["0120", "0603", "0688", "0713"]
confidencialidad: interno
---

# SDD-0714 — Vista y tema en el menú del usuario

> Sin migración, sin datos de producción y sin PII nueva. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** sin verificar.

## 1. Pedido de Sam (2026-11-23)

- «Lo que es normal, compacto y supercompacto debería estar adentro del perfil del usuario, no siempre en la pantalla. Eso queda grabado y listo».
- Ante la maqueta: «Menú del usuario: sí, así, y que la vista quede guardada en mi usuario (opción B)».

## 2. Hoy (antes de esta spec)

- La barra superior del Studio lleva el selector «Vista» de SDD-0688 (`DensityToggle`) y el botón sol/luna (**C** `app/studio/(app)/_components/StudioTopbar.tsx`).
- La vista y el tema se guardan **solo en el navegador** (`localStorage`: `studio_density`, `studio_theme`), con el script anti-parpadeo de `app/studio/layout.tsx` (**C** `app/studio/_components/appearance-prefs.ts`). En otro equipo la persona vuelve a los valores de fábrica: oscuro y Compacta.
- El tema solo tiene Claro y Oscuro; no hay «seguir al sistema».

## 3. Qué cambia

### 3.1 Barra superior

Queda con buscar, Conversaciones (si la persona tiene el módulo), campana y la pastilla «Nombre ▾». Salen el selector de vista y el botón sol/luna.

### 3.2 Menú del usuario (maqueta aprobada)

Al abrir la pastilla, en este orden:

1. Nombre y rol (el rol real del tenant, no un «Admin» fijo).
2. **Vista**: segmentado Normal / Compacta / Súper compacta.
3. **Tema**: segmentado Claro / Oscuro / Automático.
4. Mi perfil (y las demás opciones de cuenta que ya existían: contraseña, atajos, preferencias, reportar un problema).
5. Cerrar sesión.

El menú se arma con una lista de opciones (`OPCIONES_DE_CUENTA` en `StudioTopbar.tsx`): un ítem nuevo, como el «Modo de prueba» de SDD-0713, se agrega con una entrada, sin tocar el resto. **Esta spec no agrega ese ítem.**

### 3.3 Automático

«Automático» sigue al sistema operativo (`prefers-color-scheme`) y cambia en vivo si el sistema cambia. Se guarda como `auto`; el atributo `data-theme` sigue siendo solo `dark` o vacío, así que el CSS no cambia.

### 3.4 Guardado en el usuario (opción B)

- Se guarda en `auth.users.raw_user_meta_data` → clave `studio_apariencia = { vista, tema }`, escrita por la propia persona con `supabase.auth.updateUser({ data })` desde una acción del servidor (`app/studio/(app)/_actions/apariencia-actions.ts`).
- **Por qué ahí y sin migración (I):** es por usuario, ya existe, lo lee `getUser()` en el layout sin otra consulta, y GoTrue mezcla las claves de `data` sin borrar las demás. Las tablas de preferencias que existen (`user_dashboard_prefs`, 0233; `user_guide_prefs`, 0517) son por tenant y de otro tema; mezclarles la apariencia cruzaría responsabilidades.
- **Qué no es:** `user_metadata` lo puede escribir la persona; por eso aquí solo van gustos de pantalla, nunca permisos. Nada del sistema decide acceso con `studio_apariencia`.
- La acción valida la forma: solo `normal | compact | ultra` y `light | dark | auto`. Lo demás se rechaza sin escribir.
- **Respaldo local:** `localStorage` se conserva y el script anti-parpadeo lo sigue aplicando antes del primer pintado. Al montar el Studio, si lo guardado en el usuario difiere de lo local, se aplica lo del usuario y se actualiza lo local (un solo cambio, sin recarga).
- **Primera vez:** si la cuenta no tiene nada guardado pero este navegador sí tiene una elección explícita, esa elección se sube a la cuenta una vez. Sin nada en ningún lado: Compacta (SDD-0688) y oscuro (BD-037).
- Si guardar en la cuenta falla, el cambio queda en este equipo y aparece un aviso: «No se pudo guardar en tu usuario. El cambio quedó solo en este equipo.».

### 3.5 Admin › Apariencia

La sección `AppearanceSection` usa el mismo mecanismo: ofrece también Automático y guarda en la cuenta.

## 4. Accesibilidad

- La pastilla declara `aria-expanded` y `aria-controls`; al abrir, el foco entra a la vista marcada; `Escape` cierra y devuelve el foco a la pastilla.
- Cada segmentado es un `role="group"` con nombre («Vista», «Tema») y botones con `aria-pressed`, de 32 px como mínimo (`--objetivo-min`), con el anillo de foco global sin recortar.
- Claro y oscuro con los tokens del Studio (`--ink`, `--ink-inv`, `--bg-surface`, `--border`).

## 5. Criterios de aceptación

| # | Criterio | Prueba |
|---|---|---|
| A1 | La barra no lleva selector de vista ni botón de tema | `StudioTopbar-menu-usuario.test.tsx` |
| A2 | El menú muestra nombre, rol, Vista, Tema, Mi perfil y Cerrar sesión en ese orden | `StudioTopbar-menu-usuario.test.tsx` |
| A3 | Elegir una vista o un tema lo aplica, lo guarda local y llama a la acción con los dos valores | `StudioTopbar-menu-usuario.test.tsx` |
| A4 | Automático sigue a `prefers-color-scheme` en el script y en vivo | `apariencia-predeterminada.test.ts` (script), `AparienciaUsuario.test.tsx` (en vivo) |
| A5 | La acción solo acepta valores del catálogo y solo escribe `studio_apariencia` | `apariencia-actions.test.ts` |
| A6 | Lo guardado en la cuenta gana sobre lo local al cargar; sin nada en la cuenta se sube la elección local | `AparienciaUsuario.test.tsx` |
| A7 | Escape cierra el menú y devuelve el foco | `StudioTopbar-menu-usuario.test.tsx` |

## 6. Fuera de alcance

- Modo de prueba (SDD-0713, Codex).
- Portal del cliente (`PortalThemeToggle`), que guarda su vista aparte (0557).
- Paneles dentro de Chatwoot (`/studio/ficha-chat`, `/studio/cerrar-chat`): siguen sin tema ni densidad propios.
