const crypto = require("crypto");
const Translation = require("../models/Translation");

const MALAYALAM_RE = /[\u0D00-\u0D7F]/;
const DELIMITER = "\n@@SPLIT@@\n";
const CHUNK_ITEMS = 40;
const CHUNK_CHARS = 4000;
const CONCURRENCY = 6;
const TIMEOUT_MS = 15000;
const MEM_LIMIT = 20000;

// translate.google.com rate-limits this network (429), but the same engine is
// reachable through translate.googleapis.com. MyMemory is the last resort.
// Edge (Microsoft) needs no key and takes the whole batch in one request, so
// it is tried first: Google/MyMemory only pay for what Edge could not take.
const EDGE_URL = "https://edge.microsoft.com/translate/translatetext";
const GOOGLE_URL = "https://translate.googleapis.com/translate_a/single";
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
const MYMEMORY_MAX_CHARS = 450;
const MYMEMORY_EMAIL = process.env.TRANSLATE_EMAIL || "webmaster@malayalamitharam.in";
const FAIL_TTL_MS = 60 * 1000;
const COOLDOWN_STEPS_MS = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000];
const TRANSIENT_COOLDOWN_MS = 5 * 1000;

const mem = new Map();
const failed = new Map();

const SUPPORTED = new Set(["en", "ar"]);

function normalizeLang(value) {
  const lang = String(value || "").toLowerCase();
  return SUPPORTED.has(lang) ? lang : null;
}

function isTranslatable(value) {
  return typeof value === "string" && value.trim().length > 0 && MALAYALAM_RE.test(value);
}

// Google occasionally drops the outer markup of a paragraph; the page renders
// that text raw, so put the tags back.
function keepTags(source, value) {
  if (typeof value !== "string" || value === source) return value;
  let out = value;
  const open = source.match(/^\s*(<[a-z][a-z0-9]*\b[^>]*>)/i);
  if (open && !out.toLowerCase().includes(open[1].toLowerCase())) out = open[1] + out;
  const close = source.match(/(<\/[a-z][a-z0-9]*>)\s*$/i);
  if (close && !out.toLowerCase().endsWith(close[1].toLowerCase())) out = out + close[1];
  return out;
}

function hash(text) {
  return crypto.createHash("sha1").update(text, "utf8").digest("hex");
}

function cacheKey(lang, text) {
  return hash(lang + "\u0000" + text);
}

function remember(lang, text, translated) {
  const key = cacheKey(lang, text);
  if (mem.size >= MEM_LIMIT) mem.clear();
  failed.delete(key);
  mem.set(key, translated);
  Translation.updateOne(
    { key },
    { $set: { key, lang, text: translated } },
    { upsert: true }
  ).catch(() => {});
  return translated;
}

function lookup(lang, text) {
  return mem.get(cacheKey(lang, text));
}

// Providers can be down or rate-limited; remember that for a few minutes so
// every article request does not pay the same timeout again.
function markFailed(lang, text) {
  if (failed.size >= MEM_LIMIT) failed.clear();
  failed.set(cacheKey(lang, text), Date.now() + FAIL_TTL_MS);
}

function hasFailed(lang, text) {
  const key = cacheKey(lang, text);
  const until = failed.get(key);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  failed.delete(key);
  return false;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (timer.unref) timer.unref();
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function googleOnce(text, lang) {
  const body = new URLSearchParams({ client: "gtx", sl: "auto", tl: lang, dt: "t", q: text });
  const res = await fetchWithTimeout(GOOGLE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });
  if (!res.ok) throw Object.assign(new Error("google http " + res.status), { status: res.status });
  const data = await res.json();
  const segments = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : null;
  if (!segments) throw new Error("google bad payload");
  const out = segments.map((segment) => (Array.isArray(segment) ? segment[0] : "")).join("");
  if (!out.trim()) throw new Error("google empty result");
  return out;
}

// Microsoft's Edge translator endpoint: no key, no token, batch friendly.
async function edgeOnce(text, lang) {
  const url = EDGE_URL + "?from=ml&to=" + encodeURIComponent(lang) + "&isEnterpriseClient=false";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([text]),
  });
  if (!res.ok) throw Object.assign(new Error("edge http " + res.status), { status: res.status });
  const data = await res.json();
  const out =
    data && Array.isArray(data) && data[0] && data[0].translations && data[0].translations[0]
      ? data[0].translations[0].text
      : "";
  if (typeof out !== "string" || !out.trim()) throw new Error("edge empty result");
  return out;
}

