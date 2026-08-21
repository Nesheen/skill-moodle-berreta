# Celda: Pre Universitario — UTN FRM (Campus Ingresantes)

> Este archivo es el CONTEXTO de la celda. El agente lo lee al arrancar.
> Acá va todo lo que NO es secreto. Los secretos (contraseñas) van en `.env`.

## Quién soy y qué es esta celda

- Rol: docente/tutor del **Pre Universitario de la UTN Facultad Regional Mendoza**.
- **Esta celda es SOLO del pre universitario de FRM.** No tiene nada que ver con TUPAD:
  otra institución, otro campus, otras credenciales, otro repo. Las celdas de TUPAD viven
  en `../../tupad/` y no se mezclan.
- Objetivo de la celda:
  - **Ver y responder mensajes** de los aspirantes.
  - **Corregir entregas** (nota + devolución).
  - **Seguimiento de aspirantes**: quién entregó y quién no, quién se está quedando atrás.
  - **Auditar el aula**: cómo está armada, links rotos, materiales faltantes, fechas.

## ⚠ Los aspirantes del pre suelen ser MENORES DE EDAD

Es la diferencia más importante contra las celdas de TUPAD, y cambia cómo se maneja el dato:

- Nada de datos personales sale de esta carpeta. Ni a Drive, ni a un informe compartido,
  ni a un servicio externo, sin confirmación explícita y caso por caso.
- `datos/` y `evidencia/` están en `.gitignore`. **No se versionan nunca.**
- En informes: iniciales o id de Moodle, no nombre completo, salvo que yo pida lo contrario.
- Nada de mensajes masivos sin que yo lea el texto antes.

## Requisitos técnicos / Entorno

> Esta celda AUTOMATIZA el login y la navegación en el campus con un navegador manejado
> por código. Sin estas herramientas el agente NO puede "entrar". Requisito PERMANENTE.

- **Node.js**: requerido. Instalado con `scoop install nodejs`.
- **Playwright**: dependencia del proyecto (`package.json`), más los binarios
  (`npx playwright install chromium` si falta el navegador).
- El agente usa las credenciales del `.env` **por referencia**: Playwright las inyecta en
  runtime; nunca las lee, imprime ni versiona.

### ⚠ Por qué acá NO se puede usar la skill `tup-campus-navigator`

Verificado el **2026-08-21**, con evidencia:

| Campus | `enablewebservices` | `enablemobilewebservice` | `login/token.php` |
| --- | :-: | :-: | --- |
| `campusingresantes.frm.utn.edu.ar` | 0 | 0 | `enablewsdescription` |
| `campusvirtual.frm.utn.edu.ar` | 1 | 0 | `servicenotavailable` |
| `tup.sied.utn.edu.ar` (TUPAD) | 1 | 1 | emite token ✓ |

La skill de TUPAD **no está hardcodeada** (`MOODLE_URL` es env var y la tool `configurar`
acepta `moodle_url`), así que el código sí es portable. El bloqueo es del **servidor**:
FRM no tiene el servicio móvil habilitado, y sin token no hay API REST.
**Por eso acá el único canal es Playwright.**

Gotcha para el futuro: probar `login/token.php` con credenciales truchas devuelve
`invalidlogin` y parece que anduviera. Moodle valida la contraseña ANTES que el servicio.
Para saber de verdad, mirá `enablemobilewebservice` en `tool_mobile_get_public_config`.

## Contexto del campus

- URL: https://campusingresantes.frm.utn.edu.ar/login/index.php
- Nombre del sitio: **Campus Ingresantes** (título de página: `CVI`)
- Usuario: **SIN DATO — completar en `.env` → `CVI_USER`**
- Contraseña: `.env` → `CVI_PASSWORD`
- Login por formulario: `#username` / `#password` / `#loginbtn`
  (verificado 2026-08-21: mismos ids que el resto de los campus UTN).

### Cursos / aulas

**SIN DATO todavía.** Se completan corriendo `node scripts/explorar.js`, que descubre
los cursos visibles, el rol en cada uno y los ids reales. Cuando estén, se cargan acá
y en `CONOCIDAS` de `scripts/_campus.js`.

| Materia / aula | course_id | Mi rol |
| --- | :-: | --- |
| _(pendiente de exploración)_ | — | — |

**Regla dura: nunca escribir "el aula" a secas. Siempre campus + course_id.**
Es la lección que costó dos accidentes en la celda prog-4 por valores clavados.

## Modo de trabajo

- **Por defecto: SOLO LECTURA.**
  - Lectura libre: estructura del aula, materiales, enlaces, tareas, entregas, foros,
    libro de calificaciones, bandeja de mensajes, fechas.
  - **Escritura (requiere mi confirmación explícita, caso por caso):**
    - responder o enviar cualquier mensaje
    - cargar notas o devoluciones
    - cualquier modificación del aula
- No inventar: si falta el dato, decir **"sin dato"**. Ningún hallazgo sin evidencia.
- Ningún puntaje ni afirmación sobre un aspirante sin captura + URL que lo respalde.

## Cómo se corren los scripts

Los scripts leen el `.env` solos (via `dotenv`). No hace falta puente de variables:

```bash
node scripts/login.js          # valida credenciales y guarda la sesión
node scripts/explorar.js       # reconocimiento: cursos, rol, bandeja
node scripts/<x>.js --ver      # cualquiera, con navegador visible para depurar
```

Para apuntar a otro campus o curso sin tocar código:

```bash
M_BASE=https://otro.campus.edu.ar M_CURSO=12 node scripts/explorar.js
```

`scripts/_campus.js` reusa la sesión guardada en `.auth/cvi-state.json`, así que no le
pega al login del campus en cada corrida. Si la sesión venció, loguea de nuevo solo.

## Estructura de la celda

```
frm/pre/
├── CLAUDE.md          ← este contexto
├── STATUS.md          ← estado vivo: por dónde arrancar cada sesión
├── .env               ← secretos (NO versionar)
├── .env.example       ← plantilla del .env
├── package.json       ← Playwright + dotenv
├── scripts/
│   ├── _campus.js     ← motor: destino, login, sesión, capturas
│   ├── login.js       ← valida credenciales
│   └── explorar.js    ← reconocimiento del campus (SOLO LECTURA)
├── datos/             ← JSON de trabajo (NO versionar: datos de menores)
├── evidencia/         ← capturas AAAA-MM-DD_<tema>.png (NO versionar)
└── informes/          ← informes .md / .pdf
```

## Cómo quiero que hable el agente

- Tono: directo, profesional, español rioplatense (voseo). Conmigo puede ser informal.
- Con aspirantes (cuando yo autorice un mensaje): claro, amable y CORTO. Son chicos que
  recién llegan a la facultad y muchos están asustados. Nada de jerga interna.
- Qué NO hacer:
  - No enviar ni publicar nada sin mi confirmación.
  - No modificar el aula sin mi confirmación.
  - No sacar datos de aspirantes de esta carpeta.
  - No inventar: si falta el dato, "sin dato".

## Referencias

- Campus: https://campusingresantes.frm.utn.edu.ar/
- Estado actual del trabajo: `STATUS.md` ← **empezá acá**
- Celdas de TUPAD (otra institución, no mezclar): `../../tupad/`
