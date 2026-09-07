---
sdd: "0440"
title: "Harness E2E general determinista en Supabase efímero"
status: in-progress
author: "Codex"
created: 2026-09-05
updated: 2026-09-06
supersedes: null
superseded_by: null
related: ["0168", "0172", "0243"]
confidencialidad: interna
---

# SDD-0440 — Harness E2E general determinista en Supabase efímero

## Problema

La corrida general de 168 E2E abrió hasta 16 workers sobre un único branch de
Supabase. Los logins agotaron su margen por contención y las calculadoras
leyeron los defaults históricos sembrados por `0103_calculator_settings`
(`500 kg/CBM` y `USD 50` de descuento), no los defaults vigentes del código
(`1000 kg/CBM` y descuento `0`). El resultado mezcló ruido de infraestructura
con tres expectativas de negocio desalineadas.

## Decisión

- CI y cualquier entorno declarado `ephemeral` usan un worker por defecto.
  El kind se normaliza con `trim`, igual que el guard, para que espacios de
  configuración no reactiven ocho workers en un entorno efímero válido.
- Una corrida local no efímera usa ocho workers; `E2E_WORKERS=1..32` permite
  ajustar la concurrencia de forma explícita y validada.
- WebKit móvil se serializa en Windows para que su cierre no cuelgue el gate.
- `seed-e2e.ts`, protegido por los guards de entorno ya existentes, actualiza
  únicamente `calculator_settings` del tenant público `dtd` con
  `DEFAULT_PARAMS` y verifica la postcondición antes de ejecutar Playwright.
- No se cambian expectativas para aceptar precios históricos: el branch se
  normaliza al contrato vigente que el producto declara como fallback.

## Seguridad y datos

La normalización requiere `E2E_ENVIRONMENT_KIND=ephemeral`, project ref
confirmado y URL coincidente. El guard existente prohíbe Producción. No crea
PII, no lee datos de negocio y no introduce una migración.

La revisión del 2026-09-06 detectó que el guard preexistente comparaba solo la
primera etiqueta del hostname. Director autorizó restringirlo al origen HTTPS
canónico completo `https://<ref>.supabase.co`, con slash raíz opcional; no admite
userinfo, puertos explícitos, paths normalizados, query/hash ni otros hosts.
Se compara también la entrada completa para que `URL.origin` no oculte esos
componentes. Las pruebas del entrypoint real del seed usan un espía sin red y
demuestran que producción, ref distinto y origen ajeno abortan antes del cliente.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento | El harness falla ante workers inválidos o una postcondición de seed distinta. |
| AUD-01 | no aplica | No cambia eventos de producto ni auditoría de negocio. |
| MP-01 | no aplica | Los datos son fixtures efímeros y no se modifica su ciclo de retención. |

## Allowlist exacta

- `docs/specs/0440-e2e-harness-general-determinista/spec.md`
- `docs/specs/README.md` (generado)
- `playwright.config.ts`
- `scripts/e2e/sdd-0168-fixture.ts`
- `scripts/seed-e2e.ts`
- `scripts/__tests__/playwright-config.test.ts`
- `scripts/__tests__/sdd-0168-fixture.test.ts`
- `e2e/README.md`
- `.agents/handoffs/pr28-e2e-harness-validation-20260906.md`

Dependencia incorporada por merge, sin autoría en esta unidad: PR #29 corregida
(`17d58fe4`, producto `1e31b9a3`) materializa el estado 0222/0223 mediante 0448.
Su migración/test y handoffs se revisan en la unidad #29. Aplicarla requiere
autorización nominal, preflight de metadatos y ejecutor transaccional único.

## Criterios de aceptación

- [x] El mapper del seed contiene las diez reglas vigentes de calculadora.
- [x] El preflight exige las columnas que se van a actualizar.
- [x] El seed verifica que la fila pública quedó normalizada.
- [x] CI y Supabase efímero usan un worker por defecto.
- [x] El kind efímero con espacios conserva el mismo límite de concurrencia.
- [x] `E2E_WORKERS` acepta sólo enteros entre 1 y 32.
- [x] El guard exige URL canónica completa y rechaza producción/ref/origen/aliases divergentes antes de crear cliente.
- [x] Las pruebas unitarias, documentación, gobernanza y TypeScript pasan.
- [ ] Una corrida hospedada de los 168 E2E confirma el contrato completo.

## Fuera de alcance

- aplicar migraciones o modificar Supabase Producción;
- crear otro branch efímero sin autorización de costo;
- fusionar las PR #21, #22, #23 o #24;
- cambiar precios, límites o comportamiento de la calculadora de Producción.

## Estado

La combinación local usa main `74bb52ab` + PR #29 corregida `17d58fe4` + PR #28
`80eea11e`. El índice se regeneró conservando las 311 specs de ambas ramas.
La revisión añadió regresiones autorizadas: 14 fallos sobre el código original
y 44/44 focales verdes después de corregir concurrencia y guard de URL. El
inventario del CLI conserva 168 pruebas en 14 archivos, 56 por proyecto; resolvió
8 workers locales, 1 en CI y 4 con override explícito. No se ejecutaron E2E
contra Supabase ni se sembró un entorno remoto.

Sobre `b08116f8`, `pnpm verify` terminó sin fallos: 14/16 pasos ejecutados,
6.216 tests, 140 contratos SQL, reconstrucción de 381 migraciones más 18
solo-ledger y build de producción. E2E general y ledger remoto no se midieron.
Las revisiones independientes de #28 y #29 fueron favorables sobre sus SHA;
la evidencia y las condiciones de release se registran en el handoff de la tarea.
El cierre posterior cambia únicamente documentación, conservando el código medido.

La corrida hospedada de 168 E2E sigue pendiente de autorización de
entorno/costo y es requisito para cerrar este SDD. Un verify local con E2E/ledger
omitidos no sustituye ese criterio.
