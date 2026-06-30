# Runbook — Consolidar Kommo en UN embudo único ("DTD — Ventas")

> Plan para colapsar los **11 embudos** actuales de Kommo en **uno solo** + una etiqueta "Tipo de
> servicio". Es una operación sobre el **CRM vivo con ~2.900 leads reales** → la parte de mover/borrar
> es **destructiva**: se hace con el founder delante, paso a paso, NUNCA desatendida. La ventana de
> desarrollo no toca el CRM (no genera commits de código; este runbook es el entregable).
>
> Diseño aprobado por el founder (2026-06-29). Cuenta: `https://doortudoor.kommo.com`.

## ✅ Estado (2026-06-29) — embudo único YA configurado

**Decisión de ejecución del founder:** en vez de crear un embudo nuevo "DTD — Ventas", se **reusó el embudo
principal vacío "Atencion a leeds"** (id `13967120`, 0 leads → cero riesgo) y se reconfiguraron sus etapas.
El founder lo hizo en su propio Chrome (sin automatización) y guardó.

**Etapas reales que quedaron** (nombres del founder, alineados a los estados del ERP):

| Rol | Nombre real en Kommo |
|---|---|
| Entrante | **Leads entrantes** |
| Activa 1 | **Contacto inicial** |
| Activa 2 | **Tomar decisión (Estimado)** |
| Activa 3 | **Negociación (Cotizado)** |
| Cierre ganado | **Servicio Logrado con éxito** |
| Cierre perdido | **Ventas Perdidos** |

Flujo: `Leads entrantes → Contacto inicial → Tomar decisión (Estimado) → Negociación (Cotizado) → Servicio
Logrado con éxito / Ventas Perdidos`. (Kommo muestra como columnas solo las 3 activas; entrante y cierre van
aparte — es normal.)

**Pendiente (coordinación / prod):** (1) sync de Kommo para que el espejo traiga los IDs nuevos de etapa;
(2) re-mapear el write-back del ERP a estos nombres — `estimado enviado → Tomar decisión (Estimado)`,
`aceptado → Servicio Logrado con éxito`, `rechazado → Ventas Perdidos`; (3) campo "Tipo de servicio" (si se
quiere) + migración de leads de los otros 10 embudos, con el founder delante.

## Por qué (foto real del espejo, MCP 2026-06-29)

| Embudo | Leads | Dónde se atascan | Ganados |
|---|---|---|---|
| **Embudo de ventas** (id 7225379) | 2.263 | **2.225 en "Atención al cliente"** | 0 |
| Embudo Carga (8690912) | 240 | trae próximamente 177 / carga en china 58 | 0 |
| Compra asistida (8691440) | 232 | 231 en "Contacto inicial" | 0 |
| Cursos (8699404) | 95 | 95 en "Negociación" | 0 |
| Verificación de mercancía (8699388) | 15 | — | 0 |
| Validación de proveedores (8691468) | 13 | — | 0 |
| VISA China (11074568) | 5 | — | 0 |
| Carga China VZLA Ofidoc (11074572) | 4 | — | 0 |
| Investigación productos (11337468) | 3 | — | 0 |
| Sam (10079836) | 2 | — | 0 |
| Atención a leeds (13967120, **main**) | 0 | vacío | 0 |

**Tres verdades:** (1) **cero ganados** en los 11 embudos — el CRM acumula, no cierra; (2) "Embudo Carga"
rastrea logística (carga en china / en camino), que **hoy lo hace el ERP** → redundante; (3) los 11 embudos
son en realidad **tipos de servicio**, no etapas de venta distintas → eso es una **etiqueta**, no un embudo.

## El target — embudo único "DTD — Ventas" (6 columnas)

```
🟦 Nuevo lead → 🟨 Contactado → 🟧 Cotización enviada → 🟪 Negociación → 🟩 GANADO → Cliente
                                     ↑ ERP escribe (estimado enviado)        ↑ aceptado → MARKBOX → el ERP sigue
                                                                            🟥 PERDIDO (estimado rechazado)
```

- **Nuevo lead** (etapa entrante, `type=1`) · **Contactado** · **Cotización enviada** · **Negociación** ·
  **Ganado / Cliente** (closed-won) · **Perdido** (closed-lost).
- Alineado al write-back del ERP (SDD-0084): `estimado enviado → Cotización enviada`, `aceptado → Ganado`,
  `rechazado → Perdido`.

**Campo nuevo "Tipo de servicio"** (custom field de TEXTO o LISTA en el lead):
`Carga · Compra asistida · Cursos · Verificación · Visa · Otro`. Reemplaza la separación por embudos →
un solo tablero, se filtra por etiqueta.

**Lo que NO va en Kommo:** el tracking de la carga (carga en china / en camino / despacho). Eso vive en el
Studio. Kommo termina en "Ganado"; ahí entra el MARKBOX y el ERP sigue.

## Mapa de migración (embudo viejo → destino en el nuevo)

