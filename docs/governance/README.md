# Sistema de Gobernanza de Experiencia ERP_Studio

| Control | Valor |
|---|---|
| Documento | Índice maestro del Sistema de Gobernanza |
| Versión | 8.0 |
| Dueño | Sam (founder) |
| Custodia | Producto + Diseño + Ingeniería |
| Estado | aprobada (cambio 2026-11-12, ver CAMBIO-2026-11-12-sge-v8-ag-01.md) |
| Reemplaza a | v7.0 (archivada como evidencia, no se sobrescribe) |
| Línea base vigente | generada desde el registro (`governance-capsule.json`) (planeado · SDD-0626) |

> **Principios del sistema v8.0**
> 1. **Proporcionalidad:** la ceremonia de un cambio mide lo mismo que su impacto (tiers L0–L3).
> 2. **Honestidad de estados:** el estado normativo y el estado real del ERP nunca se disfrazan.
> 3. **Trazabilidad inmutable:** política → SDD → revisión → recibo → línea base; nada se edita, todo se anota.
> 4. **Índice generado:** el registro machine-readable es la única fuente; este README se genera, no se escribe.
> 5. **El sistema se audita a sí mismo:** la gobernanza tiene KPIs y se corrige con su propio protocolo.

## 1 · Alcance

La gobernanza cubre: semántica y jerarquía de acciones; permanencia, eliminación,
anulación, restauración y auditoría; avisos, errores, progreso y estados del
sistema; búsqueda, creación rápida, formularios, tablas y carga de archivos;
movimiento, calendarios, drag and drop y adaptación móvil; tipografía, jerarquía
visual, accesibilidad y contenido dirigido al cliente; comportamiento de
funciones asistidas por IA (IA-01); **comportamiento de agentes autónomos
(SGE-AG-01)**: niveles de acción, presupuestos, identidad, prohibiciones,
auditoría y cadena de suministro; ciclo de vida de componentes y automatización
mediante plugin.

No guarda mockups, archivos de marca ni contratos técnicos detallados.

## 2 · Fuentes de verdad (solo canónicas)

| Tema | Fuente canónica |
|---|---|
| Identidad visual, colores, tipografías, excepciones de marca | `BRAND.md` (+ `BRAND-CHECK`) |
| Decisiones visuales aprobadas | `BRAND-DECISIONS.md` |
| Reglas técnicas del Studio | `app/studio/CLAUDE.md` |
| Tokens de interfaz | `app/studio/tokens.css` |
| Políticas (cuerpo normativo) | `docs/governance/policies/` |
| Especificaciones e implementación | `docs/specs/<sdd-XXXX>/` |
| Revisiones consolidadas | `docs/governance/reviews/` (actas agrupadas; los REVs cerrados permanecen aquí) |
| Evidencia histórica | `docs/archive/` (solo baselines > 90 días; mover REVs cerrados: planeado · SDD-0626) |
| Registro único de estados | `generated/governance-capsule.json` |

> **Regla de frontera:** `BRAND.md` y el Norte gobiernan **cómo se ve**; este
> sistema gobierna **cómo se comporta**. Una implementación concreta se
> especifica en una SDD y el código solo es conforme después de verificación.

## 3 · Estados normativos (ruta única, sin atajos)

```text
identificada → investigada → redactada → aprobada → implementada → verificada
                                                                      ↓
                                                                  deprecada
```

La cobertura parcial se documenta en Estado del ERP y nunca se disfraza
elevando el estado normativo. Lo que no aplica hoy se marca
`no aplica hasta <flujo X>` — no existe el estado "auditar al tocar".

## 4 · Registro maestro de políticas

