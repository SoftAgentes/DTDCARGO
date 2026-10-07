# QA · SDD-0503 · Carrusel de fotos
Dueño: Worker SDD-0503 · Fecha: 2026-10-07 · Estado actual: carrusel original integrado/publicado por PR191; ajuste de retiro de cinta en validación.

Entrega original: PR191; merge ae198419fea5d94d95fc26721952a7be6f7edee9; deployment dpl_31PymZTALo4DzHMsofaKVPjazmWQ READY confirmado por Director. PR191 conserva evidencia pública y excepción acotada del cierre original. Los resultados siguientes son la fotografía histórica anterior a esa integración, no el estado actual de publicación.

## Evidencia histórica del carrusel original · antes de PR191
Rama: codex/carrusel-fotos-empresa-20261007. Base: 675aac534b62862a979e97b07351ef79961c5af5.
Evidencia local ignorada: outputs/carrusel-0503/. No publicada.
## Privacidad fotográfica
CORRECTO: los derivados fueron inspeccionados visualmente; pantallas/documentos, ID de contenedor y placas redactados por regiones. EXIF/XMP/IPTC/ICC ausentes con sharp.metadata; SHA-256 de cada original idéntico antes/después. No se identificó a las personas ni se extrajeron datos.
NO VERIFICABLE: autoría, fecha/lugar y base documental de autorización de cada persona. Las fotos fueron proporcionadas por Sam para esta tarea. La revisión técnica no certifica cumplimiento legal.
## Pesos

| Derivado | Dimensiones | Bytes | Regiones redactadas |
|---|---|---|---|
| public/fotos/dtd-cargo-atencion-mapa.webp | 1600 × 904 | 145692 | 0 |
| public/fotos/dtd-cargo-equipo-oficina.webp | 1024 × 1024 | 43384 | 4 |
| public/fotos/dtd-cargo-equipo-contenedor.webp | 830 × 632 | 34084 | 5 |
| public/fotos/dtd-cargo-carga-consolidada.webp | 756 × 767 | 45458 | 0 |
| public/fotos/dtd-cargo-operacion-puerto.webp | 832 × 1248 | 60230 | 0 |
| public/fotos/dtd-cargo-recepcion-contenedor.webp | 896 × 1184 | 89110 | 1 |
| public/fotos/dtd-cargo-descarga-bodega.webp | 1600 × 905 | 149332 | 1 |
| public/fotos/dtd-cargo-camion-entrega.webp | 1024 × 1024 | 167322 | 2 |

