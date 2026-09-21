# Handoff — Contratos que miden el comportamiento, no el texto

**Rama:** `claude/contratos-que-miden` · **Base:** `main` `97a23386`
**Worktree:** `.claude/worktrees/jovial-lovelace-6d8291` (claim
`claude-jovial-lovelace-6d8291`)
**Fecha:** 2026-09-20 · **Encargo:** del Director, tras el cierre de SDD-0497

## Qué se hizo

Sección nueva en `docs/engineering/project-rules.md`, entre «Patrones del Studio
ERP» y «Proceso UI/UX»: **«Contratos que miden el comportamiento, no el texto»**.

Va ahí y no en un archivo aparte porque AGENTS manda leer ese documento **antes
de cualquier trabajo de producto**, que es el momento en que esto importa:
cuando alguien está por escribir un contrato, no después de que le falló.

Contenido: los cinco casos del 2026-09-20 en una tabla con **qué afirmaba** cada
contrato y **qué debería** haber afirmado, el porqué de que cada uno pasara
igual, y el contraejemplo.

**Sin SDD**: no es cambio de comportamiento del producto. No se descubrió nada
que obligara a tocar producto, así que no hizo falta reserva.

## Los cinco, con su cita

Todas las líneas son de `main` `97a23386`; la #1 la modifica la PR #181, así que
esa cita envejece con ella.

| # | Cita | Verificado |
|---|---|---|
| 1 | `lib/studio/rbac-actions-guard.test.ts:77` (`src.includes`), `:59` (`entry === "actions.ts"`) | de primera mano, en SDD-0497 |
| 2 | `app/studio/(app)/crm/__tests__/stage-control.test.ts:74` | de primera mano, con mutante |
| 3 | `app/studio/_components/ui/ConfirmDialog.test.tsx:363`, y `:313` que sí distingue | leído completo |
| 4 | `.agents/handoffs/smokes-app-l14-0454-0472-guion.md:160` (paso 3) | leído, más el commit `13e28eff` que lo corrigió |
| 5 | vigilante de CI de esta sesión — no vive en el repo | de primera mano |

Conteos medidos en esta rama, no estimados:

- `findActions` escanea **54** archivos `actions.ts` y deja fuera **19**
  `*-actions.ts`.
- `moduleEditDenial(supabase, "kommo")` aparece **5** veces en `crm/actions.ts`:
  por eso quitar una no rompe la aserción del caso 2.

## El contraejemplo, que es lo que vuelve útil el documento

`scripts/__tests__/invoice-read-boundary.test.mjs` (SDD-0357). Leído entero antes
de describirlo. Lo que lo distingue de los cinco:

- Parsea el **AST** de ~1.600 módulos y cuenta llamadas literales
  `.from("invoices")`; no busca texto.
- Congela el inventario con `toEqual(BASELINE)` más dos números explícitos
  —19 archivos, 44 llamadas (`:113-115`)—, así que un lector nuevo **tiene que
  justificarse por escrito** en el `BASELINE` para pasar.
- **Se prueba a sí mismo**: distingue la cadena en un comentario o un string de
  una llamada real, y cubre los escapes que esquivarían su prefiltro.
- Mide la **consecuencia** (`:135`), no sólo la forma: los cuatro widgets
  financieros siguen detrás del módulo `invoices` y ningún override por rol los
  abre.

## Lo que NO hice, a propósito

- **No diseñé el arreglo del contrato del caso 1.** Está encolado aparte y con su
  propio alcance; el documento sólo dice **qué debería afirmar** —«cada acción
  exportada llama a un guard antes de tocar datos»—, que es el requisito de
  orden que señaló la sesión 2, no una propuesta de implementación. La última
  línea de la sección lo deja escrito para que nadie lo rediseñe de paso.
- **Ni un valor de secreto ni nada que parezca PII**, tampoco de ejemplo.
- **No pedí turno de máquina**: no corrí `verify` ni la suite completa.

## Comprobaciones

| Comprobación | Estado |
|---|---|
| `docs:check` | **PASÓ** — índice sincronizado, 482 specs |
| `sdd:check` | **PASÓ** — sin números repetidos |
| `buscar-voseo` | **PASÓ** |
| `harness:test` | **PASÓ** — ver la nota de abajo |
| Pruebas de producto (`test`, `e2e`, `build`, `lint`, `typecheck`) | **NO APLICA** — el diff es un único `.md` de documentación; no toca código, configuración ni migraciones |
| `verify` completo | **NO EJECUTADO** — no corresponde a un cambio sólo de documentación, y la máquina la tiene la sesión 4 |

### Un rojo de `harness:test` que no se reprodujo

La **primera** corrida salió en rojo con una aserción de forma
`strictEqual(actual: true, expected: false)`. Las **tres** siguientes salieron
verdes. No guardé el log de la primera, que fue el error: no puedo nombrar el
caso.

Lo registro igual en vez de callarlo, porque un rojo que se va solo es
exactamente lo que enseña a ignorar el rojo. Dos cosas acotan el riesgo:

- **El diff no puede causarlo.** Es un solo archivo `.md`, y los tests del
  harness que fallan con esa forma no lo leen.
- Los candidatos más plausibles son aserciones sensibles al entorno compartido:
  `scripts/tests/director-status.node.mjs:30-31` (`available === false`) y
  `scripts/tests/harness-verify-hook.node.mjs:56,61` (`existsSync(marca) ===
  false`). Con cuatro sesiones sobre la misma máquina y otra corriendo `verify`,
  una marca residual o un `origin` que aparece a destiempo lo explicarían.

**No lo doy por descartado.** Si al Director le interesa, se persigue guardando
el log de cada corrida y repitiendo con la máquina quieta.

## Impacto documental

`docs/engineering/project-rules.md` es **una de las 16 fuentes canónicas del
piloto semántico** (`scripts/knowledge-policy.json:17` y
`scripts/tests/knowledge-state.node.mjs:23`), así que editarlo **invalida su
recibo semántico** y el piloto deja de estar 16/16 hasta que se reemita.

**No lo reemití**: el recibo va atado a la raíz y no se emite desde un worktree.
Queda para el Director, desde main integrado, junto con la revisión de Graphify,
Archify y la publicación a Obsidian del cierre de tarea.

`knowledge:status` en este worktree da `structural: INVALID`, `semantic:
INVALID` y `verifiedCount: 0` sobre los 16 — **y eso no lo causó este cambio**:
si lo hubiera causado, sólo 1 de 16 estaría pendiente, no los 16. Es la condición
conocida del worktree.

## FUERA DE ALCANCE DETECTADO

Nada nuevo. Los tres seguimientos de SDD-0497 —el contrato por acción,
`tracking/[id]/document-actions.ts` y la capability de exportación— siguen
encolados por el Director y este documento **no** los toca.

## Pendientes

1. Abrir la PR. **No fusionar**: integra el Director.
2. Reemisión del recibo semántico de `project-rules.md` desde main integrado
   (del Director).
