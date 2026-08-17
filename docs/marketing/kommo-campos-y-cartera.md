# Kommo · los campos que faltan y el reparto de cartera

**Medido contra producción el 2026-08-14** (no recordado: cada número de acá
salió de una consulta, y la consulta está escrita al lado). Es trabajo de
navegador — nadie lo puede hacer por ti, y son ~10 minutos si lo haces de
corrido.

> Al terminar, avísame y lo verifico contra la base en una corrida.

---

## Parte 1 · Los 5 campos comerciales del LEAD

**Verificado: ninguno de los cinco existe.** Kommo tiene hoy **20 campos de
lead** y son todos de tracking o de finanzas — `utm_*`, `gclid`, `fbclid`,
`referrer`, `Formulario`, `finance`, `n_income`, `n_total`, `n_expenses`,
`Mensaje Personalizado`, `ttad_*`, `Shipping Mark - j102` y `Priority`. No hay
un solo campo que diga **qué clase de cliente es** ni **por qué se perdió**.

Sin esos campos, el CRM sabe de dónde vino el lead y no sabe nada de lo que
pasó después. Y el agente de IA tampoco.

**Dónde:** Kommo → *Ajustes → Campos → Leads → Añadir campo*.

| # | Nombre literal (cópialo tal cual) | Tipo de campo | Opciones de la lista |
|---|---|---|---|
| 1 | `Tipo comercial` | Lista (select) | `Mayorista` · `Minorista` · `Aliado white-label` · `Empresa` · `Personal` |
| 2 | `Cadencia esperada` | Lista (select) | `Mensual` · `Cada 45 días` · `Trimestral` · `Esporádico` · `Primera compra` |
| 3 | `Volumen estimado` | Lista (select) | `Menos de 1 CBM` · `1 a 3 CBM` · `3 a 10 CBM` · `Más de 10 CBM` · `Contenedor completo` |
| 4 | `Canal de origen` | Lista (select) | `WhatsApp` · `Instagram` · `TikTok` · `Web` · `Referido` · `Aliado` · `Recompra` |
| 5 | `Motivo de pérdida` | Lista (select) | `Precio` · `Tiempo de tránsito` · `Se fue con otro` · `No respondió` · `No era su mercado` · `Sin presupuesto` · `Se pospuso` |

### Tres cosas que conviene saber antes de crearlos

**Todos son lista, ninguno texto libre.** El texto libre no se puede agrupar:
"whatsapp", "WhatsApp" y "wpp" son tres canales distintos para cualquier reporte,
y el día que quieras saber por qué se pierde la plata vas a tener 40 respuestas
únicas. Con lista, el reporte sale solo.

**`Canal de origen` no reemplaza a los `utm_*`.** Los `utm_*` dicen de qué
anuncio vino; éste dice por dónde entró la conversación. Un lead puede tener
`utm_source=instagram` y haber escrito por WhatsApp — son dos preguntas
distintas y las dos importan.

**`Motivo de pérdida` sólo tiene sentido si es obligatorio al cerrar perdido.**
En Kommo eso se configura aparte (*Ajustes del embudo → etapa Perdido → campos
obligatorios*). Si queda opcional, se llena el primer mes y después nadie más.

---

## Parte 2 · Los 2 campos del CONTACTO (para el agente de IA)

Éstos son de **contactos**, no de leads. Van aparte porque el lead se cierra y se
lleva sus campos; el contacto es permanente. Y porque el agente de IA de Kommo
lee campos del **contacto**: es ahí donde tiene que estar escrito que el cliente
debe plata, para que escale a un humano en vez de responder como si nada.

**Dónde:** Kommo → *Ajustes → Campos → **Contactos** → Añadir campo*.

| # | Nombre literal | Tipo de campo | Qué escribe el ERP |
|---|---|---|---|
| 6 | `Tiene saldo pendiente` | Texto | `Sí` o `No` |
| 7 | `Carga en tránsito` | Texto | `Sí` o `No` |

**Sí/No, sin montos** — es tu decisión del 2026-08-14, y la comparto: del otro
lado hay un agente automático, y un monto exacto es plata hablando sola frente a
algo que puede repetirlo fuera de contexto. El sí/no alcanza para lo único que se
le pide, que es escalar a una persona.

Después de crearlos hay que **decirle al ERP cuáles son**: Studio → CRM →
Dirección. Hasta que se elijan, el job no encola nada (nace inerte, igual que el
Shipping Mark).

> ⚠️ **Y hay que decir lo que hoy no funciona.** De 447 clientes vivos, sólo
> **32** están vinculados a un contacto de Kommo (7,2%). De esos 32, **cero**
> tienen hoy saldo pendiente o carga en tránsito: los 2 clientes con saldo y los
> 6 con carga navegando del ERP **no están vinculados a ningún contacto**. O sea:
> aunque crees los dos campos hoy, el ERP no le escribiría nada a nadie. El
> cuello no es el campo — es el vínculo cliente↔contacto, y está antes que esto.
> Ver el reporte de la Fase 5 para el detalle.

---

## Parte 3 · El reparto de cartera

### Lo que hay hoy, medido

