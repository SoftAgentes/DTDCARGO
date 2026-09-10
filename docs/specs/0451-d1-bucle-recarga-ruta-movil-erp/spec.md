---
sdd: "0451"
title: "Resolución de H1 y sonda reutilizable de navegación móvil ERP"
status: done
author: "Codex"
created: 2026-09-10
updated: 2026-09-10
supersedes: null
superseded_by: null
related: ["0444"]
confidencialidad: interno
---

# SDD-0451 — Resolución de H1

**Veredicto: H1 es un artefacto del servidor de desarrollo; desaparece bajo
compilación de producción y no afecta a ningún usuario de la aplicación
desplegada con esa compilación.** La resolución la aportó la corrida L de otra
tarea, en el árbol de validación de PR #28, seguida por siete corridas Auth18
18/18. Esta tarea registra y atribuye esa evidencia; no resolvió el bucle ni
implementó un arreglo de producto. El emisor concreto quedó acotado por
eliminación, sin observación directa: ese residuo se conserva explícitamente.

Dueño documental: Worker `d1-bucle-modulos-m-erp`. Cierre autorizado por Sam el
2026-09-10. Estado `done` corresponde a este documento de resolución y a la sonda
reutilizable entregada; PR #58 permanece en borrador, sin integración ni release.

## Fuente única y trazabilidad

Fuente externa de solo lectura. La localizó el Director al preparar la corrida
autenticada de esta tarea; Sam decidió cerrar D1 como documental sobre ella:

```text
C:/Users/AKX generator/Desktop/Developer/DTD-backups/pr28-e2e-harness-validation-20260906/local-supabase-auth-feasibility-20260906/clean-instance-runner-v3-transport-20260907/handoff.md
```

Documento de 710 líneas, ronda 16 con rondas anteriores preservadas. SHA-256 leído:
`e1dc9bff1d17d6e8de863500e0dcadade2dc9e3817fb265f17561625ab6f73bb`.
Las referencias `[fuente: L…]` remiten a sus líneas, no a archivos inspeccionados
por esta tarea dentro de aquel árbol. No se minaron ni reejecutaron sus recibos.
El hallazgo inicial del 2026-09-08 estaba vencido: omitía la resolución producida
esa noche y la continuidad del 2026-09-09. Las fechas absolutas permiten distinguir
esa evidencia de la sonda de esta tarea, corrida el 2026-09-10.

## Síntoma y medición original

La corrida I registró **151 navegaciones sin hidratar en 60 s** en
`/m/erp?tab=expenses` bajo el servidor de desarrollo [fuente: L407, L626–628].
Es el valor del contador `navigations`, no 151 documentos distintos: la auditoría
corrigió el ritmo a **75–76 documentos en 60,1 s, aproximadamente 1,25 Hz**, porque
el contador incluía actualizaciones de historia del mismo documento [fuente:
L627]. H e I mostraban el mismo fenómeno; la instrumentación previa no explicaba
su tasa. No se compara ese ERP autenticado con la pantalla HTTP 500 de esta tarea.

## Emisor acotado por eliminación

El auditor de I, fechado 2026-09-08 a las 18:20Z y citado por Worker A10 en la
ronda 8 [fuente: L620–622], acotó el emisor por eliminación entre los **22 sitios
del bundle capaces de navegar** y contrastó el ajuste temporal en **102 ciclos y
tres navegadores**. El único
superviviente fue el interceptor de React Refresh del runtime de webpack:

```text
.next-e2e-local-auth/dev/static/chunks/webpack.js:695-704
options.factory = (…) => { if (!originalFactory) { document.location.reload(); return; } … }
```

La fuente dice «por eliminación de los 22 sitios» y «102 ciclos y tres
navegadores» [fuente: L626]. El mecanismo candidato dispara cuando
`__webpack_require__` resuelve un módulo sin factory. Es silencioso: no escribe
consola, no envía mensaje al servidor, no deja span ni toca cookies. **Ese código
no existe en una compilación de producción** [fuente: L628]. No hay una pila
directa del emisor H1 ni identificación observada de su módulo/factory ausente.

## Prueba de refutación previa y resultado decisivo

Antes de ejecutar, la propuesta para J dejó escrito el criterio:

> `navigations` de `/m/erp?tab=expenses` debe ser 1 o 2, no 151 como en I

> Si `navigations` sigue creciendo bajo producción, la hipótesis del emisor queda
> refutada y hace falta otra explicación

