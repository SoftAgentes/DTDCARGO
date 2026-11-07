# Handoff — SDD-0611 · Implementación de los filtros de publicación automática

| Campo | Valor |
|---|---|
| Owner | Worker `local_wizardly-murdock-0611` |
| Sesión que encargó | Subdirector «SEO, GEO y AEO» (`local_61442abe-3b66-423e-9af4-8008d5457aa3`) |
| Ruta | `.claude/worktrees/wizardly-murdock-7db565` |
| Rama | `claude/wizardly-murdock-7db565`, base `main` `ecadbac91` |
| Fecha | 2026-11-07 |
| SDD | 0611, `docs/specs/0611-noticias-publicacion-automatica/spec.md` (pasa de `approved` a `in-progress`) |
| Migración | **0518** `supabase/migrations/0518_noticias_publicacion_automatica.sql`. **NO APLICADA**. Está declarada en `pendingBelowCutoff` y no está sellada |

## OBJETIVO ORIGINAL

Implementar en el servidor los filtros de la SDD-0611 antes de publicar una noticia sola:
- pasó por el Revisor;
- sin `[VERIFICAR]` ni datos sin fuente;
- respeta las líneas rojas;
- llega al puntaje mínimo;
- respeta el tope por día y por semana;
- el interruptor está encendido;
- queda el registro de modelo, agente y versión;
- se puede retirar con un clic.

Si cualquiera falla, el artículo queda retenido. Respeta las decisiones de Sam:
- canal `#noticias`;
- no se declara la IA;
- una diaria a mano hasta el 2026-11-15 y después dos automáticas por semana;
- revisión a los 60 días.

Migración sin aplicar, con su paquete para el Director General. PR en borrador.

## COMPLETADO

1. **Requisito previo (§3, criterio 3), en vigor apenas se fusione, sin migración:**
   - `publishPost` rechaza en el servidor cualquier marca `[VERIFICAR`: vacía, en minúsculas, sin cerrar, de ancho completo, con guion blando o carácter invisible, o codificada en un enlace (`%5B`). Archivo: `app/studio/(app)/marketing/noticias-web/actions.ts`.
   - `verifyMarkers` de `lib/news/score.ts` usa la misma regla, así que el navegador también bloquea la marca vacía.
   - **No** se agregó el mínimo de 400 palabras para la vía manual. La 0611 deja que una persona publique un retenido, y la 0613 todavía está `proposed`. Sí entra en F6, para la vía automática.
2. **Filtros puros**, en `lib/news/autopublicar/`:
   - `filtros.ts`: F1 a F10 en una sola pasada, que falla cerrada. Un filtro que lanza cuenta como fallado con su código.
   - `marcas.ts`: F4, gemela de `news_texto_tiene_marca`.
   - `control.ts`: F5, con una regla por fila de §4.3.1 y la mitad del Revisor línea por línea. Los nombres prohibidos se cargan de `NEWS_NOMBRES_PROHIBIDOS`; sin esa variable falla cerrado.
   - `puntaje.ts`: F6 sobre `computeArticleScore`, más titular, portada, tipo de contenido y muletillas.
   - `ritmo.ts`: F7 en hora de Caracas (UTC−4), semana de lunes a domingo, límite duro de 1 por día.
   - `huella.ts`: F3, SHA-256 gemela de `news_huella`.
   - `aviso.ts`: §4.5.
   - `motivos.ts`: §4.11.
3. **Migración 0518** (detalle en su cabecera):
   - estados `en_revision` y `retenido`;
   - columnas `autopub_*` y del veredicto en `seo_drafts`;
   - `publish_via`, `seo_draft_id` y `content_sha256` en `news_posts`;
   - CHECK NOT VALID de marcas por cualquier vía;
   - interruptor `news_autopublish_settings`: apagado, con CHECK de 0–1 por día y 0–7 por semana y registro de cambios;
   - auditoría `news_publication_audit`;
   - salidas `news_post_exits`;
   - funciones: `news_evaluacion_automatica` (solo service_role; reevalúa con bloqueo F1, F3 por huella y veredicto, F7 y F10, la marca, y escribe F9 en la misma transacción), `news_publicar_manual`, `news_retirar`, `news_volver_a_publicar`, `news_salida_motivo`, `news_registrar_aviso`, `news_aviso_confirmar_a_mano` y `news_autopublish_configurar`;
   - disparadores: registran toda salida, rechazan borrar una automática y rechazan que una sesión de la API, o la llave service_role, escriba una fila automática a mano.
