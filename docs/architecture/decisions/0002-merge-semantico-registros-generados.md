# ADR-0002 · Fusión semántica de registros compartidos

| Campo | Valor |
|---|---|
| Estado | aceptado |
| Fecha | 2026-09-10 |
| Dueño | ingeniería DTD Cargo |
| SDD | no aplica: harness/gobernanza, sin comportamiento de producto |
| Enmiendas | 2026-09-11 · declaraciones de símbolos pendientes (ver al final) |
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

Rollback: retirar las reglas `merge=dtd-generated-records` de `.gitattributes`
(tres desde la enmienda del 2026-09-11). La configuración local inactiva no
cambia archivos sin esos atributos; si se desea limpiar el clon:

```text
git config --local --remove-section merge.dtd-generated-records
```

## Enmienda 2026-09-11 · declaraciones de símbolos pendientes

### Contexto

`supabase/pending-migration-symbol-declarations.json` es el contrato de SDD-0450:
`{ schemaVersion, $doc, degradations: [{ id, … }] }`. Cada PR migrate-first del
bloque C agrega su declaración al final del mismo array. Al 2026-09-11 lo tocan
seis PR abiertas (#75, #76, #77, #78, #82 y #83), con el mismo encabezado e ids
distintos, y al integrarlas en serie chocan textualmente. El Director lo
reprodujo ese día en un worktree descartable y lo resolvió con una unión por id.

### Decisión

El archivo se asigna al mismo driver `dtd-generated-records`. El script ya elige
la política por `%P`: no hay driver nuevo, el instalador no cambia y los clones
configurados no tienen que reinstalar. Reglas:

1. `degradations` se fusiona three-way por `id`. Las adiciones con ids distintos
   se conservan, una adición idéntica en ambos lados queda una sola vez y la
   edición de un solo lado gana según la base.
2. **A diferencia de `pendingBelowCutoff`, una eliminación unilateral sí gana**
   si la otra rama conserva la entrada igual a la base. Retirar la declaración es
   el cierre esperado al aplicar su migración; resucitarla dejaría una excepción
   vencida que `check-pending-migration-symbols` rechaza con exit 2.
3. Fallan cerrados el mismo id con contenido distinto en ambos lados (dos
   adiciones o dos ediciones) y borrar contra editar.
4. El encabezado (`schemaVersion`, `$doc` y cualquier clave fuera de
   `degradations`) debe ser idéntico en ambas ramas. Si difiere, aunque solo una
   lo haya cambiado, falla: define el contrato de todas las entradas y una unión
   por entrada no puede reconciliarlo.
5. Se rechazan JSON inválido, claves duplicadas, `schemaVersion` distinto de 1,
   `degradations` que no sea array y entradas sin `id` string no vacío o con ids
   repetidos. Una versión nueva del contrato debe actualizar el driver en la
   misma PR. El driver no reemplaza al gate: símbolos, sitios y evidencia se
   validan después del merge con `check-pending-migration-symbols`.
6. Las entradas de la base conservan su orden y las nuevas se agregan ordenadas
   por id, así el resultado no depende del sentido del merge.
7. Como en el resto del driver, un conflicto sale con código 1 y un mensaje
   explícito, sin marcadores: `%A` queda con la versión actual y Git marca el
   archivo sin resolver.

### Interacción conocida con el baseline

Si una rama retira a la vez una espera de `pendingBelowCutoff` y su declaración,
y se fusiona con el driver contra otra rama que también cambió el baseline, el
baseline conserva la espera (regla 1 de la decisión original). La declaración,
en cambio, queda retirada: Git toma el retiro si la otra rama no tocó las
declaraciones, y este driver lo respeta si también las cambió. Si hay código
alcanzable que usa esos símbolos, `check-pending-migration-symbols` lo reporta
ROJO; si no lo hay, ese gate no lo ve. La salida es quitar a mano la espera
resucitada. El efecto es anterior a esta enmienda (el ensayo lo reproduce sin
tocar las declaraciones); cambiar la regla del baseline es otra decisión,
registrada como fuera de alcance en el handoff de la tarea.

### Límite y evidencia

GitHub sigue sin ejecutar el driver al calcular la mergeabilidad o en Update
branch: esto alivia la integración local y serializada del Director y la
actualización de ramas en clones configurados.

Git usa el `.gitattributes` y el script del árbol de la rama que hace el merge,
no los de main. Integrar una rama antigua dentro de main usa el driver nuevo; el
sentido contrario, no. En una rama creada antes de esta enmienda, el primer
`git merge origin/main` deja el archivo en conflicto textual y fusiona el
baseline con el driver anterior. Resolver con
`git checkout -m -- supabase/pending-migration-symbol-declarations.json` y
`git add`, y verificar el baseline contra origin/main. Tras ese primer merge el
árbol ya trae la regla y el driver nuevos, y `git checkout -m` los usa. Ese
comando sale con exit 0 aunque el driver rechace: antes de `git add`, confirmar
que imprimió `✓ merge semántico`. Si imprime `✖ merge semántico rechazado`, el
archivo queda con la versión propia, sin marcadores y todavía sin resolver: se
resuelve a mano (la versión entrante está en
`git show :3:supabase/pending-migration-symbol-declarations.json`). Para el
baseline, `git diff origin/main -- supabase/migrations-baseline.json` debe
mostrar solo las esperas propias de la rama.

`scripts/tests/merge-generated-records.node.mjs` agrega merges reales en
repositorios temporales: unión en ambos sentidos con resultado idéntico, retiro
unilateral y en ambos lados, edición unilateral, conflictos por `$doc`, por
mismo id y por borrado contra edición, rechazo de ids repetidos, claves
duplicadas y versión desconocida, y el contrato del `.gitattributes` real. El
ensayo con las ramas reales, incluido el primer merge de una rama antigua contra
main, está en `.agents/handoffs/merge-driver-symbol-declarations.md`.

Rollback: quitar la regla del archivo en `.gitattributes`. Sin ese atributo, el
código del driver para esta ruta queda inerte.
