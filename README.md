# DTDCargo — sitio web público

Sitio comercial e institucional de **DTDCargo** (operador logístico China → Venezuela).
Cliente del ERP **HailuWay** — consume sus APIs públicas vía HTTP, **sin código compartido**.

## Aislamiento del ERP

Este proyecto vive en su **propia carpeta** (`C:\Users\Trabajo\Desktop\DTDCargo\`),
totalmente separado del repo `hailuway-erp`. No hay imports cruzados, no hay DB
compartida, no hay specs compartidas. La comunicación es **solo HTTP** contra los
endpoints `*/api/public/*` que el ERP expone.

```
┌──────────────────────┐    HTTPS     ┌──────────────────────┐
│  DTDCargo (este)     │  ─────────▶  │  hailuway-erp        │
│  dtdcargo.com        │              │  erp.hailuway.com    │
└──────────────────────┘              └──────────────────────┘
```

## Stack

- **Next.js 16** App Router + **TypeScript** + **Tailwind v4** + **React 19**
- **pnpm** para packages
- **Vercel** para deploy (proyecto independiente del ERP)
- Cero dependencias del repo HailuWay

## Estructura

```
DTDCargo/
├── README.md              ← este archivo
├── docs/
│   └── specs/             ← SDD propio (correlativo desde 0001)
│       ├── README.md
│       └── 0001-mvp-public-web/
│           └── spec.md
└── (scaffold Next.js viene después de aprobar spec 0001)
```

## Estado

🟡 **Pre-MVP** — spec 0001 en draft. Sin código todavía.

## Variables de entorno (cuando arranquemos)

```
NEXT_PUBLIC_HAILUWAY_API=https://erp.hailuway.com
DTD_API_KEY=<provista por HailuWay como tenant cliente>
WHATSAPP_BUSINESS_NUMBER=<número público>
```
