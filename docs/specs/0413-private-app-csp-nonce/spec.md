---
sdd: "0413"
title: CSP con nonce para superficies privadas
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0238", "0302", "0323"]
confidencialidad: interno
---

# SDD-0413 · CSP con nonce para superficies privadas

## Evidencia y autoridad

La CSP global mantiene `script-src 'unsafe-inline'` para no convertir en
dinámicas las páginas públicas SSG/ISR. Las superficies autenticadas ya pasan
por `proxy.ts`, pero heredaban esa misma concesión aun cuando el proxy puede
generar un nonce fresco por request. El visor `/marca/doc/*` sirve HTML legacy
de Cloud Design y requiere una excepción deliberada, ya aislada y autorizada.

## Contrato acotado

- Generar un nonce impredecible por request sólo en las rutas existentes del
  proxy: Studio, Back, Portal, PWA ERP/empresa, Entrar y Registro.
- Enviar la misma CSP y el mismo nonce al render de Next y a la respuesta.
- Retirar `unsafe-inline` de `script-src` y mantener `unsafe-eval` sólo en
  desarrollo; `style-src 'unsafe-inline'` permanece por los estilos React.
- Mantener el sitio público estático bajo su CSP actual.
- Mantener `/marca/asset/*`, `/marca/doc/*`, `/marca` y `/norte.html` fuera del
  proxy y sin ampliar sus excepciones.

## Fuera de alcance

- Reescribir el HTML heredado de Marca o descargar sus CDN.
- Eliminar estilos inline de toda la aplicación.
- Cambiar autenticación, datos, migraciones, Cloud, push, `main` o despliegue.

## Allowlist exacta

- `lib/security/content-security-policy.ts`.
- `lib/security/__tests__/content-security-policy.test.ts`.
- `next.config.ts` (comentario normativo; la baseline pública no cambia).
- `proxy.ts`.
- `app/studio/layout.tsx`.
- `app/__tests__/proxy-refresh.test.ts`.
- Esta spec, índice y checklist del saneamiento.

## Aceptación

- [x] RED demuestra que el constructor y el nonce todavía no existen.
- [x] Producción privada no concede scripts inline ni eval.
- [x] Desarrollo conserva únicamente el eval requerido por Next.
- [x] Cookie refresh no pierde el nonce ni desincroniza request/response.
- [x] Cada request recibe un nonce distinto.
- [x] Sitio público y visor Marca conservan políticas separadas.
- [x] Build local y navegador confirman scripts de Next sin violaciones CSP.
- [x] Focales 35/35, suite 7.308/7.308, build 158 y gates documentales verdes.
- [x] El checklist avanza a 59/106 con evidencia.

## Gobernanza

- `SGE-00.05`: cumplimiento; el contrato queda probado y trazable.
- `SGE-00.07`: cumplimiento; la política se centraliza en un constructor puro.
- `SEC-01`: cumplimiento; scripts privados pasan de concesión global a nonce.
- `MP-01`: no aplica; no cambia persistencia ni autorización de datos.
