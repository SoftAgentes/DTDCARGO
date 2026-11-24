# Handoff SDD-0716

## OBJETIVO ORIGINAL
Retirar ft³ de tarifario y ayudas; guía m³ con cantidad y ejemplo ficticio.

Owner: codex-sdd-0716-solo-m3-20261124.
Sesión: orca_session_id:3ff1174e-c8ba-4e62-9000-542439567488.
Task: task_797ed2ba9139. Dispatch: ctx_e7a5eacaa2de.
Coordinador: orca_session_id:14b98827-b1e5-41f3-aee0-c72c837f96fc.
Rama: SoftAgentes/sdd-0716-calculadora-solo-m3.
Ruta: C:/Users/AKX generator/Desktop/Developer/Orca/DTDCARGO/sdd-0716-calculadora-solo-m3.
Base reserva: 1e66d2002b41a26c7ba3dad647dba00fd0272a54.
Main asignado: 8580490f8d95872a407ab83ab9acb6b1b265a451.
Autorizados edición, pruebas, commits y PR; merge, deploy y DB fuera del encargo.

## COMPLETADO
Cambios acotados a allowlist de spec. UPDATE omite legacy si falta la clave; no cambia
la tarifa por m³ ni funciones de conversión internas. FAQ y widget usan ejemplo
ficticio en metros y cantidad en el bloque didáctico; pulgadas se conserva como longitud física.
Corrección focal solicitada por Director (msg_0d0a73956851): bloque residual
de venta ft³ retirado por completo y campo oculto eliminado. Se amplió allowlist
solo a carrier-actions.ts y carrier-actions-escrituras.test.ts. Se conserva el
contrato legacy explícito y el INSERT nulo sin lectura de reconstrucción.
Consumidores verificados por git grep: únicamente TransportistasPanel importa
y renderiza TariffDrawer, para create/edit con sus props vigentes.
Pruebas preparadas del PATCH sin propiedad legacy y filtros existentes, valor
nulo/cuatro decimales, entrada explícita válida/vacía/inválida y alta por omisión.

## VALIDACIÓN
PASÓ: guard con owner; pnpm install --frozen-lockfile (lockfile sin cambios).
PASÓ: seis suites focales, 193/193 pruebas, con maxWorkers=1:
TransportistasPanel, carrier-actions-escrituras, carrier-tariff-actions,
calculadora, calculadora-minimo-en-cajas y faq-contratos.
PASÓ: pnpm typecheck, exit 0 (reanudada tras reinicio; no se usa como evidencia
la corrida interrumpida sin recibo). PASÓ: ESLint de los siete archivos TS/TSX
del alcance, exit 0. PASÓ: sdd:check (choques históricos exceptuados), docs:check,
governance:check, components:check y git diff --check. El error inicial de ajv
quedó resuelto al instalar dependencias congeladas.
NO EJECUTADO local: suite global, lint global y build; asignados por Director
a Quality sobre cabeza exacta. CI antes de ready era SKIPPED por draft, no verde.

ui-check read-only: tokens, fuentes, controles y estados existentes conservados;
sin nuevos anchos fijos. Veredicto OK del diff. Render sintético observado en
Orca: tabla y drawer de edición claro/oscuro, sin columna ni campo ft³;
guía clara con fórmula y ejemplo fijo separados del resultado variable.
Al cambiar cantidad a 3, el resultado cambió a 0,36 CBM y mantuvo 0,12 por bulto.
No se guardó ninguna tarifa: acciones de servidor y navegación sustituidas.
Límite: fuentes sin next/font, arnés aislado Vite con CSS real público + Studio;
forzar oscuro en la guía pública mezcla tokens y genera contraste inválido,
por eso esa captura NO valida tema oscuro del sitio público y no prueba regresión.
Evidencia local conservada fuera del repo público en
`C:/Users/AKX generator/Documents/Codex/evidence/sdd0716-20261124/`:
tabla-claro.png, tabla-oscuro.png, drawer-claro.png, drawer-oscuro.png,
guia-claro.png y sdd0716-visual.mjs. Captura oscura forzada etiquetada no validada.
SHA256 drawer-claro: 877B09671B348E80F06D602AD451670B2EC844CEB0DA1BEB0763918A393F7D4F.
SHA256 drawer-oscuro: 967774B4EC3E786CBF548BDEB1D490E77760D0E347EB772119D72DAD6BF701F7.
Validador del plugin: FALLÓ con «policy-registry.json está desactualizado»;
cápsula normativa local vigente, no se actualizó plugin fuera del alcance.
Governance-check estático: FRM-01, VIS-01/02 y A11Y-01 conservan controles,
tokens y estados (cumplimiento del diff); permisos/PII/integraciones no aplica;
sin excepciones nuevas. Riesgo R2: conservar legacy y validar formulario.
No se infiere conformidad visual del conteo de scripts.

## COMMITS
83825bae2 — implementación y pruebas preparadas sobre base de reserva asignada.
5d2eb1c03 — corrección focal y preservación legacy por omisión en UPDATE.
El cierre agrega prueba dinámica de guía y esta evidencia; SHA final en Git/PR.

## PR / BRANCH
PR https://github.com/SoftAgentes/DTDCARGO/pull/806 hacia main;
rama propia aislada verificada. Consultar Git/PR para SHA actual.

## PENDIENTES DE ESTA TAREA
Quality global y revisión independiente sobre cabeza exacta, a cargo del Director.
SDD queda in-progress hasta cierre global. Merge y deploy no autorizados.
Turno exclusivo autorizado por msg_972087138829 y liberado explícitamente
al terminar las corridas: msg_a3b075427ab6 al Director y msg_8c58f6bfbab3
a dispatch:ctx_59ec39c37538, con «Turno exclusivo libre, comienza 0715».
Servidor del arnés detenido antes de liberar la PC.

## FUERA DE ALCANCE DETECTADO
Ninguno adicional en las rutas inspeccionadas. Legacy lib/calculadora.ts sin
consumidores públicos que activen pies cúbicos; se conserva sin cambios.

## HANDOFF AL DIRECTOR
Impacto documental: spec y su índice generado; esta evidencia es local.
No se consultaron ni mutaron datos reales. Claim se libera al terminar escritura.
