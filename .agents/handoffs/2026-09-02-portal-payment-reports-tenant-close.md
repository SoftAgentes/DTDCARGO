# Cierre local · SDD-0364 · Frontera Portal de reportes de pago

Fecha: 2026-09-02. Rol: worker aislado.
Estado: AISLAMIENTO LOCAL VERIFICADO · PUBLICACIÓN BLOQUEADA.

## Identidad y propiedad

- Tarea: `01a05f15-80ff-77b1-9f3a-6b07d21df02d`, **Audita y limpia worktrees**.
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`.
- Rama: `codex/saneamiento-integral`; base local `9b2430690f10941a133eae42de12e3e10f31a8cf`.
- Base publicada: `eabb230b257579d3b5527a8721eebc328d748f79`.
- `origin/main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`, sin cambios.
- Sólo esta tarea activa de DTDCargo. No se mueve el checkout principal.
- TDD con reproducción independiente: agente `academia_rls_regression` sólo
  escribe el test SQL; principal conserva spec, migración, checklist y handoffs.
- Allowlist de siete rutas en SDD-0364; índice inicialmente vacío. Commit
  selectivo que contiene esta acta: `fix(portal): SDD-0364 — aislar reportes de pago por tenant`.

## Resultado y límites

Tres policies Portal exigen principal activo, cliente vivo y coherencia de
tenant + Shipping Mark, tanto para lectura como fila previa/nueva de escritura.
El historial propio no depende de factura viva; el trigger de factura y la RPC
0359 permanecen idénticos. No cambia ACL, equipo, Storage, funciones/triggers,
runtime TS/TSX ni decisión contable. No crea un escritor nuevo.

Esto NO cierra el módulo de pagos. Diagnóstico adicional confirmado antes del
fix, sin perpetuarlo como permiso aprobado en GREEN:

- Cancelación propia exacta, sin RETURNING: 42501, cero filas, sin soft-delete.
- Campos de confirmación/moneda/path ajeno aceptados por INSERT/UPDATE directos.
- Miembro no financiero confirma directamente sin acumular paid_amount; su RPC
  es rechazada y la RPC de accounting sí acumula de 20 a 120 sintéticos.
- Error del contador de pendientes devuelve cero según código; falta su test.

Siguiente prioridad local: comandos restringidos, auditoría atómica y resultados
veraces, con validación de comprobantes. No ampliar SELECT para permitir borrar
ni retirar API/permisos antes de contar con una transición compatible. La firma
real de comprobantes y una explotación alojada NO fueron probadas.

## Evidencia ejecutada

| Verificación | Resultado |
|---|---|
| RED sin 0420 | exit 1 por autorización después de confirmar cuatro cruces reales |
| GREEN real | exit 0; ambos sentidos, ocho principales inválidos, historial/escritor propio |
| Drift | diez variaciones rechazadas y revertidas |
| Preservación | dos policies no Portal, todas las demás/Storage, ACL, funciones, triggers y datos intactos |
| SQL completo | 161 contratos pasan, rollback total |
| Rebuild | 417 migraciones: 399 desde cero + 18 sólo-ledger; 219 tablas/dos tenants sintéticos |
| Unitarios pagos | 19 pruebas pasan |
| Docs/numeración/gobernanza/componentes/diff | pasan; sin colisiones nuevas |

No repetir build/E2E sin cambios de aplicación. El CI verde de `eabb230b` no
cubre los tres commits locales posteriores. Fixture exclusivo sin red/puertos,
montaje read-only: `dtd_payment_reports_0364_codex_20260902`, ID
`5b3865e0dbb02807eff2e7449526a327598f85c9e54a51521ba628dad800c1ef`.
Rollback verificado; detenido por su ID tras comprobar etiquetas. Ausencia
posterior confirmada, igual que los runners SQL/rebuild; ningún contenedor ajeno.

SHA256 de la migración local:
`2FFC171EE19EF32C4569EAA8803EFDA3D58B8AEFD3BCAB01F2B493433DEA4A3C`.

## Gates pendientes

- Auto-review rechazó el push de `f1cd9743` y exige autorización explícita del
  commit/destino. No se reintenta ni se usa otra vía. También quedan locales
  `9b243069` y el commit de esta acta; sólo podrían ir a la rama propia en
  `https://github.com/hailuwaycom-sketch/DTDCARGO` tras resolver esa aprobación.
- CI del SHA publicado, integración exclusiva a main y release son gates separados.
- 0420 NO aplicada. Requiere GO nominal individual, runbook y smoke autorizado;
  no necesita RPC/deploy previo. El paquete tiene 22 gates Cloud, 0399–0420.
- No limpiar el worktree activo ni las ramas archive todavía no contenidas.
- Founder: permisos externos. Esta tarea: siguiente slice local de comandos.
- Tiempo/tokens del slice: n/a; la plataforma sólo muestra el objetivo acumulado.
