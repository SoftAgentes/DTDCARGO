# SDD0572 · #311 · Cartera no disponible en Clientes y Niveles

Fecha: 2026-10-26. Candidato local para revisión fija; validación funcional
NO DISPONIBLE / NO EJECUTADA. Este documento no acredita un FIN futuro.

## Autoridad y aislamiento

Reasignación humana nominal call_b67485b49e4749c9b354b63b6be5b8b7:
«Sí, reasigna las tres al mismo CORE (Recomendado)». Esta tarea consume sólo #311.
Continuación DIRECTOR-0572-PR311-CONTINUACION-DESTINO-FISICO-ACREDITADO-MISMO-CORE-20261026.
El setup previo CreateProcess/os267 permanece detenido y separado. No se cargó
ni reparó su input, retorno, sesión u operación.

Owner: worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
WT físico exclusivo: C:/Users/AKX generator/.codex/worktrees/fidelizacion-cartera-nd-20261026/DTDCARGO
Rama: codex/sdd-0572-fidelizacion-cartera-nd-20261026.
Base: 8729f7f4a3349b9b553c045c15a6adb37c943b98.
Árbol/índice base: efda7d65df09bc910052fa0c8b62b7dedb02b191.
Padre base: 3b1de9861de7bf15e614d89eb13cd2de6cb54fb0.

Guard/setup nuevo 907d3b/0: raíz/base/árbol/índice limpios; rama propia creada.
Claim propio CreateNew de 202 bytes en DTDCARGO4/harness-session-claim.json,
SHA256 b176b69d02da9f708968c2eab39bdc17b2241151b2472b199b1b2d2168c8410d.
Guard antes de autoría cbbefd/0 volvió a cotejar identidad, estado, claim y pins.
Ausencia del handoff comprobada antes de CreateNew. El cierre/release reales
se entregan fuera del commit; no se afirman anticipadamente aquí.

## Cinco rutas y cambio

1. app/studio/(app)/fidelizacion/_components/FidelizacionClient.tsx
2. app/studio/(app)/fidelizacion/_components/FidelizacionClient.annual-billing.test.tsx
3. app/studio/(app)/fidelizacion/__tests__/annual-billing-page.test.tsx
4. docs/specs/0572-conversor-usd-reemplazos/spec.md
5. .agents/handoffs/0572-fidelizacion-cartera-no-disponible-20261026.md

La página ya distingue fallo/cap de una lectura vacía válida. La misma bandera
portfolioAvailable llega ahora a ClientesTab y NivelesTab. Clientes muestra
«Cartera no disponible / No se pudo cargar la cartera de clientes.» después de
todos sus hooks. Niveles conserva los beneficios y sustituye únicamente los
conteos no acreditados por «Cartera no disponible».

Con disponibilidad verdadera, el vacío legítimo y los ceros conocidos conservan
su comportamiento. El fallo sólo anual mantiene clientes, filtros y Por revisar.
La identidad del tab no depende de la bandera: search persiste al alternarla.
No se añaden efecto de foco, retry, recuperación de red, regla de negocio,
conversión o cambio de créditos/referidos. Orden, selección, detalle, callbacks,
teclado Enter/Espacio y navegación existentes se conservan.

## Fuentes leídas y preservación

Lecturas completas prospectivas del componente, sin afirmar WHOLE global:
encabezado 1–75, cableado 76–286, NivelesTab 769–859 y ClientesTab 1081–1296
en la base. Nuevas unidades: 76–286 (6841 B), 769–859 (2809 B) y 1081–1308
(7537 B). SDD: unidades 0572-b 465–505 y Gobernanza 544–669 hasta EOF;
la única edición es una nota al final de esa unidad, ahora hasta 692.
No se emitió el componente de 44 KB ni la SDD histórica global.

Focales base y nuevos leídos ENTEROS por separado. Dependencias sólo lectura:
page.tsx (07d27a/0), queries.ts (5e3ffa/0), paginate.ts (3d52f0/0).
Su código permanece fuera de la allowlist. Se usaron las instrucciones Worker,
AGENT-BRIEF, registro, reglas y políticas vigentes; SGE-00 v1.0 completo
1c4331/0, ERR-01 611273/0, A11Y-01 8ca89f/0 y LOD-01 fb7482/0.

