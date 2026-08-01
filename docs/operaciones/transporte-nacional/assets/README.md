# Evidencia del acuerdo con Benito Transporte Express

Trazabilidad ISO 9001 §7.5 del tarifario terrestre nacional vigente. Estos son
los documentos **fuente**: si algún día hay que defender por qué la calculadora
cobra lo que cobra, se defiende con esto, no con la memoria de nadie.

| Archivo | Qué es | Fecha |
|---|---|---|
| [`2026-07-31-confirmacion-tarifas-benito-transporte-express.pdf`](2026-07-31-confirmacion-tarifas-benito-transporte-express.pdf) | Formulario de confirmación de tarifas y tiempos, respondido y **firmado por Mariotsy Mendoza, Gerente General**. Es lo que convierte la conversación en acuerdo. | 2026-07-31 |
| [`2026-07-31-tarifario-benito-178-destinos.xlsx`](2026-07-31-tarifario-benito-178-destinos.xlsx) | Tabla completa de destinos con su tramo. Es la fuente de la que salió la migración `0332_seed_tarifario_benito.sql`. | 2026-07-31 |

**Empresa:** BENITO TRANSPORTE EXPRESS, C.A · RIF **J-50266334-7**
(*Transporte* en singular — "Transportes Benítez" y "R&M" son nombres que ellos
mismos descartaron; el archivo original del PDF traía el plural en el título).

Ficha operativa y condiciones: [`../benito-transporte-express.md`](../benito-transporte-express.md).
Decisión de precio y por qué la venta no se deriva del costo: SDD-0236 y SDD-0237.

---

## ⚠️ Estos archivos llevan el COSTO

El xlsx trae lo que **nosotros le pagamos** a Benito ($70 / $80 por CBM), no solo
lo que le cobramos al cliente. Ese dato vive normalmente en `carrier_tariffs` y
**nunca sale por la RPC pública** — `lib/data/destinos-nacionales.ts` lo dice
explícito porque ese archivo entra al bundle del navegador.

Están en git porque **este repositorio es privado**. Las reglas que se derivan:

- **No copiar estas cifras** a nada que se sirva al cliente: ni a `lib/data/`,
  ni a un componente, ni a una respuesta de API.
- Si el repositorio dejara de ser privado, **esto sale primero** (y se reemplaza
  por un puntero a Drive, que es lo que `AGENTS.md` pide para contratos crudos).
- El PDF contiene el nombre y el cargo de una persona de la contraparte. Es dato
  de contacto comercial, no de un cliente, pero aplica el mismo criterio: no se
  reenvía fuera del equipo.
