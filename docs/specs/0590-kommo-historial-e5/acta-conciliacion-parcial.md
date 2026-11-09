# Acta de conciliación parcial de E5 (paso 5.8)

- **SDD:** 0590, paso 5.8 del programa [SDD-0582](../0582-chatwoot-piloto/checklist.md).
- **Estado:** borrador. Lo medido por objeto ya está en [§10.16 de la spec](spec.md). Las consultas de la columna «Acta» quedan escritas, solo de conteo y de solo lectura. El Director General se las presenta a Sam, y solo las corre en producción con el OK nominal de Sam. El Worker no las corre. Después, Sam acepta o no la 5.8.
- **Es parcial:** cubre la carga del historial de Kommo hasta el corte `2026-11-07T05:00:00Z`. El acta final es la 8.6, después del corte de E8.
- **Datos:** solo números y los nombres de canal que trae Kommo. Ningún nombre, teléfono, correo, texto, id de Kommo ni monto.
- **Etiquetas:** R medido en el VPS (§10.16), C código, I inferencia, NV no verificado.

## 1. Por objeto

La conciliación sigue la cadena de la carga:
- **Kommo:** lo que bajó la extracción completa hasta el corte.
- **Preparado:** lo que salió de `vincular` y `preparar-carga` (5.4).
- **En Chatwoot:** lo que escribió la carga en la bandeja 8, «Archivo Kommo», el 2026-11-07 de 10:59:02Z a 11:29:40Z (5.7).

| Objeto | Kommo | Preparado | En Chatwoot (5.7, R) | Acta (DG) | Diferencia y por qué |
|---|---|---|---|---|---|
| Conversaciones | 4780 con eventos | 4780 | 4780 | _pendiente_ | 0. Además existen **12 con 403** que el usuario de la integración no ve: no tienen eventos y quedan fuera (§2) |
| Mensajes (únicos por id) | — | 54.737 | 54.737 | _pendiente_ | 0. Los **54.753 eventos** de la extracción no son mensajes: son lo que enumera las conversaciones. `preparar-carga` cuenta los mensajes únicos por id (`respaldar-historial.py:1052-1079`, C) |
| · entrantes | — | 29.099 | 29.099 | _pendiente_ | 0 |
| · salientes | — | 25.638 (11.714 de bot) | 25.638 | _pendiente_ | 0. Los de bot entran como salientes, con el autor «Bot Kommo» |
| · sin texto | — | 3148 | 3148 | — | Se informa; el acta no lo compara |
| Contactos | 4303 contactos en 4258 grupos | 4258 personas | 4258 contactos (4257 nuevos y 1 reusado) y 4258 `contact_inboxes` | _pendiente_ | 0. 241 se vincularon con clientes del ERP; 1 ambiguo quedó sin vincular. E-1 = 0 y E-2 = 0 |
| Adjuntos | 3654 en el índice, 3639 bajados | 3639, con 2.134.541.464 bytes | 3639 subidos, con 2.134.541.464 bytes; 0 huérfanos, 0 fallidos, 0 que no coinciden y 0 sin mensaje | _pendiente_ | 0 entre lo bajado y lo cargado. Los **15 con 404** ya no existen en Kommo (§2) |
| Miembros de la bandeja | — | — | 2, los 2 administradores | _pendiente_ | Lo decidió Sam: «todo el equipo» (§10.14) |
| Huérfanos y repetidos | — | — | 0 | _pendiente_ | Conversaciones sin `contact_inbox`, mensajes fuera de su conversación, `source_id` y `kommo_talk_id` repetidos |
| Efectos fuera del Archivo | — | — | 0 trabajos y 0 correos. E-3 «antes» y «después»: 8 / 0 / 22 / 7 | — | La carga no disparó nada hacia el Studio |

## 2. Lo que quedó fuera, a sabiendas

- **12 conversaciones con 403:** existen, pero el usuario de la integración no las ve. No tienen eventos, mensajes ni adjuntos bajados. Recuperarlas pide darle acceso en Kommo y otro token, y eso lo decide Sam. Sus ids están en §10.16 y en el paquete cifrado.
- **15 adjuntos con 404:** Kommo ya no los tiene (12 de `drive-g` y 3 de `drive-c`; 11 imágenes y 4 archivos, en 10 conversaciones).

## 3. Por canal de Kommo

El cargador guarda el canal de cada conversación en `additional_attributes['kommo_origen']` (`cargar-archivo-kommo.rb:274`, C).

