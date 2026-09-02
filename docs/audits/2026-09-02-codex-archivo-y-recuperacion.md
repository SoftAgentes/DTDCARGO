---
title: "Recuperación del traspaso Cloud y disposición de ramas archive"
tipo: auditoria-operativa
autor: Codex
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
estado: recuperacion-local-verificada-publicacion-pendiente
confidencialidad: interno
---

# Traspaso histórico recuperable, sin restaurar reglas obsoletas

El handoff del 2026-08-28 estaba sólo en una rama local, no en el checkout
vigente ni en `origin/main`. Se preservó su historia exacta en un
[archivo de recuperación Git](assets/2026-08-28-cloud-handoff.bundle).
Se probó su recuperación y se compararon los tres documentos por hash.
La rama original, el índice y los checkouts activos no se modificaron.

**El bundle es evidencia histórica, no instrucciones vigentes.** No se debe
restaurar su `AGENTS.md` sobre el actual, ejecutar sus comandos por defecto ni
usar sus cifras de agosto como estado de hoy. La entrada operativa sigue en
[README](../../README.md), [AGENTS](../../AGENTS.md), el
[checklist vigente](2026-09-02-codex-arranque-checklist.md) y los
[recibos](../../.agents/handoffs/).

## Alcance y propiedad

Trabajo documental autorizado por el saneamiento integral. Allowlist de esta
pieza: este acta, su bundle, `README.md`, el checklist, el recibo general y
`.agents/handoffs/2026-09-02-cloud-handoff-recovery-close.md`.
La comprobación de ignoreCommand amplía la allowlist únicamente a su explicación
en `AGENTS.md`; no se cambia el comando ni la configuración de Vercel.
Sin cambio de comportamiento, SDD nuevo, SQL, dependencias, configuración de
herramientas, `.env*`, `.codex/`, Cloud, producción o archivos ajenos.

Base de trabajo: `5797920a2045db415c3c71ce885bf0561bac0f11`, rama
`codex/saneamiento-integral`, en el worktree aislado del mismo nombre.
La única tarea Codex de DTDCargo detectada fue `Audita y limpia worktrees`
(`01a05f15-80ff-77b1-9f3a-6b07d21df02d`); ninguna tarea ajena archivada.

## Archivo Cloud preservado

Rama: `codex/archive-cloud-handoff-20260828`.
HEAD: `d05b63553b2c56c7cc31dec5dd6898b00f51b5fc`.
Cuatro commits exclusivos frente al saneamiento: tres documentales y un merge.

| Commit | Evidencia conservada |
|---|---|
| `807dcd0a3b54f5ce21a3b48ccf368cd1add4b1fe` | Traspaso inicial, cambios de AGENTS/README y handoff de 15 secciones. |
| `da8d0d5848a4fc28702ac916570ed5c8e4fc57c6` | Merge histórico de `origin/main`; no se vuelve a ejecutar. |
| `92716816c1caa07878c805811d59d23d6ddd8883` | Re-medición posterior al merge y límites del conteo de contratos. |
| `d05b63553b2c56c7cc31dec5dd6898b00f51b5fc` | Matriz de módulos, pendientes, limitaciones y advertencias del traspaso. |

Respecto a `dd752d7832b947135d4cb8417fbe254f0050d630`, sólo cambian
`AGENTS.md`, `README.md` y `docs/CODEX_HANDOFF.md`. No incluye los cambios
pnpm de la otra ventana, que tienen su propia rama archive.

| Archivo recuperado | Blob Git comprobado |
|---|---|
| `AGENTS.md` histórico | `21a6dc77d66b9f5a08a9a1134d38b47cadbc5d48` |
| `README.md` histórico | `faeaf7f2ff79f38d785ee5213aec089de7cc351d` |
| `docs/CODEX_HANDOFF.md` histórico | `e4c9db89a450b61021c45bba36da15c5305db9da` |

Bundle: **135.144 bytes**, inferior a1MB. SHA-256:
`836192f113d6fbd01be605449884c0438eaf9fcbe6a2215e6c9a3337277b2ca2`.
Es un bundle **incremental**, no una copia autónoma de todo el repositorio.
Requiere estos dos commits, ambos comprobados como ancestros de `origin/main`:

- `50b5791ef784d1cffdf9e47183d89df7630ea1c0`.
- `dd752d7832b947135d4cb8417fbe254f0050d630`.

`git bundle verify` terminó0. Se importó el bundle local en una referencia
temporal `refs/codex-recovery/<uuid>`, con `--no-tags --no-write-fetch-head`;
HEAD y los tres blobs coincidieron exactamente. La referencia temporal se
retiró con comprobación del HEAD esperado y se confirmó su ausencia.
No se hizo checkout de sus documentos ni se activó ninguna instrucción antigua.
El índice siguió vacío y HEAD siguió en5797920a durante la prueba.

