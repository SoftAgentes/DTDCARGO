---
sdd: "0063"
title: "Servicios a fondo (sitio público) — fichas incluye/no-incluye/precio/cómo/tiempos para alimentar el crawl de IA"
status: in-progress
author: "Claude Code (session context) + founder"
created: 2026-06-08
updated: 2026-06-08
supersedes: null
superseded_by: null
related: ["0062","0043","0058"]
confidencialidad: interno
---

# DTD-0063 — Servicios a fondo (sitio público)

> Convertir `/servicios` de tarjetas cortas a **fichas detalladas** (qué incluye · qué NO incluye · precio o condición · cómo se solicita · tiempos) para que el crawl del AI Agent de Kommo tome información **certera** y deje de dar datos incorrectos a los leads.

## Contexto

El AI Agent de Kommo (ver [SDD-0062](../0062-crm-erp-cierres-automaticos/spec.md)) usa `dtdcargo.com` como fuente de conocimiento (Ajustes → Fuentes de conocimiento de IA). Hoy la info de servicios en la web es **breve e imprecisa** (`/servicios` lista ~16 servicios con copy de 1-2 líneas desde `SERVICES_CN`/`SERVICES_VE` en `lib/design-tokens.ts`). Eso provocó que la IA diera **datos incorrectos** a un lead. La raíz del problema es la web, no el FAQ del bot — arreglando la web a fondo, el crawl alimenta info certera y la IA convierte mejor.

**Fuente de coherencia obligatoria:** [`docs/specs/0062-.../assets/faq-knowledge-base.md`](../0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md) (28 secciones) y `lib/faqs.ts` (FAQ de la página `/faq`). **La web y el FAQ deben decir lo mismo.**

## Decisiones del founder (2026-06-08)

1. **Arquitectura:** enriquecer la página `/servicios` existente — cada servicio pasa de tarjeta corta a **ficha completa** desplegable (acordeón `<details>`, contenido en DOM = crawleable) + índice de salto. **Una sola URL** (más fácil de mantener coherente con el FAQ; el contenido es lo que importa para el crawl, no la cantidad de URLs). Se mantiene la subpágina `/servicios/inspeccion` como deep-dive bandera.
2. **Courier de muestras/documentos:** **activo**. Aclarar que es express de **muestras y documentos pequeños** (DHL/UPS/FedEx), **NO** flete aéreo de carga (eso sí está suspendido).
3. **Año de fundación:** **2008** en todos lados (inicios comerciales en China). La web ya narra los hitos: 2010 empresa de carga formalizada · 2015 expansión a Venezuela (DTD Services LCL). Alinear los spots que titulan "desde 2010" → "desde 2008".
4. **Datos por servicio:** se recogen por **entrevista por tandas** con el founder (no template). Esta spec deja el contenedor; las fichas se rellenan con lo que el founder dicte. **No inventar** precios/condiciones/tiempos no documentados.

## Alcance

**Solo sitio público** (`app/` raíz + `components/` + `lib/` no-studio). NO toca `app/studio`, `lib/studio`, Supabase. Frontera público↔ERP intacta.

### Entra
- `lib/servicios-detalle.ts` — modelo de datos de la ficha + las fichas de los ~14 servicios (seed grounded + `[FALTA]` donde decide el founder).
- Componente de ficha desplegable + integración en `app/servicios/page.tsx` (acordeón + índice de salto + schema.org `Service` enriquecido con la descripción larga).
- Corrección de coherencia: año de fundación → **2008** (`app/layout.tsx` `foundingDate` + meta, `components/Footer.tsx`, `app/brochure/page.tsx`, `app/importar-de-china/[ciudad]/page.tsx`, `HERO.eyebrow` en `lib/design-tokens.ts`, meta de `/nosotros`, descriptor de negocio en `AGENTS.md`).
- Clarificación del courier (copy de `muestras-courier`).
- Voz: `voseo → tuteo` en los archivos que se tocan (`/servicios`, `lib/inspeccion.ts`): "Solicitá/Conocé/necesités" → "Solicita/Conoce/necesites".

