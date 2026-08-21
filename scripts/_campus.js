// Motor compartido de la celda: destino, credenciales, login y sesión persistida.
//
// POR QUÉ EXISTE: es el mismo patrón que `_carga/_campus.js` de la celda prog-4, que
// nació justamente porque cada script tenía el host y el curso escritos a mano y eso
// ya había causado dos accidentes por valores clavados. Acá arranca parametrizado
// desde el día uno.
//
// El destino se declara por entorno y SIEMPRE se imprime antes de actuar:
//   M_BASE=https://campusingresantes.frm.utn.edu.ar M_CURSO=12 node scripts/<x>.js
//
// Verificado 2026-08-21: el formulario de login de CVI usa los mismos ids que el resto
// de los campus UTN (#username, #password, #loginbtn). Por eso `ingresar()` sirve tal cual.

// `quiet` calla el banner de dotenv: los scripts de esta celda imprimen el destino y
// nada más, para que el log sea legible como evidencia.
require('dotenv').config({ quiet: true });
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = (process.env.M_BASE || 'https://campusingresantes.frm.utn.edu.ar').replace(/\/+$/, '');
const CURSO = process.env.M_CURSO ? parseInt(process.env.M_CURSO, 10) : null;
const STORAGE = path.join(__dirname, '..', '.auth', 'cvi-state.json');

if (!/^https:\/\/[a-z0-9.-]+$/i.test(BASE)) {
  console.error(`M_BASE inválido: "${BASE}" (se espera https://host)`);
  process.exit(1);
}
if (process.env.M_CURSO && (!Number.isInteger(CURSO) || CURSO <= 0)) {
  console.error(`M_CURSO inválido: "${process.env.M_CURSO}"`);
  process.exit(1);
}

// Aulas conocidas, para que el log diga de cuál se trata y no sólo un número.
// Se completa a medida que `explorar.js` vaya descubriendo los cursos reales.
const CONOCIDAS = {
  'campusingresantes.frm.utn.edu.ar|589': 'CVI 589 — Pre TUP 2027 - Marzo (rol docente)',
};

