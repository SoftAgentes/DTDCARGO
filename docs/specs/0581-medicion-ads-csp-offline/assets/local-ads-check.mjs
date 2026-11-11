/** SDD-0581. Ensayos locales sin credenciales; controles de red antes de runtime. */
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import os from 'node:os';
import {spawn,spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createFixture} from './fixture-app.mjs';

const assets=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(assets,'../../../../');
assert.equal(process.cwd(),root);const mode=process.argv[2];assert(['probe','e2e','recheck','unit','ledger','verify','guard'].includes(mode));
const qa=path.join(root,'.codex/qa');fs.mkdirSync(qa,{recursive:true});
// .codex es ignorado por Git, pero el ESLint canónico recorre su JS generado.
// Preservar builds/fixture fuera del repo antes del gate; jamás debilitar ESLint.
if(mode==='verify')for(const name of ['ads-release','ads-fixture']){
  const artifact=path.join(qa,name);if(fs.existsSync(artifact)){
    assert(!fs.lstatSync(artifact).isSymbolicLink()&&fs.realpathSync.native(artifact)===artifact,'Derivado propio redirigido');
    throw new Error(`Apartar preservando ${name} fuera del repo antes del canónico; ver ads-preserved-builds.json`);
  }
}
const log=path.join(qa,`ads-network-${mode}.jsonl`);fs.writeFileSync(log,'');
assert.deepEqual(fs.readdirSync(root).filter(n=>/^\.env/.test(n)&&n!=='.env.example'),[],'Sin .env reales');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/SUPABASE|KOMMO|API_KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|HAILUWAY|NEXT_PUBLIC_GA|GOOGLE|ANTHROPIC|OPENAI|GEMINI|NODE_OPTIONS/.test(key)));
const proxyAttempts=[];
const fixture=http.createServer((req,res)=>{
  if(/^https?:\/\//i.test(req.url)){const url=new URL(req.url);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)){proxyAttempts.push({host:url.hostname,type:'proxy-http'});res.writeHead(502);res.end();return;}}
  res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});res.end('[]');
});
fixture.on('connect',(req,socket)=>{proxyAttempts.push({host:req.url.split(':')[0],type:'proxy-connect'});socket.end('HTTP/1.1 502 Blocked\r\n\r\n');});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));const proxy=`http://127.0.0.1:${fixture.address().port}`;
Object.assign(env,{NODE_OPTIONS:`--require="${path.join(assets,'offline-network-guard.cjs').replaceAll('\\','/')}"`,DTD_OFFLINE_LOG:log,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_GA_ID:'off',NEXT_PUBLIC_SUPABASE_URL:proxy,NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-local-no-business-data',NEXT_PUBLIC_HAILUWAY_API:proxy,VERIFY_SKIP_EDGE:'1',VERIFY_SKIP_SQL:'1',VERIFY_SKIP_E2E:'1',DTD_ADS_PROXY:proxy,DTD_ADS_PHASE:mode});
delete env.NEXT_PUBLIC_SITE_URL;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);
const require=createRequire(import.meta.url);require('./offline-network-guard.cjs');
const probes=[()=>fetch('https://probe.invalid/no-payload'),()=>require('node:net').connect(443,'203.0.113.1'),()=>require('node:dns').lookup('probe.invalid',()=>{}),()=>spawn('curl',['https://probe.invalid']),()=>spawn('git',['fetch','origin'],{cwd:root}),()=>spawn('Playwright.exe',['--curl-proxy=https://proxy.invalid']),()=>spawn(process.execPath,['-e','require("node:net").connect(443,"probe.invalid")'],{stdio:'pipe'}),()=>require('node:dgram').createSocket('udp4').send('synthetic',9,'127.0.0.1')];
for(const probe of probes){try{const result=probe();if(result?.on){let stderr='';result.stderr?.on('data',chunk=>{stderr+=chunk;});const code=await new Promise(resolve=>result.on('exit',resolve));assert.notEqual(code,0);assert.match(stderr,/DTD_OFFLINE_DENIED/,'La salida fallida debe provenir del guard');}else{await result;throw new Error('Sonda no bloqueada');}}catch(error){assert.equal(error.code,'DTD_OFFLINE_DENIED');}}
assert(JSON.parse('['+fs.readFileSync(log,'utf8').trim().split('\n').join(',')+']').some(entry=>entry.pid!==process.pid&&['socket','dns'].includes(entry.kind)),'Hijo Node debe registrar rechazo previo a red');
fs.copyFileSync(log,path.join(qa,`ads-negative-${mode}.jsonl`));fs.writeFileSync(log,'');
if(mode==='guard'){
  const fixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'gate-migraciones-0548-'));
  const foreignRoot=fs.mkdtempSync(path.join(os.tmpdir(),'dtd-0581-negative-'));
  const exact=['fetch','origin','main','--quiet'];
  const cases=[
    {cwd:fixtureRoot,gitDir:path.join(fixtureRoot,'no-es-un-repo'),args:exact,expected:'child-git-disabled-fixture'},
    {cwd:root,gitDir:path.join(root,'no-es-un-repo'),args:exact,expected:'child-git-remote'},
    {cwd:foreignRoot,gitDir:path.join(foreignRoot,'no-es-un-repo'),args:exact,expected:'child-git-remote'},
    {cwd:fixtureRoot,gitDir:path.join(fixtureRoot,'no-es-un-repo'),args:[...exact,'--prune'],expected:'child-git-remote'},
    {cwd:fixtureRoot,gitDir:fixtureRoot,args:exact,expected:'child-git-remote'},
  ];
  for(const scenario of cases){
    assert.throws(()=>spawnSync('git',scenario.args,{cwd:scenario.cwd,env:{...env,GIT_DIR:scenario.gitDir}}),error=>error.code==='DTD_OFFLINE_DENIED');
    const entries=fs.readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.equal(entries.at(-1).kind,scenario.expected);
  }
  fs.copyFileSync(log,path.join(qa,'ads-git-classification-controls.jsonl'));fs.writeFileSync(log,'');
}
for(const method of ['GET','CONNECT'])await new Promise((resolve,reject)=>{
  const request=http.request({hostname:'127.0.0.1',port:fixture.address().port,method,path:method==='GET'?'https://proxy-probe.invalid/no-payload':'proxy-probe.invalid:443'},response=>{response.resume();response.on('end',resolve);});
  request.on('connect',(_response,socket)=>{socket.destroy();resolve();});request.on('error',reject);request.end();
});
assert.deepEqual(proxyAttempts,[{host:'proxy-probe.invalid',type:'proxy-http'},{host:'proxy-probe.invalid',type:'proxy-connect'}]);
fs.writeFileSync(path.join(qa,`ads-proxy-negative-${mode}.json`),JSON.stringify(proxyAttempts,null,2));proxyAttempts.length=0;
const children=[];const output=fs.createWriteStream(path.join(qa,`ads-${mode}.log`));
const run=async(args,{cwd=root,extra={}}={})=>{const child=spawn(process.execPath,args,{cwd,env:{...env,...extra},stdio:['ignore','pipe','pipe']});children.push(child);for(const channel of[child.stdout,child.stderr])channel.on('data',chunk=>{output.write(chunk);if(mode!=='verify'||/\[(OK|FAIL|SKIP)\]|RESUMEN|resumen|CRÍTIC/.test(chunk.toString()))process.stdout.write(chunk);});return await new Promise(resolve=>child.on('exit',code=>resolve(code??1)));};
const start=async(directory,port,extra={})=>{const occupied=http.createServer();await new Promise((resolve,reject)=>{occupied.once('error',reject);occupied.listen(port,'127.0.0.1',resolve);});await new Promise(resolve=>occupied.close(resolve));const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start',directory,'--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...env,...extra},stdio:['ignore','pipe','pipe']});children.push(child);child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});const began=Date.now();while(true){if(child.exitCode!==null)throw new Error('Servidor terminó antes de arrancar');try{if((await fetch(`http://127.0.0.1:${port}/`)).ok)break;}catch{}if(Date.now()-began>120000)throw new Error('Timeout arranque local');await new Promise(resolve=>setTimeout(resolve,250));}};
let code=0;const tsconfig=fs.readFileSync(path.join(root,'tsconfig.json'));
try{
  if(mode==='unit')code=await run(['node_modules/vitest/vitest.mjs','run','components/Analytics.test.tsx','__tests__/analytics.test.ts','components/Analytics.consent-cookie.test.tsx','components/Analytics.respaldo-ga.test.tsx','components/Analytics.apagado.test.tsx','components/Analytics.apagado-build.test.ts','components/CookieConsentBanner.test.tsx','lib/runtime/__tests__/next-config.test.ts']);
  else if(mode==='ledger')code=await run(['node_modules/vitest/vitest.mjs','run','scripts/check-migrations-applied.test.mjs']);
  else if(mode==='verify')code=await run(['scripts/verify.mjs']);
  else if(mode!=='guard'){
    if(mode==='e2e'||mode==='recheck'){
      if(mode==='e2e'){code=await run(['node_modules/next/dist/bin/next','build'],{extra:{VERIFY_DIST_DIR:'.codex/qa/ads-release'}});if(code)throw new Error('Build release falló');}
      fs.writeFileSync(path.join(root,'tsconfig.json'),tsconfig);
      await start(root,45811,{VERIFY_DIST_DIR:'.codex/qa/ads-release'});
    }
    const loadConfig=require('next/dist/server/config').default;
    const config=await loadConfig('phase-production-build',root);const headers=await config.headers();
    const dir=path.join(qa,'ads-fixture');
    if(mode==='recheck'){
      const hashes=JSON.parse(fs.readFileSync(path.join(qa,'ads-fixture-sources.json'),'utf8'));for(const entry of hashes)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,entry.file))).digest('hex'),entry.sha256,'Recheck requiere fuentes idénticas a fixture construida');
      assert(fs.existsSync(path.join(root,'.codex/qa/ads-release/BUILD_ID')));assert(fs.existsSync(path.join(dir,'.next/BUILD_ID')));
    }else{
      const hashes=createFixture(root,dir,headers);fs.writeFileSync(path.join(qa,'ads-fixture-sources.json'),JSON.stringify(hashes,null,2));
      code=await run([path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:dir,extra:{NEXT_PUBLIC_GA_ID:'G-SYNTHETIC0581'}});if(code)throw new Error('Build fixture falló');
    }
    await start(dir,45812,{NEXT_PUBLIC_GA_ID:'G-SYNTHETIC0581'});
    const args=['node_modules/@playwright/test/cli.js','test','--config','playwright.analytics-csp-offline.config.ts'];if(mode==='probe')args.push('--grep','cookie exacta');
    code=await run(args);
  }
  const denied=fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  if(denied.some(entry=>entry.kind!=='child-git-disabled-fixture')||proxyAttempts.length)throw new Error('Hubo intento remoto inesperado bloqueado; ver log de hosts/tipos/PID');
}catch(error){console.error(error);code=1;}finally{
  fs.writeFileSync(path.join(root,'tsconfig.json'),tsconfig);
  for(const child of children)if(child.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});else child.kill('SIGTERM');}
  await new Promise(resolve=>fixture.close(resolve));output.end();
  fs.writeFileSync(path.join(qa,`ads-proxy-${mode}.json`),JSON.stringify(proxyAttempts,null,2));
}
const denied=fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
console.log(JSON.stringify({mode,code,negativeProbes:probes.length,expectedDeniedFixture:denied.filter(entry=>entry.kind==='child-git-disabled-fixture').length,unexpectedNodeEgress:denied.filter(entry=>entry.kind!=='child-git-disabled-fixture').length}));process.exitCode=code;
