# Guía de contribución

Gracias por contribuir a **payments-lab-api-service**. Esta guía explica cómo
proponer cambios mediante **Pull Requests** y qué se espera de cada
contribución.

## Flujo de trabajo

1. Haz fork (o crea una rama) y parte siempre desde `main`.
2. Trabaja en **TDD**: test que falla (RED) → implementación mínima (GREEN) → refactor.
3. Antes de subir, deja en verde `pnpm lint` y `pnpm test:coverage` (cobertura ≥ 95 %).
4. Haz commits con [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat: ...`, `fix(payments): ...`, `test: ...`, `docs: ...`).

## Convención de ramas

Usa un prefijo según el tipo de cambio:

- `feat/<descripcion-corta>`: nueva funcionalidad
- `fix/<descripcion-corta>`: corrección de errores
- `chore/<descripcion-corta>`: mantenimiento/tooling
- `docs/<descripcion-corta>`: documentación

## Pull Requests

### Antes de abrir el PR

- [ ] La rama parte de `main` y está actualizada con los últimos cambios.
- [ ] `pnpm lint` y `pnpm test:coverage` (≥ 95 %) en verde **localmente**.
- [ ] `pnpm test:e2e` en verde si el cambio toca stock, checkout o pagos (requiere MariaDB local).
- [ ] Tests añadidos o actualizados para el cambio.
- [ ] `CHANGELOG.md` actualizado en `[Unreleased]` si el cambio es relevante.

### Cómo abrirlo

- Dirige el PR contra `main`.
- **Título del PR** siguiendo Conventional Commits (p. ej. `feat(oneclick): soporta reintento de inscripción`).
- **Un PR por objetivo**: mantenlo pequeño y enfocado; es más fácil de revisar y mergear.
- Vincula los issues relacionados con `Closes #<id>` en la descripción.

### Plantilla de descripción

```markdown
## Qué
Resumen de lo que cambia.

## Por qué
Contexto / problema que resuelve.

## Cómo probarlo
Pasos para validarlo localmente (comandos, endpoints, datos de ejemplo).

## Checklist
- [ ] Tests añadidos/actualizados
- [ ] Cobertura ≥ 95 %
- [ ] Lint en verde
- [ ] Documentación / CHANGELOG actualizados (si aplica)
```

### Verificaciones automáticas

Cada commit dispara los git hooks (Husky):

- **pre-commit:** `lint-staged` (ESLint + Prettier) y la suite de tests con
  cobertura; **bloquea el commit** si fallan los tests o la cobertura baja
  del 95 %.
- **commit-msg:** `commitlint` valida el formato Conventional Commits.

Se recomienda ejecutar estas mismas comprobaciones en CI antes de permitir el merge.

### Revisión y merge

- El PR necesita al menos **una aprobación** y todas las verificaciones en verde.
- Atiende los comentarios de la revisión; evita reescribir la historia (force-push) una
  vez iniciada la revisión, salvo acuerdo con quien revisa.
- Se prefiere **squash & merge**, conservando un título con formato Conventional Commits.

## Estándares de código

- Todo símbolo exportado o no trivial se documenta con **JSDoc** (`@param`, `@returns`,
  `@throws`), describiendo el contrato y no lo evidente.
- **Inyección por constructor** siempre; servicios enfocados (SRP).
- Lanza **excepciones HTTP de NestJS** y deja que el exception filter global las normalice.
- Agregar un proveedor de pago nuevo no debe tocar código existente; ver
  "Cómo agregar un proveedor de pago nuevo" en `docs/architecture.md`.
