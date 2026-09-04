# Primitivas de notificación estructuradas · SDD-0422 · evidencia local

Fecha: 2026-09-04

Alcance: escritura in-app, envío Telegram a usuarios, notificación móvil de
despacho y propagación desde los tres eventos de bugs

Fuera de alcance: productores de Bitácora/change requests, agenda del Portal,
proveedores/datos reales, Cloud, migraciones, push, `main`, despliegues y limpieza

## Resultado

Las tres primitivas compartidas usan ahora el logger estructurado. La escritura
in-app diferencia insert y fallo general; Telegram distingue envío y dispatch;
el aviso al camionero conserva un único correlador desde la lectura de la orden
hasta el enqueue y drain de Web Push.

El notificador de bugs entrega además su correlador a sus tres escrituras
in-app. Las demás llamadas conservan compatibilidad mediante un correlador local
por defecto.

Se retiraron cinco `console.*` libres. Los eventos no incluyen IDs, payloads,
chats, texto del mensaje, rutas, shipping marks ni errores crudos.

## Evidencia ejecutada

- RED corregido: 4/4 fallos confirmaron las tres primitivas con logs libres y
  las tres llamadas in-app sin propagación. El primer patrón demasiado amplio
  dio un falso verde y fue endurecido antes de implementar.
- GREEN focal: 14/14 pruebas en tres archivos.
- Suite completa: 7.396/7.396 pruebas en 588 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario del alcance: cero `console.*` libre en las tres primitivas.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Las pruebas usaron dobles
y no enviaron correo, Telegram ni Web Push.

## Estado

- SDD-0422: **done local**.
- Logs internos retirados en este slice: **5**.
- Escrituras in-app de bugs correlacionadas: **3/3**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por otros productores, queries y módulos internos legacy.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
