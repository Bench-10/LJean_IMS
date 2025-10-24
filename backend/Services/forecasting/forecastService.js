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

const CACHE_MAX_ENTRIES = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;
const forecastCache = new Map();

function makeCacheKey(interval, history) {
  // History can be large, but stringify keeps the cache simple here.
  return `${interval}::${JSON.stringify(history)}`;
}

function getCachedForecast(key) {
  const entry = forecastCache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    forecastCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedForecast(key, value) {
  if (forecastCache.size >= CACHE_MAX_ENTRIES) {
    const [oldestKey] = forecastCache.keys();
    forecastCache.delete(oldestKey);
  }
  forecastCache.set(key, { value, timestamp: Date.now() });
}

const inFlight = new Map();

function pickPythonExecutable() {
  return DEFAULT_PYTHON_CANDIDATES[0] || 'python';
}

export async function runDemandForecast({ history, interval = 'monthly' }) {
  if (!Array.isArray(history) || history.length < 2) {
    return [];
  }

  const cacheKey = makeCacheKey(interval, history);
  const cached = getCachedForecast(cacheKey);
  if (cached) {
    return cached;
  }

  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  const config = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG.monthly;
  const payload = JSON.stringify({
    history,
    periods: config.periods,
    frequency: config.frequency
  });

  const pythonExec = pickPythonExecutable();
  const scriptPath = path.join(__dirname, 'prophetForecast.py');

  const forecastPromise = new Promise((resolve) => {
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

  inFlight.set(cacheKey, forecastPromise);

  try {
    const result = await forecastPromise;
    setCachedForecast(cacheKey, result);
    return result;
  } finally {
    inFlight.delete(cacheKey);
  }
}