4. **Orquestador** `lib/studio/news/autopublicar.ts`:
   - lee el estado, evalúa y llama a la base;
   - avisa en `#noticias` por el transporte de la 0606, con `DISCORD_WEBHOOK_NOTICIAS` y el mismo `DISCORD_TENANT_ID`;
   - registra el estado del aviso para F8.
   - **No está enganchado a ninguna ruta.**
5. `extractExcerpt` y `calcReadTime` pasan a `lib/news/derivados.ts`, para que las dos vías deriven lo mismo.
6. Documentos de §9, con el estado real («aprobada, sin vigencia hasta aplicar la 0518 y encender»):
   - `docs/governance/README.md`, con la nota literal de §2.1 y su estado;
   - `agente-seo-noticias.md`;
   - `06-noticias.md`;
   - `02-reglas-de-la-oficina.md`;
   - el plan maestro, §7.8 y la fila `#noticias` de §7.6.

### Decisiones de Sam respetadas

- **Canal:** `#noticias`, con variable propia, solo para el tenant dueño y apagado en staging.
- **No se declara IA:** el aviso y la noticia no lo dicen. Lo automático firma «DTD Cargo», sin escritor invitado. Lo fija una aserción SQL y un mutante.
- **Ritmo:**
  - el tope cuenta solo las automáticas (aserción SQL y mutante);
  - el límite duro es de 1 por día;
  - los topes son configuración que cambia un admin: 1/7 para la prueba y 1/2 después.
  - La prueba a mano hasta el 2026-11-15 no necesita nada de esto. Lo único que cambia hoy para la vía manual es el bloqueo de `[VERIFICAR]`.
- **Retirar no apaga el interruptor:** aserción SQL. Con dos retiradas en la semana, el aviso lo dice primero.
- **Revisión a los 60 días:** queda en la spec §2 y en la nota de gobernanza. El código no la automatiza.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `noticias-web-marcas-verificar.test.ts`, en rojo antes del arreglo | PASÓ el rojo: 9 de 10 fallaban con el `actions.ts` de `main` y el control pasaba. Después del arreglo, 10/10 |
| `lib/news/autopublicar/__tests__/filtros.test.ts` + `piezas.test.ts` (un caso aislado y un mutante en proceso por filtro, más límites de §5.1) | PASÓ, 148 pruebas |
| `lib/studio/news/__tests__/autopublicar.test.ts` (orquestador con base y Discord dobles) | PASÓ, 7 pruebas |
| Contrato `supabase/tests/0518_…test.sql` en PGlite | PASÓ: `TEST 0518 GREEN: 63 aserciones` |
| Control rojo del contrato (sin 0518) | PASÓ: cae en la primera aserción |
| Mutantes de la 0518 (19) y gemelas TS/SQL (marca y huella) | PASÓ con el turno del Subdirector (2026-11-07, 1 worker): murieron los 19, cada uno en la aserción que lo nombra; las 2 gemelas coinciden. El archivo entero da 24/24 en 32 s |
| Número 0518 sin choque | PASÓ: no hay `refs/dtd/reservations/0518` en origin ni en local, y ninguna otra rama ni worktree tiene `supabase/migrations/0518_*` |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO · 0 AMARILLO`. El primer intento dio 5 rojos por nombres de columna homónimos; se renombraron a `autopub_*` y `seo_draft_id` |
| `pnpm docs:check` / `pnpm sdd:check` | PASÓ / PASÓ (números sin repetir) |
| `tsc` y `eslint` de los archivos tocados (primera tanda) | PASÓ, sin errores. La tanda final, NO EJECUTADO todavía |
| `pnpm verify` | NO EJECUTADO: necesita turno del Director General |
| Carrera real (dos corridas a la vez, `dblink` en Postgres) | NO EJECUTADO: PGlite tiene una sola conexión. El diseño la cubre con `FOR UPDATE` sobre la fila del interruptor y del borrador y con el índice único `seo_draft_id`; falta la prueba con el patrón de la 0459 |
| `revisar-datos-ve` sobre el flujo (criterio 9, pedido del DG) | PASÓ, con hallazgos. Informe en `docs/specs/0611-noticias-publicacion-automatica/privacidad.md`: 8 CORRECTO, 2 ENCONTRADO y 4 NO VERIFICABLE. Los ENCONTRADO son la retención sin plazo de las tablas nuevas y el nombre de quien publica a mano en `#noticias` (decisión de Sam, sin declarar al personal). La línea de `#noticias` quedó en `inventario-terceros.md` |
| Graphify / Archify / `knowledge:status` | NO EJECUTADO: el Director publica desde `main` integrado |

