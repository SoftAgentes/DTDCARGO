---
sdd: "0002"
title: "Calculadora de Flete Terrestre Venezuela"
status: draft
author: "founder"
created: 2026-05-22
updated: 2026-05-22
supersedes: null
superseded_by: null
related: ["0001"]
confidencialidad: interno
---

# SDD-0002 — Calculadora de Flete Terrestre Venezuela

**Owner**: DTD-CARGO + Sam · **Depende de**: SDD-0001 (sitio público base)

---

## Contexto

DTD trae carga internacional China → Venezuela. Una vez la carga llega a Puerto Cabello (o La Guaira), el cliente final típicamente necesita transporte interno hasta su ciudad de destino. Hoy ese costo se cotiza ad-hoc por WhatsApp.

Queremos **una calculadora** que:
1. Le dé al cliente final una estimación cerrada antes de contactarnos
2. Le sirva al equipo DTD internamente para cotizar consistente y rápido
3. Se actualice trimestralmente con tarifas referencias del mercado VZLA

---

## Fuentes de data (ya investigadas, ver `_handoff_preview/tarifas-terrestres/`)

| Fuente | Tipo | Vigencia | Uso |
|---|---|---|---|
| Fletes GAG (4 PDFs) | Comercial / paquetería | 01-May-2026 | **Base USD/kg × zona × peso** |
| Cobra lo Justo | Gremial / contenedor | Indeterminada | Referencia FCL 20 ton |
| Mapa Pto Cabello DTD | Propio (derivado) | TBD | **Zonificación operativa DTD** |

---

## Arquitectura — 3 fases

### FASE C — Refinar Mapa Puerto Cabello DTD (input para A y B)

**Objetivo**: Validar la zonificación propuesta (zonas 1-11 desde Pto Cabello) contra la operación real de DTD.

**Tareas**:
- [ ] C.1 Revisar zona por zona el mapa actual en `tarifario-consolidado-vzla.xlsx` → hoja "Mapa Destino-Zona" columna "Puerto Cabello"
- [ ] C.2 Cruzar con destinos REALES donde DTD entregó en últimos 12 meses
- [ ] C.3 Ajustar zonas según experiencia operativa (qué cobran transportistas reales)
- [ ] C.4 Definir el multiplicador DTD por zona (¿1.0x universal o variable?)
- [ ] C.5 Versionar el mapa final como `puerto-cabello-dtd-v1.json`

**Output**: JSON canónico con zonificación DTD definitiva.
**Tiempo estimado**: 1-2 hs revisión colaborativa con equipo DTD.

---

### FASE A — Portear calculadora a /cotizar (web pública)

**Objetivo**: Cliente final puede calcular su flete terrestre desde dtdcargo.com sin contactar al asesor.

**Pre-requisito**: Fase C completada (mapa validado).

**Tareas**:
- [ ] A.1 Crear `lib/data/tarifas-terrestres-vzla.ts` con la data del Excel:
  - `ZONA_MAP`: Record<Origen, Record<Destino, ZonaNumber>>
  - `TARIFA_USD_KG`: Array de tramos con USD/kg por zona
  - `FACTOR_VOLUMETRICO_KG_M3 = 200`
  - `MULTIPLICADOR_DTD = 1.0` (configurable)
- [ ] A.2 Crear `lib/calc/fleteTerrestre.ts` con función pura:
  ```ts
  function calcularFleteTerrestre(input: {
    origen: 'Puerto Cabello' | 'Maracay' | 'Caracas' | ...
    destino: string
    pesoKg: number
    volumenM3?: number
    valorDeclaradoUsd?: number
    multiplicadorDtd?: number
  }): {
    zona: number
    pesoFacturable: number
    tarifaUsdKg: number
    fleteBase: number
    fpoUsd: number  // 6%
    seguroUsd: number  // 3% valor declarado
    subtotal: number
    ivaUsd: number  // 16%
    totalUsd: number
  }
  ```
