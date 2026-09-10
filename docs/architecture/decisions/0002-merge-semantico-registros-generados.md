# ADR-0002 · Fusión semántica de registros compartidos

| Campo | Valor |
|---|---|
| Estado | aceptado |
| Fecha | 2026-09-10 |
| Dueño | ingeniería DTD Cargo |
| SDD | no aplica: harness/gobernanza, sin comportamiento de producto |
| Confidencialidad | interno |

## Contexto y medición

`docs/specs/README.md` y `supabase/migrations-baseline.json` son generados o
estructurados, pero también están versionados. Dos ramas independientes suelen
cambiar las mismas líneas y Git las trata como solapadas.

La muestra de los checks `Calidad local sin secretos` de las PR #41–#45 duró
9,93–15,88 minutos, con promedio de 13,05 minutos. El costo de volver a poner una
rama al día bajo el ruleset estricto no es teórico.

La prueba de `git merge-file --union` contra los archivos reales descartó la
unión textual:

- dos claves nuevas vecinas dejaron el JSON sin coma, inválido;
- dos filas nuevas del índice quedaron en orden `0452`, `0451`, no canónico.

El índice tiene además 122 referencias versionadas; siete son lectores activos
fuera de specs, archivo e handoffs. Sacarlo del repositorio rompería, entre
otros, los enlaces de arquitectura y las consultas del índice desde GitHub.

## Alternativas

| Opción | Qué resuelve | Exigencia por clon / CI | Riesgo abierto |
|---|---|---|---|
| A. No versionar el índice | Elimina su conflicto porque deja de participar en Git. No resuelve el baseline, cuyo texto humano no es derivable. | El gate tendría que generar/publicar el índice; cada lector necesitaría ese artefacto. | El índice deja de existir en GitHub y se rompen lectores. Sin otro manifiesto versionado no hay evidencia revisable del drift. |
| B. Fusión por unión | Conserva ambos registros versionados y resuelve adiciones independientes. | Un driver semántico debe instalarse en cada clon y antes de cualquier merge explícito en CI. | GitHub no recibe la configuración local del clon; ver límite remoto abajo. `merge=union` textual queda prohibido. |
| Mixta: A para índice, B para baseline | Evita el conflicto remoto del índice y conserva el texto humano del baseline. | El driver sigue siendo obligatorio por el baseline; el gate además debe materializar el índice. | Conserva todo el costo operativo de B y suma la pérdida del índice navegable/versionado de A. |

## Decisión

Elegir B con **unión semántica**, no con el driver textual `union` de Git.
Ambos archivos siguen versionados y `.gitattributes` los asigna a
`dtd-generated-records`.

El driver aplica estas reglas:

1. Para `pendingBelowCutoff`, hace un three-way por clave. Adiciones con claves
   distintas se conservan; una eliminación unilateral no gana sobre la entrada
   que el otro lado conserva; borrar contra editar falla; la misma clave con
   textos distintos falla y deja el archivo sin resolver. Solo dos lados que
   coinciden en quitar la clave pueden retirarla durante la fusión.
2. Rechaza JSON inválido, objetos con claves duplicadas, motivos vacíos, cutoff
   no entero y cambios ambiguos fuera de `pendingBelowCutoff`.
3. Para el índice, une las filas por número SDD y **regenera** conteo, orden y
   huecos. Una misma fila cambiada distinto en ambos lados falla cerrada.
4. Solo sobrescribe `%A` después de validar y construir el resultado completo.
5. `docs:check` compara el bloque versionado con el que generan las specs. Una
   spec válida que no esté reflejada vuelve el gate rojo con la instrucción de
   regenerar; el comportamiento previo de frontmatter y estados se conserva.

Como el baseline ya obliga a instalar un driver, usarlo también para el índice
no agrega configuración y sí conserva sus lectores.

## Operación por clon

Un comando instala las tres claves requeridas en `.git/config` del clon:

```text
node scripts/install-merge-drivers.mjs
```

Comprobación sin modificar configuración:

```text
node scripts/install-merge-drivers.mjs --check
```

Si no se instaló, Git cae al merge textual normal. La simulación comprueba que
las adiciones vecinas quedan en conflicto; no se activa una unión silenciosa ni
se pierde una entrada. El precio seguro es que el merge sigue bloqueado.

## CI y límite remoto

Después de integrar la PR #44, `quality.yml` debe ejecutar, después del checkout:

```yaml
- name: Configurar drivers semánticos de merge
  run: |
    node scripts/install-merge-drivers.mjs
    node scripts/install-merge-drivers.mjs --check
- name: Simular fusiones de registros compartidos
  run: node --test scripts/tests/merge-generated-records.node.mjs
```

La definición del driver vive en `.git/config`, no en `.gitattributes`; el
repositorio solo puede distribuir el nombre y el instalador. Por eso esos pasos
protegen merges que el runner ejecute **después** del checkout y prueban el
contrato, pero no configuran el cálculo de merge ni el botón Update branch que
GitHub realiza antes de levantar el runner.

Consecuencia: si GitHub marca conflicto, la rama se actualiza en un clon
configurado (`git merge origin/main`) y se publica el resultado. El driver quita
la resolución manual y evita pérdidas, pero el ruleset estricto todavía puede
exigir otra corrida del gate. Eliminar también esa serialización requiere una
decisión separada de merge queue/ruleset o automatización con permiso de push;
está fuera del alcance de E1.

## Evidencia y rollback

La prueba crea repositorios Git temporales y simula dos ramas con specs distintas
y dos claves distintas del baseline. También prueba misma clave con texto
distinto, eliminación unilateral, ausencia de configuración y claves JSON
duplicadas.

Rollback: retirar las dos reglas de `.gitattributes`. La configuración local
inactiva no cambia archivos sin esos atributos; si se desea limpiar el clon:

```text
git config --local --remove-section merge.dtd-generated-records
```
