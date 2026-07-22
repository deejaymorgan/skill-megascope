// inject.mjs — the one operation a megascope run performs on the engine shell.
// Replaces ONLY the contents of the <script id="scoping-data"> block with the
// run's questions-JSON. The rest of engine.html is byte-identical every run.
//
// Usage (as a library):
//   import { injectData } from './inject.mjs'
//   const html = injectData(engineHtml, dataObject)

const OPEN = '<script type="application/json" id="scoping-data">';
const CLOSE = '</script>';

/**
 * @param {string} engineHtml  Contents of assets/engine.html
 * @param {object|string} data Questions-JSON (object or pre-stringified)
 * @returns {string} engine HTML with the data block populated
 */
export function injectData(engineHtml, data) {
  const start = engineHtml.indexOf(OPEN);
  if (start === -1) throw new Error('inject: could not find scoping-data open tag in engine.html');
  const contentStart = start + OPEN.length;
  const end = engineHtml.indexOf(CLOSE, contentStart);
  if (end === -1) throw new Error('inject: could not find closing </script> for scoping-data');

  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  // Guard against a literal </script> inside string values breaking the block.
  const safe = json.replace(/<\/script/gi, '<\\/script');
  let out = engineHtml.slice(0, contentStart) + '\n' + safe + '\n' + engineHtml.slice(end);

  // Set the static <title> from meta.title (JS also does this at runtime; this makes
  // the standalone file, no-JS contexts, and the Artifact gallery show the real name).
  const obj = typeof data === 'string' ? safeParse(data) : data;
  const title = obj && obj.meta && obj.meta.title;
  if (title) {
    const clean = String(title).replace(/[<>]/g, '').trim();
    out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${clean} · Scoping</title>`);
  }
  return out;
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
