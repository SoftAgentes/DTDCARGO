# Registrar lo que se le debe a un aliado de espacio (SDD-0631)

Dueño: contabilidad · Estado: vigente cuando la migración 0536 esté aplicada · Actualizado: 2026-11-13 · review-by: 2027-02-13

Cuando otra empresa nos vende espacio en su contenedor, lo que le debemos es una cuenta por
pagar (CxP) a un **proveedor**. Esta guía la registra ligada al contenedor para que el costo
llegue al margen en Costing & Margen. La spec es [SDD-0631](../specs/0631-cxp-ligada-contenedor/spec.md).

> «Aliado» en el ERP es el revendedor del lado del cliente (Clientes › Aliados). Quien nos vende
> espacio no se registra ahí: se registra como proveedor de tipo **Aliado de espacio**.

## 0 · Antes de empezar

- La migración `0536_cxp_ligada_contenedor.sql` tiene que estar aplicada en producción (OK de
  Sam nombrando el archivo, [runbook de migraciones](aplicar-migraciones-prod.md)). Sin ella,
  Tesorería no muestra el bloque «Costo de contenedor» y Costing avisa que el costo sale solo de
  lo cargado a mano.
- El contenedor tiene que existir en **Naviera** con sus embarques asignados y su CBM: el reparto
  del costo entre embarques se hace por CBM.
- Rol: `accounting` o `admin` (las mismas policies de escritura de Tesorería, 0470).

## 1 · Alta del proveedor (una vez por aliado)

Studio › Tesorería › Proveedores › **Nuevo proveedor**:

| Campo | Valor |
|---|---|
| Tipo | **Aliado de espacio** |
| Moneda por defecto | la del contrato (USD normalmente) |
| Cuenta de gasto por defecto | la cuenta de costo de flete del plan |

## 2 · La CxP del espacio, ligada al contenedor

Tesorería › **Nueva CxP**: proveedor, cuenta de costo, monto, moneda (con tasa si es VES o CNY),
vencimiento y la referencia del documento del aliado. En **Costo de contenedor**:

1. **Contenedor**: la consolidación (`DTD-CONSOL-…`).
2. **Embarque**: déjalo en «Todo el contenedor» si el espacio es del contenedor entero; el costo
   se reparte por CBM entre sus embarques. Elige un embarque solo si la deuda es de ese embarque.
3. **Qué costo cubre**: **Flete naviera** para el espacio.

Si la deuda ya estaba registrada, abre la CxP y usa **Ligar a contenedor** en el bloque «Costo de
contenedor». También sirve para cambiar o quitar el vínculo; una CxP anulada no se liga.

## 3 · Pago

Abre la CxP › **Registrar pago** como siempre. El pago genera su orden (OP-) y su asiento, pero
**no suma costo**: el costo es lo causado en la CxP, no lo pagado.

## 4 · Ver el margen

Costing & Margen › **Contenedores**: revenue, costo, la parte «De CxP» y el margen del
contenedor. En **Ranking de embarques**, cada embarque del contenedor muestra su parte del flete.

## 5 · Lo que no hay que hacer

- **No cargues el mismo flete dos veces.** En la categoría que cubre, la CxP reemplaza lo que se
  haya cargado a mano en Costing; no hace falta borrarlo, pero tampoco registres el mismo espacio
  como gasto (`expenses`) y como CxP. El cargador de consolidados mixtos (`--gasto-espacio`,
  [cargar-consolidados.md](cargar-consolidados.md)) lo registra como gasto, y Costing no lee
  gastos: si usas este camino, no uses esa opción para el mismo contenedor.
- **No subas el contrato ni los montos reales a Git.** El repositorio es público.
- Un contenedor sin CBM asignado deja el costo «sin repartir»: aparece en el contenedor, no en
  sus embarques, hasta que Naviera tenga el CBM.
