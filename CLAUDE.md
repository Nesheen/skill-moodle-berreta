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

### 🔴 Incidente 2026-08-21 — regla que nació de un error real

La primera versión de `_probar-dom.js` volcó **~174 direcciones de mail de aspirantes**
a la terminal y a `datos/dom-sonda.json`. Causa: indexó la columna de la tabla de
participantes por POSICIÓN (`td.c3`), asumiendo que era "Roles"; en este campus `c3` es
**Email**. El archivo se purgó el mismo día.

**Reglas que quedan de eso, y que valen para todo script nuevo de esta celda:**

1. **Nunca indexar columnas por posición.** Buscar la columna por su encabezado y
   alinear por la clase `cN` que Moodle repite en `th` y `td`.
2. **Lista blanca al recolectar.** Si un valor parece un identificador personal
   (tiene `@`, o 6+ dígitos seguidos), se descarta aunque el selector lo haya traído.
3. **Contar, no listar.** Para diagnóstico alcanza con "19 estudiantes"; no hace falta
   saber quiénes. Las identidades se leen sólo cuando la tarea concreta las necesita.

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
- Login por formulario: `#username` / `#password` / `#loginbtn`
  (verificado 2026-08-21: mismos ids que el resto de los campus UTN).

### 🔑 Cómo se entra: login MANUAL, no contraseña guardada

```bash
node scripts/login-manual.js      # abre el navegador, logueás vos, guarda la sesión
```

**`CVI_PASSWORD` está VACÍA a propósito.** Descubierto el 2026-08-21:
`campusingresantes` es un Moodle **separado** de `campusvirtual.frm` — otra base de
usuarios. La credencial `45964927` es válida en `campusvirtual.frm` pero **no** acá,
así que dejarla en el `.env` sólo servía para quemar intentos hacia el bloqueo de
cuenta (Moodle bloquea a los ~10 fallidos).

El camino manual además es mejor: la contraseña no queda en ningún archivo de la
celda, y sigue funcionando si el campus mete captcha o doble factor. Sólo se persiste
la cookie en `.auth/cvi-state.json`, que está en `.gitignore`.

La sesión vence (unas horas de inactividad). Cuando eso pase, los scripts avisan y se
vuelve a correr `login-manual.js`. Verificado funcionando el 2026-08-21 como
**Neyén Bianchi Medina**.

### Cursos / aulas

Relevado el **2026-08-21** con `scripts/explorar.js` (fuente: `datos/exploracion.json`).

| Aula | course_id | Mi rol | Contenido visto |
| --- | :-: | --- | --- |
| **Pre TUP 2027 - Marzo** | **589** | docente | 2 tareas · 0 cuestionarios · 3 foros |

- Es el **único** curso visible para mi usuario en este campus.
- Ojo con el nombre: es el pre de la **TUPAD**, pero vive en el campus de **ingresantes
  de FRM**. Que diga "TUP" no lo convierte en el campus `tup.sied` — son sitios distintos
  y no comparten ni cuentas ni sesión.
- URL: https://campusingresantes.frm.utn.edu.ar/course/view.php?id=589
- **174 participantes** (dato declarado por Moodle, 20 por página).

### ⚠ Mi rol es "Profesor sin permiso de edición"

Relevado el 2026-08-21. **No puedo modificar el aula aunque quisiera**: no hay permiso de
edición sobre actividades ni recursos. Lo que sí puedo: ver todo, ver entregas, calificar
y usar los foros y la mensajería.

Esto encaja con el modo de trabajo de la celda (lectura por defecto), pero hay que tenerlo
presente: si una auditoría detecta algo mal armado, la salida es **reportarlo**, no
arreglarlo. No hay opción de arreglarlo.

### Estructura del aula 589 (relevada 2026-08-21)

Detalle completo con todos los `cmid` en `datos/dom-sonda.json`.

**5 unidades**, cada una con el mismo molde:

| # | Unidad | Foro de consultas |
| - | --- | :-: |
| 1 | Estructuras Secuenciales | 4841 |
| 2 | Estructuras Condicionales | 4842 |
| 3 | Estructuras Repetitivas | 4843 |
| 4 | Listas | 4844 |
| 5 | Funciones | 4742 |

Molde por unidad: `Actividades` (apuntes/ipynb + 3-4 cuestionarios) → `Práctica` (TP +
**entrega `assign`** + resolución + repaso) → `Microteaching` (video + PDF + ejercicios)
→ `Autoevaluación` (cuestionario) → `Encuesta de cierre` (feedback).

**Las entregas que se corrigen** (`assign`), que es el corazón del laburo:

| Unidad | Actividad de cierre | cmid |
| :-: | --- | :-: |
| 1 | Estructuras Secuenciales | **4660** |
| 2 | Estructuras Condicionales | **4688** |
| 3 | Estructuras Repetitivas | **4712** |
| 4 | Listas | **4734** |
| 5 | Funciones | **4755** |
| — | **Entrega Examen de Ingreso** | **4765** |
| — | Extensión Ejercicio Nivelatorio | **4764** |

Secciones generales: `PREUNIVERSITARIO - General` (avisos 4840, punto de partida 4839,
encuesta inicial 4639, normas de foros 4644), `Evaluaciones` (consigna 4762, foro de
consultas 4763), `Entrenamiento`, `Encuentros Sincrónicos` (vacía) y `Tutor Socrático`
(foro 4845).

💡 **Ojo al dato:** el molde es prácticamente el mismo que el del "patrón de oro" de
Programación 1 de TUPAD (unidad → PDF → cuestionario → práctica → autoevaluación →
encuesta de cierre → foro). Si alguna vez hay que auditar esta aula, la vara ya existe.

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
node scripts/login-manual.js   # ← EL QUE SE USA: logueás vos, guarda la sesión
node scripts/login.js          # login automático (sólo si algún día hay clave en .env)
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
│   ├── _campus.js        ← motor: destino, login, sesión, capturas
│   ├── login-manual.js   ← ENTRADA HABITUAL: logueás vos, persiste la cookie
│   ├── login.js          ← login automático (requiere clave en .env)
│   └── explorar.js       ← reconocimiento del campus (SOLO LECTURA)
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
