# Handoff — SDD-0611 · Ajustes antes de encender, más los pendientes de la #422

| Campo | Valor |
|---|---|
| Owner | Worker `wizardly-murdock` (sesión de la #417, la misma ruta con una rama nueva) |
| Sesión que encargó | Subdirector «SEO, GEO y AEO» (`local_61442abe-3b66-423e-9af4-8008d5457aa3`), por orden del DG |
| Ruta | `.claude/worktrees/wizardly-murdock-7db565` |
| Rama | `claude/noticias-ajustes-0611`, nacida en main `9019d3997`, con main `e74cde6fc` (fast-forward) y `7f01a3bb5` (merge) traídos |
| Fecha | 2026-11-09 |
| SDD | 0611 (y la SDD-0613 para `seo.md`) |
| Migración | Ninguna todavía. `NNNN` espera su número del DG |

## OBJETIVO ORIGINAL

Antes de encender la publicación automática o enganchar `news_publicar_manual`, cerrar los hallazgos de las revisiones de la #417 que no bloqueaban. Además, el DG sumó a esta PR lo no bloqueante de la #422.

El plan completo está en la nota compartida del Subdirector (`plan-segunda-pr-0611-antes-de-encender.md`).

## COMPLETADO EN ESTA PR

1. **`86e1200b9` (docs):**
   - la spec 0611 §11.2 registra la 0518 aplicada, con version, COMMIT y evidencia de prueba y producción, y apunta a `cierre-migraciones-20261108.md`;
   - C5: el conteo previo a un `VALIDATE` usa `news_texto_tiene_marca`, igual que el CHECK;
   - governance, `agente-seo-noticias.md` y el plan maestro dejan de decir que la 0518 está sin aplicar;
   - el handoff de la 0611 suma «Estado de la 0518» y las decisiones de Sam.
2. **`fc24ed53d` (pruebas de la #422):**
   - `__tests__/seo-auditoria-json-ld.test.tsx` recorre cada `<WebPageJsonLd …/>` sin depender del orden de las props, y lee el logo del layout dentro de su bloque, que debe ser uno solo;
   - `components/Nav.drawer-inert.test.tsx` cambia de nombre para decir lo que mide: los atributos, no el foco.
3. **`0c8b7c931` (docs de la #422):**
   - `docs/marketing/seo.md` suma la auditoría del 2026-11-07, los 4 arreglos, la tabla de laboratorio y P-a a P-k;
   - el handoff de la #422 corrige la frase «sin merge con main».

## Decisiones de Sam (2026-11-08, transmitidas por el Subdirector)

- **C2:** «Quedan sin autor». `seo_drafts.created_by` pasa a `on delete set null` y deja de ser NOT NULL.
- **13:** «Sí, sigue contando». Una automática que una persona edita sigue contando en F7. Solo se recalcula `content_sha256`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `spec-migration-refs.test.ts` | PASÓ, 5/5 |
| `seo-auditoria-json-ld.test.tsx` y `Nav.drawer-inert.test.tsx`, `--maxWorkers=1` | PASÓ, 6/6 |
| Mutante: props reordenadas y sin `name` en `/fcl` | PASÓ: cae en «todas las páginas que lo usan le pasan name y description». Con el mismo cambio, el patrón viejo encontraba 0 usos en `/fcl`: solo lo atajaba el piso |
| Mutante: el logo del layout sin `width` | PASÓ: cae en «el logo del layout no declara width» |
| Archivos restaurados después de los mutantes | PASÓ (`git status` limpio en `app/`) |
| eslint de las dos pruebas / `tsc --noEmit` | PASÓ / PASÓ |
| docs:check, sdd:check, governance:check y `diff --check` | PASÓ |
| `pnpm verify`, build, Docker y e2e | NO EJECUTADO, por orden del encargo |
| CI de GitHub | La #485 se marcó lista el 2026-11-09 para que corra la Calidad; la vigila el Subdirector |

## PENDIENTES DE ESTA TAREA

- **C1:** la lista explícita de columnas en `lib/public/news-queries.ts` (4 llamadas).
  - Espera el catálogo de `news_posts` en producción (lectura del DG): hay seis columnas dudosas que el sitio usa y que ninguna migración crea.
  - La prueba ya está escrita, sin commit, en `lib/public/__tests__/news-queries-columnas.test.ts`. Contra el código de hoy da roja, como se espera.
  - **Va en una PR siguiente** (decisión del Subdirector del 2026-11-09, opción b: Sam pidió avanzar), junto con el arreglo. No entra en la #485.
- **`NNNN`:** C2 con la opción A, el motivo obligatorio en `news_salida_motivo`, el revoke de EXECUTE a anon en `news_texto_tiene_marca` y `news_huella`, y el recálculo de `content_sha256` al editar. Espera el número del DG. El SQL en borrador está en el plan. **También va en la PR siguiente.**
- Lo que sigue abierto en el handoff de la 0611 (C3, C4, C6 a C10, cron, pantalla de retiro y lo demás) no entra en esta PR, salvo que el DG lo pida.

## FUERA DE ALCANCE DETECTADO

- La línea de `WebPageJsonLd` en «Arquitectura SEO» de `seo.md` todavía nombra `/calculadora` y `/track`. Es la P4 de la SDD-0613.

## HANDOFF AL DIRECTOR

La #485 trae documentos y pruebas, y no enciende nada. Se marcó lista por la opción (b) del Subdirector. C1 y `NNNN` van en una PR siguiente. Encender la publicación automática pide el OK de Sam.
