# CAMBIO DE GOBERNANZA · 2026-11-12

## SGE v7.0 → v8.0 · Alta de SGE-AG-01 v0.2 · Aprobado por Sam

| Control | Valor |
|---|---|
| Tipo de cambio | L3 (política nueva + reestructura de protocolo) |
| Solicitante y aprobador | Sam (founder) — autorización 12/11/2026 |
| Redacción | Hermes (asistente de Sam) |
| Estado | aprobada en contenido · pendiente merge al repo |
| Evidencia | OWASP Top 10 Agentic 2026 · CSA MAESTRO · NIST Agent Standards · ISO 42001 · EU AI Act |

## Cambios (delta v7.0 → v8.0)

1. Protocolo de cambio por TIERS (L0–L3) con ceremonia proporcional.
2. Delegación acotada de aprobación (L0/L1 por delegado escrito; Sam conserva L3, dinero e irreversible).
3. Índice generado desde governance-capsule.json; prohibida la edición manual del README.
4. Archivo sin borrado: baselines >90 días a docs/archive/.
5. KPIs de la gobernanza (adopción, backlog, tiempo de cambio, peso documental).
6. Consolidación de actas por dominio; individual solo lo irreversible.
7. Eliminación del estado "auditar al tocar" → "no aplica hasta <flujo X>".
8. Alta de SGE-AG-01 v0.2 (identidad, L0/L1, presupuesto, anti-inyección, kill switch, auditoría+replay, AI-SBOM, red teaming, incidentes, madurez).
9. Políticas de UI marcadas "no aplica a agentes" (BTN, VIS, MOT, LOD, ICO, TBL, A11Y, FRM, HTD, AVS, DND, BUS).
10. Proveedores de modelos (Z.AI, Anthropic, OpenAI, DeepSeek) a registrarse como terceros en docs/legal/privacidad/inventario-terceros.md (viaja en la SDD-0612).

## Revisión de impacto

Legal: registro de terceros de IA (SDD-0612). Contable: sin cambio de montos.
Permisos: hereda AUD/MP/RBAC; no crea privilegios. Auditoría: replay en
agent_runs solo-agregar. Seguridad: añade controles; no los reduce.
Móvil/accesibilidad: no aplica.

## Integración

1. Commit de los 3 archivos (README.md v8.0, policies/sge-ag-01.md, este documento) en rama.
2. Mover baselines >90 días a docs/archive/ en el mismo cambio (sin borrar).
3. PR → revisión de custodia → merge aprobado por Sam.
4. governance:check verde tras generar el índice desde el registro.
5. La implementación técnica (índice generado, KPIs, registro de terceros) viaja en la SDD-0612.
