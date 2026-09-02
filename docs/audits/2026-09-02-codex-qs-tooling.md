---
title: "Corrección acotada de qs en herramientas de desarrollo"
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
estado: verificado-local-publicacion-pendiente
confidencialidad: interno
---

# qs del tooling: dos avisos corregidos localmente

La casilla P2 de dependencias del checklist queda resuelta localmente: se fija
`qs@6` a **6.16.0**, conservando las versiones y resoluciones de todas las demás
dependencias. No cambia el runtime de la aplicación, SQL, autorización, CORS,
límites del servidor ni configuración alojada. No se crea una feature o SDD
del Studio por este mantenimiento de desarrollo.

## Evidencia y exposición

- Base: `cfe7a9c920515770943657a78508d8e71526bf6e`, rama
  `codex/saneamiento-integral`, worktree aislado del mismo nombre.
- Gestor y frontera: único `pnpm-lock.yaml` de raíz, `pnpm@11.19.0`, Node24;
  el CI usa instalación congelada. Manifest y política `allowBuilds` intactos.
- Auditoría nativa inicial: 2 moderados, 0 altos/críticos, 949 dependencias.
  Los dos findings son `dev: true` y convergen en `qs@6.15.3` desde
  `agentation-mcp@1.2.0` → SDK1.29.0 → Express5.2.1 / body-parser2.3.0.
- `pnpm why qs --prod --depth 8` no devuelve una ruta de producción.
  La UI de Agentation se monta sólo en desarrollo; el paquete MCP es distinto
  y es devDependency. Su código instalado usa stdio y HTTP nativo. Esto NO
  demuestra que un servidor Agentation existente sea explotable ni audita su
  red: no se inició, configuró o sondeó ninguno.
- Frontera de esta prueba: entradas sintéticas de query/formulario al parser
  transitivo. Riesgo estudiado: disponibilidad del proceso de desarrollo por
  excepción o límite de arrays omitido. Sin datos de clientes ni credenciales.

Fuentes del proveedor consultadas el 2026-09-02:
[aviso de arrays](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx),
[aviso de isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) y
[changelog6.16.0](https://github.com/ljharb/qs/blob/v6.16.0/CHANGELOG.md).
Ambos avisos señalan6.16.0 como corregida. El feed nativo da un mínimo menor
para el primero; se usa6.16.0, que cubre también el segundo. Los rangos
declarados por Express (`^6.14.0`) y body-parser (`^6.15.2`) la admiten.

## Cambio limitado y cadena de suministro

El primer `install --lockfile-only --ignore-scripts` recalculó peers y otras
resoluciones. Se retiraron únicamente esos cambios propios mediante apply_patch
y se comprobó igualdad con el lockfile base más el override, versión e integridad
de qs. Diff final del lockfile: 6 inserciones / 5 eliminaciones. No hubo reset,
restore, cambios en package.json ni actualización global de dependencias.

Metadatos del registro: publicación2026-08-29T23:50:15.803Z;
repositorio `ljharb/qs`; sin scripts de instalación nuevos aprobados.
Se verificaron la firma ECDSA del registro con su clave vigente y el SHA-512
del tarball de76.475 bytes:

`sha512-h6fhOIaRrID2CbEY2fqs+7t+UXZo+MLAnU5gRIq85uFtdiUPCdsApMlHhXogKVM4HM2DVbIjGNTTYH2OcmP1vA==`

No se afirma una certificación del proveedor ni una attestation SLSA. Firma,
integridad y audit son controles distintos y no demuestran ausencia de fallos
desconocidos. No se ejecutaron lifecycle scripts ni el prepublish del paquete.

## Verificación ejecutada

1. Regresión sobre los consumidores reales, sin dependencia directa o copia
   artificial de qs: **6 fallos y 9 controles aprobados** con6.15.3. Reproduce
   límite omitido y TypeError de isBuffer para ambos consumidores.
2. `pnpm install --frozen-lockfile --ignore-scripts`: aprobado, resolución
   omitida y lockfile sin cambios. Regresión: **15/15** con6.16.0.
3. Instalación limpia en carpeta temporal propia con copias exactas de manifest,
   workspace, lockfile y harness: **820 paquetes**, sin lifecycle scripts;
   checksum del lockfile idéntico. La misma regresión pasa **15/15**.
4. El caso HTTP usa el Express real del SDK, puerto aleatorio sólo en loopback,
   y conserva query/formulario extendidos, arrays y caracteres codificados.
   Servidor cerrado al terminar. Carpeta temporal retirada y ausencia verificada.
5. Auditoría nativa posterior: **0 avisos** de todas las severidades, exit0;
   mantiene949 dependencias. Es una medición del registro en esta fecha.
6. ESLint del test: exit0. Regresiones de qs más contratos de CI y entorno:
   **22/22 en3 archivos**, incluidos los15 de qs, sin duplicar el conteo.
   Docs:check, gobernanza28 y diff: exit0. No es la suite global del ERP.

SHA-256 del lockfile verificado:
`2a9452e38e86449d75966637ce83bf08115644e5c909c62e50738ad7e9a242ef`.

Los quince casos incluyen controles legítimos de listas, filtros, buffers y
round-trip. No se repiten SQL, E2E de negocio, build ni CI alojado como si fueran
pruebas nuevas de esta pieza de tooling. Los resultados de0423 permanecen
históricos y separados.

## Propiedad y publicación

Allowlist: `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
`scripts/__tests__/qs-tooling-security.test.mjs`, este acta,
`docs/audits/2026-09-02-codex-arranque-checklist.md`,
`.agents/handoffs/2026-09-02-qs-tooling-close.md` y
`.agents/handoffs/2026-09-02-saneamiento-integral-close.md`.

El avance pasa de47/103 a **48/103 (46,6 %)** al cerrar una casilla existente;
no se agregan casillas por cada prueba. Hay55 pendientes. Este es el undécimo
incremento local posterior a eabb230b; una autorización sólo hasta cfe7a9c9 no
lo incluye. Push, CI, integración y limpieza siguen pendientes, y las25
migraciones del paquete conservan sus autorizaciones nominales separadas.
