---
sdd: "0177"
title: "Portal — Estado de cuenta (libro de movimientos)"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0042", "0134", "0169", "0170", "0171", "0173"]
confidencialidad: interno
---

# SDD-0177 — Portal · Estado de cuenta

## 1. Decisión aprobada

Cerrar la **brecha 4 (y última) de la Fase 7 del Revestido**: el `StatementLedger`
del Norte (`_norte/portal/app.jsx` L1771-1818) — un libro de movimientos con
**Fecha · Concepto · Referencia · Cargo · Abono · Saldo** y saldo corrido.

Es la última pieza del mapa de la Fase 7 (SDD-0169 §Mapa). Después de esta, el
portal queda al Norte.

**Decisión del founder (2026-07-29) — la fecha del abono:**

Se le planteó que el Norte fecha cada abono en la **fecha de vencimiento** de su
factura, lo cual describe un pago que no ocurrió ese día (y puede pintar abonos
con fecha futura). La alternativa era derivar los abonos de los reportes de pago
**confirmados** (`payment_reports.paid_at`, fechas reales) con una línea de ajuste
por el remanente.

**El founder eligió seguir el Norte tal cual.** Se construye así. Como el dato
mostrado no es una fecha de pago real, la tabla lleva **una nota al pie** que lo
dice en una línea — no cambia el diseño y evita que el cliente lea la columna
como "el día que DTD recibió mi plata".

## 2. Problema

`/portal/finanzas` se describe a sí mismo como "el estado de cuenta"
([finanzas/page.tsx:27-33](../../../app/portal/(app)/finanzas/page.tsx)) pero es
**KPIs + lista de facturas**. `/portal/facturas` es la tabla densa. Ninguna de las
dos responde la pregunta que trae al cliente:

> *"¿Cómo llegué a deber esto?"*

No hay **movimientos**: no existe la noción de cargo/abono ni el saldo corrido.
La palabra "Abono" no aparece en el repo.

## 3. Alcance

### 3.1 Dónde vive

En **`/portal/facturas`**, como en el Norte: un botón alterna entre la vista
actual (tarjetas en móvil / tabla en escritorio) y el estado de cuenta. No es una
ruta nueva ni una pestaña — el Norte lo modela como dos lecturas del mismo dato y
esa lectura se respeta.

`/portal/finanzas` no se toca en esta spec.

### 3.2 La derivación (función pura)

`lib/portal/statement-ledger.ts` — `buildStatementLedger(invoices)`, sin acceso a
red ni a Supabase, testeable en aislamiento:

- cada factura produce un **cargo (+)** por su `total`, fechado en `issuedAt`;
- si `paid > 0`, produce además un **abono (−)** por lo pagado, fechado en
  `dueDate` (decisión §1);
- se ordenan por fecha, con el abono **después** de su cargo cuando caen el mismo
  día (empate resuelto por tipo, no por un `+1` de milisegundo como el Norte —
  acá las fechas son `date`, no timestamps);
- el **saldo corrido** acumula cargo − abono en ese orden.

Fuente: `listMyInvoices` — ya trae `total`, `paid`, `issuedAt`, `dueDate`,
`code`, `shipmentCode` y **excluye borradores y borradas**
([portal-queries.ts:220-251](../../../lib/portal/portal-queries.ts)).

**Cero migraciones. Cero columnas nuevas. Cero queries nuevas.**

### 3.3 Dos casos que el Norte no tiene (y el repo sí)

1. **Varias monedas.** El Norte asume una sola. El portal ya resuelve esto en
   Finanzas y Facturas: se calcula sobre la **moneda dominante** y se avisa que
   hay facturas en otras. El ledger hace lo mismo — sumar entre monedas sería
   incorrecto, y un saldo corrido mezclado es peor que no mostrarlo.
2. **Fechas nulas.** `issuedAt` y `dueDate` son nullable en el repo. Una fila sin
   fecha se ordena **al final** y se renderiza `—`; nunca se inventa una fecha ni
   se cae el orden.

### 3.4 Contraste (no negociable)

El tema oscuro es el **default** del portal y los tokens con nombre de color
voltean. Antes del commit se **mide** con `getComputedStyle` + fórmula WCAG en
ambos temas, no se mira:

