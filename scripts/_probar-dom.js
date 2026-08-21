// Sonda de reconocimiento FINO del aula: qué hay adentro del curso y cómo está hecha
// la bandeja de mensajes por dentro.
//
// El "_" del nombre marca que es una sonda de exploración, no una herramienta de uso
// diario (misma convención que los `_debug-*.js` de la celda prog-4). Sirve para
// escribir los scrapers de verdad contra selectores REALES en vez de inventados.
//
//   node scripts/_probar-dom.js
//
// SOLO LECTURA. No toca nada.

const fs = require('fs');
const path = require('path');
const { BASE, describir, sesion, capturar } = require('./_campus');

const CURSO = parseInt(process.env.M_CURSO || '589', 10);
const SALIDA = path.join(__dirname, '..', 'datos', 'dom-sonda.json');

(async () => {
  describir();
  const { browser, page } = await sesion({ headless: true });
  const out = { curso: CURSO, fecha: new Date().toISOString() };

  try {
    // ── Estructura del curso: secciones y actividades con su cmid ─────────────
    await page.goto(`${BASE}/course/view.php?id=${CURSO}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    out.curso_nombre = (await page.locator('h1').first().textContent().catch(() => '')).trim();
    out.secciones = await page.evaluate(() => {
      const secs = [];
      for (const s of document.querySelectorAll('li.section, [data-for="section"]')) {
        const titulo = (s.querySelector('h3, .sectionname, [data-for="section_title"]') || {}).textContent || '';
        const acts = [];
        for (const a of s.querySelectorAll('a[href*="/mod/"]')) {
          const href = a.getAttribute('href') || '';
          const tipo = (href.match(/\/mod\/([a-z]+)\//) || [])[1] || null;
          const cmid = (href.match(/[?&]id=(\d+)/) || [])[1] || null;
          const nombre = (a.querySelector('.instancename') || a).textContent || '';
          if (tipo && cmid) acts.push({ tipo, cmid: +cmid, nombre: nombre.replace(/\s+/g, ' ').trim() });
        }
        if (acts.length || titulo.trim()) {
          secs.push({ titulo: titulo.replace(/\s+/g, ' ').trim(), actividades: acts });
        }
      }
      return secs;
    });

    console.log(`\nCurso: ${out.curso_nombre}`);
    for (const s of out.secciones) {
      if (!s.actividades.length && !s.titulo) continue;
      console.log(`\n  § ${s.titulo || '(sin título)'}`);
      for (const a of s.actividades) console.log(`      [${a.tipo} ${a.cmid}] ${a.nombre}`);
    }

    // ── Participantes: SOLO CONTEO POR ROL. Nunca identidades. ───────────────
    //
    // ⚠ INCIDENTE 2026-08-21: la primera versión de esto usaba `td.c3` asumiendo que
    // era la columna de roles. En este campus `c3` es la columna de EMAIL, así que el
    // script volcó ~174 mails de aspirantes (probablemente menores) a la terminal y a
    // datos/dom-sonda.json. Se purgó el archivo. Dos lecciones, las dos en el código:
    //   1. NUNCA indexar columnas por posición: buscar la columna por su ENCABEZADO.
    //   2. Filtrar lo que se recolecta por lista blanca, no confiar en el selector.
    // Por eso acá se descarta cualquier celda que parezca un identificador personal.
    await page.goto(`${BASE}/user/index.php?id=${CURSO}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    out.participantes = await page.evaluate(() => {
      const tabla = document.querySelector('table#participants');
      if (!tabla) return null;

      // Ubicar la columna de roles POR SU ENCABEZADO, y después alinear por la CLASE
      // de columna (`c0`, `c1`, …) que Moodle repite en `th` y `td`. Indexar por
      // posición no sirve: thead y tbody no siempre tienen la misma cantidad de celdas
      // (la de selección, por ejemplo), y el índice se corre. Eso ya pasó acá: leía
      // "Grupos" creyendo que leía "Roles".
      const ths = [...tabla.querySelectorAll('thead th')];
      const thRol = ths.find(th => /\brol(es)?\b/i.test(th.textContent || ''));
      const claseCol = thRol
        ? [...thRol.classList].find(c => /^c\d+$/.test(c))
        : null;
      const iRol = thRol ? ths.indexOf(thRol) : -1;

      const filas = [...tabla.querySelectorAll('tbody tr')]
        .filter(tr => tr.querySelectorAll('td').length > 1); // descarta filas vacías/placeholder

      const roles = {};
      if (iRol !== -1) {
        for (const tr of filas) {
          const celda = (claseCol && tr.querySelector(`td.${claseCol}`))
            || tr.querySelectorAll('td')[iRol];
          let r = celda ? celda.textContent.replace(/\s+/g, ' ').trim() : '';
          // Lista blanca: si no parece un rol, no se guarda. Un mail o un nombre
          // JAMÁS entra acá, aunque el selector se haya equivocado de columna.
          if (/@|\d{6,}/.test(r)) r = '(columna equivocada — descartado)';
          if (!r) r = '(sin rol)';
          roles[r] = (roles[r] || 0) + 1;
        }
      }

      // Moodle imprime "N participantes encontrados" — dato más confiable que contar filas.
      const leyenda = (document.querySelector('[data-region="participant-count"], .paging-showall, p')
        || {}).textContent || '';
      const m = leyenda.match(/(\d+)\s+participantes/i);

      return {
        total_declarado_por_moodle: m ? parseInt(m[1], 10) : null,
        filas_en_esta_pagina: filas.length,
        por_rol: roles,
        _nota: 'Sólo conteos. Esta sonda NO recolecta nombres ni mails, a propósito.',
      };
    }).catch(() => null);
    console.log(`\nParticipantes (sólo conteos): ${out.participantes ? JSON.stringify(out.participantes) : '(no pude leer)'}`);

    // ── Bandeja de mensajes: anatomía real del message drawer ────────────────
    // Es una app JS. Acá listamos los data-region presentes para saber contra qué
    // escribir el scraper, en vez de adivinar selectores.
    await page.goto(`${BASE}/message/index.php`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    out.mensajeria = await page.evaluate(() => {
      const regiones = {};
      for (const el of document.querySelectorAll('[data-region]')) {
        const r = el.getAttribute('data-region');
        regiones[r] = (regiones[r] || 0) + 1;
      }
      const conv = [...document.querySelectorAll('[data-conversation-id]')].map(e => ({
        id: e.getAttribute('data-conversation-id'),
        texto: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      }));
      return { regiones, conversaciones: conv, total_conv: conv.length };
    }).catch(() => null);

    if (out.mensajeria) {
      console.log(`\nMensajería — conversaciones detectadas: ${out.mensajeria.total_conv}`);
      const regs = Object.keys(out.mensajeria.regiones).filter(r => /conv|messag|contact|overview/i.test(r));
      console.log(`  data-region relevantes: ${regs.join(', ') || '(ninguna)'}`);
    } else {
      console.log('\nMensajería: no pude leer el DOM');
    }
    await capturar(page, 'sonda-mensajeria');

    fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
    fs.writeFileSync(SALIDA, JSON.stringify(out, null, 2), 'utf8');
    console.log(`\n✓ Sonda guardada en ${path.relative(process.cwd(), SALIDA)}`);
  } finally {
    await browser.close();
  }
})();
