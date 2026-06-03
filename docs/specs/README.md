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
### Índice de specs (generado · 45 specs)

| # | Spec | Estado | Conf. |
|---|---|---|---|
| 0001 | Sitio web público MVP de DTD·CARGO | done | interno |
| 0002 | Calculadora de Flete Terrestre Venezuela | done | interno |
| 0003 | DoorTuDoor — Arquitectura MVP del ERP interno (multi-tenant r… | approved | interno |
| 0004 | DoorTuDoor — Fase 1: Studio shell + Auth | done | interno |
| 0005 | DoorTuDoor — Fase 2: Módulo Tracking (envíos + estados + dash… | done | interno |
| 0006 | DoorTuDoor — Fase 3: Tracking edición + detalle + timeline + … | done | interno |
| 0007 | DoorTuDoor — Sprint 0.1: Studio Shell v1 (sidebar agrupado + … | done | interno |
| 0008 | DoorTuDoor — Tarifas (módulo rates) · primer módulo real del … | done | interno |
| 0009 | DoorTuDoor — Cambio de destino (feature en Tracking) | done | interno |
| 0010 | DoorTuDoor — Clientes + MARKBOX (catálogo comercial) | done | interno |
| 0011 | DoorTuDoor — Cotizador (Sprint 1 completo) | done | interno |
| 0012 | DoorTuDoor — Embarques (vista comercial agrupada por cliente) | done | interno |
| 0013 | DoorTuDoor — Tracking operativo (mapa + timeline) | done | interno |
| 0014 | DoorTuDoor — Dashboard real (KPIs operativos + comerciales) | done | interno |
| 0015 | DoorTuDoor — Calendario operativo (vista mes + feriados CN/VE) | done | interno |
| 0016 | DoorTuDoor — Almacén CN (recepción + scope + traductor) | done | interno |
| 0017 | DoorTuDoor — Almacén VE (vista derivada + 4 acciones operativas) | done | interno |
| 0018 | DoorTuDoor — Aduana SENIAT (workflow aduanal VE) | done | interno |
| 0019 | DoorTuDoor — TMS · Transporte interno VE | done | interno |
| 0020 | DoorTuDoor — Agentes y Skills · infraestructura + Tracking Co… | done | interno |
| 0021 | Facturación — Invoice + estados + pago (Bloque 1.1 financiero) | done | interno |
| 0024 | DoorTuDoor — Usuarios & Roles V1 simple (invitaciones + 6 rol… | done | interno |
| 0025 | DoorTuDoor — No-Olvidar interno DTD-CARGO · envelope encrypti… | approved | interno |
| 0026 | DoorTuDoor — Mailing & Notificaciones (Resend + templates + s… | done | interno |
| 0029 | DTD Studio — Módulo de Despacho · cola priorizada + motor de … | done | interno |
| 0030 | Despacho · Apps móviles bodeguero VE + camionero VE (PWAs) | done | interno |
| 0031 | Etiquetas suppliers CN · PDF bilingüe ES/中文 + QR mock + copia… | done | interno |
| 0032 | Críticos v1.5 + cross-links cliente · MARKBOX validation + em… | done | interno |
| 0033 | Cola de impresión QR · oficina + push del operario CN | done | interno |
| 0034 | Wiring 9 conexiones rotas · modals globales (DTDWiring) | done | interno |
| 0035 | Dashboard · RecentActivity widget clickeable + CodesSync defe… | done | interno |
| 0036 | Bug Reporter · módulo interno de bug tracking con auto-captur… | done | interno |
| 0038 | i18n CN · región como fuente de verdad + chrome bilingüe es-V… | done | interno |
| 0039 | Gastos CN · scope contenedor/operativo + moneda dual CNY/USD … | done | interno |
| 0040 | Contabilidad — plan de cuentas + diario/mayor + P&L/Balance +… | done | interno |
| 0041 | Cobranzas — recibos de pago + asiento del cobro + cola CxC (B… | done | interno |
| 0042 | Portal del Cliente — auth de cliente + mis envíos (V1) | in-progress | interno |
| 0043 | Conector Kommo CRM — Alcance A (espejo read-only) | done | interno |
| 0044 | Tesorería — Proveedores + CxP + órdenes de pago + asiento del… | done | interno |
| 0045 | Comentarios + @menciones transversales — hilo embebible en cu… | done | interno |
| 0046 | Verificación de identidad de clientes — motor 2 vías (CNE céd… | done | interno |
| 0047 | Naviera & Consolidación — carriers + itinerarios + bookings/B… | done | interno |
| 0048 | Dirección · Tablero ejecutivo — vista consolidada read-only, … | done | interno |
| 0049 | Documentos · Hub DMS — adjuntos polimórficos embebibles + car… | approved | interno |
| 0050 | Torre de control en /studio/debug — Estado + Bugs + Norte + R… | in-progress | interno |

> **Huecos en el correlativo:** 0022, 0023, 0027, 0028, 0037 — código sin spec o renumerado, auditar caso por caso.
<!-- AUTO-INDEX:END -->
