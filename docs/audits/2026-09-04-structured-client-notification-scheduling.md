# Agenda del Portal estructurada · SDD-0423 · evidencia local

Fecha: 2026-09-04

Alcance: programación de avisos al cliente, cuatro fanouts de dominio y marcado
de avisos no entregados

Fuera de alcance: queries de historial/configuración, productores externos,
agenda/datos reales, Cloud, migraciones, push, `main`, despliegues y limpieza

## Resultado

El correlador acompaña ahora cada fanout hasta la programación de la agenda y
su drain inline. Cada función conserva un logger local por defecto cuando no
nace dentro de una ejecución ya correlacionada.

Se retiraron diez `console.*` libres. Los eventos distinguen ancla faltante,
compatibilidad de migración, escritura, drain inline y los cuatro tipos de
fanout sin registrar regla, ancla, Shipping Mark, payload, ruta ni error crudo.

La lógica funcional no cambió: siguen vigentes la precedencia de reglas, la
idempotencia 23505, el reanclaje ETA/ETD, el fallback pre-0389 y la devolución
explícita de clientes sin destino.

## Evidencia ejecutada

- RED: 4/4 fallos confirmaron los tres módulos con logs libres y el drain inline
  sin propagación.
- GREEN focal: 47/47 pruebas en cinco archivos.
- Suite completa: 7.400/7.400 pruebas en 589 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario del alcance: cero `console.*` libre en los tres módulos.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Las pruebas usaron dobles
y no procesaron agenda, correo, Telegram ni Web Push reales.

## Estado

- SDD-0423: **done local**.
- Logs internos retirados en este slice: **10**.
- Fanouts correlacionados: **4/4**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por queries y otros módulos internos legacy.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