- [ ] A.3 Refactor `app/cotizar/page.tsx` + `components/CotizarForm.tsx`:
  - Sección 1: "Internacional China → VZLA" (lo actual)
  - Sección 2: "Último km en VZLA" (nueva — usa calculadora)
- [ ] A.4 UI: dropdowns para origen + destino, inputs peso + volumen, output total
- [ ] A.5 Tests unitarios en `__tests__/calc-flete-terrestre.test.ts`
- [ ] A.6 Agregar al sitemap.xml y nav si corresponde

**Output**: `/cotizar` con calculadora terrestre funcional para el cliente.
**Tiempo estimado**: 3-4 hs desarrollo + testing.

---

### FASE B — Admin interno /admin/calculadora-vzla (con login)

**Objetivo**: Equipo DTD usa la calculadora con controles extra (multiplicador variable, override tarifas, log de cotizaciones).

**Pre-requisito**: Fase A completada + decisión sobre auth.

**Tareas**:
- [ ] B.1 Decidir stack de auth:
  - **Opción 1**: Payload CMS (ya está archivado en `_payload-disabled/`, reactivarlo)
  - **Opción 2**: NextAuth + email/password
  - **Opción 3**: Clave compartida simple en env var (low-tech, suficiente para 5 usuarios)
- [ ] B.2 Crear ruta `app/admin/calculadora-vzla/page.tsx` protegida
- [ ] B.3 UI extendida vs versión pública:
  - Multiplicador DTD editable por zona (no global)
  - Override de tarifa USD/kg si el caso es especial
  - Botón "Guardar cotización" → log a Postgres/Supabase
  - Botón "Generar PDF cotización" para enviar al cliente
- [ ] B.4 Log table: `cotizaciones_internas` con: timestamp, user, origen, destino, peso, total, notas
- [ ] B.5 Dashboard simple con últimas 50 cotizaciones del equipo

**Output**: Tool interno DTD para cotización + logging.
**Tiempo estimado**: 6-8 hs desarrollo (incluye auth) + 2 hs testing.

---

## Riesgos y consideraciones

1. **Atribución de fuentes**: Fletes GAG es empresa comercial. Si DTD muestra públicamente "USD/kg × zona", puede haber issue de IP. Mitigación: aplicar multiplicador DTD ≥1.0x y describir como "metodología DTD basada en estándares VZLA".

2. **Volatilidad VZLA**: las tarifas pueden cambiar mes a mes. La calculadora debe ser FÁCIL de actualizar:
   - Toda la data en `lib/data/tarifas-terrestres-vzla.ts` (1 archivo)
   - Update trimestral con script Python que re-genera el TS desde un Excel master

3. **Disclaimer obligatorio**: en /cotizar siempre debe decir "tarifa referencial, cotización final por WhatsApp en 24 hs".

4. **Cobertura limitada**: solo 5 orígenes confirmados (4 Fletes GAG + Pto Cabello DTD). Para otras ciudades origen, fallback a contacto WhatsApp.

---

## Métricas de éxito

- [ ] **Fase A**: 30%+ de visitantes de /cotizar usan la nueva calculadora terrestre
- [ ] **Fase B**: equipo DTD cotiza 50%+ más rápido vs proceso actual
- [ ] **Calidad data**: <10% de discrepancia entre cotización calculadora y precio final real

---

## Decisiones pendientes

1. Fase C: **¿quién valida el mapa Pto Cabello?** (Sam? equipo operaciones DTD? ambos?)
2. Fase A: **¿reemplazo o agregado?** /cotizar actual ya tiene form para envío internacional — ¿agregamos sección terrestre o creamos /cotizar-terrestre aparte?
3. Fase B: **¿qué stack de auth?** (decide tradeoff complejidad vs. madurez)
4. **¿multiplicador DTD inicial?** (1.0x = paridad Fletes GAG, 1.25x = +25% margen, etc.)