Comparación directa/inversa BYTEWHOLE, con pins de la base:
- componente edd530/0: sólo tres spans dentro de las unidades admitidas;
- focal componente 195adf/0: mock de navegación observable y nuevo escenario;
- focal página c33273/0 y 609314/0: proveedores/DOM reales, doble local y cuatro escenarios;
  la segunda prueba corresponde al refuerzo de rerender vía Page antes de cualquier suite;
- SDD ba08de/0: apéndice de 1541 bytes, todo texto previo idéntico.

Los siete casos de anual y los tres casos previos de página conservan todos sus
oráculos; pageChain anterior sigue idéntico. La prueba del árbol ajeno a las
cinco rutas y Git/claim final se adjunta al recibo externo de cierre.

| Unidad | Blob nuevo | Bytes |
|---|---|---:|
| Componente | 5f647897103356e56071244be57dd3ce348a8c8c | 44700 |
| Focal componente | 2d5b31769de59f055c8fbf1b20eac9aa1e8e78d5 | 5197 |
| Focal página | 262613a7cdb5f33c694df62a1be81089f176d913 | 16265 |
| SDD | aa2e49d52971a3d69e9318a90e3c7a1564c1ae4f | 51213 |

## Oráculos sintéticos preparados, no ejecutados

Total definido: quince escenarios (siete parametrizados de anual, tres previos
de página y cinco regresiones nuevas). Ninguno se presenta como PASÓ.

| Grupo | Oráculo independiente | Estado local |
|---|---|---|
| Error de clientes | DOM ND en ambas tabs; no vacío ni cero; conserva crédito80 y referido ficticio | NO EJECUTADO |
| Cap real | 60000 identidades únicas; 60 páginas reales; última 59000..59999; ND en ambas tabs | NO EJECUTADO |
| Vacío real | RPC anual [] y clientes []; Sin clientes y cuatro conteos0, sin error de cartera | NO EJECUTADO |
| Fallo sólo anual | conserva dos clientes/filtro/Por revisar; rerender de Page con error y recuperación de cartera conserva búsqueda/foco; crédito/referido intactos | NO EJECUTADO |
| Búsqueda/foco | Beta filtra; tab enfocado sobre false/true; conserva búsqueda y navegación Enter/Espacio | NO EJECUTADO |
| Siete anuales previos | cero, negativo, string grande, parcial100.01/0.00, inválido y no disponible | NO EJECUTADO |
| Tres de página previos | parcial sin Bronze, RPC ausente y cero conocido; oráculos completos preservados | NO EJECUTADO |

Las cuatro regresiones nuevas del focal de página atraviesan Page →
clientsWithTier → fetchAllPaged → FidelizacionClient/ClientesTab/NivelesTab
reales. DB, proveedores de referidos/stats/configuración, guarda RSC, navegación
y drawers periféricos tienen dobles sintéticos. No se mockean el componente,
los lectores de cartera ni el paginador. El quinto caso controla directamente
la conservación de estado y navegación del componente real.

El transporte local comprueba tabla clients, select id/markbox/name, filtro
deleted_at=null, orden id ascendente y rangos reales. La RPC exige nombre
studio_client_annual_billing_v2, p_as_of y orden client_markbox. Proyecta las
columnas pedidas, filtra/ordena y pagina datos ficticios; consultas inesperadas
se rechazan. El cap no fabrica complete=false: lo produce el paginador real.
Los datos y generadores están dentro de la prueba, sin fixture externo ni
datos personales. Los errores del proveedor no se muestran en props/DOM.

## Runner autorizado, NO INVOCADO

El setup907d3b/0 observó Node existente, node_modules ausente y entrypoint
node_modules/vitest/vitest.mjs ausente. No se repitió el probe ni se instaló,
copió, enlazó o usó otro WT. Cero invocaciones Node/Vitest; versión no consultada.
No se gastó una ejecución para buscar otro resultado.