**Del lado de Chatwoot**, el guion de abajo cuenta conversaciones y mensajes por canal.

**Del lado de Kommo, el desglose por canal de la extracción final es NV.** El archivo de carga con el `origen` de cada conversación se borró con el staging después de `empaquetar`, y solo queda dentro del paquete cifrado, cuya llave tiene Sam. Además, esa corrida no dejó `informe.json`: es el hallazgo 3 de §10.16, corregido para adelante en la #413.

La referencia más cercana es la medición de la 5.2, del 2026-10-31 ([`informe-volumen.md`](informe-volumen.md)), con 4715 conversaciones con mensajes. Es de otro corte, así que **no se concilia contra ella**: solo sirve para ver que la forma se parece.

| Canal (`kommo_origen`) | 5.2 · conversaciones | 5.2 · mensajes | Archivo · conversaciones (DG) | Archivo · mensajes (DG) |
|---|---|---|---|---|
| `waba` | 2636 | 41.804 | _pendiente_ | _pendiente_ |
| `instagram_business` | 1680 | 9235 | _pendiente_ | _pendiente_ |
| `facebook` | 377 | 2858 | _pendiente_ | _pendiente_ |
| `officialwhatsapp` | 21 | 287 | _pendiente_ | _pendiente_ |
| `onlinechat` | 1 | 3 | _pendiente_ | _pendiente_ |
| **Total** | **4715** | **54.187** | _pendiente_ (4780 esperadas) | _pendiente_ (54.737 esperados) |

**Pasa si:** la suma por canal del Archivo da 4780 conversaciones y 54.737 mensajes, y cada canal de la 5.2 aparece con un número igual o mayor (I: el corte del 2026-11-07 es posterior). **No pasa si:** aparece un canal que la 5.2 no tenía, o la suma no da el total. Si pasa eso, se mira antes de firmar.

## 4. Las consultas, listas para el Director General

[`infra/ops/kommo-historial/acta-conteos.rb`](../../../infra/ops/kommo-historial/acta-conteos.rb) es un `rails runner`.
- **Solo lectura:** todo va en una transacción declarada `READ ONLY`, que se deshace al final. Si algo intentara escribir, Postgres lo rechaza. La primera línea de salida dice `solo_lectura=si`.
- **Imprime** solo números y nombres de canal.
- **Con `COMPARAR=5.7`** compara cada objeto con la columna «En Chatwoot» de §1 y escribe «coincide» o «NO COINCIDE».

El guion todavía no está en el VPS. Primero se copia de `main` junto a los otros de E5, en `/srv/ops/kommo-historial-0590b/`, y se compara su sha256 con el de `main`. Después, desde `/srv/chatwoot`, y solo con el OK nominal de Sam que pide el Director General:

```bash
docker compose cp /srv/ops/kommo-historial-0590b/acta-conteos.rb rails:/tmp/acta-conteos.rb
docker compose exec -T -e BANDEJA=8 -e COMPARAR=5.7 rails bundle exec rails runner /tmp/acta-conteos.rb
```

`docker compose cp` y `exec` no recrean nada.

**Pasa si:** sale `HECHO solo_lectura=si`, `HECHO concilia=si` y `HECHO acta=ok`. Con eso se llenan las columnas «Acta (DG)» de §1 y de §3.

**Se prueba sin tocar nada vivo** en `infra/ops/kommo-historial/pruebas/prueba-cargador.sh`, bloque AC. Corre en el flujo «Cargador del Archivo Kommo» de GitHub Actions, sobre la imagen real y con datos inventados:
- cuenta lo que dejó la carga, por objeto y por canal;
- no cuenta la bandeja viva de la misma cuenta;
- con `COMPARAR=5.7`, sobre datos inventados, da 9 «NO COINCIDE» y 4 «coincide»;
- sin `BANDEJA` no cuenta nada;
- su salida no trae nombres, correos ni ids.

AC9 intenta escribir en una transacción `READ ONLY` como la del acta, y Postgres tiene que rechazarlo sin dejar ninguna fila. Tiene dos mutantes:
- sin `READ ONLY`, el guion tiene que abortar con «la transacción no quedó en solo lectura», sin contar nada;
- contando toda la cuenta en vez de la bandeja, el conteo tiene que salir mal.

## 5. Firma

| | Quién | Cuándo | Resultado |
|---|---|---|---|
| Conteos en producción | Director General | _pendiente_ | _pendiente_ |
| Aceptación de la 5.8 | Sam | _pendiente_ | _pendiente_ |
