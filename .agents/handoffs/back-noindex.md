# Handoff — /back fuera de los buscadores (SDD-0512)

Fecha: 2026-10-14. Task ID: `back-noindex`.

- **Owner / sesión escritora:** `claude-6beb7d4f`, Worker en Claude Code. No hubo subagentes.
- **Encargo:** lo asignó el Director a pedido de Sam, con la evidencia de curl del 2026-10-14.
- **Estado de la tarea:** lista-para-revision. La PR va en borrador contra main y no está integrada.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/back-noindex`, creado con
  `node scripts/harness-worktree.mjs start back-noindex` después de `git fetch origin`.
  - `guard` y `claim --owner claude-6beb7d4f` PASARON sobre el árbol limpio.
  - `guard --owner` se repitió antes de cada commit.
- **Rama:** `codex/back-noindex`. Nació en origin/main `cbce7692` y avanzó por fast-forward al
  commit de reserva `5bcf7585`, cuyo padre es `cbce7692`.
- **SDD:** `docs/specs/0512-back-noindex/spec.md`, en `in-progress`.
  - La reservé en local con `pnpm sdd:next --reserve back-noindex`. El inventario recorrió 230 refs
    y worktrees y dio 0512 para spec y 0475 para migración. La ref local es
    `codex/sdd-reserve-0512-back-noindex` y no se publicó aparte: la PR lleva la spec.
  - Le pedí el número al Director por mensaje (sesión «Revisión de tareas en progreso»,
    `message_id 1fa58206`). El mensaje quedó en cola y sin respuesta al cerrar, así que el número
    sigue provisional hasta que lo confirme.
- **Permisos del encargo:**
  - Puedo hacer commits locales, publicar mi rama y abrir la PR en borrador.
  - No puedo fusionar: el merge lo hace el Director con OK de Sam.
  - No se toca producción, y nada se fusiona en la ventana del corte de dtdcargo.com a Contabo
    (jueves 2026-10-15 en la noche).

## OBJETIVO ORIGINAL

Que `/back/login`, y el resto de `app/back/`, no se indexe en buscadores, igual que
`/studio/login`, `/portal` y `/m`, que ya salen con `<meta name="robots" content="noindex, nofollow">`.
También había que evaluar si `/back` entra al Disallow de `robots.ts` con el mismo criterio que
`/interno/`.

Evidencia del Director, medida con curl el 2026-10-14:

- `https://dtdcargo.com/back/login` responde 200 con `index, follow` y sin `X-Robots-Tag`.
- `https://nuevo.dtdcargo.com/back/login` responde igual.

## COMPLETADO

- **Causa:** `app/back` no tenía layout raíz.
  - `(auth)/layout.tsx` y `(app)/layout.tsx` no declaraban `robots`.
  - `(auth)/login/page.tsx` es `"use client"` y no puede exportar `metadata`.
  - Por eso la página heredaba el `robots: { index: true, follow: true }` de `app/layout.tsx`.
  - Studio, Portal y el operario lo declaran en su layout raíz (`app/studio/layout.tsx`,
    `app/portal/layout.tsx` y `app/m/layout.tsx`).
- **Arreglo:** `app/back/layout.tsx` nuevo, solo con metadata, declara
  `robots: { index: false, follow: false }`, el mismo patrón y el mismo valor que el Studio.
  - Devuelve un fragment, así que el DOM de los dos grupos no cambia.
  - No declara `title`, así que el título «Back · DTD Cargo» de `(app)` no cambia.
- **Prueba:** `app/__tests__/back-noindex.test.ts`.
  - Resuelve la herencia de metadata como Next: gana el `robots` del nivel más profundo que lo
    declara, empezando por el `page`, siguiendo por el `layout` de su carpeta y después los de
    cada carpeta padre.
  - Lee el código con el compilador de TypeScript en vez de importar los módulos, porque los
    layouts del back importan la sesión de Supabase.
  - Tiene controles positivos (`/studio/login`, `/portal/registro` y `/m` resuelven a noindex) y
    uno negativo (la home sigue indexable por `app/layout.tsx`).
