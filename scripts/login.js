// Valida las credenciales del campus y deja la sesión guardada en .auth/.
// Es el PRIMER script a correr en la celda: si esto no pasa, nada más va a andar.
//
//   node scripts/login.js
//   node scripts/login.js --ver     (abre el navegador para mirar qué pasa)

const { BASE, describir, sesion, capturar } = require('./_campus');

const VER = process.argv.includes('--ver');

(async () => {
  describir();
  let s;
  try {
    s = await sesion({ headless: !VER });
  } catch (e) {
    console.error(`\n✗ ${e.message}`);
    process.exit(1);
  }

  const { browser, page } = s;
  try {
    await page.goto(`${BASE}/user/profile.php`, { waitUntil: 'domcontentloaded' });
    const nombre = await page.locator('.page-header-headings h1, h1').first()
      .textContent().catch(() => null);
    console.log(`✓ Entré al campus como: ${nombre ? nombre.trim() : '(no pude leer el nombre)'}`);
    console.log(`  perfil: ${page.url()}`);
    await capturar(page, 'login-ok');
  } finally {
    await browser.close();
  }
})();
