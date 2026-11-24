# Fase 2 · Facturación personal

Base: `12f20d5f2`. Receptor exclusivo de fase 1; acceso apagado por defecto.
Contrato compartido: cada módulo conserva su documento JSON versionado por espacio;
las escrituras usan revisión esperada y comparación atómica. La sesión, nunca el
cliente, determina el espacio. Cada operación vuelve a consultar permisos al origen.
Una revisión vencida exige recargar; un reintento no repite un pago ni un reinicio.
En esta fase `documentos` y `practica_facturacion` pertenecen exclusivamente a
Facturación. Los siguientes módulos crean almacenes y RPC propios con el mismo
contrato, sin sobrescribir este documento. Entrada `{ espacio, revision, comando }`;
respuesta `{ revision, documento, edicion }`. La cookie HttpOnly resuelve la sesión;
el espacio del cuerpo solo se compara, nunca selecciona una copia ajena. Una
lectura prepara la semilla una sola vez. Conflicto de revisión responde 409 y exige
recargar, conservando el estado ya confirmado. Los eventos con ID, hora de servidor,
fuente, motivo y snapshots antes/después se guardan con la mutación en el mismo CAS.
La pertenencia del evento se hereda de su espacio personal; no se guarda identidad real.

Semilla `facturacion-1`: embarque ficticio `PRA-EMB-001`, preorden de USD 300
y factura emitida independiente. Desglosar en carga por CBM 250 y sobrepeso 50
conserva 300. También se puede repartir 300 en tres renglones (200 + 50 + 50),
renombrando el tercero; agregar un artículo como recargo aumenta el total. Cantidades enteras y
precios en centavos; no hay impuestos en este caso sintético.

Fuentes: acciones vigentes de Facturación, guía invoices y SDD-0690. Los conceptos
solo cambian en borrador. Una emitida no se elimina ni se edita: sin pagos vivos se
anula con motivo y se crea otra; con pagos primero corresponde anular los cobros
en Cobranzas. Esta fase no simula reversos de Cobranzas ni excepciones legales.
El caso sintético supone satisfechos los requisitos de emisión; no enseña a
saltarse la puerta legal ni reproduce las excepciones de contenedores reales.

Allowlist exacta:

- `docs/specs/0713-modo-prueba-personal/fase-2.md`
- `docs/specs/0713-modo-prueba-personal/spec.md`
- `.agents/handoffs/task_93d94bbf6612.md`
- `.agents/handoffs/task_e275a30d5f9a.md`
- `lib/studio/practica/facturacion.ts`
- `lib/studio/practica/servidor.ts`
- `lib/studio/practica/config.ts`
- `lib/studio/practica/identidad.ts`
- `lib/studio/practica/cuerpo.ts`
- `lib/studio/practica/__tests__/acceso.test.ts`
- `lib/studio/practica/__tests__/facturacion.test.ts`
- `infra/ops/staging/practica-facturacion.sql`
- `infra/ops/staging/practica-traefik.yml.tmpl`
- `infra/ops/tests/practica-frontera.mjs`
- `infra/ops/tests/practica-p2.node.ts`
- `app/api/practica/[operacion]/route.ts`
- `app/studio/practica/PracticaPersonal.tsx`
- `app/studio/practica/FacturacionPractica.tsx`
- `app/studio/practica/practica.module.css`

Revisión P2 de #811 sobre `0f9215395`: conservar editor y foco durante
revalidación de la misma identidad y permisos, sin interacción pendiente;
descartar el detalle al perder autorización o cambiar identidad/permisos de
Facturación. El precio usa `NumericInput` canónico, con texto corregible y
validación nativa antes de guardar o emitir. El cuerpo financiero admite 24 KiB:
20 conceptos de 100 unidades UTF-16 incluso escapadas (hasta 12000 bytes),
metadatos de líneas y motivo de 500 unidades escapadas, con margen acotado.
Se cuentan bytes del stream, aunque Content-Length falte o mienta. Las otras
operaciones conservan 2048 bytes, también en Traefik. Los tres P2 requieren
regresiones de API y navegador sobre la nueva cabeza; solo se ejecutan controles
ligeros en este turno, cedido a fase 3.

Gobernanza R3: MP-01/AUD-01 conservación e historial, FRM-01/ERR-01 errores
locales, A11Y-01 controles con etiquetas y ayuda nativa, VIS-01 marca heredada.
Cumplimiento propuesto sujeto a pruebas; aceptación visual y verificación canónica
pendientes del cierre canónico. IA no aplica: ayuda local sin Faro. No hay transportes de envío ni pagos.
SQL exclusivamente para base desechable después del bootstrap; nunca aplicado en
servidores compartidos. Apertura, integración y despliegue quedan al Director.

## Evidencia local

