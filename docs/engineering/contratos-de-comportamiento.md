# Contratos que miden el comportamiento, no el texto

Dueño: equipo de ingeniería · Estado: vigente · Actualizado: 2026-11-19.

Extraído de [project-rules.md](./project-rules.md) el 2026-11-19 para mantener la guía madre liviana; el principio, los cinco casos y el contraejemplo se conservan íntegros. La ejecución se rige por [AGENTS.md](../../AGENTS.md) y el [runbook](../runbooks/codex-engineering.md).

Un contrato —prueba anti-drift, aserción de guion de smoke, vigilante de CI— puede
estar **verde sin medir nada**. La diferencia entre uno que protege y uno que
acompaña no es la suerte ni el esfuerzo: es si comprueba **el comportamiento** o
comprueba **que el texto del guard aparece en el archivo**.

El 2026-09-20 la misma forma apareció cinco veces en un día. Los cinco casos, con
lo que cada uno **afirmaba** y lo que **debería** haber afirmado. Las líneas son
de `main` `4febc876`.

| # | Dónde | Afirmaba | Debería afirmar |
|---|---|---|---|
| 1 | `lib/studio/rbac-actions-guard.test.ts:88` | que el **archivo** contiene alguno de cuatro nombres de guard (`GUARDS.some((g) => src.includes(g))`) | que **cada acción exportada** llama a un guard antes de tocar datos |
| 2 | `app/studio/(app)/crm/__tests__/stage-control.test.ts:74` | que el fuente de `crm/actions.ts`, leído como **texto**, contiene `moduleEditDenial(supabase, "kommo")` | que un rol sin `kommo` recibe la denegación y **no** se escribe nada |
| 3 | `app/studio/_components/ui/ConfirmDialog.test.tsx:363` | que dos clics producen **una sola** llamada a `onConfirm` | que el candado **se suelta** después, o sea que un clic legítimo posterior sigue funcionando |
| 4 | `.agents/handoffs/smokes-app-l14-0454-0472-guion.md:160` (paso 3) | que aparece «**un solo** reporte nuevo» | **cuántas filas quedan en pantalla en total**, y qué combinación sería falla |
| 5 | un vigilante de CI armado con `gh pr checks <n> ... \|\| echo '[]'` | nada: el fallback convertía cada respuesta en `[]` | que el **silencio sea detectable** —cambios de estado más un latido, o marca de tiempo si lo lee un `tail`— y emisión en **todos** los estados terminales |

**Por qué cada uno pasaba igual:**

1. Un archivo con siete acciones gateadas y una abierta contiene la cadena. Así
   estuvo verde sobre los ocho huecos de SDD-0497. Además `findActions`
   (`:70`) sólo recoge archivos llamados **exactamente** `actions.ts`: escanea
   54 archivos y deja fuera los **19** `*-actions.ts` del Studio
   (`calendar-actions.ts`, `document-actions.ts`, `merge-actions.ts`…).
   **SDD-0498 lo mejoró sin cerrarlo**, y por eso sigue en esta lista: pasó de
   exigir un nombre a aceptar cuatro (`:47`), lo que eliminó el falso negativo
   de `carrier-actions.ts` —gateado con su propio `tenantAdminGate`—, pero el
   alcance de la aserción **sigue siendo el archivo**. Una mejora no es un
   arreglo si no cambia lo que la aserción alcanza.
2. Esa cadena aparece **cinco** veces en `crm/actions.ts`: quitar una deja las
   otras cuatro y la aserción sigue cierta. Se comprobó con un mutante.
3. Un candado **trabado para siempre** también produce exactamente una llamada.
   El caso de al lado (`:313`) es el que sí los distingue, porque sigue usando el
   diálogo después.
4. El paso 2 cancela un reporte y un cancelado **se conserva por diseño**, así
   que en pantalla quedan dos filas. Sin el total, Sam leyó eso como duplicación
   y detuvo un smoke sobre un sistema que funcionaba: acá la falta de observable
   produjo un **rojo falso**, no un verde falso. Es la misma causa.
5. `gh pr checks` sale con código **distinto de cero** mientras haya checks
   pendientes — medido el 2026-09-20 sobre una PR con checks en curso: `exit 8`,
   contra `exit 0` de `gh pr view --json statusCheckRollup`, que es la llamada
   correcta para un bucle. El monitor dio 55 vueltas sin emitir una línea y
   terminó «sin producir salida» — indistinguible de «no pasó nada».
   **La propiedad a conservar es que el silencio sea detectable**; la forma
   concreta depende de **quién lee**. Si lee una persona el hilo: cambios de
   estado más un **latido** espaciado — si el latido para, el vigilante dejó de
   medir. Si sólo lo consume un `tail -N` sobre el final, una línea por vuelta
   **con marca de tiempo** vale igual, porque ahí la repetición no cuesta
   atención y el hueco en los tiempos delata la parada.
   Elegir mal la forma no es inocuo en ninguna de las dos direcciones: un
   vigilante mudo se delata por ausencia, pero **uno ruidoso parece estar
   trabajando** y entrena a saltear sus líneas, y entonces el cambio de estado
   pasa entre nueve repeticiones sin que nadie lo vea. Mismo final, otra puerta.

