# SDD-0713 · Correcciones P2 de PR #811

## OBJETIVO ORIGINAL

Validar `0f9215395c9a2c28df1621a5c50c06a9e3129bd4` sin modificar el árbol.
Después, el Director asignó corregir los tres P2 del dictamen independiente
CHANGES REQUESTED (`msg_89e8d84d811e`) en la misma rama, con pruebas ligeras y
sin repetir verify/navegador: el turno pesado se cede a fase 3.

Owner/sesión: `orca_session_id:de91496e-019f-4197-9901-9e33c73411ce`.
Coordinador: `orca_session_id:c8393b96-a33a-490a-80ed-d07121569581`.
Task: `task_e275a30d5f9a`; dispatch: `ctx_400dbd2d96dd`.
Rama: `SoftAgentes/sdd-0713-facturacion-practica`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/Orca/DTDCARGO/sdd-0713-facturacion-practica`.
Base: `0f9215395c9a2c28df1621a5c50c06a9e3129bd4`.

## COMPLETADO

1. El retorno al primer plano conserva la instancia del editor, selección,
   borrador textual y foco cuando el servidor confirma la misma identidad y
   permisos. La zona permanece oculta e inert, con controles deshabilitados,
   durante la comprobación. Denegación o cambio de identidad retiran el detalle;
   el cambio de permiso financiero remonta el editor y descarta lo no autorizado.
   Una respuesta 401/403 a una operación también retira el detalle local.
2. El endpoint financiero lee como máximo 24 KiB de bytes reales del stream,
   aunque Content-Length falte o mienta. El máximo cubre 20 conceptos de 100
   unidades UTF-16 aun escapadas, metadatos y motivo acotado. Traefik separa la
   ruta financiera con 24576 bytes; las demás conservan 2048. El error 413 es
   recuperable y mantiene la edición. No se cambió el lector JSON global.
3. Cantidad y precio reutilizan NumericInput canónico. Conserva texto vacío,
   incompleto o inválido; admite coma venezolana, no redondea decimales de más.
   La validez nativa del formulario y las reglas de línea se comprueban antes
   de guardar/emitir. Los identificadores locales por renglón evitan transferir
   el texto de otro renglón al quitar uno. No se modificaron componentes globales.

Archivos del slice: `PracticaPersonal.tsx`, `FacturacionPractica.tsx`,
`app/api/practica/[operacion]/route.ts`, `lib/studio/practica/cuerpo.ts`,
`lib/studio/practica/__tests__/acceso.test.ts`, plantilla Traefik,
`infra/ops/tests/practica-frontera.mjs`, `infra/ops/tests/practica-p2.node.ts`,
`fase-2.md` y este handoff. Allowlist exacta ampliada en fase-2.md.

## VALIDACIÓN

### Sobre la base 0f9215395, antes de los P2

- PASÓ: `PRACTICA_NAVEGADOR=1 pnpm exec vitest run lib/studio/practica/__tests__ --maxWorkers=1`:
  3 archivos, 22 pruebas, cero omisiones, 33,94 s (14:43 Caracas).
  Chromium se ejecutó a 390/1280 px en claro/oscuro; capturas nuevas inspeccionadas.
  Proxy Next, handler y SQL PGlite reales; autenticación y transporte doblados.
- Canónico: INTERRUMPIDO por instrucción del Director antes de editar, para
  ceder el turno. Pasaron harness (392 aprobadas, 5 omitidas), lint (0 errores,
  43 advertencias), frontera RSC, tipos y las 4 edge-functions. La suite general
  no terminó; no se atribuye cierre verde ni resultado a sus pasos posteriores.
- Log fuera del árbol: `%TEMP%/task_e275a30d5f9a-verify.log`.
  Recibo anterior al corte: `%TEMP%/task_e275a30d5f9a-procesos.json`.
  Se detuvo únicamente verify propio PID 59060 y sus hijos 63768/23676.
  Turno liberado comunicado en `msg_8c4bb493e50d` antes de corregir.

### Sobre los cambios P2

- PASÓ: `pnpm exec tsx --test infra/ops/tests/practica-p2.node.ts`:
  6 pruebas, cero fallos y cero omisiones, 5,99 s; sin DB ni navegador.
  Verifica 20 conceptos máximos con UTF-8/escapes, exactamente 24576 bytes,
  rechazo a 24577 aun con header mentido, conteo UTF-8 real, cancelación del
  stream sin longitud, JSON/UTF-8 inválidos y parser canónico de precio con
  conversión a centavos y total de dominio.
- PASÓ: análisis sintáctico TypeScript de 6 archivos modificados, cero errores;
  no es typecheck ni ejecución de React.
- PASÓ: `git diff --check`.
- PASÓ: `pnpm docs:check`, índice sincronizado con 696 specs.
- NO EJECUTADO: Vitest de API con cuerpos máximos, navegador de las nuevas
  regresiones, Traefik actualizado, lint/tipos/build y verify sobre la nueva
  cabeza. Los ejecuta/coordina el Director; no se lanzaron procesos pesados.

Regresiones escritas para navegador: selección distinta, tres renglones sin
guardar, alternar pestañas y revalidación retenida sin interacción; conservar
texto y foco sin nueva lectura que reemplace el borrador; denegación con sesión
abierta y cambio de cuenta; «12.345», vacío y «12,» conservados sin POST, corrección
a «12,34», 1234 centavos y total 112,34 en el ejemplo. En headless se notifica
también el evento de retorno para motores sin distinción de visibilidad.

Comandos para la nueva cabeza, en serie cuando el Director asigne turno:

```powershell
$env:PATH = 'C:/Program Files/Git/bin;' + $env:PATH
$env:PRACTICA_NAVEGADOR = '1'
pnpm exec tsx --test infra/ops/tests/practica-p2.node.ts
pnpm exec vitest run lib/studio/practica/__tests__ --maxWorkers=1
node infra/ops/tests/practica-frontera.mjs
```

CI genérico no acredita el recorrido de navegador sin el flag explícito.
La revisión independiente anterior se aplica a la base, no aprueba esta cabeza.

## COMMITS

Producto, pruebas y allowlist: `77fa47216d7b223554c97da28833b99e3dec16d6`,
encima de la base `0f9215395c9a2c28df1621a5c50c06a9e3129bd4`.
Este recibo se conserva en un commit documental separado sin reescribir historia;
su SHA final se entrega en Orca. Las pruebas ligeras se ejecutaron sobre el
mismo contenido de producto que ese commit, antes de commitearlo.

## PR / BRANCH

PR #811 ya publicada por el Director. Sin push, nueva PR, merge ni despliegue
desde esta sesión; el Director actualizará la rama remota con la cabeza entregada.

## PENDIENTES DE ESTA TAREA

Navegador, API/PGlite, Traefik, CI y revisión independiente sobre la nueva cabeza.
No se declara ninguno de los tres criterios aceptado antes de esos resultados.

## FUERA DE ALCANCE DETECTADO

La presión de recursos y el turno pesado de fase 3 no se rodean con más procesos.
No se cambian roles, SQL, globales ni servicios del ERP real; no se toca VPS.

## HANDOFF AL DIRECTOR

Impacto documental: allowlist y contrato P2 en fase-2.md; historial previo intacto.
Los cambios están preparados para la actualización de #811 y nueva revisión.
Se usan solo datos inventados; acceso cerrado por defecto, sin env copiados,
sin proveedores de correo/WhatsApp/pagos reales y sin aplicar SQL compartido.
