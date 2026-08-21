// Login A MANO: abre el navegador, logueás vos, y la celda se queda con la sesión.
//
// POR QUÉ EXISTE: el 2026-08-21 el login automático fallaba porque `campusingresantes`
// es un Moodle SEPARADO de `campusvirtual.frm` — otra base de usuarios, otra credencial.
// En vez de seguir probando combinaciones (y acercarnos al bloqueo de cuenta a los ~10
// fallidos), este camino delega el login en el humano y sólo persiste la cookie.
//
// VENTAJAS sobre guardar la contraseña en el .env:
//   - cero intentos fallidos, cero riesgo de bloqueo
//   - la contraseña NO queda en ningún archivo de la celda
//   - funciona igual si el campus mete captcha, 2FA o SSO
//
// LÍMITE: la sesión de Moodle vence (típico: unas horas de inactividad). Cuando venza,
// volvés a correr esto. Los demás scripts avisan solos cuando la sesión ya no sirve.
//
//   node scripts/login-manual.js
//   node scripts/login-manual.js --minutos 10

const { BASE, describir, nuevoContexto, estaLogueado, guardarSesion, capturar } = require('./_campus');
const { chromium } = require('playwright');

const iMin = process.argv.indexOf('--minutos');
const MINUTOS = iMin !== -1 ? parseInt(process.argv[iMin + 1], 10) || 5 : 5;

// Cartel fijo al pie, para que se sepa de una que ESTA ventana es la de la celda y no
// una pestaña perdida. No tapa el formulario (va abajo y con pointer-events:none).
async function ponerCartel(page) {
  await page.evaluate(() => {
    if (document.getElementById('__celda_pre')) return;
    const d = document.createElement('div');
    d.id = '__celda_pre';
    d.textContent = '⬆ CELDA PRE FRM — logueate acá arriba. La ventana se cierra sola cuando entres.';
    Object.assign(d.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '2147483647',
      background: '#b3001b', color: '#fff', font: '700 18px/1.6 system-ui, sans-serif',
      textAlign: 'center', padding: '14px', pointerEvents: 'none',
      boxShadow: '0 -2px 14px rgba(0,0,0,.4)',
    });
    document.body.appendChild(d);
  }).catch(() => {});
}

(async () => {
  describir();
  console.log('Se va a abrir una ventana de Chromium en el Campus Ingresantes.');
  console.log('Logueate ahí como lo hacés siempre. Yo espero y me quedo con la sesión.');
  console.log(`Tenés ${MINUTOS} minutos. (No cierres la ventana: la cierro yo al terminar.)\n`);

  // La ventana tiene que ser IMPOSIBLE de ignorar. La primera versión de esto abrió un
  // Chromium chiquito que quedó atrás de otras ventanas y se perdieron 8 minutos de
  // espera contra una ventana que nadie vio. Maximizada, al frente, y con un cartel.
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--window-position=0,0'],
  });
  // viewport:null es lo que hace que `--start-maximized` valga: sin esto Playwright
  // fuerza 1280x720 adentro de la ventana maximizada y queda una franja ridícula.
  const ctx = await nuevoContexto(browser, { usarSesion: false, viewport: null });
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/login/index.php`, { waitUntil: 'domcontentloaded' });
    await page.bringToFront().catch(() => {});
    await ponerCartel(page);

    const limite = Date.now() + MINUTOS * 60_000;
    let dentro = false;
    let avisado = 0;

    while (Date.now() < limite) {
      await page.waitForTimeout(2000);
      if (page.isClosed()) {
        console.error('\n✗ Cerraste la ventana antes de terminar. No guardé nada.');
        process.exitCode = 1;
        return;
      }
      if (!/\/login\//.test(page.url()) && await estaLogueado(page).catch(() => false)) {
        dentro = true;
        break;
      }
      const restante = Math.ceil((limite - Date.now()) / 60_000);
      if (restante !== avisado) { avisado = restante; console.log(`  esperando... (${restante} min)`); }
    }

    if (!dentro) {
      console.error('\n✗ Se acabó el tiempo y no detecté la sesión iniciada.');
      console.error('  Corré de nuevo con más margen: node scripts/login-manual.js --minutos 10');
      process.exitCode = 1;
      return;
    }

    console.log('\n✓ Detecté la sesión iniciada.');

    // Quién entró y con qué usuario — dato que hay que anotar en CLAUDE.md.
    await page.goto(`${BASE}/user/profile.php`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const nombre = await page.locator('.page-header-headings h1, h1').first()
      .textContent().catch(() => null);
    const mUser = page.url().match(/[?&]id=(\d+)/);
    console.log(`  Usuario: ${nombre ? nombre.trim() : '(no pude leer el nombre)'}`);
    console.log(`  userid : ${mUser ? mUser[1] : '(sin dato)'}`);

    await guardarSesion(ctx);
    await capturar(page, 'login-manual-ok');
    console.log('\nYa podés correr:  node scripts/explorar.js');
  } finally {
    await browser.close().catch(() => {});
  }
})();