Input preparado completo de siete argumentos (no se envió a exec_command):
```json
{
  "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run \"app/studio/(app)/fidelizacion/_components/FidelizacionClient.annual-billing.test.tsx\" \"app/studio/(app)/fidelizacion/__tests__/annual-billing-page.test.tsx\"",
  "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
  "login": false,
  "tty": false,
  "workdir": "C:/Users/AKX generator/.codex/worktrees/fidelizacion-cartera-nd-20261026/DTDCARGO",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

Recibo de no invocación:
```json
{"invoked":false,"state":"NO DISPONIBLE / NO EJECUTADA","result":null,"error":null,"exitCode":null,"chunkId":null,"sessionId":null,"beforeUtc":null,"afterUtc":null}
```

No hay resultado Native de suite que pueda heredarse o reconstruirse.
Compilación, verify, build, UI real/browser, zoom200%, lector de pantalla y
movimiento reducido NO EJECUTADOS. Tampoco hay DB/API/SQL real ni CI disparada.

## Gobernanza del delta

Clasificación acotada: cumplimiento estático no equivale a ejecución.

| SGE-00 v1.0 | Clasificación | Evidencia o motivo |
|---|---|---|
| .01 predecible | cumple estático | Misma bandera y texto coherente en ambas tabs; verbos existentes intactos. |
| .02 conservar trabajo | cumple estático | Hooks/identidad conservados; regresión search+focus definida, NOEJ. |
| .03 riesgo/fricción | no aplica a mutación | Sólo lectura/representación; no transacción ni nueva confirmación. |
| .04 auditoría | no aplica | Ningún evento financiero o persistente se crea. |
| .05 permisos/tenant/privacidad | cumple alcance estático | Página/lector/RBAC intactos; datos de prueba ficticios; no ampliar defensa servidor. |
| .06 prevenir errores | cumple estático | ND impide interpretar fallo/cap como vacío o conteo conocido. |
| .07 estado verdadero | cumple estático | Bandera false produce ND; true preserva vacío y cero acreditados; positivos/negativos definidos. |
| .08 frecuencia/complejidad | cumple estático | Mismos pasos/tabs, sin retry, campos ni navegación nueva. |
| .09 reutilización | cumple estático | EmptyState, Badge y tokens existentes; sin primitiva nueva. |
| .10 accesibilidad | no cumple en evidencia integral | Teclado/foco con regresión definida NOEJ; UI real/zoom/lector/reduced-motion pendientes, sin excepción inventada. |
| .11 lenguaje | cumple estático | Aviso textual específico y disponibilidad de referidos/créditos; no depende de color. |
| .12 autoridad humana | cumple | Reasignación nominal #311 y continuidad expresa; sin acción externa o financiera. |

ERR-01: fallo de lectura separado de vacío; detalle privado no se expone.
LOD-01: no se añade operación asíncrona ni spinner. A11Y-01: nombres, controles
y orden de hooks se preservan por lectura; aceptación visual integral pendiente.
VIS/CMP: mismos componentes/tokens/layout; UI real NO EJECUTADA. La brecha .10
es de evidencia de aceptación, no un fallo de foco demostrado por este trabajo.

## Pendientes de esta tarea

Revisión fija independiente de cinco rutas/unidades y recibos; suite focal y
tipado mediante carril CI que autorice Director; evidencia de accesibilidad
integral pendiente. No se declara aceptación funcional, financiera o de UI.
El claim propio se cierra sólo con guard/pin posterior al commit y recibo externo.

## FUERA DE ALCANCE DETECTADO

#310 tiene su propio candidato y claim retenido; no se incorpora ni se toca.
#313, CI320 y sus tres unitarios pertenecen a otros encargos/carriles; no se
relanzan. Sin lectura de fixtures/SQL/Source03–06/capturas detenidas, gestores o
Graphify/Archify/Obsidian. Impacto documental guardado en esta SDD/handoff;
integración y actualización de derivados quedan con Director desde main admitida.
Sin publicación, PR, merge, despliegue, producción, DB real, proveedores,
cuentas, contactos, PII, secretos o gasto. Automatización sigue PAUSADA.
Los límites de 2.1/QPG17/B y las autoridades financieras históricas se conservan
sin inferir aplicación, EJE ni consumo de claves.
