# Metodología Forge Kanban

## Fórmula operativa

`AVIVAR → CLASIFICAR → ENRUTAR → FORJAR → VERIFICAR → CERRAR`

## 1. Avivar

Comenzar cada conversación con `/avivar`. Consumir identidad, `AGENTS.md`,
memoria, último handoff, specs, tickets, ventanas activas, worktrees, Git,
servicios y restricciones. Marcar datos no verificables como `n/a`.

## 2. Clasificar

Definir para cada tarea:

- artefacto producido;
- dominio dominante;
- riesgos;
- dependencias;
- rutas propias, compartidas y prohibidas;
- criterios de éxito.

Si el alcance no está aprobado, devolver a `la-herreria`. Si faltan decisiones
humanas, bloquear sin inventarlas.

## 3. Enrutar

Consultar `capability-router.yaml`. Asignar:

- skill constructor;
- skill revisor independiente;
- modelo y razón;
- Yunque o Forja y razón;
- gate proporcional al riesgo;
- evidencia durable.

No cargar todos los skills. Activar únicamente los necesarios para el ticket.
Skills específicos de una marca o stack sólo se usan cuando el proyecto declara
esa identidad o tecnología.

## 4. Forjar

Aplicar `karpathy-principles`: supuestos visibles, solución mínima, cambios
quirúrgicos y éxito verificable. Usar Yunque para rutas compartidas, datos,
migraciones e integración. Usar La Forja sólo con contratos cerrados y rutas
disjuntas. Cada worker recibe `owned_paths`, `shared_paths` y `forbidden_paths`.

Cuando el usuario autoriza avanzar por la cola, ejecutar `advance --json`. El
selector elige un solo ticket aprobado y listo; la capa agente ejecuta su
paquete completo y vuelve a consultar `advance` después del cierre atómico. No
saltar bloqueos ni convertir features directamente en trabajo.

## 5. Verificar

El constructor no se autoaprueba cuando existe un revisor especializado.
Ejecutar el gate declarado y guardar evidencia: tests, screenshots, browser
walkthrough, auditoría, migración o documento revisado. Riesgo alto requiere
gate más fuerte; un cambio trivial no debe ejecutar auditorías globales.

## 6. Cerrar

Invocar `source-command-cerrar`. Demostrar propiedad, staging selectivo y una
intención por commit. El worker publica su rama y entrega handoff; no fusiona.
El integrador exclusivo regenera vistas, corre el gate final, publica `main` y
limpia worktrees con política fail-closed.

## Gate de preparación

Un ticket permanece en `planning` si falta cualquiera de estos elementos:

1. Spec/SDD/Blueprint de referencia.
2. Criterios de aceptación verificables.
3. Prioridad y razón.
4. Dominio y artefacto.
5. Constructor y revisor.
6. Modelo y razón.
7. Yunque/Forja y razón.
8. Dependencias.
9. Rutas propias, compartidas y prohibidas.
10. Gate y evidencia.

## Principio central

Forge Kanban decide quién construye, quién revisa, cómo se verifica y quién
integra. Los skills especializados realizan el trabajo; Forge Kanban no copia su
lógica.
