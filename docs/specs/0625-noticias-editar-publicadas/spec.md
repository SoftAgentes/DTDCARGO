---
sdd: "0625"
title: "Corregir, retirar y volver a publicar noticias desde el Studio"
status: in-progress
author: "Claude (Worker)"
created: 2026-11-11
updated: 2026-11-11
supersedes: null
superseded_by: null
related: ["0611"]
confidencialidad: interno
---

# SDD-0625 — Corregir, retirar y volver a publicar noticias desde el Studio

> Un admin del Studio corrige una noticia que ya está en /noticias (titular, bajada, cuerpo,
> categoría y SEO), la retira con su motivo o vuelve a publicar una retirada, desde
> Studio › Marketing › Noticias web › Publicadas. El enlace de la noticia no cambia.

## 1. Contexto

Hoy `app/studio/(app)/marketing/noticias-web/` solo crea: el asistente termina en `publishPost`,
que hace INSERT en `news_posts`. Una noticia publicada no tiene lista ni edición en el Studio.

Caso que lo motivó: una noticia publicada dice que el envío llega en 30 días, y Sam dice que el
FCL a Venezuela tarda normalmente de 45 a 55 días. La corrección la hace Sam desde esta pantalla
cuando esté desplegada; esta SDD **no edita datos de producción**.

La SDD-0611 dejó «editar o volver a publicar» fuera de su alcance y definió el retiro (I3,
`published = false`, motivo obligatorio de §4.11, solo admin). La 0518 (aplicada el 2026-11-08)
ya trae `news_retirar`, `news_volver_a_publicar`, `news_post_exits` y el CHECK que no deja
publicar una marca `[VERIFICAR`. El aviso de `#noticias` ya enlaza a
`/studio/marketing/noticias-web/retirar/<id>`, que hasta ahora no existía.

## 2. Alcance

1. Pestañas «Nueva noticia» y «Publicadas» en Noticias web.
2. Lista **Publicadas**: titular, fecha, categoría y estado («Publicada», y «Publicada sola» si
   la publicó la vía automática), con «Ver», «Corregir» y «Retirar».
3. Lista **Retiradas**: titular, fecha del retiro y motivo (o «Motivo pendiente»), con
   «Volver a publicar».
4. **Corregir**: titular, bajada, cuerpo (Markdown), categoría (solo del mismo tipo) y SEO
   (meta descripción y palabra clave), con vista previa. El slug se muestra y **no cambia**.
5. **Retirar** (`/studio/marketing/noticias-web/retirar/[id]`): la lista cerrada de motivos de
   §4.11 de la 0611, motivo obligatorio, nota obligatoria con «Otro» y sin datos personales.
6. **Volver a publicar** una retirada.
7. Auditoría de quién y cuándo: migración **0532**, sin aplicar, declarada como espera.

### Fuera de alcance

- Cambiar el slug (rompería enlaces compartidos y el mapa del sitio). Si hace falta, otra SDD
  con redirección 301.
- Cambiar el tipo editorial, el autor, la fecha o las palabras secundarias.
- Editar una noticia retirada (la policy de lectura de 0055 solo deja ver publicadas; abrirla
  pide una policy nueva para admin, que esta SDD no agrega).
- Tocar la página pública (`app/noticias/**`, `app/sitemap.ts`), los textos públicos y
  /privacidad.
- Auditar el INSERT de `publishPost` (alta): sigue como hoy.

## 3. Reglas del servidor

| Regla | Dónde |
|---|---|
| Solo admin **activo** (`tenantAdminGate`, que mira `disabled_at`; las policies de 0055 no lo miran). Es la misma puerta de `publishPost`. Las páginas **y las actions** exigen además el flag `marketing_news` (con el módulo apagado, una llamada directa tampoco escribe); el layout, `requireModuleView("noticias-web")` | `publicadas/actions.ts`, `publicadas/_gate.ts` |
| Se escriben **solo** `title`, `excerpt`, `body_markdown`, `categoria`, `meta_description`, `focus_keyword` y `read_time_min` (derivado). Nunca `slug`, `published`, `publish_via`, `seo_draft_id` ni `content_sha256` | `lib/news/edicion.ts` (`CambiosNoticia`) |
| Una marca `[VERIFICAR` en cualquiera de los cinco textos bloquea guardar, igual que publicar (misma `tieneMarca` de la 0611) | `validarEdicion` |
| Cuerpo de al menos 200 caracteres (lo mismo que exige `publishPost`); titular y bajada no vacíos; topes de largo | `validarEdicion` |
| La categoría solo cambia dentro del tipo guardado en la fila (el tipo nunca viene del formulario) | `validarEdicion` |
| Solo se edita una fila publicada del propio tenant (`.eq("tenant_id")`, `.eq("published", true)`) | `guardarEdicion` |
| Retirar: `validarRetiro` antes de llamar a `news_retirar` (la base vuelve a validar) | `retirarNoticia` |
| Volver a publicar: `news_volver_a_publicar`; el CHECK `news_posts_sin_marca_verificar` (0518) rechaza un texto con marcas (23514 → mensaje de marcas) | `volverAPublicar` |
| Los errores de Postgres se traducen a mensajes propios; no se muestra el texto crudo | `errorDeBase` |
| RLS/policies de `news_posts`: **sin cambios**. La edición usa `news_posts_admin_update` (0055). anon no gana nada | — |

