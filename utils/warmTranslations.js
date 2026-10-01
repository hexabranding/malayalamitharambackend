const Article = require("../models/Article");
const {
  translateArticle,
  createPool,
  providersAvailable,
  isTranslatable,
  hasTranslation,
} = require("./translate");

// Keeps the translation cache warm so switching language never waits on a
// translator. It works on a small private queue, so a cold article can never
// be stuck behind the background job, and it stops as soon as a provider
// starts refusing instead of hammering it.
const LANGS = ["en", "ar"];
const BOOT_LIST_LIMIT = 150;
const BOOT_FULL_LIMIT = 40;
const REFRESH_LIST_LIMIT = 40;
const REFRESH_FULL_LIMIT = 10;
const PAUSE_MS = 2500;
const PAUSE_EVERY = 5;
const REFRESH_MS = 5 * 60 * 1000;
const BOOT_DELAY_MS = 15000;
const RETRY_MS = 60 * 1000;
const WARM_ARTICLE_DELAYS_MS = [5000, 15000, 30000, 60000];

const pool = createPool(2);

let running = false;
let retryTimer = null;

function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (timer.unref) timer.unref();
  });
}

async function warm({ listLimit, fullLimit }) {
  if (running) return false;
  if (!providersAvailable()) {
    console.log(" Translation warm-up postponed: providers cooling down");
    return false;
  }
  running = true;
  try {
    const docs = await Article.find({ published: true })
      .sort({ createdAt: -1 })
      .limit(listLimit)
      .lean({ virtuals: true });
    if (!docs.length) return true;

    let processed = 0;
    for (const lang of LANGS) {
      for (let i = 0; i < docs.length; i++) {
        if (!providersAvailable()) {
          console.log(` Translation warm-up stopped after ${processed} items: providers cooling down`);
          return false;
        }
        await translateArticle(docs[i], lang, { full: i < fullLimit, pool });
        processed += 1;
        if (processed % PAUSE_EVERY === 0) await sleep(PAUSE_MS);
      }
    }
    console.log(` Translations warmed: ${docs.length} articles x ${LANGS.join(",")}`);
    return true;
  } catch (err) {
    console.error("Translation warm-up failed:", err.message);
    return false;
  } finally {
    running = false;
  }
}

function startWarmup() {
  if (String(process.env.WARM_TRANSLATIONS || "").toLowerCase() === "off") return;

  const bootOpts = { listLimit: BOOT_LIST_LIMIT, fullLimit: BOOT_FULL_LIMIT };
  const refreshOpts = { listLimit: REFRESH_LIST_LIMIT, fullLimit: REFRESH_FULL_LIMIT };

  const boot = setTimeout(() => runWarm(bootOpts), BOOT_DELAY_MS);
  if (boot.unref) boot.unref();

  const refresh = setInterval(() => runWarm(refreshOpts), REFRESH_MS);
  if (refresh.unref) refresh.unref();
}

// A run that was skipped because providers are cooling down is retried shortly
// instead of waiting for the next interval, so cold articles are not left
// untranslated for 5 minutes.
function runWarm(opts) {
  Promise.resolve(warm(opts)).then((ok) => {
    if (ok || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      runWarm(opts);
    }, RETRY_MS);
    if (retryTimer.unref) retryTimer.unref();
  });
}

// A freshly created or edited article has a cold translation cache, so keep
// retrying (with backoff) until every language has it: the next time anyone
// switches language the article is already translated.
async function warmArticle(doc) {
  if (!doc || !isTranslatable(doc.title)) return true;
  for (let attempt = 0; attempt <= WARM_ARTICLE_DELAYS_MS.length; attempt++) {
    if (providersAvailable()) {
      for (const lang of LANGS) {
        try {
          await translateArticle(doc, lang, { full: true, pool });
        } catch (err) {
          console.error(`Article translation warm-up failed (${lang}):`, err.message);
        }
      }
      if (LANGS.every((lang) => hasTranslation(lang, doc.title))) return true;
    }
    if (attempt === WARM_ARTICLE_DELAYS_MS.length) break;
    await sleep(WARM_ARTICLE_DELAYS_MS[attempt]);
  }
  console.warn(` Article translation warm-up gave up on "${doc.title}"`);
  return false;
}

module.exports = { startWarmup, warm, warmArticle };
