# Revisión del Motor — el ritual del viernes (agenda para correr)

> **Qué es:** la reunión semanal que mueve el [Motor de Crecimiento](motor-crecimiento.md) sin que
> Sam tenga que empujarlo. Es el *sistema operativo* del programa (base conceptual: Marcilla,
> *el negocio que depende del fundador no escala*). El marcador que se revisa es la **escalera de
> activación** (§M del programa): cada capacidad sube de 🔲0 → 🟡1 → 🟠2 → 🔵3 → 🟢4, y **100% =
> los 6 sistemas en nivel 4**. Hoy el Motor está en **~15% activado**.
>
> **Cuándo:** viernes, 30 min, fijo. **Dónde se ve:** pestaña *Motor de Crecimiento* del dashboard
> (los 22 manómetros). **Acta:** se registra en Bitácora (SDD-0146) al terminar.

---

## Las 2 reglas que hacen que funcione

1. **Respuesta antes de la pregunta.** Nadie llega con dudas: cada dueño trae **su número** y, si
   hay un problema, **su propuesta** ("pasó esto, lo resolví así" o "tengo A o B, decide tú"). El
   que no trae número, no habla — trae número la próxima.
2. **Pirámide del habla en alza.** Hablan **primero los dueños operativos**; **Sam cierra al
   final**. Así el founder no ancla la conversación y la verdad sube desde abajo. (Al arranque Sam
   lleva varios sombreros interinos — su ronda es corta y esa concentración es, ella misma, lo que
   el Motor mide para desarmar.)

---

## Agenda del viernes (30 min, cronometrada)

| Min | Bloque | Qué pasa |
|---|---|---|
| **0-3** | **El marcador** | El facilitador pone el tablero en pantalla y lee en voz alta: **% activado global** + qué **subió o bajó** de nivel esta semana. Nada de discusión todavía. |
| **3-21** | **Ronda de dueños** (~3 min c/u) | Cada dueño de sistema, en orden: (1) **su número** del manómetro; (2) qué capacidad **subió/bajó** de nivel y con qué evidencia; (3) su **top-3 cerrado**; (4) su **top-3 nuevo** para la semana que viene; (5) **un** bloqueo — con propuesta A/B. |
| **21-27** | **Mover el tablero** | En vivo: subir/bajar manómetros de color, arrastrar tarjetas, marcar bloqueadores resueltos. **Se actualiza EN la reunión, no después.** |
| **27-30** | **Sam cierra** | Desempata, decide lo que quedó abierto y **confirma el top-3 por dueño** de la semana. Fin a horario. |

---

## Qué significa "subir de nivel" (el criterio, no la sensación)

Un manómetro **solo cambia de color con evidencia**, nunca porque "ya casi":

| Sube a | Evidencia que lo justifica |
|---|---|
| 🟡 **1 · Instrumentado** | existe el manómetro y muestra un número (aunque sea 0) |
| 🟠 **2 · Primer uso real** | pasó **una** vez en la operación real — no seed, no prueba |
| 🔵 **3 · Rutina** | pasa **habitual**, con dueño y cadencia escrita |
| 🟢 **4 · En verde** | está en **target** y se sostiene **≥4 semanas** |

**Regla dura:** nada sube por escribir código — sube por **uso real medido**. Y **baja** si se dejó
de usar (el Motor es un termostato, no una lista que se completa una vez).

---

## Preparación (durante la semana, no el viernes)

- **Diario · 5 min · cada dueño:** deja su número del día en la nota del manómetro que le toca. El
  viernes ya está todo cargado; la reunión no se gasta buscando datos.
- **Facilitador:** revisa que los 22 manómetros tengan su valor con fecha antes de la reunión.

---

## Roles

- **Facilitador:** **Sam (interino)** → **Yolimar (PMO)** en F4. El ritual es **lo primero que Sam
  delega** — coherente con sacarlo del cuello.
- **Dueños por sistema** (de §4 del programa): S1 Adquisición · S2 Ventas = Sam interino · S3
  Entrega = coordinación China · S4 Manual · S5 Contratación = Yolimar · S6 Financiero = usuario
  contable actual.
- **Scribe:** actualiza `dashboard/motor-crecimiento/dashboard-data.json` con lo movido (o corre
  `/actualizar-dashboards` con las notas de la reunión).

---

## El cierre mensual (1 viernes al mes, +15 min)

Una vez al mes la reunión se extiende para la foto grande:
- **¿Qué sistema graduó?** (todas sus capacidades núcleo en nivel 4, sostenido 4 semanas → sale del
  Motor a "solo operar").
- **¿Qué capacidad bajó de nivel?** (una regresión es tan importante como un avance).
- **Ajustar fases y backlog (§3/§3B)** según lo aprendido.

---

## Acta mínima (pegar en Bitácora al terminar)

```
Revisión del Motor — viernes AAAA-MM-DD
Marcador global: __% activado (semana pasada: __%)
Subió de nivel:  [capacidad → nivel]
Bajó de nivel:   [capacidad → nivel]
Top-3 de la semana por dueño:
  · S1/S2 (Sam):      1) __  2) __  3) __
  · S3 (China):       1) __  2) __  3) __
  · S4/S5 (Yolimar):  1) __  2) __  3) __
  · S6 (contable):    1) __  2) __  3) __
Bloqueos abiertos / decisiones de Sam: __
```

---

*El material de este ritual es la tarea **F1-T08** del tablero ("Arranca el ritual del viernes").
La 1ª sesión puede correr con números a mano si algún manómetro aún no tiene vista — lo importante
es que el Motor empiece a latir.*
