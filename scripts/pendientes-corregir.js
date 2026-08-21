// Cola de corrección: quién entregó y todavía no tiene nota, con el link directo
// para calificarlo.
//
//   node scripts/pendientes-corregir.js           # todas las entregas
//   node scripts/pendientes-corregir.js 4660      # sólo esa
//
// SOLO LECTURA — no califica nada. Cargar notas es otro script, y va detrás de
// confirmación explícita.
//
// ⚠ DATOS PERSONALES: este script SÍ necesita nombres, porque sin saber a quién
// corregís no sirve de nada. Por eso:
//   - Guarda en `datos/`, que está en .gitignore. Nunca se versiona.
//   - NO recolecta mails: la columna de correo se descarta explícitamente.
//   - Identifica por `userid` de Moodle, que es lo que hace falta para armar el link.
// (Ver el incidente del 2026-08-21 en CLAUDE.md.)

const fs = require('fs');
const path = require('path');
const { BASE, describir, sesion } = require('./_campus');

const ENTREGAS = [
  { cmid: 4660, unidad: '1', nombre: 'Cierre U1 — Estructuras Secuenciales' },
  { cmid: 4688, unidad: '2', nombre: 'Cierre U2 — Estructuras Condicionales' },
  { cmid: 4712, unidad: '3', nombre: 'Cierre U3 — Estructuras Repetitivas' },
  { cmid: 4734, unidad: '4', nombre: 'Cierre U4 — Listas' },
  { cmid: 4755, unidad: '5', nombre: 'Cierre U5 — Funciones' },
  { cmid: 4765, unidad: '—', nombre: 'Entrega Examen de Ingreso' },
  { cmid: 4764, unidad: '—', nombre: 'Extensión Ejercicio Nivelatorio' },
];

const SALIDA = path.join(__dirname, '..', 'datos', 'pendientes-corregir.json');
const pedidos = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const lista = pedidos.length ? ENTREGAS.filter(e => pedidos.includes(e.cmid)) : ENTREGAS;

