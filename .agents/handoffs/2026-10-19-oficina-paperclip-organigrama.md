# Handoff · Oficina Paperclip — organigrama

| Campo | Valor |
|---|---|
| Task ID | `2026-10-19-oficina-paperclip-organigrama` |
| Owner / sesión | Worker «Oficina Paperclip» (Claude Code) · claim `oficina-paperclip` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\upbeat-sutherland-4cb3a5` |
| Rama / base | `claude/upbeat-sutherland-4cb3a5` sobre `main` `bb6bb3e4` (comprobado contra `origin/main` el 2026-10-19 ~12:30Z) |
| SDD | No aplica a este documento. La instalación de Paperclip sí la necesitará: número a pedir al Director cuando Sam lo autorice |
| Estado de la tarea | lista-para-revision (PR en borrador) |
| Fecha | 2026-10-19 |

## Encargo

Pedido literal de Sam al Director (2026-10-19): «Arrancar un nuevo worktree con una tarea que
se va a llamar oficina paperclip. La idea de este proyecto es poder avanzar a instalar el
paperclip, pero antes necesitamos hacer el organigrama idóneo para detectarlo. […] Primero
organiza el organigrama y después avanzamos.»

Entregable: un documento de propuesta de organigrama con diagnóstico, puestos (misión,
funciones, decisiones, escalamiento, KPI, módulos, datos), el CEO dentro y fuera de Paperclip,
agentes contra personas, riesgos y controles, y preguntas para Sam. **Sin instalar nada, sin
cuentas, sin servicios, sin producción ni base de datos.**

## Autorización

- Encargo del Director: publicar en rama propia con PR en borrador **si Sam aprueba**.
- Sam, en esta sesión, 2026-10-19 ~12:28Z, después de que la sesión le avisara que el
  documento estaba escrito y en revisión: «avanza» y luego «listo avanza». La sesión lo tomó
  como OK para publicar la rama y la PR en borrador; las 13 preguntas de la sección 7 del
  documento siguen abiertas. No autoriza merge, instalación ni SDD.

## Completado

- `docs/organizacion/organigrama-paperclip.md`: la propuesta completa.
- `docs/organizacion/README.md`: índice de la carpeta nueva y sus reglas (puestos sin nombres,
  montos fuera de Git).
- Investigación de Paperclip (`paperclipai/paperclip`, MIT, `v2026.1012.0`) con fuentes
  oficiales. La sesión comprobó por su cuenta: el salto de permisos por defecto del adaptador
  de Claude Code, que la aprobación de gasto es solo una instrucción al agente, que la guía de
  instalación no cubre Windows ni WSL, los roles humanos y la CVE-2026-41208.

## Validación

| Comprobación | Resultado |
|---|---|
| `docs:check` (`node scripts/build-docs-index.mjs --check`, sobre `bb6bb3e4` + este diff) | PASÓ: «índice sincronizado con 546 specs» |
| `sdd:check` (`node scripts/check-numbering.mjs`) | PASÓ: «sin números repetidos»; los choques históricos ya aplicados (0342, 0362, 0363, 0394) salen como aviso, no como error |
| `git diff --check` | PASÓ |
| Revisión de voseo por patrón | PASÓ (0 coincidencias) |
| `pnpm verify` | NO EJECUTADO: el cambio es solo documentación; según `AGENTS.md` y la regla «el cierre se elige por el diff», el cierre es `docs:check` + `sdd:check` |
| Diagramas Mermaid | NO VERIFICADO el renderizado: no hay intérprete de Mermaid en el entorno; se revisó la sintaxis a mano |
| Datos de producción | NO EJECUTADO a propósito: el encargo prohíbe leer la base |

## Impacto documental

- Carpeta nueva `docs/organizacion/`. **Pendiente para el Director:** agregar la fila
  «Organigrama, puestos y agentes → `docs/organizacion/`» en la tabla de `docs/README.md`. No la
  agregué porque `docs/README.md` está en el piloto semántico (`scripts/knowledge-policy.json`)
  y un recibo semántico no se emite desde un worktree.
- Graphify / Archify / Obsidian: no ejecutados en este worktree. Las fuentes nuevas no son del
  piloto semántico; queda la actualización estructural al integrar, a cargo del Director.
- `knowledge:status` (`node scripts/knowledge-sync.mjs status`, 2026-10-19 ~12:35Z): `ok: false`
  por el estado del worktree, no por este diff. Este árbol no tiene derivados generados:
  estructural INVALID (4.894 pendientes), semántico INVALID (1.295), Archify PENDING
  (`ARCHIFY_RUNTIME_MISSING`), Obsidian PENDING. No los regeneré: es una corrida pesada que
  pide turno al Director, y la publicación la hace él desde `main` integrado.

## Pendientes de esta tarea

1. Respuestas de Sam a las 13 preguntas de la sección 7; ajustar el documento con ellas.
2. Fila en `docs/README.md` (ver arriba).

## Fuera de alcance detectado

- **`app/api/cron/ceo-brief`** se programaba con Vercel Cron y Vercel está en pausa desde el
  2026-10-16. No verifiqué si el resumen diario al CEO sigue corriendo en el servidor propio.
- **`lib/studio/privacidad-cn.ts`** oculta datos de clientes al personal en China solo en el
  servidor; el propio archivo advierte que no protege en la base (riesgo PIPL ya conocido).
- **Hay una sesión «Migración Kommo a GoHighLevel».** Si el CRM cambia, las referencias a
  Kommo y a sus 4 agentes en el organigrama (P-21) habrá que actualizarlas.
- **El catálogo `nomina_positions` (migración `0204`, julio) no tiene puesto de Dirección de
  Operaciones** ni dueño de las transiciones de tracking. Si Sam aprueba, se cargan desde
  Studio › Nómina; no hace falta código.

## Handoff al Director

- Revisar la PR en borrador (solo documentación). Recordatorio: un merge a `main` se publica
  solo en el servidor (SDD-0541), también si es documentación.
- Agregar la fila de `docs/README.md` y refrescar Graphify al integrar.
- Cuando Sam responda y autorice la instalación, asignar número de SDD para «Instalación piloto
  de Paperclip (ola 1)». Esa SDD cambia gobierno: quién puede actuar sobre el repositorio y con
  qué permisos.
- Ownership: el claim `oficina-paperclip` se libera al cerrar esta escritura.
