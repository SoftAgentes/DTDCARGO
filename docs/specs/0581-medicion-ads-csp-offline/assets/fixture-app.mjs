/** Genera una app Next mínima ignorada: fuentes del producto sin modificar. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createFixture(root, directory, headers) {
  const write = (file, content) => { const target=path.join(directory,file); fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content); };
  const hashes=[];
  for (const file of ['components/Analytics.tsx','components/CookieConsentBanner.tsx','lib/cookie-consent.ts']) {
    const bytes=fs.readFileSync(path.join(root,file));write(file,bytes);
    hashes.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  write('package.json',JSON.stringify({name:'dtd-0581-synthetic-fixture',private:true,dependencies:{next:'16.2.11',react:'19.2.4','react-dom':'19.2.4'}},null,2));
  write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',lib:['dom','dom.iterable','esnext'],allowJs:false,skipLibCheck:true,strict:true,noEmit:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'react-jsx',plugins:[{name:'next'}],paths:{'@/*':['./*']}},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']},null,2));
  write('next.config.mjs',`export default {async headers(){return ${JSON.stringify(headers)};}};\n`);
  write('app/layout.tsx',`import {Analytics} from '@/components/Analytics';import {CookieConsentBanner} from '@/components/CookieConsentBanner';export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body><Analytics/>{children}<CookieConsentBanner/></body></html>}`);
  write('app/[[...slug]]/page.tsx',`"use client";
import Link from 'next/link';import {useEffect} from 'react';import {usePathname} from 'next/navigation';
import {trackLead,trackWhatsAppConversion} from '@/components/Analytics';import {readCookieConsent,OPEN_COOKIE_PREFS_EVENT} from '@/lib/cookie-consent';
export default function Page(){const pathname=usePathname();useEffect(()=>{Object.assign(window,{__fixtureReady:true,__readFixtureConsent:readCookieConsent});},[]);return <main><h1>Fixture sintética {pathname}</h1><Link prefetch={false} href="/servicios?utm_source=synthetic" id="public-link">Público</Link><Link prefetch={false} href="/portal" id="private-link">Privado</Link><Link prefetch={false} href="/faq" id="faq-link">FAQ</Link><a id="whatsapp-link" href="https://wa.me/000000000000">WhatsApp sintético</a><button id="helper-whatsapp" onClick={()=>trackWhatsAppConversion('/synthetic')}>Helper WhatsApp</button><button id="lead" onClick={()=>trackLead('contacto')}>Lead sintético</button><button id="prefs" onClick={()=>window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT))}>Preferencias</button></main>}`);
  return hashes;
}
