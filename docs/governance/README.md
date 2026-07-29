# Sistema de Gobernanza de Experiencia ERP_Studio

| Control | Valor |
|---|---|
| Documento | Índice maestro del Sistema de Gobernanza |
| Versión | 4.2 |
| Dueño | Sam (founder) |
| Custodia | Producto + Diseño + Ingeniería |
| Estado | activo |
| Creado | 2026-07-21 |
| Última revisión | 2026-07-29 |
| Confidencialidad | interno |
| Línea base vigente | [LB-SGE-032 · diecisiete políticas aprobadas](BASELINE-2026-07-29-04.md) |

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
| Botones y acciones | [BTN-01 v1.0](policies/btn-01.md) |
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
| Inventario read-only del Corte C | [C0 · repo y Cloud](../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-c-2026-07-28.md) |
| Diseño correctivo del Corte C | [Consulta gobernada y RBAC v1.1](../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-c.md) |
| Revisión del diseño Corte C | [REV-AUD-012](reviews/aud-corte-c.md) |
| Revisión técnica local Corte C1 | [REV-AUD-013](reviews/aud-corte-c1.md) |
| Inventario read-only del Corte D | [D0 · repo y Cloud](../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-d-2026-07-29.md) |
| Diseño correctivo del Corte D | [Atomicidad por dominio v1.0](../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-d.md) |
| Revisión del diseño Corte D | [REV-AUD-014](reviews/aud-corte-d.md) |
| Atomicidad por dominios | [SDD-0174](../specs/0174-audit-atomicidad-dominios/spec.md) |
| Inventario y revisión D1 | [REV-AUD-015](reviews/aud-d1-access-config.md) |
| Inventario read-only del Corte E | [E0 · repo y Cloud](../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-e-2026-07-29.md) |
| Diseño y revisión del Corte E | [REV-AUD-016](reviews/aud-corte-e.md) |
| Jerarquía visual | [VIS-01 v1.0](policies/vis-01.md) |
| Tipografía por voz e idioma | [VIS-02 v1.0](policies/vis-02.md) |
| Accesibilidad transversal | [A11Y-01 v1.0](policies/a11y-01.md) |
| Movimiento y tiempos | [MOT-01 v1.0](policies/mot-01.md) |
| Carga y espera | [LOD-01 v1.0](policies/lod-01.md) |
| Errores y recuperación | [ERR-01 v1.0](policies/err-01.md) |
| Búsqueda | [BUS-01 v1.0](policies/bus-01.md) |
| Creación rápida | [CRT-01 v1.0](policies/crt-01.md) |
| Campos numéricos | [NUM-01 v1.0](policies/num-01.md) |
| Formularios | [FRM-01 v1.0](policies/frm-01.md) |
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
| Ciclo de vida de componentes | [CMP-01 v0.1](policies/cmp-01.md) |
| Plugin de gobernanza | [PLG-01 v0.1](policies/plg-01.md) |
| Investigación de skills | [Mapa de capacidades y límites](research/skills-map.md) |
| Contrato implementado de avisos | [SDD-0165 · AVS-01](../specs/0165-sistema-gobernanza-experiencia-erp-studio/spec.md) |
| Inventario y estado oficial vigente | [LB-SGE-032](BASELINE-2026-07-29-04.md) |

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
| SGE-00 | Principios constitucionales de experiencia | aprobada | Constitución vigente para cambios nuevos/modificados; legado aún no auditado transversalmente | [REV-SGE-002 aprobada](reviews/sge-00-btn-01.md) |
| MP-01 | Matriz de permanencia | aprobada v1.1 | [SDD-0168](../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) cerrado: DB-1 y DB-2 en Cloud, APP integrada en `d93c56e4`, Vercel Producción y E2E autenticado aprobados, fixtures retirados | [REV-MP-005](reviews/mp-01-comments-preview-e2e.md); ACL históricos, purga y retención permanecen fuera de alcance |
| BTN-01 | Semántica, jerarquía y contrato de botones | aprobada | [Vocabulario, orden, estados y contrato](policies/btn-01.md) vigentes; adopción del legado no auditada | Crear SDD por alcance antes de migrar consumidores |
| HTD-01 | Confirmación por presión sostenida | aprobada | [Contrato v1.0](policies/htd-01.md) consolidado; no implementado | Crear SDD solo para una entidad R3 clasificada por MP-01 |
| AVS-01 | Avisos y confirmaciones | verificada | Primitiva compatible implementada; consumidores heredados pendientes | [SDD-0165](../specs/0165-sistema-gobernanza-experiencia-erp-studio/spec.md) |
| AUD-01 | Evento auditable y vínculo con acciones | aprobada | Corte A y B1 aplicados; lifecycle implementado localmente; siete writers SQL preservados y ocho TS todavía directos | [REV-AUD-011](reviews/aud-tenant-fixtures-implementation.md); `0268` y recorrido efímero pendientes |
| AUD-02 | Consulta, conservación, exportación y acceso | aprobada | Matriz ACL B aplicada; lifecycle local verificado; consulta/RBAC pendientes | Aplicar `0268` solo por gate exacto; Cortes C–E conservan gates separados |
| VIS-01 | Jerarquía visual y distribución 60-30-10 | aprobada | [Documento canónico v1.0](policies/vis-01.md); tokens/Norte cubren parte, falta auditoría de adopción | Auditar superficies y excepciones |
| VIS-02 | Tipografía por voz, destinatario e idioma | aprobada | [Documento canónico v1.0](policies/vis-02.md); Noto Sans SC está cargada, Noto Serif SC no | Crear SDD de tokens y verificar correo/PDF |
| BUS-01 | Buscadores predictivos y contexto de resultados | aprobada v1.0 | Búsqueda global y `ClientCombobox` existen; adopción no auditada | Auditar scopes, ranking y desambiguación |
| CRT-01 | Creación rápida desde contexto | aprobada v1.0 | Patrones locales sin primitiva común | Auditar flujos de retorno |
| NUM-01 | Campos numéricos y financieros | aprobada v1.0 | `NumericInput` existe; adopción no auditada | Auditar precisión por dominio |
| MOT-01 | Movimiento, tiempos y reducción de movimiento | aprobada v1.0 | Tokens 120/180/260 ms existen; quedan duraciones locales | Auditar excepciones |
| DND-01 | Drag and drop y Kanban | aprobada v1.0 | Adopción no conforme: Bitácora mantiene fallback limitado | Crear SDD correctivo por flujo |
| CAL-01 | Calendario, densidad y manipulación temporal | aprobada v1.0 | Adopción parcial; reprogramación incompleta | Resolver timezone y Slice 2 de [SDD-0141](../specs/0141-calendario-norte/spec.md) |
| DAT-01 | Selector de fecha y rango | aprobada v1.0 | No existe primitiva transversal verificada | Auditar inputs/calendarios |
| PRG-01 | Progreso de procesos | aprobada v1.0 | Porcentajes/estados dispersos | Auditar progreso real versus derivado |
| WIZ-01 | Formularios y procesos por pasos | aprobada v1.0 | Steppers locales | Auditar conservación y navegación |
| LOD-01 | Carga, skeleton, spinner y feedback optimista | aprobada v1.0 | Patrones dispersos | Auditar esperas y componentes |
| ERR-01 | Taxonomía y presentación de errores | aprobada v1.0 | `ErrorAlert`, campos y toasts coexisten | Auditar adopción |
| UPL-01 | Carga de archivos e imágenes | aprobada v1.0 | Implementaciones dispersas | Auditar límites y Storage por módulo |
| ICO-01 | Iconografía semántica | aprobada v1.0 | Catálogo central parcial | Auditar metáforas y accesibilidad |
| FRM-01 | Formularios y validación | aprobada v1.0 | Patrones compartidos parciales | Auditar por riesgo y conservación |
| TBL-01 | Tablas, densidad y configuración | aprobada v1.0 | `ColumnManager` tiene adopción limitada | Auditar listados y móvil |
| A11Y-01 | Accesibilidad transversal | aprobada v1.0 | Buenas bases; sin matriz integral | Ejecutar auditoría transversal |
| IA-01 | Interacciones asistidas por IA | aprobada v1.0 | Regla local “IA propone”; sin gate transversal | Auditar permisos, privacidad y evidencia |
| CMP-01 | Ciclo de vida y madurez de componentes | redactada | [Contrato v0.1](policies/cmp-01.md); no existe catálogo ejecutable | Crear registro de componentes |
| PLG-01 | Plugin ejecutable de gobernanza | redactada | [Arquitectura v0.1](policies/plg-01.md); no creado ni instalado | Aprobar fuentes/alcance antes de scaffold |

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
   B1 está aplicado y verificado en Cloud por REV-AUD-009; SDD-0172 implementa
   localmente el lifecycle tenant/fixtures, pero `0268` y el recorrido efímero
   conservan gates propios; C0 está aprobado por REV-AUD-012 y C1 no está
   abierto; mantener D–E cerrados;
3. revisar las políticas v0.1 por bloques coherentes, no como aprobación masiva;
4. implementar VIS-02 (Noto Serif SC/tokens/salidas) y auditar VIS-01;
5. convertir componentes existentes a estados CMP-01 con evidencia;
6. crear PLG-01 read-only únicamente cuando el registro aprobado sea estable;
7. promover a CI solo reglas verificadas y con excepción documentable.

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

El futuro plugin podrá advertir o bloquear únicamente reglas **aprobadas**. Las
reglas investigadas o redactadas se presentan como recomendaciones, nunca como
errores obligatorios.

## 9. Línea base oficial

La fotografía vigente de investigación, implementación y pendientes es
[LB-SGE-032 · diecisiete políticas aprobadas](BASELINE-2026-07-29-04.md).
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
