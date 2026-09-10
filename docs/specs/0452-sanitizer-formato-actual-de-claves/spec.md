---
sdd: "0452"
title: "Sanitizador: formatos actuales de claves y descubrimiento de pruebas"
status: in-progress
author: "Worker · worker-sanitizer-0452-20260910-root"
created: "2026-09-10"
updated: "2026-09-10"
supersedes: null
superseded_by: null
related: ["0036", "0444"]
confidencialidad: interno
---

# SDD-0452 · Sanitizador y pruebas ejecutables

Dueño: Sam. Ejecución: Worker asignado. Número reservado por el Director; la
reserva no se modifica. Estado de publicación e integración separado del SDD.

## Problema y frontera

`lib/studio/bug-sanitizer.ts` declara SDD-0036 Fase 4 / CRITICAL SECURITY:
redacta antes del buffer rolling del Bug Reporter. Una omisión puede conservar
credenciales dentro del reporte que consulta personal autorizado. El hallazgo
que motivó el encargo fue una clave con formato `sb_secret_…` en documentación
archivada. Su valor no se consulta, copia ni reproduce. No se lee `docs/archive/`.

En la base `b7ad23977b1905a25ba3154e52238f0e7baaaaa4`:

1. Once patrones reconocían JWT, Bearer, Basic, Stripe, prefijos personalizados,
   AWS Access Key/Secret, GitHub, Slack, OpenAI/Anthropic y asignaciones genéricas.
   Los JWT cubrían las claves legadas de Supabase; `sb_secret_…` y
   `sb_publishable_…` sueltos no coincidían. Custom prefix exige live/test/prod/dev;
   Generic credential exige asignación. `apikey` sí estaba en cabeceras sensibles
   y se compara sin distinguir mayúsculas: no necesita cambio de producción.
2. La prueba inline no estaba conectada a ningún gate y duplicaba implementación.
   Contiene siete vectores P1 más siete casos adicionales. Una copia puede pasar
   mientras el módulo real falla. No había una prueba Vitest del sanitizador.
3. `harness:test` enumeraba cuatro archivos; `scripts/tests/` contenía cinco.
   La prueba del driver E1 `merge-generated-records.node.mjs` no se ejecutaba.
   El descubrimiento manual no detectaba incorporaciones posteriores.

## Alcance exacto

- `lib/studio/bug-sanitizer.ts`
- `scripts/test-sanitizer-inline.mjs`
- `scripts/tests/run-harness.mjs`
- `scripts/tests/harness-discovery.node.mjs`
- `scripts/tests/verify-critical-coverage.node.mjs`
- `scripts/tests/bug-sanitizer.test.ts`
- `package.json`: únicamente `scripts.harness:test`
- `docs/specs/0452-sanitizer-formato-actual-de-claves/spec.md`
- `docs/specs/0452-sanitizer-formato-actual-de-claves/validacion.md`
- `docs/specs/README.md`, generado
- `.agents/handoffs/sanitizer-formato-actual-de-claves.md`

Excluidos: archivo histórico, captura y resto del Bug Reporter, workflow,
verify/política E3, Supabase/migraciones/baseline/cutoff, ruleset, otros worktrees,
rotación, datos reales, merge y despliegue. Solo vectores inventados. Sin secretos
ni datos de clientes en tests, documentación, archivos temporales o commits.

## Diseño y gates

Primero se ejecutó E1 mediante descubrimiento: sus cinco casos pasaron, dentro
de 23 pruebas verdes. Si E1 fallaba, la implementación se detenía sin repararla.

`harness:test` invoca `scripts/tests/run-harness.mjs`. Este descubre archivos
regulares con sufijo `.node.mjs`, ordena e imprime rutas y ejecuta el runner Node
con el mismo binario. Propaga fallo/error/señal y rechaza directorio vacío.
El glob directo de Node 24.20.0 devolvió 0 con cero coincidencias: se descartó
esa variante para evitar un falso verde. Contratos con fixture temporal prueban
incorporación automática, fallo de una prueba nueva y conjunto vacío.

