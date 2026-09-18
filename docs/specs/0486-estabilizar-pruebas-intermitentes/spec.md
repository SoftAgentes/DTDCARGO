---
id: 0486
slug: estabilizar-pruebas-intermitentes
status: reserved
related: ["0479"]
---

# SDD-0486 — Las pruebas intermitentes de la suite dejan de dar rojos falsos

**RESERVA DE NÚMERO.** El contenido real lo escribe la sesión asignada en su
propia rama de trabajo. Este stub sólo existe para que el número quede tomado.

Reservado por coordinación el 2026-09-18, sobre `cc15e48c`. Sin migración.

## El problema

Cuatro pruebas fallan de forma intermitente en la suite completa local, aun con
la máquina libre, y pasan en el CI de GitHub: `PackingListProductsStep`,
`supplier-flow`, `ClientDrawer.confirm-delete` e `invoice-read-boundary`. Cada
rojo falso cuesta otra corrida de `pnpm verify` y confunde la revisión de PRs.

Sin cambio de producto ni migraciones. El criterio de AGENTS.md rige: no se
debilita ninguna prueba.
