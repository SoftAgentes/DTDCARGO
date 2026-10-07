# QA · SDD-0503 · Carrusel de fotos
Dueño: Worker carrusel · Fecha: 2026-10-07 · Estado: validación en curso.
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
- Batería general observada: 201 pruebas harness; 8918 Vitest aprobadas y una omitida. verify sigue en ejecución en este commit.
- FALLÓ: lint general, ESLint referencia react-hooks/set-state-in-effect sin plugin registrado en el alcance general. Configuración heredada fuera de allowlist; lint de componentes de la tarea pasó.
- NO EJECUTADO: ledger de migraciones (sin credenciales); SQL y reconstrucción de esquema (Docker no disponible). No se introducen credenciales ni DB en esta tarea.
- Evidencia: home-390.png/home-1440.png; gallery-390.png/gallery-1440.png; gallery-portrait-390.png/gallery-portrait-1440.png; images.json, unit.log, e2e-final3.log y verify.log bajo outputs/carrusel-0503/.
