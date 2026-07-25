#!/usr/bin/env node
// megascope.mjs — the one tool a megascope run calls.
//
//   node megascope.mjs validate <round-N.data.json>
//   node megascope.mjs build    <round-N.data.json> [out.html]
//   node megascope.mjs ready    <scope-dir>/
//
// Zero dependencies: node built-ins only, so it runs from inside the deployed
// skill where there is no package.json and no node_modules.
//
// ── vocabulary ──────────────────────────────────────────────────────────────
// The structural pass interprets `schema.json` directly rather than re-encoding
// it, so there is exactly one copy of the contract. That only stays honest if
// the interpreter knows every keyword the schema uses: an unimplemented keyword
// is not an error, it is a guarantee that silently stops holding. KEYWORDS is
// the closed vocabulary both sides agree on, and `tests/schema.mjs` fails the
// build if schema.json ever reaches outside it.

/** Every JSON Schema keyword the walker implements, plus the annotations it ignores. */
export const KEYWORDS = new Set([
  // applicators
  'properties', 'additionalProperties', 'propertyNames', 'items',
  'oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else',
  '$ref', 'definitions',
  // assertions
  'type', 'required', 'enum', 'const',
  'minProperties', 'maxProperties',
  'minItems', 'maxItems', 'uniqueItems',
  'minLength', 'maxLength', 'pattern',
  'minimum', 'maximum',
  // annotations — parsed, never enforced
  '$schema', '$id', 'title', 'description', 'default',
]);