- **Decisión sobre robots.txt:** `/back` no entra al Disallow, y `app/robots.ts` no cambia.
  - Un Disallow impide que Google rastree `/back/login` y lea el noindex nuevo. Una URL que ya
    conocía se queda indexada «URL-only». Es el criterio de `/track/` que ya documenta
    `app/robots.ts`.
  - `/interno/` está en el Disallow porque nació con noindex. `/back/login` se sirvió indexable
    hasta hoy.
  - La prueba fija la decisión, con un control que demuestra que sí ve los bloqueos de `/marca`
    e `/interno/`.
  - Se puede revisar cuando Search Console confirme que `/back` salió del índice.
- **Criterios de la spec:** 1, 2 y 3 cumplidos con la evidencia de abajo. La verificación en
  producción es de release y queda pendiente después del merge y del deploy.

## VALIDACIÓN

Todo sobre el árbol de `acef0b52`. El handoff no cambia código.

| Comprobación | Resultado | Detalle |
|---|---|---|
| Prueba nueva contra main (el código de `cbce7692`, sin el layout) | FALLÓ, que es lo esperado | 1 fallida y 5 pasadas de 6. Las dos páginas, `(app)/page.tsx` y `(auth)/login/page.tsx`, resuelven a `{"index":true,"follow":true}` y «lo pone app/layout.tsx». Los cuatro controles pasan. |
| Prueba nueva con el arreglo | PASÓ | 6 de 6, exit 0. |
| Mutante M1: el layout con `index: true` | Muerto | 1 fallida, exit 1. |
| Mutante M2: el layout sin `follow` | Muerto | 1 fallida, exit 1. Sin la directiva, los buscadores siguen los enlaces. |
| Mutante M3: `(app)/page.tsx` declara `robots` indexable en su `metadata` | Muerto | 1 fallida, exit 1, y la prueba nombra la página como fuente. |
| Mutante M4: `"/back"` en el Disallow | Muerto | 1 fallida, exit 1. |
| Árbol después de los mutantes | PASÓ | 6 de 6, y `git status` mostraba solo los dos archivos nuevos. |
| Render real con `next dev` local (puerto 3517, Supabase ficticio en 127.0.0.1:54399, sin `.env`) | PASÓ | Con el layout, `/back/login` da 200 y `noindex, nofollow`. Sin el layout (archivo movido), da 200 y `index, follow`. Controles: `/studio/login` sale con `noindex, nofollow` y `/` con `index, follow`. `/back` sin sesión responde 307 a `/back/login`. El `robots.txt` servido sigue con Disallow de `/marca` e `/interno/` y nada de `/back`. Al terminar detuve el servidor y su árbol de procesos. |
| `pnpm typecheck` | PASÓ | Exit 0. |
| `eslint` de `app/back/layout.tsx` y la prueba | PASÓ | Exit 0, sin avisos. |
| Contratos vecinos con vitest (8 archivos: la prueba nueva, sitemap-cobertura, proxy-matcher, fuentes-locales, vis-02-font-tokens, feature-flags-catalog y los dos rbac-guard) | PASÓ | 8 archivos, 129 pruebas, exit 0. |
| `pnpm docs:check` | PASÓ | Índice sincronizado con 498 specs. |
| `pnpm sdd:check` | PASÓ | `numbering: sin números repetidos`. Los avisos ⏸ son los choques históricos ya aplicados. |
| `git diff --check` | PASÓ | — |
| `pnpm verify` completo | NO EJECUTADO | Es una corrida pesada: se le pide turno al Director, y lo pedí en el reporte. |
| Verificación en producción con curl | NO EJECUTADO | Es de release: va después del merge y del deploy, fuera de la ventana del corte. |

Sobre los mutantes: el primer intento de M3 agregó un segundo `export const metadata` al final
de la página. Sobrevivió porque era un programa inválido: la página ya exporta `metadata` con su
`title`, y el resolutor se queda con la primera. Lo repetí metiendo `robots` dentro del
`metadata` existente, que es lo que haría alguien de verdad, y murió.

## Impacto documental y conocimiento

- **Documento canónico:** la spec SDD-0512 y el índice regenerado con `pnpm docs:index`. La
  decisión sobre robots.txt también queda en el comentario de `app/back/layout.tsx` y en la
  prueba. No cambian AGENTS, ni project-rules, ni runbooks.
