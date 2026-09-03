---
title: Parche compatible de fflate y frontera del replay
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0379 · parche compatible validado localmente

## Alcance

Mismo worktree y rama de saneamiento. Ningún push, main, Cloud, despliegue,
captura real ni cambio de flag. Manifest y allowBuilds no se modifican.

El advisory [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98),
revisado el2026-09-03, identifica el bucle ZIP64 de unzipSync y el backport
0.4.9. No se infiere explotación de una instalación real.

## Resolución y código incluido son cosas distintas

- Directo: fflate0.8.3 ya corregido. packlist usa unzipSync/zipSync;
  los generadores ZIP de Marca usan compresión. No se modifica ese paquete.
- rrweb2.0.0-alpha.4 declara ^0.4.4 y resolvía0.4.8. Override puntual
  rrweb@2.0.0-alpha.4>fflate→0.4.9; no salto incompatible a0.8.
- rrweb-player1.0.0-alpha.4 usa rrweb, pero distribuye un bundle propio.
  rrweb además incluye es/rrweb/ext/fflate/esm/browser.js.
  El override NO reescribe esas copias. Sus packers publicados usan
  zlibSync/unzlibSync, no el parser ZIP. Se comprobó import y código real.
- El flujo de la app serializa eventos como JSON y usa CompressionStream
  gzip / DecompressionStream gzip. No recibe archivos ZIP como replay.
  No se amplía la conclusión a cualquier uso futuro del paquete.
- Flag apagado salvo valor1 y máscara de texto conservados. No se habilita
  ninguna grabación real ni se afirma una auditoría de privacidad completa.

## Reproducción y controles

Primer fixture sólo alteraba tamaño del entry: ambas versiones lo aceptaban.
No se llamó RED causal: la serie0.4 selecciona ZIP64 desde EOCD.
Se corrigió el fixture leyendo el parser instalado: EOCD64+locator coherentes,
entry con sentinels y sin extra0x0001. Todo mide pocos cientos de bytes.

RED real previo al parche:2fallos/8controles correctos en10casos.
La dependencia0.4.8 agota3000ms del subprocesso propio;0.8.3 rechaza.
La otra expectativa detecta la resolución0.4.8. Nunca se ejecutó el parser
hostil en Vitest principal ni se usaron archivos recibidos de terceros.

Controles: ZIP normal Unicode/vacío, ZIP64 equivalente con extra válido en
ambas versiones, zlib bidireccional, pack/unpack real y formato v1.
Revisión independiente read-only validó el recorrido causal y límites;
sus dos mejoras opcionales (ZIP64 válido y MARK explícito) se incorporaron.

## Cadena de suministro y mediciones de red

Gestor local comprobado: pnpm11.19.0 / Node24.15.0; node_modules propio,
sin junction. La corrida E2E terminó antes de instalar.
Versión0.4.9 publicada2026-07-20T16:20:26.758Z en101arrowz/fflate;
sin install/postinstall. No se cambia la política de antigüedad ni de scripts.

Metadatos obtenidos con pnpm view y registro oficial. La verificación Node
tuvo ConnectTimeout; se completó con PowerShell/.NET, contra la clave pública
vigente del registro: firma ECDSA-SHA256 válida y tarball68031bytes con SHA512:

`sha512-zdxgIEddhfsyCaWpJ2SdXEP8ZMrKJ6+5jl4OupODcywU0IhRk6gdXuVGcPICyfx2H97hVK7xmJtRLPjkxAX8Vw==`

Clave: SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U.
Tarball verificado sólo en memoria, sin ejecutar código/lifecycle.
Firma e integridad no equivalen a ausencia de vulnerabilidades desconocidas.

Audit nativo inicial y reintento con fetch-timeout15000/retries0:
ambos error23 «The operation was aborted due to timeout». No hay resultado
de vulnerabilidades vigente de esos intentos; no se informa cero avisos.

Diff deliberadamente exclusivo: override, versión e integridad del nodo
afectado y su arista. Lockfile editado selectivamente con la integridad
verificada; instalación frozen debe confirmar coherencia sin resolver peers
ni mover dependencias ajenas. No audit --fix ni actualización masiva.

## Resultado posterior comprobado

- Instalación: pnpm install --frozen-lockfile --ignore-scripts, exit 0,
  7,5 segundos; lockfile aceptado sin nueva resolución de peers ni scripts.
- GREEN: 10/10 regresiones, incluido ZIP64 válido y rechazo del caso que
  colgaba 0.4.8. Otros 2 controles existentes de flag/máscara también pasan.
- Gate completo del mismo código: 16/17 pasos medidos, exit 0 con reservas.
  7.126 pruebas/552 archivos aprobados en el segundo intento; el primero
  agotó 20 segundos en un test de adjuntos, no en los codecs. Se conserva
  ese fallo inicial; no se declara estabilidad unitaria por el reintento.
- 169 contratos SQL, ambas suites de concurrencia y rebuild de 424
  migraciones correctos. Build de producción: 158 páginas, sin claves reales.
- E2E: 150 aprobados, 18 omitidos, cero flaky y errores globales vacíos;
  211.048 ms. Reporte preservado en el acta de SDD0378.
- Tercer audit nativo, posterior al parche y acotado, volvió a terminar
  con error 23 por timeout. Sigue sin resultado vigente, no cero avisos.

El único paso omitido del gate fue migrations-applied. No hubo lectura
nueva del ledger, aplicación Cloud, captura real, push ni despliegue.

## Pendientes

- Recuperar audit nativo cuando el servicio responda; reserva de verificación,
  no prueba de que el parche esté ausente ni autorización para audit --fix.
- Publicación y todos los gates externos siguen independientes.
