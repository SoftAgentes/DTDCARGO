# 2026-10-07 — Carrusel de fotos de la empresa · Worker → Director

Dueño: Worker carrusel · Sesión: 01a116a5-3174-7c20-8a71-83cde364b3b3.
Estado: LISTA PARA REVISIÓN LOCAL CON BLOQUEOS GENERALES. SDD-0503 conserva in-progress.
Owner: worker-carrusel-01a116a5-3174-7c20-8a71-83cde364b3b3.

## OBJETIVO ORIGINAL

Sustituir el grid fotográfico de #operacion de la home por un carrusel manual con las ocho fotos aportadas por Sam. Portada fija; conservar otra foto de home, video principal, clips y VideoObject. Alcance y captions: docs/specs/0503-carrusel-fotos-empresa/spec.md.

## COMPLETADO

- CompanyPhotoCarousel client aislado, integrado exclusivamente en OperationGallery. Foto completa, caption y contador; anterior/siguiente, miniaturas, flechas de teclado, Home/End y swipe horizontal conservando scroll vertical. Foco visible y anuncio moderado.
- Marco estable: cuadrado móvil, 16:9 desde sm; object-contain, sin cortar escenas/personas/logos. SSR inicial y sin JS útiles; navegación sin autoplay ni animación, compatible con reduced-motion. Next/image diferido: una imagen grande montada, miniaturas con sizes pequeñas.
- Ocho WebP: 34.084–167.322 bytes, sin ampliar originales, máximo 1600 px. Redacciones sólidas localizadas en pantallas/documentos, identificación de contenedor y placas. EXIF/XMP/IPTC/ICC ausentes. Originales intactos mediante hashes antes/después; no identificar personas ni inventar lugares/fechas.
- Spec, QA, índice generado y enlace marketing actualizados; allowlist exacta de 17 archivos, sin rutas ajenas. Preservación de constantes video/JSON-LD/clips contrastada contra base.
- Lecturas: AGENTS/Worker/runbooks; BRAND/diseño/Norte; ingeniería/marketing/docs; revisar-datos-ve aplicada exclusivamente a fotos; ui-check inline según instrucción real. No revisión de DB ni acceso a filas.

## VALIDACIÓN

Detalle y matriz completa en docs/specs/0503-carrusel-fotos-empresa/qa.md.
Producto probado: 55a9a1bdadf08fe3de9f0ddd6a1f9fb8f495b826; cierre documental posterior no cambia componentes ni imágenes.

- PASÓ: cinco tests componente, diez e2e propios en Chromium/Chrome móvil/WebKit móvil; dos SKIPs de capturas duplicadas. Capturas 390/1440, horizontal/vertical, foco, targets >=44 px, altura constante, sin overflow y SSR sin JS.
- PASÓ: mutante sin navegación detectado por tres tests; original volvió a 5/5, sin modificar código fuente.
- PASÓ: ui-check, lint acotado sin warnings, typecheck, RSC, cuatro Edge Functions, 201 tests harness y 8918 Vitest generales. Vitest conserva una prueba/archivo omitidos.
- PASÓ: build canónica Turbopack y postbuild. Build independiente previa PASÓ. Cambios temporales de tsconfig restaurados; árbol de producto limpio tras verify.
- PASÓ: docs:check, sdd:check, feature/constants, registro componentes/gobernanza, símbolos de migración pendientes, diff --check y allowlist.
- FALLÓ: pnpm verify exit 1, 14/17 pasos medidos; lint general heredado por plugin react-hooks no registrado.
- COBERTURA PARCIAL: e2e general, 162 aprobadas, 35 omitidas, una flaky CBM aprobada al reintentar; salida no limpia por cierre WebKit Windows. Quince pruebas omitidas por Supabase público ausente; no confundir OK con aviso del harness con proceso limpio.
- NO EJECUTADO: migrations-applied sin credenciales. NO DISPONIBLE: SQL/schema-rebuild sin Docker. No se introdujeron .env, credenciales, lecturas productivas ni migraciones.

## COMMITS