| Asesor en Kommo | id | Correo | Leads activos |
|---|---|---|---|
| **DTD CARGO** | 9976747 | doortudoorservices@gmail.com | **45** |
| Sam | 15390372 | VZLA@DTDCARGO.COM | 0 |
| Sam | 15453476 | info@dtdcargo.com | 0 |
| Sergio Quevedo Bermudez | 8402099 | sergioqb@solucionessq.com | 0 |
| ofidoc siglo | 13128199 | ofidocxxi@gmail.com | 0 |
| *(sin asignar)* | 0 / null | — | **5** |

Y por etapa:

| Etapa | Leads | En DTD CARGO | Sin asignar |
|---|---|---|---|
| Incoming leads (bandeja) | 5 | 0 | **5** |
| Contacto inicial | 21 | 21 | 0 |
| Recontacto | 10 | 10 | 0 |
| Estimado enviado | 2 | 2 | 0 |
| Negociación | 12 | 12 | 0 |
| **Total** | **50** | **45** | **5** |

**Dato bueno que no esperaba:** ningún lead activo lleva más de 30 días sin
moverse. La cartera está fresca — no hay nada podrido que rescatar.

### ⚠️ Antes de repartir hay algo que decidir

Se venía diciendo "2 asesores de 5 tienen carga". Medido, el cuadro es otro y es
más incómodo: **no hay 5 asesores.** Hay una cuenta genérica de la empresa
(`DTD CARGO`, con los 45 leads), **dos cuentas tuyas duplicadas** (`Sam` con dos
correos distintos), y dos nombres que parecen externos (`Sergio Quevedo
Bermudez` con correo `@solucionessq.com`, y `ofidoc siglo`).

Repartir 45 leads entre esa lista sería mandarle cartera a cuentas que a lo mejor
ya nadie usa. **Dos preguntas que sólo puedes contestar tú:**

1. ¿`Sergio Quevedo Bermudez` y `ofidoc siglo` siguen trabajando los leads, o son
   accesos viejos? Si son viejos → desactivarlos en Kommo (*Ajustes → Usuarios*).
   Un usuario inactivo no puede recibir leads, y eso evita reasignarle a alguien
   que no va a mirar.
2. De tus dos cuentas `Sam`, ¿cuál usas? La otra sobra.

**Mientras eso no se decida, el reparto no se puede hacer bien** — y el problema
de fondo no es la distribución: es que **el 90% de la cartera está en una cuenta
genérica que no es una persona**. "DTD CARGO" no llama a nadie, no tiene tareas
vencidas y no aparece en un ranking. Con la cartera ahí, el CRM no puede decirte
quién está trabajando y quién no.

### El reparto concreto, para cuando tengas la lista de asesores reales

Este es el orden que recomiendo. Ahora se puede hacer **desde el ERP** (Studio →
CRM → cualquier lead → *Acciones* → *Asesor*), sin salir a Kommo.

**Primero los 5 sin asignar (Incoming leads).** Son los más urgentes: nadie los
está mirando. ⚠️ Y ojo con éstos: la bandeja de entrada de Kommo no acepta que le
muevan un lead *hacia* ella por API, pero **sí** acepta que se les cambie el
responsable. Asígnalos y sácalos de la bandeja a mano en Kommo.

**Después, por etapa y de abajo hacia arriba** — lo más cerca de cerrar primero,
porque es donde un cambio de dueño duele más si sale mal:

| Orden | Etapa | Leads | Criterio |
|---|---|---|---|
| 1º | Negociación | 12 | Al asesor que ya venía hablando con ese cliente. Si no lo sabes, no lo muevas todavía |
| 2º | Estimado enviado | 2 | Igual: hay una conversación viva detrás |
| 3º | Contacto inicial | 21 | Reparto parejo entre los asesores reales |
| 4º | Recontacto | 10 | Reparto parejo. Son los que hay que volver a tocar |

**Regla que evita el desastre:** no repartas Negociación y Estimado enviado "a
ojo". Ahí hay 14 conversaciones abiertas, y cambiarle el dueño a un lead que
estaba a punto de cerrar es la forma más cara de ordenar un CRM. Si no sabes
quién venía atendiendo a cada uno, déjalos donde están y reparte sólo las 31
tarjetas de Contacto inicial y Recontacto.

---

## Cómo verificar que quedó

Cuando termines, se puede medir sin abrir Kommo — la sincronización espeja los
campos y los usuarios, y estas tres consultas responden solas:

```sql
-- 1) ¿Aparecieron los 5 campos de lead y los 2 de contacto?
select entity_type, name, type from public.kommo_custom_fields
where name in ('Tipo comercial','Cadencia esperada','Volumen estimado',
               'Canal de origen','Motivo de pérdida',
               'Tiene saldo pendiente','Carga en tránsito')
order by entity_type, name;

-- 2) ¿Cómo quedó el reparto?
select coalesce(u.name,'Sin asignar') as asesor, count(*) as leads
from public.kommo_leads l
left join public.kommo_users u on u.id = l.responsible_user_id
where l.closed_at is null group by 1 order by 2 desc;

-- 3) ¿Quedó alguno sin dueño?
select count(*) from public.kommo_leads
where closed_at is null and (responsible_user_id is null or responsible_user_id = 0);
```

⚠️ El espejo se llena con la sincronización, así que los campos nuevos aparecen
después de la próxima corrida — no en el instante en que los creas.
