# Web Push del Portal estructurado · SDD-0425 · evidencia local

Fecha: 2026-09-04

Alcance: rutas de alta/baja, opt-in del navegador y configuración VAPID

Fuera de alcance: entrega o suscripciones reales, cambios visuales, permisos,
RLS, migraciones, variables alojadas, Cloud, push, `main`, despliegues y limpieza

## Resultado

Las rutas de alta y baja crean un correlador desde el request y devuelven todas
sus respuestas con `x-request-id`. El opt-in del navegador y la configuración
VAPID emiten eventos estructurados con operación y etapa, sin registrar endpoint,
claves, payload, usuario ni tenant.

Se retiraron cinco `console.*` libres. El contrato funcional no cambió: las
rutas siguen exigiendo un principal Portal coherente antes de elevar, validan el
body, conservan los mismos estados HTTP y VAPID continúa en no-op cuando faltan
claves.

## Evidencia ejecutada

- RED: 6/6 fallos confirmaron cinco logs libres y dos rutas sin correlación.
- GREEN focal: 262/262 pruebas en cinco archivos.
- Suite completa: 7.410/7.410 pruebas en 591 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario del alcance: cero `console.*` libre en los cuatro módulos.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Las pruebas usaron dobles:
no crearon, borraron ni entregaron suscripciones reales.

## Estado

- SDD-0425: **done local**.
- Logs retirados en este slice: **5**.
- Rutas correlacionadas: **2/2**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por otros módulos internos y consumidores legacy.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
