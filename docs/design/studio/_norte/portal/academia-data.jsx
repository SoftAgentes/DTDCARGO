/* global React */
/* ── Academia DTD · Portal del alumno · DATA ──────────────────────
   Mock realista del LMS de autoaprendizaje (value ladder).
   El cableado real vive en el ERP (academia.js) + diplomas.
   Scope por client_markbox. window.AcademiaData. */
(function () {
  'use strict';

  // ── Cursos · value ladder (Curso 0 → 1 → 2 → 1688) ─────────────
  // accent: token de nivel (no color aleatorio). free_preview por lección.
  const COURSES = [
    {
      id: 'c0', level: 0, free: true,
      title: 'Primeros pasos para importar de China',
      tagline: 'El Curso 0 · gratis. De cero al primer pedido sin miedo.',
      hours: 1.5, price: 0,
      modules: [
        { id: 'm1', title: 'Por dónde empezar', lessons: [
          { id: 'l1', title: '¿Qué es importar puerta a puerta?', min: 6, free: true },
          { id: 'l2', title: 'Los 4 pasos del ciclo DTD', min: 8, free: true },
          { id: 'l3', title: 'Mitos que te frenan (y la verdad)', min: 7, free: false }
        ] },
        { id: 'm2', title: 'Tu primer movimiento', lessons: [
          { id: 'l4', title: 'Cómo calcular tu CBM', min: 9, free: false },
          { id: 'l5', title: 'Tu Shipping Mark y por qué importa', min: 5, free: false }
        ] }
      ],
      resources: ['Checklist · primer pedido (PDF)', 'Plantilla de cálculo CBM']
    },
    {
      id: 'c1', level: 1, free: false,
      title: 'Domina Yiwu',
      tagline: 'El mercado mayorista más grande del mundo, a tu favor.',
      hours: 4, price: 0,
      modules: [
        { id: 'm1', title: 'Antes de viajar (o comprar a distancia)', lessons: [
          { id: 'l1', title: 'Mapa de Yiwu por distritos', min: 11, free: true },
          { id: 'l2', title: 'Agentes vs. compra directa', min: 9, free: false },
          { id: 'l3', title: 'Idioma y WeChat: lo mínimo', min: 8, free: false }
        ] },
        { id: 'm2', title: 'Comprando sin que te vean la cara', lessons: [
          { id: 'l4', title: 'Negociar MOQ y precio real', min: 13, free: false },
          { id: 'l5', title: 'Muestras y control de calidad', min: 10, free: false },
          { id: 'l6', title: 'Cerrar y coordinar con DTD', min: 7, free: false }
        ] }
      ],
      resources: ['Guía de distritos de Yiwu (PDF)', 'Frases clave en WeChat', 'Plantilla de orden de compra']
    },
    {
      id: 'c2', level: 2, free: false,
      title: 'De 0 a Contenedor en 4 Semanas',
      tagline: 'El programa insignia. Tu primer contenedor, paso a paso.',
      hours: 12, price: 0, flagship: true,
      modules: [
        { id: 'm1', title: 'Semana 1 · Producto y proveedor', lessons: [
          { id: 'l1', title: 'Elegir un producto que vende', min: 14, free: true },
          { id: 'l2', title: 'Encontrar y filtrar proveedores', min: 16, free: false }
        ] },
        { id: 'm2', title: 'Semana 2 · Números que cierran', lessons: [
          { id: 'l3', title: 'Costo DDP real y margen', min: 15, free: false },
          { id: 'l4', title: 'LCL vs. contenedor completo', min: 12, free: false }
        ] },
        { id: 'm3', title: 'Semana 3-4 · Ejecutar', lessons: [
          { id: 'l5', title: 'Consolidación y tiempos', min: 13, free: false },
          { id: 'l6', title: 'Aduana VE sin sustos', min: 11, free: false },
          { id: 'l7', title: 'Recibir y vender', min: 9, free: false }
        ] }
      ],
      resources: ['Plan de 4 semanas (PDF)', 'Calculadora de margen DDP', 'Checklist de aduana VE']
    },
    {
      id: 'c3', level: 3, free: false,
      title: 'MasterClass 1688',
      tagline: 'Compra como local en la plataforma de los mayoristas chinos.',
      hours: 6, price: 0,
      modules: [
        { id: 'm1', title: 'Entrar a 1688', lessons: [
          { id: 'l1', title: 'Registro y pago sin tarjeta china', min: 12, free: true },
          { id: 'l2', title: 'Leer una ficha como experto', min: 10, free: false }
        ] },
        { id: 'm2', title: 'Comprar y traer', lessons: [
          { id: 'l3', title: 'Agentes de pago y bodega', min: 11, free: false },
          { id: 'l4', title: 'De 1688 a tu Shipping Mark DTD', min: 9, free: false }
        ] }
      ],
      resources: ['Guía visual de 1688 (PDF)', 'Lista de agentes confiables']
    }
  ];

  // ── Estado del alumno (mock · scope client_markbox) ────────────
  // completed: set de "courseId/lessonId". enrolled: ids de cursos.
  const member = {
    markbox: 'DTD-5452',
    name: 'Carlos Méndez',
    enrolled: ['c0', 'c1', 'c2'],
    completed: new Set([
      'c0/l1', 'c0/l2', 'c0/l3', 'c0/l4', 'c0/l5',           // Curso 0 completo
      'c1/l1', 'c1/l2', 'c1/l3'                               // Domina Yiwu a la mitad
    ])
  };

  // Diplomas ganados (los completados). variant A/B/C/D del generador.
  const diplomas = [
    { courseId: 'c0', folio: 'DTD-AC-2026-0418', dateISO: '2026-05-28', variant: 'A' }
  ];

  // ── Helpers ────────────────────────────────────────────────────
  function course(id) { return COURSES.find((c) => c.id === id); }
  function allLessons(c) { return c.modules.reduce((a, m) => a.concat(m.lessons.map((l) => ({ ...l, moduleId: m.id }))), []); }
  function lessonCount(c) { return allLessons(c).length; }
  function isDone(courseId, lessonId) { return member.completed.has(courseId + '/' + lessonId); }
  function courseProgress(c) {
    const all = allLessons(c);
    const done = all.filter((l) => isDone(c.id, l.id)).length;
    return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  }
  function isEnrolled(id) { return member.enrolled.includes(id); }
  function isMember() { return member.enrolled.length > 0 || diplomas.length > 0; }
  function hasDiploma(courseId) { return diplomas.some((d) => d.courseId === courseId); }

  // Próxima lección sin completar de un curso (para "Continuar donde quedaste")
  function nextLesson(c) {
    return allLessons(c).find((l) => !isDone(c.id, l.id)) || allLessons(c)[0];
  }
  // Cursos en progreso (enrolled, 0<pct<100)
  function inProgress() {
    return COURSES.filter((c) => isEnrolled(c.id)).map((c) => ({ c, p: courseProgress(c) }))
      .filter((x) => x.p.pct > 0 && x.p.pct < 100);
  }
  // Siguiente recomendado del value ladder (el primer curso no inscrito, o el de mayor nivel no completo)
  function recommended() {
    // 1º un curso inscrito sin empezar (por nivel) → el siguiente natural del ladder
    const notStarted = COURSES.find((c) => isEnrolled(c.id) && courseProgress(c).pct === 0);
    if (notStarted) return notStarted;
    const notEnrolled = COURSES.find((c) => !isEnrolled(c.id));
    if (notEnrolled) return notEnrolled;
    return COURSES.find((c) => courseProgress(c).pct < 100) || COURSES[COURSES.length - 1];
  }
  // Marcar lección + recalcular. Devuelve {justFinishedCourse, course} si completó la última.
  function toggleLesson(courseId, lessonId, value) {
    const key = courseId + '/' + lessonId;
    const was = member.completed.has(key);
    const next = value == null ? !was : value;
    if (next) member.completed.add(key); else member.completed.delete(key);
    const c = course(courseId);
    const justFinished = next && courseProgress(c).pct === 100 && !hasDiploma(courseId);
    if (justFinished) {
      diplomas.push({ courseId, folio: 'DTD-' + (c.level === 0 ? 'C0' : 'AC') + '-2026-' + String(500 + diplomas.length * 37).padStart(4, '0'), dateISO: new Date().toISOString().slice(0, 10), variant: ['A', 'B', 'C', 'D'][diplomas.length % 4] });
    }
    return { justFinished, course: c };
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fmtDate(iso) { const [y, m, d] = iso.split('-').map(Number); return d + ' ' + MESES[(m - 1) % 12] + ' ' + y; }

  // Próximas cohortes en vivo (catálogo "próximamente")
  const COHORTS = [
    { courseId: 'c2', dateISO: '2026-07-07', mode: 'En vivo · online', seats: 18, taken: 11 },
    { courseId: 'c1', dateISO: '2026-07-21', mode: 'Presencial · Valencia', seats: 12, taken: 5 },
    { courseId: 'c3', dateISO: '2026-08-04', mode: 'En vivo · online', seats: 25, taken: 3 }
  ];

  window.AcademiaData = {
    COURSES, member, diplomas, COHORTS,
    course, allLessons, lessonCount, isDone, courseProgress, isEnrolled, isMember,
    hasDiploma, nextLesson, inProgress, recommended, toggleLesson, fmtDate
  };
})();
