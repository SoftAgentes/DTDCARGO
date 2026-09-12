# director-dictamen-ramas — Dictamen de ramas sin integrar, purga del huérfano y preflight de aliados

- Fecha: 2026-09-12.
- Owner / sesión escritora: `director-cierre-bloque-c-20260912` (Claude Code, Opus 5), sesión Director.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/director-dictamen-ramas`.
- Rama: `codex/director-dictamen-ramas`, creada desde `origin/main` `004b38f5`.
- Estado de tarea: lista-para-revision.
- SDD: no aplica. Coordinación y evidencia, sin producto ni cambio de comportamiento.
- Permisos del encargo (Sam, 2026-09-12, «dale a las 4 pendientes»): purgar el directorio huérfano
  con `robocopy /MIR`; borrar las dos ramas remotas recomendadas para descarte; revisar las ramas
  que quedaron marcadas REVISIÓN PROPIA; ejecutar los conteos de solo lectura en producción.
  **Sin merge, sin aplicar migraciones, sin escribir en producción.**

## OBJETIVO ORIGINAL

Cerrar las cuatro autorizaciones que quedaron abiertas después de integrar la PR #101: la purga del
worktree huérfano, el descarte de dos ramas remotas, el dictamen de las ramas restantes sin
integrar y el preflight de solo lectura en producción para el tramo 1.

## 1. Purga del worktree huérfano — HECHA

`DTDCARGO/.claude/worktrees/nervous-tharp-418741` quedó sin registro de Git y sin borrar tras el
`git worktree remove` que falló por MAX_PATH. Con la autorización puntual de Sam se purgó con la
técnica que funciona en Windows, la misma que el runbook excluye como fallback **automático**:

1. Guardas previas: el destino existe, su ruta termina exactamente en
   `\.claude\worktrees\nervous-tharp-418741`, y no tiene metadatos `.git` — es decir, ya estaba
   desregistrado y no era un worktree vivo ni el checkout principal. Cualquier guarda que fallara
   abortaba sin tocar nada.
2. `robocopy <directorio vacío> <destino> /MIR` → exit 2 («se eliminaron extras», éxito en la
   semántica de robocopy), entradas restantes dentro del destino: 0.
3. El directorio vacío se eliminó con `Directory.Delete(path, recursive: false)`, y el contenedor
   `.claude/worktrees`, que quedó sin entradas, también.

Nada que preservar: su HEAD `f2c47091` era ancestro de `main` (PR #99 MERGED), su status estaba
limpio incluidos untracked y no tenía `.env` real. Registro final: `git worktree list` muestra el
checkout principal y los worktrees de trabajo vivos, nada más.

## 2. Ramas remotas descartadas — HECHO, con una corrección de dictamen

Antes de borrar se verificó: ninguna PR abierta las usa, ningún worktree registrado las tiene
prestadas, y su contenido está representado en `main`.

- **`codex/remove-agentation-20260910` — BORRADA.** PR #55 CLOSED sin merge, titulada
  «[BLOQUEADA]». Su propósito, retirar las skills de Agentation, lo cumplió la PR #100 ya integrada.
- **`codex/pr28-e2e-harness-validation-20260906` — BORRADA, con evidencia más fuerte que la del
  dictamen previo.** El dictamen de la PR #101 pedía «confirmar equivalencia antes de borrar», y la
  comprobación dio algo mejor que equivalencia: `git diff main..rama` sobre sus archivos de producto
  son **579 borrados contra 21 inserciones**, es decir que moverse de `main` a la rama *quita*
  trabajo. `main` contiene `43c359dd` y `386254fd` (SDD-0440: WebKit serializado, concurrencia
  relativa y baseline del seed, las correcciones revisadas de PR 28 sobre PR 29), que la rama no
  tiene; ambas comparten `34e3bef1`. El fix `b08116f8` de la rama quedó superado.
  Lo único que vivía solo ahí era el handoff `rescate-sdd-0440-arnes.md`, **rescatado en esta rama**
  antes del borrado: 108 líneas cuyo propio título dice «arnés ya incorporado en main», lo que
  confirma el dictamen de forma independiente.

Las ramas locales homónimas no se pudieron borrar con `git branch -d` porque tienen commits propios
que no son ancestros de `main`, y el runbook prohíbe `-D`: quedan como restos locales, sin respaldo
remoto ya. Su contenido está descrito arriba y en el handoff rescatado.

## 3. Dictamen de las ramas que quedaban en REVISIÓN PROPIA

Son siete, no seis como decía el handoff anterior. Ninguna se borró en esta tarea: el runbook exige
autorización específica por rama y esa autorización cubría solo las dos de arriba.

### Con trabajo propio no integrado — CONSERVAR y decidir rescate

- **`codex/audit-hardening-20260801`** · 5 commits · 42 archivos · 2026-08-01. Es SDD-0235, y su
  spec en `main` sigue en `status: approved`, no `done`: el endurecimiento nunca se integró. Los
  commits son de seguridad — «endurecer acceso y datos», «cerrar auth, privacidad y adjuntos» — y
  tocan `app/portal/(auth)/login/actions.ts`, `app/m/cn/login/actions.ts`, `app/m/ve/login/actions.ts`,
  `app/api/cron/purge-throttle/route.ts` y las rutas API de Studio. **Recomendación: rescate por
  lotes en su propia tarea, como se hizo con el bloque C.** No borrar.
- **`claude/jolly-proskuriakova-3da0aa`** · 2 commits · 24 archivos · 2026-07-17. Barrido de «DDP»
  en la web pública para que el servicio se llame «Puerta a Puerta», más el ejemplo de CTA en
  `BRAND.md`. En `main` la cadena «DDP» sigue presente en `app/servicios/page.tsx`,
  `app/servicios/puerta-a-puerta/page.tsx`, `app/puerta-a-puerta/page.tsx` y `app/faq/page.tsx`, así
  que el barrido no está integrado. **Es una decisión de marca, no técnica**: hay que distinguir
  «DDP» como término de incoterm legítimo de «DDP» como nombre de servicio. Recomendación: que Sam
  confirme el alcance del barrido y recién entonces una tarea lo ejecute contra `main` actual, sin
  rescatar una rama de hace dos meses. No borrar todavía.
- **`codex/governance-final-100`** · 20 commits · 101 archivos · 2026-08-01. Su último commit es
  producto: «fix(studio): alinear RBAC de entrega manual VE». Volumen alto y 1336 commits de atraso.
  Recomendación: revisión por lotes propia antes de cualquier decisión. No borrar.
- **`codex/portal-colors-reception-integration-20260906`** · 7 commits · 101 archivos · 2026-09-06.
  De los 101 archivos del diff de tres puntos, 77 ya están idénticos en `main` y 24 difieren: es una
  rama de QA de integración que quedó a medio camino. Recomendación: revisión propia para separar lo
  que aún aporta. No borrar.

### Sin trabajo propio vivo — descarte recomendado, pendiente de autorización

- **`feat/sdd-0286-api-alcance-por-modulo`** · 1 commit · 10 archivos · 2026-08-24. SDD-0286 está
  `done` en `main` y sus dos archivos clave, `lib/studio/rbac-guard.ts` y
  `lib/studio/rbac-api-guard.test.ts`, ya existen allí. El alcance por módulo en los GET de la API
  entró por otra vía.
- **`preview/portal-nueva-compra`** · 1 commit · 1 archivo (`lib/portal/demo.ts`) · 2026-07-29.
  Rama de preview deliberadamente insegura: «SOLO-PREVIEW — abrir el asistente a cualquier cuenta».
  No es integrable por diseño. Si alguna vez se rescata el asistente de nueva compra, su spec habrá
  que renumerarla: el número 0172 ya lo ocupa `docs/specs/0172-tenant-fixtures-lifecycle`, `done` en
  `main`.

### Conservar como archivo

- **`archive/radiografia-erp-20260802`** · 32 commits · 123 archivos. Ya declarada archivo por su
  prefijo; su última línea es una migración histórica aplicada. No tocar.

### No se toca

- **`codex/saneamiento-integral`** = `refs/dtd/pr/21` = `ea9952a4`. Es la PR #21 y la fuente de los
  tramos L07, L10 y L14. Borrarla destruiría el reservorio del bloque C.

## 4. Preflight de solo lectura en producción para el tramo 1 — HECHO

Proyecto `xpfuzqombmjmxvprjgmi`, una sola consulta de agregados. **No se leyó ninguna fila de
negocio ni dato personal: solo `count(*)`.** No se escribió nada y no se aplicó ninguna migración.

| Conteo | Resultado |
|---|---:|
| `aliados` en total | 3 |
| `aliados` con `parent_aliado_id` no nulo | 0 |
| `aliados` cuyo padre está en **otro** tenant | **0** |
| `aliados` con `client_id` no nulo | 3 |
| `aliados` cuyo cliente está en **otro** tenant | **0** |
| `clients` cuyo aliado está en **otro** tenant | **0** |
| `price_books` en total | 1 |

Qué significa para el tramo 1, que es lo que el Worker necesita saber antes de escribir la 0451:

- **Las dos FK compuestas entran sin backfill y sin decisiones fila por fila.** Cero violaciones
  actuales, así que el preflight de conteo pasará y no hay que negociar datos existentes.
- **El riesgo de la cadena todavía no tiene datos que lo exploten:** con `parent_aliado_id` nulo en
  los tres aliados, hoy no existe ningún sub-aliado, así que `resolve_price_book` no puede estar
  tomando la lista de otro tenant en producción ahora mismo. La FK es preventiva, y eso es un
  argumento a favor de ponerla ya: poner la barrera con tres aliados cuesta mucho menos que con
  trescientos, y con un solo `price_book` el daño de un cruce futuro sería total, no marginal.
- **Los locks serán triviales:** `aliados` tiene tres filas y `clients` ya carga el índice que dejó
  la 0450. La ventana de ACCESS EXCLUSIVE es mínima, aunque el aviso de horario de baja actividad
  del handoff `aliado-tenant-coherence.md` sigue valiendo como procedimiento.
- El conteo **no reemplaza el preflight de la migración**: la 0451 debe traer el suyo y fallar
  cerrado, porque entre esta lectura y su aplicación puede entrar un sub-aliado.

## COMPLETADO

- Purga del worktree huérfano con guardas de ruta, y del contenedor `.claude/worktrees` vacío.
- Borrado de las dos ramas remotas autorizadas, con el handoff exclusivo rescatado antes.
- Dictamen de las siete ramas que quedaban, con la medida de contenido propio de cada una.
- Preflight de agregados en producción y su lectura para el tramo 1.

## VALIDACIÓN

- PASÓ: guardas de la purga (destino existente, ruta exacta, sin metadatos `.git`).
- PASÓ: `robocopy … /MIR` exit 2 con cero entradas restantes; eliminación del directorio vacío y del
  contenedor.
- PASÓ: `gh pr list --state open` — ninguna PR abierta usaba las ramas borradas.
- PASÓ: `git diff --stat main..origin/codex/pr28-e2e-harness-validation-20260906` — 579 borrados
  contra 21 inserciones sobre sus archivos de producto.
- PASÓ: rescate del handoff `rescate-sdd-0440-arnes.md`, 108 líneas, desde la rama antes de borrarla.
- PASÓ: `git push origin --delete` de las dos ramas.
- PASÓ: consulta de agregados en el proyecto de producción, siete conteos, sin filas ni PII.
- NO EJECUTADO: `git branch -d` de las dos ramas locales homónimas — no son ancestros de `main` y
  `-D` está prohibido.
- NO EJECUTADO: `corepack pnpm verify` — esta rama solo agrega documentación de dirección; el gate
  de producto corresponde a cada tramo y no hay cambio de comportamiento que medir.

## COMMITS

- Commit que contiene este documento y el handoff rescatado; el SHA final se registra en la PR.

## PR / BRANCH

Rama `codex/director-dictamen-ramas` sobre base `main` `004b38f5`, en el worktree indicado arriba.
PR en borrador con la autorización de publicación de este encargo. Sin merge.

## PENDIENTES DE ESTA TAREA

- Decisión de Sam sobre las cuatro ramas CONSERVAR y las dos de descarte recomendado que todavía no
  tienen autorización de borrado.
- Los dos restos locales, `codex/remove-agentation-20260910` y
  `codex/pr28-e2e-harness-validation-20260906`, que ya no tienen respaldo remoto y que `-d` rechaza.

## FUERA DE ALCANCE DETECTADO

- **`docs/specs/0440-e2e-harness-general-determinista/spec.md` sigue `in-progress` en `main`** aunque
  su arnés ya esté incorporado. Cerrar o actualizar ese estado es una tarea propia.
- **SDD-0235 sigue `approved` sin implementación en `main`** y su trabajo vive solo en una rama de
  hace mes y medio. Es deuda de seguridad, no de limpieza.
- La cadena «DDP» en la web pública: decisión de marca pendiente, descrita arriba.

## HANDOFF AL DIRECTOR

Siguiente acción: asignar el tramo 1, que ya tiene su worktree, su base al día, la SDD-0461
incorporada y ahora también su preflight de producción con cero violaciones. Las cuatro ramas
CONSERVAR necesitan una decisión de Sam antes de convertirse en tareas de rescate; la de marca
necesita su criterio, no una revisión técnica. Ownership de esta rama: `director-cierre-bloque-c-20260912`.
