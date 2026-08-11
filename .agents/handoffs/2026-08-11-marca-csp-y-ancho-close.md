# Handoff · `/marca` — la CSP que rompía 14 documentos, y el ancho en monitor grande

- **Fecha:** 2026-08-11
- **Rama:** `fix/marca-enlaces-rotos` (integrada en `main` y **borrada**)
- **Worktree:** `C:/Users/Trabajo/Desktop/Developer/software/DTD-worktrees/marca` (eliminado)
- **Rol:** worker, integrado y publicado con OK del founder
- **Tiempo / tokens:** n/a (la plataforma no los expone)

## Alcance

Se reportó que en `dtdcargo.com/marca` había enlaces rotos y que los iconos de
WhatsApp "no estaban". Se auditó el sistema navegable **bajando los 35 documentos
publicados desde Storage** y extrayéndoles cada referencia, en vez de mirar una
copia local.

**Causa única para los dos síntomas:** `/marca/doc/*` servía con
`script-src 'self'`, y estos documentos cargan sus librerías de CDN. **14 de 35
rotos.** Cinco montan su contenido con React desde `unpkg` — bloqueado el
script, la página nunca se pinta. De ahí que "no están las imágenes" fuera
exacto y engañoso a la vez: los avatares de WhatsApp **no son archivos**, se
generan en el navegador (SVG → `blob:` → canvas → PNG).

Segundo encargo: `/marca` se veía angosto en pantalla ancha (`--maxw: 1280px`
del sitio + miniatura `h-[132px]` fija).

## Rutas propias

```
next.config.ts                              (editado · CDN_DOCUMENTOS + brandDocCspHeader)
app/marca/page.tsx                          (editado · --maxw scopeado)
app/marca/_components/AssetCard.tsx         (editado · alto de miniatura)
app/marca/_components/CatalogClient.tsx     (editado · 4ª columna en 2xl)
docs/design/studio/cloud-design-2026-08-11-isotipo-y-favicons-falsos-positivos.md  (nuevo)
AGENTS.md                                   (editado · aviso de no republicar)
scripts/upload-brand-proyecto.ts            (editado · sólo cabecera)
```

## Verificación

| Qué | Resultado |
|---|---|
| `pnpm typecheck` · `pnpm lint` | ✅ limpios |
| `pnpm test` (marca + edge functions) | ✅ 144 pasando, 9 archivos |
| `pnpm build` | ✅ |
| CSP servida en las 3 rutas de `/marca` (curl) | ✅ sólo cambió el visor |
| `Iconos de Perfil` en el navegador | ✅ React carga · 46 SVG · 15 roles · PNG de 22.234 B generado · 0 violaciones de CSP |
| `Packaging Logístico` (Shipping Mark) | ✅ el generador de QR carga y produce 29 módulos |
| Ancho a 2560px | ✅ contenedor 1280→1760 · miniatura 132→224 · isólogo 88×91→177×183 |
| Ancho a 375px | ✅ **sin cambios** — 132px exacto, sin desborde |
| Producción tras el deploy | ✅ CSP nueva viva en `dtdcargo.com` |

**Alcance de lo medido:** dos documentos se probaron end-to-end en el navegador.
Los otros doce comparten el mecanismo idéntico (un `<script src>` a un host que
la CSP vieja bloqueaba) pero **no se abrieron uno por uno**.

## Commit y push

`5862dac7` · `50f628af` · merge `407ff8c5` · `490f74ce` · `90c878ab` — todos en
`origin/main`. Deploy de Vercel `success`, verificado contra producción.

## Decisiones que conviene no re-litigar

- **La CSP se amplió a propósito**, con hosts exactos y sólo en el visor de
  documentos. Cuesta que esos tres CDN puedan ejecutar script en nuestro origen
  dentro de `/marca/doc/*`; la superficie ya concedía `unsafe-inline` y
  `unsafe-eval` a HTML que no escribimos. Autorizado por el founder.
- **No republicar el sistema navegable desde `Downloads/`.** La carpeta que
  produjo lo publicado ya no existe intacta; producción es hoy la copia más
  completa. El aviso, con los números, está en la cabecera de
  `scripts/upload-brand-proyecto.ts` y en `AGENTS.md`.
- **Dos hallazgos míos fueron falsos positivos** (`isotipo/` y las rutas del
  Favicon Pack). Se redactó un pedido a Cloud Design y **no se envió**: su
  respuesta se verificó contra los documentos servidos y tenían razón. Quedan
  documentados para que nadie los re-levante.

## Bloqueos

Ninguno.

## Limpieza

Worktree eliminado del registro **y del disco** (en Windows `git worktree remove`
deja la carpeta), rama local borrada por integrada, entrada propia de
`.claude/launch.json` revertida, servidor de desarrollo del puerto 3021 apagado.

Los otros tres worktrees (`crm`, `aliados`, `upbeat-jones-74849f`) **se conservan**:
tienen sesiones activas.

## Siguiente responsable

Ninguno. `/marca` queda cerrado y desplegado.