[Fuente: L690, ronda 8 preservada, propuesta para J; reiteración para K en la
ronda 9, L616]. Se exigían también `routeOk: true` y cero peticiones al service
worker. La posición de este bloque al final del handoff acumulado no cambia que
el criterio fue registrado antes de L.

**La corrida L (2026-09-08T23:42Z–2026-09-09T00:13Z) superó esa prueba de
refutación** [fuente: L405–407]:

| Comprobación de la tarea externa | Resultado registrado |
|---|---|
| Compilación de producción | Salida 0; 270.675 ms; identificador de compilación no vacío; 221 fragmentos |
| Ruta móvil | **1 navegación, hidratada, en 146 ms**; desapareció el bucle |
| Precalentamiento | Login 200; 4 rutas de 4 correctas |
| Auth18 completa en L | **11/18**, sin atribuirle el 18/18 posterior |

La hipótesis se sostuvo frente a una condición explícita que habría obligado a
refutarla si el contador seguía creciendo. Esa prueba de refutación registrada
de antemano es la evidencia decisiva para cerrar H1, más fuerte que una mera
coincidencia con lo esperado después de ver el resultado. Neutralizar el runtime
de desarrollo resolvió el fenómeno; no convirtió la inferencia del emisor en
observación directa ni aisló un módulo de producto causal.

Después, **M, n1, n2, n3, O, P y Q** lograron **siete corridas seguidas con
Auth18 18/18**: cinco con cierre limpio y dos toleradas por el mismo cierre de
navegador, sin fallar una sola prueba [fuente: L6–8, cierre de ronda 16 del
2026-09-09, Worker A20]. Esta continuidad completa la condición pendiente tras
L; tampoco se atribuye a esta tarea.

El alcance de «no afecta a ningún usuario» es este bucle H1 en el producto
servido mediante compilación de producción, donde el interceptor no existe.
Es el veredicto técnico sustentado por la tarea externa; no afirma una auditoría
de telemetría de todos los usuarios ni una nueva certificación de producción.

## Nuestra corrida sigue siendo inconclusa

La sonda de esta tarea corrió **sin autenticación** el 2026-09-10. Se conserva
íntegro [el recibo original](assets/unauthenticated-60s.json), también pegado en
el handoff. No se recalifica como éxito por conocer ahora la resolución externa.

TIPO DE NAVEGACIÓN: `navigate` inicial (1); sucesores: 0. TIPO DEL BUCLE H1 EN ESTA SONDA: NO DISPONIBLE.

Ventana `20:02:30.344Z`–`20:03:30.344Z`: 60 000 ms, un documento inicial, una
petición iniciada dentro de la ventana, una llamada nativa a `reload`, un
`beforeunload` y 491 ms de pausa CDP. La petición inicial comenzó antes de la
ventana; no se suman ambos contadores. El documento respondió **HTTP 500 por
falta de URL/key Supabase en `proxy.ts:67`**. La siguiente respuesta 500 llegó a
`20:03:33.032Z`, fuera de la ventana, sin documento sucesor observado dentro.

La pila de `performFullReload` en
`webpack-internal:///(pages-dir-browser)/.../hot-reloader-pages.js:412:21`, desde
`handleApplyUpdates:374:13`, pertenece al recargador de la pantalla de error de
Next. El servidor registró error de configuración y full reload por runtime
error. **No fue observación del ERP autenticado ni del emisor H1**; `modules: []`.
El snapshot final de sessionStorage falló por destrucción del contexto, exit 2.
La versión entregada de la sonda conserva su reintento acotado y clasificación
`INCONCLUSIVE`; no se modifica su código ni sus pruebas en este cierre.

**Nuestra corrida no confirmó ni refutó nada sobre H1 por sí misma.** El
`navigate` inicial fue ordenado por el runner y no refutó la hipótesis. No hubo
comparación válida «75 → 1», corrección del grafo ni medición de ciclos/chunks.
El acceso autenticado dejó de ser dependencia de esta tarea por el reencargo de
cierre documental, no porque se haya subsanado el entorno.

## Residuo real y utilidad futura de la sonda

**El emisor H1 nunca se observó directamente.** Se acotó por eliminación y luego
se neutralizó con la compilación de producción. Faltan su pila directa y el
módulo/factory concreto que lo dispara; la prueba de refutación no borra esa
laguna. Tampoco demuestra que un import cruzado sea por sí solo causal.