- **`pnpm knowledge:status`** (exit 0, `ok: false`, Graphify 0.9.61, `mode: integrated`):
  - Este worktree recién creado no tiene `graphify-out/graph.json`
    (`graph_missing_or_invalid`, `graph_empty`).
  - La capa estructural da INVALID con 4523 pendientes, entre ellos mis dos archivos nuevos
    (`app/__tests__/back-noindex.test.ts` y la spec).
  - La semántica da INVALID: 1188 pendientes, piloto en 0/16. Ninguno de mis archivos está en el
    piloto.
  - Archify da PENDING por `ARCHIFY_RUNTIME_MISSING`.
  - Obsidian da PENDING en `cbce7692`.
- **Graphify, Archify, `knowledge:visual` y la preview de Obsidian:** NO EJECUTADOS. Reconstruir
  el grafo desde cero en este worktree es una corrida pesada, y Graphify lo publica el Director
  desde main integrado. Los pendientes estructurales de mis dos archivos quedan para esa
  publicación. No declaro ninguna capa actualizada.

## COMMITS

- `5bcf7585` — `chore(sdd): reserva SDD-0512 — back-noindex`, el stub generado por el script.
- `a99ef539` — `docs(sdd): SDD-0512 — spec e índice de /back fuera de los buscadores`.
- `acef0b52` — `fix(back): SDD-0512 — /back sale con noindex, nofollow`, con el layout y la prueba.
- El commit que contiene este documento: `docs(sdd): SDD-0512 — handoff`.

## PR / BRANCH

- **Rama:** `codex/back-noindex`, publicada con `git push -u origin codex/back-noindex:codex/back-noindex`.
- **PR:** en borrador contra `main`, abierta desde esa rama. El número y la URL quedan en la PR y
  en el reporte al Director, para no crear un commit nuevo después de publicar.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/back-noindex`.

## PENDIENTES DE ESTA TAREA

1. Que el Director confirme el número 0512 o asigne otro. Si cambia, renumero carpeta,
   frontmatter, referencias e índice en esta rama. No hay migración.
2. `pnpm verify` completo, con turno del Director.
3. Revisión y merge del Director con OK de Sam, fuera de la ventana del corte a Contabo del
   jueves 2026-10-15 en la noche.
4. Después del deploy, el curl de `/back/login` en `dtdcargo.com`, y en `nuevo.dtdcargo.com`
   mientras exista, tiene que traer `noindex, nofollow`. Con eso la spec pasa a `done`.

## FUERA DE ALCANCE DETECTADO

- **Studio:** solo es noindex por su layout raíz. `/studio/login` además lo declara en la página,
  y eso es redundante pero coherente. No hay nada que hacer, pero aplica la misma advertencia
  que al back: una página con `robots` propio pisa el del layout.
- **`app/__tests__/sitemap-cobertura-contract.test.ts`:** da por privadas `studio`, `portal`,
  `m`, `invitar`, `interno` y `p` sin comprobar que salgan con noindex. Así se escapó `back`. El
  resolutor de esta prueba se podría extender a esas superficies, pero eso es otra tarea: no
  revisé si alguna tiene una página que lo pise.
- **El mismo contrato del sitemap usa voseo en sus mensajes** («agregás», «ponés», «querés»). No es
  de esta tarea y no lo toqué.
- **Search Console:** no comprobé si `/back/login` está hoy en el índice de Google. Hace falta
  acceso a Search Console, y es lo que decide cuándo se puede reconsiderar el Disallow.

## HANDOFF AL DIRECTOR

- **Siguiente acción:**
  - Confirmar SDD-0512.
  - Dar turno para `pnpm verify` o registrarlo como NO EJECUTADO.
  - Revisar la PR en borrador.
- **Dependencias:** ninguna. No toca DB, migraciones, API, `robots.ts`, `next.config.ts` ni
  componentes compartidos.
- **Integración:** el merge a main despliega a producción en Vercel. Hace falta el OK de Sam
  para el merge y el deploy, fuera de la ventana del corte.
- **Sesiones consumidoras:** ninguna conocida.
- **Ownership:** libero el claim al cerrar, después de publicar. El worktree y la rama se
  conservan.
