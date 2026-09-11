# ADR-0002 · Fusión semántica de registros compartidos

| Campo | Valor |
|---|---|
| Estado | aceptado |
| Fecha | 2026-09-10 |
| Dueño | ingeniería DTD Cargo |
| SDD | no aplica: harness/gobernanza, sin comportamiento de producto |
| Enmiendas | 2026-09-11 · retiro unilateral y orden en `pendingBelowCutoff` (ver al final) |
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
   distintas se conservan; la misma clave con textos distintos falla y deja el
   archivo sin resolver; borrar contra editar falla. Desde la enmienda del
   2026-09-11, una eliminación unilateral gana si el otro lado conserva la
   entrada igual a la base, y el resultado sigue el orden del lado entrante con
   lo que solo trae el lado actual al final.
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
distinto, retiro unilateral en ambos sentidos, borrado contra edición, retiro de
filas del índice, una rama con el driver anterior en su árbol, ausencia de
configuración y claves JSON duplicadas.

Rollback: retirar las dos reglas de `.gitattributes`. La configuración local
inactiva no cambia archivos sin esos atributos; si se desea limpiar el clon:

```text
git config --local --remove-section merge.dtd-generated-records
```

## Enmienda 2026-09-11 · retiro unilateral y orden en `pendingBelowCutoff`

### Contexto

El `$doc` del baseline define el retiro como el registro de una aplicación:
«AL APLICAR una que estaba en `pendingBelowCutoff`: sacala de ahí». Las PR de
registro hacen eso, una migración por vez: #85 retiró
`0409_bank_reconciliation_rbac` y #92, `0418_portal_academia_tenant_boundary`.

La regla 1 original unía las entradas: si solo un lado quitaba una clave, se
conservaba. Una rama creada antes de un registro que se actualizaba con
`git merge origin/main` en un clon configurado resucitaba la espera sin
conflicto. Además, el orden «base primero y adiciones ordenadas por nombre» no
reproducía el de main cuando main había integrado esperas en otro orden.

Ensayo con commits reales pasados por el driver anterior (%O = merge-base,
%A = la rama, %B = main):

