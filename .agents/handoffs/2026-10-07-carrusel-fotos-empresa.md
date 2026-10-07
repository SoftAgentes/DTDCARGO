# 2026-10-07 — Carrusel de fotos de la empresa · Director → Worker

## Estado

EN PROGRESO · Worker worker-carrusel-01a116a5-3174-7c20-8a71-83cde364b3b3. Sesión 01a116a5-3174-7c20-8a71-83cde364b3b3. Claim adquirido tras comprobar rama, guard y árbol limpio en HEAD 82f087c8. Implementación y validaciones locales; sin publicación.

## Objetivo autorizado

Sam pidió actualizar las fotos de dtdcargo.com y convertir la sección fotográfica en carrusel. Confirmó el 2026-10-07 que va en la sección de fotos de la empresa. Aportó ocho archivos en `C:/Users/AKX generator/Documents/USB/DTD_Cargo_FotosWeb/`.

## Repositorio, base y ownership

- Principal de lectura: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree de esta tarea: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrusel-fotos-empresa-20261007`.
- Rama: `codex/carrusel-fotos-empresa-20261007`.
- Base de producto: `675aac534b62862a979e97b07351ef79961c5af5` (`origin/main`, fetch verificado 2026-10-07).
- Reserva: SDD-0503, commit `31259d718713bc89e8b1b0a5fcfdbaa72df3d45d`, ref local `codex/sdd-reserve-0503-carrusel-fotos-empresa` y lock numérico `refs/dtd/reservations/0503`. No publicada; otros clones no la ven.
- Preparación de documentos: owner `director-carrusel-01a10e1c`.
- Al entregar: Director libera su claim explícitamente y confirma estado limpio. Worker comprueba ausencia de claim, reclama con su propio owner y continúa en la misma rama, sin copiar cambios ajenos ni abrir una segunda sesión escritora.

## Completado por Director

- Ubicación definida con Sam y contraste de galería pública/código.
- Ocho archivos localizados; dimensiones y pesos registrados en SDD.
- Inventario SDD de 197 refs más worktrees; reserva local 0503 creada con el procedimiento canónico.
- Consulta de PR abiertas para rutas relacionadas: sin coincidencias devueltas; no certifica ausencia de trabajo no publicado.
- Spec con allowlist, aceptación, orden/copy propuestos y fronteras de autorización.
- No se copiaron imágenes al repositorio ni se editaron componentes del producto.

## Validación de preparación

- PASÓ: docs:check, índice sincronizado con 489 specs.
- PASÓ: sdd:check, sin números nuevos repetidos; conserva las excepciones históricas impresas por el gate.
- PASÓ: git diff --check, alcance exclusivamente documental. Antes del commit también se comprueba el diff staged.
- PASÓ: raíz y rama verificadas; sólo spec 0503, índice generado y este handoff fueron escritos.
- PASÓ: los ocho archivos originales se localizaron y se midieron sin modificarlos.
Producto (pnpm verify / build / interacción / visual móvil): NO EJECUTADO; corresponde al Worker después de implementar.

## Prompt Worker completo

```text
$worker

Objetivo: convertir el grid de fotos de #operacion en la home de dtdcargo.com en un carrusel responsive con las ocho fotos aportadas por Sam. La portada queda fija. Conservar video, clips y datos estructurados.
Task ID: 2026-10-07-carrusel-fotos-empresa / SDD-0503. Owner de ejecución: la nueva sesión Worker, con su propio ID al reclamar.
Repositorio principal de referencia: C:/Users/AKX generator/Desktop/Developer/DTDCARGO.
Trabaja exclusivamente en C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrusel-fotos-empresa-20261007, rama codex/carrusel-fotos-empresa-20261007. Base de producto verificada: 675aac534b62862a979e97b07351ef79961c5af5. La rama contiene la reserva y documentos de preparación; conservarlos.

Antes de escribir, verificar raíz/rama, leer AGENTS.md y .agents/skills/worker/SKILL.md de este árbol, comprobar el claim liberado y ejecutar guard/claim con tu owner. Si aún existe el claim Director, no invadirlo. Actualizar refs y comprobar cambios concurrentes sobre el alcance antes de implementar. No desarrollar ni cambiar rama en el checkout principal.

SDD: docs/specs/0503-carrusel-fotos-empresa/spec.md, reserva local durable del Director. Leerla y adoptar sus criterios dentro del objetivo autorizado; no escoger otro número ni publicar la reserva sin autorización. Leer BRAND.md, docs/design/README.md, Norte CLAUDE → HANDOFF → CHANGELOG, docs/engineering/project-rules.md, docs/marketing/README.md y el runbook de conocimiento. Aplicar la revisión de datos fotográficos según .claude/skills/revisar-datos-ve/SKILL.md, sin ampliar a una auditoría de DB.

Fuentes: C:/Users/AKX generator/Documents/USB/DTD_Cargo_FotosWeb/. La spec lista los ocho nombres exactos, los derivados permitidos, orden y captions propuestos. Mantener originales intactos; agregar sólo derivados web revisados, optimizados y sin EXIF/identificadores sensibles. No inventar nombres de personas, ciudades ni fechas.

