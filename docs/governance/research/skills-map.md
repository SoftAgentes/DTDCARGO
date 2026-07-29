# Mapa de skills para construir y operar la gobernanza

| Control | Valor |
|---|---|
| Estado | investigación cerrada para la fase documental |
| Fecha | 2026-07-21 |
| Alcance | Capacidades reutilizables; ninguna instalación autorizada |
| Decisión | La gobernanza del repo prevalece sobre toda skill externa |

## 1. Conclusión

No existe una skill única que conozca el contexto legal, contable, operativo,
visual y multi-tenant de DTD Cargo. La solución correcta es un plugin propio
que orqueste capacidades especializadas y lea las políticas aprobadas de
`docs/governance/`.

Las skills externas sirven como **instrumentos** de captura, crítica,
accesibilidad y calidad. Nunca pueden introducir su estética, cambiar la marca,
aprobar una política ni modificar el ERP por cuenta propia.

## 2. Capacidades ya disponibles

| Skill | Uso admitido | Qué aporta | Límite dentro del SGE |
|---|---|---|---|
| `plugin-creator` | Construir PLG-01 cuando se autorice | Manifest válido, estructura mínima, validación y distribución | No define las políticas ni autoriza instalación/marketplace. |
| `skill-creator` | Diseñar las skills internas del plugin | Descripción como gatillo, progressive disclosure, recursos/scripts, metadata y validación | Sus ejemplos no sustituyen el esquema normativo del repo. |
| `product-design:audit` | Auditoría visual de un flujo real | Capturas actuales, pasos, hallazgos UX/a11y y límites explícitos | Solo evidencia capturada en la ejecución; no demuestra conformidad técnica completa. |
| `impeccable` | Crítica y polish bajo control | Detección de AI slop, jerarquía, movimiento e interacción | Sus preferencias de fuentes, iconos o variación estética ceden ante BRAND/VIS/CMP. |
| `web-quality` | Gate técnico complementario | Performance, WCAG, semántica, SEO y buenas prácticas | Sus budgets y metas son referencias; no se promueven automáticamente a política. |
| `playwright` / verificación de browser | Pruebas de comportamiento y regresión | Teclado, foco, viewport, estados y capturas repetibles | Necesita flujo, datos y sesión autorizados; no infiere reglas de negocio. |
| `vercel:react-best-practices` | Revisión de implementación | Calidad React/Next.js y rendimiento | No decide semántica del ERP. |
| `vercel:shadcn` | Consulta de primitivas | Patrones de componentes accesibles | El componente canónico del ERP y sus tokens prevalecen. |

## 3. Candidatas externas investigadas

Se revisó el catálogo público de skills antes de considerar instalaciones.

| Candidata | Señal pública observada | Decisión |
|---|---|---|
| [`web-design-guidelines`](https://www.skills.sh/vercel-labs/agent-skills/web-design-guidelines) | Auditoría de código contra guías web; repositorio Vercel Labs y adopción alta | **Buena candidata de referencia**, pero su descarga dinámica de reglas debe fijarse/versionarse antes de un gate reproducible. |
| [`ui-doctor`](https://www.skills.sh/iress/design-system/ui-doctor) | WCAG, heurísticas, carga cognitiva y progressive disclosure | **Útil como lente**, no se instala todavía porque está acoplada al design system de Iress. |
| [`frontend-design-system`](https://www.skills.sh/supercent-io/skills-template/frontend-design-system) | Tokens, layout, motion, accesibilidad y handoff | **Material comparativo**, no fuente de verdad; puede chocar con el Norte y componentes existentes. |
| [`ui-audit`](https://www.skills.sh/tommygeoco/ui-audit/ui-audit) | Trade-offs UX y evaluación bajo contexto | **Baja prioridad**: hay solapamiento con `product-design:audit` y señal de seguridad pública no totalmente verde. |
| [`design-md`](https://www.skills.sh/google-labs-code/stitch-skills/design-md) | Extrae un sistema semántico desde pantallas de Stitch | **No aplica hoy**: exige Stitch y generaría otra fuente de verdad paralela. |

No se recomienda instalar una skill solo por popularidad. Antes de instalar se
verifican fuente, licencia, mantenimiento, auditorías de seguridad, alcance de
lectura/escritura, instrucciones remotas y compatibilidad con el repositorio.

## 4. Arquitectura recomendada para PLG-01

```text
políticas aprobadas del repo
          ↓
registry generado y versionado
          ↓
governance-check ──> hallazgos y excepciones
governance-audit ──> browser/capturas/tests
governance-author ─> plantilla + índice + trazabilidad
          ↓
SDD de implementación / revisión humana
```

El plugin propio debe invocar skills especializadas solo después de cargar:

1. superficie y frontera del repo;
2. versión de SGE/BRAND/Norte;
3. políticas aprobadas aplicables;
4. excepciones vigentes;
5. modo solicitado: investigar, auditar, redactar o implementar.

## 5. Reglas de adopción

- No instalar ni actualizar skills sin aprobación explícita.
- Fijar versión o commit; no depender de contenido remoto mutable en CI.
- Inspeccionar `SKILL.md`, scripts, permisos y red antes de ejecutar.
- Ejecutar primero en modo read-only y con salida explicable.
- Registrar procedencia del hallazgo: política propia, estándar primario o
  recomendación externa.
- Un hallazgo externo que contradiga una política aprobada se marca como
  conflicto, no como incumplimiento del ERP.
- El plugin no aplica cambios, hace commit, push, deploy ni migración por
  defecto.

## 6. Decisión para la próxima fase

La primera versión de PLG-01 debe construirse con capacidades ya disponibles:
`plugin-creator`, `skill-creator`, auditoría visual y Playwright. La evaluación
de `web-design-guidelines` puede hacerse en un sandbox separado antes de
decidir una dependencia. Ninguna candidata externa es obligatoria para iniciar.