| Embudo viejo | Etiqueta "Tipo de servicio" | Etapa destino en "DTD — Ventas" | Nota |
|---|---|---|---|
| Embudo Carga (240) | Carga | **Ganado → Cliente** | ya son clientes con carga activa; el detalle logístico lo lleva el ERP |
| Compra asistida (232) | Compra asistida | Contactado | 231 en "Contacto inicial" |
| Cursos (95) | Cursos | Negociación | |
| Verificación de mercancía (15) | Verificación | Contactado | |
| Validación de proveedores (13) | Verificación | Contactado | |
| VISA China (5) | Visa | Contactado | |
| Carga China VZLA Ofidoc (4) | Carga | Contactado | |
| Investigación productos (3) | Otro | Contactado | |
| Sam (2) | Otro | Nuevo lead | embudo personal/experimental |
| **Embudo de ventas → 2.225 en "Atención al cliente"** | Carga (default) | **decisión del founder** ↓ | ver §Caso especial |
| Embudo de ventas → "asesoría personalizada" (36) | Carga | Negociación | |
| Atención a leeds (main, 0) | — | — | vacío; queda como main o se reemplaza |

### Caso especial — los 2.225 leads atascados en "Atención al cliente"
Llevan tiempo sin moverse y nunca cerraron → la mayoría son **fríos/muertos**. Tres opciones (decisión de Sam):
1. ⭐ **Bulk → "Perdido"** con motivo "limpieza cementerio 2026-06" + etiqueta Carga. Limpia el tablero de un
   golpe; siguen existiendo para reactivar.
2. Mover todos a **"Nuevo lead"** y re-trabajarlos (mucho trabajo manual, 2.225 leads).
3. Triage por fecha: los >90 días sin tocar → Perdido; el resto → Nuevo lead.

## Ejecución en Kommo (orden seguro — NO destructivo primero)

> Regla de oro: **nunca borrar un embudo con leads dentro** (Kommo los orfana). Primero vaciar, después borrar.

1. **(No destructivo) Crear el embudo "DTD — Ventas"** con las 6 etapas de arriba.
   `Leads → Configurar embudos → + Añadir embudo`. Marcar "Nuevo lead" como etapa entrante.
2. **(No destructivo) Crear el campo "Tipo de servicio"** (Leads → Configurar → Campos → + campo, tipo
   Lista) con las 6 opciones.
3. **Mover en lote, un embudo viejo a la vez** (de menor a mayor volumen para practicar con los chicos):
   - Abrir el embudo viejo → seleccionar todos → "Editar" en lote → setear "Tipo de servicio" = etiqueta
     del mapa → mover a "DTD — Ventas" / etapa destino.
   - Verificar que el embudo viejo quedó en **0**.
4. **Embudo de ventas** (el grande): aplicar primero la decisión del Caso especial a los 2.225, luego mover
   los 36 de "asesoría personalizada" → Negociación.
5. **Archivar/borrar** cada embudo viejo SOLO cuando esté en 0. (Kommo: ocultar/eliminar embudo.)
6. **Dejar "DTD — Ventas" como embudo principal** (o reemplazar "Atención a leeds").

## Re-mapear el ERP (OBLIGATORIO después de migrar)

El write-back del ERP (SDD-0084) apunta a **IDs de etapa** del embudo viejo. Al crear el embudo nuevo los IDs
**cambian** → el `stage_map` actual queda apuntando a etapas muertas.

1. Forzar un **sync** de Kommo (`/studio/kommo` o esperar el cron diario 7am UTC) para que el espejo
   (`kommo_pipelines` / `kommo_statuses`) traiga el embudo nuevo y sus IDs.
2. En `/studio/kommo → Dirección → "Mapa de etapas"`: re-mapear
   `enviado → Cotización enviada`, `aceptado → Ganado → Cliente`, `rechazado → Perdido`.
3. En `/studio/kommo → Dirección → "MARKBOX en Kommo"`: confirmar el custom field del MARKBOX (no se toca
   si ya estaba; ver runbook `activar-crm-kommo.md`).

## Seguridad y rollback

- **El write-back está APAGADO hoy** (`writeback_enabled=false`, `dry_run=true`) → reestructurar Kommo
  **no dispara** ninguna escritura del ERP mientras migras. Ventana ideal para hacerlo.
- **Rollback de la migración:** Kommo guarda el historial de cada lead (cambios de embudo/etapa). Si un bulk
  move sale mal, se revierte seleccionando los leads y moviéndolos de vuelta. Por eso se hace **un embudo a la
  vez** y se verifica el conteo antes de borrar nada.
- **No borrar nada hasta** que el embudo nuevo esté poblado y el ERP re-mapeado y verificado en dry-run.

## Estado de conexión (para automatizar con browser, si se quisiera)

- Cuenta: `https://doortudoor.kommo.com` (conexión `active` en `kommo_connections`).
- El navegador de la herramienta (Playwright/browse) es un contexto **aislado** → cae en el login de Kommo.
  Para que un agente maneje Kommo necesita: (a) CDP contra el Chrome real del founder (lanzar Chrome con
  `--remote-debugging-port`), o (b) importar cookies de Kommo (skill `setup-browser-cookies`, requiere clics
  del founder). Sin eso, la ejecución es **manual del founder con esta guía**.
