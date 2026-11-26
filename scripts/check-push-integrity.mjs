import fs from 'node:fs';
import { createHash } from 'node:crypto';

const checks = [];
const sources = [
  'assets/season3-data.js',
  'assets/season3-schedule-data.js',
  'assets/season3-results-data.js'
];

function read(file) {
  return fs.readFileSync(new URL('../' + file, import.meta.url));
}

function requireText(file, text, label) {
  const content = read(file).toString('utf8');
  if (!content.includes(text)) checks.push(`${file}: ${label}`);
}

requireText('assets/pwa.js', 'registration.pushManager.getSubscription()', 'must reuse an existing push subscription before creating a new one');
requireText('assets/pwa.js', '"apikey": config.supabasePublishableKey', 'must send Supabase apikey when subscribing/unsubscribing');
requireText('assets/pwa.js', 'subscribe_409', 'must keep endpoint conflict diagnostics');
requireText('assets/pwa.js', 'anonymous_signin_failed', 'must keep anonymous auth failure handling');
requireText('assets/pwa.js', 'push_subscription_failed', 'must keep push subscription failure handling');
requireText('assets/pwa.js', 'function getAuthClient()', 'must keep the Supabase client deferred until opening notification settings');
requireText('assets/pwa.js', '/rest/v1/rpc/cbl_push_read_device', 'must read current subscription from the server');
requireText('sw.js', './assets/pwa.js?v=20261126-push-v3', 'service worker must cache the protected push client version');
requireText('index.html', 'assets/pwa.js?v=20261126-push-v3', 'homepage must load the protected push client version');

const manifestPath = 'assets/data/schedule-push.json';
try {
  const manifest = JSON.parse(read(manifestPath));
  const { site, schemaVersion, workerCache, contentHash, createdAt, integrity, snapshot } = manifest;
  if (site !== 'https://cblcbl.netlify.app' || schemaVersion !== 1 ||
      !/^[a-f0-9]{64}$/.test(contentHash ?? '') || !Number.isFinite(Date.parse(createdAt))) {
    checks.push(`${manifestPath}: invalid release metadata`);
  }
  if (!snapshot || createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') !== contentHash) {
    checks.push(`${manifestPath}: snapshot does not match the release fingerprint`);
  }
  requireText('index.html', `name="cbl-schedule-release" content="${contentHash}"`, 'homepage release marker must match the schedule manifest');
  const actualCache = read('sw.js').toString('utf8').match(/^const CACHE_NAME = "([^"]+)";/m)?.[1];
  if (!actualCache?.startsWith('cbl-season-3-') || actualCache !== workerCache) {
    checks.push('sw.js: cache name must match the schedule manifest');
  }
  if (Object.keys(integrity ?? {}).sort().join('|') !== [...sources].sort().join('|')) {
    checks.push(`${manifestPath}: integrity must cover the three official source files`);
  }
  for (const file of sources) {
    // Git publishes LF bytes; Windows checkouts may materialize the same blob with CRLF.
    const source = read(file);
    const rawHash = createHash('sha256').update(source).digest('hex');
    const lfHash = createHash('sha256').update(source.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
    if (rawHash !== integrity?.[file] && lfHash !== integrity?.[file]) {
      checks.push(`${file}: contents do not match the schedule manifest`);
    }
  }
} catch (error) {
  checks.push(`${manifestPath}: ${error.message}`);
}

if (checks.length) {
  console.error('\n❌ Push notification integrity check failed:\n');
  for (const item of checks) console.error(`- ${item}`);
  console.error('\nNotification files may have been overwritten by an older bulk update.\n');
  process.exit(1);
}

console.log('✅ Push notification integrity check passed.');
