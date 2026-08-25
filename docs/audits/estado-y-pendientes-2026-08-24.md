# Estado del ERP y checklist para entregarlo · 2026-08-24

> **Cómo leer esto.** Todo lo que dice "medido" se comprobó contra el código en
> esta sesión, no contra la memoria ni contra el estado de las specs. Lo que no
> pude medir, lo digo.
>
> **Rama de esta sesión:** `claude/carril-comercial-0281` · 6 commits · sin
> pushear (falta tu OK).

---

## 1 · Dónde estamos de verdad

### El conteo de specs no sirve para saber qué falta

Hay **50 specs en `status: in-progress`** y eso asusta, pero es residuo: casi
todas están cerradas en `main` y nadie les cambió el front-matter al mergear.
Medir por ahí da una foto falsa. La foto real se saca del código.

### La foto real (medida)

| Señal | Valor |
|---|---|
| Módulos del Studio con código propio | **56** (2 son redirects/placeholder a propósito: `resumen`, `ajustes`) |
| Tests unitarios | **5.561** en 474 archivos · verde |
| Contratos SQL (RLS/GRANT/triggers) | **114** · verde |
| Migraciones | **385**, schema reconstruible desde cero, ninguna sin aplicar |
| E2E | 150 pasan · 18 saltados |
| Build de producción | ✅ verde (era rojo — ver abajo) |

**El ERP no está a medio construir. Está construido y le faltan remates.** El
problema no es que falten módulos: es que había botones que no hacían nada,
pantallas que no existían y un gate que mentía.

### 🔴 El gate estaba rojo por código sano — arreglado

Al medir la línea base, `node scripts/verify.mjs` cerró **rojo en `typecheck` y
en `build`** con 5.503 tests en verde. La causa no era el código:

```
.next/types/validator.ts:737
  const handler = {} as typeof import("../../app/portal/(auth)/login/page.js")
```

Esa página la borró SDD-0276 al unificar la puerta en `/entrar`. Next genera
esos tipos en cada `dev`/`build` y **nunca los recolecta** cuando una ruta
desaparece; `tsconfig.json` los mete en `include`. O sea: `tsc` y el build de
producción estaban midiendo el árbol de rutas del pasado.

SDD-0280 había aislado la **salida** del build en `.next-verify`. Faltaba la
**entrada**. Cerrado con `scripts/prune-next-types.mjs`, cableado en el
preflight de `typecheck`, en `check-build.mjs` y en el script `typecheck` de
`package.json`. Poda **sólo** si encuentra una referencia a una ruta que ya no
existe; si está sano no toca nada.

---

## 2 · Lo que se construyó en esta sesión

Todo bajo **SDD-0281**, con tests y validado con mutación donde importaba.

- [x] **Gate arreglado** — `typecheck` y `build` verdes de nuevo.
- [x] **PDF de factura** (Studio) — `/studio/facturacion/[code]/pdf`.
- [x] **PDF de estimado** (Studio) — `/studio/cotizador/[code]/pdf`.
- [x] **PDF de factura para el cliente** — `/portal/facturas/[code]/pdf`. Antes
      la única forma de llevársela era abrir el comprobante e imprimir a PDF
      desde el navegador.
- [x] **Duplicar** estimado y factura.
- [x] **Exportar CSV** de estimados y de facturas, respetando los filtros de la
      vista.
- [x] **Nota de gestión** en Cobranzas (el backend ya existía desde el día uno).
- [x] **On-time delivery** y **Tránsito promedio** en el tablero — los dos KPI
      que decían "Próximamente".
- [x] **`/portal/compras/[code]`** — el detalle de compra que no existía.
- [x] **Estado de cuenta del cliente** en el Studio.

### Tres cosas que aparecieron al escribir los tests, no al escribir el código

1. **El PDF sumaba distinto que el servidor.** Yo redondeaba por línea y
   `calcInvoiceTotals` redondea una vez al final. Tres líneas de 33,333 daban
   99,99 contra 100,00 → el documento habría gritado "descuadre" en facturas
   sanas. Una alarma que suena sin motivo se aprende a ignorar, que es la forma
   de que el descuadre de verdad pase inadvertido. Hay un test de contrato que
   compara las dos funciones sobre los mismos juegos de líneas.
2. **El CSV no se podía sumar en Excel.** Usaba `fmtAmount` → `2,720.00`, y
   Excel lee esa celda como **texto**. Los montos van crudos con dos decimales.
3. **La ruta de export daba 403 a un anónimo, no 401.** Lo cazó el contrato
   `studio-api-auth-guard.test.ts` en el gate. Tiene razón: el proxy refresca la
   sesión en `/studio/*` pero su matcher **ni siquiera incluye `/api/studio`**.

---

## 3 · Checklist de lo que falta

### 🅰 Puedo hacerlo solo · no necesita decisión tuya

En orden de valor para poder mostrar el ERP funcionando.

