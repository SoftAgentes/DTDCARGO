# Handoff — SDD-0664 · Clientes migrados: código viejo visible, buscable y enlazable

- **Fecha:** 2026-11-18
- **Rama:** `claude/clientes-codigo-viejo-0664`, desde `origin/main` `53c3495c4`
- **Spec:** `docs/specs/0664-clientes-migrados-codigo-viejo/spec.md`
- **Número:** asignado por el Director General.
- **PR:** #677, en borrador.

## Qué se pidió

Los clientes del legado tienen hoy un Shipping Mark `DTD-8xxx`, pero su mercancía sigue llegando con el código de antes y el sistema no lo enlaza. Mostrar el código viejo en la ficha y poder buscar y enlazar por él. Ningún embarque sin cliente (`DTD-0000` si no aparece el dueño).

## Qué se encontró (sin consultar producción)

- El código viejo **está guardado**: `client_markbox_history` (migración 0367, SDD-0258). `resolve_markbox` lo resuelve.
- El `DTD-8xxx` lo genera `rename_legacy_markboxes` (0369, 0379, 0380), que delega en `rename_client_markbox`.
- Ya lo resolvían Almacén CN, el cargador de consolidados, el correo y Kommo. No lo hacían los buscadores de clientes, el nuevo embarque ni la carga del contenedor.
- **No hace falta migración.**

## Qué se hizo (fases 1 y 2)

- `lib/studio/client-codigo-viejo.ts` (nuevo):
  - `nucleoDeCodigo`: «dtd z901», «DTD-Z901» y «z901» son la misma búsqueda. Un texto sin dígitos o con comodines no consulta nada.
  - `clientesPorCodigoViejo`: busca en el historial y en las fichas absorbidas por fusión, y sigue la cadena (hasta 10 saltos) hasta el cliente vivo. Modos `contiene` y `exacto`.
  - `markboxVigenteDeCodigoViejo`: para la redirección de la ficha.
- `lib/studio/client-queries.ts`: `listClients` y `listClientsPage` suman esos clientes a la consulta y marcan `codigo_anterior`. Cubre la búsqueda del Studio, la lista de Clientes y `ClientCombobox` («Asignar cliente», nuevo embarque, cotizador).
- «antes <código>» en la búsqueda del Studio (`global-search/search-action.ts`) y en `ClientCombobox`.
- Ficha: `ShippingMarkChip` muestra los dos códigos anteriores más recientes sin abrir el panel; el resto, con contador. `/studio/clientes/<código viejo>` redirige a la ficha vigente.

**Tenant.** El aislamiento entre usuarios lo hace la RLS de `client_markbox_history` y de `clients`; el módulo no filtra por tenant por su cuenta, como el resto de `client-queries`. Segunda barrera: una fila del historial solo vale si su tenant es el del cliente al que apunta.

**Privacidad (SDD-0531).** El módulo lee y devuelve Shipping Marks e ids, no nombres.

## Validación

| Comprobación | Resultado |
|---|---|
| vitest, `--maxWorkers=2`: `client-codigo-viejo`, `listados-sin-eliminados`, `client-search-action`, `global-search`, `ClientCombobox`, `app/studio/(app)/clientes`, `app/studio/(app)/tracking/[id]` | Primera corrida sobre `56c6a2c0c`: 334 de 335; falló `client-search-action` («mapea sólo los campos…») porque el hit llevaba `codigoAnterior: null`. Corregido en `130f13554` |
| Repetición de `client-search-action`, `global-search`, `client-codigo-viejo` y `ClientCombobox` tras la corrección | PASÓ |
| Suite completa de la primera lista repetida sobre `130f13554` | NO EJECUTADO: solo se repitieron los archivos tocados |
| Con el cambio roto (sin `id.in` y sin la barrera de tenant) | PASÓ: fallan «un código viejo de otro tenant…» y «suma a la consulta el cliente del código viejo…» |
| `check-numbering` e índice de specs | PASÓ |
| tsc, eslint, `pnpm verify` | NO EJECUTADO en local; quedan para el CI |
| `/ui-check` y vista en navegador | NO EJECUTADO |
| Medición de producción (consulta de conteos de la spec) | NO EJECUTADO: necesita el OK de Sam |

Datos de prueba inventados. No se leyó producción.

## Pendientes de esta tarea

- Traer `main` cuando entre la tanda #675 y sacar la PR de borrador.
- `/ui-check` de los dos cambios visuales («antes …» en el combobox y en el chip de la ficha) y verlos en el navegador.
- Fase 3 (nuevo embarque y carga del contenedor resuelven el código retirado; `DTD-0000`): espera las respuestas de Sam a las preguntas 2 y 3 de la spec.
- Confirmar con la medición que toda ficha `DTD-8xxx` tiene su código viejo en el historial.

## FUERA DE ALCANCE DETECTADO

- El filtro «Cliente» de Embarques compara en el navegador y no conoce los códigos anteriores (Fase 3).
- `ClientCombobox` y la búsqueda del Studio no pasan por `puedeVerNombres`: quien llama decide si los monta. No cambió con esta tarea.
- El portal del cliente no muestra el código anterior; quedó fuera por decisión del Director.
