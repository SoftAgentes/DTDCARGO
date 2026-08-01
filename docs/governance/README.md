# Sistema de Gobernanza de Experiencia ERP_Studio

| Control | Valor |
|---|---|
| Documento | Índice maestro del Sistema de Gobernanza |
| Versión | 6.4 |
| Dueño | Sam (founder) |
| Custodia | Producto + Diseño + Ingeniería |
| Estado | activo |
| Creado | 2026-07-21 |
| Última revisión | 2026-07-31 |
| Confidencialidad | interno |
| Línea base vigente | [LB-SGE-104 · Baseline de cobertura de gobernanza v1](BASELINE-2026-07-31-09.md) |

Este es el punto de entrada canónico para decidir **cómo debe comportarse** el
ERP. No reemplaza la identidad visual ni las especificaciones de
implementación: las conecta, registra su madurez y evita que cada módulo
invente sus propias reglas.

> La aprobación de una línea base aprueba el inventario y el estado registrado.
> No convierte una regla investigada o redactada en una política aprobada.

## 1. Alcance

La gobernanza cubre:

- semántica y jerarquía de acciones;
- permanencia, eliminación, anulación, restauración y auditoría;
- avisos, errores, progreso y estados del sistema;
- búsqueda, creación rápida, formularios, tablas y carga de archivos;
- movimiento, calendarios, drag and drop y adaptación móvil;
- tipografía, jerarquía visual, accesibilidad y contenido dirigido al cliente;
- comportamiento de funciones asistidas por IA;
- ciclo de vida de componentes y futura automatización mediante plugin.

No guarda mockups, archivos de marca ni contratos técnicos detallados. Esos
artefactos permanecen en sus fuentes correspondientes.

## 2. Fuentes de verdad relacionadas

