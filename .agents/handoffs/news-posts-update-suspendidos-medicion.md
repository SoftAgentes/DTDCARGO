# Handoff: el UPDATE de news_posts y los admins suspendidos (medición, sin migración)

| Campo | Valor |
|---|---|
| Owner | Worker `news-update-sin-suspendidos` |
| Sesión que encargó | Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`) |
| Ruta | `.claude/worktrees/news-update-sin-suspendidos-7664b7` |
| Rama | `claude/news-update-sin-suspendidos-7664b7`, base `main` `8f2029a80` |
| Fecha | 2026-11-11 |
| SDD | No aplica. El DG eligió la opción B: no hay SDD ni migración |

## OBJETIVO ORIGINAL

La revisión de la PR #512 (SDD-0625, edición de noticias publicadas) encontró esto: la policy
`news_posts_admin_update` (`supabase/migrations/0055_news_posts.sql:92-100`) no mira `disabled_at`
y no tiene WITH CHECK propio. Según la revisión, un admin suspendido con un JWT vivo podía editar
por PostgREST. El encargo pedía una migración nueva (desde la 0536) que reemplazara esa policy,
con su contrato en PGlite y un control rojo.

## COMPLETADO

Antes de escribir la migración medí si el agujero existe. **Sobre el esquema que dejan las
migraciones, no existe.**

- La policy hace `exists (select 1 from public.user_tenants ut where ut.user_id = auth.uid() and
  ut.role = 'admin' and ut.tenant_id = news_posts.tenant_id)`. Esa subconsulta corre **como el
  usuario**, así que pasa por la RLS de `user_tenants`.
- Desde la 0200 (H3, `supabase/migrations/0200_rbac_disabled_enforcement.sql:93-96`), la única
  policy SELECT de `user_tenants` para authenticated es `user_id = (select auth.uid()) and
  disabled_at is null`. Para un suspendido, la subconsulta devuelve 0 filas y la policy no lo deja
  pasar. La 0200 lo anticipa en su cabecera: «con el filtro acá, TODAS cierran de una».
- Ninguna migración posterior agrega otra policy SELECT de `user_tenants` para authenticated.
  La 0040 agregó una y la 0041 la retiró. Además de esa, solo queda `service_role_all_user_tenants`
  (0033).
- El WITH CHECK que falta no abre nada. En un UPDATE sin WITH CHECK, Postgres revisa la fila nueva
  con el USING, y eso exige ser admin del tenant de destino.
- Las RPC `news_retirar` y `news_volver_a_publicar` (0518) y el resto de las funciones de noticias
  exigen `is_tenant_admin()`, que filtra `disabled_at is null`. Lo comprobé leyendo el código, no
  corriéndolas.

### Medición en PGlite

Usé el fixture de los contratos 0518/0525/0526 con las migraciones **reales** 0053, 0055, 0057,
0140, 0518, 0525 y 0526. Agregué una fila publicada y suspendí al segundo admin del tenant 1.
Corrí cada caso con `set local role authenticated` y el claim `sub` del usuario. El script quedó
fuera del repo, en el scratchpad de la sesión (`probe/probe.mjs`).

| Caso | Fixture actual (`user_tenants` **sin** RLS) | Con la RLS real de `user_tenants` (0001 + 0200) |
|---|---|---|
| Admin suspendido edita el título | 1 fila (pasa) | **0 filas (bloqueado)** |
| Admin activo edita el título | 1 | 1 |
| Admin de otro tenant edita | 0 | 0 |
| Admin activo mueve `tenant_id` a otro tenant | 42501 | **42501** |

### Causa del falso positivo

El fixture de los contratos de noticias (`supabase/tests/0518_…`, `0525_…`, `0526_…`) crea
`public.user_tenants` como tabla simple, **sin** `enable row level security` y sin la policy de
la 0200. Con ese fixture el suspendido sí edita. Producción no tiene esa forma, salvo que haya
deriva respecto de las migraciones. No leí producción.

### Decisión

El DG eligió la **opción B** el 2026-11-11: no se hace migración. «Un gate roto no es un agujero si
la RLS de user_tenants (0200, H3) ya lo corta, y una migración de producción solo por defensa en
profundidad no vale el riesgo hoy».

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Medición en PGlite (tabla de arriba), dos variantes del fixture | PASÓ: reproducible con el script del scratchpad |
| `pnpm docs:check` (`node scripts/build-docs-index.mjs --check`) | PASÓ: índice sincronizado con 604 specs |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el diff es solo un handoff, sin producto |
| Lectura de producción | NO EJECUTADO, a propósito |

## COMMITS

- `docs(handoff): el UPDATE de news_posts ya excluye a los suspendidos por la RLS de user_tenants`
  (solo este archivo).

## PR / BRANCH

Rama `claude/news-update-sin-suspendidos-7664b7`. La PR es solo de docs, contra `main`.

## PENDIENTES DE ESTA TAREA

Ninguno. No hay SDD, ni migración, ni número reservado. La 0536 queda libre.

## FUERA DE ALCANCE DETECTADO

1. **El fixture de los contratos de noticias debería montar la RLS real de `user_tenants`.**
   `supabase/tests/0518_noticias_publicacion_automatica.test.sql`, `0525_…`, `0526_…` y la
   `0532_…` de la #512 crean `user_tenants` sin RLS. Por eso:
   - un contrato ve agujeros que no existen (este caso);
   - y puede esconder otros reales: no prueba el camino por el que la RLS de `user_tenants`
     participa en las policies de `news_posts`.

   Propuesta: que el fixture habilite la RLS y cree la policy `"users see their own user_tenants"`
   igual que la 0200, con un caso «admin suspendido no edita» en el contrato. Es solo de pruebas,
   sin migración. Necesita su propia tarea y coordinarse con la #512 si sigue abierta.
2. **Dependencia implícita, sin prueba.** La exclusión de suspendidos en las policies de
   `news_posts` (y en todas las que hacen subconsulta a `user_tenants`, como dispatch_* de la 0024)
   depende de que `user_tenants` no reciba una policy SELECT más abierta. Si alguien la agrega (la
   0040 ya lo intentó), esas policies se vuelven a abrir sin que falle ninguna prueba de noticias.
   La medida que se podría tomar más adelante, con su SDD, es reescribirlas con `is_tenant_admin()`
   / `get_user_tenant_id()` y un WITH CHECK explícito. Hoy no se hace, por decisión del DG.

## HANDOFF AL DIRECTOR

Medido y documentado: no hay agujero en el esquema real, la causa es el fixture y no hay migración.
La PR es solo de docs y no toca la #512 ni `app/studio/(app)/marketing/noticias-web/**`.
Impacto documental: solo este handoff. Graphify y Archify no aplican, porque no cambia ninguna
fuente de código ni documento canónico.
