---
sdd: "0379"
title: Parche compatible del fflate transitivo y contratos de replay
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0036", "0378"]
confidencialidad: interno
---

# SDD0379 · fflate/replay sin ampliar captura

## Fuente y alcance

Siguiente bloque de la cola local autorizada. pnpm sdd:next consultó15refs:
0379 libre. No Cloud, datos reales, nuevas capturas, push, main ni deploy.

Aviso actualizado el2026-09-03:
[GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98).
fflate0.4.8 transitivo de rrweb2.0.0-alpha.4 está en el rango afectado.
0.4.9 es backport compatible con su ^0.4.4; directo0.8.3 ya está corregido.
No forzar salto a0.8 ni actualizar rrweb/player o dependencias ajenas.

## Contrato y exposición

- Sólo fijar rrweb2.0.0-alpha.4>fflate a0.4.9, con integridad del registro.
  package.json y allowBuilds se conservan; sin lifecycle scripts.
- Reproducir ZIP64 malformado en subprocesso propio con plazo acotado,
  nunca en el proceso principal; controles ZIP legítimos y codecs reales.
- Validar pack/unpack real de rrweb, JSON/Unicode y compatibilidad zlib.
- rrweb trae además código vendorizado en es/rrweb/ext/fflate:
  cambiar el lockfile NO reemplaza esa copia. Sus packers usan zlib/unzlib,
  no unzipSync. El flujo de la app serializa JSON+CompressionStream(gzip).
  No afirmar que el override sanea todo código incluido ni prueba ausencia
  de vulnerabilidades. Conservar apagado por defecto y máscaras existentes.
- Audit nativo inicial terminó por timeout, no produjo un resultado verde.
  Repetir acotado tras cambio y reportar indisponibilidad si persiste.
- Instalación congelada, pruebas focales y gate local; sin modificar deps
  mientras la corrida E2E anterior siga en ejecución.

## Allowlist

- pnpm-workspace.yaml: override puntual; no allowBuilds.
- pnpm-lock.yaml: sólo override, versión e integridad fflate0.4.9.
- scripts/__tests__/fflate-replay-security.test.mjs.
- docs/audits/2026-09-03-fflate-replay-local.md.
- Esta spec e índice generado docs/specs/README.md.
- Checklist y handoff vigentes de saneamiento.

## Aceptación

- [x] RED causal acotado y controles legítimos.
- [x] Parche compatible y diff exclusivo de dependencia afectada.
- [x] Regresiones reales de ZIP/codecs/packers, máscaras y flag sin cambios.
- [x] Instalación congelada y medición audit claramente clasificada.
- [x] Evidencia local, límites y siguiente cola documentados.

Cierre técnico local: 10 regresiones del parche y 2 controles de captura
aprobados; instalación congelada correcta. Gate posterior: 7.126 pruebas
aprobadas en el segundo intento, 150 E2E aprobados/18 omitidos, sin errores
globales, build de 158 páginas. Audit nativo no disponible por timeout.
No equivale a publicación ni a auditoría integral de todas las dependencias.

No cambio visual ni de permisos/captura/tratamiento de datos personales.
La revisión trata una dependencia existente; no habilita replay real.
