# STATUS — Celda Pre Universitario FRM

> Estado vivo de la celda. **Empezá cada sesión leyendo esto.**
> Última actualización: **2026-08-21**

## Dónde estamos

Celda **operativa**. Entra al campus, reconoció el aula y tiene el mapa completo de
actividades con sus `cmid`. Falta escribir las herramientas de uso diario.

- Aula: **CVI 589 — Pre TUP 2027 - Marzo**, 174 participantes (165 estudiantes).
- **La cohorte arrancó el 19-ago-2026.** Dato clave para leer cualquier número de
  participación: al 21-ago llevaba DOS días. Sin esta fecha, las curvas engañan.
- Mi rol: **Profesor sin permiso de edición** (puedo ver y calificar, NO editar el aula).
- Acceso: **login manual** (`node scripts/login-manual.js`). La sesión vive en
  `.auth/cvi-state.json` y vence tras unas horas de inactividad.

## Cómo arrancar una sesión

```bash
cd C:/Users/LENOVO/Documents/trabajo/frm/pre
node scripts/login-manual.js    # si la sesión venció (los scripts avisan)
```

## Lo que ya funciona

| Script | Qué hace | Estado |
| --- | --- | :-: |
| `_campus.js` | motor: destino, login, sesión, capturas | ✅ |
| `login-manual.js` | logueás vos, persiste la cookie | ✅ probado |
| `login.js` | login automático (necesita clave en .env) | ⚠ sin uso |
| `explorar.js` | descubre cursos, rol y bandeja | ✅ probado |
| `_probar-dom.js` | sonda fina del aula + anatomía de mensajería | ✅ probado |
| `entregas-tarea.js` | resumen de las 7 assign: enviados / sin calificar | ✅ probado |
| `pendientes-corregir.js` | cola de corrección con nombre y link al calificador | ✅ probado |

### Gotchas de la grilla de calificación (todos verificados a los golpes)

Están comentados en `pendientes-corregir.js`, pero conviene tenerlos acá:

- `perpage=N` **no** agranda la grilla: Moodle la maneja por preferencia de usuario.
  Hay que paginar con `&page=N`.
- **Quedarse sin tabla NO es un error**, es el final de la paginación. Tratarlo como
  falla hacía descartar todo lo ya juntado ("no pude leer la grilla" tras leer 8 páginas bien).
- `filter=require_grading` **no es válido** y, peor, Moodle lo **guarda como preferencia**:
  deja la grilla vacía en todas las visitas siguientes. Por eso se manda `filter=` vacío.
- La nota es una **escala** ("Supera lo esperado"), no un número. Lo pendiente se deduce
  de la columna **Estado**, no de la de Calificación.
- Nunca `.catch(() => {})` en un `goto`: un error tragado se disfraza de dato.
- Columnas: `c2` Nombre · `c5` Estado · `c6` Calificación.
  ⛔ `c3` es **DNI** y `c4` es **email**: no se leen nunca.

## Lo que falta — próximos pasos

Ya tenemos el DOM real, así que estos se escriben contra selectores verificados,
no inventados:

1. **`leer-mensajes.js`** — la mensajería es el `message-drawer` de Moodle. Regiones
   confirmadas: `view-overview-messages`, `view-conversation`, `last-message`,
   `last-message-date`, `contact-request-count`. Al 2026-08-21: **1 conversación**.
2. **`entregas-tarea.js`** — estado por `assign`. Los 7 cmid están en `CLAUDE.md`
   (4660, 4688, 4712, 4734, 4755, 4765, 4764).
3. **`seguimiento.js`** — quién entregó y quién no, unidad por unidad.
4. **`auditar-aula.js`** — links rotos, faltantes, fechas.
5. **Escritura, detrás de confirmación explícita:** `responder-mensaje.js`,
   `cargar-nota.js`.

## Decisiones tomadas

- **2026-08-21 — Playwright, no API REST.** FRM no tiene el web service móvil
  (`enablemobilewebservice: 0` en los dos campus de Mendoza). Evidencia en `CLAUDE.md`.
- **2026-08-21 — Repo aparte** en `trabajo/frm/pre/`, fuera de `tupad/`.
- **2026-08-21 — Login manual, sin contraseña guardada.** `campusingresantes` es un
  Moodle separado: la credencial de `campusvirtual.frm` no sirve acá. En vez de
  buscarla, se persiste la cookie. Cero riesgo de bloqueo de cuenta.
- **2026-08-21 — Datos de menores.** `datos/` y `evidencia/` nunca se versionan.

## Hallazgos abiertos

| Fecha | Qué | Criticidad | Estado |
| --- | --- | :-: | :-: |
| 2026-08-21 | **15 entregas sin calificar** (10 en U1, 2 en U2, 2 en U3, 1 en U4), con nombre y link en `datos/pendientes-corregir.json`. El resumen de Moodle dice 16: la de diferencia es probablemente un "Calificado - vuelto a entregar", que el filtro por Estado no cuenta. Sin confirmar. | alta | **abierto** |
| 2026-08-21 | **Un aspirante (userid 20670) tiene entregas de JULIO 2026 sin calificar en U1, U2, U3 y U4** — anteriores al inicio de la cohorte (19-ago). Parece arrastre de una cohorte previa o un caso adelantado. Verificar si corresponde corregirlas. | media | **abierto** |
| 2026-08-21 | ~~Embudo de participación~~ **DESCARTADO el 2026-08-21.** La cohorte arrancó el **19-ago-2026**: al segundo día, 15 entregas de 165 en U1 es el pelotón de ansiosos, no deserción. Lección: no interpretar una curva de participación sin saber la fecha de inicio. | — | descartado |
| 2026-08-21 | Ninguna de las 7 `assign` mostró fila "Fecha de entrega" en su resumen — posible falta de fechas límite configuradas. Con la cohorte recién arrancada esto pesa MÁS: sin fecha no hay urgencia, y sin urgencia los chicos derivan. Verificar en la config de cada tarea. | media | **abierto** |
| 2026-08-21 | `_probar-dom.js` volcó ~174 mails de aspirantes por indexar columnas por posición. Archivo purgado, script corregido, reglas escritas en `CLAUDE.md`. | alta | resuelto |
| 2026-08-21 | El bug de reintentos de login sigue vivo en `tupad/coordinacion/prog-4/_carga/_campus.js`, de donde se copió el patrón. Reintenta credenciales inválidas y acerca el bloqueo de cuenta. | media | **abierto** |
| 2026-08-21 | Sección `Encuentros Sincrónicos` del aula 589 está VACÍA. Sin verificar si es intencional. | baja | **abierto** |
