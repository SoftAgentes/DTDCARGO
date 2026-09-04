# Proveedores y Prealertas Portal estructurados · SDD-0427 · evidencia local

Fecha: 2026-09-04

Alcance: acciones de proveedores, compras, adjuntos, add-ons y workflow

Fuera de alcance: formularios, captura, permisos, RLS, Storage, operaciones o
datos reales, migraciones, Cloud, push, `main`, despliegues y limpieza

## Resultado

Cada acción pública crea ahora su logger canónico. Ese mismo correlador acompaña
los helpers internos de adjuntos, solicitudes de servicio y workflow. Los eventos
registran sólo operación, etapa y error saneado; no incluyen rutas, archivos,
Shipping Mark, códigos, proveedor, compra ni contenido del formulario.

Se retiraron quince `console.*` libres. No cambió la lógica funcional: scopes de
principal y tenant, validaciones, reintentos 23505, rollback de objetos y caminos
best-effort mantienen sus contratos anteriores.

## Evidencia ejecutada

- RED: 5/5 fallos confirmaron logs libres, falta del logger y tres helpers sin
  propagación.
- GREEN focal: 23/23 pruebas en cuatro archivos.
- Suite completa: 7.422/7.422 pruebas en 593 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario del alcance: cero `console.*` libre en el módulo.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Las pruebas usaron dobles:
no crearon proveedores, compras, adjuntos, servicios ni workflows reales.

## Estado

- SDD-0427: **done local**.
- Logs retirados en este slice: **15**.
- Helpers internos correlacionados: **3/3**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por otros módulos internos y consumidores legacy.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
