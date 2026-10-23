import {defineConfig} from '@playwright/test';

/** Servidores y barrera Node los prepara local-ads-check; cero tags remotos reales. */
export default defineConfig({
  testDir:'./e2e',testMatch:'analytics-csp-offline.spec.ts',workers:1,retries:0,
  timeout:60_000,outputDir:'.codex/qa/ads-playwright',reporter:[['list'],['json',{outputFile:'.codex/qa/ads-playwright.json'}]],
  use:{baseURL:'http://127.0.0.1:45811',serviceWorkers:'block',proxy:{server:process.env.DTD_ADS_PROXY!,bypass:'127.0.0.1,localhost,[::1]'}},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
});
