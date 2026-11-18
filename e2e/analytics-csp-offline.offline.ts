import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const active='http://127.0.0.1:45812';
const consentSignals=['ad_storage','ad_user_data','ad_personalization','analytics_storage'];
const cspProbeHosts=new Set(['www.googletagmanager.com','www.googleadservices.com','googleads.g.doubleclick.net','region1.google-analytics.com','region1.analytics.google.com','ad.doubleclick.net','www.google.com','pagead2.googlesyndication.com','arbitrary-probe.invalid']);
type Observation={host:string;type:string;action:string};
async function isolated(context:BrowserContext,{delay=0}:{delay?:number}={}){
  const unexpected:Observation[]=[];
  await context.routeWebSocket('**/*',socket=>{unexpected.push({host:new URL(socket.url()).hostname,type:'websocket',action:'closed'});socket.close();});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))return route.continue();
    if(url.hostname==='www.googletagmanager.com'&&url.pathname==='/gtag/js'){
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      return route.fulfill({contentType:'text/javascript',body:'window.__inertLoader=true;'});
    }
    if(url.pathname==='/synthetic-csp-probe'&&cspProbeHosts.has(url.hostname)&&['script','image','fetch','document'].includes(request.resourceType())){
      if(request.resourceType()==='script')return route.fulfill({contentType:'text/javascript',body:'window.__cspScriptProbe=true;'});
      if(request.resourceType()==='image')return route.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64')});
      return route.fulfill({contentType:'text/plain',headers:{'access-control-allow-origin':'*'},body:'synthetic'});
    }
    unexpected.push({host:url.hostname,type:request.resourceType(),action:'aborted'});return route.abort('blockedbyclient');
  });
  await context.addInitScript(()=>{Object.assign(window,{__violations:[]});document.addEventListener('securitypolicyviolation',event=>(window as unknown as {__violations:unknown[]}).__violations.push({directive:event.effectiveDirective,host:(()=>{try{return new URL(event.blockedURI).hostname;}catch{return event.blockedURI;}})()}));});
  // La navegación denegada puede confirmar chrome-error de forma tardía.
  // Se descarta la pestaña de la sonda para no interrumpir el primer goto real.
  const probe=await context.newPage();await probe.goto('https://browser-probe.invalid').catch(()=>{});await probe.close();
  expect(unexpected.splice(0)).toEqual([{host:'browser-probe.invalid',type:'document',action:'aborted'}]);
  context.on('page',page=>{if(context.pages().length>1){unexpected.push({host:'popup',type:'page',action:'closed'});void page.close();}});
  return unexpected;
}
async function ready(page:Page,path='/'){
  await page.goto(active+path);await page.waitForFunction(()=>(window as unknown as {__fixtureReady?:boolean}).__fixtureReady&&typeof window.gtag==='function');
  await page.waitForTimeout(100);
}
async function commands(page:Page){return page.evaluate(()=>window.dataLayer.map(value=>Array.from(value as ArrayLike<unknown>)));}

for(const scenario of[
  {name:'propia denied y ajena con prefijo granted',cookies:[['dtd_cookie_consent','denied'],['other_dtd_cookie_consent','granted']],expected:'denied'},
  {name:'solo ajena con prefijo granted',cookies:[['other_dtd_cookie_consent','granted']],expected:'denied'},
  {name:'propia granted válida',cookies:[['dtd_cookie_consent','granted']],expected:'granted'},
  {name:'propia granted con sufijo inválido',cookies:[['dtd_cookie_consent','granted-synthetic']],expected:'denied'},
  {name:'propia denied válida',cookies:[['dtd_cookie_consent','denied']],expected:'denied'},
  {name:'cookie ajena primero con espacios normales',cookies:[['other_dtd_cookie_consent','granted'],['dtd_cookie_consent','denied']],expected:'denied'},
] as const){test(`cookie exacta: ${scenario.name}`,async({page,context},testInfo)=>{
  const unexpected=await isolated(context);await context.addCookies(scenario.cookies.map(([name,value])=>({name,value,url:active})));
  await ready(page);const queue=await commands(page);const consent=queue.find(row=>row[0]==='consent'&&row[1]==='default')?.[2] as Record<string,unknown>;
  const parser=await page.evaluate(()=>(window as unknown as {__readFixtureConsent:()=>unknown}).__readFixtureConsent());
  await testInfo.attach('cookie-sintetica',{body:JSON.stringify({scenario:scenario.name,expected:scenario.expected,init:consent?.ad_storage,parser}),contentType:'application/json'});
  expect(unexpected).toEqual([]);for(const signal of consentSignals)expect(consent?.[signal]).toBe(scenario.expected);
});}

