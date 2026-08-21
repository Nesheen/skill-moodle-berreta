// Estado de las entregas (`assign`) del aula: cuántos entregaron, cuántos faltan
// calificar, y cuándo vence cada una.
//
// Es la foto que contesta "¿qué tengo para corregir y qué está por vencer?" sin abrir
// siete pestañas a mano.
//
//   node scripts/entregas-tarea.js              # todas las del catálogo
//   node scripts/entregas-tarea.js 4660 4688    # sólo esos cmid
//
// SOLO LECTURA. Y sólo CONTEOS: no lee nombres ni mails de aspirantes.
// (Ver el incidente del 2026-08-21 en CLAUDE.md — por eso esta regla está acá arriba.)

const fs = require('fs');
const path = require('path');
const { BASE, describir, sesion } = require('./_campus');

// Catálogo de entregas del aula 589, relevado el 2026-08-21 con `_probar-dom.js`.
// Si el aula cambia, se regenera con esa sonda — no se edita a mano a ciegas.
const ENTREGAS = [
  { cmid: 4660, unidad: '1', nombre: 'Cierre U1 — Estructuras Secuenciales' },
  { cmid: 4688, unidad: '2', nombre: 'Cierre U2 — Estructuras Condicionales' },
  { cmid: 4712, unidad: '3', nombre: 'Cierre U3 — Estructuras Repetitivas' },
  { cmid: 4734, unidad: '4', nombre: 'Cierre U4 — Listas' },
  { cmid: 4755, unidad: '5', nombre: 'Cierre U5 — Funciones' },
  { cmid: 4765, unidad: '—', nombre: 'Entrega Examen de Ingreso' },
  { cmid: 4764, unidad: '—', nombre: 'Extensión Ejercicio Nivelatorio' },
];

const SALIDA = path.join(__dirname, '..', 'datos', 'entregas.json');
const pedidos = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const lista = pedidos.length ? ENTREGAS.filter(e => pedidos.includes(e.cmid)) : ENTREGAS;

// Normaliza las etiquetas del resumen de Moodle, que cambian entre versiones e idiomas.
//
// ⚠ Etiquetas REALES verificadas en CVI 589 el 2026-08-21 (no asumir las de otro campus):
//   "Ocultado a los estudiantes" · "Participantes" · "Enviados" · "Pendientes por calificar"
// La primera versión buscaba "Entregados" y no matcheaba nada: el resultado decía
// "0 entregas" mientras había 15. Un scraper que falla en silencio miente con confianza,
// así que ante etiqueta desconocida esto NO inventa un cero — deja el campo sin definir.
function clasificar(etiqueta) {
  const t = etiqueta.toLowerCase();
  if (/oculto|ocultad|hidden/.test(t)) return 'oculto';
  if (/participante/.test(t)) return 'participantes';
  if (/borrador|draft/.test(t)) return 'borradores';
  if (/enviad|entregad|submitted/.test(t)) return 'entregados';
  if (/califica|grading|grade/.test(t) && /necesit|require|pendien/.test(t)) return 'sin_calificar';
  if (/fecha de entrega|due date/.test(t)) return 'vence';
  if (/tiempo restante|time remaining/.test(t)) return 'restante';
  if (/permite entregas desde|allow submissions from/.test(t)) return 'abre';
  return null;
}

(async () => {
  describir();
  const { browser, page } = await sesion({ headless: true });
  const filas = [];

  try {
    for (const e of lista) {
      const url = `${BASE}/mod/assign/view.php?id=${e.cmid}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1200);

      // El resumen de calificación es una tabla etiqueta→valor. Se lee como pares,
      // no por posición: así sobrevive a cambios de orden entre versiones de Moodle.
      const pares = await page.evaluate(() => {
        const out = [];
        for (const tr of document.querySelectorAll('table tr')) {
          const th = tr.querySelector('th');
          const td = tr.querySelector('td');
          if (th && td) {
            out.push([
              (th.textContent || '').replace(/\s+/g, ' ').trim(),
              (td.textContent || '').replace(/\s+/g, ' ').trim(),
            ]);
          }
        }
        return out;
      }).catch(() => []);

      const dato = { ...e, url, encontrado: pares.length > 0 };
      for (const [k, v] of pares) {
        const campo = clasificar(k);
        if (campo) dato[campo] = /^\d+$/.test(v) ? parseInt(v, 10) : v;
      }
      filas.push(dato);

      const n = (x) => (x === undefined ? '—' : x);
      console.log(
        `[${String(e.cmid).padEnd(4)}] U${e.unidad.padEnd(2)} ${e.nombre.padEnd(42)}`
        + ` part:${String(n(dato.participantes)).padStart(4)}`
        + ` enviados:${String(n(dato.entregados)).padStart(4)}`
        + ` sin calificar:${String(n(dato.sin_calificar)).padStart(4)}`
        + (dato.vence ? `  vence: ${dato.vence}` : '')
      );
      if (!dato.encontrado) console.log('        ⚠ no pude leer el resumen (¿sin permiso o actividad oculta?)');
      // Guardia contra el fallo silencioso: si hay pendientes pero no leí los enviados,
      // el clasificador se quedó corto con alguna etiqueta. Avisar, no maquillar.
      if (dato.entregados === undefined && dato.sin_calificar) {
        console.log('        ⚠ leí "sin calificar" pero NO "enviados": revisar clasificar()');
      }
    }

    // ── Totales ──────────────────────────────────────────────────────────────
    const suma = (c) => filas.reduce((a, f) => a + (typeof f[c] === 'number' ? f[c] : 0), 0);
    console.log('\n' + '─'.repeat(70));
    console.log(`TOTAL entregados: ${suma('entregados')}   ·   pendientes de calificar: ${suma('sin_calificar')}`);

    if (suma('entregados') === 0) {
      console.log('\n⚠ CERO entregas en TODAS las actividades.');
      console.log('  Puede ser que la cohorte no haya arrancado todavía, o que el rol no');
      console.log('  alcance para ver el resumen. Mirá la columna "vence" para saber cuál es.');
    }

    fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
    fs.writeFileSync(SALIDA, JSON.stringify(
      { aula: 589, fecha: new Date().toISOString(), entregas: filas }, null, 2), 'utf8');
    console.log(`\n✓ Guardado en ${path.relative(process.cwd(), SALIDA)}`);
  } finally {
    await browser.close();
  }
})();