// Regla de la celda: nunca hablar de "el aula" a secas. Siempre host + course.
function describir() {
  const host = BASE.replace(/^https:\/\//, '');
  if (CURSO === null) {
    console.log(`CAMPUS DESTINO: ${host} · (sin curso declarado)\n`);
    return { host, curso: null, etiqueta: null };
  }
  const etiqueta = CONOCIDAS[`${host}|${CURSO}`]
    || '⚠ AULA NO DECLARADA en _campus.js — verificá antes de escribir';
  console.log(`AULA DESTINO: ${host} · course ${CURSO}`);
  console.log(`              ${etiqueta}\n`);
  return { host, curso: CURSO, etiqueta };
}

// Credenciales por referencia: se leen de process.env y NUNCA se imprimen.
// Con `obligatorias:false` devuelve null en vez de cortar, para que el llamador
// pueda ofrecer el camino del login manual.
function credenciales({ obligatorias = true } = {}) {
  const u = process.env.CVI_USER || process.env.M_USER;
  const p = process.env.CVI_PASSWORD || process.env.M_PASS;
  if (!u || !p) {
    if (!obligatorias) return null;
    console.error('Faltan CVI_USER / CVI_PASSWORD en el .env.');
    console.error('Si no querés guardar la contraseña: node scripts/login-manual.js');
    process.exit(2);
  }
  return { usuario: u, clave: p };
}

// Contexto nuevo. Timeouts generosos: los campus UTN responden lento y con el default
// de Playwright (30 s) se cae hasta el login. No bajar de 90 s.
async function nuevoContexto(browser, { usarSesion = true, timeout = 90000, ...extra } = {}) {
  const opts = { ...extra };
  if (usarSesion && fs.existsSync(STORAGE)) opts.storageState = STORAGE;
  const ctx = await browser.newContext(opts);
  ctx.setDefaultTimeout(timeout);
  ctx.setDefaultNavigationTimeout(timeout);
  return ctx;
}

async function estaLogueado(page) {
  return (await page.locator('a[href*="/login/logout.php"], #user-menu-toggle, .usermenu').count()) > 0;
}

// Login por formulario. Devuelve true/false; NO imprime la contraseña.
//
// ⚠ REGLA DE ORO DE LOS REINTENTOS (bug encontrado el 2026-08-21, heredado de
// `_carga/_campus.js` de prog-4): sólo se reintenta ante fallas TRANSITORIAS —red,
// timeout, campus caído—. Si Moodle contesta "Acceso inválido", la credencial está
// mal y repetirla NO la va a arreglar: lo único que hace es gastar el presupuesto
// de intentos antes del bloqueo de cuenta (Moodle bloquea a los ~10 fallidos por
// defecto). Ese día se quemaron 3 intentos al pedo contra el Campus Ingresantes.
// Ante credenciales inválidas: cortar de una y avisar.
const CREDENCIAL_MAL = /acceso inv[áa]lido|invalid login|nombre de usuario o contrase/i;

async function ingresar(page, { intentos = 3 } = {}) {
  const { usuario, clave } = credenciales();
  for (let i = 1; i <= intentos; i++) {
    try {
      await page.goto(`${BASE}/login/index.php`, { waitUntil: 'domcontentloaded' });
      await page.fill('#username', usuario);
      await page.fill('#password', clave); // por referencia, nunca se loguea
      await page.click('#loginbtn');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
      if (!/login\/index\.php/.test(page.url()) && await estaLogueado(page)) {
        console.log(`login OK (usuario ${usuario})\n`);
        return true;
      }
      const aviso = (await page.locator('.loginerrors, .alert-danger').first()
        .textContent().catch(() => '') || '').trim();

      if (CREDENCIAL_MAL.test(aviso)) {
        console.error(`\n  ✗ El campus rechazó la credencial: "${aviso.slice(0, 120)}"`);
        console.error(`    Usuario probado: ${usuario}`);
        console.error('    CORTO ACÁ a propósito: reintentar la misma credencial no la arregla');
        console.error('    y acerca el bloqueo de la cuenta. Revisá usuario/contraseña.');
        return false;
      }

      console.error(`  login intento ${i}/${intentos}: no entró -> ${page.url()}`
        + (aviso ? ` | ${aviso.slice(0, 120)}` : ''));
    } catch (e) {
      console.error(`  login intento ${i}/${intentos} falló: ${e.message.split('\n')[0]}`);
    }
    if (i < intentos) await page.waitForTimeout(3000);
  }
  return false;
}

// Reusa la sesión guardada si sirve; si no, loguea de nuevo y la regraba.
// Así no le pegamos al login del campus en cada script.
async function sesion({ headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  let ctx = await nuevoContexto(browser);
  let page = await ctx.newPage();

  await page.goto(`${BASE}/my/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  if (await estaLogueado(page)) {
    console.log('sesión reutilizada desde .auth/\n');
    return { browser, ctx, page, BASE, CURSO };
  }

  // Sin sesión válida. Si no hay credenciales en el .env, NO adivinamos: mandamos al
  // login manual. Es el camino sano en `campusingresantes`, donde la credencial de
  // `campusvirtual.frm` no sirve y cada intento fallido acerca el bloqueo de cuenta.
  await ctx.close();
  if (!credenciales({ obligatorias: false })) {
    await browser.close();
    throw new Error(
      'No hay sesión guardada ni credenciales en el .env.\n'
      + '  Logueate vos una vez y la celda se queda con la sesión:\n'
      + '      node scripts/login-manual.js');
  }

  ctx = await nuevoContexto(browser, { usarSesion: false });
  page = await ctx.newPage();
  if (!await ingresar(page)) {
    await browser.close();
    throw new Error(
      'No pude entrar con las credenciales del .env.\n'
      + '  Alternativa sin riesgo de bloqueo: node scripts/login-manual.js');
  }
  await guardarSesion(ctx);
  return { browser, ctx, page, BASE, CURSO };
}

async function guardarSesion(ctx) {
  fs.mkdirSync(path.dirname(STORAGE), { recursive: true });
  await ctx.storageState({ path: STORAGE });
  console.log(`sesión guardada en ${path.relative(process.cwd(), STORAGE)}\n`);
}

// Captura de evidencia con el nombre que pide la celda: AAAA-MM-DD_<tema>.png
async function capturar(page, tema) {
  const dir = path.join(__dirname, '..', 'evidencia');
  fs.mkdirSync(dir, { recursive: true });
  const fecha = new Date().toISOString().slice(0, 10);
  const destino = path.join(dir, `${fecha}_${tema}.png`);
  await page.screenshot({ path: destino, fullPage: true });
  console.log(`captura: ${path.relative(process.cwd(), destino)}`);
  return destino;
}

module.exports = {
  BASE, CURSO, STORAGE,
  describir, credenciales, nuevoContexto, ingresar, sesion,
  guardarSesion, estaLogueado, capturar,
};
