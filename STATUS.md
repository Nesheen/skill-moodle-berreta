# STATUS — Celda Pre Universitario FRM

> Estado vivo de la celda. **Empezá cada sesión leyendo esto.**
> Última actualización: **2026-08-21**

## Dónde estamos

Celda **recién creada**. El andamiaje está listo y las dependencias instaladas, pero
**todavía no entró al campus ni una sola vez**: faltan las credenciales.

## ⛔ Bloqueante — lo único que frena todo

**Falta el `.env` con el usuario y la contraseña del Campus Ingresantes.**

```bash
cp .env.example .env
# y completar CVI_USER y CVI_PASSWORD
```

Sin eso no corre nada. El `.env` no se versiona (está en `.gitignore`).

## Próximos pasos, en orden

1. **Completar el `.env`** (ver arriba).
2. **`node scripts/login.js`** — valida credenciales y guarda la sesión en `.auth/`.
   Si esto falla, no seguir: el problema es de credenciales o de acceso, no de código.
3. **`node scripts/explorar.js`** — reconocimiento. Deja `datos/exploracion.json` con
   los cursos, sus `course_id`, el rol en cada uno y la forma de la bandeja de mensajes.
4. **Cargar los datos reales** en `CLAUDE.md` (tabla de cursos) y en `CONOCIDAS` de
   `scripts/_campus.js`. A partir de acá la celda deja de estar a ciegas.
5. **Escribir los scrapers contra el DOM real** que devolvió el paso 3:
   - `leer-mensajes.js` — bandeja e hilos (lectura)
   - `listar-tareas.js` / `entregas-tarea.js` — qué hay para corregir
   - `seguimiento.js` — quién entregó y quién no, por unidad
   - `auditar-aula.js` — links rotos, faltantes, fechas
   - `responder-mensaje.js` y `cargar-nota.js` — **escritura, detrás de confirmación**

## Por qué los scrapers no están escritos todavía

A propósito. Escribir un scraper contra un DOM que nunca vi produce selectores
inventados que fallan en silencio. El paso 3 sale a buscar la realidad —cursos, ids,
estructura de la bandeja— y recién con eso en la mano se escribe el resto sin adivinar.

La bandeja de mensajes de Moodle es una app JS (message drawer), así que ahí en
particular hay que ver el DOM renderizado antes de tocar una línea.

## Decisiones tomadas

- **2026-08-21 — Playwright, no API REST.** Verificado que FRM no tiene el web service
  móvil habilitado (`enablemobilewebservice: 0` en los dos campus de Mendoza), así que
  la skill `tup-campus-navigator` no sirve acá aunque su código sí sea portable.
  Detalle y evidencia en `CLAUDE.md`.
- **2026-08-21 — Repo aparte.** La celda vive en `trabajo/frm/pre/` con su propio git,
  fuera del repo `tupad/`. Otra institución, otras credenciales, otro historial.
- **2026-08-21 — Datos de menores.** `datos/` y `evidencia/` nunca se versionan y nada
  personal sale de la carpeta sin confirmación explícita.

## Hallazgos abiertos

_(ninguno todavía — la celda no entró al campus)_