### No entra
- **Precios de inspección** (decisión founder: stand-by; los envía el asesor a mano).
- **Modelo comercial de compra asistida** (sin definir; el bot nunca revela el proveedor de DTD).
- Subpáginas por servicio o por familia (descartado a favor de la opción 1).
- Cambiar `lib/faqs.ts`/`/faq` salvo coherencia puntual de tiempos (se evalúa aparte).

## Estructura de la ficha (campos)

Cada servicio se modela con estos campos (los 5 que pidió el founder + soporte):

| Campo | Qué es | Origen |
|---|---|---|
| `resumen` | 1-2 frases: qué es el servicio | grounded (FAQ/timeline/copy actual) |
| `incluye` | bullets de lo que SÍ incluye | founder / FAQ |
| `noIncluye` | bullets de lo que NO incluye (clave para precisión) | founder |
| `precio` | precio, rango o condición ("vale tanto si hace X") · o "Bajo cotización" | founder |
| `comoSolicitar` | cómo se pide (WhatsApp, calculadora, registro…) | grounded |
| `tiempos` | tiempos del servicio | founder / FAQ |
| `nota` | salvedad opcional (courier, "consulta normativa", etc.) | — |
| `estado` | `activo` \| `suspendido` \| `a-pedido` (default `activo`) | — |

Campos sin dato del founder = `[FALTA]` y **no se renderizan** (la ficha muestra solo lo confirmado). Nada inventado llega a la web.

## Servicios a cubrir (~14, anclados a slugs de `SERVICES_CN`/`SERVICES_VE`)

CN: `reserva-contenedores` (Reserva FCL) · `consolidacion-bodega-yiwu` (Consolidación FCL/LCL) · `chequeo-etiquetado` (Inspección y etiquetado) · `verificacion-proveedores` · `auditoria-calidad` · `lab-permisologia` · `compra-asistida` · `asesoria-pagos` · `registro-marca-cn` · `muestras-courier` (Envío de muestras/documentos — courier activo, no carga aérea).
VE: `dtd-services-lcl` (Carga puerta a puerta LCL + DDP/Financiamiento 100%) · `visado-chino` · `registro-marca-coord` · `documentos-importacion` · `transito-aduana` (Aduana/desaduanaje) · `last-mile`.

> Inspección de calidad ya tiene su deep-dive en `/servicios/inspeccion` (`lib/inspeccion.ts`); la ficha de `chequeo-etiquetado` enlaza ahí.

## Coherencia con el FAQ (anclas grounded — no inventar)

- **DDP / Financiamiento 100%** (FAQ §22, `lib/faqs.ts`): precio incluye flete + aduana + impuestos; pagas cuando la carga llega a Venezuela.
- **LCL/consolidado** (FAQ §26): pagas por CBM; juntamos varios proveedores en Yiwu.
- **Cobertura** (FAQ §24): toda Venezuela, last-mile a tu dirección.
- **Tiempos** (FAQ §3 Kommo): 60-90 días marítimo. ⚠️ `lib/faqs.ts` hoy evita el día-conteo y remite a cotización → resolver coherencia con el founder (usar 60-90 si lo aprueba).
- **Aéreo** (FAQ §27): flete aéreo de carga SUSPENDIDO; el courier de muestras/docs sí sigue.

## Proceso

1. SDD + scaffold + correcciones de coherencia (esta sesión).
2. Revisión `ui-ux-designer` (regla del founder) antes de commit.
3. Gate: `pnpm lint` + `node scripts/verify.mjs` verde.
4. Entrevista por tandas → rellenar fichas.
5. Rama separada, **sin push sin OK del founder**.
6. **Post-merge:** re-crawlear `dtdcargo.com` en Kommo (Ajustes → Fuentes de conocimiento de IA → borrar y volver a añadir la fuente URL).

## Adjuntos

- `assets/entrevista-servicios.md` — guía/registro de la entrevista por tandas (qué falta por servicio).
