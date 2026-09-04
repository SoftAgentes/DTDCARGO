# Consultas de avisos del Portal estructuradas · SDD-0424 · evidencia local

Fecha: 2026-09-04

Alcance: adopción del pipeline, historial del Portal, estado staff y reglas de
avisos al cliente

Fuera de alcance: UI/actions consumidoras, otros módulos legacy, datos reales,
Cloud, migraciones, push, `main`, despliegues y limpieza

## Resultado

Las cuatro capas aceptan ahora el logger canónico como dependencia opcional y
conservan un logger local por defecto para sus llamadores actuales. Los eventos
distinguen lectura o escritura y la operación concreta sin registrar tenant,
cliente, regla, payload ni detalle libre del error.

Se retiraron ocho `console.*` libres. La lógica funcional no cambió: adopción e
historial siguen siendo best-effort, el estado staff conserva su paginación, y
las reglas mantienen validación, upsert lógico, protección de FK y siembra
idempotente.

## Evidencia ejecutada

- RED: 4/4 fallos confirmaron logs libres en los cuatro módulos.
- GREEN focal: 31/31 pruebas en cinco archivos.
- Suite completa: 7.404/7.404 pruebas en 590 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario del alcance: cero `console.*` libre en los cuatro módulos.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Las pruebas usaron dobles
y no consultaron ni mutaron datos reales.

## Estado

- SDD-0424: **done local**.
- Logs internos retirados en este slice: **8**.
- Capas de consulta/configuración estructuradas: **4/4**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por otros módulos internos legacy.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