- Base producto: 675aac534b62862a979e97b07351ef79961c5af5.
- Reserva conservada: 31259d718713bc89e8b1b0a5fcfdbaa72df3d45d; ref codex/sdd-reserve-0503-carrusel-fotos-empresa / refs/dtd/reservations/0503, local.
- Definición Director conservada: 82f087c8b4cc420b7e5ccf41e4b43998d11210c7.
- Implementación/evidencia: 55a9a1bdadf08fe3de9f0ddd6a1f9fb8f495b826 — feat(DTD-0503): carrusel manual de equipo y operación.
- Cierre: commit que contiene este documento — resultados finales y límites de validación. Sin recursión de hash propio.

## PR / BRANCH

PR: no creada; publicación no autorizada. Rama: codex/carrusel-fotos-empresa-20261007.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrusel-fotos-empresa-20261007.
Base origin/main revalidada por fetch sin prune: 675aac534b62862a979e97b07351ef79961c5af5. Consulta PR abiertas no devolvió coincidencias en OperationGallery/CompanyPhotoCarousel/public/fotos; no demuestra ausencia de trabajo no publicado.
Sin push, merge ni despliegue. Trabajo local sin respaldo remoto; rama/worktree conservados.

## PENDIENTES DE ESTA TAREA

- Director revisa entrega visual y redacciones, y resuelve el gate general fallido o registra excepción explícita. SDD no pasa a done con estos límites pendientes.
- Conservar las comprobaciones sin medir y cobertura parcial en la decisión de integración/release; no requieren tocar producción para revisar el carrusel.
- Autorizar publicación/PR, integración y producción por separado si se desea avanzar. No hay implementación adicional pendiente dentro del carrusel.
- Autoría, lugar/fecha y documentación de autorización de las personas: NO VERIFICABLE en la revisión técnica local. Las fotos fueron aportadas por Sam para el encargo; no se certifica cumplimiento legal.

## FUERA DE ALCANCE DETECTADO

- Lint general: react-hooks/set-state-in-effect sin plugin registrado en el alcance de ESLint completo. Los componentes permitidos pasaron lint. No modificar eslint.config.mjs en esta tarea.
- E2E general: cierre WebKit Windows no limpio y prueba CBM flaky; el carrusel propio pasó sin reintentos.
- Dos archivos legales con advertencias Graphify de extracción parcial: LegalClient.tsx y legal/expediente/[code]/page.tsx. No reparados ni presentados como extracción completa.
- Colisiones históricas de numeración exentas por el gate, conservadas. No limpieza de otros worktrees ni ramas.

## HANDOFF AL DIRECTOR

Evidencia local ignorada: outputs/carrusel-0503/ (qa, unit/e2e/verify/build logs, manifest hashes, scope y preservación; capturas home/gallery 390/1440). No enviar ni publicar fotos originales.
Guard/claim revalidados antes del commit; owner exclusivo desde árbol limpio 82f087c8. Liberación al entregar registrada en outputs/carrusel-0503/ownership-release.log; verificar ausencia del claim al retomar. Servidor local de esta sesión se cierra al entregar; no eliminar rama/worktree.

Conocimiento por capas:
- Canónico guardado en rama: spec/QA/marketing/handoff. Integración PENDIENTE.
- Graphify 0.9.61: estructura CURRENT comprobada en implementación; recibo semántico marketing APPLIED (10 nodos/9 relaciones), única fuente piloto modificada. 1/16 fuentes piloto verificadas en este worktree; 1166 pendientes globales en el snapshot de aplicación, conservados explícitamente.
- Grafo y derivados se refrescan después de este commit documental; revisión final exacta en outputs/carrusel-0503/knowledge-final.json.
- Archify 2.16.0: nueve checks aprobados; mapa se reconstruye tras cambiar el grafo. JSON canónico docs/architecture/knowledge-lifecycle.archify.json; HTML/SVG/JSON evidencia en graphify-out/knowledge-visual. Logs finales archify-delivery-final.json / archify-validation-final.json.
- Preview Obsidian local: graphify-out/obsidian-preview; revisión exacta y resultado en knowledge-preview.json / knowledge-final.json. Bóveda habitual NO PUBLICADA; apertura en interfaz Obsidian NO EJECUTADO.
- Documentos de tarea fuera del piloto conservan pendientes semánticos globales; no declarar cobertura completa. Director integra/publica únicamente con autorización desde main comprobado.