- [x] **A1 · Avisarle al cliente cuando su carga llega a Yiwu.** → **SDD-0282**,
      hecho lo que se podía sin migración.

      ⚠️ **Corrección de lo que decía este documento.** Escribí que el aviso
      estaba "atado al estado del envío, no a la recepción de la caja". Al
      medirlo resultó ser sólo la mitad, y la mitad menos importante: **sí hay
      un gancho en la recepción de Yiwu** (`scheduleReceiptInWarehouse`,
      SDD-0162). Los huecos reales eran dos y peores:

      1. El gancho **descartaba** el aviso cuando el cliente no tenía envío
         abierto — el caso **normal** en una primera compra, porque el envío
         recién se crea al consolidar. Literal: `if (!shipment) continue;`.
      2. La recepción registrada desde la **oficina** (`/studio/cn`) no avisaba
         a nadie: nunca llamaba al fan-out.

      Ya cerrado: la oficina avisa, y cuando alguien se queda sin aviso queda
      asentado en la bitácora de la recepción con su Shipping Mark.

- [x] **A1b · Colgar el aviso de la compra, no del envío.** → **SDD-0283**.
      Migración **0389 aplicada en producción** el 2026-08-24 con tu OK; el paso
      `migrations-applied` del gate volvió a verde. La cola estaba vacía (0
      filas), así que el cambio no tocó ningún dato.

      ✅ **Y la regla ya estaba encendida.** Verifiqué en producción después de
      aplicar: `status:in_warehouse` está activa (`anchor: event`, `offset: 0`,
      `channel: email`). El camino quedó vivo de punta a punta — no tienes que
      encender nada. (Yo había escrito lo contrario un momento antes; lo medí y
      estaba equivocado.)

- [ ] **B6 · ¿El aviso de Yiwu sale también por push?** 🔴 *Techo medido.*
      La regla manda **sólo correo**, y de **484 clientes vivos, 136 no tienen
      correo** (28%). Esos no reciben este aviso por ningún lado — ni siquiera
      los que tienen el portal instalado, porque la regla no manda push. Pasarla
      a `channel: both` los cubre. Es decisión tuya: cambia lo que le llega a
      clientes reales.
- [x] **A2 · Vincular la recepción CN con el proveedor real.** → **SDD-0284**,
      y **sin migración**.

      ⚠️ **Segunda corrección de este documento.** Yo había escrito que hacía
      falta una FK a `suppliers_cn`. Al medir, dos cosas de esa frase no
      sobrevivieron:

      1. **`suppliers_cn` es POR CLIENTE**, no global (`tenant_id +
         client_markbox + supplier_seq`). La misma fábrica que le vende a tres
         clientes son tres filas. Esa FK **nunca** habría permitido "detectar
         que dos clientes compran al mismo".
      2. **El vínculo al proveedor ya existía en cadena**: recepción → compra →
         `suppliers_cn`. Y las compras lo traen: **8 de 8 (100%)**.

      🔴 **Lo que sí estaba roto era otra cosa, y peor:** de **6 recepciones, 0
      estaban atadas a su compra**. El único punto que las ataba exigía que la
      compra tuviera orden de venta — y **0 de 8 compras tienen una**. Así que
      `/portal/compras/[code]` le decía "todavía no registramos la llegada" al
      cliente cuya mercancía sí estaba en bodega.

      Cerrado separando el vínculo operativo del financiero.

- [ ] **A2b · Entidad de proveedor global.** Lo que de verdad responde "¿cuánto
      me manda este proveedor?" a nivel empresa: una identidad compartida entre
      clientes, con deduplicación y fusión. Es diseño propio. **Con 6
      recepciones en el sistema, hoy sería resolver un problema sin datos.**
- [x] **A3 · Fotos de la recepción en el detalle de compra del portal.** →
      **SDD-0285**. Medido: hay **3 fotos reales** sobre 1 de las 6 recepciones,
      así que la pantalla tiene qué mostrar. URLs firmadas a 1 h, indexadas por
      path (no por posición: si Storage omite una entrada, indexar por índice le
      mostraría al cliente la foto de OTRA caja).
- [x] **A4 · PDF del estado de cuenta.** → **SDD-0287**. En los dos lados: el
      asesor lo abre desde la ficha del cliente y el cliente lo descarga desde
      `/portal/facturas?vista=estado`. Sale del MISMO ledger que las dos
      pantallas — el papel no recalcula nada.
- [x] **A5 · Exportar CSV en Clientes, Cobranzas y Tracking.** → **SDD-0289**.

      🔴 Lo único que no era mecánico: `listShipments` corta en **100 filas** y
      `listClients` en `CLIENTS_MAX`. Topes correctos para una pantalla,
      mentirosos para un archivo. El export usa lecturas propias que paginan y
      **lanzan** si topan — un error se ve, un CSV corto no.