Seguimiento de la base `0f9215395`: 22 pruebas focales aprobadas, cero omisiones,
incluido Chromium a 390/1280 px y temas claro/oscuro (2026-11-24, 14:43 Caracas).
El canónico de ese seguimiento pasó harness, lint, RSC, tipos y edge-functions;
se interrumpió durante la suite general al recibirse el dictamen de tres P2,
para liberar el turno de fase 3. Esto no acredita los cambios posteriores P2.
Su recibo, las seis pruebas ligeras aprobadas y la validación pendiente de la
nueva cabeza se separan en [el handoff de correcciones](../../../.agents/handoffs/task_e275a30d5f9a.md).

- `PRACTICA_NAVEGADOR=1 pnpm exec vitest run lib/studio/practica/__tests__ --maxWorkers=1`:
  20 pruebas pasaron, sin omisiones, sobre el árbol sin commit anterior al ajuste
  financiero. Ese resultado no acredita el SHA final. El prefijo de
  variable se establece con `$env:PRACTICA_NAVEGADOR='1'` en PowerShell.
- La prueba óptica/funcional a 390 y 1280 px usa los componentes reales, el proxy
  Next, el handler y SQL ejecutado en PGlite. La autenticación de origen y el
  transporte entre servicios son dobles instrumentados, con rechazo de cualquier
  destino no previsto. No equivale a una instalación del receptor en un VPS.
- `node infra/ops/tests/practica-frontera.mjs`: pasó con Traefik v3.7.14 real y
  la plantilla de esta fase, backend whoami sintético y contenedores eliminados
  al terminar. La autorización de negocio se prueba en el handler, por separado.
- La base efímera conserva los documentos entre recargas y entradas; demuestra
  dos cuentas, consulta/edición, permisos recortados, emisión, anulación con
  motivo, pago único y dos reinicios concurrentes con una sola revisión ganadora.
- Las capturas locales están en `%TEMP%/sdd-0713-fase-2/`, estados `conceptos`
  y `reiniciada` a ambos anchos. Solo contienen datos sintéticos.
- En CI unitario, el recorrido de Chromium aparece como SKIP si no se establece
  `PRACTICA_NAVEGADOR=1`; los casos de API, dominio y SQL no dependen de esa opción.
- Resultado final de `pnpm verify`, omisiones y SHA: handoff de esta fase.
- Cierre por capacidad local: el Director liberó el turno pesado por presión de
  memoria (`msg_d15401d533c2`). El verify con PATH antiguo quedó INTERRUMPIDO, con
  un fallo observado de Kommo; el mismo caso dirigido pasó con Git Bash. La
  nueva matriz financiera y el recorrido ampliado en claro/oscuro están escritos,
  pero su corrida final también se interrumpió por ese límite. No se ejecutaron
  verify ni build sobre el SHA final. Se entrega para revisión con CI pendiente;
  no se declara aceptada la fase.

## Matriz de autorización por operación

La proyección del origen se acota a la intersección entre el permiso efectivo
del Studio y la operación real. Se relee la membresía activa en cada operación;
no se cambia el RBAC, las RLS ni los roles del ERP real.

| Perfil / operación | Resultado previsto | Fuente vigente en Git |
|---|---|---|
| `accounting` o `admin` activo, detalle interno | Consulta y edición según el permiso efectivo | RLS 0414 y 0407 |
| `warehouse` con extra `invoices`, incluso de edición | Sin detalle de Facturación ni comandos; conserva la práctica y Almacén China | RLS 0414/0407; `moduleCoverage(invoices)` = `money_phase` |
| Guardar conceptos / emitir | Membresía financiera + edición; solo borrador válido | `facturacion/actions.ts` y 0407; requisitos legales satisfechos únicamente en la semilla ficticia |
| Cobrar | Membresía financiera + edición; emitida y saldo positivo; cobro igual al saldo, una vez | `registerPayment`, `registerCollectionFor`, RPC 0533 |
| Anular | Membresía financiera + edición; emitida sin pagos vivos y motivo; conserva original | `voidInvoice`, RPC 0497; comprobación de cobros vivos en la acción vigente |
| Reiniciar | Propietario + permiso financiero de edición + revisión vigente; confirmación cancelable | Contrato personal de esta fase |
| `support` en Almacén China | Consulta sin edición | `rbac.ts`, invariante support de solo lectura; proyección de práctica |
| Extra de `clients` a `warehouse` | El extra cubierto sigue concediendo el nivel autorizado; Clientes no se agrega a este recorrido | `user-module-grants.ts`, cobertura `covered`; 0539/0540 |

**Consulta sin edición en el detalle financiero: no aplica hoy.** Las RLS
0414/0407 admiten los mismos dos roles; ambos tienen edición por el rol en el
módulo bloqueado, y los extras solo suman. No se inventa un perfil financiero
de lectura ni se cambia SQL para producirlo. La consulta sin edición se acredita
con support en Almacén China, en la lista de permisos y en el contrato del origen;
el ejercicio operativo de China corresponde a su fase posterior. Las vistas
reducidas de Embarques/Almacén no abren el detalle financiero de este receptor.
