# Identidad pública — DTD Cargo

> **Fuente única de la identidad pública de la empresa** (nombre legal, datos, convención de
> nombres, NAP). Lo consumen el schema (`app/layout.tsx`), el footer, `/contacto` y `llms.txt`.
> Mantiene la consistencia entre esas superficies.
>
> **Estado (2026-06-08).**

## Entidad legal

| Dato | Valor |
|---|---|
| Marca comercial (pública) | **DTD Cargo** |
| Sello de herencia + nombre del ERP interno | **DoorTuDoor** |
| Razón social | **INVERSIONES DTD SERVICES, C.A** |
| RIF / taxID | **J-50648869-8** |
| Representante legal | **José Méndez** |
| Fundada | **2010** (narrativa "+15 años") |
| Handle social | **@doortudoor_** (Instagram) |

## Convención de nombres (regla del founder)

- **Público = "DTD Cargo"** (dos palabras; nunca "DTDCARGO").
- **"DoorTuDoor"** = sello de herencia **y** nombre del ERP/Studio interno (`app/studio`).
- La **razón social y el RIF van SOLO en el schema** (`legalName`/`taxID`) — **nunca en texto
  visible** del sitio.
- **RIF ÚNICO (decisión founder 2026-06-10): `J-50648869-8`.** Cualquier otro RIF de DTD que
  aparezca en material de marca/diseño/legal (`J-410322887`, `J-40558712-0`, `J-40551122-3`,
  `J-50220185-8` circulaban en el Norte) es **incorrecto → reemplazar** por el canónico. En
  material impreso/legal (factura, tarjeta, membrete, T&C) el RIF **sí** va visible — la regla
  "solo en schema" aplica al **sitio público** (SEO). Los RIF mock de clientes demo no se tocan.

## NAP canónico (Name–Address–Phone)

| Campo | Valor |
|---|---|
| Nombre (schema `name`) | DTD Cargo |
| `alternateName` | DoorTuDoor · Doortudoor Services |
| Sede Venezuela | Edificio Kokuy, Calle 151 (entre Av. Bolívar Norte y Av. Paseo Cabriales) — Valencia, Carabobo, VE · CP 2001 · GPS 10.220449, -68.008481 |
| Bodega China | Yiwu Port Phase II, Warehouse 2, No. 2 (Cargo 7-11) — Yiwu, Zhejiang, CN |
| Teléfono público primario | +58 412 166 8021 (CRM WhatsApp) |
| Teléfono público secundario | +58 241 414 7886 (Fijo Valencia) |
| Email general | info@dtdcargo.com |

*(Los datos vivos están en `CONTACT` de `lib/design-tokens.ts` — esa es la fuente que consume el
schema. Esta tabla es la referencia canónica para mantener la consistencia entre superficies.)*

## Versión-máquina (schema.org)

La identidad legible por Google / motores de IA vive en el **`@graph` de `app/layout.tsx`**
(nodo `#organization` `LocalBusiness` + nodo `#website`). `legalName`, `taxID` y `founder` solo
existen ahí, no en texto visible. *(Pendiente de la Fase 2 del plan de identidad.)*

## Ficha portable — "arrancar un chat nuevo"

```
EMPRESA: DTD Cargo (público) · sello "DoorTuDoor" · IG @doortudoor_
RAZÓN SOCIAL: INVERSIONES DTD SERVICES, C.A — RIF J-50648869-8 — rep. legal José Méndez
RUBRO: logística end-to-end China→Venezuela desde 2010 (+15 años); DDP puerta a puerta,
  agente de compra, inspección de fábrica; equipo propio en Yiwu y Valencia.
WEB: dtdcargo.com (Next.js 16 App Router / React 19 / Tailwind v4 / pnpm). doortudoor.com
  redirige 301 (no dejar expirar, no servir contenido propio ahí).
NOMBRES: público "DTD Cargo"; razón social SOLO en schema (legalName/taxID).
FOUNDER (Sam): dueño-operador entre Yiwu y Venezuela; decide rápido, español (VE), quiere
  salidas listas para copiar con rutas explícitas. Opciones A/B/C ordenadas por prioridad,
  #1 con ⭐. Preguntas cortas. Decir "Fase 5", no "F5". Verificar la rama antes de commit;
  NO push sin su OK; commits selectivos si hay varias ventanas.
NORTE: cerrar el loop comercial del ERP (recompra día 30/45 + alertas de cadencia + KPI 2
  contenedores/mes + white-label para aliados) sobre el Studio existente (20+ módulos en prod).
REPO: instrucciones en AGENTS.md (CLAUDE.md solo lo importa). Marketing/SEO en docs/marketing/.
```

## Relacionados
- Estrategia (propósito/misión/visión/valores): [`estrategia.md`](estrategia.md).
- Ventas / cliente-ancla: [`ventas.md`](ventas.md).
- Reglas SEO/GEO: [`seo.md`](seo.md).