- [x] **A6 · Los modales sin focus-trap.** → **SDD-0290**. **17 cableados**;
      los 2 que quedan son *popovers*, no modales (atraparles el foco sería
      incorrecto).

      ⚠️ **El backlog de julio decía ~16 y estaba desactualizado**: son 23
      archivos, de los cuales **4 ya estaban migrados**.

      ⚠️ **No se migraron a `DrawerShell`**, y a propósito: ese shell impone su
      chrome, y varios de estos overlays son otra cosa (un editor con pestañas,
      la paleta ⌘K). Lo que les faltaba vive aislado en `useDialogA11y` — el
      mismo hook que `DrawerShell` usa por dentro. Aplicarlo no cambia un pixel.

      🔴 **Y apareció un archivo INVISIBLE para grep:** `BugReportModal.tsx`
      tenía un byte NUL crudo en el fuente, así que `grep` lo trataba como
      binario y **todo barrido de texto del repo lo salteaba en silencio**.
      Corregido a escape; mismo runtime, archivo de texto otra vez.
- [x] **A7 · Limpiar los 4 avisos de lint.** El repo cierra en **cero avisos**.

      Dos eran código muerto (`EMPTY_KPIS` en conversaciones, un import sin usar
      en rendiciones) y dos vivían en `ActionMenu`:

      - `haciaArriba` era **estado muerto**: la decisión de voltear el panel ya
        viaja dentro de `caja.top` desde el refactor a posición fija (SDD-0275).
        Era un `setState` de más en cada scroll, sin nadie que lo leyera.
      - El flag de montaje pasó de `useState` + `useEffect` a
        `useSyncExternalStore`, que es el patrón canónico de React para "¿ya
        hidraté?". Ahorra un render por cada montaje del menú **y** el aviso
        deja de existir en vez de silenciarse.

### 🅱 Necesita una decisión corta tuya · después lo hago

- [ ] **B1 · ¿La factura lleva razón social y RIF?**
      Hoy **no**, por el precedente explícito del finiquito (regla tuya del
      2026-07-20: la identidad legal completa es una excepción a pedir, no el
      default). Pero si la factura tiene que servirle al contador del cliente,
      probablemente sí. **Es tu llamada, no la mía.** Se cambia en un archivo.
- [ ] **B2 · ¿La factura se manda sola por correo al emitirla?**
      Hoy no. El motor de correo del Studio ya existe; es cablearlo.
- [ ] **B3 · Recordatorio masivo de cobranza por email.**
      El botón existe deshabilitado. No lo hice solo a propósito: **manda correo
      a clientes reales en lote**, y eso no se enciende sin que vos digas a
      quiénes y con qué texto.
- [ ] **B4 · Acreditación automática de referidos.**
      El portal dice "Próximamente". Mueve plata → necesita que definas cuándo
      se acredita exactamente.
- [ ] **B5 · ¿El aéreo se enciende?** `PrealertaAddons` lo muestra como
      "Próximamente · se activa desde la configuración de DTD".

### 🅲 Sólo tuyo · no es software

- [ ] **C1 · `doortudoor.com` vence el 2026-10-31.** El 301 a `dtdcargo.com` no
      se puede perder.
- [ ] **C2 · WhatsApp saliente con Meta.** Habilita A1 de verdad (hoy el aviso
      sale por push y correo, no por WhatsApp).
- [ ] **C3 · Habilitar a los 359 clientes** (lo hace José a mano).

---

## 4 · Qué necesita el ERP para que lo puedas mostrar

Mi lectura, con lo medido: **para una demo o una entrega, ya está.** Los cuatro
módulos que te importan tienen su ciclo completo:

| Módulo | Ciclo | Estado |
|---|---|---|
| **Comercial** | estimado → PDF/WhatsApp → aceptado → embarque → factura → PDF → cobranza → estado de cuenta | ✅ cerrado |
| **Logística** | embarque → hitos reales → contenedor → naviera → última milla → POD → cierra el embarque | ✅ cerrado |
| **Recepción CN** | prealerta → etiqueta pre-declarada → escaneo en Yiwu → estiba por lotes → consolidación | ✅ cerrado · 🟡 falta el vínculo con el proveedor (A2) |
| **Portal cliente** | entrar → compras (anunciar, etiquetas, **ver qué llegó**) → envíos → facturas + PDF → reportar pago → documentos → soporte | ✅ cerrado |

Lo que quedaría flojo en una demo es **A1**: el cliente que anuncia una compra y
no recibe ningún aviso hasta que se arma el embarque. Es lo que yo haría
después, y no necesita nada de vos para empezarlo.

---

## 5 · Lo que NO pude verificar

Honestidad sobre los límites de esta medición:

- **No abrí el ERP en el navegador.** Todo lo de esta sesión está verificado por
  tests, typecheck, lint y build — no por ver las pantallas andando. Las
  pantallas nuevas (`/portal/compras/[code]`, estado de cuenta, los PDF)
  **necesitan una pasada visual** antes de mostrárselas a nadie.
- **No probé los PDF contra datos reales de producción.** Los helpers puros
  están testeados; el render de `@react-pdf/renderer` no lo ejercita ningún
  test (igual que los dos documentos de nómina que ya viven en producción).
- **No medí el portal con lector de pantalla**, que sigue pendiente de las
  auditorías anteriores.
