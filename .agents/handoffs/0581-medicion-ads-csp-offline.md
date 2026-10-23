# Worker SDD-0581 — Medición Ads/CSP offline

Fecha: 2026-10-23. Estado: cierre local; implementación aceptada por Director; canónico INCOMPLETO.
Owner: `worker-0581-ads`; sesión `/root/worker_ads`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0581-medicion-ads-csp-offline`.
Rama: `codex/0581-medicion-ads-csp-offline`.
Base: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.
Reserva: `654d972afd3c0766c644340956c92a7e62bd7094`.
Spec: `docs/specs/0581-medicion-ads-csp-offline/spec.md`.

## OBJETIVO ORIGINAL

Diagnosticar medición Ads primero; corregir únicamente defectos justificados y
probar localmente. Commits locales autorizados, sin push, PR, merge, despliegue,
cuentas Ads/Analytics/Kommo, producción ni datos de personas.

## COMPLETADO

Inventario de gtag directo, eventos, consentimiento y CSP. El único cambio de
producto es lectura exacta de nombre/valor de cookie en init y helper, tras RED
real sintético aprobado por Director. Cookie ajena/valor inválido no concede
permiso; varias cookies visibles del mismo nombre conservan denied al iniciar.
No se limpian cookies de otros paths/domains ni se promete resolver persistencia.
Modelo v2, UI, IDs, eventos, valores, rutas privadas, fallback y apagado intactos.

Fixture Next release activa con fuentes copiadas byte a byte, loader inerte,
intercepción previa y proxy backstop; build completo GAoff para headers HTTP,
comparación de CSP y scan de chunks. Helper propio adaptado de 0580 sin dependencia
runtime del otro worktree. Marketing, QA, spec e índice actualizados.

CSP intacta: queda sospecha específica de pings denied a pagead2 documentada por
Google, pendiente de traza controlada real. No se declara CSP completa correcta.

## VALIDACIÓN

Resultados detallados y rutas de recibos en `docs/qa/0581-medicion-ads-csp-offline.md`.

- **PASÓ**: 267/267 focales, 32/32 E2E Chromium/WebKit, 12.294 pruebas generales
  en 861 archivos; una prueba/archivo de corpus comercial omitidos, sin documentos reales.
- **PASÓ**: release retenido, CSP HTTP real idéntica a fixture; 218 chunks con
  cero ID real GA/Ads. GAoff no sustituye la prueba activa sintética.
- Primer RED: ocho fallos esperados y cuatro controles sobre fuentes baseline.
- E2E inicial posterior: 16/32, carrera del probe Chromium; recheck 32/32 tras
  pestaña descartable y hashes verificados, sin cambios de producto posteriores.
- Canónico inicial **FALLÓ / INCOMPLETO**: lint recorrió derivados propios en
  .codex; se preservó y cortó solo su árbol tras revalidar PIDs. Derivados movidos
  a temporal propio, con manifest/hashes, sin borrado ni cambios ESLint/verificador.
- Canónico segundo: **PASÓ lo medido / CIERRE INCOMPLETO**, 12/17 pasos, cinco
  SKIPs críticos; build/postbuild pasaron. Harness 237/237, lint cero errores y
  15 warnings históricos, RSC 1.706 módulos, tipos y gates documentales pasaron.
- Envoltura offline segunda **FALLÓ** al final por tres denegaciones Git genéricas.
  Raw preservado; clasificación posterior mantiene DTD_OFFLINE_DENIED, no permiso
  para ejecutar fetch. Recheck existente ledger **PASÓ 36/36**, tres denegaciones
  esperadas y cero inesperadas, con cinco controles de contexto y ocho probes Node.
  Atribución por reproducción posterior; el raw original no tenía contexto suficiente.
- **NO EJECUTADO**: Edge, ledger productivo, SQL, reconstrucción y E2E global,
  con motivos en QA. No se repitió el canónico ni la suite general tras el auxiliar.
- Reparación de descubrimiento: RED 48 casos offline incluidos en el general;
  rename a `e2e/analytics-csp-offline.offline.ts` y testMatch propio. GREEN cero
  casos propios en el general, 32 en configuración propia, cuerpo byte a byte
  idéntico al ejecutado 32/32. Sin cambios en configuración general o producto.
- Conocimiento observado en bfc36c37: Graphify 0.9.61 estructura CURRENT, cero
  issues, 43.794 nodos / 79.875 aristas. Semántica PENDING, piloto 1/16 y global
  1/1325; README marketing importado con 15 conceptos / 14 relaciones. Archify
  2.16.0 build/check CURRENT, nueve checks / once fuentes. Obsidian PREVIEW:
  1.324 documentos, 43 warnings históricos, cero conflictos. Estado global
  `ok:false` por cobertura pendiente; no se presenta como conocimiento completo.

Recibos bfc en `.codex/qa/knowledge-{graphify-update,record,visual-build,visual-check,preview,status-final-observed}.json`;
resumen `knowledge-bfc-summary.json`. Instantánea c5 preservada en
`graphify-out/0581-observed-c5/`. Dos avisos nativos de parseo parcial históricos
en Legal siguen fuera del alcance. Runtime Archify cache verificado; sin descarga,
publicación compartida ni revisión humana de bóveda/mapa. Mapa autoral no certifica AST.

Las barreras son controles de ensayo y no una sandbox del SO. No se ejecutó JS
real de Google ni se usaron cuentas. Las colas locales no demuestran recepción,
cookies internas, deduplicación o atribución remotas. `value:1.0/USD` de click
WhatsApp es valor configurado, no ingreso comprobado; las señales GA son distintas.

## COMMITS

- Reserva: `654d972afd3c0766c644340956c92a7e62bd7094`.
- Implementación: `c5a4f253aca4554ed43174fffd9667b3eef8d7e2`, revisada por Director.
- Descubrimiento: `bfc36c37b8e42024043c19859718a8cd424963a3`, revisado y aceptado.
- Este cierre documental contiene solo spec/índice generado/QA/handoff; SHA
  informado al Director al entregar, sin recursión para guardar su propio hash.

## PR / BRANCH

Sin PR ni respaldo remoto. Rama y worktree se conservan.

## PENDIENTES DE ESTA TAREA

Ningún cambio local de producto o harness pendiente. El último commit documental
es posterior a los recibos bfc: sus revisiones/hashes quedan PENDING tras ese delta,
sin una nueva vuelta de derivados. Cobertura semántica parcial y omisiones del
canónico conservan sus límites. Integración/publicación no autorizadas; requieren
revisión de base/índice y actualización de capas desde main integrado comprobado.

## FUERA DE ALCANCE DETECTADO

Recepción/deduplicación/atribución en Google, acciones primarias/importadas, ventas
y estado real de campañas no verificados. Pings denied a pagead2 requieren traza
controlada antes de abrir CSP según el umbral P3. Duplicadas persistentes pueden
requerir limpieza independiente; este slice no elimina cookies de otros ámbitos.
Los SKIPs canónicos no se presentan como cobertura completa ni permiso de release.
Cobertura semántica global, advertencias históricas de enlaces y parseo parcial
de Legal no se absorben como reparaciones de esta tarea.

## HANDOFF AL DIRECTOR

Única sesión escritora indicada arriba. Director aceptó localmente c5 y bfc.
Se conservan worktree/rama, recibos y builds archivados propios; sin respaldo remoto.
Procedimiento final: verificar commit limpio, procesos propios y puertos Next
45811/45812 libres, guardar `.codex/qa/ads-final-state.json` y liberar claim como
última acción de la sesión escritora. La salida de release confirma esa acción
al entregar; el recibo conserva las comprobaciones previas.
Sin push, PR, merge, despliegue, cambios de cuentas ni publicación compartida.