function splitLong(text, size) {
  const parts = [];
  let rest = text;
  while (rest.length > size) {
    let cut = 0;
    for (const marker of ["\n", ". ", "? ", "! "]) {
      const idx = rest.lastIndexOf(marker, size);
      if (idx > cut) cut = idx + marker.length;
    }
    if (cut < size * 0.4) cut = size;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) parts.push(rest);
  return parts;
}

async function callMyMemoryOnce(text, lang) {
  const url =
    MYMEMORY_URL +
    "?q=" + encodeURIComponent(text) +
    "&langpair=" + encodeURIComponent("ml|" + lang) +
    "&de=" + encodeURIComponent(MYMEMORY_EMAIL);
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw Object.assign(new Error("mymemory http " + res.status), { status: res.status });
  const data = await res.json();
  const out = data && data.responseData && data.responseData.translatedText;
  if (typeof out !== "string" || !out.trim() || /MYMEMORY (WARNING|ERROR)/i.test(out)) {
    const quota = /QUOTA|ALL AVAILABLE FREE TRANSLATIONS/i.test(String(out));
    throw Object.assign(new Error("mymemory failed " + (data && data.responseStatus)), {
      status: quota ? 429 : 502,
    });
  }
  return out;
}

async function callMyMemory(text, lang) {
  const parts = splitLong(text, MYMEMORY_MAX_CHARS);
  const results = [];
  for (const part of parts) results.push(await callMyMemoryOnce(part, lang));
  return results.join("");
}

// Providers take themselves out of rotation after they start refusing, so a
// single throttled request never burns seconds on retries: the next call is
// answered from cache or returns the original text immediately.
const providers = [
  { name: "edge", run: (text, lang) => edgeOnce(text, lang), failures: 0, until: 0 },
  { name: "google", run: (text, lang) => googleOnce(text, lang), failures: 0, until: 0 },
  { name: "mymemory", run: (text, lang) => callMyMemory(text, lang), failures: 0, until: 0 },
];

let cooldownLogAt = 0;

function isRefusal(err) {
  return err && (err.status === 429 || err.status === 403);
}

function noteFailure(provider, err) {
  if (isRefusal(err)) provider.failures += 1;
  else provider.failures = 0;
  const wait = isRefusal(err)
    ? COOLDOWN_STEPS_MS[Math.min(provider.failures - 1, COOLDOWN_STEPS_MS.length - 1)]
    : TRANSIENT_COOLDOWN_MS;
  provider.until = Date.now() + wait;
  if (Date.now() - cooldownLogAt > 30 * 1000) {
    cooldownLogAt = Date.now();
    console.warn(` Translation provider "${provider.name}" paused for ${Math.round(wait / 1000)}s (${err && err.message})`);
  }
}

function providersAvailable() {
  const now = Date.now();
  return providers.some((provider) => provider.until <= now);
}

async function translateText(text, lang) {
  const now = Date.now();
  let lastError;
  for (const provider of providers) {
    if (provider.until > now) continue;
    try {
      const out = await provider.run(text, lang);
      provider.failures = 0;
      provider.until = 0;
      return out;
    } catch (err) {
      lastError = err;
      noteFailure(provider, err);
    }
  }
  throw lastError || new Error("translation providers unavailable");
}

