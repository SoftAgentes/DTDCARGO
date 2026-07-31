# VIS-02 Gate V3 · PDF

| Control | Valor |
|---|---|
| Revisión | REV-VIS-005 |
| SDD | [SDD-0175](../../specs/0175-vis-02-tipografia-voz-idioma/spec.md) |
| Fecha | 2026-07-30 |
| Resultado | aprobado en un documento formal |

## Alcance

El gate migra un solo consumidor real: el packing list bilingüe del proveedor,
que se exporta mediante impresión del navegador.

- todo bloque chino declara `lang="zh-CN"`;
- pantalla, formulario y controles conservan Noto Sans SC;
- sólo `@media print` aplica `--f-cn-document`;
- el fallback sigue Noto Serif SC → Noto Sans SC → Archivo → sistema;
- recibos y finiquitos en español no cambian;
- no se añadieron binarios de fuentes al repositorio.

## Evidencia

La prueba contractual verifica el límite pantalla/impresión y que el alias
documental aparece una sola vez dentro de `@media print`.

La revalidación de integración, sin datos de negocio, produjo un PDF Chromium
de una página y 56.980 bytes. La inspección confirmó:

- pantalla y documento en pantalla: `Noto Sans SC`;
- documento bajo media print: `Noto Serif SC`, con webfont disponible;
- extracción completa del título, proveedor y fecha chinos mediante `pypdf`;
- render PNG sin tofu, recortes ni superposición.

El artefacto sintético quedó fuera del repositorio y se destruye al cerrar la
revalidación. La prueba no declara cobertura de PDFs server-side que no
contienen chino.
