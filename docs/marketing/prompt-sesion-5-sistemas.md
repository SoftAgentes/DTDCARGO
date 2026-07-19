# Prompt — sesión de trabajo: construir los 5 sistemas de crecimiento

> Copia el bloque de abajo y pégalo en una **sesión nueva** de Claude Code en este repo.
> Objetivo de esa sesión: convertir el marco de los 5 sistemas en un **programa ejecutable**
> (auditoría + brechas + hoja de ruta por sistema).

---

```
Vamos a establecer el programa de construcción de los 5 sistemas de crecimiento de DTD Cargo.

CONTEXTO — lee primero, en este orden:
1. docs/marketing/sistemas-negocio.md — el marco: los 5 sistemas (1 Adquisición · 2 Ventas ·
   3 Entrega · 4 Manual de operaciones · 5 Contratación), qué tiene DTD en cada uno y dónde
   entra el trabajo reciente (rediseño del portal + infografías).
2. docs/marketing/README.md — índice del tree de marketing (estado por área).
3. docs/marketing/adquisicion.md — el sistema 1 ya definido (oferta + canal + proceso).
4. docs/marketing/embudo-ventas.md + guiones-asesor.md — lo que existe del sistema 2.
5. docs/marketing/servicios-infografias/README.md + CATALOGO-MAESTRO.md — el catálogo de
   servicios y las piezas (alimentan sistemas 1-4).
6. docs/specs/README.md — índice SDD (para saber qué módulos del ERP ya existen; el índice
   puede driftear: verifica contra código si algo es crítico).

TAREA:
1. AUDITORÍA por sistema (usa agentes en paralelo, uno por sistema): para cada uno de los 5,
   contrasta lo que el marco dice que existe vs lo que REALMENTE hay en el repo/ERP/docs.
   Devuelve por sistema: qué está construido y operando · qué está construido pero NO se usa ·
   qué falta por completo.
2. BRECHAS: lista priorizada de lo que falta en cada sistema para que sea "definido,
   documentado y repetible" (el estándar del marco). Sé concreto: doc faltante, módulo
   faltante, proceso sin dueño, métrica sin medir.
3. HOJA DE RUTA: propón el programa — fases, orden entre sistemas (qué desbloquea qué),
   tareas por fase con su entregable, y qué puede avanzar en paralelo. Los sistemas 3
   (Entrega) y 4 (Manual) ya tienen momentum por el rediseño del portal — construye sobre
   eso, no lo dupliques.
4. PREGUNTAS: hazme las preguntas que necesites por sistema — compactas, con opciones por
   prioridad y ⭐ en la que recomiendes.
5. ENTREGABLE: escribe el programa en docs/marketing/plan-5-sistemas.md (nuevo doc del tree
   de marketing) con: estado actual por sistema · brechas · hoja de ruta por fases · dueños y
   métricas por sistema (los "5 sistemas" son de negocio, no solo de software: incluye
   procesos humanos como la rutina del asesor y el entrenamiento del operario).

REGLAS:
- Español venezolano neutro, tuteo, directo, sin relleno.
- No dupliques lo que ya existe: indexa y construye encima (regla del tree de marketing).
- No propongas rehacer módulos LIVE del ERP; propón usarlos o completarlos.
- Todo lo que decidamos queda escrito en docs/marketing/ (tree canónico), no en memoria suelta.
- Sin commits ni push sin mi OK.
```

---

**Notas de contexto para esa sesión (no pegar — referencia rápida):**
- El marco vive en [`sistemas-negocio.md`](sistemas-negocio.md) desde 2026-07-18.
- Sistema 1 (Adquisición) es el más maduro (doc + Kommo + campaña de recuperación SDD-0157).
- Sistema 3 (Entrega) tiene el pipeline de captura de realidad (SDD-0153/54/55/56/62) + el
  rediseño del portal (plan SDD-0163) en curso.
- Sistema 4 (Manual) tiene runbooks + specs + las 24 fichas de servicios como semilla.
- Sistema 5 (Contratación) tiene perfiles de puesto (SDD-0140) + onboarding (SDD-0113) + RBAC.