La prueba del sanitizador vive en `scripts/tests/bug-sanitizer.test.ts`, con
entorno Node e import del módulo real. Vitest la descubre por convención;
`verify` ya ejecuta Vitest y CI también (`pnpm test`). El wrapper inline delega
en esa misma suite para conservar el comando anterior sin copiar lógica.

Evidencia que corrige una premisa del encargo: `scripts/verify.mjs` ejecuta otra
lista manual de cuatro archivos y NO invoca `harness:test`. Queda intacto por
la exclusión expresa. La nueva suite de producto sí entra en verify mediante
Vitest. E1 y el contrato de descubrimiento entran en `harness:test` y CI. Unificar
el paso harness de verify queda como recomendación separada; no se añade un paso.

## Auditoría de formatos, 2026-09-10

| Familia | Evidencia primaria | Resultado y cambio demostrado |
|---|---|---|
| Supabase | [API keys](https://supabase.com/docs/guides/getting-started/api-keys) y [generador oficial self-hosted](https://github.com/supabase/supabase/blob/master/docker/utils/rotate-new-api-keys.sh) | Prefijos secret/publishable ausentes. Agregar ambos; el generador justifica base64url. `apikey` ya cubierta; probar Record, tuplas, Headers y mayúsculas. |
| GitHub | [Formatos](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats) y [cambio de instalaciones 2026](https://github.blog/changelog/2026-05-15-github-app-installation-tokens-per-request-override-header/) | Falta `github_pat_`. El nuevo `ghs_` admite puntos, guiones y underscores; reconocerlo completo antes de JWT. Mantener formatos clásicos. |
| Stripe | [Claves de organización](https://docs.stripe.com/keys/organization-api-keys) y [firma webhook](https://docs.stripe.com/webhooks/signature) | `sk_org_` no pasa por live/test. `whsec_` estaba prometido en comentario pero exigía live/test: defecto anterior, no cambio reciente del proveedor. Mantener sk/pk/rk live/test; no inventar rk_org. |
| Slack | [Tokens](https://docs.slack.dev/authentication/tokens/) y [rotación](https://docs.slack.dev/authentication/using-token-rotation/) | Faltan xapp-, xwfp-, xoxe-. Access rotado xoxe.xoxb-/xoxe.xoxp- quedaba parcialmente redactado; consumir completo. Preservar familias xox previas. |
| AWS Access Key | [Identificadores IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html) | ASIA identifica acceso temporal STS; faltaba frente a AKIA. Agregar solo ese prefijo, preservando 16 caracteres y alfabeto. Omisión previa, no cambio reciente demostrado. |
| AWS Secret | [AccessKey API](https://docs.aws.amazon.com/IAM/latest/APIReference/API_AccessKey.html) | Control sintético asignado de 40 caracteres pasa. La API no justifica alterar umbral/alfabeto; no modificar. |
| OpenAI / Anthropic | [OpenAI service account API key](https://developers.openai.com/api/reference/typescript/resources/admin/subresources/organization/subresources/projects/subresources/service_accounts/subresources/api_keys/methods/create), [Anthropic autenticación](https://platform.claude.com/docs/en/manage-claude/authentication), [Anthropic Compliance API](https://platform.claude.com/docs/en/manage-claude/compliance-api-access) | sk-proj, sk-ant-api03/api01/admin01 con colas sintéticas largas ya coinciden. Sin cambio de formato demostrado; no modificar. |
| JWT / Bearer / Basic | [RFC 7519](https://www.rfc-editor.org/info/rfc7519/), [RFC 6750](https://www.rfc-editor.org/info/rfc6750/), [RFC 7617](https://www.rfc-editor.org/info/rfc7617/) | Cobertura heurística parcial: JWT solo tres segmentos con mínimos; Bearer omite tilde; Basic corto queda bajo mínimo. Limitaciones previas, no cambio de proveedor. Recomendar tarea focal; no ensanchar heurísticas aquí. |

El resto de la lista conserva comportamiento; JWT/Bearer/Basic son formas
genéricas y Custom/Generic son heurísticas, no inventarios oficiales. No se
presenta esta auditoría como certificación exhaustiva de todos los proveedores.

## Legibilidad y límites

Prefijos exactos y sensibles a mayúsculas para familias nuevas, alfabetos
específicos y umbrales mínimos evitan capturar referencias cortas o nombres
normales de configuración. Supabase usa mínimo 20 caracteres base64url; GitHub
PAT fino 30; Stripe mantiene 16; Slack nuevo 20. Son umbrales defensivos elegidos
por el sanitizador, no longitudes oficiales garantizadas. El formato self-hosted
de Supabase no impone longitud fija a todas las claves alojadas. Para `ghs_`,
GitHub publica mínimo 36 y alfabeto ampliado; se conserva soporte clásico anterior.

No usar límite final de palabra en base64url: un guion terminal debe redactarse
completo. El patrón de instalación GitHub precede JWT para evitar redacción
parcial. Se conservan puntuación del mensaje, status, método, duración, stack y
metadatos. Los tests verifican inmutabilidad, repeticiones e idempotencia.

Los negativos incluyen prefijos solos, ejemplos cortos, identificadores con un
prefijo embebido dentro de otro nombre, campos de configuración, URLs normales
y objetos Stripe pi/acct/evt. Cero regresiones en ese corpus no equivale a
demostrar ausencia universal de falsos positivos en texto arbitrario.

**Criterio 5 pendiente, no aprobado y con pruebas rojas:** la revisión independiente reprodujo que
`sb_secret_configuration_validation_failed` y
`sk_org_configurationvalidationfailed`, nombres inventados de configuración,
se redactan con estos patrones y no se redactaban en la base. Son falsos
positivos nuevos fuera de los negativos iniciales. No se ocultaron dentro del
resultado 92/92 ni se convirtió el criterio en aprobado. Sus caracteres y
prefijos son compatibles con los formatos documentados; excluir minúsculas,
palabras o imponer estructura self-hosted a todas las claves dejaría credenciales
posibles sin redactar. Hace falta decisión sobre esta colisión entre legibilidad
y redacción conservadora, o evidencia adicional de formato para acotar sin
debilitar. Tres pruebas sin skip de aceptación preservan la expectativa original
de Sam: Supabase, Stripe y un nombre largo de Slack. La suite final tiene 92
aprobadas y tres fallidas; el gate no puede quedar verde ocultando este pendiente.
SDD permanece `in-progress` y la PR permanece en borrador.

## Gobernanza

- Cumplimiento: SDD y allowlist exacta, aislamiento/ownership, minimización de
  secretos en registros (principio AUD-02), pruebas sobre funciones reales.
- No aplica: UI/componentes, marca, permisos/RLS, retención, exportación, schema
  y datos de producción. No se modifica ninguna de esas superficies.
- No conformidad preexistente: pruebas manuales desconectadas y formatos omitidos.
- Excepciones: ninguna concedida para ampliar alcance o certificar producción.

## Aceptación y evidencia

1. Descubrimiento automático y E1 ejecutada sin modificar su prueba ni driver.
2. Los catorce casos históricos conservados; suite real en verify y CI.
3. Vectores nuevos sintéticos rojos antes, verdes después, con ambos recibos.
4. Auditoría primaria y cambios limitados a brechas demostradas.
5. Negativos y contexto de reportes preservados en corpus de regresión.
6. SDD, índice generado, handoff, commits selectivos y PR en borrador.

Resultados en [validación](validacion.md) y handoff de esta tarea. `done` requiere
cumplir estos criterios; release y cobertura autenticada se registran aparte.

## Fuera de alcance detectado

Antes de cambiar producción, `redactTokensInText` convirtió una URL normal
`https://example.invalid/docs/sb_secret_setup?limit=10&offset=0` en
`https:/docs/sb_secret_setup?limit=10&offset=0`. La API `redactUrl` la conserva.
Es un problema previo al cambio de formatos; no se repara aquí. Se mantiene
negativo de URL en la API correspondiente y texto libre sin query, sin presentar
este límite previo como falso positivo causado por los patrones nuevos.