function createPool(limit) {
  let active = 0;
  const queue = [];
  function next() {
    if (active >= limit || queue.length === 0) return;
    active += 1;
    const job = queue.shift();
    Promise.resolve()
      .then(job.fn)
      .then(job.resolve, job.reject)
      .then(() => {
        active -= 1;
        next();
      });
  }
  return function run(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

const run = createPool(CONCURRENCY);

function chunkify(items) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const item of items) {
    const cost = current.length ? DELIMITER.length + item.length : item.length;
    if (current.length && (current.length >= CHUNK_ITEMS || size + cost > CHUNK_CHARS)) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    size += current.length ? DELIMITER.length + item.length : item.length;
    current.push(item);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function translateChunk(items, lang) {
  // Every provider is refusing right now: answer instantly and let the caller
  // cache the miss instead of waiting on a request that cannot succeed.
  if (!providersAvailable()) return items.slice();

  const joined = items.join(DELIMITER);
  let raw = "";
  try {
    raw = await translateText(joined, lang);
  } catch (_) {
    raw = "";
  }
  if (raw) {
    const parts = raw.split("@@SPLIT@@");
    if (parts.length === items.length) {
      return parts.map((part, i) => {
        const value = part.replace(/^\n+|\n+$/g, "").trim();
        return value ? keepTags(items[i], value) : items[i];
      });
    }
  }
  const out = [];
  for (const item of items) {
    let single = "";
    try {
      single = await translateText(item, lang);
    } catch (_) {
      single = "";
    }
    out.push(single && single.trim() ? keepTags(item, single.trim()) : item);
  }
  return out;
}

async function translateMany(inputs, lang, options = {}) {
  const list = Array.isArray(inputs) ? inputs : [];
  if (!lang) return list;
  const pool = typeof options.pool === "function" ? options.pool : run;

  const wanted = [];
  const seen = new Set();
  for (const item of list) {
    if (!isTranslatable(item) || seen.has(item)) continue;
    seen.add(item);
    wanted.push(item);
  }

  let pending = wanted.filter((item) => !lookup(lang, item));

  if (pending.length) {
    try {
      const keys = pending.map((item) => cacheKey(lang, item));
      const found = await Translation.find({ key: { $in: keys } }).lean();
      for (const doc of found) mem.set(doc.key, doc.text);
      pending = pending.filter((item) => !lookup(lang, item));
    } catch (_) {}
  }

  pending = pending.filter((item) => !hasFailed(lang, item));

  if (pending.length) {
    const chunks = chunkify(pending);
    const results = await Promise.all(
      chunks.map((chunk) => pool(() => translateChunk(chunk, lang)))
    );
    results.forEach((values, index) => {
      const chunk = chunks[index];
      chunk.forEach((source, i) => {
        const translated = values[i];
        if (translated && translated !== source) remember(lang, source, translated);
        else markFailed(lang, source);
      });
    });
  }

  return list.map((item) => {
    if (!isTranslatable(item)) return item;
    const translated = lookup(lang, item);
    return translated ? keepTags(item, translated) : item;
  });
}

async function translateOne(text, lang) {
  const [result] = await translateMany([text], lang);
  return result;
}

// True when `text` already has a stored translation for `lang`, i.e. the
// next request in that language will be answered from cache.
function hasTranslation(lang, text) {
  if (!normalizeLang(lang) || !isTranslatable(text)) return false;
  return !!lookup(lang, text);
}

function collectStrings(doc, full) {
  const values = [];
  for (const field of ["title", "excerpt", "readTime"]) {
    if (isTranslatable(doc[field])) values.push(doc[field]);
  }
  if (isTranslatable(doc.categoryMl)) values.push(doc.categoryMl);
  if (full) {
    if (isTranslatable(doc.content)) values.push(doc.content);
    if (Array.isArray(doc.body)) {
      for (const para of doc.body) if (isTranslatable(para)) values.push(para);
    }
    if (Array.isArray(doc.relatedVideos)) {
      for (const video of doc.relatedVideos) {
        if (video && isTranslatable(video.title)) values.push(video.title);
      }
    }
  }
  return values;
}

// Returns a plain copy of the article with visitor-facing text in `lang`.
// Originals are preserved under *Ml keys so links/slug logic keeps working,
// and `categoryMl` is left untouched because it drives category filtering.
async function translateArticle(doc, lang, options = {}) {
  if (!doc || !lang) return doc;
  const full = !!options.full;
  const out = { ...doc };

  const values = collectStrings(doc, full);
  if (!values.length) return out;

  let translated;
  try {
    translated = await translateMany(values, lang, options);
  } catch (_) {
    return out;
  }
  const map = new Map();
  values.forEach((value, i) => map.set(value, translated[i]));

  const pick = (value) => (isTranslatable(value) ? map.get(value) || value : value);

  if (isTranslatable(doc.title)) {
    if (out.titleMl === undefined) out.titleMl = doc.title;
    out.title = pick(doc.title);
  }
  if (isTranslatable(doc.excerpt)) {
    if (out.excerptMl === undefined) out.excerptMl = doc.excerpt;
    out.excerpt = pick(doc.excerpt);
  }
  if (isTranslatable(doc.readTime)) {
    if (out.readTimeMl === undefined) out.readTimeMl = doc.readTime;
    out.readTime = pick(doc.readTime);
  }
  if (isTranslatable(doc.categoryMl)) out.categoryT = pick(doc.categoryMl);

  if (full) {
    if (isTranslatable(doc.content)) {
      if (out.contentMl === undefined) out.contentMl = doc.content;
      out.content = pick(doc.content);
    }
    if (Array.isArray(doc.body)) {
      if (out.bodyMl === undefined) out.bodyMl = doc.body;
      out.body = doc.body.map((para) => (isTranslatable(para) ? pick(para) : para));
    }
    if (Array.isArray(doc.relatedVideos)) {
      out.relatedVideos = doc.relatedVideos.map((video) =>
        video && isTranslatable(video.title)
          ? { ...video, title: pick(video.title) }
          : video
      );
    }
  }

  return out;
}

module.exports = {
  normalizeLang,
  isTranslatable,
  translateOne,
  translateMany,
  translateArticle,
  hasTranslation,
  createPool,
  providersAvailable,
};
