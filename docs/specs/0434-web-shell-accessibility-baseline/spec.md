---
sdd: "0434"
title: Baseline web y accesibilidad de shells de entrada
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0001", "0276", "0323", "0433"]
confidencialidad: interno
---

# SDD-0434 · Baseline web y accesibilidad de shells de entrada

## Problema

No existía una medición Lighthouse reproducible de las cuatro superficies. La
primera baseline móvil encontró landmarks ausentes en Portal, Studio y móvil;
un skip link sin destino estático; controles enfocables dentro del drawer
cerrado; y contraste insuficiente en el footer y login de Studio.

## Contrato acotado

- Medir Lighthouse móvil en público, entrada Portal, login Studio y login móvil.
- Fijar y comparar budgets de transferencia, JavaScript, CSS, fuentes, imágenes
  above-fold y terceros por superficie.
- Incorporar landmarks estáticos y un destino real para el skip link.
- Volver inerte el drawer móvil mientras está cerrado.
- Elevar texto secundario con tokens/clases existentes hasta contraste AA.
- Mantener navegación, autenticación, tracking, diseño y copy.

## Fuera de alcance

- Habilitar o retirar Google Ads/Analytics o ampliar CSP.
- Optimizar bundles/CSS/fuentes en este mismo corte.
- INP/CrUX, sesiones o datos reales.
- Cloud, migraciones, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `app/page.tsx`.
- `app/entrar/EntrarForm.tsx`.
- `app/studio/(auth)/login/LoginForm.tsx`.
- `app/m/ve/login/page.tsx`.
- `components/Nav.tsx`.
- `components/Footer.tsx`.
- Contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma landmarks, destino, drawer y contraste incompletos.
- [x] Portal, Studio y móvil exponen un `main` único.
- [x] La home tiene `main-content` desde SSR y el drawer cerrado es inerte.
- [x] El texto corregido alcanza AA con tokens/clases existentes.
- [x] Baseline y budgets quedan documentados por superficie.
- [x] Lighthouse posterior confirma las correcciones accesibles.
- [x] Contratos, suite y gates canónicos quedan verdes.

## Gobernanza

- `A11Y-01`: cumplimiento parcial medido; landmarks, foco y contraste del
  alcance se corrigen, residuos externos quedan explícitos.
- `VIS-01`: cumplimiento; sin nuevos colores, tamaños ni roles visuales.
- `SGE-00.05`: cumplimiento; evidencia versionada y reproducible.
