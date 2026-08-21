# skill moodle berreta

Herramientas de Playwright para operar un campus Moodle **desde el navegador**, cuando
la API REST no está disponible.

Nació como versión reducida de una skill que habla con Moodle por web services. Ese
camino no servía acá: el campus de destino tiene los servicios web apagados
(`enablewebservices: 0`), así que no hay token y no hay API. Sin API, queda el navegador.
De ahí lo de **berreta** — hace menos cosas, pero entra donde la otra no.

## Para qué sirve

Sobre el aula configurada:

- **Entrar** sin guardar la contraseña en ningún archivo.
- **Relevar** la estructura: secciones, actividades y sus `cmid`.
- **Ver el estado de las entregas**: cuántos enviaron, cuántos faltan calificar.
- **Armar la cola de corrección**: quién entregó y no tiene nota, con link directo
  al calificador.

## Requisitos

- Node.js
- `npm install` (Playwright + dotenv)
- `npx playwright install chromium` si falta el navegador

## Cómo se usa

```bash
cp .env.example .env        # completar CVI_USER (la contraseña puede quedar vacía)

node scripts/login-manual.js    # abre el navegador, logueás vos, guarda la sesión
node scripts/explorar.js        # qué cursos hay, con qué rol
node scripts/entregas-tarea.js  # estado de las entregas
node scripts/pendientes-corregir.js   # cola de corrección
```

Cualquier script acepta `--ver` para mostrar el navegador y depurar.

Para apuntar a otro campus o curso sin tocar código:

```bash
M_BASE=https://otro.campus.edu.ar M_CURSO=12 node scripts/explorar.js
```

## Login: por qué es manual

`login-manual.js` abre el navegador, esperás a que te loguees vos, y guarda **sólo la
cookie** en `.auth/`. La contraseña no queda en ningún archivo del repo.

Además de ser más seguro, es más robusto: funciona igual si el campus mete captcha,
doble factor o SSO. Y evita el riesgo de bloqueo de cuenta por reintentos, que Moodle
dispara a los ~10 intentos fallidos.

## Datos personales

Este repo toca un aula con estudiantes reales, varios de ellos **menores de edad**.
Por eso:

- `.env`, `.auth/`, `datos/` y `evidencia/` están en `.gitignore` y **no se versionan**.
- Los scripts de diagnóstico **cuentan, no listan**: informan "19 estudiantes", no quiénes.
- Las columnas de **DNI** y **email** de las tablas de Moodle están excluidas por lista
  negra explícita, con una guardia final que descarta cualquier valor con `@` o 6+ dígitos.

Esa última regla salió de un incidente real: un script leyó una columna por posición
asumiendo que era "Roles", resultó ser "Email", y volcó ~174 direcciones. Está
documentado en `CLAUDE.md`.

## Los gotchas de Moodle que costaron caro

Todos verificados a los golpes y comentados en el código. El patrón común: **ninguno
hace explotar el script, todos devuelven un número creíble y equivocado.**

| Trampa | Qué pasa |
| --- | --- |
| `perpage=N` | No agranda la grilla de calificación: Moodle la maneja por preferencia de usuario. Hay que paginar con `&page=N`. |
| Quedarse sin tabla | Es el **final de la paginación**, no un error. Tratarlo como falla descarta todo lo ya recolectado. |
| `filter=require_grading` | No es válido, y Moodle **lo guarda como preferencia**: deja la grilla vacía en todas las visitas siguientes. Se limpia mandando `filter=` vacío. |
| La nota | Puede ser una **escala** ("Supera lo esperado"), no un número. Lo pendiente se deduce de la columna **Estado**. |
| "Enviados" vs "Entregados" | El resumen rotula **"Enviados"**. Buscar "Entregados" reporta 0 entregas habiendo 27. |
| `.catch(() => {})` en un `goto` | Un error tragado deja la página anterior cargada y el scraper evalúa el DOM equivocado. Nunca. |
| Columnas por posición | El orden cambia entre campus y versiones. Buscar por **encabezado** y alinear por la clase `cN` que Moodle repite en `th` y `td`. |

## Estructura

```
├── CLAUDE.md      contexto completo: campus, aula, reglas de trabajo
├── STATUS.md      estado vivo y hallazgos abiertos
├── scripts/
│   ├── _campus.js             motor: destino, login, sesión, capturas
│   ├── login-manual.js        entrada habitual
│   ├── login.js               login automático (requiere clave en .env)
│   ├── explorar.js            reconocimiento del campus
│   ├── _probar-dom.js         sonda fina del aula
│   ├── entregas-tarea.js      resumen de entregas
│   └── pendientes-corregir.js cola de corrección
├── datos/         JSON de trabajo (no se versiona)
├── evidencia/     capturas (no se versiona)
└── informes/
```

Todo lectura. Lo que escribe en el campus va detrás de confirmación explícita.
