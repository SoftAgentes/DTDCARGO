# Runbook — Guía interactiva de Alibaba dentro de la Academia (SDD-0099)

> **Para la ventana `feat/academia` / coordinación.** La guía interactiva DTD-branded ya está **lista y
> servible**; esto la enchufa a la Academia como una lección (carril `academy_*` + portal, por eso NO se
> tocó desde `feat/guia-comprar-alibaba`). Todo acá es copy-paste, adaptá a tu patrón de seed.

## Qué ya está hecho (en `feat/guia-comprar-alibaba`)
- **Guía interactiva servible:** [`public/guias/comprar-en-alibaba.html`](../../public/guias/comprar-en-alibaba.html)
  → URL pública `/guias/comprar-en-alibaba.html`. Auto-contenida (fuentes Google + isologo base64 + sin rutas
  relativas), 100% branded, datos reales cableados (WhatsApp CRM + dirección Yiwu + MARKBOX-CTA). Su
  `syncLead()` es un `console.log` placeholder (cablear a Supabase/Kommo aparte si querés capturar el lead).
- **Prereq:** mergear `feat/guia-comprar-alibaba` primero (o cherry-pick el archivo) para que la URL exista.

## Decisión de enfoque
La Academia ya embebe herramientas en una lección vía la columna `academy_lessons.widget` (hoy solo
`'alibaba_address'` → componente `AlibabaAddressGuide`). Reusamos ese patrón con un **widget nuevo
`'alibaba_curso'`** que hace `iframe` de la guía. (Es lo más limpio dado tu `LessonSeed.widget`; un
`video_url` crudo no calza porque `LessonSeed` no expone `video_url`.)

## Paso 1 — Migración: habilitar el widget `alibaba_curso`
Número libre en tu rama (en `main` el último es 0150 → posible `0151`). **Verificá el nombre real del
constraint** que puso la migr `0149` antes de recrearlo.

```sql
-- 0151_academia_widget_alibaba_curso.sql
alter table academy_lessons drop constraint if exists academy_lessons_widget_check;
alter table academy_lessons add constraint academy_lessons_widget_check
  check (widget is null or widget in ('alibaba_address', 'alibaba_curso'));
```
> Recordá: invocá los 2 skills de Supabase antes de tocar la DB; si la función/objeto necesita permisos,
> `revoke ... from public, anon`. Acá es solo un CHECK, sin grants.

## Paso 2 — Tipos: sumar el valor al union
- `lib/studio/academia/types.ts`: el `widget` de `AcademyLesson` (si falta el campo, agregalo) →
  `widget?: "alibaba_address" | "alibaba_curso" | null`.
- `scripts/seed-academia.ts`: `interface LessonSeed { … widget?: "alibaba_address" | "alibaba_curso"; }`.

## Paso 3 — Componente que embebe la guía
Vive en `components/` (frontera OK: solo design-tokens, reusable público↔portal), espejo de `AlibabaAddressGuide`.

> **MARKBOX automático en el portal.** Como el cliente está logueado, le pasamos su MARKBOX (y nombre) por
> querystring al iframe. La guía lee `?mark=` y **pre-llena** el campo MARKBOX + arma el Destinatario solo
> (`林冠 DTD-1042` desde SDD-0263 — Alibaba exige chino en ese campo) + saluda + refuerza que lo ponga en la
> dirección. **Sin `?mark=` = guía pública/manual**
> (placeholder `DTD-XXXX`). El mark se sanitiza en la guía (solo `A-Z0-9-`, se le antepone `DTD-` si falta).

```tsx
// components/AlibabaCursoGuide.tsx
"use client";

export function AlibabaCursoGuide({ markbox, name }: { markbox?: string; name?: string }) {
  const qs = new URLSearchParams();
  if (markbox) qs.set("mark", markbox);   // ej "DTD-1042"
  if (name) qs.set("name", name);         // opcional, solo para el saludo
  const src = "/guias/comprar-en-alibaba.html" + (qs.toString() ? `?${qs}` : "");
  return (
    <iframe
      src={src}
      title="Cómo comprar en Alibaba — guía interactiva DTD"
      loading="lazy"
      className="w-full rounded-xl border"
      style={{ height: "80vh", minHeight: 560, borderColor: "var(--color-grey-200)" }}
    />
  );
}
```

## Paso 4 — Render en la lección
`app/portal/(app)/academia/[courseId]/[lessonId]/page.tsx`, junto al bloque que ya checa
`lesson.widget === "alibaba_address"`, agregá la rama gemela:

```tsx
{lesson.widget === "alibaba_curso" ? (
  <section className="flex flex-col gap-2">
    <AlibabaCursoGuide markbox={clientMarkbox} name={clientName} />
  </section>
) : null}
```
`clientMarkbox` ya lo tenés en la página: el portal academia resuelve el cliente con
`get_portal_client_markbox()` (mismo dato que usa el progreso). `clientName` es opcional (solo el saludo).
Y, si querés, el badge "Herramienta" del course-detail (`[courseId]/page.tsx`) para `alibaba_curso` igual que
para `alibaba_address`.

## Paso 5 — Sembrar la lección (elegí dónde)
La guía interactiva es, sola, una mini-experiencia completa (9 etapas + calculadoras + captura). Dos opciones:

- **A (recomendada): como lección preview en `curso-0-guia-rapida`** (el lead-magnet gratis que ya existe).
  En `scripts/seed-academia.ts`, dentro de ese curso, agregá al módulo de bienvenida:
  ```ts
  { title: "Guía interactiva: comprar en Alibaba paso a paso", min: 15, freePreview: true, widget: "alibaba_curso" },
  ```
- **B: como el curso `comprar-en-alibaba` del outline** ([outline](../specs/0099-guia-comprar-alibaba/assets/outline-curso-academia.md)):
  curso nuevo `tier: "gratis"`, con esta guía de centro + el PDF (`guia-comprar-alibaba.pdf`, lección
  `kind: descarga`) + las 10 lecciones-video cuando Sam grabe. La guía interactiva = la lección estrella
  `widget: "alibaba_curso"`, `freePreview: true`.

El seed es idempotente (find-or-insert por slug/title) y resuelve `tenant_id` como los demás cursos — no
inventes otra vía.

## Paso 6 — PDF descargable (de paso, ya que estás)
La lección de descarga del outline apunta a `guia-comprar-alibaba.pdf` (en
`docs/specs/0099-guia-comprar-alibaba/assets/`). Subilo a Storage y poné su path en `asset_path` (la migr
0144 ya tiene la columna; el botón de descarga lo agrega la UI de portal si aún no está).

## Verificación
- `pnpm tsx scripts/seed-academia.ts` (o el workaround `node --env-file=.env.local node_modules/.bin/tsx …`).
- Portal → curso → lección con `alibaba_curso`: la guía carga en el `iframe`, el chino renderiza, los CTA
  abren WhatsApp/registro.
- `node scripts/verify.mjs` verde.

## Alternativa sin código (si preferís cero portal-edit)
Si tu render de `kind: "video"` hace `iframe` del `video_url` crudo (no solo YouTube), podés saltarte los
pasos 1-4 y sembrar una lección `kind: "video"` con `video_url = "/guias/comprar-en-alibaba.html"`. Requiere
exponer `video_url` en `LessonSeed`. Es un atajo; el widget (pasos 1-4) es lo explícito/limpio.
