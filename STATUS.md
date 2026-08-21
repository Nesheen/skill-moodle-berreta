# STATUS — Celda Pre Universitario FRM

> Estado vivo de la celda. **Empezá cada sesión leyendo esto.**
> Última actualización: **2026-08-21**

## Dónde estamos

Celda **operativa**. Entra al campus, reconoció el aula y tiene el mapa completo de
actividades con sus `cmid`. Falta escribir las herramientas de uso diario.

- Aula: **CVI 589 — Pre TUP 2027 - Marzo**, 174 participantes.
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
| 2026-08-21 | **16 entregas sin calificar** en el aula 589 (11 en U1, 2 en U2, 2 en U3, 1 en U4). Hay cola de corrección esperando. | alta | **abierto** |
| 2026-08-21 | **Embudo de participación muy marcado**: de 165 estudiantes, entregaron 15 en U1, 6 en U2, 4 en U3, 2 en U4, 0 en U5. Sin verificar si es deserción o si la cohorte recién arranca. | alta | **abierto** |
| 2026-08-21 | Ninguna de las 7 `assign` mostró fila "Fecha de entrega" en su resumen — posible falta de fechas límite configuradas. Verificar en la config de cada tarea. | media | **abierto** |
| 2026-08-21 | `_probar-dom.js` volcó ~174 mails de aspirantes por indexar columnas por posición. Archivo purgado, script corregido, reglas escritas en `CLAUDE.md`. | alta | resuelto |
| 2026-08-21 | El bug de reintentos de login sigue vivo en `tupad/coordinacion/prog-4/_carga/_campus.js`, de donde se copió el patrón. Reintenta credenciales inválidas y acerca el bloqueo de cuenta. | media | **abierto** |
| 2026-08-21 | Sección `Encuentros Sincrónicos` del aula 589 está VACÍA. Sin verificar si es intencional. | baja | **abierto** |