## Paquete para el Director General (aplicar la 0518)

Generado con `infra/ops/migraciones/preparar.mjs` desde `ce9b3e3636f98d5f5e0606bc339d884f2bf7c9a2` y rearmado después de la revisión del Director General. Está en la carpeta de notas del Subdirector, fuera del repo:
- `paquete-0518-ce9b3e363-dtd-cargo` (producción);
- `paquete-0518-ce9b3e363-dtd-cargo-staging` (prueba; lleva `ENSAYO-PRUEBA.md`, preparado y **no corrido**).

Los de `aada8a4ce` quedan marcados `OBSOLETO-`.

| Pieza | Producción | Prueba |
|---|---|---|
| blob de la 0518 | `30c81cde72af`, md5 `c692dfa9c4ad31e3352721400c3e3ceb`, 44.672 bytes | igual |
| `previa.sql` | md5 `818aa20945f964530798d4655b80f3b0` | igual |
| `aplicar.sql` | md5 `a74d11585b413d2987b2c1a7d60a9444` | `d040556396b7ffb3302cc2d72100ee67` (otro `created_by`) |
| `verificar.sql` | md5 `580bc00ff40811810513b510f763e796` | igual |
| `desarme.sql` | md5 `b81612eb10048d2a9bc2529acb0520ef`, 5.825 bytes (sin cambios) | igual |

Ensayo de los dos paquetes en PGlite, con un ledger simulado (no es producción ni prueba):
- PASÓ: previa, luego aplicar, luego verificar. Quedó una fila en el ledger y los 13 cuerpos son iguales al archivo.
- PASÓ: la previa repetida frena con «ya está en el ledger».
- `sha256sum -c` da OK en las dos carpetas.

El desarme tiene su ensayo en la prueba Vitest («DESARME»):
- el catálogo queda idéntico al de antes de la 0518;
- aborta si el interruptor está encendido o si hay filas que se perderían.

Declaración de símbolos: no hace falta. El gate da `0 ROJO · 0 AMARILLO`, porque ningún módulo alcanzable desde una ruta nombra los símbolos de la 0518.

La 0518 cambia `seo_drafts_categoria_check` **solo** si todavía tiene la lista vieja de la 0053, y lo deja marcado en su comentario. Si producción ya lo cambió fuera de banda, no lo toca.

1. **Preflight en producción, solo lectura y sin filas:**
   - la definición viva de `seo_drafts_status_check`, de `seo_drafts_categoria_check` y de las policies de `news_posts`. `seo_drafts_categoria_check` lo creó la 0053 con las 10 categorías viejas y ninguna migración del repo lo cambió; la 0518 lo cambia solo si sigue igual;
   - **el conteo, y solo el número,** de noticias publicadas con marca (consulta en la espera de `migrations-baseline.json`). Si da más de 0, esas noticias siguen publicadas (el CHECK es NOT VALID) pero no se pueden volver a publicar ni editar sin quitar la marca: decidirlo con Sam antes.