| Tema | Fuente canónica |
|---|---|
| Identidad visual, colores, tipografías permitidas y excepciones | [`BRAND.md`](../../BRAND.md) |
| Norte visual vigente y handoffs | [`docs/design/studio/_norte/`](../design/studio/_norte/) |
| Decisiones visuales aprobadas | [`BRAND-DECISIONS.md`](../design/studio/_norte/BRAND-DECISIONS.md) |
| Reglas técnicas del Studio | [`app/studio/CLAUDE.md`](../../app/studio/CLAUDE.md) |
| Tokens de interfaz | [`app/studio/tokens.css`](../../app/studio/tokens.css) |
| Constitución de experiencia | [SGE-00 v1.0](policies/sge-00.md) |
| Revisión conjunta Constitución + botones | [REV-SGE-002](reviews/sge-00-btn-01.md) |
| Permanencia y eliminación | [MP-01 v1.1](policies/mp-01.md) |
| Aprobación de defaults MP-D1 a MP-D7 | [REV-MP-001](reviews/mp-01-decisions.md) |
| Primer slice MP-01 aprobado | [SDD-0168 · comentarios internos](../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) |
| Diseño técnico del primer slice MP-01 | [DT-SDD-0168 v1.0](../specs/0168-mp-01-comentarios-permanencia-restauracion/diseno-tecnico.md) |
| Revisión técnica del diseño de comentarios | [REV-MP-002](reviews/mp-01-comments-design.md) |
| Revisión de implementación de comentarios | [REV-MP-003](reviews/mp-01-comments-implementation.md) |
| Revisión local de DB-2 de comentarios | [REV-MP-004](reviews/mp-01-comments-db2.md) |
| Revalidación Preview, Producción y limpieza de comentarios | [REV-MP-005](reviews/mp-01-comments-preview-e2e.md) |
| Botones y acciones | [BTN-01 v1.1](policies/btn-01.md) |
| Presión sostenida crítica | [HTD-01 v1.0](policies/htd-01.md) |
| Auditoría de mutaciones | [AUD-01 v1.0](policies/aud-01.md) |
| Consulta, retención y exportación de logs | [AUD-02 v1.0](policies/aud-02.md) |
| Revisión normativa AUD-02 | [REV-AUD-001](reviews/aud-02.md) |
| Corrección conjunta de auditoría | [SDD-0166](../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Evidencia del inventario AUD | [Corte A · repo/local](../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-a-2026-07-21.md) |
| Diseño correctivo del Corte A | [Catálogo + matriz ACL v1.0](../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-a.md) |
| Revisión del diseño Corte A | [REV-AUD-002](reviews/aud-corte-a.md) |
| Revisión de aplicación individual A1 | [REV-AUD-003](reviews/aud-corte-a1.md) |
| Recibo de aplicación A1 | [REV-AUD-004](reviews/aud-corte-a1-aplicacion.md) |
| Revisión de aplicación individual A2 | [REV-AUD-005](reviews/aud-corte-a2.md) |
| Recibo de aplicación A2 | [REV-AUD-006](reviews/aud-corte-a2-aplicacion.md) |
| Inventario read-only del Corte B | [B0 · repo y Cloud](../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-b-2026-07-28.md) |
| Diseño correctivo del Corte B | [Contrato aditivo y append-only v1.0](../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-b.md) |
| Revisión del diseño Corte B | [REV-AUD-007](reviews/aud-corte-b.md) |
| Revisión técnica local Corte B1 | [REV-AUD-008](reviews/aud-corte-b1.md) |
| Recibo de aplicación Cloud Corte B1 | [REV-AUD-009](reviews/aud-corte-b1-aplicacion.md) |
| Diseño de ciclo de vida tenant/fixtures | [Contrato v1.0](../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-ciclo-vida-tenant-fixtures.md) |
| Revisión del ciclo de vida tenant/fixtures | [REV-AUD-010](reviews/aud-tenant-fixtures.md) |
| Implementación del ciclo tenant/fixtures | [SDD-0172](../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Revisión técnica local de SDD-0172 | [REV-AUD-011](reviews/aud-tenant-fixtures-implementation.md) |
| Recibo Cloud de 0268 | [REV-AUD-018](reviews/aud-tenant-lifecycle-aplicacion.md) |
| Intento efímero y teardown terminal SDD-0172 | [REV-AUD-019](reviews/aud-tenant-fixtures-ephemeral-validation.md) |
| Reparación local del payload 0210 | [REV-AUD-028](reviews/aud-sdd-0118-pin-search-path-history.md) |
| Recibo Cloud de 0275 | [REV-AUD-029](reviews/aud-sdd-0118-pin-search-path-history-application.md) |
| Reparación histórica de `rls_auto_enable` | [REV-AUD-032](reviews/aud-sdd-0118-rls-auto-enable-history.md) |
| Reparación histórica del ACL tenant antes de 0268 | [REV-AUD-033](reviews/aud-sdd-0172-tenant-acl-history.md) |
| Reparación del preflight 0271 ante ledger fragmentado | [REV-AUD-034](reviews/aud-sdd-0118-split-replay-history.md) |
| Aplicación de 0280 y reparación del skip de invitaciones fragmentado | [REV-AUD-035](reviews/aud-sdd-0118-invite-skip-split-history.md) |
| Aplicación de 0281, replay R13 y reparación del split de platform_admins | [REV-AUD-036](reviews/aud-sdd-0118-platform-admin-split-history.md) |
| Aplicación de 0282, replay R14 y reparación del split de calculator_settings | [REV-AUD-037](reviews/aud-sdd-0118-calculator-split-history.md) |
| Aplicación de 0283, replay R15 y reparación del split de pin_search_path | [REV-AUD-038](reviews/aud-sdd-0118-pin-split-history.md) |
| Cierre de SDD-0118/0172, replay R29 y teardown terminal | [REV-AUD-039](reviews/aud-sdd-0118-0172-final-closure.md) |
| Inventario read-only del Corte C | [C0 · repo y Cloud](../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-c-2026-07-28.md) |
| Diseño correctivo del Corte C | [Consulta gobernada y RBAC v1.1](../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-c.md) |
| Revisión del diseño Corte C | [REV-AUD-012](reviews/aud-corte-c.md) |
| Revisión técnica local Corte C1 | [REV-AUD-013](reviews/aud-corte-c1.md) |
| Preflight fresco Corte C1 | [REV-AUD-040](reviews/aud-corte-c1-preflight-2026-07-30.md) |
| Inventario read-only del Corte D | [D0 · repo y Cloud](../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-d-2026-07-29.md) |
| Diseño correctivo del Corte D | [Atomicidad por dominio v1.0](../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-d.md) |
| Revisión del diseño Corte D | [REV-AUD-014](reviews/aud-corte-d.md) |
| Atomicidad por dominios | [SDD-0174](../specs/0174-audit-atomicidad-dominios/spec.md) |
| Inventario y revisión D1 | [REV-AUD-015](reviews/aud-d1-access-config.md) |
| Diseño técnico D1 | [REV-AUD-017](reviews/aud-d1-access-config-design.md) |
| Implementación local D1 | [REV-AUD-018](reviews/aud-d1-access-config-implementation.md) |
| Implementación local D2 | [REV-AUD-019](reviews/aud-d2-financial-domain.md) |
| Implementación local D3 | [REV-AUD-020](reviews/aud-d3-commercial-cycle.md) |
| Implementación local D4 | [REV-AUD-021](reviews/aud-d4-logistics-r3.md) |
| Implementación local D5 | [REV-AUD-022](reviews/aud-d5-residual.md) |
| Aplicación individual de C1 y D1–D5 | [REV-AUD-042](reviews/aud-roadmap-prod-application.md) |
| Motivos humanos D2 R3 | [SDD-0187 + REV-AUD-043](../specs/0187-audit-d2-human-reasons/spec.md) |
| Motivos humanos D3 R3 | [SDD-0188 + REV-AUD-044](../specs/0188-audit-d3-human-reasons/spec.md) |
| Path vacío D4 R3 | [SDD-0189 + REV-AUD-045](../specs/0189-audit-d4-empty-search-path/spec.md) |
| Cierre productivo D2–D4 y SDD-0174 | [REV-AUD-046](reviews/aud-sdd-0174-prod-close.md) |
| Inventario read-only del Corte E | [E0 · repo y Cloud](../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-e-2026-07-29.md) |
| Diseño y revisión del Corte E | [REV-AUD-016](reviews/aud-corte-e.md) |
| Fundamento verificable del Corte E | [SDD-0186 + REV-AUD-041](../specs/0186-audit-retention-foundation/spec.md) |
| Jerarquía visual | [VIS-01 v1.0](policies/vis-01.md) |
| Tipografía por voz e idioma | [VIS-02 v1.0](policies/vis-02.md) |
| Accesibilidad transversal | [A11Y-01 v1.1](policies/a11y-01.md) |
| Movimiento y tiempos | [MOT-01 v1.0](policies/mot-01.md) |
| Carga y espera | [LOD-01 v1.0](policies/lod-01.md) |
| Errores y recuperación | [ERR-01 v1.0](policies/err-01.md) |
| Búsqueda | [BUS-01 v1.1](policies/bus-01.md) |
| Creación rápida | [CRT-01 v1.0](policies/crt-01.md) |
| Campos numéricos | [NUM-01 v1.1](policies/num-01.md) |
| Formularios | [FRM-01 v1.1](policies/frm-01.md) |
| Tablas | [TBL-01 v1.0](policies/tbl-01.md) |
| Iconografía | [ICO-01 v1.0](policies/ico-01.md) |
| Carga de archivos | [UPL-01 v1.0](policies/upl-01.md) |
| Drag and drop / Kanban | [DND-01 v1.0](policies/dnd-01.md) |
| Calendario operativo | [CAL-01 v1.0](policies/cal-01.md) |
| Selector de fecha/rango | [DAT-01 v1.0](policies/dat-01.md) |
| Progreso | [PRG-01 v1.0](policies/prg-01.md) |
| Flujos por pasos | [WIZ-01 v1.0](policies/wiz-01.md) |
| Interacciones con IA | [IA-01 v1.0](policies/ia-01.md) |
| Aprobación normativa de 17 políticas | [REV-SGE-003 a REV-SGE-005](reviews/sge-policy-blocks-01-04.md) |
| Ciclo de vida de componentes | [CMP-01 v1.1](policies/cmp-01.md) |
| Revisión normativa CMP-01 | [REV-SGE-006](reviews/cmp-01.md) |
| Diseño del registro CMP-01 | [REV-SGE-010](reviews/cmp-01-registry-design.md) |
| Primer componente CMP-01 canónico | [REV-SGE-012 · ConfirmDialog](reviews/cmp-confirm-dialog-canonical.md) |
| Plugin de gobernanza | [PLG-01 v1.0](policies/plg-01.md) |
| Revisión normativa PLG-01 | [REV-SGE-007](reviews/plg-01.md) |
| Diseño técnico PLG-01 | [SDD-0178 + REV-SGE-011](../specs/0178-plugin-gobernanza-erp-studio/spec.md) |
| Destino repo/team PLG-01 | [REV-SGE-013](reviews/plg-01-destination.md) |
| Auditoría SGE/BTN/VIS/AVS | [REV-SGE-008](reviews/adoption-sge-btn-vis-avs-2026-07-29.md) |
| Plan de adopción por slices | [REV-SGE-009](reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md) |
| Baseline de cobertura de los 57 módulos | [REV-SGE-029](reviews/governance-coverage-baseline-v1-2026-07-31.md) |
| Auditoría R3 de anulación de finiquito de Nómina | [REV-SGE-030](reviews/payroll-r3-settlement-void-audit-2026-07-31.md) |
| Cierre del warning NFT en assets privados de marca | [REV-SGE-032](reviews/nft-brand-asset-trace-close-2026-07-31.md) |
| Preflight operativo E5 con elegibilidad cero | [REV-AUD-051](reviews/aud-e5-operational-preflight-2026-07-31.md) |
| Auditoría y retiro seguro de worktrees históricos | [REV-SGE-033](reviews/governance-worktree-retirement-2026-07-31.md) |
| Muestreo read-only de Sistema y Legal | [REV-SGE-034](reviews/governance-system-legal-sample-2026-07-31.md) |
| Auditoría R3 de pago de cruce en Financiero China | [REV-SGE-035](reviews/partner-finance-r3-claim-payment-audit-2026-07-31.md) |
| Implementación R3 de pago gobernado en Financiero China | [REV-SGE-036](reviews/partner-finance-r3-claim-payment-implementation-2026-07-31.md) |
| Auditoría R3 de liberación en Aduana SENIAT | [REV-SGE-037](reviews/customs-seniat-r3-clearance-audit-2026-07-31.md) |
| Implementación R3 de liberación gobernada en Aduana SENIAT | [REV-SGE-038](reviews/customs-seniat-r3-clearance-implementation-2026-07-31.md) |
| Muestreo operativo R3 de seis módulos | [REV-SGE-039](reviews/governance-operations-r3-sample-2026-07-31.md) |
| Implementación R3 de pago gobernado en Reclamos | [REV-SGE-040](reviews/client-claims-r3-indemnity-payment-implementation-2026-07-31.md) |
| Implementación R3 de cierre gobernado de ruta TMS | [REV-SGE-041](reviews/tms-r3-route-completion-implementation-2026-08-01.md) |
| Implementación R3 de entrega manual gobernada en Almacén VE | [REV-SGE-042](reviews/warehouse-ve-r3-delivery-implementation-2026-08-01.md) |
| Revisión de patrones UX en videos | [REV-SGE-014](reviews/ux-patterns-video-audit-2026-07-29.md) |
| Portabilidad EOL de SDD-0118 | [REV-AUD-030](reviews/aud-sdd-0118-eol-portability.md) |
| Dependencias ejecutables CMP-01 | [REV-SGE-015](reviews/cmp-01-dependency-validation.md) |
| Estabilidad bajo carga del guardia SDD-0164 | [REV-SGE-016](reviews/shipment-public-test-load-hardening.md) |
| CMP-01 v1.1 y primer deprecated | [REV-SGE-017](reviews/cmp-01-v1-1-deprecated.md) |
| Control plane ejecutable | [REV-SGE-018](reviews/governance-control-plane.md) |
| Scaffold read-only PLG-01 | [REV-SGE-019](reviews/plg-01-scaffold.md) |
| Precisión decimal y NumericInput canónico | [REV-SGE-020](reviews/num-01-v1-1-numeric-input.md) |
| Instalación y forward-test PLG-01 | [REV-SGE-021](reviews/plg-01-install-forward-test.md) |
| Runner y reinstalación durable PLG-01 | [REV-SGE-025](reviews/plg-01-durable-runner-2026-07-31.md) |
| Integración local del roadmap de gobernanza | [REV-SGE-022](reviews/governance-roadmap-batch-close.md) |
| Cierre local de Gobernanza 6 | [REV-SGE-023](reviews/governance-roadmap-pending-closure.md) |
| Tabs accesibles en Fiscal | [SDD-0180](../specs/0180-tabs-accesibles-fiscal/spec.md) |
| Selectores accesibles y colisión | [SDD-0181](../specs/0181-selectores-accesibles-colision/spec.md) |
| Validación progresiva en Club | [SDD-0182](../specs/0182-validacion-progresiva-identidad-club/spec.md) |
| Expresiones decimales y retención fiscal | [SDD-0185](../specs/0185-num-01-expresiones-decimales/spec.md) |
| Implementación VIS-02 | [SDD-0175 done · V0–V4 cerrados](../specs/0175-vis-02-tipografia-voz-idioma/spec.md) |
| Decisión documental Noto Serif SC | [REV-VIS-002 · BD-036](reviews/vis-02-brand-gate.md) |
| Cierre documental de VIS-02 V1 | [REV-VIS-003](reviews/vis-02-v1-closure.md) |
| VIS-02 V2 email | [REV-VIS-004](reviews/vis-02-v2-email.md) |
| VIS-02 V3 PDF | [REV-VIS-005](reviews/vis-02-v3-pdf.md) |
| VIS-02 V4 local | [REV-VIS-006](reviews/vis-02-v4-visual.md) |
| Reconciliación VIS-02 | [REV-VIS-007](reviews/vis-02-state-reconciliation.md) |
| Gates siguientes VIS-02 | [REV-VIS-008](reviews/vis-02-future-gates-reconciliation.md) |
| Inventario VIS-02 | [REV-VIS-009](reviews/vis-02-inventory-reconciliation.md) |
| Evidencia externa VIS-02 | [REV-VIS-010](reviews/vis-02-external-mail-client-evidence.md) |
| Auditoría integral Gobernanza 8 | [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| Cierre técnico integral Gobernanza 8 | [REV-SGE-026](reviews/governance-8-final-close-2026-07-31.md) |
| Preflight productivo Gobernanza 8 | [REV-SGE-027](reviews/governance-8-production-preflight-2026-07-31.md) |
| Cierre productivo Gobernanza 8 | [REV-SGE-028](reviews/governance-8-production-close-2026-07-31.md) |
| Investigación de skills | [Mapa de capacidades y límites](research/skills-map.md) |
| Contrato implementado de avisos | [SDD-0165 · AVS-01](../specs/0165-sistema-gobernanza-experiencia-erp-studio/spec.md) |
| Gate V0 histórico de VIS-02 | [LB-SGE-037](BASELINE-2026-07-29-09.md) |

Regla de frontera: `BRAND.md` y el Norte gobiernan **cómo se ve**; este sistema
gobierna **cómo se comporta**. Una implementación concreta se especifica en un
SDD y el código solo se considera conforme después de verificación.

## 3. Estados normativos

Cada política avanza por una sola ruta de madurez:

```text
identificada → investigada → redactada → aprobada → implementada → verificada
                                                                      ↓
                                                                  deprecada
```

| Estado | Significado |
|---|---|
| identificada | Existe una necesidad, sin investigación suficiente para normar. |
| investigada | Hay evidencia y recomendación; todavía no es una obligación. |
| redactada | Existe una versión revisable; no puede imponerse como regla aprobada. |
| aprobada | El founder aceptó el contrato normativo y su versión quedó registrada. |
| implementada | El producto aplica el contrato en el alcance declarado. |
| verificada | Hay pruebas y evidencia suficiente de conformidad. |
| deprecada | Otra política la reemplaza; debe conservar el vínculo de trazabilidad. |

La cobertura parcial se documenta en la columna **Estado del ERP** y nunca se
disfraza elevando el estado normativo.

## 4. Registro maestro de políticas

| Código | Política | Estado normativo | Estado del ERP | Documento o próximo gate |
|---|---|---|---|---|
| SGE-00 | Principios constitucionales de experiencia | aprobada | Adopción parcial; plan por superficies y riesgo aprobado | [REV-SGE-009](reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md) · [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| MP-01 | Matriz de permanencia | aprobada v1.1 | [SDD-0168](../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) cerrado: DB-1 y DB-2 en Cloud, APP integrada en `d93c56e4`, Vercel Producción y E2E autenticado aprobados, fixtures retirados | [REV-MP-005](reviews/mp-01-comments-preview-e2e.md); ACL históricos, purga y retención permanecen fuera de alcance |
| BTN-01 | Semántica, jerarquía y contrato de botones | aprobada v1.1 | Contrato menu button precisado; adopción parcial | [REV-SGE-014](reviews/ux-patterns-video-audit-2026-07-29.md) |
| HTD-01 | Confirmación por presión sostenida | aprobada | Primer consumidor R3 verificado en anulación de factura; adopción no transversal | [SDD-0215](../specs/0215-htd-invoice-void/spec.md); conservar permiso, motivo y auditoría backend |
| AVS-01 | Avisos y confirmaciones | verificada | Primitiva conforme; consumidores legacy se migran solo dentro de slices R2/R3 | [REV-SGE-009](reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md) |
| AUD-01 | Evento auditable y vínculo con acciones | aprobada | D1–D5 y correctivos D2–D4 aplicados y verificados individualmente en Producción; SDD-0174 cerrado; header normativo reconciliado | [REV-AUD-046](reviews/aud-sdd-0174-prod-close.md) · [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| AUD-02 | Consulta, conservación, exportación y acceso | aprobada | adoptada en Producción: E1 trazable, holds, export privado, expiración y lotes controlados; cero lote ejecutado | [REV-AUD-047](reviews/aud-corte-e2-holds.md) a [REV-AUD-050](reviews/aud-corte-e5-retention.md) · [REV-SGE-028](reviews/governance-8-production-close-2026-07-31.md) |
| VIS-01 | Jerarquía visual y distribución 60-30-10 | aprobada | Adopción parcial; muestreo acotado a slices y clasificación de literales | [REV-SGE-009](reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md) |
| VIS-02 | Tipografía por voz, destinatario e idioma | aprobada | V1–V4 y gate externo cerrados; la adopción futura continúa solo por consumidor; UI china conserva Noto Sans SC | [REV-VIS-010](reviews/vis-02-external-mail-client-evidence.md) · [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| BUS-01 | Buscadores predictivos y contexto de resultados | aprobada v1.1 | `GlobalSearchModal` y `ClientCombobox` muestreados: scope, permisos server-side, debounce/race y teclado conformes; adopción restante por flujo | [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| CRT-01 | Creación rápida desde contexto | aprobada v1.0 | `no aplica` en los dos buscadores muestreados: no exponen creación contextual | [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md); auditar sólo al tocar un flujo que sí cree |
| NUM-01 | Campos numéricos y financieros | aprobada v1.1 | `NumericInput` canonical; precisión decimal y un consumidor fiscal R3 verificados | [SDD-0185](../specs/0185-num-01-expresiones-decimales/spec.md) y [REV-SGE-020](reviews/num-01-v1-1-numeric-input.md); adopción restante por slices |
| MOT-01 | Movimiento, tiempos y reducción de movimiento | aprobada v1.0 | Tokens 120/180/260 ms existen; quedan duraciones locales | Auditar excepciones |
| DND-01 | Drag and drop y Kanban | aprobada v1.0 | Bitácora verificada: selector accesible, pickup/placeholder, rollback, conflicto durable y Deshacer; adopción restante por flujo | [SDD-0216](../specs/0216-dnd-bitacora-accessible/spec.md) |
| CAL-01 | Calendario, densidad y manipulación temporal | aprobada v1.0 | adoptada: timezone IANA, plan separado de hechos, reprogramación versionada y auditada | [SDD-0217](../specs/0217-calendar-event-timezone/spec.md) · [SDD-0223](../specs/0223-shipment-planning-dates/spec.md) |
| DAT-01 | Selector de fecha y rango | aprobada v1.0 | adoptada en planificación: entrada nativa accesible, zona visible y validación servidor | [SDD-0223](../specs/0223-shipment-planning-dates/spec.md) |
| PRG-01 | Progreso de procesos | aprobada v1.0 | Porcentajes/estados dispersos | Auditar progreso real versus derivado |
| WIZ-01 | Formularios y procesos por pasos | aprobada v1.0 | Steppers locales | Auditar conservación y navegación |
| LOD-01 | Carga, skeleton, spinner y feedback optimista | aprobada v1.0 | Patrones dispersos | Auditar esperas y componentes |
| ERR-01 | Taxonomía y presentación de errores | aprobada v1.0 | `ErrorAlert`, campos y toasts coexisten | Auditar adopción |
| UPL-01 | Carga de archivos e imágenes | aprobada v1.0 | Implementaciones dispersas | Auditar límites y Storage por módulo |
| ICO-01 | Iconografía semántica | aprobada v1.0 | Catálogo central parcial | Auditar metáforas y accesibilidad |
| FRM-01 | Formularios y validación | aprobada v1.1 | Ciclo progresivo formalizado; patrones compartidos parciales | [REV-SGE-014](reviews/ux-patterns-video-audit-2026-07-29.md) |
| TBL-01 | Tablas, densidad y configuración | aprobada v1.0 | `ColumnManager` tiene adopción limitada | Auditar listados y móvil |
| A11Y-01 | Accesibilidad transversal | aprobada v1.1 | Contratos tabs/menu/listbox explícitos; sin matriz integral | [REV-SGE-014](reviews/ux-patterns-video-audit-2026-07-29.md) |
| IA-01 | Interacciones asistidas por IA | aprobada v1.0 | Regla local “IA propone”; sin gate transversal | Auditar permisos, privacidad y evidencia |
| CMP-01 | Ciclo de vida y madurez de componentes | aprobada v1.1 | `ConfirmDialog`, `SegmentedControl` y `NumericInput` canonical; `LLMModeToggle` deprecated con plan | [REV-SGE-017](reviews/cmp-01-v1-1-deprecated.md) y [REV-SGE-020](reviews/num-01-v1-1-numeric-input.md) |
| PLG-01 | Plugin ejecutable de gobernanza | aprobada v1.0 | 0.1.2 repo/team reproducible: cache sincronizable, runner Node 7/7, read-only y sin capacidades remotas | [REV-SGE-025](reviews/plg-01-durable-runner-2026-07-31.md) · [REV-SGE-021](reviews/plg-01-install-forward-test.md) |

## 5. Jerarquía y resolución de conflictos

Cuando dos reglas compiten, se aplica este orden:

1. ley, contabilidad, seguridad, privacidad y permisos/RBAC;
2. SGE-00 y MP-01;
3. política transversal aprobada (`BTN`, `AVS`, `AUD`, `VIS`, `A11Y`, `IA`);
4. política de patrón aprobada (`BUS`, `DND`, `CAL`, etc.);
5. SDD del módulo;
6. preferencia visual o implementación local.

Una excepción de marca usa `BRAND-CHECK`. Una excepción de comportamiento
requiere decisión documentada con motivo, alcance, responsable, fecha de
revisión y política afectada. Ningún video, tendencia o ejemplo externo es una
norma por sí solo.

## 6. Dependencias mínimas

```text
SGE-00
├── MP-01 ──> BTN-01 ──> HTD-01 ──> AUD-01/AUD-02
├── VIS-01 ──> VIS-02 ──> A11Y-01
├── MOT-01 / LOD-01 ──> DND-01 / CAL-01 / DAT-01 / PRG-01 / WIZ-01
├── BUS-01 ──> CRT-01
└── CMP-01 ──> PLG-01
```

AVS-01 ya fue implementada y verificada; funciona como primera referencia de
cómo pasar de una política aprobada a contrato, pruebas y evidencia visual.

## 7. Secuencia vigente de aprobación e implementación

La extracción documental concluyó en LB-SGE-003 y la constitución/acciones se
aprobaron en LB-SGE-004. El orden que gobierna la siguiente fase es:

1. conservar cerrado
   [SDD-0168](../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md):
   DB-1, APP y DB-2 tienen evidencia Cloud/local; la
   [revalidación Preview y Producción](reviews/mp-01-comments-preview-e2e.md)
   está cerrada; cualquier ACL histórico, purga o retención conserva gate y
   alcance propios;
2. conservar A1, A2 y sus recibos en Git; el Corte A está aplicado y verificado;
   B1 y `0268` están aplicados. SDD-0118/0172 están cerradas: `0284`–`0288`
   tienen recibos individuales y R29 aprobó replay, seed, E2E, verificación y
   teardown terminal. C0 está aprobado por REV-AUD-012; D1 y D5 están
   verificados localmente y D2–D4 corrigen sus no conformidades mediante
   `0294`–`0296`, aplicados y verificados individualmente en Producción por
   REV-AUD-046; `0270` y `0289`–`0293` también fueron aplicados
   individualmente;
3. revisar las políticas v0.1 por bloques coherentes, no como aprobación masiva;
4. conservar VIS-02 V1–V4 integrados localmente; Gmail y Outlook tienen entrega
   y estructura controladas, Outlook tiene evidencia visual y Gmail se cerró
   mediante confirmación explícita del founder; Apple Mail se clasifica
   `no aplica` y el gate externo está cerrado;
5. adoptar componentes CMP-01 por slices, sin nuevos usos de deprecated;
6. usar la cápsula repo-first; PLG-01 permanece instalado sólo en el
   marketplace local repo/team, read-only;
7. promover a CI sólo reglas verificadas y con excepción documentable.

## 8. Protocolo de cambio

Para crear o modificar una política:

1. registrar el problema y la evidencia en la línea base;
2. asignar código, dueño, alcance, dependencias y estado;
3. redactar reglas, anti-patrones y criterios de aceptación;
4. revisar impacto legal, contable, permisos, auditoría, móvil y accesibilidad;
5. obtener aprobación explícita y versionar el documento;
6. crear un SDD si requiere implementación;
7. verificar con pruebas, revisión visual y evidencia de adopción;
8. actualizar este registro y la línea base, sin borrar la trazabilidad.

El plugin podrá advertir o bloquear únicamente reglas **aprobadas**. Las
reglas investigadas o redactadas se presentan como recomendaciones, nunca como
errores obligatorios.

## 9. Línea base oficial

La fotografía vigente de cobertura por módulo y pendientes es
[LB-SGE-104 · Baseline de cobertura de gobernanza v1](BASELINE-2026-07-31-09.md).
El cierre productivo de Gobernanza 8 permanece en
[LB-SGE-103](BASELINE-2026-07-31-08.md).
El corte anterior permanece en [LB-SGE-101](BASELINE-2026-07-31-06.md).
La aplicación productiva anterior permanece en
[LB-SGE-100](BASELINE-2026-07-31-05.md).
El cierre del control plane permanece en
[LB-SGE-074](BASELINE-2026-07-29-46.md).
La estabilidad bajo carga del guardia SDD-0164 permanece en
[LB-SGE-069](BASELINE-2026-07-29-41.md).
La validación de dependencias CMP-01 permanece en
[LB-SGE-068](BASELINE-2026-07-29-40.md).
La portabilidad EOL de SDD-0118 permanece en
[LB-SGE-067](BASELINE-2026-07-29-39.md).
La validación progresiva permanece en
[LB-SGE-066](BASELINE-2026-07-29-38.md).
Los selectores accesibles permanecen en
[LB-SGE-065](BASELINE-2026-07-29-37.md).
Los tabs accesibles en Fiscal permanecen en
[LB-SGE-064](BASELINE-2026-07-29-36.md).
Los contratos UX formalizados permanecen en
[LB-SGE-063](BASELINE-2026-07-29-35.md).
El replay R7 y su teardown terminal permanecen en
[LB-SGE-062](BASELINE-2026-07-29-34.md).
La aplicación Cloud de 0276 permanece en
[LB-SGE-061](BASELINE-2026-07-29-33.md).
La reparación local del payload 0209 permanece en
[LB-SGE-060](BASELINE-2026-07-29-32.md).
El replay R6 y su teardown terminal permanecen en
[LB-SGE-059](BASELINE-2026-07-29-31.md).
La aplicación Cloud de 0275 permanece en
[LB-SGE-058](BASELINE-2026-07-29-30.md).
La reparación local del payload 0210 permanece en
[LB-SGE-057](BASELINE-2026-07-29-29.md).
El replay R5 y su teardown terminal permanecen en
[LB-SGE-056](BASELINE-2026-07-29-28.md).
La aplicación Cloud de 0274 permanece en
[LB-SGE-055](BASELINE-2026-07-29-27.md).
La reparación local de 0103_calculator_settings permanece en
[LB-SGE-054](BASELINE-2026-07-29-26.md).
El replay R4 y su teardown terminal permanecen en
[LB-SGE-053](BASELINE-2026-07-29-25.md).
La aplicación Cloud de 0273 permanece en
[LB-SGE-052](BASELINE-2026-07-29-24.md).
La reparación local de platform_admins permanece en
[LB-SGE-051](BASELINE-2026-07-29-23.md).
El replay R3 y su teardown terminal permanecen en
[LB-SGE-050](BASELINE-2026-07-29-22.md).
La aplicación Cloud de 0272 permanece en
[LB-SGE-049](BASELINE-2026-07-29-21.md).
El replay R2 y el diseño del follow-up permanecen en
[LB-SGE-048](BASELINE-2026-07-29-20.md).
La aplicación Cloud de la primera reparación permanece en
[LB-SGE-047](BASELINE-2026-07-29-19.md).
La reparación local del replay permanece en
[LB-SGE-046](BASELINE-2026-07-29-18.md).
El destino repo/team de PLG-01 permanece en
[LB-SGE-045](BASELINE-2026-07-29-17.md).
El primer componente CMP-01 permanece en
[LB-SGE-044](BASELINE-2026-07-29-16.md).
El intento efímero SDD-0172 permanece en
[LB-SGE-043](BASELINE-2026-07-29-15.md).
El SDD de PLG-01 aprobado permanece en
[LB-SGE-042](BASELINE-2026-07-29-14.md).
El registro CMP diseñado permanece en
[LB-SGE-041](BASELINE-2026-07-29-13.md).
El plan de adopción por slices permanece en
[LB-SGE-040](BASELINE-2026-07-29-12.md).
La aplicación de 0268 permanece en
[LB-SGE-039](BASELINE-2026-07-29-11.md).
La implementación local D1 permanece en
[LB-SGE-080](BASELINE-2026-07-30-05.md); su diseño vive en
[LB-SGE-038](BASELINE-2026-07-29-10.md).
El Gate V0 de VIS-02 permanece en
[LB-SGE-037](BASELINE-2026-07-29-09.md).
La apertura propuesta de SDD-0175 permanece en
[LB-SGE-036](BASELINE-2026-07-29-08.md).
La auditoría de adopción permanece en
[LB-SGE-035](BASELINE-2026-07-29-07.md).
El registro normativo completo permanece en
[LB-SGE-034](BASELINE-2026-07-29-06.md).
La aprobación previa y separada de CMP-01 permanece en
[LB-SGE-033](BASELINE-2026-07-29-05.md).
La aprobación de las diecisiete políticas por bloques permanece en
[LB-SGE-032](BASELINE-2026-07-29-04.md).
El diseño del Corte E permanece en
[LB-SGE-031](BASELINE-2026-07-29-03.md).
La apertura de SDD-0174 y D1 permanece en
[LB-SGE-030](BASELINE-2026-07-29-02.md).
El diseño D0 aprobado permanece en
[LB-SGE-029](BASELINE-2026-07-29.md).
La implementación local de C1 permanece registrada en
[LB-SGE-028](BASELINE-2026-07-28-08.md).
El diseño C0 aprobado permanece en
[LB-SGE-027](BASELINE-2026-07-28-07.md).
La implementación local de SDD-0172 vive en
[LB-SGE-026](BASELINE-2026-07-28-06.md).
El diseño tenant/fixtures aprobado [LB-SGE-025](BASELINE-2026-07-28-05.md), la
aplicación Cloud de B1
[LB-SGE-024](BASELINE-2026-07-28-04.md), la implementación local de B1
[LB-SGE-023](BASELINE-2026-07-28-03.md), el diseño B0 aprobado
[LB-SGE-022](BASELINE-2026-07-28-02.md), la
consolidación maestra de las tres etapas
[LB-SGE-021](BASELINE-2026-07-28.md), el diseño técnico previo de SDD-0168
[LB-SGE-020](BASELINE-2026-07-22-10.md), la aplicación y verificación de A2
[LB-SGE-019](BASELINE-2026-07-22-09.md), la
revisión técnica local de A2 [LB-SGE-018](BASELINE-2026-07-22-08.md), la
aprobación documental de SDD-0168 [LB-SGE-017](BASELINE-2026-07-22-07.md), la
aprobación normativa MP-01 [LB-SGE-016](BASELINE-2026-07-22-06.md), la
propuesta previa [LB-SGE-015](BASELINE-2026-07-22-05.md), el cierre de A1
[LB-SGE-014](BASELINE-2026-07-22-04.md), la aprobación de
aplicación [LB-SGE-013](BASELINE-2026-07-22-03.md), la redacción
A1 [LB-SGE-012](BASELINE-2026-07-22-02.md), el diseño
aprobado [LB-SGE-011](BASELINE-2026-07-22.md), el inventario Cloud
[LB-SGE-010](BASELINE-2026-07-21-10.md), la revalidación local
[LB-SGE-009](BASELINE-2026-07-21-09.md), el primer inventario
[LB-SGE-008](BASELINE-2026-07-21-08.md), la aprobación de SDD-0166
[LB-SGE-007](BASELINE-2026-07-21-07.md), la redacción del SDD
[LB-SGE-006](BASELINE-2026-07-21-06.md), la aprobación AUD-02
[LB-SGE-005](BASELINE-2026-07-21-05.md), la aprobación
constitucional [LB-SGE-004](BASELINE-2026-07-21-04.md), el cierre documental
[LB-SGE-003](BASELINE-2026-07-21-03.md), la rectificación
[LB-SGE-002](BASELINE-2026-07-21-02.md) y la línea inicial
[LB-SGE-001](BASELINE-2026-07-21.md) se conservan como evidencia histórica y no
se sobrescriben.

## 10. Mantenimiento obligatorio del índice

Toda entrega que cree, apruebe, implemente, verifique, depreque o cambie el
alcance de una política debe actualizar este índice dentro del mismo cambio.
La actualización incluye, según corresponda:

- estado normativo y estado real del ERP;
- documento canónico, SDD y evidencia de verificación;
- dependencias, excepciones y próximo gate;
- políticas nuevas descubiertas durante investigación o implementación;
- puntero a la línea base vigente cuando el cambio sea material.

El índice maestro se mantiene vivo y puede editarse. Las líneas base son
fotografías históricas inmutables: un cambio material genera una nueva
`BASELINE-YYYY-MM-DD.md` y conserva las anteriores. `docs/README.md` solo se
actualiza cuando cambie la arquitectura de carpetas o la ubicación canónica de
esta gobernanza.

## 11. Instrumentos operativos

| Instrumento | Uso |
|---|---|
| [Plantilla de política](templates/policy-template.md) | Redactar una norma con control, alcance, aceptación y trazabilidad. |
| [Gate SGE](templates/sge-gate.md) | Revisar una implementación o flujo antes de aprobarlo. |
| [Contrato de acción gobernada](templates/governed-action.md) | Unir BTN, MP, permisos, estados y auditoría. |
| [Mapa de skills](research/skills-map.md) | Decidir qué capacidades reutilizar y qué límites imponer al plugin. |
| [Cápsula operativa para agentes](AGENT-BRIEF.md) | Enrutar Codex, Claude Code, Studio y Cloud Design a la misma fuente normativa. |
| [`governance:check`](generated/governance-capsule.json) | Verificar el agregado reproducible de políticas aprobadas. |
| [`components:check`](generated/component-registry.json) | Verificar ciclo, evidencia, consumidores y reemplazos CMP-01. |
