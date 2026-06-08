---
sdd: "0064"
title: "Reestructuración de mensaje, UX, SEO/GEO y confianza del sitio público (puerta a puerta primero)"
status: in-progress
author: "founder (brief Codex) + Claude Code"
created: 2026-06-08
updated: 2026-06-08
supersedes: null
superseded_by: null
related: ["0062","0063","0042","0055"]
confidencialidad: interno
---

# DTD-0064 — Reestructuración del sitio público (puerta a puerta primero)

> Spec paraguas. Reordena el mensaje, la voz, el UX, el SEO/GEO y la prueba de confianza del sitio público para que comunique **"importa desde China hasta tu puerta, con un solo equipo responsable"** — no un catálogo de "mira todo lo que hacemos". De acá sale la taxonomía de productos y servicios ([SDD-0063](../0063-servicios-detalle-publico/spec.md) queda como sub-tema).

## Contexto

Dos disparadores convergen:
1. El AI Agent de Kommo crawlea `dtdcargo.com`; la web imprecisa hizo que la IA diera datos incorrectos a un lead (raíz del problema = la web). Ver [SDD-0062](../0062-crm-erp-cierres-automaticos/spec.md).
2. Brief estratégico del founder + análisis Codex (2026-06-08): el sitio debe dejar de liderar con la jerga técnica (DDP) y hablar el idioma del cliente (**puerta a puerta**), sin promesas absolutas, con MARKBOX como sistema de marcaje y trazabilidad clara.

**Regla estratégica rectora:** *El cliente entiende "puerta a puerta". DDP es la metodología técnica que lo hace posible.*

## Decisiones del founder (2026-06-08)

1. **"Puerta a puerta" es el concepto protagonista**; "DDP" (Delivered Duty Paid) solo como explicación técnica secundaria. Nunca DTP. Nunca abrir un hero/CTA/meta con "DDP".
2. **Financiamiento → reencuadrar (NO eliminar):** se mantiene "Financiamiento 100%" como gancho del beneficio ("pagas cuando tu carga llega a Venezuela") + condición visible **"sujeto a aprobación"** (según volumen, tipo de mercancía e historial) + FAQ de condiciones. (Reemplaza el "100% sin condiciones" que era promesa absoluta.)
3. **MARKBOX = sistema de marcaje logístico** (shipping mark / 唛头), no "código interno". Confirmado por el packing list oficial (入仓单): `客户唛头 SHIPPING MARK = DTD-[código]`, caja sin marca = rechazo.
4. **Sin promesas absolutas** ni "sin intermediarios": fuera "cero sorpresas/estafas/burocracia", "0 intermediarios", "no somos intermediario remoto", "garantizamos". Se afirma el hecho real (operación propia, un solo equipo responsable, menos imprevistos).
5. **Año de fundación = 2008** (China; 2010 carga formalizada; 2015 Venezuela). Ya alineado en [SDD-0063](../0063-servicios-detalle-publico/spec.md).
6. **Marca editorial = "DTD Cargo"** (no "DTD CARGO"/"DTDCARGO"/"DTD·CARGO"). Razón social solo en schema/legal.
7. **Voz:** castellano venezolano **tuteo, sin voseo**.
8. **Datos CN (dirección bodega, partner 林冠/Linguan, emails) = en revisión founder↔Claude antes de publicar.** Email público = `info@dtdcargo.com`. **No publicar nada del Excel sin verificar.**
9. **No inventar prueba social:** testimonios, fotos de bodega/equipo, capturas → los provee el founder. Inspección: el founder pasa los links de las agencias; hasta entonces sigue el stand-by (no inventar alcance/precios).

## Servicios — taxonomía (sale de esta reestructuración)

- **Principal #1:** Puerta a puerta (≈70-80% del negocio) — la espina.
- **Principal #2:** Inspección (servicio que DTD intermedia de agencias; trabajo exhaustivo aparte).
- **Complementarios, mapeados por etapa del viaje (flowchart A→Z):**
  - *Antes de comprar/fabricar:* registro de marca · verificación de proveedores · compra asistida · visado.
  - *En China (recepción/consolidación):* consolidación en bodega · etiquetado/MARKBOX · asesoría de pagos · muestras/courier · lab/permisología · auditoría/QC.
  - *Tránsito/aduana:* reserva FCL · documentos de importación · aduana/desaduanaje.
  - *Entrega:* last mile.
- Cada servicio etiquetado: **principal / complementario / mínimo**, **etapa**, y **"a solicitud"** sí/no. (Borrador de taxonomía → para revisión del founder antes de reconstruir `/servicios`.)

## Plan por fases (cada fase: editar → verificar con la guía → OK del founder)

| Fase | Qué | Estado |
|---|---|---|
| 0 | Spec 0064 + guía de verificación + inventario file:línea | ✅ esta sesión |
| 1 | **Mensaje base:** voseo · variantes de marca · quitar frases absolutas/intermediarios · financiamiento reencuadrado · DDP→secundario en ganchos | 🔄 esta sesión (workflow, 46 cambios) |
| 2 | **Home:** hero "Importa desde China hasta tu puerta" · barra de confianza nueva · sección "¿Qué significa puerta a puerta?" · tabla de transparencia (incluye/puede variar/no aplica) | ⏳ requiere OK copy |
| 3 | **MARKBOX** como sistema de marcaje (sección + flujo 8 pasos, con datos reales del 入仓单) | ⏳ |
| 4 | **Taxonomía + /servicios** por etapa + fichas (retoma entrevista por tandas de 0063) | ⏳ |
| 5 | **Estimación / calculadora / tracking / registro** (copy + privacidad visible) | ⏳ |
| 6 | **SEO/GEO:** "Respuesta rápida" + JSON-LD (Organization/LocalBusiness/Breadcrumb/FAQPage/Service) + páginas por ciudad; páginas nuevas (/puerta-a-puerta, /markbox) al final | ⏳ |
| 7 | **Confianza/prueba real** (fotos/testimonios del founder) + QA desktop/mobile/SEO/marca | ⏳ |

## Alcance

**Solo sitio público** (`app/` raíz + `components/` + `lib/` no-studio + `public/`). NO `app/studio`, `lib/studio`, `app/portal`, `app/m`, `app/back`, Supabase. Frontera forzada por ESLint.

## Verificación

Guía viva: [`assets/guia-verificacion.md`](assets/guia-verificacion.md) — checklist por fase + chequeos transversales (marca, voz, SEO/GEO, QA). Gate técnico por fase: `pnpm lint` (o eslint directo) + `node scripts/verify.mjs`. Rama `feat/servicios-detalle-publico`, **sin push sin OK**.

## Pendientes founder
- Verificar datos CN del Excel antes de publicar (dirección, partner, teléfonos).
- Links de las agencias de inspección.
- Fotos reales (bodega Yiwu, equipo Valencia), capturas anonimizadas, testimonios reales.
- OK de copy para Fase 2 (hero/barra/transparencia).
- Reconciliar el conteo "16 servicios" con la taxonomía final.