| Código | Política | Estado normativo | Estado del ERP | Evidencia / próximo gate |
|---|---|---|---|---|
| SGE-00 | Principios constitucionales de experiencia | aprobada | Adopción parcial; plan por superficies y riesgo | [REV-SGE-009](reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md) · [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| MP-01 | Matriz de permanencia | aprobada v1.1 | SDD-0168 cerrado (DB-1/DB-2 en Cloud, APP en Producción, E2E verificado) | [REV-MP-005](reviews/mp-01-comments-preview-e2e.md) |
| BTN-01 | Semántica, jerarquía y contrato de botones | aprobada v1.1 | Adopción parcial · no aplica a agentes | [REV-SGE-014](reviews/ux-patterns-video-audit-2026-07-29.md) |
| HTD-01 | Confirmación por presión sostenida | aprobada | Primer consumidor R3 verificado · no aplica a agentes | [SDD-0215](../specs/0215-htd-invoice-void/spec.md) |
| AVS-01 | Avisos y confirmaciones | verificada | Primitiva conforme · no aplica a agentes | [REV-SGE-009](reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md) |
| AUD-01 | Evento auditable y vínculo con acciones | aprobada | D1–D5 aplicados y verificados en Producción | [REV-AUD-046](reviews/aud-sdd-0174-prod-close.md) · [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| AUD-02 | Consulta, conservación, exportación y acceso | aprobada | Adoptada en Producción | [REV-AUD-047](reviews/aud-corte-e2-holds.md)–[REV-AUD-050](reviews/aud-corte-e5-retention.md) · [REV-SGE-028](reviews/governance-8-production-close-2026-07-31.md) |
| VIS-01 | Jerarquía visual 60-30-10 | aprobada | Adopción parcial · no aplica a agentes | [REV-SGE-009](reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md) |
| VIS-02 | Tipografía por voz, destinatario e idioma | aprobada | V1–V4 cerrados; adopción por consumidor · no aplica a agentes | [REV-VIS-010](reviews/vis-02-external-mail-client-evidence.md) · [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| BUS-01 | Buscadores predictivos | aprobada v1.1 | GlobalSearchModal y ClientCombobox conformes · no aplica a agentes | [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| CRT-01 | Creación rápida desde contexto | aprobada v1.0 | no aplica en buscadores muestreados | [REV-SGE-024](reviews/governance-8-adoption-audit-2026-07-31.md) |
| NUM-01 | Campos numéricos y financieros | aprobada v1.1 | NumericInput canónico; consumidor fiscal R3 verificado | [SDD-0185](../specs/0185-num-01-expresiones-decimales/spec.md) · [REV-SGE-020](reviews/num-01-v1-1-numeric-input.md) |
| MOT-01 | Movimiento y tiempos | aprobada v1.0 | Tokens 120/180/260 ms · no aplica a agentes | — |
| DND-01 | Drag and drop y Kanban | aprobada v1.0 | Bitácora verificada · no aplica a agentes | [SDD-0216](../specs/0216-dnd-bitacora-accessible/spec.md) |
| CAL-01 | Calendario y manipulación temporal | aprobada v1.0 | Adoptada (timezone IANA, plan vs hechos) | [SDD-0217](../specs/0217-calendar-event-timezone/spec.md) · [SDD-0223](../specs/0223-shipment-planning-dates/spec.md) |
| DAT-01 | Selector de fecha y rango | aprobada v1.0 | Adoptada en planificación | [SDD-0223](../specs/0223-shipment-planning-dates/spec.md) |
| PRG-01 | Progreso de procesos | aprobada v1.0 | no aplica hasta <flujo con progreso real> | — |
| WIZ-01 | Formularios por pasos | aprobada v1.0 | no aplica hasta <flujo por pasos> | — |
| LOD-01 | Carga, skeleton y feedback | aprobada v1.0 | no aplica hasta <módulo con espera> · no aplica a agentes | — |
| ERR-01 | Taxonomía de errores | aprobada v1.0 | no aplica hasta <módulo con errores> | — |
| UPL-01 | Carga de archivos | aprobada v1.0 | no aplica hasta <flujo de carga> | — |
| ICO-01 | Iconografía semántica | aprobada v1.0 | no aplica hasta <módulo con iconos nuevos> · no aplica a agentes | — |
| FRM-01 | Formularios y validación | aprobada v1.1 | Ciclo progresivo formalizado · no aplica a agentes | [REV-SGE-014](reviews/ux-patterns-video-audit-2026-07-29.md) |
| TBL-01 | Tablas, densidad y configuración | aprobada v1.0 | ColumnManager limitado · no aplica a agentes | — |
| A11Y-01 | Accesibilidad transversal | aprobada v1.1 | Contratos tabs/menu/listbox; matriz integral pendiente · no aplica a agentes | [REV-SGE-014](reviews/ux-patterns-video-audit-2026-07-29.md) |
| LNK-01 | Enlaces y cambio de contexto | aprobada v1.0 | Adoptada en glosario | [TerminoGlosario.test.tsx](../../components/TerminoGlosario.test.tsx) |
| IA-01 | Interacciones asistidas por IA | aprobada v1.0 | "IA propone"; excepción noticias (revisión 60 días) | SDD-0611 · excepción noticias |
| SGE-AG-01 | Comportamiento de agentes autónomos | aprobada v0.2 (12/11/2026) | nada construido — rige la oficina desde su primer piloto | [CAMBIO-2026-11-12](CAMBIO-2026-11-12-sge-v8-ag-01.md) · SDD-0626 (próximo gate) |
| CMP-01 | Ciclo de vida de componentes | aprobada v1.1 | ConfirmDialog/SegmentedControl/NumericInput canónicos | [REV-SGE-017](reviews/cmp-01-v1-1-deprecated.md) · [REV-SGE-020](reviews/num-01-v1-1-numeric-input.md) |
| PLG-01 | Plugin ejecutable de gobernanza | aprobada v1.0 | 0.1.2 repo/team reproducible, read-only | [REV-SGE-025](reviews/plg-01-durable-runner-2026-07-31.md) · [REV-SGE-021](reviews/plg-01-install-forward-test.md) |

## 5 · Jerarquía y resolución de conflictos

1. ley, contabilidad, seguridad, privacidad y permisos/RBAC;
2. SGE-00 y MP-01;
3. política transversal aprobada (BTN, AVS, AUD, VIS, A11Y, IA, SGE-AG);
4. política de patrón aprobada (BUS, DND, CAL, etc.);
5. SDD del módulo;
6. preferencia visual o implementación local.

Una excepción de marca usa BRAND-CHECK. Una excepción de comportamiento
requiere decisión documentada con motivo, alcance, responsable, fecha de
revisión y política afectada. Ningún video, tendencia o ejemplo externo es
norma por sí solo.

## 6 · Dependencias mínimas

```text
SGE-00
├── MP-01 ──> BTN-01 ──> HTD-01 ──> AUD-01/AUD-02
├── VIS-01 ──> VIS-02 ──> A11Y-01
├── MOT-01 / LOD-01 ──> DND-01 / CAL-01 / DAT-01 / PRG-01 / WIZ-01
├── BUS-01 ──> CRT-01
├── IA-01 ──> SGE-AG-01 (los agentes heredan IA-01 y añaden acción, costo y auditoría)
└── CMP-01 ──> PLG-01
```

## 7 · Protocolo de cambio POR TIERS

| Tier | Qué cubre | Ceremonia |
|---|---|---|
| L0 · Cosmético | typo, redacción, enlace roto en docs (sin cambiar regla) | PR directo + governance:check verde + aprobación de custodia |
| L1 · Corrección | aclarar una regla sin cambiar su intención | PR + nota de cambio + governance:check + aprobación del delegado del área (§8) |
| L2 · Comportamiento | cambiar qué hace una política aprobada | Evidencia → redacción → revisión de impacto (legal/contable/permisos/auditoría/móvil/accesibilidad) → aprobación de Sam → versión + SDD si toca implementar → verificación |
| L3 · Política nueva o excepción | nacer una política o excepción con vigencia | Todo L2 + registro en línea base + dueño + fecha de revisión + alcance escrito |

> El plugin (PLG-01) advierte o bloquea solo reglas aprobadas. Lo
> investigado o redactado se presenta como recomendación, nunca como error.

## 8 · Delegación de aprobación

Sam conserva: políticas nuevas (L3), excepciones, dinero, irreversible,
y todo lo que toque seguridad, privacidad o permisos.

Delegación acotada, por escrito: Sam puede nombrar un delegado por
área para aprobar L0/L1: persona, alcance, límite de tier y vigencia.

Regla: lo aprobado por delegado se registra en decisions con su
nombre; Sam lo revisa en el parte semanal. Sin nombramiento escrito, no
hay delegación.

## 9 · Línea base y archivo

La línea base vigente es una sola, generada desde el registro
(planeado · SDD-0626; hoy son documentos fechados BASELINE-YYYY-MM-DD.md).
Las históricas se conservan inmutables, pero a partir de los 90 días
pasan a docs/archive/ (nunca se borran, solo se ordenan).
Un cambio material genera una nueva BASELINE-YYYY-MM-DD.md; las anteriores
no se sobrescriben.

## 10 · Índice generado

generated/governance-capsule.json es la única fuente de estados.
Este README y la tabla del registro se generan desde el registro
(planeado · SDD-0626; hoy solo la cápsula se genera y governance:check
valida políticas ↔ cápsula).
Prohibida la edición manual del índice: se corrige el registro y se
regenera.

## 11 · Instrumentos operativos

| Instrumento | Uso |
|---|---|
| Plantilla de política | Redactar una norma con control, alcance, aceptación y trazabilidad |
| Gate SGE | Revisar una implementación o flujo antes de aprobarlo |
| Contrato de acción gobernada | Unir BTN, MP, permisos, estados y auditoría |
| Mapa de skills | Decidir capacidades a reutilizar y límites del plugin |
| AGENT-BRIEF | Enrutar Codex, Claude Code, Studio y Cloud Design a la misma fuente |
| governance:check | Verificar el agregado reproducible de políticas aprobadas |
| components:check | Verificar ciclo, evidencia, consumidores y reemplazos CMP-01 |
| governance:kpi (planeado · SDD-0626) | Reporte de salud de la gobernanza (§12) |

## 12 · KPIs de la gobernanza

| KPI | Qué mide | Meta |
|---|---|---|
| Adopción completa | % de políticas aprobadas con ERP "verificada" o "no aplica" | ≥ 80% y sin "auditar al tocar" |
| Backlog de auditorías | Auditorías diferidas abiertas | ≤ 5 |
| Tiempo de cambio | Días de "redactada" a "aprobada" (L2) | ≤ 7 |
| Peso documental | REVs por cambio material | ≤ 3 actas por dominio |

## 13 · Consolidación de actas

Actas agrupadas por dominio: una revisión que toca un dominio produce
una acta con sus recibos dentro, no una por aplicación individual.
Individual solo lo irreversible: anulaciones de pago, liberaciones de
aduana, acciones R3 con dinero.

El historial previo (baselines anteriores) se conserva completo en
docs/archive/ como evidencia; no se reescribe.