> **No des por buena una aserción hasta haberla matado con un mutante.** Si
> puedes romper el comportamiento y el contrato sigue verde, no es un contrato.
> Y cuenta los mutantes **del diff**, no los del archivo: una cadena que aparece
> cinco veces tiene cuatro apariciones ajenas a tu cambio, y mutarlas mide el
> trabajo de otro.
>
> El atajo para reconocerlos: si la aserción se puede satisfacer **sin ejecutar
> el código** —leyendo el fuente, contando apariciones de un nombre— entonces
> mide el texto. Si exige correr algo y observar qué salió, mide comportamiento.

### Cómo se ve uno que sí mide

`scripts/__tests__/invoice-read-boundary.test.mjs` (SDD-0357) es el contraejemplo
y conviene leerlo antes de escribir un contrato nuevo. No busca texto: **parsea el
AST** de ~1.600 módulos de `app/`, `lib/` y `supabase/functions` y cuenta las
llamadas literales `.from("invoices")` por archivo. Después:

- **Congela el inventario exacto** contra un `BASELINE` nombrado: `toEqual`, más
  19 archivos y 45 llamadas como números explícitos (`:135-141`). Un lector nuevo
  de `invoices` rompe la prueba, y para pasarla hay que **justificarlo por escrito
  en el `BASELINE`** — sus comentarios son el registro de por qué cada lectura es
  legítima. El total va **aparte del mapa a propósito** (`:137-141`): si alguien
  «arregla» el mapa moviendo una llamada de un archivo a otro, el mapa vuelve a
  cuadrar y el total no. Dos aserciones que fallan por caminos distintos valen
  más que una más estricta.
- **Se prueba a sí mismo**: distingue una llamada real de la misma cadena dentro
  de un comentario o un string, y cubre los escapes que esquivarían su prefiltro.
  Un detector sin sus propios casos es otra cosa que nadie está midiendo.
- **Mide también la consecuencia**, no sólo la forma (`:161`): los cuatro widgets
  financieros siguen detrás del módulo `invoices`, y **ningún override por rol**
  los abre para los cinco roles que no deben verlos.

Que exija justificar cada lector nuevo es lo que lo vuelve útil, y lo que hace
que su rojo valga. **Un rojo suyo se lee como estorbo y es un hallazgo**, y el
ejemplo está en el propio archivo: la entrada de
`lib/studio/fidelizacion/referral-credit-queries.ts` en el `BASELINE` (`:32-53`,
SDD-0495) cuenta que al exigir revisar «el guard y el tenant» de un lector nuevo
apareció que `invoices_accounting_select` (migr 0414) **niega el SELECT a
`commercial` y `support`, que son justo los roles de esa pantalla**: con el
cliente de sesión el aviso devolvía cero filas y no se pintaba nunca. Léelo
entero: además del hallazgo, deja escritos los candados con que se resolvió, cuál
es la forma correcta y qué exige (RPC `security definer`, migración y OK nominal).

**El rojo era el mensajero, no el problema.** Y la lección de fondo: la matriz de
módulos de `rbac.ts` y la RLS de la tabla **no dicen lo mismo**, y sólo un
contrato que mide comportamiento los enfrenta.

> **Sus dos rojos no son el mismo, y confundirlos es cómo se pierde.** El de
> **contenido** —el inventario dejó de coincidir con el `BASELINE`— es el
> hallazgo: hay un lector nuevo de `invoices` y alguien tiene que justificarlo.
> El de **tiempo** —agota su tope de 60 s— es contención de la máquina: lee y
> parsea ~1.600 archivos, y con otra suite al lado llegó a 92 s (SDD-0486 §3).
>
> Ante un rojo por tiempo **no se salta la prueba ni se relaja su tope**: se
> vuelve a correr con la máquina quieta, y si persiste estando libre, entonces sí
> es la prueba y se perfila. Eso fue SDD-0486 con las cuatro intermitentes de esa
> ronda: **ninguna resultó ser «la carga»**. Acá la causa era suya —`readFileSync`
> uno por uno y punteros al padre que el recorrido no usa—, y se arregló leyendo
> en paralelo y prefiltrando, sin tocar el runner ni debilitar una aserción.
>
> Importa porque un contrato valioso **y** ocasionalmente lento es el candidato
> perfecto a que alguien lo marque inestable y lo saltee — y un `skip` no se ve
> en verde ni en rojo: **se ve en nada**, que es el modo de falla de toda esta
> lista. Sería absurdo que el contraejemplo de esta sección acabara saltado por
> lento.

Arreglar el contrato del caso 1 es tarea propia y ya está encolada; no la diseñes
de paso desde otra tarea.

Y esta sección se aplica a sí misma. La regla del caso 5 se escribió como «una
línea por iteración», se usó el mismo día y se corrigió: cumplía su propósito y
ahogaba la señal. **Una regla que sólo se sostiene mientras nadie la usa no es
una regla** — igual que un contrato que sólo se sostiene mientras nadie lo mira.
Si al aplicar algo de acá te estorba, eso es un dato sobre la regla, no sobre ti.

