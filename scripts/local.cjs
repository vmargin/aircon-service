/* Local development always uses its own PostgreSQL cluster; never backend/.env. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const local = path.join(root, '.local');
const mode = process.argv[2] || 'start';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmCli = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')].find(file => file && fs.existsSync(file));
fs.mkdirSync(local, { recursive: true });
const configFile = path.join(local, 'config.json');
if (!fs.existsSync(configFile)) {
  fs.writeFileSync(configFile, JSON.stringify({ password: crypto.randomBytes(24).toString('hex'), jwtSecret: crypto.randomBytes(48).toString('hex') }, null, 2), { mode: 0o600 });
}
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const databaseUrl = `postgresql://arctic:${config.password}@127.0.0.1:5433/arctic_dev`;
const env = { ...process.env, DATABASE_URL: databaseUrl, TEST_DATABASE_URL: databaseUrl.replace('/arctic_dev', '/arctic_test'), JWT_SECRET: config.jwtSecret, NODE_ENV: 'development', PORT: '5000', HOST: '127.0.0.1', ARCTIC_LOCAL: '1', ALLOW_DEMO_SEED: 'true' };
function run(exe, args, cwd = root, extraEnv = {}) {
  const useNode = exe === npm && npmCli;
  const result = spawnSync(useNode ? process.execPath : exe, useNode ? [npmCli, ...args] : args, { cwd, env: { ...env, ...extraEnv }, stdio: 'inherit', shell: !useNode && exe === npm && process.platform === 'win32', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(exe)} failed (${result.status}).`);
}
function pgBinary(name) {
  const candidates = [process.env.PG_BIN, ...['18', '17', '16', '15', '14'].map(v => `C:/Program Files/PostgreSQL/${v}/bin`)];
  for (const dir of candidates.filter(Boolean)) {
    const file = path.join(dir, name + (process.platform === 'win32' ? '.exe' : ''));
    if (fs.existsSync(file)) return file;
  }
  if (process.platform !== 'win32') return name;
  throw new Error('PostgreSQL is required. Install PostgreSQL 14+ or set PG_BIN to its bin directory. Your cloud database is never used by this launcher.');
}
function database() {
  const data = path.join(local, 'postgres');
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    const passwordFile = path.join(local, 'postgres-password');
    fs.writeFileSync(passwordFile, config.password, { mode: 0o600 });
    run(pgBinary('initdb'), ['-D', data, '-U', 'arctic', '--pwfile', passwordFile, '--auth-host=scram-sha-256', '--auth-local=trust', '--encoding=UTF8', '--no-locale']);
  }
  const status = spawnSync(pgBinary('pg_ctl'), ['-D', data, 'status'], { stdio: 'ignore', windowsHide: true });
  if (status.status !== 0) run(pgBinary('pg_ctl'), ['-D', data, '-l', path.join(local, 'postgres.log'), '-o', '-h 127.0.0.1 -p 5433', '-w', 'start']);
  for (const name of ['arctic_dev', 'arctic_test']) {
    const result = spawnSync(pgBinary('psql'), ['-h', '127.0.0.1', '-p', '5433', '-U', 'arctic', '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${name}'`], { env: { ...env, PGPASSWORD: config.password }, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error('Cannot connect to the isolated PostgreSQL cluster. Check .local/postgres.log.');
    if (!result.stdout.trim()) run(pgBinary('createdb'), ['-h', '127.0.0.1', '-p', '5433', '-U', 'arctic', name], root, { PGPASSWORD: config.password });
  }
}
function dependencies() {
  for (const dir of ['backend', 'frontend']) {
    if (!fs.existsSync(path.join(root, dir, 'node_modules'))) run(npm, ['ci'], path.join(root, dir));
  }
}
function migrate(test = false) {
  const schema = path.join(root, 'backend/prisma/schema.prisma');
  const generated = path.join(root, 'backend/node_modules/.prisma/client/schema.prisma');
  const sameSchema = fs.existsSync(generated) && fs.readFileSync(schema, 'utf8').replaceAll('\r', '').trim() === fs.readFileSync(generated, 'utf8').replaceAll('\r', '').trim();
  if (!sameSchema) run(npm, ['run', 'db:generate'], path.join(root, 'backend'));
  run(npm, ['run', 'db:deploy'], path.join(root, 'backend'), test ? { DATABASE_URL: env.TEST_DATABASE_URL } : {});
}
function openBrowser() {
  const url = 'http://localhost:5000';
  if (process.platform === 'win32') spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`], { windowsHide: true, stdio: 'ignore' });
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
}
async function main() {
  if (mode === 'stop') { run(pgBinary('pg_ctl'), ['-D', path.join(local, 'postgres'), '-m', 'fast', '-w', 'stop']); return; }
  if (mode === 'exec') {
    const args = process.argv.slice(3);
    if (!args.length) throw new Error('Pass an executable after exec.');
    run(args[0] === 'npm' ? npm : args[0], args.slice(1)); return;
  }
  dependencies(); database();
  if (mode === 'db') { console.log('Isolated PostgreSQL ready on 127.0.0.1:5433 (arctic_dev and arctic_test).'); return; }
  if (mode === 'test') { migrate(true); run(npm, ['test'], path.join(root, 'backend'), { DATABASE_URL: env.TEST_DATABASE_URL }); return; }
  migrate();
  run(npm, ['run', 'db:seed:demo'], path.join(root, 'backend'));
  if (mode === 'setup') return;
  run(npm, ['run', 'build']);
  console.log('\nARCTIC • http://localhost:5000\nLocal demo: admin@arctic.com / demo1234\nKeep this terminal open. Your records persist in .local/postgres.\n');
  const server = spawn(process.execPath, ['backend/dist/src/server.js'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.on('exit', code => { process.exitCode = code || 0; });
  process.on('SIGINT', () => server.kill('SIGINT'));
  process.on('SIGTERM', () => server.kill('SIGTERM'));
  if (process.argv.includes('--open')) {
    for (let i = 0; i < 120; i++) {
      try { if ((await fetch('http://localhost:5000/health')).ok) { openBrowser(); break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
main().catch(error => { console.error(`\nARCTIC could not start: ${error.message}`); process.exitCode = 1; });
