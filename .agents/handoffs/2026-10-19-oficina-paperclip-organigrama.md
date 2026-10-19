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

- **`app/api/cron/ceo-brief`: resuelto, ya no es un hallazgo.** La primera versión de este
  handoff decía que se programaba con Vercel Cron y que no estaba verificado. El Director lo
  corrigió el 2026-10-19: corre en el contenedor `cron` del servidor propio
  (`infra/dtd-cargo/cron/crontab:9`, `0 11 * * *` contra `http://web:3000/api/cron/ceo-brief`;
  la sesión confirmó esa línea) y, según su lectura del registro, en las últimas 72 h se
  disparó 3 veces, una por día. Esa lectura solo prueba el disparo: **NO VERIFICADO** que el
  envío haya salido bien.
- **`lib/studio/privacidad-cn.ts`** oculta datos de clientes al personal en China solo en el
  servidor; el propio archivo advierte que no protege en la base (riesgo PIPL ya conocido).
- **El estudio de GoHighLevel puede perderse** (documento sin publicar). `docs/marketing/crm-gohighlevel-transicion.md`
  vive solo en el disco del worktree `DTD-worktrees/crm-ghl-evaluacion-20261013`, sin commit ni
  respaldo remoto, y su plan arranca la semana del 2026-10-19. Los tres documentos hermanos que
  cita (`crm-gohighlevel-configuracion.md`, `crm-gohighlevel-automatizaciones.md` y
  `docs/legal/privacidad/evaluacion-proveedor-gohighlevel.md`) **no se encontraron** en ningún
  worktree ni en el checkout principal. Lo publica su sesión dueña, no esta.
  (Las referencias a Kommo del organigrama ya se actualizaron en la ronda 2.)
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

## Ronda 2 · transición del CRM a GoHighLevel (2026-10-19)

**Sam, literal:** «Me gusta el plan que me estás sugiriendo, el organigrama […], agregando que
vamos a hacer una transición del CRM de Kommo a un CRM que se llama GoHighLevel.com […] la IA de
Kommo la tenemos apagada porque consume demasiados tokens; solo la activamos cuando es
necesario. […] ver si vale la pena agregarlo en el organigrama […] y esperar la transición, o
que vaya ahorita trabajando con lo que está y que vaya estudiando y analizando GoHighLevel».

**Lo que se hizo:**
- Pregunta 1 (estructura) marcada como respondida con esa cita.
- Recomendación escrita en la sección 2.6 nueva: no esperar; el CRM es herramienta, no puesto;
  la transición entra como proyecto del CEO agente; solo el Analista de embudo espera al corte y
  se construye contra el espejo neutro `crm_*`.
- Diagnóstico: IA de Kommo apagada por costo (punto 5) y CRM en transición (punto 6).
- P-20, P-21, P-40 y la tabla 4.2 hablan del «CRM» con Kommo hoy y GoHighLevel después.
- Meta 6 del CEO; riesgos R11 (MCP de GoHighLevel con datos de clientes al alcance de un agente
  que salta permisos), R12 (dos CRM a la vez) y R13 (dos presupuestos de IA); pregunta 14.

**Evidencia usada:** el estudio `docs/marketing/crm-gohighlevel-transicion.md`, **documento sin publicar** (520 líneas,
2026-10-13) en el worktree `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\crm-ghl-evaluacion-20261013`
(rama `codex/crm-ghl-evaluacion-20261013`, sin commits sobre `main`). Se leyó sin tocarlo y
**no se copió** a este worktree.

## Respuesta del Director (2026-10-19)

- Corrigió el dato del `ceo-brief` (arriba); corregido en el documento y en este handoff.
- La fila de `docs/organizacion/` en `docs/README.md` la agrega él al integrar, junto con el
  recibo semántico.
- La #285 queda en borrador hasta que Sam conteste las 13 preguntas o le pida integrarla como
  propuesta v1. Que esté lista no autoriza el merge.
- El número de la SDD de instalación se le pide antes de reservarla, cuando Sam la autorice.

## Respuesta del Director a la ronda 2 (2026-10-19)

Comprobó que el estudio de GoHighLevel es un solo archivo sin commit (35.850 bytes, del
2026-10-13) y sin rama remota. Su publicación la coordina él con Sam y con la sesión dueña.
Indicación: no copiarlo ni citarlo como fuente en Git hasta que esté en `main`; si se cita,
marcarlo «documento sin publicar». Hecho: todas las citas del documento y de este handoff
llevan esa etiqueta. La #285 sigue en borrador hasta que Sam conteste lo que falta.
