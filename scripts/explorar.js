// Reconocimiento del campus: qué cursos tengo, con qué rol, y cuánto hay en la bandeja.
//
// POR QUÉ ESTE SCRIPT VA PRIMERO: los scrapers se escriben contra el DOM REAL, no contra
// el que uno se imagina. Este script sale a buscar la realidad (cursos, ids, rol, forma de
// la bandeja de mensajes) y deja todo en datos/exploracion.json + capturas. Recién con eso
// en la mano se escriben leer-mensajes / entregas / seguimiento sin adivinar selectores.
//
//   node scripts/explorar.js
//   node scripts/explorar.js --ver
//
// Es SOLO LECTURA. No toca nada del campus.

const fs = require('fs');
const path = require('path');
const { BASE, describir, sesion, capturar } = require('./_campus');

const VER = process.argv.includes('--ver');
const SALIDA = path.join(__dirname, '..', 'datos', 'exploracion.json');

(async () => {
  describir();
  const { browser, page } = await sesion({ headless: !VER });
  const informe = { campus: BASE, fecha: new Date().toISOString(), cursos: [], mensajes: null };

  try {
    // ── Quién soy ────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/user/profile.php`, { waitUntil: 'domcontentloaded' });
    informe.usuario = (await page.locator('.page-header-headings h1, h1').first()
      .textContent().catch(() => '')).trim() || null;
    const mUser = page.url().match(/[?&]id=(\d+)/);
    informe.userid = mUser ? parseInt(mUser[1], 10) : null;
    console.log(`Usuario: ${informe.usuario || '(sin dato)'}  ·  userid: ${informe.userid ?? '(sin dato)'}`);

    // ── Mis cursos ───────────────────────────────────────────────────────────
    await page.goto(`${BASE}/my/courses.php`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500); // el dashboard carga las tarjetas por AJAX

    let cursos = await page.evaluate(() => {
      const vistos = new Map();
      for (const a of document.querySelectorAll('a[href*="/course/view.php?id="]')) {
        const id = parseInt(new URL(a.href).searchParams.get('id'), 10);
        if (!id || vistos.has(id)) continue;
        const txt = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt) vistos.set(id, txt);
      }
      return [...vistos].map(([id, nombre]) => ({ id, nombre }));
    });

    // Plan B: si el dashboard no listó nada, probamos el listado de cursos del sitio.
    if (cursos.length === 0) {
      console.log('  (el dashboard no listó cursos — probando /course/)');
      await page.goto(`${BASE}/course/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      cursos = await page.evaluate(() => {
        const vistos = new Map();
        for (const a of document.querySelectorAll('a[href*="/course/view.php?id="]')) {
          const id = parseInt(new URL(a.href).searchParams.get('id'), 10);
          const txt = (a.textContent || '').replace(/\s+/g, ' ').trim();
          if (id && txt && !vistos.has(id)) vistos.set(id, txt);
        }
        return [...vistos].map(([id, nombre]) => ({ id, nombre }));
      });
    }

    console.log(`\nCursos visibles: ${cursos.length}`);
    await capturar(page, 'mis-cursos');

    // ── Rol y actividades por curso ──────────────────────────────────────────
    for (const c of cursos) {
      await page.goto(`${BASE}/user/index.php?id=${c.id}`, { waitUntil: 'domcontentloaded' })
        .catch(() => {});
      // Si puedo ver la lista de participantes, tengo rol docente/tutor en ese curso.
      const puedeVerParticipantes = (await page.locator('table#participants, .userlist').count()) > 0;

      await page.goto(`${BASE}/course/view.php?id=${c.id}`, { waitUntil: 'domcontentloaded' })
        .catch(() => {});
      const actividades = await page.evaluate(() => {
        const m = { assign: 0, quiz: 0, forum: 0, resource: 0, otros: 0 };
        for (const a of document.querySelectorAll('a[href*="/mod/"]')) {
          const t = (a.getAttribute('href').match(/\/mod\/([a-z]+)\//) || [])[1];
          if (t && t in m) m[t]++; else if (t) m.otros++;
        }
        return m;
      }).catch(() => null);

      const fila = { ...c, rol_docente: puedeVerParticipantes, actividades };
      informe.cursos.push(fila);
      console.log(`  [${c.id}] ${c.nombre}`);
      console.log(`        docente: ${puedeVerParticipantes ? 'SÍ' : 'no'}`
        + (actividades ? `  ·  tareas:${actividades.assign} quiz:${actividades.quiz} foros:${actividades.forum}` : ''));
    }

    // ── Bandeja de mensajes ──────────────────────────────────────────────────
    // La mensajería de Moodle es una app JS (message drawer). Acá sólo reconocemos su
    // forma para poder escribir el scraper después; no intentamos leer conversaciones.
    await page.goto(`${BASE}/message/index.php`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    informe.mensajes = await page.evaluate(() => ({
      conversaciones: document.querySelectorAll('[data-region="conversation-list"] [data-conversation-id], .conversation').length,
      sin_leer: document.querySelectorAll('[data-region="unread-count"], .unread-count').length,
      html_pista: (document.querySelector('[data-region="message-drawer"], #message-drawer, [data-region="view-overview"]') || {}).id || null,
    })).catch(() => null);
    console.log(`\nBandeja: ${informe.mensajes ? JSON.stringify(informe.mensajes) : '(no pude leerla)'}`);
    await capturar(page, 'bandeja-mensajes');

    // ── Guardar ──────────────────────────────────────────────────────────────
    fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
    fs.writeFileSync(SALIDA, JSON.stringify(informe, null, 2), 'utf8');
    console.log(`\n✓ Exploración guardada en ${path.relative(process.cwd(), SALIDA)}`);
    console.log('  Con esto ya se pueden escribir los scrapers contra el DOM real.');
  } finally {
    await browser.close();
  }
})();