El método reproduce derivados con redacciones sólidas locales y WebP calidad 80/effort 6, sin ampliación, máximo 1600 px. Todas las fotos quedan bajo 300 KB. Manifiesto local: images.json con hashes, dimensiones, coordenadas y comprobaciones.
## UI-CHECK · revisión antes del commit
Fuente: .claude/commands/ui-check.md; alcance OperationGallery y CompanyPhotoCarousel; revisión read-only de diff y capturas 390/1440.
- Marca: navy/paper/wine y radios existentes; Archivo heredada. Sin colores, fuentes o animaciones nuevas.
- Jerarquía: encabezado alineado a la izquierda, caption fuera de foto, contador independiente.
- Estados: hover y focus-visible; selección por aria-pressed y doble anillo, además del color. No existe estado disabled: navegación circular.
- Accesibilidad: controles y miniaturas medidos >=44 × 44; foco conservado en activación teclado; región y anuncio moderado aria-live.
- Marco estable, foto completa con object-contain, sin scroll horizontal en los dos anchos.
- Composición nueva marcada TODO: brand-review; no se cambian componentes Studio.
Veredicto: OK para commit; cero hallazgos altos/medios. Redacciones sólidas visibles deliberadamente para impedir recuperación de datos; revisión estética final corresponde a Sam/Director.
La referencia heredada de ui-check a MARKBOX/fuentes antiguas se interpreta según BRAND.md y las reglas vigentes del repositorio.
## Validación funcional local
- PASÓ: cinco pruebas de componente; la batería general posterior también ejecutó el archivo final. SSR, controles, recorrido circular, miniaturas, foco, teclado, swipe/cancelación y ausencia de avance automático.
- PASÓ: e2e-final3.log, 10 pruebas en Chromium, Chrome móvil y WebKit móvil. Dos SKIPs deliberados evitan duplicar capturas; las capturas requeridas 390 y 1440 se ejecutaron en Chromium.
- PASÓ: comprobación visual de fotos horizontal/vertical, marco sin salto, ausencia de overflow, targets >=44 px y conservación de tres videos al activar carga diferida; VideoObject sigue con su contexto Yiwu.
- PASÓ: lint acotado sin warnings; typecheck y rsc-boundary dentro de verify.
- PASÓ: docs:check, sdd:check y git diff --check. Numeración conserva excepciones históricas.
- Batería general observada: 201 pruebas harness; 8918 Vitest aprobadas y una omitida. verify terminó con exit 1: 14/17 pasos ejecutados; fallo de lint general, tres pasos omitidos y e2e parcial.
- FALLÓ: lint general, ESLint referencia react-hooks/set-state-in-effect sin plugin registrado en el alcance general. Configuración heredada fuera de allowlist; lint de componentes de la tarea pasó.
- NO EJECUTADO: ledger de migraciones (sin credenciales); SQL y reconstrucción de esquema (Docker no disponible). No se introducen credenciales ni DB en esta tarea.
- Evidencia: home-390.png/home-1440.png; gallery-390.png/gallery-1440.png; gallery-portrait-390.png/gallery-portrait-1440.png; images.json, unit.log, e2e-final3.log y verify.log bajo outputs/carrusel-0503/.

## Cierre definitivo de producto

SHA de implementación: 55a9a1bdadf08fe3de9f0ddd6a1f9fb8f495b826; el commit de cierre documental no cambia producto.

| Comprobación | Resultado | Evidencia y límite |
|---|---|---|
| pnpm verify | FALLÓ | Exit 1; 14/17 pasos ejecutados. Un fallo: lint general. Cierre incompleto por tres pasos críticos sin medir y e2e parcial. |
| Harness | PASÓ | 201/201 pruebas. |
| Lint de componentes de esta tarea | PASÓ | Sin errores ni warnings; lint-scope.log. |
| Lint general | FALLÓ | Configuración heredada react-hooks/set-state-in-effect sin plugin; no se modifica fuera de allowlist. |
| rsc-boundary / typecheck / Edge Functions | PASÓ | Sin cruces RSC; TypeScript aprobado; cuatro Edge Functions compilan. |
| Vitest general | PASÓ con omisión | 656 archivos aprobados, uno omitido; 8918 pruebas aprobadas, una omitida. Archivo del carrusel aprobado. |
| docs:check / numbering / feature-constants / components:check / governance:check / pending-migration-symbols | PASÓ | Índice 489 specs; excepciones históricas conservadas; cero símbolos pendientes rojos/amarillos. |
| migrations-applied | NO EJECUTADO | Sin credenciales; no se consultó ni modificó producción. |
| sql-tests / schema-rebuild | NO DISPONIBLE | Docker no disponible. |
| e2e general | COBERTURA PARCIAL | 162 aprobadas, 35 omitidas, una flaky CBM en Chrome móvil aprobada al reintentar; error de cierre WebKit Windows ajeno a tests. Harness lo reportó OK con aviso. Quince omisiones específicas por Supabase público ausente. |
| Build canónica y postbuild | PASÓ | Build de producción Turbopack dentro de verify; tsconfig restaurado y salida aislada retirada. Build independiente previa también PASÓ. |
| Contrato propio de carrusel | PASÓ | 10 pruebas de navegador, dos SKIPs de capturas duplicadas. Cinco pruebas de componente. |
| Mutante de navegación congelada | PASÓ | Transformación sólo de prueba: tres tests fallaron con setIndex(0); componente real volvió a 5/5. Código fuente intacto. |
| Conservación y allowlist | PASÓ | preserved.json: portada/app/page, globals, calculadora, clips, constantes de video y VideoObject iguales a base. scope.json: 17 archivos permitidos, cero ajenos. |
| git diff --check | PASÓ | Antes de ambos commits, staged incluido. |

