// Genera el contorno del mapa del tracking (SDD-0659).
// Fuente: Natural Earth 1:110m (dominio público), vía world-atlas@2.0.2 land-110m.json.
// Uso: node gen.mjs <ruta a land-110m.json>
import { readFileSync } from "node:fs";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
const W = 900, H = 380;
const topo = JSON.parse(readFileSync(process.argv[2], "utf8"));
const land = feature(topo, topo.objects.land);
const p = geoNaturalEarth1().rotate([165, 0]);
p.fitExtent([[0, 0], [W, H]], { type: "MultiPoint", coordinates: [[100, -8], [-52, -8], [100, 54], [-52, 54], [-165, 56], [-165, -12]] });
const k = p.scale(), [tx, ty] = p.translate();
p.clipExtent([[-4, -4], [W + 4, H + 4]]);
const d = geoPath(p.precision(0.4))(land).replace(/-?\d+\.\d+/g, (n) => String(Math.round(+n * 10) / 10));
console.log(JSON.stringify({ W, H, k, tx, ty, ningbo: p([121.85, 29.9]), guaira: p([-66.94, 10.6]), bytes: d.length }));
process.stdout.write("\n" + d + "\n");