2. Ensayo en prueba con el mismo archivo y postflight: el interruptor sigue apagado y `authenticated` no ejecuta `news_evaluacion_automatica`. Ya lo comprueba el bloque `$postflight$`.
3. Aplicar con el OK nominal de Sam para `0518_noticias_publicacion_automatica` y el runbook `aplicar-migraciones-prod.md`. Después: sellarla, retirar la espera y mirar `md5` contra el ledger.
4. Aplicarla **no enciende nada**: ninguna ruta llama a estas funciones.

## Revisión del Director General sobre `2e6e678b9` (CHANGES_REQUESTED), resuelta

1. **MEDIA:** el aviso de «Retenida» mandaba el titular aunque F5 la retuviera por datos personales. Ahora va solo el código del borrador, los motivos y el enlace, también si el titular trae un dato personal. Dos pruebas en rojo antes del arreglo.
2. **MEDIA:** `revisar-datos-ve` corrido (informe `privacidad.md`) y línea de `#noticias` en `inventario-terceros.md`. De paso, `validarRetiro` rechaza una nota con datos personales.
3. **BAJA:** `seo_draft_id` pasa de `on delete set null` a `on delete no action`.
   - `set null` chocaba con el CHECK de las automáticas.
   - `no action` y no `restrict`, porque se comprueba al final de la sentencia y el borrado en cascada de un tenant no aborta.
   - El contrato suma tres aserciones: el borrador de una automática no se borra, la noticia sigue y el tenant se borra en cascada. Dos mutantes nuevos, SET NULL y CASCADE, mueren.
4. **BAJA:** el riesgo de que un admin escriba `reviewer_verdict` quedó anotado en la spec, §11.1, como riesgo aceptado.
5. `set local`: sin cambios.

## Puesta al día con `main` `dda93b219` (2026-11-07, turno del DG de las 23:20Z)

Merge (no rebase) con el driver `dtd-generated-records`. Entró sin conflictos y el índice regenerado no cambió. `main` trae `sql-tests.yml`, que corre `supabase/tests/*.test.sql` con `psql` en postgres:17. El contrato de la 0518 ya aplica las migraciones con `\ir`, así que corre ahí sin cambios. Los md5 de la 0518 (`c692dfa9…`) y del desarme (`b81612eb…`) no cambiaron, y los paquetes de `ce9b3e363` siguen valiendo.

| Comprobación | Resultado |
|---|---|
| Candado (`migrations-lock.mjs`) | PASÓ: 503 selladas (la mayor, 0517) y 3 esperas: 0422, 0423 y 0518. Historia comparada contra `dda93b2192f4` |
| Gate de símbolos | PASÓ: 0 ROJO · 0 AMARILLO |
| docs:check / sdd:check | PASÓ / PASÓ |
| `git diff --check dda93b219 HEAD` | PASÓ |
| Vitest, `--maxWorkers=1`, en `lib/news`, `lib/studio/news` y `noticias-web` | PASÓ: 13 archivos, 270/270. Incluye el contrato PGlite de 66 aserciones y los 21 mutantes |
| eslint de los 18 archivos de la PR / `tsc --noEmit` | PASÓ / PASÓ |
| `sql-tests` con Postgres real | NO EJECUTADO en local (Docker queda para GitHub Actions); lo corre el CI de la PR |
| `pnpm verify` / build | NO EJECUTADO: el DG lo pidió así |

## PENDIENTES DE ESTA TAREA

- Plazo de retención y purga de `news_publication_audit`, `news_post_exits` y `news_autopublish_settings_log`. Lo decide Sam; va en la segunda PR.

