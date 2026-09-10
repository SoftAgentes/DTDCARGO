# Sonda reutilizable de navegación

Dueño: Worker d1. Estado: instrumento validado; H1 resuelto documentalmente.
Fecha: 2026-09-10. Clasificación: interno.

## Cuándo tiene sentido usarla

El caso que motivó esta sonda ya está resuelto: la corrida L de la tarea externa
PR #28 eliminó el bucle bajo compilación de producción y las siete corridas
posteriores lograron Auth18 18/18. La [SDD-0451](spec.md) atribuye y cita esa
evidencia. Nuestra corrida HTTP 500 sigue inconclusa; no aportó la resolución.

El emisor H1 fue acotado por eliminación, nunca observado directamente. La sonda
hace barata esa observación pendiente si una recurrencia cambia el diagnóstico
o si el Director prioriza la recomendación 5 sobre el grafo y necesita conocer
la pila y el módulo antes de decidir un arreglo. Se conserva para esos casos,
sin convertir la laguna en una nueva condición para cerrar H1.

Las instrucciones siguientes son para una tarea futura con ejecución autorizada,
entorno efímero autenticado y un caso observable. El cierre documental actual
no levanta servidores, no ejecuta la sonda ni repite sus pruebas. Un HTTP 500 por
falta de configuración no justifica medir otra vez el mismo escenario.

## Ejecutar en una tarea futura autorizada

Desde el worktree que se quiere medir, con su servidor **`next dev --webpack`**:

```powershell
corepack pnpm install --frozen-lockfile
node --test scripts/probes/navigation-emitter.node.mjs
node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 4319
```

En otra terminal del mismo worktree:

```powershell
node scripts/probes/navigation-emitter.mjs --url 'http://127.0.0.1:4319/m/erp?tab=expenses' --seconds 60 --output 'C:/ruta-externa/recibo-nuevo.json' --prepare 'C:/ruta-externa/preparar-sesion.mjs'
```

El destino de salida no debe existir. `--prepare` es un módulo local explícito que
exporta `async prepare({ page, context, baseURL })`; establece la sesión sintética
autorizada en **la misma página** antes de armar el contador. También se admite
`--storage-state` con un archivo externo autorizado. La sonda no busca credenciales,
no genera usuarios, no hace seed ni modifica DB. No guardar sesiones en Git.

Para reproducir la secuencia histórica, el preparador debe usar el login UI en
`/studio/login?next=%2Fstudio%2Fgastos`, esperar `/studio/gastos` y que termine la
actividad inicial, y devolver el control. El runner entra luego a
`/m/erp?tab=expenses`. Esto corresponde a `e2e/gastos-expense-void.spec.ts:39-66,99`.
No usar producción detrás de un Next local: esta ruta consulta filas de negocio.
Endpoint loopback por sí solo no certifica que el backend sea efímero.

## Leer el recibo

1. Leer `navigationTypes` y **`successorNavigationTypes` primero**. El `navigate`
   inicial producido por `page.goto` es arranque de la medición, no evidencia de
   un bucle. Sin documentos sucesores no se puede elegir una rama del diagnóstico.
2. En documentos sucesores del bucle: `reload` mantiene la hipótesis React Refresh;
   `navigate` la refuta para ese bucle. Verificar después los eventos `emitter`.
   El `navigationType` de un `emitter`/`beforeunload` describe cómo entró el
   documento que está saliendo. El tipo resultante de la operación se lee en el
   **siguiente evento `document`**, no en el evento que anuncia su salida.
3. `methods` identifica la operación nativa interceptada. `stack` viene de
   `new Error().stack` mientras el llamador está pausado; `callFrames` es la pila
   independiente de CDP, con línea/columna base 1. `beforeunload` es un observador,
   y no se usa por sí solo como atribución.
4. Si se llega al interceptor de React Refresh, `modules` contiene los valores
   leídos en ese frame. Buscar **ese** `moduleId` en el runtime/chunks de `.next/dev`
   y en fuentes; medir ciclos o chunks ausentes únicamente a partir de lo observado.
   Un import cruzado no equivale a una factory ausente.
5. `documentCount` cuenta documentos realmente inicializados. `documentRequestCount`
   cuenta peticiones iniciadas dentro de la ventana: la petición inicial ocurrió
   antes de `windowStart` y puede no contarse; una pendiente puede no llegar a
   producir documento. Nunca sumar ambos contadores.

`durationMs` es la ventana de observación; `debuggerPauseMs` cuantifica el tiempo
añadido por el depurador. La tasa instrumentada puede cambiar por esas pausas.
`persistedEvents` es la copia final de `sessionStorage`; `events` es el respaldo
externo del observador CDP y añade peticiones/respuestas/motivos de navegación.

El código de salida 0 significa **OBSERVED**, cobertura técnica del instrumento;
no significa H1 reproducido, autenticación comprobada ni producto corregido. El 2
significa **INCONCLUSIVE**: error HTTP, salida de la ruta, persistencia incompleta,
documento sin armado o fallo de observación. Un error de argumentos/arranque puede
salir 1. La spec/handoff deben interpretar los eventos y el entorno, no solo el exit.
Si la navegación destruye el contexto durante la copia final, el recibo conserva
los eventos externos y declara la limitación en vez de fingir persistencia verificada.

## Mecanismo y límites

Los miembros de Location son `LegacyUnforgeable`; el instrumento usa breakpoints
de función nativa, sin monkeypatch de la aplicación. Un `debugger` en el init script
detiene cada documento antes del código de aplicación para rearmar `reload`,
`assign`, `replace`, setter `href` y setters `window.location`/`document.location`.
Se eliminan IDs previos, porque Chromium retiene algunas identidades entre recargas.
Fuentes primarias: [HTML Location](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-location-interface)
y [CDP Debugger](https://chromedevtools.github.io/devtools-protocol/tot/Debugger/).

Solo Chromium/CDP. Las pruebas usan un servidor HTTP local, los seis métodos
nativos y un módulo sin factory **sintético**. Validan captura, rearmado, pila y
persistencia; no son reproducción del grafo de Next. La sonda no registra DOM,
cookies, contenido de solicitudes/respuestas ni datos del usuario. Rutas y pilas
sí pueden contener identificadores: usar solo fixtures y revisar antes de versionar.

## Recibo inicial de disponibilidad

`assets/unauthenticated-60s.json` es salida cruda de 60 s contra el Webpack local,
sin configuración Supabase. Su documento fue HTTP 500; el primer `navigate` no
es un bucle. Capturó un `reload` de `performFullReload` del runtime de la pantalla
de error, sin módulo ausente observado. No confirma ni refuta H1. La lectura
completa está en el handoff de la tarea. El entorno ausente fue un límite de
aquella corrida, no un pendiente del cierre documental actual. El recibo y las
pruebas de la sonda se conservan sin cambios.