## Conocimiento por capas

- Guardado canónico: spec, QA, enlace en marketing y handoff local. Integración: PENDIENTE; sin push/PR.
- Graphify 0.9.61: estructura comprobada CURRENT en 55a9a1bd. Dos archivos legales existentes con advertencias de extracción parcial; no se ocultan. Recibo semántico de marketing APPLIED: 10 nodos/9 relaciones, una fuente verificada y 1166 pendientes globales en ese snapshot. La única fuente piloto modificada por la tarea está verificada; el resto del piloto de este worktree permanece pendiente.
- Archify 2.16.0: nueve checks PASÓ en el snapshot estructural; cambio semántico invalidó ese mapa por hash. El mapa final se reconstruye contra el grafo del commit de cierre; archivos JSON/HTML/SVG y evidencia en graphify-out/knowledge-visual/, con logs archify-delivery-final.json y archify-validation-final.json.
- Preview Obsidian local: revisión y resultado exactos en outputs/carrusel-0503/knowledge-preview.json y knowledge-final.json; destino graphify-out/obsidian-preview. Bóveda habitual NO PUBLICADA. Lectura en interfaz Obsidian: NO EJECUTADO.
- No se declara cobertura semántica global ni actualización de la bóveda compartida. Los recibos y las capturas son evidencia local ignorada, conservada en este worktree.

## Límites históricos y actualización de estado

Los pendientes de push/PR/integración/despliegue descritos en el snapshot histórico se resolvieron mediante PR191 y el deployment indicado arriba. Las omisiones originales y su excepción permanecen documentadas. Director identificó el generador auxiliar .cjs bajo outputs como causa del lint original; ese diagnóstico posterior no reescribe el resultado observado de aquella corrida. No se agrega un generador .cjs en este ajuste.

## Ajuste posterior · retiro del clip de cinta doortudoor

Owner: retirar-video-cinta-doortudoor-20261007. Rama: codex/retirar-video-cinta-doortudoor-20261007. Base: ae198419fea5d94d95fc26721952a7be6f7edee9. Evidencia ignorada propia: outputs/retirar-video-cinta-0503/.

Sam pidió retirar la cinta que dice doortudoor y precisó «cointa dice doortudoor no dtd cargo». Se retira únicamente la entrada CLIPS correspondiente y su leyenda; archivos multimedia conservados. Shipping Mark pasa a una sola columna con max-w-[300px] aprobado por Director. Principal/VideoObject y ocho fotos/controles se conservan.

Validación propia y revisión visual parcial completadas; cierre canónico FALLÓ por ejecución de procesos y batería móvil incompleta. Se publica PR draft para obtener CI sobre el head exacto y conservar la decisión de Director. No se incorporan credenciales ni se consulta/escribe producción. El retiro aún no está integrado ni desplegado.

