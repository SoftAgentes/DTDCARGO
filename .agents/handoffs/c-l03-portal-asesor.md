# L03 · Asesor del Portal por principal y tenant (RPC 0403)

Fecha: 2026-09-11; ronda 2 el 2026-09-12. Task ID: `c-l03-portal-asesor`.
Owner / sesión escritora: ronda 1 `c-l03-worker-20260911-claude` (terminada y liberada); ronda 2 `c-l03-worker-20260912-claude`, por adopción explícita del Director sobre el mismo worktree y la misma rama. Estado de tarea: lista-para-revision en PR borrador #83. **Ya no es migrate-first**: 0403 se aplicó a producción el 2026-09-12 con OK nominal de Sam (ledger `20260912022746`), así que la rama no declara ninguna espera ni ninguna degradación pendiente.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal intacto).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l03-portal-asesor`.
Rama: `codex/c-l03-portal-asesor`. Base real: `3c6107012f754953323202a7386b3e7811593814` (origin/main al crear el worktree). Main avanzó tres veces durante la tarea y se incorporó por merge, sin rebase:
- `7fb767f6`: trae `b7e8b484` (#71, registro de aplicación de 0425/0427; #79, SDD-0450, checker UTF-16). Sin conflictos.
- `94372af9`: trae `07d00097` (#69, L19, SDD-0385, 0431 pendiente). El driver `dtd-generated-records` unió baseline e índice.
- `9fdc6dd6`: trae `50100cc4902c4a2a4398327ba0de6dc30810c834` (#70, L21, SDD-0401, 0433 pendiente). También con el driver.
- `7181ff02` (ronda 2): trae `ce0239268fc5ce2fbdf5ae989efe026fc1b604d5` (#78, L04, SDD-0339, con 0404 ya aplicada; y de arrastre #82, #94 y el registro del lote). Con el driver de main por override, no con el de la rama.
Ninguno cambió las rutas de código, SQL, spec ni tests del lote.

Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (head de PR #21). Commit fuente de SDD-0338 en el origen: `121bfdc5892c917d5ae7263c1f7ec4223667de29`. Base común con main: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
SDD: `docs/specs/0338-asesor-portal-por-principal/spec.md`, importada. No se reservó número: 0338 y 0403 no existían en main. Fuera de esta rama, sólo `codex/saneamiento-integral` (head de #21) contiene 0338/0403, con los mismos blobs: es la misma spec, no una colisión.

## OBJETIVO ORIGINAL

Preparar como PR draft contra main el lote L03 del bloque C: migración 0403, su contrato SQL y la spec 0338. Adoptar `getPortalAdvisor` vía RPC en la versión vigente de `lib/portal/portal-queries.ts` y las llamadas focales de Inicio y Soporte, con el test del origen y tests mínimos de RPC presente y ausente. Declarar `0403_portal_advisor_por_principal` pendiente de aplicar. La PR se integra sólo después de aplicar 0403 en producción.

## COMPLETADO

- Aislamiento: worktree creado con `harness-worktree start` desde origin/main `3c610701`. Guard y claim PASÓ; guard `--owner` y rama revalidados antes de cada commit y de cada merge.
- Importación exacta desde `ea9952a4`, comprobada con `git hash-object` sobre los archivos del worktree:

| Artefacto | Blob del origen = importado |
|---|---|
| `supabase/migrations/0403_portal_advisor_por_principal.sql` | `dc812ba645047a3e9712e5be4b30e44a2b445f5d` (1711 B) |
| `supabase/tests/0403_portal_advisor_por_principal.test.sql` | `1cfc133cc788d2eb1510ee9bfc3992c3a5a60f09` (6495 B) |
| `lib/portal/__tests__/portal-advisor-query.test.ts` | `c2cd7c9b8ee03e0bd3414f24152af2435ab83425` (1344 B) |
| `docs/specs/0338-asesor-portal-por-principal/spec.md` sin la nota | `28d10745f044f56d9c27c147068056b6f3e0cf29` (2489 B). Blob final con la nota: `1cca9ce46d91f36f227b4cdd3f009fb11ae170d7` (3470 B). |

- Los cuatro blobs son también los de `121bfdc5`: ningún commit posterior de #21 los tocó.
- Nota de importación fechada 2026-09-11 bajo el H1, con la forma de la de 0363. Menciona MIGRATE-FIRST, el corte focal y que la meta `service_role` de la aceptación no aplica: su test de frontera no existe en main. `status: done` y el frontmatter se conservan como estado histórico del origen. Al retirar exactamente la nota se recupera `28d10745`.
- Historial de main desde la base común: `portal-queries.ts` sólo cambió en `3f03569a` (SDD-0380, cotizaciones) y `dcf99a7f` (L18, principal). Ninguno tocó `getPortalAdvisor`: por AST es igual en `2a2e81bf` y en `3c610701`. Inicio y Soporte no cambiaron en main desde la base común. La Soporte de main (`ef6101c2`) es exactamente la preimagen del hunk de `121bfdc5`.
- Actualización con main en tres merges (`7fb767f6`, `94372af9`, `9fdc6dd6`). Frente a `origin/main` `50100cc4`, la rama difiere exactamente en las 11 rutas del lote más este handoff. Código, SQL, spec, tests y declaraciones conservan los blobs de `419d7ec0`. Baseline e índice sólo suman, sobre lo de main, la entrada y la fila del lote.

### Adopción focal por ruta (líneas en `419d7ec0`, iguales en el árbol final salvo donde se indica)

| Ruta | Cambio | Evidencia |
|---|---|---|
| `lib/portal/portal-queries.ts` | `getPortalAdvisor` (JSDoc L131-141, función L142-158) toma el cuerpo del origen. Llama `db.rpc("get_portal_advisor")` sin argumentos (L145); con error devuelve null (L146); acepta fila en lista u objeto (L148); con nombre vacío devuelve null (L149-150); copia sólo cuatro campos (L152-157). | AST: 25 de 26 sentencias de nivel superior idénticas a main. La única distinta es `getPortalAdvisor`, idéntica, JSDoc incluido, a la de `ea9952a4` y `121bfdc5`. Principal de L18, cotizaciones, envíos, facturas, documentos, activación, completitud, KPIs y próximo arribo quedan intactos. |
| `app/portal/(app)/page.tsx` | Comentario y llamada del asesor (L120-123): `getPortalAdvisor(supabase).catch(() => null)` en vez de `getPortalAdvisor(createAdminClient(), client.id)`. | AST: 17 de 18 sentencias del componente idénticas; imports idénticos (`createAdminClient` sigue en uso en L64, L93, L105 y L183); `return` y JSX idénticos. El hunk queda separado de los de L02 (L23 y L60-66). |
| `app/portal/(app)/soporte/page.tsx` | Comentario del hilo (L87) y llamada (L100): `getPortalAdvisor(supabase)`. | Blob resultante `88ca9369`, el mismo de `121bfdc5`. AST: sólo cambian el `try` del asesor y el comentario del hilo. `admin` se conserva para evidencia, hilo, id de conversación y resúmenes; 5 raíces JSX idénticas. No adopta `support-private-context`. |
| `lib/portal/__tests__/portal-advisor-query.test.ts` | Test del origen, idéntico: 4 casos. | Ver tabla de blobs. |
| `lib/portal/__tests__/portal-advisor-query-rpc-states.test.ts` | Nuevo, 6 casos. RPC presente: sólo la RPC, sin argumentos ni lecturas de tablas, y sólo cuatro campos aunque la respuesta trajera ids; también fila como objeto. RPC ausente (PGRST202), sin EXECUTE (42501), respuesta vacía, y excepción del transporte que se propaga a los `catch` de las páginas. | Aceptación 7, sin tocar tests existentes. |
| `supabase/migrations-baseline.json` | Sólo la espera `0403_portal_advisor_por_principal`: L40 en `419d7ec0`; tras los merges con L19 y L21 el driver la ubica entre las esperas 0431 y 0433. | Dice «bloque C L03 / SDD-0338», MIGRATE-FIRST, OK nominal de Sam, runbook y name exacto. Frente a cada main (`3c610701`, `07d00097`, `50100cc4`), sin la entrada nueva el JSON es igual: cutoff 238, `$doc` y las demás esperas intactos, y el texto de la entrada no cambia. |
| `supabase/pending-migration-symbol-declarations.json` | Grupo `l03-portal-advisor-pending-rpc`: llamada en `portal-queries.ts:145`; evidencia en `portal-queries.ts:146`, `page.tsx:123`, `PortalAdvisorCard.tsx:64`, `soporte/page.tsx:100` y `:174`. | Conforme al `$doc` y al patrón de L16. ROJO pasa a AMARILLO declarado. |
| `docs/specs/README.md` | Regenerado con `corepack pnpm docs:index`. Tiene 416 specs en `419d7ec0`; tras los merges con L19 y L21 queda en 418, unido por el driver. | Entra la fila 0338 y sale de la lista de huecos; `docs:check` sincronizado en cada árbol. |

### Línea que reporta el checker

El checker vigente al empezar marcó ROJO en `lib/portal/portal-queries.ts:145`, que es la línea real de la llamada. Una copia fuera del repo del checker corregido por `c-fix-pending-symbols-utf16` (blob `5d0369f2`) dio el mismo resultado antes y después de la declaración. No hay discrepancia: los tres archivos de código no tienen caracteres fuera del BMP (unidades UTF-16 = code points), así que la declaración queda anclada al sitio real. Esa corrección entró en main durante la tarea (#79) y llegó a esta rama con el primer merge: el checker del árbol es ahora ese mismo blob `5d0369f2`, con 0 ROJO y 1 AMARILLO.

### Comportamiento ante fallo

| Caso | main hoy (`3c610701`) | Adoptado (`419d7ec0`) |
|---|---|---|
| Lectura | `getPortalAdvisor(admin, clientId)` con service_role: `clients` por id (L147-152), membresía activa en `user_tenants` (L159-166) y perfil (L168-172). | RPC con la sesión del cliente (L145). La base deriva la identidad de `auth.uid()` y exige vínculo activo (0403 L38-39), cliente vivo del mismo tenant (L28-31) y asesor activo en ese tenant (L32-35). |
| Error de PostgREST | `clients` con error devuelve null (L152); los fallos de membresía o perfil también terminan en null (L166, L178). Sin log. | `if (error) return null` (L146). Sin log. |
| Excepción | Inicio: `.catch(() => null)` (L123-125). Soporte: `try/catch` que deja null (L100-104). Sin log. | Igual: Inicio L123, Soporte L99-103. La función no traga excepciones; el test nuevo lo fija. |
| Sin asesor, asesor deshabilitado o sin nombre | null (L152, L166, L178). | Sin filas, null (L149-150). El contrato SQL lo prueba (L143-167). |
| Pantalla con null | Inicio: la tarjeta muestra «Equipo DTD Cargo» / «Atención al cliente» con WhatsApp y teléfono públicos (`PortalAdvisorCard.tsx:28-34`, 64, 68, 84). Soporte: «Tu equipo DTD Cargo» (L174-177) y «Otros canales» con el WhatsApp público (L314-317, L340). | Igual. |
| RPC 0403 ausente | No aplica: main no la llama. | PGRST202 en cada visita, así que null permanente. Todos los clientes pierden nombre, cargo, foto y enlace directo del asesor y ven el contacto público. La página no rompe ni inventa nombres. |
| service_role ausente o fallando | Inicio ya depende de service_role en otras lecturas; Soporte construye `admin` en L71. | El asesor deja de depender de service_role. |

Con 0403 aplicada no empeora respecto a main: mismos cuatro campos y mismas condiciones (asesor asignado, miembro activo del tenant, nombre no vacío), ahora exigidas en la base. Las condiciones extra de vínculo activo y cliente vivo ya las exigía el principal de L18 antes de llegar a la llamada (`page.tsx:44-45`, `soporte/page.tsx:60-61`). Sin 0403, sí empeora, y por eso es migrate-first. La migración es aditiva (función, comentario y ACL) y el código vigente de main no la llama: aplicarla primero no altera la operación actual. Main no registra errores en este camino y lo adoptado tampoco, así que no hay log que conservar ni log con datos personales.

### JSX, para `/ui-check`

No cambian JSX, clases, copy ni componentes. El `return` es idéntico en ambas páginas: Inicio 1 de 1 con 2 raíces JSX; Soporte 1 de 1 con 5 raíces JSX, incluidas `AsesorChatCard` y `OtrosCanalesCard`. Sólo cambia la fuente de `advisor`, con el mismo tipo `PortalAdvisor | null`; el fallback visual con null es el de main.

### Datos personales (`revisar-datos-ve`, focal)

Resumen: 5 CORRECTO, 0 ENCONTRADO, 5 NO VERIFICABLE. Titular: el asesor, empleado del tenant y usuario de Studio. Para el cliente del Portal es un tercero interno.

| Campo | Qué es | Finalidad | Base de licitud | Retención | Quién lo ve |
|---|---|---|---|---|---|
| `user_profiles.first_name`, `last_name` (0019 L64-65) | Nombre, concatenado en la RPC (0403 L23) | Identificar quién atiende al cliente (spec 0338) | NO VERIFICABLE | NO VERIFICABLE | El cliente del Portal con vínculo activo a un cliente de ese asesor, en Inicio y Soporte |
| `user_profiles.phone` (0019 L67) | Teléfono | Destino del WhatsApp directo. No se imprime como texto: va en el `href` wa.me (`portal-types.ts:145-149`, 179; `PortalAdvisorCard.tsx:32-33`; `soporte/page.tsx:317`) | NO VERIFICABLE | NO VERIFICABLE | Ese cliente, y WhatsApp si el cliente abre el enlace |
| `user_profiles.avatar_url` (0019 L66) | URL de la foto | Avatar de la tarjeta (`PortalAdvisorCard.tsx:41-48`) | NO VERIFICABLE | NO VERIFICABLE | Ese cliente, en el `src` de la imagen |
| `user_profiles.position_label` (0019 L68) | Cargo | Rol visible (`PortalAdvisorCard.tsx:68`; `soporte/page.tsx:175-177`) | NO VERIFICABLE | NO VERIFICABLE | Ese cliente |

- **CORRECTO · minimización.** La RPC devuelve sólo esos cuatro campos, sin ids ni tenant (0403 L11-16, L22-26). El contrato lo exige (test L107-111) y comprueba que `private_note` no sale (L125). La capa TS copia sólo cuatro claves (`portal-queries.ts:152-157`) y el test nuevo lo fija aunque la respuesta trajera ids.
- **CORRECTO · acceso por principal y tenant.** `auth.uid()` y vínculo activo (0403 L38-39), cliente vivo del mismo tenant (L28-31), asesor activo del mismo tenant (L32-35), EXECUTE sólo para `authenticated` (L48-51). El contrato corrió en Postgres efímero con datos ficticios y cubre otro tenant, vínculo revocado, asesor deshabilitado y cliente eliminado (L132-167). Además, 0151 L57-66 impide asignar un `advisor_id` de otro tenant.
- **CORRECTO · menos privilegio.** Inicio y Soporte dejan de leer `user_tenants`/`user_profiles` con service_role para el asesor (`page.tsx:123`, `soporte/page.tsx:100`).
- **CORRECTO · sin logs del asesor.** `getPortalAdvisor` no registra nada (`portal-queries.ts:142-158`), tampoco los `catch` de las páginas.
- **CORRECTO · sin ampliación.** Main ya mostraba los mismos cuatro campos al mismo cliente (main `portal-queries.ts:168-185`). L03 no crea un flujo de datos nuevo.
- **NO VERIFICABLE · base de licitud y aviso al empleado** de que su nombre, teléfono, foto y cargo se muestran a clientes. No está en el código; depende del contrato laboral o de la política interna.
- **NO VERIFICABLE · retención del perfil del asesor.** La RPC deja de mostrarlo al deshabilitar la membresía (0403 L35), pero la conservación de `user_profiles` no se evalúa en este lote.
- **NO VERIFICABLE · WhatsApp como tercero.** El enlace wa.me con el teléfono del asesor y el saludo con nombre y Shipping Mark del cliente (`PortalAdvisorCard.tsx:29-33`) es comportamiento previo de main, no de L03.
- **NO VERIFICABLE · PIPL.** El código no permite saber si hay tratamiento en China.
- **NO VERIFICABLE · producción.** No se leyó producción ni se ejecutó la RPC contra datos reales.

Esto no es asesoría legal. Conviene una segunda opinión de otro modelo sobre la misma superficie.

### Gobernanza proporcional

- **SGE-00.05, cumplimiento** (`sge-00.md:53`): permisos, tenant y minimización se aplican en la base, con prueba negativa de tenant ajeno, vínculo revocado, asesor deshabilitado, cliente eliminado y dato no necesario (`private_note`). Evidencia local y efímera.
- **SGE-00.12, cumplimiento:** sin merge a main, sin aplicar 0403 y sin leer producción; esas acciones quedan con autorización humana nominal.
- **ERR-01, cumplimiento del copy seguro** (`err-01.md:29-30`): el fallo degrada al contacto público sin mostrar error, SQL ni PII. La regla de observabilidad (L32) no aplica: la lectura es best-effort, tiene fallback diseñado y el fallo no es crítico. Un PGRST202 permanente sería silencioso, y eso se controla con migrate-first y con el AMARILLO que el gate imprime en cada corrida.
- **VIS-01/02, MOT-01, LOD-01, A11Y-01, CMP-01, FRM-01: no aplica.** JSX idéntico.
- **AUD-01/02, MP-01, BTN-01: no aplica.** Sin acciones ni escrituras.

## RONDA 2 — 2026-09-12 · 0403 aplicada en producción y rama al día con `main`

Adopción explícita del worktree y la rama de la ronda 1, cuya sesión terminó y liberó su claim. Antes de editar: `guard` OK, `git status --porcelain=v1` vacío, `HEAD = bb1ca3465153bc2cc0d9e83434d11f1e7b48ca2e` (el head publicado que revisó el Director) y claim nuevo `c-l03-worker-20260912-claude`. No se creó otra rama ni otro worktree, no se tocó el checkout principal ni ningún árbol ajeno, y **no se ejecutó nada contra Supabase**: la evidencia de que 0403 está aplicada la entregó el Director, no una consulta hecha aquí.

Con esto la PR #83 **deja de ser migrate-first**: no queda nada declarado como pendiente.

### Lo que cambió

- **0403 dejó de ser una espera.** `0403_portal_advisor_por_principal` se aplicó a producción el 2026-09-12 con OK nominal de Sam, ledger `20260912022746 / 0403_portal_advisor_por_principal`. El archivo de esta rama es el aplicado: `md5sum` local da `bfae7279d28a8cf28961e0783ee23f36` y 1711 B, los mismos del ledger, **antes y después del merge** (blob `dc812ba645047a3e9712e5be4b30e44a2b445f5d`, el mismo de la ronda 1: el merge no tocó un byte). Es comprobación **local sobre el archivo**, no una consulta a producción. Por eso `supabase/migrations-baseline.json` vuelve a `cutoff: 238` con `pendingBelowCutoff` vacío y `$doc` intacto.
- **Declaración de símbolos retirada.** `l03-portal-advisor-pending-rpc` sale de `supabase/pending-migration-symbol-declarations.json`, que vuelve a `degradations: []`. Los dos registros quedan **idénticos a `origin/main`**: `git diff origin/main -- <archivo>` vacío en ambos y blobs iguales a los de main (`93939af96cbe3bec89c2ab80bdb8073d8ff4fabe` y `8e52d5b3d8c5448aaa9d90fb3f8df0199097fdbe`). Ya no aparecen en el diff de la PR. El gate pasa de **1 AMARILLO declarado** a **0 ROJO · 0 AMARILLO**.
- **Nota de importación de la spec 0338** reescrita con el patrón aprobado de `docs/specs/0339-referidos-portal-por-principal/spec.md` (#78, ya en main): migración aplicada, fecha, ledger, identidad del archivo (md5 y bytes) y remisión a este handoff. Ya no anuncia espera ni bloqueo; deja dicho que el orden migrate-first **se cumplió**, porque la RPC existe en la base antes de fusionar el código que la consume. Se conserva el alcance focal del corte L03 y el **frontmatter intacto** (`status: done`, `updated: 2026-09-02`): ese `done` sigue siendo el importado de #21.
- **Un merge de `origin/main` `ce0239268fc5ce2fbdf5ae989efe026fc1b604d5`** (#78, L04 referidos), con el driver semántico **de main** y no con la copia de la rama.
- **Texto rancio corregido** en su propio commit: el docstring de `lib/portal/__tests__/portal-advisor-query-rpc-states.test.ts` presentaba los casos como «los dos caminos que deciden el orden migrate-first». Ahora describe lo que los casos fijan de verdad. **No se tocó ninguna aserción ni el nombre de ningún test**, incluidos los `describe` que nombran «RPC 0403 presente» y «RPC 0403 ausente o con error».
- **Índice de specs regenerado y medido**: 431 specs (main traía 430), 26 huecos, 0338 fuera de la lista de huecos. Medido con `docs:index` + `docs:check` y con `sdd:check` (431 specs / 432 migraciones), no asumido.

### Auditoría del camino degradado: no hay código muerto

La declaración retirada apuntaba a cinco sitios. Con la RPC ya existente en la base, ninguno queda sin uso:

| Sitio | ¿Sigue siendo correcto? |
|---|---|
| `lib/portal/portal-queries.ts:146` — `if (error) return null;` | **Sí.** No es un guardia de «RPC inexistente»: es el manejo genérico de error de PostgREST y sigue alcanzable en runtime (5xx, timeout de statement, `EXECUTE` revocado, PostgREST sin schema cache tras un reinicio). Conserva además la semántica de main, que también devolvía null ante error de lectura. |
| `app/portal/(app)/page.tsx:123` — `.catch(() => null)` | **Sí.** Cubre excepciones del transporte, que `getPortalAdvisor` no traga a propósito. |
| `app/portal/(app)/soporte/page.tsx:100` — `try/catch` | **Sí.** Mismo caso que Inicio. |
| `app/portal/(app)/_components/PortalAdvisorCard.tsx:64` y `soporte/page.tsx:174` — fallback «Equipo DTD Cargo» / «Tu equipo DTD Cargo» | **Sí, y es un camino esperable con datos reales.** El null sigue siendo alcanzable **por diseño** en tres condiciones que la propia 0403 impone: cliente sin `advisor_id`, asesor que dejó de ser miembro activo del tenant, o perfil del asesor sin nombre. El contrato SQL las prueba, así que el fallback público no es residuo de la espera. |

Conclusión: **nada que borrar**. Los tests del camino de error se conservan tal cual —PGRST202 y 42501 siguen siendo respuestas posibles de PostgREST, no sólo síntomas de «migración sin aplicar»—; sólo se corrigió el comentario que los presentaba como el criterio del orden migrate-first.

### El merge: qué resolvió el driver y por qué con el override

Base del merge: `git merge-base` = `50100cc4902c4a2a4398327ba0de6dc30810c834`. Main cambió **103 archivos** entre esa base y `ce023926`; la rama cambió **12**. Los **únicos compartidos** son `supabase/migrations-baseline.json` y `docs/specs/README.md`: ningún archivo de producto de L03 (`lib/portal/portal-queries.ts`, las dos páginas, los dos tests, la migración y su contrato) fue tocado por main, así que **no hubo conflicto de producto que resolver** y no se descartó ningún lado. `supabase/pending-migration-symbol-declarations.json` no lo cambió main en esa ventana (seguía en `degradations: []`), así que la unión textual conservó el grupo l03 sin conflicto; se retiró después, aparte.

El override era imprescindible: git ejecuta el driver del árbol de la rama, y el de esta rama (blob `8cd8d31543727cf5c73c2548a088b8030d3006ba`) es anterior a la corrección, mientras main lleva `4a5af4e54f74a80270ddd6c15d6fa8bb14d5b530`. Se comprobó con los tres blobs reales de este merge, ejecutando los dos drivers fuera del repo:

| Clave de `pendingBelowCutoff` | Base `50100cc4` | Esta rama `bb1ca346` | `origin/main` `ce023926` | Driver **viejo** (rama) | Driver **de main** (usado) |
|---|---|---|---|---|---|
| `0409_bank_reconciliation_rbac` | presente | igual a la base | retirada (aplicada) | **resucitada** | **retirada** |
| `0418_portal_academia_tenant_boundary` | presente | igual a la base | retirada (aplicada) | **resucitada** | **retirada** |
| `0419_portal_reclamos_tenant_boundary` | presente | igual a la base | retirada (aplicada) | **resucitada** | **retirada** |
| `0430_portal_profile_change_requests_principal_tenant` | presente | igual a la base | retirada (aplicada) | **resucitada** | **retirada** |
| `0431_portal_post_message_principal_tenant` | presente | igual a la base | retirada (aplicada) | **resucitada** | **retirada** |
| `0433_portal_conversation_realtime_principal_tenant` | presente | igual a la base | retirada (aplicada) | **resucitada** | **retirada** |
| `0403_portal_advisor_por_principal` | ausente | añadida por L03 | ausente | conservada | conservada |
| `cutoff` / `$doc` | 238 | 238 | 238 | 238 | 238, `$doc` de main |

Con el driver viejo el archivo habría vuelto a declarar **seis** migraciones ya aplicadas como pendientes. El merge commit `7181ff02` contiene exactamente lo que calculó el driver de main (0403 como única espera), y la retirada va en su propio commit `2b8db764`: así el merge queda auditable por separado.

`docs/specs/README.md` se resolvió por unión semántica y **no se editó a mano**: `corepack pnpm docs:index` posterior no cambió un byte y `docs:check` lo confirma sincronizado en 431 specs. Con el merge llegó también el `.gitattributes` de main, que ya pone `supabase/pending-migration-symbol-declarations.json` bajo el driver (línea 34): en un próximo merge de esta rama ese archivo ya se une semánticamente.

### El encabezado de la migración no se toca

`supabase/migrations/0403_portal_advisor_por_principal.sql` conserva su comentario «NO aplicar a Producción desde esta rama. Requiere autorización específica por basename y el runbook…». Dos razones, en este orden:

1. **Identidad byte a byte con lo aplicado.** El ledger ancla `md5 bfae7279d28a8cf28961e0783ee23f36` y 1711 B. Editar un comentario cambiaría el md5 del archivo y abriría drift entre el repo y el payload que Supabase guardó, que es exactamente la clase de corrupción que `.gitattributes` documenta para los artefactos de ledger.
2. **Precedente en main.** `0401_portal_brand_por_principal.sql` y `0404_portal_referidos_por_principal.sql` ya están aplicadas e integradas y **conservan la misma línea** en main. La regla además sigue siendo cierta como regla: no se aplica a producción desde una rama de feature.

### Diff contra `origin/main` `ce023926` tras la ronda 2

`git diff --stat origin/main...HEAD` — **10 archivos**:

| Archivo | Qué es |
|---|---|
| `supabase/migrations/0403_portal_advisor_por_principal.sql` | Migración **aplicada en producción** el 2026-09-12; idéntica al ledger en md5 y bytes. |
| `supabase/tests/0403_portal_advisor_por_principal.test.sql` | Contrato SQL desechable de la RPC, importado del origen. |
| `lib/portal/portal-queries.ts` | `getPortalAdvisor(db)` sobre `get_portal_advisor()`; deja de construir `service_role` y de leer `clients`/`user_tenants`/`user_profiles`. |
| `app/portal/(app)/page.tsx` | Comentario y llamada del asesor con la sesión del cliente. JSX sin cambios. |
| `app/portal/(app)/soporte/page.tsx` | Comentario del hilo y llamada del asesor. JSX sin cambios. |
| `lib/portal/__tests__/portal-advisor-query.test.ts` | Test del origen, idéntico (4 casos). |
| `lib/portal/__tests__/portal-advisor-query-rpc-states.test.ts` | Test nuevo (6 casos), con el docstring corregido en esta ronda. |
| `docs/specs/0338-asesor-portal-por-principal/spec.md` | Spec con la nota de importación actualizada (0403 aplicada). |
| `docs/specs/README.md` | Fila 0338, conteo 431 y hueco 0338 retirado. |
| `.agents/handoffs/c-l03-portal-asesor.md` | Este documento, con la ronda 1 y la ronda 2. |

**Ya no aparecen** `supabase/migrations-baseline.json` ni `supabase/pending-migration-symbol-declarations.json`: quedaron iguales a main. `git diff --check` limpio.

### Validación de la ronda 2

Medida sobre `82a598a4e9aa0b72e4c396dd1549ebb088169072` (merge + los tres commits) con base `origin/main` `ce023926`. Node 24.20.0, pnpm 12.3.4 por corepack, Docker disponible. **Sin credenciales ni `.env.local`** en este worktree ni en el checkout principal. Recibos fuera de Git, en el scratchpad de la sesión (`…/scratchpad/c-l03-ronda2/`): `verify.log`, `verify.meta`, `e2e-block.txt`, `base.json` / `ours.json` / `theirs.json` y los dos drivers ejecutados sobre ellos.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | **PASÓ**: guard al tomar el árbol, claim `c-l03-worker-20260912-claude`, y `guard --owner` + rama revalidados antes de los commits. Estado inicial vacío y `HEAD = bb1ca346`, como decía la asignación. |
| Identidad de 0403 contra el ledger | **PASÓ**: `md5sum` local `bfae7279d28a8cf28961e0783ee23f36` y 1711 B, **antes y después del merge** (blob `dc812ba6…` sin cambio). Comprobación local sobre el archivo; **no** se consultó producción. |
| Merge de `origin/main` `ce023926` con el driver de main (override) | **PASÓ**: sin conflictos. Baseline resuelto clave por clave (seis esperas retiradas, 0403 conservada) e índice por unión semántica. Ningún archivo de producto de L03 fue tocado por main: 2 archivos compartidos de 103 que main cambió. |
| El override era necesario, no ritual | **PASÓ (medido)**: con los tres blobs reales, el driver viejo de la rama (`8cd8d315`) devuelve las **seis** esperas que main ya retiró; el de main (`4a5af4e5`) las retira. Ejecutados fuera del repo, sin tocar el árbol. |
| `git diff origin/main -- supabase/migrations-baseline.json` | **PASÓ**: **vacío**. `cutoff: 238`, `pendingBelowCutoff` vacío, `$doc` intacto; blob idéntico al de main (`93939af9…`). |
| `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` | **PASÓ**: **vacío**. `degradations: []`; blob idéntico al de main (`8e52d5b3…`). |
| Blobs de producto frente a la ronda 1 (`419d7ec0`) | **PASÓ**: idénticos en SQL, contrato, `portal-queries.ts`, las dos páginas y el test del origen. El único cambio es el docstring del test nuevo. |
| `node scripts/check-pending-migration-symbols.mjs` | **PASÓ**: `0 ROJO · 0 AMARILLO declarado(s)`, con el checker de main. Antes de esta ronda: 1 AMARILLO declarado. |
| `node scripts/install-merge-drivers.mjs --check` | **PASÓ**. |
| `corepack pnpm docs:index` + `docs:check` | **PASÓ**: índice sincronizado, **431 specs**, 26 huecos, 0338 fuera de la lista de huecos. El índice que dejó el driver ya era el canónico: `docs:index` no cambió un byte. |
| `corepack pnpm sdd:check` | **PASÓ**: 431 specs / 432 migraciones; sólo los choques históricos de migraciones ya declarados. |
| Vitest focal del asesor (3 archivos) | **PASÓ**: 17/17 sobre el contenido final del docstring. |
| `git diff --check` | **PASÓ**: sin espacios finales ni marcadores; 10 archivos en el diff contra main. |
| `corepack pnpm verify` | **FALLÓ, exit 1** (00:28 → 01:37). 16 de 17 pasos corrieron de verdad: **15 PASÓ**, `migrations-applied` **NO DISPONIBLE (SKIP)** y `e2e` **FALLÓ**. Veredicto literal: `verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)] CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde. |
| `verify` · harness / lint / rsc-boundary / typecheck / edge-functions | **PASÓ**: 35 pruebas de harness; lint sin errores; frontera RSC; TypeScript; 4 Edge Functions compilan. |
| `verify` · test (Vitest completo) | **PASÓ**: **6752 tests**. |
| `verify` · docs:check / numbering / feature-constants / components:check / governance:check | **PASÓ**: 431 specs, sin números repetidos, 5 banderas, registro de componentes y gobernanza ejecutable. |
| `verify` · pending-migration-symbols | **PASÓ**: 0 ROJO · 0 AMARILLO. |
| `verify` · sql-tests | **PASÓ**: **174 contratos** con rollback total, incluido `0403_portal_advisor_por_principal.test.sql`. |
| `verify` · schema-rebuild | **PASÓ**: 432 migraciones inventariadas, 414 aplicadas desde cero, 18 sólo-ledger, aislamiento multi-tenant en 219 tablas. |
| `verify` · build | **PASÓ**: compilación en 39,3 s y 160/160 páginas estáticas. `tsconfig.json` restaurado: al terminar el único archivo modificado del árbol era este handoff. |
| `verify` · `migrations-applied` | **NO DISPONIBLE**: `[SKIP] sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (¿worktree sin .env.local?)`. El ledger real **no se midió aquí**; la evidencia de que 0403 está aplicada es la que entregó el Director. |
| `verify` · `e2e` | **FALLÓ**, y esta vez **el paso no terminó**: 186 tests con 8 workers, el último reportado fue el 167 y el watchdog de SDD-0454 lo cortó por inactividad (sin salida durante 10 min), terminando 25 procesos del árbol propio (`chrome-headless-shell`×15, `node`×9, `cmd`×1; 0 sobrevivientes). Resultado parcial: 123 pasaron, **14 fallaron duro**, 1 flaky recuperado y 15 omitidos; 19 tests nunca reportaron. Los 14 duros son **todos ambientales**: `auth.spec.ts:21/91/98/105` en chromium, mobile-chrome y mobile-safari (12) y `global-search.spec.ts:22` en chromium y mobile-chrome (2), con el servidor registrando «Your project's URL and Key are required to create a Supabase client!» en `proxy.ts:67`. Se registran **NO DISPONIBLE por configuración ausente**. El flaky es `smoke.spec.ts:150` (`/track` → `/entrar`) en chromium: falló la primera vez y pasó en el reintento, y pasa en mobile-chrome; es público, ajeno a L03 y se reporta igual, sin absolver. **Ningún spec del asesor, de Inicio ni de Soporte falló.** El corte por inactividad es un dato nuevo frente a las corridas de esta noche en otros lotes, donde el paso terminaba con 15 fallos y reintento: aquí no hubo reintento porque el watchdog cortó antes. Sin credenciales el E2E no ejerce Inicio ni Soporte con sesión, así que **no valida esta superficie en ningún caso**. |
| `verify` · watchdog del e2e | **Funcionó como está especificado**: cortó sólo el árbol de procesos del paso, lo declaró en el log y dejó 0 sobrevivientes. No se ejecutó ningún `taskkill` a mano y no se tocó proceso ajeno. |
| CI alojado de GitHub | **NO EJECUTADO todavía**: la ronda 2 no está publicada. Corre con el push del turno de integración y es el que decide. |
| `/ui-check` | **NO EJECUTADO**: lo corre el Director. El JSX no cambia en ninguna de las dos rondas. |
| Producción / Supabase | **NO EJECUTADO** por límite del encargo: no se aplicó ninguna migración, no se leyeron filas, no se abrió conexión y no se copió ninguna credencial. |

## VALIDACIÓN (RONDA 1)

Producto validado: `419d7ec0b36eaa88dee30ea82aaeacb91a6f40fb` sobre la base `3c610701`; revalidación de lo afectado sobre los merges `7fb767f6`, `94372af9` y `9fdc6dd6`. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4, Docker 29.7.2. Sin credenciales ni `.env` operativo. Recibos fuera de Git, en la carpeta de evidencia del Director (`…/scratchpad/c-l03-portal-asesor/`): `install.log`, `spec-note-identity.json`, `ast-compare.json`, `baseline-check*.json`, `diffs/`, `merge/`, `pending-symbols*.log`, `docs-sdd*.log`, `merge2-checks.log`, `merge3-checks.log`, `schema-rebuild*.log`, `sql-focal-0403.log`, `sql-tests-merge2.log`, `sql-tests-merge3.log`, `vitest-focal*.log`, `vitest-advisor-verbose.log`, `typecheck*.log`, `eslint-focal.log`, `merge-drivers.log`, `harness-merge.log`, `verify.log`, `verify.exit` y `verify.meta`.

| Comprobación | Estado y evidencia |
|---|---|
| guard / claim / guard `--owner` y rama antes de cada commit | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ en 49,1 s; `pnpm-lock.yaml` y `package.json` sin cambios (tampoco en main durante la tarea) |
| Blobs con `git hash-object` | PASÓ (tabla de arriba) |
| Spec sin la nota | PASÓ: igual a `28d10745` |
| AST de `portal-queries.ts` y de las dos páginas | PASÓ: sólo cambian `getPortalAdvisor` y las dos llamadas; JSX idéntico |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ |
| `corepack pnpm sdd:check` | PASÓ: 416 specs / 421 migraciones; sólo colisiones históricas declaradas |
| `corepack pnpm docs:index` y `docs:check` | PASÓ: índice sincronizado, 416 specs |
| `node scripts/check-schema-rebuild.mjs` | PASÓ (06:06-06:07): inventario de 421; 403 migraciones desde cero, 18 sólo-ledger sin cambio de esquema, aislamiento multi-tenant en 219 tablas |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 1 AMARILLO declarado (`get_portal_advisor`). Antes de declarar: 1 ROJO en `portal-queries.ts:145`. El checker corregido UTF-16 da lo mismo |
| Contrato `0403_portal_advisor_por_principal.test.sql` en Postgres efímero propio | PASÓ: `psql` exit 0, cinco escenarios y rollback verificado (`portal_advisor_0403_fixture_rolled_back = t`); contenedor `dtd_l03_sqlfocal_7d55709a` retirado |
| Vitest `lib/portal/__tests__` | PASÓ: 30 archivos / 335 tests |
| Vitest de los tres archivos del asesor | PASÓ: 17/17 (7 existentes de `advisor.test.ts`, 4 del origen, 6 nuevos) |
| `corepack pnpm typecheck` | PASÓ |
| ESLint de las cinco rutas TS | PASÓ, 0 problemas |
| Baseline y declaraciones frente a la base | PASÓ: JSON válido, una sola clave nueva, cutoff 238 y `$doc` iguales |
| `git diff --check` y allowlist | PASÓ: 12 rutas exactas con el handoff; ninguna fuera de la allowlist |
| Combinación con L02 (#76, head `092ca77d`, home `9fe0b82d`) | PASÓ: `git merge-file` en ambos órdenes, 0 conflictos, resultado `7015d694` = home tras `121bfdc5` en #21. Ni #71, #79, #69 ni #70 tocan la home |
| `corepack pnpm verify` | FALLÓ, exit 1, sobre `419d7ec0` (06:15:31-06:42:58). Ejecutó 16 de 17 pasos: 15 PASÓ, `e2e` FALLÓ por el entorno y `migrations-applied` quedó omitido. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` El vigilante terminó en FIN, sin cuelgue. No se presenta como verde ni se reintentó a mano. |
| `/ui-check` | NO EJECUTADO: lo corre el Director; JSX idéntico |
| E2E autenticado y ledger real | NO DISPONIBLE: sin credenciales; fuera de la autorización |
| CI alojado de la PR | PASÓ en `Calidad continua` / `Calidad local sin secretos` sobre `419d7ec0` ([run 34589070680](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34589070680), 14 min 34 s) y sobre `d8ce6492`, que es producto + primer merge + handoff ([run 34591580602](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34591580602)). La corrida de `7fb767f6` se canceló al quedar reemplazada; la de `def49b97` quedó en curso al publicar. Preview de Vercel: pass. No cubre E2E autenticado ni Supabase. El CI del SHA final se registra en la PR. |

Detalle de `verify`:

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ. |
| lint | PASÓ: 0 errores; 8 advertencias en 4 archivos intactos (`NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx`, `KommoClient.tsx`). |
| rsc-boundary | PASÓ, 1597 módulos escaneados. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones compilan. |
| test | PASÓ: 6694 tests en 528 archivos (348 s). |
| docs:check | PASÓ, 416 specs. |
| numbering | PASÓ: 416 specs / 421 migraciones; sólo colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (SKIP). No se midió el ledger real; 0403 está pendiente por diseño. |
| pending-migration-symbols | PASÓ: 0 ROJO, 1 AMARILLO declarado. |
| sql-tests | PASÓ: 163 contratos, incluido `0403_portal_advisor_por_principal.test.sql`; rollback total. |
| schema-rebuild | PASÓ: 403 migraciones desde cero, 18 sólo-ledger y aislamiento en 219 tablas. |
| e2e | NO DISPONIBLE como validación de acceso/Supabase: el runner corrió y FALLÓ (exit 1) por el entorno, no por L03. Puerto propio 3425; 186 tests con 8 workers. Primera pasada: 152 PASÓ, 15 FALLÓ, 1 flaky (`auth.spec.ts:74` en chromium) y 18 omitidos (8,9 min). Reintento automático 1/1 de verify: 153 PASÓ, los mismos 15 FALLÓ y 18 omitidos (5,6 min). Los 15 son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari; causa observada en `proxy.ts:67`: «Your project's URL and Key are required to create a Supabase client!». Sin cierre forzado de workers. Sin credenciales, el E2E no ejerce con sesión Inicio ni Soporte. |
| build | PASÓ: Next.js 16.2.11 (Turbopack), compilación en 23,2 s y 160/160 páginas estáticas; `tsconfig.json` restaurado. Árbol versionado intacto al terminar, sin contenedores propios y con el puerto 3425 libre. |

### Revalidación tras el primer merge (`7fb767f6`, #71 y #79)

| Comprobación | Estado y evidencia |
|---|---|
| guard `--owner` y rama antes del merge | PASÓ |
| `git merge-tree` previo y merge real | PASÓ: 0 conflictos |
| 11 rutas del lote frente a `419d7ec0` | PASÓ: sin cambios (`git diff` vacío) |
| `git diff --check` y rutas frente a `origin/main` | PASÓ: exactamente las 11 rutas del lote |
| `node scripts/check-pending-migration-symbols.mjs` (checker de main, blob `5d0369f2`) | PASÓ: 0 ROJO, 1 AMARILLO en `portal-queries.ts:145` |
| `corepack pnpm harness:test` | PASÓ: 33/33, incluido `pending-migration-symbols-utf16.node.mjs` de #79 |
| `corepack pnpm docs:check` y `sdd:check` | PASÓ: 416 specs / 421 migraciones |
| Vitest `lib/portal/__tests__` | PASÓ: 30 archivos / 335 tests |
| `corepack pnpm typecheck` | PASÓ |

### Revalidación tras el segundo merge (`94372af9`, #69 / L19)

| Comprobación | Estado y evidencia |
|---|---|
| Claim, guard `--owner` y rama antes del merge | PASÓ |
| `git merge-tree` y merge real con el driver `dtd-generated-records` | PASÓ: merge semántico de baseline e índice, 0 conflictos |
| Baseline frente a `origin/main` `07d00097` | PASÓ: una línea añadida (la espera 0403, texto sin cambios); cutoff 238, `$doc` y esperas 0409/0418/0419/0430/0431 intactos |
| `corepack pnpm docs:check` y `sdd:check` | PASÓ: 417 specs / 422 migraciones; sólo colisiones históricas declaradas |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 1 AMARILLO (`get_portal_advisor`); 0431 redefine una función existente y no crea símbolos pendientes |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario de 422; 404 migraciones desde cero, 18 sólo-ledger, aislamiento en 219 tablas |
| `node scripts/run-sql-tests.mjs` | PASÓ: 164 contratos, incluidos 0403 y 0431; rollback total; sin contenedores propios al terminar |
| `git diff --check` y rutas frente a `origin/main` | PASÓ: exactamente las 11 rutas del lote y este handoff |

### Revalidación tras el tercer merge (`9fdc6dd6`, #70 / L21)

| Comprobación | Estado y evidencia |
|---|---|
| Claim, guard `--owner`, rama, HEAD esperado y árbol limpio antes del merge | PASÓ |
| `git merge-tree` y merge real con el driver `dtd-generated-records` | PASÓ: merge semántico de baseline e índice, 0 conflictos |
| Baseline frente a `origin/main` `50100cc4` | PASÓ: una línea añadida (la espera 0403, texto sin cambios); cutoff 238, `$doc` y esperas 0409/0418/0419/0430/0431/0433 intactos |
| `corepack pnpm docs:check` y `sdd:check` | PASÓ: 418 specs / 423 migraciones; sólo colisiones históricas declaradas |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 1 AMARILLO (`get_portal_advisor`) |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario de 423; 405 migraciones desde cero, 18 sólo-ledger, aislamiento en 219 tablas |
| `node scripts/run-sql-tests.mjs` | PASÓ: 165 contratos, incluidos 0403, 0431 y 0433; rollback total; sin contenedores propios al terminar |
| `git diff --check` y rutas frente a `origin/main` | PASÓ: exactamente las 11 rutas del lote y este handoff |
| Código, SQL, spec, tests y declaraciones frente a `419d7ec0` | PASÓ: sin cambios |
| Vitest, typecheck, `harness:test`, verify y build sobre los merges 2 y 3 | NO EJECUTADO de nuevo. #69 y #70 sólo trajeron SQL/contrato, spec, índice, baseline y handoffs; ya se revalidó todo eso arriba. No hubo código `app/`/`lib/`, dependencias ni configuración de build. El CI alojado corre sobre el SHA final publicado. |

## COMMITS

- `419d7ec0b36eaa88dee30ea82aaeacb91a6f40fb`: `feat(studio): SDD-0338 — importar L03 asesor Portal por principal (migrate-first)`. SQL, contrato, spec con nota, `getPortalAdvisor`, dos páginas, test del origen, test nuevo, baseline, declaración e índice. Es el producto que validaron verify y el CI.
- `7fb767f6f18242ab805909ba8898dec9d554b3e6`: merge de origin/main (`b7e8b484`, #71 y #79), sin conflictos.
- `d8ce6492eb56bcfac1bfbd6546e45197c46d1f77`: `chore(harness): cerrar handoff L03 asesor Portal`. Primera versión de cierre de este documento.
- `94372af93eab74876ce586dacbf27a88c778c46c`: merge de origin/main (`07d00097`, #69), con el driver en baseline e índice.
- `def49b9773ad9dc749c4cfdb5537cd6947f44daa`: `chore(harness): actualizar handoff L03 tras merge con L19`.
- `9fdc6dd65befe19ca1754a616db12e95eed4dafc`: merge de origin/main (`50100cc4`, #70), con el driver en baseline e índice.
- `def49b9773ad9dc749c4cfdb5537cd6947f44daa` y `bb1ca3465153bc2cc0d9e83434d11f1e7b48ca2e`: `chore(harness): actualizar handoff L03 tras merge con L19` y `…tras merge con L21`. Sólo documentación de la ronda 1.

Ronda 2 (sobre `bb1ca346`):

- `7181ff0212ed61492c8ef86cc73b627dbe5d43b5`: merge de origin/main (`ce023926`, #78), con el driver **de main** en baseline e índice. Sin conflictos.
- `2b8db764`: `chore(db): retirar la espera 0403 aplicada y su declaración de símbolos`. Baseline y declaraciones vuelven a ser idénticos a main.
- `9d6bd997`: `docs(specs): registrar 0403 aplicada a producción en la spec 0338`. Nota de importación con ledger, md5 y bytes.
- `82a598a4`: `docs(portal): quitar el «migrate-first» rancio del docstring del test del asesor`. Sólo comentario; ninguna aserción ni nombre de test cambia.
- Commit que contiene este documento: cierre durable de la ronda 2. El hash final queda en la PR.

## PR / BRANCH

[PR #83 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/83), base `main`, rama `codex/c-l03-portal-asesor`, worktree indicado arriba. Sin merge a main, sin aplicar nada a Supabase, sin leer producción y sin deploy.

**Estado al cerrar la ronda 2: NO publicada.** Por indicación del Director la ronda 2 queda commiteada en local y **sin push**: #77 y #76 entran antes y cada merge mueve `main`, así que publicar ahora haría que el ruleset rechace la rama por no estar al día y el CI corra para nada. Mientras el head remoto siga en `bb1ca346`, el prefijo «[NO FUSIONAR ANTES DE APLICAR 0403]» del título es el único freno propio de la PR y **se conserva a propósito**.

Cuando el Director mande el SHA de `main`: último merge con el override del driver, revalidación de lo afectado y entonces, de una sola vez, `git push origin codex/c-l03-portal-asesor:codex/c-l03-portal-asesor` (sin force), cambio de título a «feat(studio): SDD-0338 — L03 asesor Portal por principal (0403 ya aplicada)» y paso de borrador a listo. El título y el `ready` van **junto con** el push, nunca antes. La integración la hace el Director.

## PENDIENTES DE ESTA TAREA

- **Publicación, a la espera del SHA de `main` del Director**: último merge con el override, revalidación de lo afectado y push + título + ready en un solo paso. Es lo único que queda de esta tarea.
- Ninguno de implementación: SQL, contrato, spec con la nota actualizada, adopción focal, tests, retirada de espera y declaración, índice y handoff están entregados.
- Revisión del Director, CI alojado del SHA final y `/ui-check` (el JSX no cambia en ninguna de las dos rondas).
- E2E autenticado y ledger real siguen NO DISPONIBLES en esta máquina, por ausencia de `.env.local`. No son permiso para copiar credenciales ni para tocar producción; el CI de GitHub es el que decide.

## FUERA DE ALCANCE DETECTADO

1. **Comentarios que quedan desactualizados fuera de la allowlist.** `lib/portal/__tests__/advisor.test.ts:7-8` dice que `getPortalAdvisor` «es admin-scopeada»; `app/portal/(app)/reclamos/actions.ts:73-74` justifica una lectura con admin «mismo criterio que getPortalAdvisor». Sólo comentarios, sin efecto funcional.
2. **SQL 0403, `limit 1` sin `order by` (L41).** Con varios vínculos activos, la RPC elegiría uno arbitrario. En estas vistas no ocurre: el principal de L18 usa `maybeSingle` (`portal-queries.ts:73`), devuelve null y la página sale antes. Se importa idéntico.
3. **Declaraciones sin merge driver.** L01, L02, L04, L05 y L06 también agregan grupos a `degradations`, así que al integrar habrá conflicto textual; se resuelve por unión. Baseline e índice sí tienen `dtd-generated-records`.
4. **GitHub no ejecuta `dtd-generated-records`.** Tras #69 y otra vez tras #70, la PR #83 se vio CONFLICTING aunque el merge local con el driver era limpio. Cada PR que entre a main tocando baseline o índice repetirá ese estado hasta rehacer el merge local.
5. **Allowlist histórica de 0338.** `scripts/__tests__/portal-service-role-boundary.test.mjs` y la meta «10 rutas / 18 construcciones» no existen en main; pertenecen al saneamiento de #21 y no se importan.
6. **Fallback silencioso.** Ni main ni el origen registran el fallo de esta lectura. Si el Director quiere la misma observabilidad que pidió en L02 (código o mensaje, sin ids ni datos del asesor), es un cambio acotado a `getPortalAdvisor` y su test.
7. **Heredados del entorno, sin cambios.** Aviso de pnpm 12 sobre `pnpm.onlyBuiltDependencies` ignorado; 8 advertencias de lint en los 4 archivos intactos citados; los 15 fallos E2E ambientales ya conocidos en L16/L18/L02 y un flaky recuperado. No son regresiones de L03.

### Actualización de la ronda 2

8. **Sigue abierto el punto 1, y ahora es más engañoso.** `lib/portal/__tests__/advisor.test.ts:7-8` afirma que `getPortalAdvisor` «es admin-scopeada» y `app/portal/(app)/reclamos/actions.ts:73-74` justifica su lectura con admin «mismo criterio que getPortalAdvisor». Con esta PR integrada las dos frases quedan **falsas en main**, no sólo desactualizadas. Son comentarios, sin efecto funcional, y están fuera de la allowlist de SDD-0338: no se tocan aquí. Merece una tarea corta de limpieza de comentarios del Portal.
9. **Los encabezados «NO aplicar a Producción desde esta rama» sobreviven a la aplicación.** No es sólo 0403: `0401` y `0404`, ya aplicadas e integradas, conservan la misma línea en main. Corregirlos uno por uno **no es seguro**, porque cambiaría el md5 del archivo frente al payload del ledger. Si el Director quiere que el texto deje de contradecir al ledger, es una decisión de política (por ejemplo, redactar el aviso como regla permanente en el generador o en el runbook), no un arreglo por PR.
10. **El punto 3 de la ronda 1 quedó resuelto en main.** `supabase/pending-migration-symbol-declarations.json` ya está bajo `merge=dtd-generated-records` en el `.gitattributes` de main (línea 34) y el driver de main sabe unir ese archivo. El conflicto textual que preveía la ronda 1 para L01/L02/L04/L05/L06 dejó de aplicar; en esta rama el archivo además ya no aparece en el diff.
11. **El punto 4 sigue vigente y explica el CONFLICTING de GitHub.** GitHub no ejecuta `dtd-generated-records`. Cada PR que entre a main tocando baseline o índice vuelve a dejar #83 como CONFLICTING hasta rehacer el merge local con el override. Además, **toda rama del lote nacida antes de la corrección del driver arrastra el driver viejo en su propio árbol**: sin `-c merge.dtd-generated-records.driver=…` apuntando al de main, el merge resucita las esperas que main ya retiró. Se comprobó aquí con los blobs: seis esperas revividas.
12. **Heredados del entorno, sin cambios.** En esta máquina no hay `.env.local` en ningún worktree ni en el checkout principal: `migrations-applied` queda en SKIP y el paso `e2e` falla por credenciales ausentes en `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22`. En esta corrida se midieron **14** de esos fallos duros (los 12 de `auth` en chromium, mobile-chrome y mobile-safari, y los 2 de `global-search` en chromium y mobile-chrome): el 15º nunca reportó porque el watchdog cortó el paso por inactividad en el test 167 de 186. Se registran **NO DISPONIBLE por configuración ausente**, no como verde. Aparte, `smoke.spec.ts:150` en chromium quedó flaky recuperado: público y ajeno a L03, pero se reporta. Persisten también el aviso de pnpm 12 sobre `pnpm.onlyBuiltDependencies` y las 8 advertencias de lint en los 4 archivos intactos ya citados.

## HANDOFF AL DIRECTOR

### Ronda 2 — vigente

- **Siguiente acción, tuya:** mandarme el SHA de `main` cuando sea mi turno. Con él hago el último merge con el override del driver, revalido lo afectado y publico de una sola vez (push de la rama a sí misma, título nuevo y paso de borrador a listo). Hasta entonces la rama queda commiteada en local y sin push, con el prefijo «[NO FUSIONAR ANTES DE APLICAR 0403]» todavía puesto como freno.
- **La condición migrate-first está cumplida y verificada por ti:** 0403 aplicada el 2026-09-12, ledger `20260912022746`, md5 `bfae7279d28a8cf28961e0783ee23f36` y 1711 B iguales al archivo de esta rama antes y después del merge. Aquí no se leyó ni se escribió nada en producción.
- **Serialización con L02 (#76) y L17 (#77).** Con L02 sólo comparto `app/portal/(app)/page.tsx`, con hunks separados (simulado en ambos órdenes en la ronda 1: 0 conflictos). Quien entre segundo rehace el merge; en mi caso ya está previsto. Nada más del lote toca `portal-queries.ts`, Soporte ni los tests del asesor.
- **Revisión sugerida:** el diff de producto de esta ronda es sólo el comentario del docstring; lo demás es la retirada de los dos registros generados y la nota de la spec. El producto que el CI midió en la ronda 1 sigue con los mismos blobs.
- **Ownership.** Claim de la ronda 2: `c-l03-worker-20260912-claude`. Se conserva mientras quede escritura pendiente (el merge final y el push). Al terminar se libera con `node scripts/harness-worktree.mjs release --owner c-l03-worker-20260912-claude`. Worktree y rama se conservan: no se borra nada.

### Ronda 1 — histórico, ya cumplido

- **Orden migrate-first.** Revisar la PR #83 sobre el SHA final (main estaba en `50100cc4` al publicar). Con OK nominal de Sam, aplicar 0403 individualmente con name `0403_portal_advisor_por_principal` según el runbook, y verificar el objeto y su ACL. Después, en esta rama: retirar la espera del baseline y la declaración `l03`, actualizar la nota de SDD-0338, revalidar y recién entonces fusionar.
- **Main en movimiento.** Main avanzó tres veces durante la tarea; en cada caso se hizo merge y se revalidó lo afectado. No se persiguen más avances después de este cierre. Si main vuelve a moverse, quien actualice la rama en la ventana de integración repite el merge local con el driver: GitHub puede marcar CONFLICTING por baseline o índice aunque el merge semántico sea limpio.
- **Serialización con L02 (#76).** Comparten sólo `app/portal/(app)/page.tsx`, con hunks separados. La simulación en ambos órdenes da 0 conflictos y el blob `7015d694` de #21. Baseline e índice se resuelven con el driver; declaraciones, por unión. Quien entre segundo hace merge de origin/main y revalida.
- **Otros lotes.** Ninguna rama `codex/c-*` local o remota toca `portal-queries.ts`, Soporte ni los tests del asesor. Sin dependencia de 0402 ni de L05.
- **Incidente de ownership durante el cierre, resuelto.** Un commit del handoff falló porque faltaba su archivo de mensaje, y la cadena siguió: publicó sólo el merge `7fb767f6` y liberó el claim antes de tiempo. Se volvió a reclamar con el mismo owner (el claim se adquirió sin conflicto, así que no había claim ajeno) y se completó `d8ce6492`. Para los merges 2 y 3 se reclamó antes de escribir y se liberó al final; desde el incidente, cada paso aborta con una comprobación explícita.
- **Ownership.** Escritura finalizada con esta actualización. Tras su commit y push se libera el claim con `node scripts/harness-worktree.mjs release --owner c-l03-worker-20260911-claude`; el estado efectivo se verifica en los metadatos Git del worktree. Worktree y rama se conservan. No hay subagentes ni sesiones consumidoras delegadas.
