# L05 · contexto privado del perfil Portal (0405 / SDD-0341)

Ronda 1 — Fecha: 2026-09-11. Owner: `c-l05-worker-20260911-claude`.
Ronda 2 — Fecha: 2026-09-12. Owner / sesión escritora: `worker-c-l05-r2-2026-09-12`
(Worker Claude asignado por el Director). Estado de tarea: **preparada, sin publicar**
(esperando el SHA del Director; van #76 y #83 antes). 0405 **ya está aplicada en producción**,
así que el bloqueo migrate-first de la ronda 1 dejó de aplicar.
Task ID: `c-l05-portal-perfil-privado`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l05-portal-perfil-privado`.
Rama: `codex/c-l05-portal-perfil-privado`. Base de la ronda 1:
`3c6107012f754953323202a7386b3e7811593814`. Base de la ronda 2: `origin/main` en
`f93c0f2c` (merge de la PR #77), traído en el merge `c879e381`.
Origen congelado de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (head de PR #21).
SDD: `docs/specs/0341-perfil-privado-portal-por-principal/spec.md` (importada; `status: done` histórico).

## OBJETIVO ORIGINAL

Preparar el lote L05 del bloque C como PR draft contra main: migración 0405, su contrato
SQL, la spec 0341, el helper `lib/portal/profile-private-context.ts` y su test, y la
adopción focal del helper en `app/portal/(app)/perfil/page.tsx` sobre la versión vigente
de main. Declarar `0405_portal_perfil_privado_por_principal` pendiente. La PR se integra
SOLO DESPUÉS de aplicar 0405 en producción (migrate-first, como L16).

**Ronda 2 (2026-09-12):** actualizar la PR #75 tras la aplicación de 0405 en producción.
Merge de main con el driver de main, retirar la espera del baseline y la declaración del
símbolo, pasar la nota de la spec a «aplicada en producción», regenerar el índice, barrer
texto rancio (incluido el cuerpo de la PR), revalidar y dejar todo commiteado **sin push**
hasta que el Director dé el SHA.

## COMPLETADO

### Ronda 1 — importación migrate-first (2026-09-11)

Lo de esta subsección es **evidencia fechada de la ronda 1**, no el estado actual: cuando dice
«espera declarada», «1 AMARILLO» o «416 specs» describe cómo quedó el 2026-09-11. El estado
vigente está en «Ronda 2», más abajo.

- Aislamiento: rama/base asignadas, árbol limpio al inicio, `guard` y `claim` PASÓ;
  guard `--owner` y rama revalidados antes de cada commit y del push.
- SQL 0405 y contrato importados idénticos por blob. Spec 0341 importada exacta con una
  nota de importación fechada bajo el título (forma de 0363): pendiente, migrate-first y
  alcance del corte. Al retirar sólo la nota, el blob vuelve a `37e399f8…`.
- Helper y test importados con **una línea adaptada cada uno** (justificación abajo).
- Adopción focal en `perfil/page.tsx`: imports y bloque de datos. El `return (...)` JSX
  es idéntico byte a byte a main. Se conservan el principal L18, el snapshot de
  solicitudes, el cupo 0445–0447 (`getPortalProfileEditQuota`, `quota=`), la compuerta de
  identidad `hasExistingPhoto` de SDD-0439, direcciones y el resto de lecturas.
- Baseline: sólo la espera nueva `0405_portal_perfil_privado_por_principal`, con el formato
  vigente. Comparación estructural: cutoff 238 y las esperas 0409/0418/0419/0430 intactas.
- Declaración del símbolo pendiente según su `$doc` y el patrón L16: anclada a la llamada y
  a los fragmentos de degradación. Resultado 0 ROJO · 1 AMARILLO; el check no se silenció.
- Índice regenerado con `corepack pnpm docs:index` (416 specs).
- Test nuevo de adopción de la página, con la RPC presente y ausente.
- Rama publicada a sí misma y PR draft #75 con título `[NO FUSIONAR ANTES DE APLICAR 0405] …`.

### Identidad por blob

| Artefacto | Blob origen | Blob final | Nota |
|---|---|---|---|
| `supabase/migrations/0405_portal_perfil_privado_por_principal.sql` | `06fb2e2c…` | `06fb2e2c…` | Idéntico, 1617 B. |
| `supabase/tests/0405_portal_perfil_privado_por_principal.test.sql` | `691833d2…` | `691833d2…` | Idéntico, 5435 B. |
| `docs/specs/0341-perfil-privado-portal-por-principal/spec.md` | `37e399f8…` | `3445e14d…` | Nota de 13 líneas; sin ella, blob `37e399f8…` byte a byte. |
| `lib/portal/profile-private-context.ts` | `776e4121…` | `da758998…` | Línea 55 adaptada. |
| `lib/portal/__tests__/profile-private-context.test.ts` | `ea90d0cc…` | `e00b9eca…` | Línea 51 adaptada. |

Recibo fuera de Git: `blob-identity.json` en la carpeta de evidencia (abajo).

### Adaptación mínima del origen, línea a línea

| Archivo:línea | Origen → final | Por qué |
|---|---|---|
| `lib/portal/profile-private-context.ts:55` | `createSignedUrl(cedulaPath, 3600)` → `createSignedUrl(cedulaPath, 60)` | Compila contra main, pero con 3600 s rompería el contrato vigente de SDD-0439: «URL firmada de 60 segundos» (`docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md:119`), documentado en `CedulaPhotoRow.tsx:16` y aplicado en main (`page.tsx` base:121, commit `82fc49ff`). El origen se escribió sobre la base común `2a2e81bf`, que firmaba ambas fotos a 3600 s. El avatar sigue en 3600 s, igual que main. |
| `lib/portal/__tests__/profile-private-context.test.ts:51` | `3600,` → `60,` | Misma expectativa exacta para la cédula; no se debilita ninguna aserción. |

No hizo falta adaptar nada para compilar: `PHOTO_BUCKET`, `createAdminClient` y el alias
`server-only` existen en main. La salida del helper queda exactamente como la define la
spec 0341 (decisión 6: sólo códigos y URLs firmadas, nunca paths).

### Diff focal de `app/portal/(app)/perfil/page.tsx` (base → HEAD, 510 → 468 líneas)

- Imports: salen `createAdminClient` (`@/lib/db/admin`) y `PHOTO_BUCKET`; entra
  `getPortalPrivateProfileContext` en la línea 4, como en el manifiesto (`:4,72`). La
  llamada queda en la línea 81 (72 en #21) porque main conserva el import del cupo y el
  comentario del bloque.
- Bloque de datos (base 74–127 → HEAD 73–85): las dos lecturas `service_role`
  (`client_markbox_history` y `clients` + firma) se sustituyen por
  `const { previousMarkboxes: codigosAnteriores, avatarUrl, cedulaUrl } = await getPortalPrivateProfileContext(supabase);` (líneas 80–81).
- `const hasCedulaPhoto = completeness.hasPhoto;` (línea 85). En main salía de la misma
  lectura admin del path; el helper no expone paths, así que la existencia persistida se
  toma de la lectura de sesión que la página ya hacía (`getProfileCompleteness`,
  `lib/portal/portal-queries.ts:596-633`, misma columna `cedula_photo_path`) y que ya
  gobierna el aviso «1 pendiente». No añade lecturas.
- Nada más cambia: el snapshot de solicitudes con principal L18, el cupo, direcciones,
  tarifas y todo el JSX desde `return (` hasta EOF quedan idénticos (base línea 157 → HEAD
  115; recibo `jsx-identity.json`). Recibo del diff: `page-focal.diff`.

### Comportamiento con la RPC presente y ausente

| Elemento | main (antes) | L05 con 0405 | L05 sin 0405 (EMPTY) |
|---|---|---|---|
| Códigos anteriores | admin lee `client_markbox_history` por `client.id`, `retired_at desc` | RPC: mismos códigos y orden, filtrados además por tenant | ocultos (lista vacía, `page.tsx:179`) |
| Avatar | admin firma `avatar_path` 3600 s | helper firma el path devuelto 3600 s | iniciales y «Subir foto de perfil» (`AvatarEditor.tsx:44,78`) |
| Cédula «Ver» | admin firma 60 s | helper firma 60 s | sin enlace; «Vista temporal no disponible» (`CedulaPhotoRow.tsx:83`) |
| Existencia de la cédula | lectura admin del path | lectura de sesión, misma columna | igual: no depende de 0405 |
| Reemplazo de la cédula | bloqueado (`actions.ts:87-89`, trigger 0447) | igual | igual |
| `service_role` | dos construcciones y lecturas de tablas en la página | ninguna en la página; el helper sólo firma Storage si hay path | ninguna |
| Identidad, cupo, solicitudes, direcciones, principal | — | sin cambio | sin cambio |

Por eso migrate-first: sin 0405 no hay error visible ni crash, pero desaparecen fotos e
historial del perfil. La degradación está declarada en
`supabase/pending-migration-symbol-declarations.json` (id
`l05-portal-profile-private-context-pending-rpc`). El test
`app/portal/(app)/perfil/page.private-context.test.tsx` ejercita la página y el helper
reales en ambos caminos.

### Storage firmado con cliente admin: no hay escalada

- El helper no recibe ids ni paths (`profile-private-context.ts:30-33`); los paths salen de
  la RPC sin parámetros, que deriva cliente y tenant de `auth.uid()`, exige vínculo activo,
  tenant coherente y cliente vivo (`0405:14-24`) y filtra el historial por cliente y tenant
  (`0405:26-31`). `SECURITY DEFINER` con `search_path = ''` (`0405:11-12`); `EXECUTE` sólo
  `authenticated` (`0405:42-45`).
- El cliente elevado se construye sólo si hay al menos un path (`:44-49`) y sólo para
  `storage.from(PHOTO_BUCKET).createSignedUrl` (`:49-57`); no lee tablas. Ante fallo de
  Storage conserva los códigos y no emite URLs (`:63-65`).
- La página recibe códigos y URLs, nunca paths (`:58-62`). El test de página verifica que
  sólo se firman los dos paths devueltos, con 3600/60 s, y que el admin no toca tablas.
- La RPC usa `limit 1` sin orden (`0405:23`): con dos vínculos activos del mismo usuario
  elegiría uno. La página no llega a llamarla, porque el principal L18 rechaza la
  multiplicidad (`page.tsx:49-50`; `portal-profile-scope.test.ts:116-123`). No es escalada:
  ambos vínculos serían del mismo usuario autenticado.

### Revisión `revisar-datos-ve` (focal, sin asesoría legal)

Alcance: contexto privado del perfil, fotos en Storage firmado e historial de Shipping
Marks. La tarea no captura, escribe, borra ni cambia la conservación de datos (spec
0341:52); cambia por dónde se leen. Marcos: CRBV arts. 28 y 60 y SC 332/2001 (finalidad,
temporalidad); PIPL sólo por el acceso del equipo en China, que este cambio no altera.

Inventario:

| Dato | Qué es | Finalidad declarada | Base de licitud | Conservación | Quién lo ve |
|---|---|---|---|---|---|
| `clients.cedula_photo_path` + objeto `client-docs` | Foto de cédula/RIF (sensible; puede incluir rostro) | Verificar identidad antes de la primera carga (`CedulaPhotoRow.tsx:123-126`) | NO VERIFICABLE: el registro remite a una directiva propuesta (`registro-tratamiento.md:60`; `fotos-identidad-cliente-v1.md:4`) | Propuesta no activa (`registro-tratamiento.md:60`) | Titular vía URL de 60 s (`profile-private-context.ts:55`); equipo Studio |
| `clients.avatar_path` + objeto `client-docs` | Foto de perfil cosmética (puede mostrar rostro) | Avatar cosmético (`page.tsx:73-74`) | NO VERIFICABLE | El reemplazo borra el anterior best-effort (`avatar-actions.ts:79-82`) | Titular vía URL de 3600 s (`profile-private-context.ts:52`); equipo |
| `client_markbox_history.markbox` (+ `client_id`, `tenant_id`, `retired_at`) | Shipping Marks anteriores (identificador operativo) | Saber que cajas con el código viejo llegan igual (`page.tsx:78-79`) | NO VERIFICABLE | Finalidad no evidente en el código | Equipo del tenant por RLS (`0367:59-71`); titular por la RPC (`0405:26-31`) |
| URL firmada | Credencial temporal del objeto | Mostrar la foto al titular | Derivada | No persiste; 60 s / 3600 s | Quien tenga la URL durante el TTL; enlace de cédula con `rel="noopener noreferrer"` (`CedulaPhotoRow.tsx:76`) |

Resultados:

- CORRECTO — lectura por principal y tenant: la RPC sustituye las lecturas `service_role`
  de la página (`0405:14-31`); contrato con tenant B, vínculo revocado y cliente eliminado
  (`0405_…test.sql:92-135`), ejecutado en `sql-tests`.
- CORRECTO — minimización hacia la página: sólo códigos y URLs, nunca paths
  (`profile-private-context.ts:58-62`); elevación sólo para Storage y sólo con path (`:44-57`).
- CORRECTO — la URL de la cédula conserva 60 s (`:55`), igual que main y SDD-0439.
- CORRECTO — la compuerta de identidad no depende de la firma ni de la RPC (`page.tsx:85`);
  el reemplazo sigue bloqueado antes de subir (`actions.ts:87-89`) y en base (`0447:36-40`).
- ENCONTRADO (preexistente, fuera de alcance) — la foto de perfil (`clients.avatar_path`)
  y `client_markbox_history` no figuran en `docs/legal/privacidad/registro-tratamiento.md`
  (búsqueda de «avatar» y «markbox» sin coincidencias ahí). Arreglo: añadir filas con
  finalidad, opcionalidad y conservación.
- ENCONTRADO (excepción acotada heredada de SDD-0341) — `lib/db/admin.ts:10-11` pide no usar
  `service_role` desde páginas. L05 lo retira de la página, pero el helper que ésta invoca
  sigue construyéndolo para firmar (`profile-private-context.ts:49`), como fija la spec
  0341 (decisión 5).
- NO VERIFICABLE — base de licitud de ambas fotos; comportamiento real de 0405 en
  producción (no aplicada ni consultada); acceso desde China a `client-docs` vía Studio
  (sin cambio aquí); retención de URLs firmadas en logs de terceros.
- Paso 3 (verificación contra datos): sólo contrato SQL con datos ficticios en Postgres
  desechable; no se tocó producción.

Fuera de alcance, para abogado: base de licitud, redacción de política y contratos con
proveedores. Esta revisión no es asesoría legal; conviene una segunda opinión de otro modelo.

### Gobernanza

- Cumplimiento SGE-00 / aislamiento: identidad y tenant se fijan en la base (RPC) y en el
  principal L18; tests negativos de tenant, revocado y eliminado.
- Cumplimiento ERR-01: sin principal o ante fallo no se emiten URLs; la fila de cédula ya
  distingue fallo de firma de ausencia de documento (`ProfileEditControls.test.tsx:76-97`).
- No aplica captura, escritura, borrado ni cambio visual (spec 0341:52): el JSX es idéntico.
- Excepción documental: la nota rompe sólo el blob final de la spec; contenido fuente
  íntegro al retirarla. Excepción de adaptación: TTL de la cédula justificado arriba.

### Ronda 2 — 0405 aplicada en producción

Evidencia de la aplicación, entregada por el Director (no consultada acá): ledger
`20260912022835`, md5 del payload `60c500b5bf20603d28be7aa56f28ed64`, 1617 bytes, idénticos
al archivo de esta rama. Autorizada por Sam nombrando la migración.

- **Aislamiento revalidado antes de editar**: raíz `…/DTD-worktrees/c-l05-portal-perfil-privado`,
  rama `codex/c-l05-portal-perfil-privado`, head `b7e53696` (el revisado por el Director),
  árbol limpio. `guard` PASÓ; `claim --owner worker-c-l05-r2-2026-09-12` adquirido. No se
  tocó ningún otro worktree ni rama.
- **Merge de main con el driver de main**, en su propio commit (`c879e381`), separado de la
  retirada de la espera. Sin conflictos. El override no es ritual: `merge.dtd-generated-records.driver`
  está configurado como `node scripts/merge-generated-records.mjs %O %A %B %P`, una ruta
  **relativa al árbol de la rama**, así que git habría corrido el driver viejo de acá.
  Se corrió el de `origin/main`, volcado a `$TEMP/dtd-merge-driver-main.mjs`
  (md5 `b4563696716d6893d48e619ec0e9eca4`, igual al blob de main).
- **Medición del driver viejo con blobs** (base = `merge-base` `3c610701`; %A = `b7e53696`;
  %B = `origin/main`). El driver viejo de esta rama **habría resucitado 4 esperas**
  que main ya había retirado:

  | Clave de `pendingBelowCutoff` | Base | main (%B) | Rama (%A) | Driver viejo | Driver de main |
  |---|---|---|---|---|---|
  | `0409_bank_reconciliation_rbac` | presente | retirada | presente, igual a la base | **resucitada** | retirada |
  | `0418_portal_academia_tenant_boundary` | presente | retirada | presente, igual a la base | **resucitada** | retirada |
  | `0419_portal_reclamos_tenant_boundary` | presente | retirada | presente, igual a la base | **resucitada** | retirada |
  | `0430_portal_profile_change_requests_principal_tenant` | presente | retirada | presente, igual a la base | **resucitada** | retirada |
  | `0405_portal_perfil_privado_por_principal` | ausente | ausente | agregada por la rama | conservada | conservada |

  Corrido de verdad sobre los tres blobs: el driver viejo deja **5 claves**, el de main deja
  **1** (la propia, que esta ronda retira). La causa está en el bloque que el arreglo de main
  reemplazó: el viejo hacía `result[key] = present` cuando un solo lado borraba la clave, de
  modo que un retiro unilateral perdía contra la conservación. El de main resuelve el retiro
  como tres-vías por clave.
- **Retirada de la espera y de la declaración** (`cca49664`). Los dos registros quedan
  idénticos a main:
  - `supabase/migrations-baseline.json`: `cutoff` 238, `pendingBelowCutoff` en `{}`.
    `git diff origin/main -- supabase/migrations-baseline.json` **VACÍO**.
  - `supabase/pending-migration-symbol-declarations.json`: `degradations` en `[]`.
    `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` **VACÍO**.
  - No se tocó ninguna otra espera ni el cutoff.
- **Auditoría del camino degradado (pedida explícitamente).** La declaración retirada anclaba
  su evidencia principal en `lib/portal/profile-private-context.ts:34`, `if (error) return EMPTY;`.
  Eso **no es un guardia de «RPC inexistente»**: el helper no inspecciona `error.code`, no
  menciona `PGRST202` ni `42883` ni «does not exist» en ninguna línea (verificado por grep
  sobre todos los archivos del diff). Es un **manejo genérico de error de PostgREST**, y sigue
  vivo y necesario porque sigue alcanzable con 0405 aplicada: rechazo de RLS, sesión sin
  vínculo Portal activo, y fallos transitorios de red o de PostgREST. Igual `if (!row) return EMPTY;`,
  que absorbe el fallo cerrado de la propia RPC. **No quedó código muerto y no se borró nada.**
  Los otros sitios que citaba la declaración (`CedulaPhotoRow.tsx:83`, `actions.ts:88`,
  `AvatarEditor.tsx:44`) son **preexistentes en main**, están fuera de este diff y siguen
  correctos: describen la degradación por *firma ausente*, que puede pasar igual con la RPC
  viva.
- **Nota de importación de la spec 0341** reescrita a «**fue APLICADA a producción el
  2026-09-12**», con ledger `20260912022835`, md5 y bytes, en el formato ya integrado en main
  (`docs/specs/0339-referidos-portal-por-principal/spec.md` y
  `docs/specs/0342-documentos-portal-por-principal/spec.md`). Se conservó el párrafo del corte
  focal L05 y el del TTL de 60 s de SDD-0439. El frontmatter no se tocó, igual que en 0339/0342.
- **Índice regenerado con el script** (`corepack pnpm run docs:index`): **432 specs**, 25 huecos.
  El número se **midió**, no se asumió: `docs:check` ya daba «índice sincronizado con 432
  specs» tras el merge, y regenerar no produjo ningún cambio (idempotente). Diff contra main:
  431 → 432, se agrega la fila de 0341 y 0341 sale de la lista de huecos. Cuadra.
- **Barrido de texto rancio** (`86d65ae5`), en su propio commit. Único hallazgo real en código:
  el docstring de `app/portal/(app)/perfil/page.private-context.test.tsx` decía «sin ella
  (PGRST202) el perfil degrada a vacío», escenario imposible ya en producción. Ahora describe
  el guardia genérico, con `PGRST202` como error concreto del fixture. **Sin tocar aserciones
  ni nombres de test**, por instrucción del encargo.
  - Revisados y **conservados a propósito**: el nombre del test en la línea 142 («sin la RPC
    0405…») y su fixture `code: "PGRST202"` (son nombre y aserción); la aserción SQL
    `'TEST 0405: la RPC no existe'` (`supabase/tests/0405_…test.sql:68`); los «pendiente» de
    `perfil/page.tsx:61/84/277`, que son el aviso de solicitudes de SDD-0151 y no tienen
    relación con migraciones; y las filas de `docs/specs/README.md` de otras specs.
  - **El cuerpo de la PR era el registro más rancio**, tal como avisó el Director: abría con
    «NO FUSIONAR ANTES DE APLICAR 0405», tenía una sección «Orden obligatorio (migrate-first)»
    con seis pasos por hacer que ya están hechos, declaraba el baseline con la espera y el
    archivo de declaraciones con la declaración, decía «416 specs» y traía una columna
    «L05 sin 0405». Reescrito íntegro. **El Director lo aprobó expresamente y aclaró que no
    excede el punto 6: es aplicarlo donde más se ve**, porque es lo primero que lee cualquiera
    que abra la PR, y ya lo había aprobado en dos casos iguales de este lote. Se conservó todo lo
    que sigue siendo cierto: la justificación del TTL, el diff focal, la revisión de datos y el
    fuera de alcance. El cuerpo viejo quedó íntegro fuera de Git en `pr75-body-viejo.md` y el
    nuevo en `pr75-body-nuevo.md` (ruta en VALIDACIÓN). El cuerpo nuevo se aplica **en el mismo
    acto del push**, no después.
- **La migración no se tocó.** `supabase/migrations/0405_portal_perfil_privado_por_principal.sql`
  conserva md5 `60c500b5bf20603d28be7aa56f28ed64`, 1617 bytes y blob `06fb2e2c…`, verificado
  antes y después del merge. El encabezado «NO aplicar a Producción desde esta rama. Requiere
  autorización específica.» **no es texto rancio**: enuncia una regla permanente del repo, no
  un estado de esta migración, y por eso se conserva tal cual (misma decisión que el Director
  ya tomó para 0403).

### Segundo merge, al llegar el turno (main `147f9561`)

El Director dio el turno tras fusionar #83. main quedó en
`147f9561db182609c994626eca4429775d31fcfb`, con 433 specs.

- **Merge con el override, otra vez obligatorio** (`753c5029`). Se volvió a comprobar que
  `git config --get merge.dtd-generated-records.driver` sigue devolviendo
  `node scripts/merge-generated-records.mjs %O %A %B %P`, ruta relativa al árbol de **esta**
  rama: sin el override git habría corrido de nuevo el driver viejo. Se usó el de main
  (md5 `b4563696716d6893d48e619ec0e9eca4`). Sin conflictos.
- **El merge no pisó código ajeno, comprobado por diferencia de árboles.** `git diff --name-only origin/main HEAD`
  devuelve **exactamente los 9 archivos de esta rama** y ninguno más. Los dos archivos que el
  Director marcó como riesgo por venir de #76 y #83 quedaron **byte a byte iguales a main**:
  `app/portal/(app)/page.tsx` y `lib/portal/portal-queries.ts`.
- **El aviso sobre `app/portal/(app)/page.tsx` no aplica a esta rama, y se verificó en vez de
  suponerlo:** esta PR toca `app/portal/(app)/perfil/page.tsx` —la página de Perfil—, no la
  home del Portal. Son archivos distintos. El único solape real con lo que main cambió desde la
  base era `docs/specs/README.md`, que resuelve el driver.
- **Compatibilidad con lo que trajo el merge:** main modificó `lib/portal/portal-queries.ts`,
  del que Perfil importa `getPortalClientPrincipal` y `getProfileCompleteness`. El cambio de main
  no alteró ninguna firma exportada (`git diff` sobre las líneas `export` no devuelve nada), así
  que la adopción de Perfil no se ve afectada. Lo confirma además `typecheck` en la revalidación.
- **Índice: 434 specs, medido, no asumido.** `docs:check` dio «índice sincronizado con 434
  specs» y regenerar con el script no produjo ningún cambio. Contra main: 433 → 434, entra la
  fila 0341 y 0341 sale de la lista de huecos. Coincide con lo que anticipó el Director.
- **Los dos registros generados siguen idénticos al main nuevo**, comprobado leyendo el blob de
  main y comparando md5, no sólo con `git diff`:
  `supabase/migrations-baseline.json` → `59b976cfd391f9431e23f11e41a04046` en ambos lados;
  `supabase/pending-migration-symbol-declarations.json` → `d2ff7560a84064be086a7dd96efb62c5` en
  ambos. `cutoff` 238, `pendingBelowCutoff` `{}`, `degradations` `[]`.
- **La migración sigue intacta**: md5 `60c500b5bf20603d28be7aa56f28ed64`, 1617 bytes.

#### Revalidación sobre el segundo merge

`corepack pnpm run verify`, log en `verify-r3.log`. Veredicto literal, **no** se presenta como
verde: `16 de 17 pasos corrieron de verdad` · `[FAIL] verify: 1 fallo(s) → e2e
[COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)]
CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.`

| Comprobación | Resultado |
|---|---|
| harness | PASÓ |
| lint | PASÓ: 0 errores; 8 avisos en archivos ajenos intactos |
| rsc-boundary | PASÓ: 1599 módulos escaneados en `app`, `lib` |
| typecheck | PASÓ — cubre que la adopción de Perfil sigue compilando contra el `portal-queries.ts` que trajo main |
| edge-functions | PASÓ, 4 funciones compilan |
| test (Vitest) | PASÓ, **543 archivos / 6780 tests** (subió desde 541/6765 por lo que trajo el merge) |
| docs:check | PASÓ, **434 specs** |
| numbering | PASÓ: 434 specs · 435 migraciones, sin números repetidos |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ, CMP-01 válido |
| governance:check | PASÓ, 28 políticas aprobadas · cápsula vigente |
| pending-migration-symbols | PASÓ: **0 ROJO · 0 AMARILLO** |
| sql-tests | PASÓ, **178** contratos en contenedor efímero, incluido el de 0405 |
| schema-rebuild | PASÓ: 435 migraciones, 417 desde cero, 18 sólo-ledger, aislamiento de 219 tablas + 2 tenants |
| build | PASÓ |
| `migrations-applied` | **NO DISPONIBLE**: `[SKIP]` sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Sigue sin haber `.env.local` y no se copiaron secretos |
| `e2e` | **NO DISPONIBLE**: se colgó. Ver abajo |

**`e2e`: NO DISPONIBLE, y el cuelgue fue en un punto nuevo.** Por instrucción del Director no se
diagnostica; se registra y se sigue. Esta vez **no hubo primera pasada completa ni reintento**:
una sola `Running 186 tests using 8 workers`, 105 casos emitidos en verde, y el último fue
`[mobile-safari] attachments-gastos-pilot.spec.ts:20` (índice 138). A los 10 minutos sin salida
lo cortó el watchdog **SDD-0454**: raíz PID 35336, 29 procesos del propio árbol terminados
(`chrome-headless-shell.exe`×18, `node.exe`×10, `cmd.exe`×1), 0 sobrevivientes.

Los tres puntos de cuelgue medidos hasta ahora, que ya no son dos:

| Corrida | Pasada | Último caso emitido |
|---|---|---|
| PR #76 | primera | `[mobile-safari] auth.spec.ts:74` |
| L05 ronda 2 (main `f93c0f2c`) | **reintento** (la primera cerró 153/15/18) | 123 casos |
| L05 segundo merge (main `147f9561`) | primera | `[mobile-safari] attachments-gastos-pilot.spec.ts:20`, 105 casos |

Tres puntos distintos, ninguno estable, así que **el cuelgue no está atado a un test**. Se avisó
al Director por ser un punto nuevo. No se reintentó a mano, no se tocó la configuración y no se
absuelve el paso: los 15 fallos ambientales de siempre ni siquiera llegaron a reportarse esta vez.

## VALIDACIÓN

### Ronda 1 (2026-09-11) — evidencia fechada

Producto validado en el commit `8080168c` (árbol = base + corte L05), Node/pnpm de
Corepack. Evidencia fuera de Git en
`C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\454d97be-b1e0-4fc9-97e9-c6bb621ba84c\scratchpad\c-l05-portal-perfil-privado\`
(`verify.log`, `blob-identity.json`, `page-focal.diff`, `jsx-identity.json`,
`schema-rebuild.log`, `vitest-*.log`, `pending-symbols-*.log`, `typecheck.log`, `eslint-focal.log`).

| Comprobación | Resultado |
|---|---|
| `harness-worktree guard` / `claim` / `guard --owner` | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ (pnpm 12.3.4; lockfile intacto) |
| Blobs con `git hash-object` + comparación byte a byte | PASÓ (tabla de identidad) |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ (`dtd-generated-records`) |
| `corepack pnpm sdd:check` | PASÓ; sólo colisiones históricas ya declaradas |
| `corepack pnpm docs:index` / `docs:check` | PASÓ, 416 specs |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: 421 archivos, 403 migraciones desde cero (incluye 0405), 18 sólo-ledger, barrido multi-tenant de 219 tablas |
| `node scripts/check-pending-migration-symbols.mjs` | Antes de declarar: 1 ROJO (`profile-private-context.ts:33`), exit 1. Después: 0 ROJO · 1 AMARILLO, exit 0 |
| Vitest focal, primer intento en paralelo | FALLÓ por infraestructura: 7 de 8 workers no arrancaron (`Timeout waiting for worker to respond`) con `tsc` en paralelo; ninguna aserción falló y el único archivo ejecutado pasó |
| Vitest focal, 8 archivos en serie | PASÓ, 77 tests: helper, página nueva, `ProfileEditControls`, `PortalAddresses`, `address-actions.delete`, `portal-profile-scope`, `profile-edit-quota`, `account` |
| `corepack pnpm typecheck` | PASÓ |
| ESLint focal (4 archivos TS/TSX) | PASÓ, 0 avisos |
| `git diff --check` y allowlist | PASÓ: 11 rutas exactas (10 en el commit de producto + este handoff) |
| `corepack pnpm verify` | FALLÓ, exit 1: 16 de 17 pasos ejecutados, 15 PASÓ; e2e FALLÓ por configuración Supabase ausente; `migrations-applied` NO DISPONIBLE. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se presenta como verde |
| `/ui-check` | NO EJECUTADO: no disponible para el Worker; lo corre el Director. JSX sin cambios (resumen abajo) |
| E2E autenticado / `migrations-applied` | NO DISPONIBLE: sin credenciales Supabase; no se copiaron secretos |
| CI alojado del SHA final | Se consulta tras publicar este documento; su resultado va en la PR #75 y en la respuesta al Director, para no crear un commit recursivo |

Detalle del gate canónico `corepack pnpm verify` sobre `8080168c` (log `verify.log`):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18/18 |
| lint | PASÓ: 0 errores; 8 avisos en 4 archivos ajenos intactos (`app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx`, `app/portal/(app)/compras/nueva/PurchaseStepDetalle.test.tsx`, `app/studio/(app)/crm/_components/KommoBoardView.tsx`, `app/studio/(app)/crm/_components/KommoClient.tsx`) |
| rsc-boundary | PASÓ |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan |
| test | PASÓ, 528 archivos / 6691 tests |
| docs:check | PASÓ, 416 specs |
| numbering | PASÓ; colisiones históricas ya declaradas |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se consultó el ledger real |
| pending-migration-symbols | PASÓ con 0 ROJO · 1 AMARILLO declarado (0405) |
| sql-tests | PASÓ, 163 contratos con rollback total, incluido `0405_portal_perfil_privado_por_principal.test.sql` |
| schema-rebuild | PASÓ: 421 archivos, 403 desde cero, 18 sólo-ledger, aislamiento de 219 tablas |
| e2e | FALLÓ por entorno (exit 1), servidor de desarrollo propio en el puerto 3441. Los 15 casos son los ambientales conocidos de L16/L18: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, con `proxy.ts:67` creando Supabase sin URL/clave. Primera pasada: 151 PASÓ / 15 FALLÓ / 2 flaky / 18 omitidos (5,4 min). Reintento automático del propio gate (no manual): 153 PASÓ / 15 FALLÓ / 18 omitidos (9,4 min). Al cerrar, Playwright forzó `worker-45` tras 300000 ms. No se reintentó a mano ni se tocó configuración |
| build | PASÓ: build de producción completo; el runner restauró `tsconfig.json` (Next le inyectó `distDir`). Árbol limpio al terminar y sin contenedores efímeros propios |

### Ronda 2 — revalidación

`corepack pnpm run verify` sobre el árbol de la ronda 2 (merge + retirada + barrido). Log
completo fuera de Git en
`C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\454d97be-b1e0-4fc9-97e9-c6bb621ba84c\scratchpad\`
(`verify.log`, `pr75-body-viejo.md`, `pr75-body-nuevo.md`, `blobs/`, `driver-old-branch.mjs`,
`driver-new-main.mjs`).

Veredicto literal, que **no se presenta como verde**:

```
16 de 17 pasos corrieron de verdad
[AVISO] omitido: migrations-applied — no se midio (ver su [SKIP] arriba)
[FAIL] verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: sin salida durante 10 min; límite de
inactividad 10 min (VERIFY_E2E_IDLE_MIN)] CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR:
migrations-applied.
```

| Comprobación | Resultado |
|---|---|
| guard / claim / raíz y rama verificadas antes de editar y antes de cada commit | PASÓ |
| Merge de `origin/main` con el driver de main, sin conflictos | PASÓ |
| Medición del driver viejo con blobs (4 esperas que habría resucitado) | PASÓ: 5 claves con el viejo, 1 con el de main |
| `git diff origin/main -- supabase/migrations-baseline.json` | PASÓ: **VACÍO** |
| `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` | PASÓ: **VACÍO** |
| md5 y bytes de `0405_portal_perfil_privado_por_principal.sql` | PASÓ: `60c500b5bf20603d28be7aa56f28ed64`, 1617 B, blob `06fb2e2c…`; sin cambios antes ni después del merge |
| `git diff --check` | PASÓ |
| harness | PASÓ, 35 pruebas |
| lint | PASÓ: 0 errores; 6 avisos en archivos ajenos intactos |
| rsc-boundary | PASÓ |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan |
| test (Vitest) | PASÓ, 541 archivos / 6765 tests |
| docs:check | PASÓ, índice sincronizado con **432 specs** |
| numbering | PASÓ: 432 specs · 433 migraciones, sin números repetidos; colisiones históricas ya declaradas |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ, 28 políticas aprobadas · cápsula vigente |
| pending-migration-symbols | PASÓ: **0 ROJO · 0 AMARILLO** (la declaración retirada ya no hace falta y una sobreviviente sería excepción vencida) |
| sql-tests | PASÓ, **176** contratos en contenedor efímero, incluido `0405_portal_perfil_privado_por_principal.test.sql` |
| schema-rebuild | PASÓ: 433 migraciones, 415 desde cero, 18 sólo-ledger, aislamiento multi-tenant de 219 tablas + 2 tenants reales |
| build | PASÓ: build de producción OK; el runner restauró `tsconfig.json` |
| `migrations-applied` | **NO DISPONIBLE**: `[SKIP]` por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. No hay `.env.local` en esta máquina (comprobado en el worktree y en el checkout principal) y **no se copiaron secretos**. Crítico sin medir: la prueba de que 0405 está aplicada es la del Director, no una consulta hecha acá |
| `e2e` | **NO DISPONIBLE por configuración ausente**, y además con un cierre anómalo. Detalle abajo |
| `/ui-check` | NO EJECUTADO: lo corre el Director; el JSX no cambió en ninguna de las dos rondas |
| CI alojado del head de la ronda 2 | NO EJECUTADO: sólo existe después de publicar |

**`e2e` en detalle.** Servidor de desarrollo propio en el puerto 3441, 186 tests, 8 workers.
Primera pasada: **153 PASÓ / 15 FALLÓ / 18 omitidos** (5,3 min). Los 15 son exactamente los
ambientales conocidos, todos por `proxy.ts:67` creando el cliente Supabase sin URL ni clave:
`auth.spec.ts:21`, `:91`, `:98`, `:105` y `global-search.spec.ts:22`, en chromium,
mobile-chrome y mobile-safari. Ninguno toca `/portal/perfil` ni nada de este diff. **Los dos
flakes públicos conocidos (`calculadora-hidratacion.spec.ts:42` y `smoke.spec.ts:150`) no
aparecieron**: la primera pasada no reportó ningún flaky.

**Anomalía del reintento, que es nueva y se reporta aparte.** El reintento automático del gate
(no manual) **se colgó**: alcanzó 123 casos en verde y dejó de emitir salida durante 10
minutos, sin resumen. Lo cortó el **watchdog del paso e2e de `verify`, que es SDD-0454**
(`docs/specs/0454-verify-e2e-watchdog/spec.md`, «Watchdog del e2e de verify: un cuelgue es
FALLÓ con motivo, no una espera infinita»), y mató sólo su propio árbol de procesos: raíz PID
29364, 29 procesos terminados (`chrome-headless-shell.exe`×18, `node.exe`×10, `cmd.exe`×1),
0 sobrevivientes. Por eso el motivo final del paso es `COLGADO/TIMEOUT` y no «15 fallos
ambientales».

Cronología del watchdog, verificada por ref (**no** es SDD-0457, que es el ENOBUFS de `finish`,
el hook `Stop` y `check-unpublished`): `scripts/verify-watchdog.mjs` está **ausente** en el
merge-base `3c610701` y en el head de la ronda 1 `b7e53696`, y **presente** en `origin/main`,
donde lo agregó `4d6dac1a` — `chore(harness): SDD-0454 — watchdog del paso e2e de verify`.
O sea: ya estaba en main antes de este merge; a **esta rama** llegó con el merge `c879e381`.

No es un tercer flake de un test: es el paso entero quedándose mudo, y probablemente la misma
fragilidad de cierre que en la ronda 1 se vio como `worker-45` forzado a los 300 s, ahora sí
detectada en vez de tapada. No se reintentó a mano, no se tocó la configuración y no se absuelve
el paso.

**Segunda medición, del Worker de #76, aportada por el Director:** allá el cuelgue fue en la
**primera** pasada, después de `[mobile-safari] auth.spec.ts:74`; acá la primera pasada terminó
completa (153 / 15 / 18, con los 15 ambientales de siempre y **cero** flaky) y el que quedó mudo
fue el **reintento**, a los 123 casos. Dos puntos de cuelgue distintos con el mismo síntoma, lo
que apunta al **cierre del runner con la suite en paralelo**, no a un test concreto.

## COMMITS

- `8080168c`: `feat(studio): SDD-0341 — importar L05 contexto privado del perfil Portal
  (migrate-first)`. SQL, contrato, spec con nota, helper y test, adopción en la página,
  test de adopción, baseline, declaración e índice. Es el producto validado por `verify`.
- `b7e53696`: `docs(handoff): cerrar L05 con PR migrate-first y evidencia de validación`.
  Cierre durable de la ronda 1; sólo documentación. Es el head que revisó el Director.

Ronda 2, en unidades lógicas separadas para que el merge sea auditable:

- `c879e381`: `Merge remote-tracking branch 'origin/main' into codex/c-l05-portal-perfil-privado`.
  Sólo el merge, con el driver de main. Sin conflictos.
- `cca49664`: `feat(studio): SDD-0341 — retirar la espera de 0405, ya aplicada en producción`.
  Baseline y declaraciones idénticos a main, y nota de la spec 0341 a «aplicada en producción».
- `86d65ae5`: `docs(studio): SDD-0341 — corregir el docstring rancio del test de adopción`.
  Sólo el docstring; ni una aserción ni un nombre de test.
- Commit que contiene este documento: cierre durable de la ronda 2; sólo documentación.
  Su hash final queda en la PR.

Nunca se usó `git add -A`: cada commit se armó nombrando sus rutas. Sin reset, sin force push,
sin cambiar de rama.

## PR / BRANCH

[PR #75](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/75), base `main`, rama
`codex/c-l05-portal-perfil-privado` con upstream propio.

El Director dio el turno tras fusionar #83. Este commit es el último antes del push, y la
publicación va en **un solo acto**, en este orden:

1. Un **solo** push de la rama a sí misma.
2. Título sin el prefijo: `feat(studio): SDD-0341 — L05 contexto privado del perfil Portal
   (0405 ya aplicada)`.
3. Cuerpo reescrito (`pr75-body-nuevo.md`, ya aprobado por el Director) y paso a
   *ready for review*, en el mismo acto que el push.

El prefijo `[NO FUSIONAR ANTES DE APLICAR 0405]` se retira **al publicar, no antes**: mientras
el head remoto siga atrasado, es el único freno propio que tiene la PR. **Después del push la
rama se congela** hasta que el Director fusione: nada de empujar líneas de handoff después, que
es lo que le canceló la corrida de CI a otra PR de este lote y lo pagan las que esperan detrás.
Si aparece algo que sólo se puede saber después de publicar —el resultado del CI alojado es el
único caso legítimo— va por mensaje al Director, no por push.

Worktree y rama conservados en la ruta indicada arriba.

## PENDIENTES DE ESTA TAREA

- ~~Publicar: falta el SHA del Director~~. **Hecho**: el Director dio el turno con main en
  `147f9561`, se hizo el segundo merge con el override, se revalidó y se publicó en un solo
  push, con el título sin prefijo y el paso a ready en el mismo acto.
- **CI alojado del head de la ronda 2**: es lo que de verdad mide lo que acá quedó sin medir
  (`e2e` completo y el resto en un entorno con configuración). Sólo existe después del push.
- **`migrations-applied` sin medir** en este árbol por falta de `NEXT_PUBLIC_SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY`. No autoriza obtener ni copiar credenciales.
- **`e2e` sin cobertura real** por la misma falta de configuración, y con el reintento colgado
  (ver VALIDACIÓN). Hace falta el CI alojado o una corrida con configuración de Supabase.
- Revisión del Director y `/ui-check` (el JSX no cambió en ninguna de las dos rondas).
- Nada pendiente de implementación. Merge, deploy y cualquier toque de producción quedan fuera
  del Worker; «cerrar» esta tarea no los autoriza.

## FUERA DE ALCANCE DETECTADO

- `docs/legal/privacidad/registro-tratamiento.md` no inventaría `clients.avatar_path` ni
  `client_markbox_history`.
- `lib/db/admin.ts:10-11` desaconseja `service_role` desde páginas; en HEAD, 11 archivos
  page/layout de `app/portal/**` aún importan `createAdminClient` (por ejemplo
  `envios/page.tsx:3`, `documentos/page.tsx:3`, `facturas/[code]/aceptar/page.tsx:5`).
  Corresponden a otros lotes o helpers finales de #21 excluidos de L05.
- La RPC 0405 usa `limit 1` sin orden; es segura detrás del principal L18, pero un llamador
  futuro sin principal previo debería resolverlo antes.
- E2E sin configuración Supabase: 15 fallos ambientales conocidos, no atribuibles a L05; y
  cierre de Playwright con `worker-45` forzado a los 300000 ms (igual que en L18), sin
  diagnóstico de causa raíz.
- Ocho avisos de lint en cuatro archivos ajenos intactos (tabla de `verify`).
- Arranque de workers de Vitest frágil bajo carga en este equipo (primer intento focal).

### Detectado en la ronda 2

- **El paso `e2e` se cuelga, y no sólo falla por entorno. Ya van tres puntos distintos.**
  Ronda 2 acá: el **reintento**, mudo a los 123 casos. PR #76: la **primera** pasada, tras
  `[mobile-safari] auth.spec.ts:74`. Segundo merge acá: la **primera** pasada otra vez, pero en
  otro lugar — `[mobile-safari] attachments-gastos-pilot.spec.ts:20`, 105 casos, y esta vez sin
  llegar siquiera a reportar los 15 fallos ambientales. Las tres las cortó el watchdog
  **SDD-0454**. Tres puntos que no se repiten descartan que sea un test concreto y apuntan al
  **cierre del runner con la suite en paralelo**. Es un hallazgo distinto de los fallos
  ambientales y de los dos flakes públicos conocidos. Ajeno a este diff: merece tarea propia, con
  los tres logs como evidencia. Por instrucción del Director no se diagnosticó más allá de
  localizar el punto.
- **El driver de merge se resuelve desde el árbol de la rama**, así que cualquier rama de esta
  generación que haga `git merge origin/main` **sin** el override corre el driver viejo y
  resucita esperas ya retiradas. En esta rama habrían sido 4. No es un defecto de main —main ya
  está arreglado— sino una trampa de las ramas viejas del lote: vale dejarlo escrito donde lo
  lea el próximo, no sólo en handoffs sueltos.
- ~~Desajuste entre el nombre del test `page.private-context.test.tsx:145` («sin la RPC 0405
  degrada a vacío…») y su docstring corregido~~. **No es un hallazgo: resuelto por el Director.**
  El nombre se queda, y es fiel. Un `it()` nombra la condición que **arma**, y esta la sigue
  armando con un mock: la RPC respondiendo como ausente. Además sigue siendo un caso que hay que
  cubrir, porque puede pasar de verdad con la ACL revocada o un `DROP FUNCTION` futuro. El
  docstring era otra cosa: afirmaba algo sobre **cuándo se iba a aplicar la migración**, y eso sí
  caducó. Son dos niveles distintos, cada uno diciendo la verdad del suyo.
- **La RPC 0405 usa `limit 1` sin orden** y ya está aplicada: corregirlo pide una migración
  nueva, no un cambio en esta rama. Sigue siendo segura detrás del principal L18.
- `docs/legal/privacidad/registro-tratamiento.md` sigue sin inventariar `clients.avatar_path`
  ni `client_markbox_history` (arrastre de la ronda 1, sin cambios).

## HANDOFF AL DIRECTOR

- **El orden migrate-first ya se cumplió**, así que el bloqueo de la ronda 1 caducó: 1) la PR
  fue revisada en `b7e53696`; 2) Sam dio el OK nominal nombrando la migración; 3) se aplicó
  sola, ledger `20260912022835`; 4) el Director verificó objeto, ACL y `SECURITY DEFINER`;
  5) esta ronda retiró la espera, la declaración y actualizó la nota de la spec; 6) se
  revalidó. Queda el paso 7, que es suyo: fusionar. **Aplicar 0405 no autorizó fusionar**, y
  este handoff tampoco: merge y producción son decisiones aparte.
- **Lo que hay que hacer con esta rama, en orden y sin excepción**, cuando llegue su turno
  detrás de #76 y #83: (1) merge de main con el override del driver, (2) revalidación,
  (3) handoff y cuerpo de la PR commiteados, (4) **un solo** push, (5) título y paso a ready
  junto con ese push. Los pasos 1–3 ya están hechos sobre `f93c0f2c`. Si main avanzó desde
  entonces, hay que repetir 1–3 **con el override**, porque el driver de esta rama sigue siendo
  el viejo: sin el override resucita esperas retiradas.
- **Recordatorio del override**, por si lo corre otra sesión:
  `drv="$(cygpath -m "$TEMP")/dtd-merge-driver-main.mjs"; git show origin/main:scripts/merge-generated-records.mjs > "$drv"; git -c merge.dtd-generated-records.driver="node \"$drv\" %O %A %B %P" merge origin/main`
- Compartidos: cualquier PR del lote que toque `supabase/migrations-baseline.json`,
  `docs/specs/README.md` o `supabase/pending-migration-symbol-declarations.json` se une por
  entradas con el driver `dtd-generated-records`. Los tres archivos de esta rama quedan
  **idénticos a main**, así que ya no hay nada que unir por acá: sólo la fila 0341 del índice.
- `/ui-check` pendiente del Director. Resumen JSX: ningún nodo cambia; las props `avatarUrl`,
  `viewUrl`, `hasExistingPhoto` y la lista de códigos conservan nombres y valores cuando la RPC
  responde, y quedan vacías si falla (tabla de comportamiento).
- **Lo que no se hizo, a propósito:** sin push, sin merge a main, sin deploy, sin tocar
  producción, sin leer filas de negocio ni PII, sin copiar secretos, sin tocar la migración
  0405, sin tocar la rama de #21 ni ningún otro worktree.
- Ownership: escritura terminada con este documento. La ronda 2 corrió con
  `claim --owner worker-c-l05-r2-2026-09-12`; el claim se mantiene mientras quede el push
  pendiente y se libera con
  `node scripts/harness-worktree.mjs release --owner worker-c-l05-r2-2026-09-12` cuando la
  escritura termine de verdad. Sin subagentes ni sesiones consumidoras delegadas. Conservar
  rama y worktree.
