---
sdd: "0121"
title: "Apariencia — preferencias de Studio (tema + densidad) + material de marca read-only"
status: done
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-14
supersedes: null
superseded_by: null
related: ["0120"]
confidencialidad: interno
---

# SDD-0121 · Apariencia

> **Segunda sección real de Administración**, después de "Datos de la empresa"
> ([[0120]]). Sin migración: preferencias por-usuario en `localStorage` (mismo
> patrón que el theme ya existente) + material de marca read-only.

## Contexto

El toggle de tema (sol/luna) ya vivía en el topbar (`studio_theme` en
localStorage + script anti-FOUC en `app/studio/layout.tsx`). La **densidad**
estaba definida en `tokens.css` (`[data-density="compact|spacious"]`) pero
**nada la seteaba** — no había dónde elegirla. Esta spec cierra ese hueco y le
da a "Apariencia" contenido real.

## Alcance

1. **Preferencias (por cuenta)**
   - **Tema** — light / dark. Comparte mecanismo con el topbar vía el helper
     `appearance-prefs` (evento `studio:appearance`) → ambos controles quedan
     sincronizados en vivo, sin recargar.
   - **Densidad** — compact / normal / spacious. Nueva. Persistida en
     `studio_density`, aplicada con `data-density` en `<html>`. El script
     anti-FOUC del layout la re-aplica en el primer paint.
2. **Paleta de marca** — swatches read-only (wine / wine-soft / ink / paper).
   Bloqueada por reglas de marca (BRAND.md); no editable.
3. **Recursos de marca** — links al hub interno (`/interno/marca`) y Brand Book
   (`/marca/brand-book`).
4. **Logo & favicon** — panel "por implementar" (subir assets por tenant
   requiere Storage + gobernanza de marca → SDD futuro).

## Superficie de código

- `app/studio/_components/appearance-prefs.ts` — helper compartido: claves,
  `readTheme`/`readDensity`, `applyTheme`/`applyDensity` (persisten + disparan
  `studio:appearance`).
- `app/studio/layout.tsx` — script anti-FOUC extendido para aplicar densidad.
- `app/studio/(app)/_components/StudioTopbar.tsx` — usa el helper y escucha el
  evento para no desincronizar el ícono sol/luna.
- `app/studio/(app)/admin/_components/AppearanceSection.tsx` — la sección.
- `app/studio/(app)/admin/page.tsx` — render de `AppearanceSection` cuando la
  sección activa es `appearance`.

## Decisiones

- **Sin DB**: preferencias de presentación son per-dispositivo/usuario y no
  necesitan viajar entre sesiones en V1. Consistente con el theme existente.
  Si más adelante se quiere sincronizar por usuario en la nube → tabla
  `user_studio_prefs` (fuera de alcance).
- **No se duplica** un segundo mecanismo de tema: un único helper como fuente
  de verdad, consumido por topbar y sección.

## Estado

- Código listo; `pnpm typecheck` + build en verde. Sin migración.
