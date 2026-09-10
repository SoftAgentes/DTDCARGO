---
sdd: "0440"
title: "Harness E2E general determinista en Supabase efímero"
status: in-progress
author: "Codex"
created: 2026-09-05
updated: 2026-09-10
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
- Una corrida local no efímera resuelve `min(8, max(1, floor(núcleos/2)))`.
  El ocho fijo anterior no era relativo a nada: en un equipo de cuatro núcleos
  subía la concurrencia de 2 a 8 respecto del default histórico de Playwright
  (`workers: "50%"`), justo lo contrario del objetivo de acotar contención.
  La fórmula nunca pide más que ese default ni más de ocho, y
  `E2E_WORKERS=1..32` conserva el override explícito y validado.
- WebKit móvil se serializa en Windows para que su cierre no cuelgue el gate.
  El límite es por proyecto y no toca `chromium` ni `mobile-chrome`; Playwright
  1.60 lo declara (`TestProject.workers`) y lo honra en el planificador.
- `seed-e2e.ts`, protegido por los guards de entorno ya existentes, actualiza
  únicamente `calculator_settings` del tenant público `dtd` con
  `DEFAULT_PARAMS` y verifica la postcondición antes de ejecutar Playwright.
  Antes de sobrescribir lee y emite el estado previo de esas diez columnas: es
  la única escritura del seed fuera del tenant de fixture y no lleva respaldo.
- No se cambian expectativas para aceptar precios históricos: el branch se
  normaliza al contrato vigente que el producto declara como fallback.
- `esperarHidratado()` conserva como `cause` el fallo original de su condición
  y lo incluye en el mensaje final. El conteo global de marcadores es un
  diagnóstico opcional: si la navegación destruye el contexto antes de poder
  tomarlo, el helper informa esa indisponibilidad sin reemplazar el fallo de
  hidratación por el error secundario de `page.evaluate()`.

## Seguridad y datos

La normalización requiere `E2E_ENVIRONMENT_KIND=ephemeral`, project ref
confirmado y URL coincidente. El guard existente prohíbe Producción. No crea
PII, no lee datos de negocio y no introduce una migración.

Normalizar `calculator_settings` del tenant público `dtd` es la única escritura
del seed fuera del tenant de fixture, y no restaura el valor anterior: el branch
efímero se destruye completo al terminar y la lista de denegación sólo excluye el
ref productivo. Para que un apuntado equivocado sea diagnosticable, el seed
emite el estado previo de las diez columnas antes de sobrescribirlas y aborta si
esa lectura falla. Respaldo y restauración quedan fuera de alcance.

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
| SGE-00 · concurrencia E2E | excepción | Serializar CI y efímero elimina la capacidad de detectar regresiones de paralelismo, y el criterio hospedado pendiente se validará serializado, o sea probando estrictamente menos que la corrida de 16 workers que originó el problema. Aceptado para separar contención de infraestructura del contrato de negocio; recuperar esa cobertura exige una corrida paralela declarada aparte, con `E2E_WORKERS` explícito y su propia autorización de entorno. |
| SGE-00 · auditoría del seed | cumplimiento | La escritura fuera del tenant de fixture emite su estado previo antes de sobrescribir y aborta si no puede leerlo. |
| SGE-00 · diagnóstico de hidratación | cumplimiento | El fallo primario de `expect.poll` sobrevive como mensaje y `cause`; una prueba simula la destrucción del contexto durante el conteo y evita que `page.evaluate()` suplante el diagnóstico. |

**Qué deja de cubrirse.** Con un worker no se ejercitan carreras entre pruebas,
fugas de estado compartido ni contención de Auth/PostgREST: un fallo que sólo
aparezca en paralelo pasará verde. La corrida hospedada de los 168 E2E, criterio
abierto de este SDD, hereda esa limitación y por eso no cierra la pregunta de
paralelismo, sólo la de contrato funcional. Queda registrado aquí, no sólo en un
comentario de `playwright.config.ts`.

## Allowlist exacta

- `docs/specs/0440-e2e-harness-general-determinista/spec.md`
- `docs/specs/README.md` (generado)
- `playwright.config.ts`
- `scripts/e2e/sdd-0168-fixture.ts`
- `scripts/seed-e2e.ts`
- `scripts/__tests__/playwright-config.test.ts`
- `scripts/__tests__/sdd-0168-fixture.test.ts`
- `e2e/_helpers/hidratacion.ts`
- `scripts/__tests__/hidratacion.test.ts`
- `e2e/README.md`
- `.agents/handoffs/pr28-e2e-harness-validation-20260906.md`
- `.agents/handoffs/d4-hidratacion-diagnostico.md`