- `pnpm verify` con turno del Director General.
- **Segunda PR, después de aplicar la 0518** (migrate-first; si va antes, el gate de símbolos se pone rojo):
  - ruta de cron que llame a `evaluarBorradorAutomatico` con service_role;
  - pantalla de retiro (`/studio/marketing/noticias-web/retirar/[id]`, con `ConfirmDialog`, motivo obligatorio y `/ui-check`);
  - cola de retenidos en Noticias Web;
  - interruptor en Ajustes;
  - que `publishPost` pase por `news_publicar_manual` y avise en `#noticias` con «Publicada por una persona»;
  - revalidar `/noticias`, el artículo y `sitemap.xml` al retirar;
  - resumen semanal de retiros;
  - devolución del motivo a la oficina por la puerta de salida (0610), con `notaParaOficina`.
- Crear el canal `#noticias` y su webhook en Discord (Sam), y cargar `DISCORD_WEBHOOK_NOTICIAS` y `NEWS_NOMBRES_PROHIBIDOS` en el servidor. Ninguna de las dos llaves va al repo.
- Carrera con `dblink` en la suite SQL local.
- Los dos ENCONTRADO de `privacidad.md`: plazo de retención (Sam) y declarar al personal que su nombre sale en `#noticias` antes de enganchar la vía manual.
- Legibilidad (Fernández Huerta) y variación de oraciones: la spec dice medirlas desde el primer día y volverlas filtro después de la prueba. No están construidas.

## Interpretaciones (inferidas, para confirmar)

- **Largo:** «margen de 150 palabras» se leyó como ±150 alrededor del objetivo (Informativo 850–1.150, Curiosidad 550–850, Polémica 950–1.250).
- **Cifras que piden fuente (F4):** cualquier número de dos o más dígitos, un decimal, un porcentaje o una fecha «N de mes». Detecta de más a propósito.
- **Versión de los prompts en la auditoría:** `agente@versión` del perfil del Redactor, porque los prompts viven en la oficina.
- **Muletillas:** la tabla del anexo; «potencia» se acotó a «potencia tu» para no atrapar «potencia económica».

## FUERA DE ALCANCE DETECTADO

- **Un admin no puede despublicar ni volver a publicar una noticia por la API.**
  - La única policy SELECT de `news_posts` es `published = true` (0055), y PostgreSQL también se la aplica a la fila nueva de un UPDATE: despublicar da 42501, y una noticia retirada queda invisible para el UPDATE.
  - Está medido en el contrato: aserción «por la API, un admin no despublica».
  - La 0518 agrega `news_retirar` y `news_volver_a_publicar` para esto, pero cualquier pantalla de hoy que despublique por un UPDATE directo falla.
- **`seo_drafts.categoria` seguía con las 10 categorías viejas de la 0053.** La 0518 la corrige como NOT VALID. Falta comprobar en producción si `saveDraft` con las categorías nuevas funciona hoy, o si el CHECK se cambió fuera de banda.
- **`news_posts` no tiene `content_kind`, `cover_image_url` ni `reviewer_name`** en ninguna migración del repo, aunque `lib/news/types.ts` los declara. Lo automático no guarda portada ni tipo de contenido en la noticia.
- **El control de precio ataja frases de la regla de densidad**, como «500 kg por metro cúbico». Es un falso positivo aceptado: la noticia va a revisión manual.
- **Prueba intermitente de Chatwoot (SDD-0589):** `lib/studio/chatwoot/__tests__/guia-panel.test.ts:185` («vuelve a contestar solo cuando algo cambió»). La prueba espera 5 ms fijos (`esperar()`, línea 84) y bajo la carga del CI a veces no alcanza. Puso rojo el CI de la #417 en `e7cff494c`. Debería esperar una condición.

## COMMITS

PR en borrador [SoftAgentes/DTDCARGO#417](https://github.com/SoftAgentes/DTDCARGO/pull/417). Ver `git log main..claude/wizardly-murdock-7db565`.

## HANDOFF AL DIRECTOR

El código es seguro de fusionar antes de aplicar la 0518. Lo único alcanzable desde rutas es el bloqueo de `[VERIFICAR]` en `publishPost`, sin dependencia de la base; el gate de símbolos da 0 rojos. La 0518 se aplica con OK nominal y el paquete de arriba. La segunda PR engancha la vía automática.