Una edición de una noticia automática recalcula su `content_sha256` con el disparador de la
0525 (punto 13 de la 0611): no hace falta nada aquí.

## 4. Auditoría (migración 0532)

`news_posts` solo guarda `updated_at`. La 0532 agrega el tipo de entidad `news_post` y el
disparador `audit_news_posts` (AFTER UPDATE) que llama al writer AUD-01 (`append_audit_event`)
**en la misma transacción**: si el writer falla, la edición se revierte.

- `news_post_updated`: columnas cambiadas (`changed_fields`, sin valores) y huellas sha256 de
  titular, bajada, cuerpo y SEO antes y después. **No copia el texto** (la bitácora es de solo
  agregar y la noticia ya es pública). Actor: `auth.uid()` del JWT.
- `news_post_withdrawn`: con el motivo de `news_retirar`, o «motivo pendiente» si salió por otra
  vía (actor `system` sin JWT). Convive con `news_post_exits` de la 0518, que sigue siendo el
  registro de §4.11.
- `news_post_republished`.
- Un UPDATE que no cambia contenido ni estado no deja evento.

**Migrate-first compatible.** La pantalla funciona sin la 0532: edita con la policy de 0055,
retira y vuelve a publicar con las funciones de 0518 (ya en producción) y lista las retiradas
desde `news_post_exits`. Sin la 0532 falta solo la fila de quién y cuándo editó. Aplicarla exige
el OK nominal de Sam y el runbook `docs/runbooks/aplicar-migraciones-prod.md`.

## 5. Cuándo se ve el cambio en el sitio