Alcance exacto: componentes OperationGallery y CompanyPhotoCarousel, sus pruebas de comportamiento, e2e/company-photo-carousel.spec.ts, ocho WebP listados en la spec, spec/qa/índice generado, enlace/estado en docs/marketing/README.md y este handoff. No cambiar hero, app/page.tsx, globals.css, servicios, tarifas, calculadoras, CRM, ERP, APIs, DB, videos ni clips. La spec contiene allowlist exacta. Si hace falta ampliar, documentar la necesidad concreta para Director.

Aceptación: una foto grande, caption y contador; anterior/siguiente, miniaturas, swipe y teclado; foco visible y controles usables; proporciones sin cortar personas/logos/escena; layout estable en 390 y 1440 px; navegación manual sin autoplay; reduced-motion; contenido inicial SSR; carga diferida/next/image y pesos registrados. Título ampliado a equipo y operación, sin atribuir a Yiwu todas las fotos.

Dependencias: ninguna integración previa conocida; la consulta actual no encontró PR abierta sobre OperationGallery/public/fotos. Revalidar rutas y refs al iniciar. No absorber la PR #21 ni otros cambios de la home/marketing. Una sola sesión escritora; no subagentes de producto independientes.

Validación: pruebas de interacción proporcionales y capturas móvil/escritorio; /ui-check antes del commit visual; pnpm verify como cierre de producto, sin esconder SKIPs; pnpm docs:check, pnpm sdd:check y git diff --check. No copiar .env del principal, leer filas de producción ni aplicar migraciones. Registrar PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE con alcance y SHA.

Autorización: implementación, pruebas y commits locales de esta tarea. Push, PR, merge y despliegue todavía no autorizados en este intercambio. Terminar con una entrega local revisable; ninguna publicación externa para resolver un check.

Handoff: mantener .agents/handoffs/2026-10-07-carrusel-fotos-empresa.md con completado, validaciones, commits, pendientes propios y FUERA DE ALCANCE DETECTADO por separado. Registrar fuentes y cambios documentales; Graphify estructura/semántica, Archify y preview Obsidian por capas. Liberar tu claim al entregar, conservar rama y worktree, e informar qué necesita Director para revisar e integrar con autorización.
```

## Pendientes de esta tarea

- Iniciar una sesión Worker con este encargo; no hay Worker ejecutando esta implementación todavía.
- Implementar el carrusel, derivados fotográficos y documentación de marketing.
- Obtener evidencia funcional/visual y verify del SHA de implementación.
- Revisar la entrega; push/PR, integración y producción requieren sus autorizaciones correspondientes.
- La reserva y la coordinación son locales; no existe respaldo remoto de esta preparación.

## Fuera de alcance detectado

El inventario de numeración reportó colisiones históricas en otras specs/migraciones. No se renumeraron ni modificaron. El status de varios worktrees externos no pudo verificarse en el inventario inicial restringido; se conservaron y no se infirió inactividad.

## Conocimiento

En el principal, knowledge:status del 2026-10-07 devolvió ok=true, estructura CURRENT para 675aac53 y cobertura semántica global PENDING. La consulta Graphify de orientación local fue exitosa, con truncamiento visible; los componentes se contrastaron leyendo sus archivos. Esta tarea no actualizó Graphify/Archify ni publicó Obsidian. Los documentos de esta rama quedan PENDIENTES DE INTEGRACIÓN; el Worker debe registrar su propio impacto documental y evidencia por capa.

## Commits y cierre de preparación

Reserva: 31259d718713bc89e8b1b0a5fcfdbaa72df3d45d.
La definición y el handoff se conservarán en el commit que contiene este documento. No se publican ni integran automáticamente.
## Ejecución Worker · primer commit
Owner/sesión: worker-carrusel-01a116a5-3174-7c20-8a71-83cde364b3b3 / 01a116a5-3174-7c20-8a71-83cde364b3b3.
COMPLETADO: carrusel, ocho WebP revisados y documentación marketing/spec/QA; originales intactos. Interacción probada en tres navegadores; capturas 390/1440.
VALIDACIÓN: diez e2e pasaron con dos SKIPs de capturas duplicadas; cinco pruebas componente pasaron. Verify general todavía en curso; lint general falló por configuración heredada, lint del alcance pasó. Resultados completos en qa.md.
COMMITS: este commit contiene implementación y evidencia local disponible; cierre final en documento posterior.
PENDIENTES DE ESTA TAREA: terminar verify/build y cierre de conocimiento; no declarar SDD done mientras falten criterios.
FUERA DE ALCANCE DETECTADO: ESLint general sin plugin react-hooks registrado; Graphify reporta extracción parcial de dos archivos legales existentes. Mantener sin cambios.
HANDOFF AL DIRECTOR: entrega aún en validación. Claim sigue adquirido; sin push/PR/merge/deploy.
