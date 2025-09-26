import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PYTHON_CANDIDATES = [
  process.env.PYTHON_BINARY,
  process.env.PYTHON_PATH,
  process.platform === 'win32' ? 'python' : 'python3',
  'python'
].filter(Boolean);

const INTERVAL_CONFIG = {
  daily: { periods: 14, frequency: 'D' },
  weekly: { periods: 8, frequency: 'W' },
  monthly: { periods: 6, frequency: 'M' },
  yearly: { periods: 3, frequency: 'Y' }
};

function pickPythonExecutable() {
  return DEFAULT_PYTHON_CANDIDATES[0] || 'python';
}

export async function runDemandForecast({ history, interval = 'monthly' }) {
  if (!Array.isArray(history) || history.length < 2) {
    return [];
  }

  const config = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG.monthly;
  const payload = JSON.stringify({
    history,
    periods: config.periods,
    frequency: config.frequency
  });

  const pythonExec = pickPythonExecutable();
  const scriptPath = path.join(__dirname, 'prophetForecast.py');

  return new Promise((resolve) => {
    const child = spawn(pythonExec, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      console.error('[forecast] Failed to start Prophet process:', err.message);
      resolve([]);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        if (stderr) {
          console.error('[forecast] Prophet stderr:', stderr);
        }
        console.error(`[forecast] Prophet process exited with code ${code}`);
        resolve([]);
        return;
      }

      try {
        const parsed = JSON.parse(stdout || '{}');
        resolve(Array.isArray(parsed.forecast) ? parsed.forecast : []);
      } catch (parseErr) {
        console.error('[forecast] Unable to parse Prophet output:', parseErr.message);
        resolve([]);
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}
