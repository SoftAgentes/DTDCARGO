---
sdd: "0167"
title: "Actualidad — centro editorial público"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-22
updated: 2026-07-22
supersedes: null
superseded_by: null
related: ["0088", "0089"]
confidencialidad: interno
---

# DTD-0167 — Actualidad · centro editorial público

## 1. Decisión aprobada

`/noticias` conserva su URL canónica y pasa a presentarse como **Actualidad** en
la navegación principal. La portada usa el título aprobado **“Actualidad, guía
y noticias”** y reúne guías permanentes, noticias logísticas, análisis y casos
reales. No se crea `/blog` ni un segundo CMS.

## 2. Alcance de esta implementación

- mover Actualidad fuera del menú Ayuda;
- rediseñar la portada con hero compacto, categorías no vacías, destacado,
  últimas publicaciones y archivo;
- mostrar el buscador al alcanzar ocho publicaciones;
- paginar el archivo cada 12 publicaciones;
- usar fotografías operativas locales como respaldo;
- adaptar artículos con portada 16:9, respuesta directa, índice, autoría,
  revisión opcional, relacionados y newsletter al final;
- emitir `BlogPosting`, `NewsArticle` o `Article` según el tipo de contenido;
- dejar de emitir `FAQPage` automáticamente;
- consumir publicaciones por `lib/public/`, sin importar el backend del ERP
  desde componentes públicos.

## 3. Compatibilidad sin migración

La UI funciona con el esquema actual de `news_posts`. Mientras no se apruebe la
migración editorial, deriva el tipo desde `tipo` y `categoria`, usa la fecha de
publicación como referencia y asigna una fotografía operativa por categoría.

Campos futuros, todos opcionales para la web:

- `content_kind`: `guide`, `news`, `analysis` o `case`;
- `cover_image_url` y `cover_alt`;
- `featured`;
- `reviewer_name` y `reviewer_role`;
- `updated_at` ya existe y se cablea como fecha de modificación.

La migración para estos campos no forma parte de esta autorización y debe
aprobarse por separado.

## 4. Newsletter

El newsletter es exclusivamente por email. La implementación local agrega:

1. tabla privada `newsletter_subscribers` con RLS y sin lectura anónima;
2. endpoint `/api/newsletter/subscribe` con validación, honeypot, throttle,
   lista de exclusión e idempotencia;
3. baja firmada extendida para audiencia `newsletter`, independiente de
   `clients`;
4. formulario activo en `/noticias` y artículos, sin opción de WhatsApp.

Activarlo en producción requiere, en una autorización separada:

1. aplicar la migración `0259_newsletter_subscribers.sql`;
2. verificar alta, reintento/duplicado y honeypot contra Supabase;
3. verificar envío manual desde Studio con links de baja firmados;
4. verificar baja de punta a punta;
5. revisar asesores de Supabase después de aplicar la migración.

Publicar un artículo nunca envía una campaña automáticamente.

## 5. Criterios de aceptación

- menú principal visible como Actualidad y Ayuda sin Noticias;
- canonical permanece en `/noticias`;
- estados con cero, una y múltiples publicaciones no rompen la página;
- categorías vacías no aparecen;
- búsqueda tolera acentos y mayúsculas;
- fotografías tienen texto alternativo en artículos;
- cuerpo de lectura con ancho aproximado de 65 caracteres;
- foco visible, targets móviles y reflujo en 390, 768 y 1440 px;
- newsletter por email valida consentimiento explícito y no usa WhatsApp;
- endpoint no revela si un correo ya existe o está bloqueado;
- tabla de suscriptores no tiene lectura directa anónima ni autenticada;
- TypeScript, lint, unitarias, build y prueba visual en verde.

## 6. Gates externos

- no aplicar migraciones a producción;
- no activar newsletter público;
- no hacer push, Preview ni producción sin autorización del founder;
- validar datos estructurados en Rich Results Test después de Preview.
