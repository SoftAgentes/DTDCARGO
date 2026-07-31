# Cierre · SDD-0184 Plan de carga por volumen (Fase 1)

- **Fecha:** 2026-07-30
- **Rol:** worker autónomo (AGENTS.md · ventanas autónomas)
- **Rama:** `claude/container-loading-design-plan-db597c`
- **Worktree:** `C:\Users\Trabajo\Desktop\Claude\DTDCargo\container-loading-design-plan-db597c`

## Alcance

Fase 1 de 5 de SDD-0184: el **repartidor de volumen** que le dice al operario dónde va el
próximo lote, y las dos consultas que justifican el módulo entero.

El objetivo **no es optimizar el llenado**. Es responder dos preguntas, las dos desde el
teléfono y las dos del lado de Venezuela:

1. **Aduana quiere revisar a un cliente: ¿dónde está su mercancía?** Si el sistema dice
   *"DTD-0042 · Medio al centro"*, sacan solo esas cajas en vez de bajar el contenedor entero.
2. **¿Qué sale primero, y cuándo aparece lo pesado?** Para asignarle piso en el galpón antes
   de abrir las puertas, y para llamar al montacargas a la hora justa en vez de tenerlo
   esperando desde el principio.

Se descartó el bin-packing 3D del mercado (EasyCargo, SeaRates, CubeMaster): todos exigen
largo×ancho×alto por bulto y catálogo de tipos de carga, y **el proveedor chino no da nada de
eso**. Lo único real es cantidad de cajas + CBM. Decisión del founder: todo es caja, el plan
es una guía aproximada, y solo 20' y 40'HC activos.

## Rutas propias

| Ruta | Estado |
|---|---|
| `lib/shared/estiba-plan.ts` | nuevo |
| `lib/shared/__tests__/estiba-plan.test.ts` | nuevo |
| `docs/specs/0184-plan-carga-volumen/spec.md` | nuevo |
| `docs/specs/0184-plan-carga-volumen/assets/investigacion-mercado-estiba.md` | nuevo |
| `docs/specs/README.md` | índice regenerado con `pnpm docs:index` |

Ningún commit de `origin/main` tocó estas rutas (verificado con `git log HEAD..origin/main --`
sobre cada una). El único solape fue `docs/specs/README.md`, que es generado y se resolvió
regenerándolo, no editándolo a mano.

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm test lib/shared --run` | **107 passed** (5 archivos) |
| `pnpm typecheck` | limpio |
| `npx eslint` sobre las rutas propias | limpio |
| `pnpm docs:check` | limpio |
| `node scripts/verify.mjs` | **1 fallo: `e2e`** — ver abajo |

**Validación por MUTACIÓN (el paso que de verdad importa):** se rompieron a propósito **24
invariantes** del motor y **las 24 pusieron la suite en rojo**. Cuatro sobrevivieron a la
primera ronda y cada una destapó un hueco real:

1. Un lote con **CBM en cero** (prealerta sin volumen declarado) reventaba al leer `zonas[0]`.
2. El test de "una caja sola no se parte" **no ejercitaba la guarda**: el lote anterior se
   llevaba todas las áreas y el caso caía por otra rama.
3. Al rechazar una pieza indivisible **no se devolvía el espacio recorrido**, así que un
   cliente chico que sí cabía en el hueco quedaba afuera.
4. El bucle reseteaba `libreEnArea` aun al pasarse del último área, y ese valor obsoleto
   **sobrecargaba un área ya llena** (7,11 CBM en un área de 3,78). Se corrigió la raíz.

### Sobre el fallo de `e2e` — es FALSO ROJO, no es de este trabajo

Los 4 tests que fallan (`auth.spec.ts` ×3, `global-search.spec.ts` ×1) mueren todos con:

> `Your project's URL and Key are required to create a Supabase client!` — `proxy.ts (34:38)`

**Este worktree no tiene `.env.local`** (solo `.env.example`). El servidor que levanta
Playwright no puede crear el cliente de Supabase, `getUser()` revienta antes de llegar al
`redirect("/studio/login")`, y Next pinta su overlay de error en esa URL. **No se renderizó
ningún dashboard ni se filtró nada** — el guard de `app/studio/(app)/layout.tsx` está intacto.

Es el falso-rojo conocido de worktree sin entorno. Se cierra con:

```bash
cp "C:/Users/Trabajo/Desktop/Developer/software/DTDCargo/.env.local" "<este-worktree>/.env.local"
```

No se copió desde la sesión por tratarse de un archivo de credenciales.

Ninguno de los 3 commits toca `app/`, middleware, auth ni `e2e/`.

## Commits

| Hash | Título |
|---|---|
| `78b8a203` | `feat(studio): SDD-0184 — plan de carga por volumen (Fase 1: el repartidor)` |
| `b3e9b8b5` | `feat(studio): SDD-0184 — ubicacion por cliente y orden de descarga` |
| `c13cfc0b` | `feat(studio): SDD-0184 — areas compartidas y posicion en una frase` |

Más dos merges de `origin/main` (main se movió 3 y luego 7 commits durante la sesión).

## Migraciones y deploy

**Ninguna migración.** Este slice es TypeScript puro en `lib/shared/`, sin Supabase, sin SQL,
sin tocar producción. Las migraciones **0289/0290/0291** están **diseñadas en la spec pero no
escritas**; entran en las fases 2-4.

El módulo **todavía no lo importa nadie**: publicar a `main` no cambia ni una pantalla ni un
dato. El deploy es inerte.

## Estado de la spec

`docs/specs/0184-plan-carga-volumen/spec.md` queda en **`in-progress`**, no en `done`. Solo
está hecha la Fase 1 de 5, y el flujo nunca se ejercitó con carga real.

## Bloqueos

Ninguno para este slice.

## Siguiente responsable

Quien retome SDD-0184 · **Fase 2**: migración que agrega `active` a `container_types` (solo
`20GP` y `40HC` activos), corrige `cbm_capacity` del 40HC de **76 → 68** y agrega
`cbm_alert_ceiling` = 66,4.

Hoy conviven tres números que se contradicen y hay que unificarlos:

| Cifra | Qué es | Dónde está |
|---|---|---|
| 76,2 | volumen **geométrico** interno | `CONTAINER_TYPES` en `lib/studio/naviera/types.ts` (mal etiquetado como capacidad) |
| 68 | capacidad **útil** | `lib/studio/inventory/types.ts` — el correcto |
| 66,4 | techo **real** medido | solo en la memoria del founder y en `build_consolidado.py` |

Ojo con la numeración: durante esta sesión otra ventana tomó el **0185**, así que hay que
rechequear specs y migraciones contra `origin/main` justo antes de crear archivos.