| Comprobación del ajuste | Resultado | Evidencia y límite |
|---|---|---|
| Dependencias con lockfile congelado | PASÓ | pnpm install --frozen-lockfile; sin cambio de lockfile ni copia de credenciales. |
| Componente del carrusel | PASÓ | 5/5 pruebas; component.log. |
| Navegador Chromium | PASÓ | 4/4 en e2e.log: recorrido completo, controles/foco/teclado, SSR sin JS, swipe/reduced-motion, fotos verticales, dos videos con fuentes/posters preservados y ausencia de cinta. Sin retries. |
| Chrome móvil | COBERTURA PARCIAL | Prueba manual con recorrido y videos PASÓ. El resto no se ejecutó: worker detenido y spawn EINVAL; entradas de 0 ms no acreditan aserciones fallidas. |
| WebKit móvil (proyecto mobile-safari) | NO DISPONIBLE | El runner no pudo iniciar sus workers (spawn EINVAL). Sin prueba efectiva de producto ni retries. |
| Capturas y layout 390/1440 | PASÓ | home/operation/gallery/gallery-portrait PNG revisados. El bloque y frame de Shipping Mark tienen el mismo ancho <=300 px; sin segunda columna reservada ni overflow horizontal. |
| /ui-check proporcional | PASÓ | Retiro exclusivo y columna única con ancho existente aprobado; sin nuevos colores/fuentes/radios/controles. Principal, carrusel y captions conservados. Sin hallazgos altos/medios propios del cambio. Captura de sección incluye la cabecera sticky por la posición de scroll; la captura propia del carrusel y sus pruebas conservan la evidencia de controles. |
| pnpm verify | FALLÓ | verify.log: harness 201/201, lint (0 errores/15 warnings), RSC, typecheck y 4 Edge Functions PASÓ. Vitest terminó con exits 1073807364 y 3221226091; después nueve checks y build fallaron con exit señal null. No existe un resultado de compilación canónica aprobado. |
| E2E GENERAL | NO EJECUTADO | VERIFY_SKIP_E2E=1, excepción acotada explícita de Director; la omisión permanece visible. |
| Ledger de migraciones / SQL / schema-rebuild | NO DISPONIBLE | No llegaron a medirse en la corrida por fallo de lanzamiento de procesos (señal null); sin credenciales copiadas ni producción consultada/escrita. |
| Build adicional Webpack | NO EJECUTADO | La corrida canónica no llegó a mostrar fallo next/font de Turbopack; no se inventa ese diagnóstico ni un fallback aprobado. CI alojada pendiente. |
| docs:check / sdd:check / diff --check independientes | PASÓ | Reejecución proporcional tras el fallo de lanzamiento; índice 489 specs, numeración sin nuevas colisiones, diff limpio. |
| Conservación y scope | PASÓ | CompanyPhotoCarousel, LazyVideo, fotos, archivos multimedia, app/page, globals y lockfile iguales a la base; constantes del principal y VideoObject intactas. Seis rutas cambiadas, todas permitidas. |

Diagnóstico acotado: el servidor propio arrancó tras timeouts de fuentes Google; Chromium ejecutó sus aserciones y obtuvo las capturas. Más tarde Playwright informó Error: spawn EINVAL en WorkerHost.startRunner; verify informó los exits anteriores y fallos de proceso sin stdout de los checks. Estos logs demuestran una falla de ejecución; no proporcionan un stack de regresión de producto ni una causa raíz confirmada. Se conservan completos sin reescritura. No se alteró la configuración de tests ni se reintentaron tests automáticamente.

Conocimiento: lectura/revisión semántica de marketing completa (249 líneas, sin YAML), conservando 33 nodos/33 relaciones/1 hiperarista del recibo canónico y cambiando solo el nodo/referencia SDD-0503. Fragmento y revisión preparados bajo graphify-out/retirar-cinta-0503-marketing.json y .review.json; aplicación pendiente contra el commit de entrega. Graphify 0.9.61 alcanzó extracción AST 4424/4424 y conservó advertencias de dos fuentes legales ajenas; sin recibo/exportación estructural final no se declara CURRENT. Archify 2.16.0 y preview Obsidian pendientes, sin publicar bóveda compartida. Director coordina cierre integrado.

Pendientes del ajuste: CI/build sobre el head exacto, completar pruebas móviles propias, revisión Director e integración/publicación autorizada, más recibo semántico/derivados locales e integrados que correspondan. La publicación original de PR191 sigue diferenciada de este retiro.