La inspección de patrones de credenciales en los diffs de los cuatro commits
no encontró PAT, JWT ni clave privada. No es una certificación de privacidad
del repositorio: se conserva material documental que ya existía en su Git,
sin leer `.env*`, PII de negocio o archivos alojados.

## Qué permanece útil y qué no debe restaurarse

| Contenido histórico | Tratamiento y evidencia actual |
|---|---|
| Mapa del negocio, incidentes, matriz de módulos y resultados de agosto | Conservados literalmente en el bundle. Sirven de pista fechada, no de aceptación funcional vigente. |
| Arranque, comandos y rutas públicas | La intención ya está en README/AGENTS actuales; `next.config.ts:510` y517–518 llevan Portal/track a `/entrar`. No reinstalar el documento antiguo. |
| «No hay CI» | Supersedido por `.github/workflows/quality.yml`, con PR/main y ejecución manual. El CI de un SHA no demuestra otro SHA ni producción. |
| «RLS es ciega al rol» | No se adopta. Las policies locales pueden comprobar rol:0407 `invoices_accounting_insert` lo hace;0422 exige membresía activa. Esto no afirma que estén aplicadas en Cloud. |
| «La matriz no es editable en DB» sin matiz | No se adopta. `lib/studio/rbac.ts:289` y312–350 contemplan overrides por rol/módulo; los módulos LOCKED y support conservan sus restricciones. |
| Copiar `.env.local` y usar `git stash` para limpiar | No se ejecuta. Las credenciales/PII y la propiedad de cambios conservan sus gates; el cierre de Codex prohíbe stash/reset/clean como atajos. |
| «~90 % construido» / conteos de2026-08-28 | No se convierten en porcentaje actual. El checklist mide tareas de saneamiento, no producto ni horas restantes. |
| P1/P2 y decisiones B/C del handoff | No se dan por cerrados por archivar. Se contrastan por dominio contra las specs y el checklist actuales; cifras de clientes, plazos y proveedores no se revalidaron aquí. |
| Propuesta de reducir AGENTS a300 líneas | No se ejecuta. Es una propuesta histórica, no una orden ni una aprobación para podar reglas. |

No se ha fusionado el archive, restaurado `docs/CODEX_HANDOFF.md` como entrada
activa, cerrado specs por antigüedad ni vuelto a ejecutar pruebas antiguas.

## Rama pnpm preservada

`codex/archive-primary-pnpm-20260902` permanece en
`d390092fbf88f00893c5bb4161a342b3b7e859dd`.
Su intención de overrides está supersedida en el workspace actual: se mantienen
vite8.2.2, sharp0.35.3, las tres líneas de brace-expansion, js-yaml4.3.1,
nanoid3.3.18, fast-uri3.1.6 e ip-address10.5.0; postcss es8.5.23 frente a8.5.18
del archive. Es comparación del manifest, no una nueva auditoría de advisories.
No se sustituye el lockfile actual por el anterior ni se borra la rama.

## Condiciones antes de limpiar

| Objeto | Situación real | Condición que falta |
|---|---|---|
| Worktree principal | Limpio,20 commits detrás de `origin/main`; HEAD22cec0c2 | Actualización autorizada por integrador exclusivo; no reset. |
| Worktree saneamiento | Carril activo; commits posteriores a eabb230b sin publicar | Publicación, CI, compatibilidad de release, integración y prueba de contención. |
| Archive Cloud | Historia recuperable localmente y bundle verificado; rama intacta | Publicar/integrar la evidencia. El bundle no hace al HEAD archive ancestro de main ni autoriza `branch -D`. |
| Archive pnpm | Intención supersedida localmente, rama intacta | Comprobar la intención en main publicado y resolver disposición sin descartar historia incierta. |

La limpieza queda pendiente; **cero worktrees o ramas de trabajo eliminados**
en esta pieza. El checklist conserva47/103: no se marca como limpieza terminada
lo que todavía depende de publicación/integración. El recibo detalla el commit.

Este incremento es sólo documental, pero **el ignoreCommand medido no cancela
su build**: primer diff exit1, segundo diff exit0. La causa son los dos recibos
en `.agents/handoffs/`: `:(exclude,glob)*.md` no excluye Markdown anidado fuera
de `docs/`. Se precisó la guía AGENTS sin alterar `vercel.json`.
Eso permite un eventual build automático; no demuestra que exista un deployment,
que haya terminado ni que los cambios estén en producción. No se forzó ninguno.
La publicación solicitada hasta
5797920a sigue siendo un alcance distinto de este incremento documental.