`/noticias`, `/noticias/[slug]` y el sitemap ya revalidan cada 300 s (ISR, PR #505); esta SDD no
los toca. Las actions además llaman a `revalidatePath` de `/noticias`, `/noticias/<slug>`,
`/sitemap.xml` y la lista del Studio, igual que `publishPost`. Si el Studio y el sitio público
corren en el mismo despliegue, el cambio se ve en el siguiente pedido; si no, **tarda hasta
5 minutos**. La pantalla lo dice así.

## 6. Diseño de pantalla

- Pestañas como enlaces (cada una es una ruta): el enlace de Discord y el botón Atrás funcionan.
- Mismo marco claro del generador (`data-theme="light"`, tokens de marca).
- Botones: `ActionButton` en guardar (primary), retirar (danger, separado de Cancelar) y volver a
  publicar (dark); `Link` con clases `studio-btn` para navegar.
- Trazabilidad: toast con enlace y resaltado de la fila (`useRowHighlight`) al volver a la lista.
- Formulario controlado, no `<form action>`: en React 19 un error no borra lo escrito.

## 7. Aceptación

| # | Criterio | Prueba |
|---|---|---|
| 1 | Un admin activo corrige una publicada y solo se escriben las 7 columnas permitidas | `noticias-publicadas-actions.test.ts` |
| 2 | Un slug enviado en el formulario no llega a la base | idem |
| 3 | Admin suspendido, `marketing` o `commercial` no editan, no retiran y no vuelven a publicar; con el flag `marketing_news` apagado, tampoco un admin | idem |
| 4 | Una marca `[VERIFICAR` en cualquiera de los 5 campos bloquea guardar | idem (5 casos) |
| 5 | La categoría no cambia de tipo; cuerpo corto o titular vacío no se guardan | idem |
| 6 | Otro tenant o una retirada no se editan | idem |
| 7 | Retiro sin motivo, con motivo inventado, «otro» sin nota o nota con teléfono no llaman a la base | idem |
| 8 | Los errores P0002 y 23514 se explican sin el texto de Postgres | idem |
| 9 | Corregir deja `news_post_updated` con actor, columnas y huellas, sin el texto | `noticias-0532.migration.test.ts` (PGlite, contrato `supabase/tests/0532_…`) |
| 10 | Un UPDATE sin cambios no deja evento | idem |
| 11 | Retirar deja `news_post_withdrawn` con motivo; por otra vía, «motivo pendiente» y actor system | idem |
| 12 | Volver a publicar deja `news_post_republished` | idem |
| 13 | Si el writer falla, la edición se revierte | idem |
| 14 | La API no ejecuta la función del disparador; un commercial y anon no editan | idem |
| 15 | Control rojo sin 0532 y 7 mutantes caen con su mensaje | idem |
| 16 | La 0532 está declarada como espera y su cabecera dice NO APLICADA | idem |
| 17 | `/ui-check` sin bloqueantes | handoff |

## 8. Allowlist exacta

| Archivo | Cambio |
|---|---|
| `app/studio/(app)/marketing/noticias-web/page.tsx` | Modificado: pestañas arriba del generador |
| `app/studio/(app)/marketing/noticias-web/_components/NoticiasTabs.tsx` | Nuevo: pestañas «Nueva noticia» y «Publicadas» |
| `app/studio/(app)/marketing/noticias-web/_components/NoticiasShell.tsx` | Nuevo: marco claro de las pantallas nuevas |
| `app/studio/(app)/marketing/noticias-web/publicadas/page.tsx` | Nuevo: lista Publicadas y Retiradas |
| `app/studio/(app)/marketing/noticias-web/publicadas/[id]/page.tsx` | Nuevo: corregir una publicada |
| `app/studio/(app)/marketing/noticias-web/publicadas/_gate.ts` | Nuevo: puerta de las páginas (sesión, admin activo, flag) |
| `app/studio/(app)/marketing/noticias-web/publicadas/actions.ts` | Nuevo: `guardarEdicion`, `retirarNoticia`, `volverAPublicar` |
| `app/studio/(app)/marketing/noticias-web/publicadas/_components/PublicadasClient.tsx` | Nuevo: tablas y «Volver a publicar» |
| `app/studio/(app)/marketing/noticias-web/publicadas/_components/EditarNoticiaForm.tsx` | Nuevo: formulario con vista previa |
| `app/studio/(app)/marketing/noticias-web/publicadas/_components/RetiroForm.tsx` | Nuevo: motivos de §4.11 y nota |
| `app/studio/(app)/marketing/noticias-web/retirar/[id]/page.tsx` | Nuevo: pantalla de retiro (destino del enlace de `#noticias`) |
| `app/studio/(app)/marketing/noticias-web/__tests__/noticias-publicadas-actions.test.ts` | Nuevo: actions con el doble que honra filtros |
| `lib/news/edicion.ts` | Nuevo: qué se edita y cómo se valida |
| `lib/studio/news-publicadas-queries.ts` | Nuevo: lecturas de la lista y del formulario |
| `lib/news/__tests__/noticias-0532.migration.test.ts` | Nuevo: contrato de la 0532 en PGlite, control rojo y mutantes |
| `supabase/migrations/0532_noticias_edicion_auditada.sql` | Nuevo: migración 0532, **sin aplicar** |
| `supabase/tests/0532_noticias_edicion_auditada.test.sql` | Nuevo: contrato SQL de la 0532 |
| `supabase/migrations-baseline.json` | Modificado: espera de la 0532 en `pendingBelowCutoff` |
| `docs/specs/0625-noticias-editar-publicadas/spec.md` | Nuevo (esta spec) |
| `docs/specs/README.md` | Modificado: índice regenerado con `pnpm docs:index` |
| `.agents/handoffs/sdd-0625-noticias-editar-publicadas.md` | Nuevo: handoff |

## 9. Gobernanza

| Política | Clasificación |
|---|---|
| AUD-01 (mutación y evento en una operación; sin copiar datos innecesarios) | Cumplimiento con la 0532 aplicada; antes, la edición queda solo con `updated_at` (declarado en §4) |
| BTN-01 / reglas de botones del Studio | Cumplimiento: `ActionButton`, destructivo separado, sentence case, tuteo |
| FRM-01 / ERR-01 | Cumplimiento: errores en `role="alert"`, lo escrito no se pierde |
| IA-01 | No aplica: no publica contenido nuevo de IA; corrige uno ya publicado por una persona |
| Datos personales (`revisar-datos-ve`) | La nota de retiro pasa por `tieneDatosPersonales` (0611); la bitácora no copia texto. Sin captura nueva de datos personales |