- el Norte pinta los abonos con `--success` — **4.33:1**, bajo el umbral de body
  (BRAND §♿). En texto chico no va solo por color;
- `--color-status-warning` como texto es **3.14:1** → prohibido en esta tabla
  (es justo la clase de bug que barre la spec hermana);
- el saldo final del Norte usa `--wine-text`, que **sí** es el token de wine como
  texto en ambos temas (BD-026).

## 4. Fuera de alcance

- Tocar `/portal/finanzas`.
- Derivar abonos de `payment_reports` (evaluado y descartado por el founder, §1).
- Exportar el estado de cuenta (PDF/Excel).
- Cualquier cambio de esquema.

## 5. Verificación

- `node scripts/verify.mjs` en verde.
- Tests unitarios de `buildStatementLedger`: factura sin pagos (solo cargo) ·
  pago parcial · pago total (saldo a 0) · sobrepago · varias facturas fuera de
  orden · fechas nulas · lista vacía · saldo corrido que **cuadra** con
  `Σ(total) − Σ(paid)` de las facturas de esa moneda.
- Verificación visual **medida** en `data-portal-theme="dark"` y en claro.
- `/ui-check` antes del commit.

## 6. Bitácora

- **2026-07-29** — spec abierta. Nació como **0175** (la 0174 ya estaba tomada
  por `0174-audit-atomicidad-dominios`) y terminó en **0177**: entre que se
  escribió y que se publicó, otra ventana pusheó
  `0175-vis-02-tipografia-voz-idioma`. Como la otra ya estaba en `main`, la que
  se mueve es esta — mismo criterio que cuando 0172 pasó a 0173.

  **Cuarta colisión de numeración del día.** Chequear `origin/main` antes de
  numerar NO alcanza cuando el trabajo dura horas: entre el chequeo y el push
  hay ventana. Lo único que la cierra de verdad sería reservar el número con un
  commit vacío al abrir la spec, o que `docs:check` detecte números duplicados
  (hoy **no lo hace** — sólo mira el front-matter de cada spec por separado).

- **2026-07-29 — CONSTRUIDA.** `lib/portal/statement-ledger.ts` (función pura,
  13 tests) + `StatementLedgerTable.tsx` + `?vista=cuenta` en `/portal/facturas`.
  Cero migraciones, cero queries nuevas. **Con esto cierra la Fase 7: el portal
  queda al Norte.**

  **Lo que apareció MIDIENDO y no razonando:**

  1. **Los montos se partían en dos líneas.** Las columnas de Cargo/Abono/Saldo
     salieron a 100px "a ojo". Medido con la tipografía real (JetBrains Mono
     12.5px/700): `−USD 128,450.00` ocupa **105px** y `USDT 1,284,500.00` **116px**
     → la fila crecía de 46px a **72px** de alto y el número se leía en dos
     renglones. Corregido a 124px + `whitespace-nowrap`, para que un número más
     largo desborde a la vista en vez de re-maquetar la fila en silencio.
     Anchos definitivos: `76px · 1fr · 100px · 124px · 124px · 132px`
     (`min-w-[720px]`, la caja scrollea sola y la página **no** desborda).

  2. **El contraste, medido en los dos temas** (claro / oscuro): montos
     **16.49 / 13.08** · fecha y referencia **12.63 / 7.33** · encabezado y
     Totales **12.10 / 9.03** · saldo final `--color-wine-text` **10.13 / 7.93** ·
     nota al pie **12.10 / 9.03**. Los íconos de fila (no-texto, umbral 3:1):
     cargo **8.41 / 5.94**, abono **3.64 / 3.85**. Todo pasa.

  **Desvío deliberado del Norte:** la columna Abono **no** va en verde. El Norte
  la pinta con `--success`, que mide 4.33:1 sobre papel claro — bajo el umbral de
  body. El monto va en `--color-ink` y la distinción cargo↔abono la llevan el
  signo `−`, la columna y el ícono (WCAG 1.4.1, "no solo color").

  **Decisión propia, no del Norte:** el ledger se arma SIEMPRE con todas las
  facturas, aunque esté puesto `?saldo=1`. Un libro al que le faltan movimientos
  no cuadra el saldo corrido.
