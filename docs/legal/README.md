# `docs/legal/` — Registros legales (confidencial)

> **Clasificación: `confidencial`.** Los binarios originales están en este folder pero **fuera de git**
> (gitignored: `docs/legal/*.pdf`). Quedan en disco local — mover a Drive para backup.

## Qué hay acá (en disco, NO en git)

| Archivo | Qué es | Retención (ISO 15489) |
|---|---|---|
| `Acuerdo de Servicios - DTD SERVICES.pdf` | Acuerdo de servicios con cliente (plantilla/base) | Indefinida |
| `Acuerdo de confidencialidad ... proveedores.pdf` | NDA + protección de precios para proveedores | Indefinida |

## Para qué sirven

Base para **recrear acuerdos con clientes/proveedores**. Los originales viven en disco local
(gitignored); Claude puede leerlos cuando haga falta redactar/recrear un acuerdo. No se commitean
(regla: `confidencial` nunca en git).

Sacados del tracking de git el 2026-05-29 (reorg ISO, decisión T4: **aceptar exposición histórica**
del commit previo; sin purga de historial mientras el repo siga privado).
