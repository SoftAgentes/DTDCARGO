# Specs — DTDCargo

SDD (Specification-Driven Development) propio de DTDCargo. **No mezclar con el SDD del ERP HailuWay** — este repo tiene su propio correlativo desde 0001.

## Regla

No hay código sin spec aprobada.

## Estados

```
draft → proposed → approved → in-progress → done → superseded
```

Una spec no puede pasar a `in-progress` sin estar `approved`.

## Estructura

```
docs/specs/
├── README.md
└── NNNN-slug-corto/
    └── spec.md
```

`NNNN` es el siguiente correlativo (0001, 0002, …). Slug en `kebab-case`, corto.

## Commits

Cada PR referencia su spec:

```
feat(DTD-0001): scaffold inicial Next.js + branding
```

<!-- AUTO-INDEX:START (generado por scripts/build-docs-index.mjs · no editar a mano) -->
### Índice de specs (generado · 36 specs)

| # | Spec | Estado | Conf. |
|---|---|---|---|
| 0001 | Sitio web público MVP de DTD·CARGO | draft | interno |
| 0002 | Calculadora de Flete Terrestre Venezuela | draft | interno |
| 0003 | DoorTuDoor — Arquitectura MVP del ERP interno (multi-tenant r… | approved | interno |
| 0004 | DoorTuDoor — Fase 1: Studio shell + Auth | done | interno |
| 0005 | DoorTuDoor — Fase 2: Módulo Tracking (envíos + estados + dash… | done | interno |
| 0006 | DoorTuDoor — Fase 3: Tracking edición + detalle + timeline + … | approved | interno |
| 0007 | DoorTuDoor — Sprint 0.1: Studio Shell v1 (sidebar agrupado + … | approved | interno |
| 0008 | DoorTuDoor — Tarifas (módulo rates) · primer módulo real del … | approved | interno |
| 0009 | DoorTuDoor — Cambio de destino (feature en Tracking) | approved | interno |
| 0010 | DoorTuDoor — Clientes + MARKBOX (catálogo comercial) | approved | interno |
| 0011 | DoorTuDoor — Cotizador (Sprint 1 completo) | approved | interno |
| 0012 | DoorTuDoor — Embarques (vista comercial agrupada por cliente) | approved | interno |
| 0013 | DoorTuDoor — Tracking operativo (mapa + timeline) | approved | interno |
| 0014 | DoorTuDoor — Dashboard real (KPIs operativos + comerciales) | approved | interno |
| 0015 | DoorTuDoor — Calendario operativo (vista mes + feriados CN/VE) | approved | interno |
| 0016 | DoorTuDoor — Almacén CN (recepción + scope + traductor) | approved | interno |
| 0017 | DoorTuDoor — Almacén VE (vista derivada + 4 acciones operativas) | approved | interno |
| 0018 | DoorTuDoor — Aduana SENIAT (workflow aduanal VE) | approved | interno |
| 0019 | DoorTuDoor — TMS · Transporte interno VE | approved | interno |
| 0020 | DoorTuDoor — Agentes y Skills · infraestructura + Tracking Co… | approved | interno |
| 0021 | Facturación — Invoice + estados + pago (Bloque 1.1 financiero) | done | interno |
| 0024 | DoorTuDoor — Usuarios & Roles V1 simple (invitaciones + 6 rol… | approved | interno |
| 0025 | DoorTuDoor — No-Olvidar interno DTD-CARGO · envelope encrypti… | approved | interno |
| 0026 | DoorTuDoor — Mailing & Notificaciones (Resend + templates + s… | approved | interno |
| 0029 | DTD Studio — Módulo de Despacho · cola priorizada + motor de … | approved | interno |
| 0030 | Despacho · Apps móviles bodeguero VE + camionero VE (PWAs) | approved | interno |
| 0031 | Etiquetas suppliers CN · PDF bilingüe ES/中文 + QR mock + copia… | approved | interno |
| 0032 | Críticos v1.5 + cross-links cliente · MARKBOX validation + em… | approved | interno |
| 0033 | Cola de impresión QR · oficina + push del operario CN | approved | interno |
| 0034 | Wiring 9 conexiones rotas · modals globales (DTDWiring) | approved | interno |
| 0035 | Dashboard · RecentActivity widget clickeable + CodesSync defe… | approved | interno |
| 0036 | Bug Reporter · módulo interno de bug tracking con auto-captur… | done | interno |
| 0038 | i18n CN · región como fuente de verdad + chrome bilingüe es-V… | done | interno |
| 0039 | Gastos CN · scope contenedor/operativo + moneda dual CNY/USD … | in-progress | interno |
| 0040 | Contabilidad — plan de cuentas + diario/mayor + P&L/Balance +… | done | interno |
| 0041 | Cobranzas — recibos de pago + asiento del cobro + cola CxC (B… | done | interno |

> **Huecos en el correlativo:** 0022, 0023, 0027, 0028, 0037 — código sin spec o renumerado, auditar caso por caso.
<!-- AUTO-INDEX:END -->