| Merge | Resultado del driver anterior |
|---|---|
| L22 (#84): `c8058bcf` con `bbc7493f`, main después de #85 | 0409 reaparece primera; 0417 y 0429 quedan al final, fuera de su lugar en main |
| L22 (#84): `968258c5` con `c6c67312` | 0431 y 0433 quedan antes que 0408, 0424 y 0432; en main, 0408 y 0424 van primero y 0432 va entre ambas |
| cabeza de #87 (`00f257e1`) con la de #92 (`82e3e8ce`) | 0418 reaparece primera |

El Worker de L22 lo corrigió a mano: `fe7c2c5d` restituyó el orden de main y el
merge `79298160` quedó en main más 0434. GitHub fusiona sin driver: si una rama
con la espera resucitada llega a main, reabre la espera de una migración ya
aplicada. Ningún gate lo distingue: `check-migrations-applied` imprime cada
espera como «sin aplicar A PROPÓSITO» sin cruzarla con el ledger
(`scripts/check-migrations-applied.mjs:351-355`). Hasta ahora lo detectaba el
control semántico del Director (baseline = main + entradas nuevas de la rama),
a costa de una corrección manual por Worker. La PR #88 lo registró como fuera
de alcance.

### Decisión

1. `pendingBelowCutoff` aplica three-way por clave también a los retiros: si un
   lado quita la clave y el otro la conserva igual a la base, gana el retiro. Dos
   retiros coinciden. Siguen iguales la unión de adiciones concurrentes, el
   conflicto por la misma clave con motivos distintos, el conflicto borrado
   contra edición, el rechazo de claves duplicadas y la exigencia de motivos no
   vacíos.
2. Orden: primero las claves del lado entrante (%B), en su orden, y al final las
   que solo trae el lado actual (%A), en el orden en que ese lado las escribió.
   La misma regla ordena las claves de primer nivel. En la metodología, el
   Worker actualiza su rama y el Director valida la cabeza de una PR con
   `git merge origin/main`. Git pasa main como %B, así que, cuando el árbol de la
   rama ya trae este driver (ver el punto 4), el resultado es el texto de main
   más las adiciones de la rama: coincide con el control semántico del Director
   y deja el diff contra main limitado a esas líneas.
3. El índice `docs/specs/README.md` no cambia. Ya fusiona cada fila three-way con
   `mergeValue`, retiro unilateral incluido, y regenera orden, conteo y huecos.
   Debe seguir así porque el índice deriva del árbol de specs, que Git fusiona
   three-way: si main borra o renumera una spec que la rama no tocó, la carpeta
   desaparece y su fila también. Una unión dejaría la fila huérfana y
   `docs:check` en rojo. Una prueba nueva fija ese comportamiento.
4. Transición. Git ejecuta el driver del árbol de la rama que se actualiza: el
   instalador registra una ruta relativa (`scripts/install-merge-drivers.mjs:12`)
   y el merge corre antes de que el árbol reciba el driver de main. Por eso la
   primera actualización de una rama creada antes de esta enmienda, si también
   cambió el baseline, corre el driver anterior: resucita las esperas que main ya
   retiró (0409 y 0418 en las ramas abiertas al 2026-09-11) y ordena como antes.
   Una vez confirmado ese merge, el driver nuevo trata la espera resucitada como
   una adición de la rama y ya no la retira. Esa primera actualización se hace
   con el driver de main, en Git Bash:

   ```bash
   drv="$(cygpath -m "$TEMP")/dtd-merge-driver-main.mjs"
   git show origin/main:scripts/merge-generated-records.mjs > "$drv"
   git -c merge.dtd-generated-records.driver="node \"$drv\" %O %A %B %P" merge origin/main
   ```

   En Linux o macOS, `drv="$(mktemp -d)/dtd-merge-driver-main.mjs"`. Después,
   `git diff origin/main -- supabase/migrations-baseline.json` debe mostrar solo
   las esperas propias de la rama y la coma que gana la última espera de main.
   Si una espera resucitada ya quedó confirmada, se quita a mano en la rama. Una
   rama que no tocó el baseline no necesita nada: Git toma el de main sin
   ejecutar ningún driver.

### Consecuencias

- El orden depende del sentido del merge; las claves y los motivos, no. La
  prueba lo compara en ambos sentidos. Fusionar una rama sobre un main local,
  fuera de la metodología, o encadenar cabezas de PR en una rama de integración
  deja lo que agrega la cabeza entrante antes de lo acumulado. En `git rebase` y
  `git cherry-pick` los papeles se invierten: %A es el HEAD donde se reaplica
  (main, en un rebase sobre main) y %B el commit reaplicado, así que un rebase
  deja el orden de la rama con lo nuevo de main al final. La metodología no usa
  rebase. Ningún gate depende del orden.
- Una rama de registro que se actualiza con main conserva su retiro aunque main
  haya agregado o editado otras esperas.
- Si un lado retira y el otro edita la misma espera, el merge sigue bloqueado:
  hay que decidir a mano si la migración se aplicó.
- La primera actualización de una rama anterior a esta enmienda necesita el
  driver de main (punto 4); sin él, la espera resucitada queda como adición de
  la rama.
- Riesgo nuevo: una espera perdida por accidente, por una edición a mano o una
  resolución de conflicto que la borra, ahora se retira sin aviso al fusionar, y
  ningún gate del CI lo detecta. Regla de revisión: todo `-` en el diff del
  baseline contra main fuera de una PR de registro autorizada es una no
  conformidad. No cuenta la coma que gana la última espera cuando se agrega
  otra: aparece como `-` y `+` de la misma espera con el mismo motivo.

### Alternativas descartadas

- Conservar la unión y corregir a mano: es el costo que motivó esta enmienda, y
  ningún gate distingue una espera resucitada de una vigente.
- Tomar el orden del lado actual (%A) y poner al final lo nuevo del entrante: en
  `git merge origin/main`, %A es la rama, así que reproduce el desorden de L22.
- Orden de la base con adiciones ordenadas por nombre (regla anterior): no
  depende del sentido, pero no reproduce main cuando este integró esperas fuera
  del orden numérico.

### Evidencia y rollback

`scripts/tests/merge-generated-records.node.mjs` fija que el retiro de main gana
y deja el texto exacto de main más las adiciones de la rama, que una rama de
registro conserva su retiro, que borrar contra editar falla en ambos sentidos,
que una base o un lado entrante con claves duplicadas se rechazan sin tocar
`%A` y que el índice retira la fila de una spec renumerada. También fija la
transición: una rama con el driver anterior en su árbol lo ejecuta en su primera
actualización y la espera resucitada sobrevive a la siguiente, mientras que el
driver de main forzado con `-c` deja el texto de main más la rama. Los tres
merges del ensayo, pasados por el driver nuevo, dan el texto de main más 0434
(L22) o más 0450 (#87), y ninguna espera retirada reaparece.

Rollback: revertir esta enmienda devuelve la unión. `.gitattributes` y el
instalador no cambian.