for(const values of [['granted','denied'],['granted','granted']])test(`cookie exacta: duplicadas visibles distintos paths ${values.join('/')}`,async({page,context})=>{
  const unexpected=await isolated(context);await context.addCookies(values.map((value,index)=>({name:'dtd_cookie_consent',value,domain:'127.0.0.1',path:index?'/servicios':'/'})));
  await ready(page,'/servicios');expect(await page.evaluate(()=>document.cookie.split(';').filter(part=>part.trim().startsWith('dtd_cookie_consent=')).length)).toBe(2);
  const queue=await commands(page),consent=queue.find(row=>row[0]==='consent'&&row[1]==='default')?.[2] as Record<string,unknown>;
  for(const signal of consentSignals)expect(consent[signal]).toBe('denied');
  expect(await page.evaluate(()=>(window as unknown as {__readFixtureConsent:()=>unknown}).__readFixtureConsent())).toBeNull();expect(unexpected).toEqual([]);
});

test('release real: headers públicos y apagado efectivo',async({page,context},testInfo)=>{
  test.skip(process.env.DTD_ADS_PHASE==='probe','Probe de cookie usa sólo fixture');
  const unexpected=await isolated(context);const response=await page.goto('http://127.0.0.1:45811/');expect(response?.status()).toBe(200);
  const csp=response?.headers()['content-security-policy']??'';expect(csp).not.toContain("'unsafe-eval'");expect(csp).toContain("object-src 'none'");expect(csp).toContain("base-uri 'self'");expect(csp).toContain("form-action 'self'");expect(csp).toContain("frame-ancestors 'none'");expect(csp).toContain('media-src');expect(csp).toContain('wss://*.supabase.co');
  const fixtureResponse=await page.request.get(active);expect(fixtureResponse.headers()['content-security-policy']).toBe(csp);
  const files:string[]=[];function walk(directory:string){for(const item of fs.readdirSync(directory,{withFileTypes:true})){const target=path.join(directory,item.name);if(item.isDirectory())walk(target);else if(item.name.endsWith('.js'))files.push(target);}}
  walk(path.resolve('.codex/qa/ads-release/static'));
  const counts={chunks:files.length,gaIdFiles:0,adsIdFiles:0};for(const file of files){const source=fs.readFileSync(file,'utf8');if(source.includes('G-25CD7BZH98'))counts.gaIdFiles++;if(source.includes('AW-561290482'))counts.adsIdFiles++;}
  expect(counts.gaIdFiles).toBe(0);expect(counts.adsIdFiles).toBe(0);await testInfo.attach('release-off-conteos',{body:JSON.stringify({...counts,cspFixtureMatchesRelease:true}),contentType:'application/json'});
  await page.waitForTimeout(400);expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);expect(await page.evaluate(()=>typeof window.gtag)).toBe('undefined');expect(unexpected).toEqual([]);
});

test('orden, loader tardío, consent y navegación pública/privada reales en fixture',async({page,context})=>{
  const unexpected=await isolated(context,{delay:800});await ready(page);let queue=await commands(page);
  const consent=queue.findIndex(row=>row[0]==='consent'&&row[1]==='default'),config=queue.findIndex(row=>row[0]==='config');expect(consent).toBeGreaterThanOrEqual(0);expect(consent).toBeLessThan(config);
  expect(queue.filter(row=>row[0]==='event'&&row[1]==='page_view')).toHaveLength(1);
  await page.waitForFunction(()=>(window as unknown as {__inertLoader?:boolean}).__inertLoader);
  await page.locator('#prefs').click();await page.getByRole('button',{name:'Aceptar',exact:true}).click();queue=await commands(page);expect(queue.filter(row=>row[0]==='consent'&&row[1]==='update').at(-1)?.[2]).toEqual(Object.fromEntries(consentSignals.map(key=>[key,'granted'])));
  await page.locator('#prefs').click();await page.getByRole('button',{name:'Rechazar',exact:true}).click();queue=await commands(page);expect(queue.filter(row=>row[0]==='consent'&&row[1]==='update').at(-1)?.[2]).toEqual(Object.fromEntries(consentSignals.map(key=>[key,'denied'])));
  await page.locator('#public-link').click();await expect(page).toHaveURL(/servicios\?utm_source=synthetic/);await page.waitForTimeout(150);queue=await commands(page);expect(queue.filter(row=>row[0]==='event'&&row[1]==='page_view')).toHaveLength(2);
  await page.evaluate(()=>document.addEventListener('click',event=>{if((event.target as Element)?.closest('#whatsapp-link'))event.preventDefault();}));
  await page.locator('#whatsapp-link').click();await page.locator('#lead').click();queue=await commands(page);expect(queue.filter(row=>row[0]==='event'&&row[1]==='conversion')).toHaveLength(1);expect(queue.filter(row=>row[0]==='event'&&row[1]==='whatsapp_click')).toHaveLength(1);expect(queue.filter(row=>row[0]==='event'&&row[1]==='generate_lead')).toHaveLength(1);
  await page.locator('#private-link').click();await expect(page).toHaveURL(/\/portal$/);await page.waitForTimeout(100);const before=await commands(page);await page.locator('#helper-whatsapp').click();await page.locator('#lead').click();expect(await commands(page)).toEqual(before);
  await page.locator('#faq-link').click();await expect(page).toHaveURL(/\/faq$/);await page.waitForTimeout(150);queue=await commands(page);expect(queue.filter(row=>row[0]==='event'&&row[1]==='page_view')).toHaveLength(3);expect(unexpected).toEqual([]);
});

