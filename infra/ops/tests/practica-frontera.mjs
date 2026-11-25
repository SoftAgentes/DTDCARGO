// Ensayo local desechable del vhost real: sin ERP, sin credenciales ni canales.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import https from "node:https";
import assert from "node:assert/strict";
const id = `practica-0713-${process.pid}`;
const carpeta = mkdtempSync(resolve(tmpdir(),id));
const docker = (...args) => execFileSync("docker",args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
const plantilla = readFileSync("infra/ops/staging/practica-traefik.yml.tmpl","utf8").replaceAll('{{ env "PRACTICA_HOST" }}',"practica.example.test");
writeFileSync(resolve(carpeta,"dinamica.yml"),plantilla);
let red = false, backend = false, proxy = false;
try {
  docker("network","create",id); red=true;
  docker("run","--detach","--name",id+"-web","--network",id,"--network-alias","practica-personal-web","traefik/whoami:v1.11.0","--port=3000"); backend=true;
  docker("run","--detach","--name",id+"-proxy","--network",id,"--publish","127.0.0.1::8443","--mount",`type=bind,source=${carpeta},target=/config,readonly`,"traefik:v3.7.14","--entrypoints.websecure.address=:8443","--providers.file.filename=/config/dinamica.yml"); proxy=true;
  const puerto = Number(docker("port",id+"-proxy","8443/tcp").split(":").at(-1));
  const pedir = (path,method="POST",headers={},cuerpo="{}") => new Promise((res,rej) => {
    const req=https.request({hostname:"127.0.0.1",port:puerto,path,method,rejectUnauthorized:false,headers:{Host:"practica.example.test","Content-Type":"application/json",...headers}},r => {r.resume();r.on("end",()=>res(r.statusCode));});
    req.on("error",rej);req.end(method === "POST" ? cuerpo : undefined);
  });
  let lista=false;
  for(let i=0;i<30;i++) { try { if(await pedir("/api/practica/estado")===200) {lista=true;break;} } catch {} await new Promise(r=>setTimeout(r,300)); }
  assert.ok(lista,"Traefik debe cargar la plantilla");
  assert.equal(await pedir("/api/practica/facturacion"),200);
  assert.equal(await pedir("/api/practica/facturacion","POST",{},JSON.stringify({texto:"中".repeat(2000)})),200);
  assert.equal(await pedir("/api/practica/facturacion","POST",{},"x".repeat(24577)),413);
  assert.equal(await pedir("/api/practica/estado","POST",{},"x".repeat(2049)),413);
  for(const method of ["GET","HEAD","PUT","DELETE"]) assert.equal(await pedir("/api/practica/facturacion",method),404);
  assert.equal(await pedir("/api/practica/facturacion","POST",{"Next-Action":"inventada"}),404);
  assert.equal(await pedir("/api/practica/facturacion","POST",{Host:"otro.example.test"}),404);
  for(const path of ["/api/pagos","/api/correos","/api/cron","/studio/facturacion","/api/practica/facturacion/otra"]) assert.equal(await pedir(path),404);
  console.log("PASÓ · Traefik real con plantilla: POST Facturación admitido, otros métodos/hosts/Next-Action/rutas ERP bloqueados; backend whoami sintético.");
} finally {
  if(proxy) docker("rm","--force",id+"-proxy");
  if(backend) docker("rm","--force",id+"-web");
  if(red) docker("network","rm",id);
}
