---
sdd: 0317
title: Acceso CBM sin secreto en URL
status: done
author: Codex
created: 2026-09-01
updated: 2026-09-01
supersedes: null
superseded_by: null
related:
  - SDD-0003
confidencialidad: interno
---

# SDD-0317 — Acceso CBM sin secreto en URL

## Problema

La presentación interna `/admin/cbm-estudio` aceptaba `CBM_ESTUDIO_TOKEN` en
`?token=...`. Aunque fallaba cerrado cuando la variable no existía, la
credencial podía quedar en historial, logs de acceso, capturas y copias del
enlace. El manejador de error también devolvía al navegador el mensaje bruto de
lectura del archivo.

## Contrato

1. `GET` nunca autentica mediante query string. Si recibe un parámetro `token`,
   responde con redirect `303` a la misma URL limpia.
2. La credencial se envía mediante un formulario `POST` y se compara en tiempo
   constante con `CBM_ESTUDIO_TOKEN`.
3. Un login válido acuña una sesión de ocho horas en cookie `__Host-*`,
   `HttpOnly`, `Secure` y `SameSite=Strict`. La cookie contiene expiración y una
   firma HMAC; nunca contiene el secreto original.
4. La expiración se valida también en el servidor. Rotar
   `CBM_ESTUDIO_TOKEN` invalida las sesiones anteriores.
5. Sin variable configurada, credencial inválida, sesión ausente o sesión
   vencida, el contenido permanece cerrado.
6. Las respuestas llevan `no-store`, `no-referrer`, `nosniff`, prohibición de
   frame e indexación. Los fallos internos muestran copy genérico y no rutas ni
   mensajes de excepción.
7. `?download=1` se conserva, pero sólo funciona con una sesión válida.

## Gobernanza y datos

- `SGE-00`: la URL legacy se limpia y no existe fallback silencioso al secreto
  en query.
- `A11Y-01`, `FRM-01`, `ERR-01`: label persistente, foco visible, target de
  44 px, error textual y mensaje de seguridad mínimo.
- `ENCONTRADO`: la credencial cruda viajaba en URL y podía persistir fuera del
  control de la aplicación.
- `CORRECTO` para este slice: el secreto sólo viaja en el body del POST; la
  sesión derivada es corta y no accesible a JavaScript.
- `NO VERIFICABLE`: retención y acceso efectivo a logs del proveedor alojado.
  Después del deploy se debe rotar la credencial que circuló en enlaces viejos.

## Pruebas de aceptación

- Un enlace legacy redirige a URL limpia y no crea sesión.
- GET sin sesión devuelve `401` y el formulario no refleja secretos.
- Credencial inválida devuelve `401` sin cookie.
- Credencial válida crea cookie segura sin incluir el secreto y redirige.
- La cookie firmada permite leer el contenido; ausencia de variable devuelve
  `503` fail-closed.

## Fuera de alcance

- Rotar `CBM_ESTUDIO_TOKEN` en Vercel o cualquier otro proveedor.
- Desplegar el cambio a producción.
- Incorporar autenticación Studio a este HTML legacy.