(async () => {
  describir();
  const { browser, page } = await sesion({ headless: true });
  const resultado = [];

  try {
    for (const e of lista) {
      // Dos cosas que costaron una tarde el 2026-08-21:
      //   1. `perpage=200` NO agranda esta grilla (Moodle la maneja por preferencia de
      //      usuario, no por URL). Sigue devolviendo 10 filas. Hay que PAGINAR con
      //      `&page=N` hasta que no vengan más filas.
      //   2. `filter=require_grading` NO sirve acá: rompe la grilla entera (queda sin
      //      tabla). Y OJO, lo peor: Moodle GUARDA el filtro como preferencia de
      //      usuario, así que un valor inválido deja la grilla vacía en TODAS las
      //      visitas siguientes, incluso sin el parámetro. Por eso mandamos siempre
      //      `filter=` vacío: filtra nada y de paso limpia una preferencia sucia.
      //      Se filtra leyendo la columna Estado, que es fiable.
      //   3. La nota es una ESCALA ("Supera lo esperado"), no un número. Deducir
      //      "sin calificar" buscando dígitos marcaba como pendientes a los ya
      //      corregidos. El dato bueno está en Estado: "Enviado para calificar" a secas
      //      = pendiente; si además dice "Calificado", ya está hecho.
      const base = `${BASE}/mod/assign/view.php?id=${e.cmid}&action=grading&filter=`;
      const url = base;
      const pend = [];
      let pagina = 0;
      let vistasTotal = 0;
      let error = null;

      while (pagina < 40) { // techo: 40 páginas x 10 = 400 filas (hay 165 estudiantes)
        // ⚠ NADA de `.catch(() => {})` acá. Un goto que falla en silencio deja la
        // página anterior cargada y el scraper evalúa el DOM equivocado: el síntoma
        // fue "sin tabla" en las 7 entregas mientras las URLs andaban perfecto a mano.
        // Un error tragado no desaparece, se disfraza de dato.
        try {
          await page.goto(`${base}&page=${pagina}`, { waitUntil: 'domcontentloaded' });
        } catch (err) {
          error = `navegación falló en page=${pagina}: ${err.message.split('\n')[0]}`;
          break;
        }
        await page.waitForTimeout(1200);

        if (process.env.DEBUG) {
          const nt = await page.evaluate(() => document.querySelectorAll('table').length);
          console.error(`   DEBUG page=${pagina} url=${page.url().slice(-50)} tablas=${nt}`);
        }

        const lote = await page.evaluate(() => {
          const tabla = document.querySelector('table.generaltable');
          if (!tabla) return { error: 'sin tabla' };

          // Columnas POR ENCABEZADO, alineadas por la clase `cN`. Nunca por posición.
          const ths = [...tabla.querySelectorAll('thead th')];
          const clase = (th) => (th ? [...th.classList].find(c => /^c\d+$/.test(c)) : null) || null;
          const txt = (th) => (th.textContent || '').replace(/\s+/g, ' ').trim();

          // ⚠ LISTA NEGRA: "Nombre de usuario" es el DNI y "Dirección de correo" el mail.
          // Ninguna de las dos se lee JAMÁS. Ojo que "Nombre de usuario" empieza igual
          // que "Nombre", así que hay que excluirla explícitamente o se cuela sola.
          const esProhibida = (t) => /nombre de usuario|direcci[óo]n de correo|email|username/i.test(t);

          const colNombre = clase(ths.find(t => /^nombre/i.test(txt(t)) && !esProhibida(txt(t))));
          const colEstado = clase(ths.find(t => /^estado|^status/i.test(txt(t))));
          const colMod = clase(ths.find(t => /última modificaci.*entrega|last modified.*submission/i.test(txt(t))));

          const leer = (tr, cl) => {
            if (!cl) return '';
            const td = tr.querySelector(`td.${cl}`);
            return td ? (td.textContent || '').replace(/\s+/g, ' ').trim() : '';
          };

          const out = [];
          let vistas = 0;
          for (const tr of tabla.querySelectorAll('tbody tr')) {
            if (tr.querySelectorAll('td').length < 3) continue;
            vistas++;
            const estado = leer(tr, colEstado);

            // Pendiente = entregó y NO figura calificado. Ver nota (4) arriba.
            const entrego = /enviado para calificar|submitted for grading/i.test(estado);
            const calificado = /calificado|graded/i.test(estado);
            if (!entrego || calificado) continue;

            const a = tr.querySelector('a[href*="user/view.php"], a[href*="action=grader"]');
            const uid = a ? (a.href.match(/[?&](?:id|userid)=(\d+)/) || [])[1] : null;

            let nombre = leer(tr, colNombre);
            // Guardia final: si algo con "@" o un DNI se coló, se descarta el valor.
            if (/@/.test(nombre) || /^\d{6,}$/.test(nombre)) nombre = '(oculto)';

            out.push({ userid: uid, nombre, estado, modificado: leer(tr, colMod) });
          }
          return { filas: out, vistas };
        }).catch(err => ({ error: err.message }));

        // Quedarse sin grilla NO es un error: es el final de la paginación. Moodle deja
        // de renderizar la tabla cuando te pasás de la última página. Sólo es falla real
        // si ni siquiera la PRIMERA página tenía tabla.
        // (Antes esto rompía el bucle y descartaba todos los pendientes ya juntados:
        //  el script decía "no pude leer la grilla" habiendo leído 8 páginas bien.)
        if (lote.error) {
          if (pagina === 0) error = lote.error;
          break;
        }

        // ⚠ Cortar por FILAS VISTAS, no por pendientes encontrados. `filas` ya viene
        // filtrado, así que una página entera de "Sin entrega" devuelve 0 pendientes —
        // si se corta ahí, se pierden todas las páginas siguientes. Con 165 estudiantes
        // de a 10 por página son ~17 páginas, y las entregas no están al principio.
        if (!lote.vistas) break;                    // página vacía = se acabó la grilla

        const nuevos = lote.filas.filter(f => !pend.some(p => p.userid === f.userid));
        pend.push(...nuevos);
        vistasTotal += lote.vistas;
        pagina++;
      }

      if (error) {
        console.log(`[${e.cmid}] ${e.nombre} — ⚠ no pude leer la grilla (${error})`);
        continue;
      }
      resultado.push({ ...e, url, pendientes: pend });

      if (!pend.length) {
        console.log(`[${e.cmid}] U${e.unidad} ${e.nombre} — al día ✓  (${vistasTotal} filas revisadas)`);
        continue;
      }

      console.log(`\n[${e.cmid}] U${e.unidad} ${e.nombre} — ${pend.length} para corregir  (${vistasTotal} filas revisadas)`);
      for (const p of pend) {
        console.log(`   · ${(p.nombre || '(sin nombre)').padEnd(34)} ${p.modificado || ''}`);
        console.log(`     ${BASE}/mod/assign/view.php?id=${e.cmid}&action=grader&userid=${p.userid}`);
      }
    }

    const total = resultado.reduce((a, r) => a + r.pendientes.length, 0);
    console.log('\n' + '─'.repeat(70));
    console.log(`TOTAL para corregir: ${total}`);

    fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
    fs.writeFileSync(SALIDA, JSON.stringify(
      { aula: 589, fecha: new Date().toISOString(), total, entregas: resultado }, null, 2), 'utf8');
    console.log(`✓ Guardado en ${path.relative(process.cwd(), SALIDA)} (no se versiona)`);
  } finally {
    await browser.close();
  }
})();
