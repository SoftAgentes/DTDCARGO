# Handoff de SDD-0713 · Modo de prueba personal en Studio

| Campo | Referencia |
|---|---|
| Fecha y responsable | 2026-11-23 · Codex Worker, sesión `01a20a27-0b07-79b1-8241-59b600cf2364` |
| Árbol y rama | `../DTD-worktrees/modo-prueba-personal-20261123` desde el checkout principal · `codex/modo-prueba-personal-20261123` |
| Base | `origin/main` en `444f48e9bdb54e3486901718e8852d420587375a` |
| SDD y estado | [SDD-0713](../../docs/specs/0713-modo-prueba-personal/spec.md) · `proposed` · diseño para revisión |
| PR | [#798 · modo de prueba personal en Studio](https://github.com/SoftAgentes/DTDCARGO/pull/798) hacia `main` |

## OBJETIVO ORIGINAL

Definir con el equipo un modo de prueba por usuario que se abre desde el perfil y permite practicar sin afectar la operación real. Entregar la especificación y el plan antes de programar.

## COMPLETADO

- Se acordaron el destino en el Studio de prueba, el acceso de toda cuenta interna activa con sus permisos efectivos, la semilla ficticia y una copia personal persistente.
- Se definieron emisión y anulación con ejemplos listos, reinicio individual confirmado, pagos y comunicaciones simulados, y regreso al inicio real desde una franja fija.
- El alcance inicial incluye Facturación, Almacén China, Consolidado, Embarque y Recepción Venezuela. El punto ⓘ explica cada función y ofrece Faro si está habilitado para la práctica y para la persona.
- La SDD describe el plan por fases, las dependencias de apertura y las pruebas de aceptación. La lista exacta abarca esta ficha, la SDD y el índice generado.

## VALIDACIÓN

| Comprobación local | Resultado |
|---|---|
| `pnpm docs:index` y script de `docs:check` | PASÓ. Índice sincronizado con 692 especificaciones. |
| Script de `sdd:check` | PASÓ. Sin colisión nueva. Las once excepciones históricas corresponden a migraciones anteriores. Las reservas 0711 y 0712 son de otras ramas. |
| Scripts de `governance:check` y `components:check` | PASÓ. Cápsula de 29 políticas vigente y registro de ocho fuentes reproducible. La validación de componentes se repitió tras preparar las dependencias del worktree. |
| Enlaces locales y `git diff --check` | PASÓ. Los 16 destinos locales resuelven. |
| `pnpm verify`, flujos con usuarios y servidor | NO EJECUTADO localmente. La fase cambia tres documentos. Las pruebas de uso y de aislamiento requieren implementación. |

La corrida de calidad de GitHub para la cabeza de entrega se enlaza desde la PR. El estado de una corrida del borrador no acredita validación de la versión final.

## COMMITS

- `6c3f692d9dcc0410bce796f7955708622c66a45c` reserva el número 0713. La rama numérica y la ref de reserva remotas apuntan a ese commit.
- El commit que contiene este documento entrega la especificación propuesta y el índice. La cabeza final se identifica en la PR y en la nota de entrega.

## PR / BRANCH

PR #798 de la rama de trabajo indicada arriba. El objeto de revisión es documental. Cada fase de implementación tendrá una PR distinta.

## PENDIENTES DE ESTA TAREA

- Aprobación de Sam sobre el plan antes de implementar. La aceptación de los ocho puntos de la entrevista define el producto.
- Verificar que el destino se puede abrir a empleados con datos exclusivamente sintéticos, acceso individual y aislamiento de cada copia. Se cuenta con documentación histórica del staging, no con una revisión de su estado actual.
- Demostrar en datos inventados que la recepción genera la preorden en el alta. La emisión condicional al consolidar y los casos precargados cubren otros momentos.
- Las corridas funcionales, QA con los roles y aceptación de usuario quedan en las fases de producto. Las migraciones en prueba o producción y la publicación requieren un OK específico.

## FUERA DE ALCANCE DETECTADO

Si se confirma que el ERP requiere una nueva regla operativa de preorden, se debe tramitar con el Director. La práctica no da permiso para cambiar la facturación del Studio real. Las áreas reservadas se mantienen bajo su sesión escritora. Si un recorrido exige editarlas, el Worker detiene esa parte e informa a Sam.

## HANDOFF AL DIRECTOR

Revisar la especificación, la dependencia de preorden y la viabilidad de la entrada individual al entorno de prueba. La rama queda disponible para revisión independiente. El Worker libera el claim al cerrar la escritura y registra la entrega en la nota de coordinación. La integración, las migraciones y la publicación son decisiones posteriores.
