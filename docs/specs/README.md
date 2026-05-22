# Specs — DTDCargo

SDD (Specification-Driven Development) propio de DTDCargo. **No mezclar con el SDD del ERP HailuWay** — este repo tiene su propio correlativo desde 0001.

## Regla

No hay código sin spec aprobada.

## Estados

```
draft → proposed → approved → in-progress → done → superseded
```

Una spec no puede pasar a `in-progress` sin estar `approved`.

## Estructura

```
docs/specs/
├── README.md
└── NNNN-slug-corto/
    └── spec.md
```

`NNNN` es el siguiente correlativo (0001, 0002, …). Slug en `kebab-case`, corto.

## Commits

Cada PR referencia su spec:

```
feat(DTD-0001): scaffold inicial Next.js + branding
```
