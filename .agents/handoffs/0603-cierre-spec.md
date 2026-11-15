# Handoff · SDD-0603, PR de cierre de la spec

- **Owner:** Claude (Worker), sesión abierta por el Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Worktree:** `.claude/worktrees/0603-cierre-spec-e90b88`. **Rama:** `claude/0603-cierre-spec-e90b88`, desde `claude/rebrand-base-main` = `origin/main` `a47658fab`.
- **SDD:** 0603 (BD-037). El estado por tramo y los pendientes viven en `docs/specs/0603-claridad-controles/spec.md`, secciones «Estado al cierre» y «Pendientes escritos».
- **Encargo:** dejar la spec al día y aplicar dos retoques que dejaron las revisiones. Documentación más contrato; nada cambia en pantalla. Sin Auto-fix, sin traer main, sin fusionar.

## Hecho

- `spec.md`: `updated` 2026-11-15; `status` sigue `in-progress` y el texto dice por qué. Sección «Estado al cierre» con la tabla de tramos, su PR, su fecha y el enlace a su documento. Sección «Pendientes escritos».
- `menores-studio.md`: el botón del Dashboard lleva `aria-label` «Abrir: <título>»; los pendientes de tono vino o neutro se leen como informativos.
- `claridad-t5d-contract.test.ts`: el patrón de `role` crudo suma `log`, con un mutante que lo pone en el hilo de mensajes.
- `tramo-5d.md`: registra lo anterior y que `pestanas-contract.test.ts` sigue excluyendo `crm/`.
- `LeadDrawer.tsx`: sangría del contenido de `<Aviso>` en `AvisoFrenado` (32 líneas, dos espacios). `git diff -w` sale vacío para el archivo.
- `app/studio/CLAUDE.md`: `Aviso` acepta `tabIndex` y `ref`.
- `docs/specs/README.md`: no hizo falta regenerarlo; `docs:check` lo da sincronizado.

## PRs verificadas

Con `gh pr view <n> --json state,mergedAt,title,baseRefName`, el 2026-11-15:

- MERGED en `main`: #510, #511, #528, #535, #537, #540, #546, #547, #548, #549, #551, #552, #553, #557, #558, #561, #562, #582 y #584.
- CLOSED sin fusionar: #536 (tramo 4a); sus cambios entraron por el tren #540.
- OPEN: #318, `mergeable: CONFLICTING`. Su base es `codex/sdd-0574-embarques-cierre`, no `main`. `gh pr diff 318 --name-only` lista los siete archivos detenidos, y los siete existen en `main`.

## Decisiones

- **Excepción de BD-037.** Su revisión estaba fijada «al cerrar el tramo de pestañas». El tramo cerró (#511 y #561) y no hay registro de una decisión de Sam que la cambie. La spec la deja escrita como vigente y con la revisión formal pendiente de Sam. No se editaron `BRAND.md` ni `BRAND-DECISIONS.md`: están fuera de la allowlist y la duda no autoriza cambiarlos.
- «Estado al cierre» va antes de «Contexto», para que se lea primero. Las secciones de cada tramo quedan como registro de su momento, y la sección nueva lo aclara.
- Los pendientes se agrupan por quién los destraba: la PR #318, decisiones de marca o de Sam, hallazgos sin encargo y estados de carga.

## Validación

Cierre elegido por el diff: documentación más un contrato. Turno de la PC concedido por el DG, vía el Subdirector Rebrand, el 2026-11-15. Corridas en serie.

- `node scripts/build-docs-index.mjs --check` (`docs:check`): PASÓ, índice sincronizado con 619 specs.
- `node scripts/check-numbering.mjs` (`sdd:check`): PASÓ, sin números repetidos.
- `pnpm install --frozen-lockfile`: PASÓ, 1 min 33 s. Sin junction al `node_modules` de main.
- Vitest de `claridad-t5d-contract.test.ts`: PASÓ, 26 pruebas, incluido el mutante nuevo de `role="log"`.
- `eslint --max-warnings=0` de `claridad-t5d-contract.test.ts` y `LeadDrawer.tsx`: PASÓ.
- `git diff -w` de `LeadDrawer.tsx` contra `a47658fab`: vacío.
- `pnpm verify`: NO EJECUTADO; lo cubre el CI de la PR.
- Pruebas de producto en navegador: no aplican, nada cambia en pantalla.

## Impacto documental

Todo queda dentro de la carpeta de la spec, `app/studio/CLAUDE.md` y este handoff. No hay políticas, runbooks ni índices por actualizar.

## Pendientes de esta tarea

- Revisión del Subdirector Rebrand y revisión independiente que lanza el Director General.

## FUERA DE ALCANCE DETECTADO

- `docs/design/studio/_norte/BRAND-DECISIONS.md`, BD-037: el estado dice «Hasta fusionar cada tramo, producción sigue como estaba» y el índice dice «se adopta por tramos». Con todos los tramos en producción, ese texto quedó atrás. Igual la frase «se adopta por tramos» de `BRAND.md` §Controles.
- La PR #318 apunta a `codex/sdd-0574-embarques-cierre`, no a `main`: los siete archivos se destraban cuando esa cadena llegue a `main`, no cuando la #318 se fusione en su base.
- `spec.md`, secciones de los tramos 1 y 2 y «Límites»: conservan frases de su momento («Sin PR hasta que…», «La publicación a producción sigue congelada»). Se dejaron como registro; limpiarlas es reescribir la historia de la spec y no estaba en el encargo.
