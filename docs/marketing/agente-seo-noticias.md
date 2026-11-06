# Agente SEO de noticias

Diseño aprobado por Sam el 2026-11-05. Parte del tree [Marketing](README.md). Solo la fase A está construida ([SDD-0604](../specs/0604-seo-geo-aeo-fase-a/spec.md)); el resto es plan.

## Regla que manda

El agente trabaja solo hasta dejar el artículo listo. **Publicar lo aprueba una persona**: la política IA-01 trata la publicación en el sitio como acción externa con autorización humana por ejecución.

## Dónde vive

En el **Studio, sobre el VPS de producción, disparado por el contenedor cron**. Ahí ya están `news_posts`, `seo_drafts`, los prompts de `lib/news/`, los presupuestos por agente, los permisos para aprobar y el patrón de cron de `app/api/cron/ceo-brief/route.ts`. Publicar es escribir una fila, así que no requiere despliegue.

Sedes descartadas:

- **GitHub Actions:** escribiría en producción desde fuera y no tiene pantalla de aprobación.
- **Oficina Hermes:** su diseño le prohíbe publicar y tocar la base. Puede aportar investigación de temas como insumo.
- **Tarea programada de Claude:** no deja auditoría ni tiene acceso a Google. Sirve para prototipar prompts.

## Flujo

1. **Recolectar (diario).** Search Console API: consultas, páginas, impresiones, clics y posición. Solo agregados, sin datos personales.
2. **Elegir tema (semanal).** Consultas con impresiones, en posición 8 a 30 y sin página que las responda, más `lib/news/seo-keywords.ts` y [las preguntas del CRM](seo-aeo-preguntas-crm.md). Descarta duplicados y pasa el Test de Noticia de `lib/news/cerebro.ts`.
3. **Redactar.** Usa `lib/news/prompts.ts` y guarda en `seo_drafts` en estado de revisión, con su puntaje y la fuente de datos que justificó el tema. Cada corrida queda en `agent_runs` con costo y clave de idempotencia.
4. **Aprobar (persona).** Cola en Noticias Web con vista previa, puntaje y marcas `[VERIFICAR]`. El servidor rechaza si quedan marcas; hoy esa regla solo vive en el navegador.
5. **Publicar.** Extrae `publishPost` de `app/studio/(app)/marketing/noticias-web/actions.ts` a una función reutilizable, y avisa a IndexNow.
6. **Verificar indexación (diario).** URL Inspection API sobre los posts recientes, con aviso si a los 7 días no están indexados.
7. **Vigilar tráfico (semanal).** Compara cada página contra la semana anterior. Una caída fuerte genera una tarjeta para revisar; no corrige nada solo.
8. **No prometer posiciones.** Toda posición que se muestre sale de Search Console con su fecha, nunca del modelo.

## Decisiones de Sam

- **Datos:** solo Search Console por ahora, sin API de pago. Limitación: no da volumen de palabras donde el sitio todavía no aparece.
- **Firma:** DTD Cargo como organización, con una persona real del equipo como revisor.
- **Cadencia:** 2 artículos por semana.

## Fases

| Fase | Entrega | Depende de | Estado |
|---|---|---|---|
| A | Mejoras estáticas | Nada | SDD-0604 |
| B | Estado de revisión, aprobación en servidor, `publishPost` extraído, borradores que se guardan, aviso a IndexNow | OK nominal de la migración | Sin empezar |
| C | Cliente de Search Console, tabla de métricas, banco de temas | Cuenta de servicio de Google | Sin empezar |
| D | Rutas `/api/cron/seo-*`, skill con presupuesto | B y C | Sin empezar |
| E | Estado de indexación por post, alertas de tráfico, resumen en el brief diario | C | Sin empezar |

El código nuevo llega a producción solo cuando Sam descongele la publicación de la web.

## Qué hace falta de Sam

- Crear la cuenta de servicio con lectura de Search Console. La clave va al gestor del servidor, nunca al repo.
- Nombrar a la persona que revisa y aprueba los artículos.
- Dar el OK nominal de la migración de la fase B.