Dependencia incorporada por merge, sin autoría en esta unidad: PR #29 publicada
(`03a7d0c0`, producto `1e31b9a3`, sobre la revisión `17d58fe4`) materializa el
estado 0222/0223 mediante 0448.
Su migración/test y handoffs se revisan en la unidad #29. Aplicarla requiere
autorización nominal, preflight de metadatos y ejecutor transaccional único.

## Criterios de aceptación

- [x] El mapper del seed contiene las diez reglas vigentes de calculadora.
- [x] El preflight exige las columnas que se van a actualizar.
- [x] El seed verifica que la fila pública quedó normalizada.
- [x] CI y Supabase efímero usan un worker por defecto, sin importar la máquina.
- [x] El kind efímero con espacios conserva el mismo límite de concurrencia.
- [x] La corrida local resuelve `min(8, max(1, floor(núcleos/2)))` y nunca pide
      más workers que el default histórico de Playwright ni más de ocho.
- [x] `E2E_WORKERS` acepta sólo enteros entre 1 y 32 y manda sobre la máquina.
- [x] `mobile-safari` lleva un worker en Windows y ninguno en las demás
      plataformas; `chromium` y `mobile-chrome` no reciben límite por proyecto.
- [x] El seed emite el estado previo de las diez columnas de la calculadora
      pública antes de sobrescribirlas y aborta si no puede leerlo.
- [x] El guard exige URL canónica completa y rechaza producción/ref/origen/aliases divergentes antes de crear cliente.
- [x] El error original de hidratación se conserva en el mensaje y como
      `cause`, incluso si el contexto muere durante el diagnóstico.
- [x] El conteo de marcadores sigue disponible cuando puede obtenerse y su
      propio fallo nunca reemplaza al de hidratación.
- [x] La regresión focal falla sobre el helper original al recibir sólo
      `Execution context was destroyed` y pasa después del arreglo.
- [x] Las pruebas unitarias, documentación, gobernanza y TypeScript pasan.
- [ ] Una corrida hospedada de los 168 E2E confirma el contrato completo.

## Fuera de alcance

- aplicar migraciones o modificar Supabase Producción;
- crear otro branch efímero sin autorización de costo;
- fusionar las PR #21, #22, #23 o #24;
- cambiar precios, límites o comportamiento de la calculadora de Producción.
- ajustar `TIMEOUT_HIDRATACION` o resolver la lentitud de hidratación bajo
  carga, que son decisiones de rendimiento de producto separadas.

## Estado

La rama publicada de PR #28 es `087b4f6e` (candidata limpia: main `74bb52ab` +
PR #29 publicada `03a7d0c0` + el contenido de `80eea11e`, ambos ancestros).
La validación del 2026-09-06 se hizo sobre la combinación local previa
(`17d58fe4` + `80eea11e`), conservada como evidencia fechada.
El índice se regeneró conservando las 311 specs de ambas ramas.
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

La ronda del 2026-09-09 atendió las observaciones de la revisión de PR #28 sobre
`087b4f6e`: criterio y prueba de la serialización WebKit, concesión de cobertura
registrada arriba, concurrencia local relativa con tope, emisión del estado
previo del seed y refresco de identificadores. Focal Vitest 63/63 (antes 44),
typecheck y lint sin hallazgos nuevos, y la colección del CLI conserva 168
pruebas con workers 8 (local, 22 núcleos), 1 (CI) y 4 (override).

La corrida hospedada de 168 E2E sigue pendiente de autorización de
entorno/costo y es requisito para cerrar este SDD. Un verify local con E2E/ledger
omitidos no sustituye ese criterio.

La ronda del 2026-09-10 corrige únicamente el diagnóstico de
`esperarHidratado()`: la regresión focal reprodujo primero que un contexto
destruido ocultaba la condición original y luego pasó 2/2 casos, con y sin
conteo disponible. No cambió la firma pública, el marcador interno de React ni
los 20 s de espera. La validación general y sus omisiones quedan registradas en
el handoff `d4-hidratacion-diagnostico`.