La sonda reutilizable `scripts/probes/navigation-emitter.mjs`, con sus pruebas
intactas, hace barata esa observación si llega a ser útil: captura operaciones
nativas, pilas, frames, datos de factory y persistencia entre documentos. Su
[guía](probe.md) delimita una ejecución futura autorizada. Valdría la pena ante
una recurrencia que cambie el diagnóstico o si el Director prioriza el arreglo
del grafo y necesita observar el emisor antes de decidirlo. Requiere un entorno
efímero autenticado válido y un caso observable; un nuevo HTTP 500 no lo aporta.
No es condición para cerrar H1 ni se ejecuta una nueva sonda en esta tarea.

## FUERA DE ALCANCE DETECTADO — arreglo de producto

La **recomendación 5** conserva una observación legítima: componentes de `/m`
importan del árbol de Studio cruzando el espacio de nombres, mientras rutas de
Studio que no cruzan hidratan sin problema [fuente: L698]. El posible arreglo
del grafo existe como trabajo de producto pendiente, **no como cambio ya
implementado**. Exige SDD propia y confirmación del emisor antes de intervenir.
Dueño del seguimiento: **Director de ingeniería**, que asignará un Worker de
producto futuro. Esta tarea no lo implementa ni toma número de SDD.

**No es urgente**: la fuente fijó que «si bajo producción el bucle desaparece y
los 18 pasan, el arreglo de producto deja de ser urgente» [fuente: L698]. Ambas
condiciones se cumplieron: desaparición en L y Auth18 18/18 en las siete corridas
posteriores. Se conserva la deuda sin reabrir H1 ni bloquear este cierre.

## Alcance y aceptación de este cierre

Permitido: esta carpeta SDD, `docs/specs/README.md` solo por regeneración,
`.agents/handoffs/d1-bucle-modulos-m-erp.md` y descripción de PR #58. La rama ya
entrega la sonda y sus pruebas; este cierre solo actualiza documentación.
Excluidos: `scripts/probes/**`, `app/**`, `lib/**`, Studio, configuración
Playwright, Supabase, cutoff, baseline, ruleset y cualquier escritura en PR #28.
Sin nuevos entornos, contenedores, servidores, mediciones ni número de SDD.
Gobernanza visual y de comportamiento: **no aplica**, sin cambios de producto.

- [x] Síntoma I, medición y distinción entre navegaciones y documentos citados.
- [x] Emisor y método de eliminación atribuidos; observación directa ausente.
- [x] Criterio de refutación previo y L registrados como evidencia decisiva externa.
- [x] Siete Auth18 posteriores y ausencia de urgencia del arreglo documentadas.
- [x] Sonda propia HTTP 500 inconclusa y recibo íntegro preservados.
- [x] Residuo, condición de uso futuro y guía actualizados; instrumento intacto.
- [x] SDD cerrada como resolución documental; entrega y validación registradas
      en el handoff, con PR #58 en borrador y sin arreglo de producto.

## Validación y límites

**Resultado de este cierre:** SDD/docs PASÓ; `corepack pnpm verify` exit 0,
**13/17 pasos ejecutados sin fallos**, incluido build y 6526 tests en 521
archivos. El gate declara **CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR** para
migrations-applied, SQL, schema y E2E. Recibo:
[validación documental](assets/resolution-validation.json). El cierre de esta
resolución no equivale a cobertura completa de producto.

La validación de este cierre se registra por comprobación en
`.agents/handoffs/d1-bucle-modulos-m-erp.md`: `corepack pnpm sdd:check`,
`corepack pnpm docs:check` y `corepack pnpm verify`. El gate se invoca con
`VERIFY_SKIP_E2E=1` y `VERIFY_SKIP_SQL=1` para cumplir la prohibición de levantar
servidores/contenedores. Sus omisiones se declaran, no se convierten en PASÓ.
`migrations-applied` es NO DISPONIBLE sin credenciales. E2E autenticado es
NO DISPONIBLE por configuración Supabase ausente, ya comprobada en la ronda
anterior; no se repite ni se persigue como regresión documental.

Pruebas de la sonda: **PASÓ histórico**, 24/24 sin skips en la entrega previa,
no reejecutadas porque requieren servidor local y el instrumento no cambia.
SQL/schema, UI funcional, E2E autenticado y medición antes/después no aplican al
cambio documental y se registran como NO EJECUTADO con esa justificación; la
indisponibilidad de Supabase se informa aparte. El build canónico valida
compilación, no reproduce H1. El verify anterior permanece FALLÓ / INCOMPLETO
en [su recibo](assets/verify-interrupted.json), sin éxito retroactivo.
«Calidad local sin secretos» no cubre E2E autenticado ni validación con Supabase.
