# Decisiones · WMS / Inventario de consolidación (SDD-0080)

> Respuestas a Cloud Code para pasar la spec de `proposed` → `approved`.
> Mockup de referencia: `Inventario de Consolidación · DTD-Cargo.html` (+ `inventario/inventario.jsx`).
> Decisión de diseño base (de Cloud Code): el WMS NO es greenfield — es una capa de
> lectura/derivación sobre lo que ya existe (`warehouse_receipts_cn/_ve` del bodeguero +
> `consolidations`/`container_types` de Naviera SDD-0047). El estado se deriva, no se inventa.

## 4 decisiones (2026-06-14, autorizadas por el usuario)

1. **Alcance Slice A = solo torre (lectura/derivación).**
   El botón "agregar al contenedor" (acción de consolidar) entra en **Slice B**. La cola
   "Listo para consolidar" del mockup es informativa en A; accionable en B. Arranca sin migración.

2. **Métrica = volumen/peso (CBM/kg). Sin valor en USD.**
   El valor de mercancía es sensible y NO se expone en la torre de inventario. El USD solo
   aparece en el contexto de **reclamos/seguro** (atado a la orden), no acá.

3. **"Listo para consolidar" = derivado automático con override manual.**
   Default por regla del sistema: `recibido` + **N días** en bodega (N configurable, sugerido 3–5).
   El bodeguero puede marcar/desmarcar a mano (a veces el cliente pide esperar más carga).

4. **Bodega VE = modo "despacho" (salida), no consolidación de entrada.**
   En VE lo que llega es carga de **salida** (estados tránsito → aduana → entrega), semántica
   distinta a CN (consolidación de entrada). **Mismo módulo, dos modos**: CN="consolidación",
   VE="despacho" — el tab del módulo hace el switch. No dos módulos.

## Resumen
Slice A solo-lectura · CBM/kg (sin USD) · "listo" auto-derivado con override · VE = modo despacho
dentro del mismo módulo (no greenfield: deriva de warehouse_receipts + consolidations).