for(const path of ['/portal','/abrir?token_hash=SYNTHETIC&type=magiclink','/servicios?email=SYNTHETIC','/servicios#access_token=SYNTHETIC'])test(`inicio excluido sin carga ni señales ${path}`,async({page,context})=>{
  const unexpected=await isolated(context);await page.goto(active+path);await page.waitForFunction(()=>(window as unknown as {__fixtureReady?:boolean}).__fixtureReady);
  expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);expect(await page.evaluate(()=>typeof window.gtag)).toBe('undefined');await page.locator('#helper-whatsapp').click();await page.locator('#lead').click();expect(await page.evaluate(()=>window.dataLayer??[])).toEqual([]);expect(unexpected).toEqual([]);
});

test('SPA: query y fragmento sensibles cierran señales antes del cambio',async({page,context})=>{
  const unexpected=await isolated(context);await ready(page);const initial=await commands(page);
  for(const path of ['/servicios?email=SYNTHETIC','/servicios#access_token=SYNTHETIC']){
    await page.evaluate(path=>history.pushState({},'',path),path);await page.waitForTimeout(120);await page.locator('#helper-whatsapp').click();await page.locator('#lead').click();expect(await commands(page)).toEqual(initial);
  }
  expect(unexpected).toEqual([]);
});

test('CSP: recursos clásicos permitidos y capacidades adicionales restringidas',async({page,context},testInfo)=>{
  const unexpected=await isolated(context);await ready(page);
  const observations=await page.evaluate(async()=>{
    const checks:Array<{type:string;host:string;allowed:boolean}>=[];
    async function probe(type:string,host:string){
      const url=`https://${host}/synthetic-csp-probe`;let allowed=false;
      if(type==='connect'){try{allowed=(await fetch(url)).ok;}catch{}}
      else allowed=await new Promise<boolean>(resolve=>{
        const el=type==='script'?document.createElement('script'):document.createElement('img');
        el.onload=()=>{el.remove();resolve(true);};el.onerror=()=>{el.remove();resolve(false);};el.src=url;document.body.append(el);
      });
      checks.push({type,host,allowed});
    }
    for(const host of ['www.googletagmanager.com','www.googleadservices.com','googleads.g.doubleclick.net'])await probe('script',host);
    for(const host of ['region1.google-analytics.com','region1.analytics.google.com','www.googleadservices.com','googleads.g.doubleclick.net','ad.doubleclick.net','www.google.com'])await probe('connect',host);
    for(const host of ['region1.google-analytics.com','www.googleadservices.com','googleads.g.doubleclick.net','ad.doubleclick.net','www.google.com'])await probe('image',host);
    await probe('script','www.google.com');await probe('connect','pagead2.googlesyndication.com');await probe('image','pagead2.googlesyndication.com');await probe('script','arbitrary-probe.invalid');
    const frame=document.createElement('iframe');frame.src='https://www.googletagmanager.com/synthetic-csp-probe';document.body.append(frame);await new Promise(resolve=>setTimeout(resolve,200));frame.remove();
    return {checks,violations:(window as unknown as {__violations:Array<{directive:string;host:string}>}).__violations};
  });
  await testInfo.attach('compatibilidad-csp-sintetica',{body:JSON.stringify(observations),contentType:'application/json'});
  expect(observations.checks.slice(0,14).every(row=>row.allowed)).toBe(true);expect(observations.checks.slice(14).every(row=>!row.allowed)).toBe(true);
  expect(observations.violations).toEqual(expect.arrayContaining([{directive:'frame-src',host:'www.googletagmanager.com'},{directive:'script-src-elem',host:'www.google.com'},{directive:'connect-src',host:'pagead2.googlesyndication.com'},{directive:'img-src',host:'pagead2.googlesyndication.com'}]));
  expect(unexpected).toEqual([]);
});
