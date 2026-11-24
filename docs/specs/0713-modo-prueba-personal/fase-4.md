# Fase 4 · Embarques y recepción Venezuela

Base: 8b2dabdac98f9e58efdb58eb21f8beb4949fa514 (#812). Acceso cerrado.
Contrato: conservar el documento operativo CAS de China, identidad de cajas,
cliente, consolidado y preorden. No editar Embarques real ni importar sus acciones.
Facturar abre revisión del documento de ese embarque, aunque otro está seleccionado;
primera confirmación revisa datos, segunda emite el documento seleccionado sin cambiar
líneas ni código. Cancelar no escribe. Estado emitido muestra resultado y enlace al
detalle de práctica; pago bloquea anulación. Edición solo desde Facturación en borrador.
La recepción nueva sigue sin preorden. La avanzada conserva su preorden preparada.
Embarcar requiere shipments edición; recepción VE requiere ve edición, reevaluados
por operación en servidor. Lecturas operativas nunca incluyen detalle financiero.
Ayuda nativa details/summary, teclado y tacto; Faro cerrado, fallback local permanente.
Reanudación usa documento persistido y revisión compartida; sin SQL ni destinos reales.

Allowlist exacta:
- docs/specs/0713-modo-prueba-personal/fase-4.md
- docs/specs/0713-modo-prueba-personal/spec.md
- .agents/handoffs/task_023e299bbf69.md
- lib/studio/practica/china.ts
- lib/studio/practica/servidor.ts
- lib/studio/practica/facturacion.ts
- lib/studio/practica/__tests__/embarques.test.ts
- lib/studio/practica/__tests__/acceso.test.ts
- app/api/practica/[operacion]/route.ts
- app/studio/practica/ChinaPractica.tsx
- app/studio/practica/PracticaPersonal.tsx
- app/studio/practica/FacturacionPractica.tsx

R3: MP-01 y AUD-01 conservación e historial; ERR-01 conflicto explícito;
A11Y-01 ayuda nativa y ConfirmDialog; VIS-01 tokens y estilos existentes.
Clasificación pendiente de pruebas, no aceptación anticipada. Sin excepción nueva.
La operación china existente conserva ambas listas de acceso; no abre otra ruta.
