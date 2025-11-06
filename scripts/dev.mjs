import { execSync, spawn } from 'node:child_process';

const port = process.env.PORT || '4000';

function killPortWindows(p) {
  try {
    const out = execSync(`netstat -ano | findstr :${p}`, { encoding: 'utf8' });
    const lines = out.split(/\r?\n/).filter(l => l.includes(`:${p}`) && /LISTENING/i.test(l));
    const pids = [...new Set(lines.map(l => l.trim().split(/\s+/).pop()).filter(Boolean))];
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[dev] Killed PID ${pid} using port ${p}`);
      } catch (e) {
        console.warn(`[dev] Failed to kill PID ${pid}: ${e.message}`);
      }
    }
    if (pids.length === 0) {
      console.log(`[dev] Port ${p} appears free.`);
    }
  } catch {
    console.log(`[dev] Port ${p} appears free.`);
  }
}

function startViteOnPort(p) {
  const args = ['vite', '--port', p];
  // Use npx to resolve local project binary (node_modules/.bin/vite)
  const child = spawn('npx', args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code ?? 0));
}

console.log(`[dev] Ensuring port ${port} is free...`);
killPortWindows(port);
console.log(`[dev] Starting Vite on port ${port}...`);
startViteOnPort(port);