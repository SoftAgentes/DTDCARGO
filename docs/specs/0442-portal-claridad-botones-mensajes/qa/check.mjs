import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const base = "http://127.0.0.1:4312/docs/specs/0442-portal-claridad-botones-mensajes/qa/index.html";
const out = "docs/specs/0442-portal-claridad-botones-mensajes/assets";
fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch({channel:"msedge",headless:true});
const results=[];
for (const [size,width,height] of [["desktop",1440,1000],["mobile",390,844]]) {
 for (const theme of ["light","dark"]) {
  const page=await browser.newPage({viewport:{width,height}}); const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${base}?theme=${theme}`); await page.evaluate(async()=>{await document.fonts.load('14px "JetBrains Mono"'); await document.fonts.ready;});
  const button=page.getByRole("button",{name:/documentos de DTD-TEST-1/});
  await button.focus();await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded","true");
  await expect(page.getByText("Pendiente",{exact:true})).toHaveCount(3);
  const metrics=await button.evaluate(el=>{
   const cs=getComputedStyle(el);return {width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,focus:cs.outlineStyle,color:cs.color};
  });
  expect(metrics.height).toBeGreaterThanOrEqual(44);
  expect(metrics.focus).not.toBe("none");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({path:`${out}/${size}-${theme}.png`,fullPage:true});
  const colors=await page.evaluate(()=>{
   const s=getComputedStyle(document.documentElement);
   return Object.fromEntries(["ink","grey-700","paper","white","wine","on-accent"].map(k=>[k,s.getPropertyValue("--color-"+k).trim()]));
  });
  results.push({size,theme,metrics,overflow,colors,fonts:await page.evaluate(()=>({archivo:document.fonts.check('14px Archivo'),mono:document.fonts.check('14px "JetBrains Mono"')})),errors});
  await page.keyboard.press("Space");await expect(button).toHaveAttribute("aria-expanded","false");
  for(const view of ["suppliers","documents"]){
   await page.goto(`${base}?theme=${theme}&page=${view}`);
   await page.evaluate(async()=>{await document.fonts.load('14px "JetBrains Mono"'); await document.fonts.ready;});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   results.push({size,theme,view,overflow});expect(overflow).toBe(false);
   if(view==="suppliers") {
    const help=page.locator("summary");await help.focus();await page.keyboard.press("Enter");
    await expect(page.locator("details")).toHaveAttribute("open","");
   }
  }
  await page.close();
 }
}
console.log(JSON.stringify(results,null,2));await browser.close();
