// mutations.mjs — the invalid corpus, one entry per guarantee.
//
// Each entry is a SINGLE mutation of a valid round file, plus the failure it is
// supposed to provoke. Expressing them as mutations rather than as ~40 copied
// JSON files is deliberate: "single mutation" becomes true by construction
// instead of by inspection, the diff from valid to invalid is the thing you
// read, and a schema change does not mean editing forty near-identical files.
//
//   expect.keyword  the guarantee is STRUCTURAL — ajv and the walker must both
//                   reject it, on that keyword at that instance path
//   expect.check    the guarantee is SEMANTIC — the file is deliberately
//                   schema-VALID, so only the named check (S1-S15) catches it.
//                   That the file validates is itself asserted: if the schema
//                   started rejecting it, the check would never be exercised
//                   and would rot untested.
//
// `param` matches ajv's params for keywords that carry one (missingProperty for
// `required`, additionalProperty for `additionalProperties`).

export const MUTATIONS = [
  // ── caps: the pressure that makes rounds real ──────────────────────────────
  {
    id: 'options-5',
    guarantee: 'a question may not offer more than four options',
    base: 'round-1',
    mutate: (d) => {
      d.questions[0].options.push({ key: 'd', label: 'Something else', detail: 'A fourth way of doing it entirely.' });
      d.questions[0].options.push({ key: 'e', label: 'Something else again', detail: 'And a fifth, at which point it is a survey.' });
    },
    expect: { keyword: 'maxItems', path: '/questions/0/options' },
  },
  {
    id: 'questions-9',
    guarantee: 'a round may not carry more than eight questions',
    base: 'round-1',
    mutate: (d) => {
      for (let i = 0; i < 4; i++) {
        const extra = structuredClone(d.questions[0]);
        extra.id = 'X' + i;
        d.questions.push(extra);
      }
    },
    expect: { keyword: 'maxItems', path: '/questions' },
  },
  {
    id: 'sections-5',
    guarantee: 'a round may not carry more than four sections',
    base: 'round-1',
    mutate: (d) => {
      d.sections.push({ id: 'X', title: 'Extra one' }, { id: 'Y', title: 'Extra two' }, { id: 'Z', title: 'Extra three' });
    },
    expect: { keyword: 'maxItems', path: '/sections' },
  },
  {
    id: 'scope-4-slots',
    guarantee: 'the scope panel is exactly five slots',
    base: 'round-1',
    mutate: (d) => { d.meta.scope.pop(); },
    expect: { keyword: 'minItems', path: '/meta/scope' },
  },

  // ── the measured fault: option labels ──────────────────────────────────────
  {
    id: 'label-slash-list',
    guarantee: 'an option label cannot smuggle a slash-list past the length cap',
    base: 'round-1',
    mutate: (d) => { d.questions[0].options[0].label = 'Frost/wind/rain'; },
    expect: { keyword: 'not', path: '/questions/0/options/0/label' },
  },
  {
    id: 'label-nine-words',
    guarantee: 'an option label is at most seven words',
    base: 'round-1',
    mutate: (d) => { d.questions[0].options[0].label = 'one two three four five six seven eight nine'; },
    expect: { keyword: 'pattern', path: '/questions/0/options/0/label' },
  },
  {
    id: 'label-too-long',
    guarantee: 'an option label is at most 48 characters',
    base: 'round-1',
    mutate: (d) => { d.questions[0].options[0].label = 'Warning-plus-record-plus-forecast-plus-everything-else'; },
    expect: { keyword: 'maxLength', path: '/questions/0/options/0/label' },
  },
  {
    id: 'detail-too-short',
    guarantee: 'an option detail has to say something',
    base: 'round-1',
    mutate: (d) => { d.questions[0].options[0].detail = 'Good.'; },
    expect: { keyword: 'minLength', path: '/questions/0/options/0/detail' },
  },
  {
    id: 'option-key-underscore',
    guarantee: 'a leading underscore is reserved — __own is the engine\'s key',
    base: 'round-1',
    mutate: (d) => { d.questions[0].options[2].key = '_own'; },
    expect: { keyword: 'pattern', path: '/questions/0/options/2/key' },
  },

  // ── the four-part question shape ───────────────────────────────────────────
  {
    id: 'question-no-question-mark',
    guarantee: 'the question field is actually a question',
    base: 'round-1',
    mutate: (d) => { d.questions[0].question = 'What the station is mainly for'; },
    expect: { keyword: 'pattern', path: '/questions/0/question' },
  },
  {
    id: 'technical-without-example',
    guarantee: 'a technical question must carry its concrete example',
    base: 'round-1',
    mutate: (d) => { delete d.questions[2].example; },
    expect: { keyword: 'required', path: '/questions/2', param: 'example' },
  },
  {
    id: 'example-without-technical',
    guarantee: 'a non-technical question must not carry an example key at all',
    base: 'round-1',
    mutate: (d) => { d.questions[0].example = 'An example on a question that never claimed to be technical.'; },
    expect: { keyword: 'not', path: '/questions/0' },
  },
  {
    id: 'switchif-missing',
    guarantee: 'the runner-up condition is structural, not optional advice',
    base: 'round-1',
    mutate: (d) => { delete d.questions[0].switchIf; },
    expect: { keyword: 'required', path: '/questions/0', param: 'switchIf' },
  },
  {
    id: 'why-too-short',
    guarantee: 'why has a floor — the fault must not relocate to terse-and-vacuous',
    base: 'round-1',
    mutate: (d) => { d.questions[0].why = 'It is better.'; },
    expect: { keyword: 'minLength', path: '/questions/0/why' },
  },
  {
    id: 'why-too-long',
    guarantee: 'why caps at 200 — the v1 corpus reached 221',
    base: 'round-1',
    mutate: (d) => { d.questions[0].why = 'Frost is the one that costs you fruit. '.repeat(6); },
    expect: { keyword: 'maxLength', path: '/questions/0/why' },
  },
  {
    id: 'breakdown-one-item',
    guarantee: 'a breakdown of one is a paragraph wearing a list\'s clothes',
    base: 'round-1',
    mutate: (d) => { d.questions[0].breakdown = [d.questions[0].breakdown[0]]; },
    expect: { keyword: 'minItems', path: '/questions/0/breakdown' },
  },
  {
    id: 'context-missing',
    guarantee: 'every question says why it is on the table',
    base: 'round-1',
    mutate: (d) => { delete d.questions[0].context; },
    expect: { keyword: 'required', path: '/questions/0', param: 'context' },
  },

  // ── the scope panel ────────────────────────────────────────────────────────
  {
    id: 'slot-text-too-short',
    guarantee: 'a slot cannot be settled with two characters of hand-waving',
    base: 'round-1',
    mutate: (d) => { d.meta.scope[2].text = 'It is basically fine.'; },
    expect: { keyword: 'minLength', path: '/meta/scope/2/text' },
  },
  {
    id: 'settled-without-evidence',
    guarantee: 'a slot settled on the user\'s answers must cite at least one',
    base: 'round-2',
    mutate: (d) => { d.meta.scope[0].evidence = []; },
    expect: { keyword: 'minItems', path: '/meta/scope/0/evidence' },
  },
  {
    id: 'evidence-chat',
    guarantee: '"chat" is not evidence — the grammar is r<n>:<qid>',
    base: 'round-2',
    mutate: (d) => { d.meta.scope[0].evidence = ['chat']; },
    expect: { keyword: 'pattern', path: '/meta/scope/0/evidence/0' },
  },
  {
    id: 'assumed-without-assumption',
    guarantee: 'an assumption has to be written down',
    base: 'round-1',
    mutate: (d) => { d.meta.scope[2].assumption = null; },
    expect: { keyword: 'type', path: '/meta/scope/2/assumption' },
  },
  {
    id: 'assumption-without-assumed',
    guarantee: 'only an assumed slot may carry an assumption',
    base: 'round-2',
    mutate: (d) => { d.meta.scope[0].assumption = 'Quietly assumed, while claiming to rest on the answers above.'; },
    expect: { keyword: 'type', path: '/meta/scope/0/assumption' },
  },
  {
    id: 'deliverable-settled-without-kind',
    guarantee: 'a settled deliverable must say what kind of work this is',
    base: 'round-2',
    mutate: (d) => { delete d.meta.scope[1].kind; },
    expect: { keyword: 'required', path: '/meta/scope/1', param: 'kind' },
  },
  {
    id: 'kind-other-without-kindother',
    guarantee: '"other" has to say what it is',
    base: 'round-2',
    mutate: (d) => { d.meta.scope[1].kind = 'other'; },
    expect: { keyword: 'required', path: '/meta/scope/1', param: 'kindOther' },
  },
  {
    id: 'kind-on-wrong-slot',
    guarantee: 'kind belongs to the deliverable slot alone',
    base: 'round-2',
    mutate: (d) => { d.meta.scope[0].kind = 'experiment'; },
    expect: { keyword: 'type', path: '/meta/scope/0/kind' },
  },

  // ── the round, and the slug that cannot collide ────────────────────────────
  {
    id: 'project-carries-round-suffix',
    guarantee: 'the round never enters meta.project — the slug is derived',
    base: 'round-1',
    mutate: (d) => { d.meta.project = 'orchard-weather-station-r2'; },
    expect: { keyword: 'not', path: '/meta/project' },
  },
  {
    id: 'prev-missing-at-round-2',
    guarantee: 'from round 2 on, the previous round must be named',
    base: 'round-2',
    mutate: (d) => { d.meta.round.prev = null; },
    expect: { keyword: 'type', path: '/meta/round/prev' },
  },
  {
    id: 'prev-answers-missing-at-round-2',
    guarantee: 'no saved paste-back, no next round',
    base: 'round-2',
    mutate: (d) => { d.meta.round.prevAnswers = null; },
    expect: { keyword: 'type', path: '/meta/round/prevAnswers' },
  },
  {
    id: 'round-1-claims-a-predecessor',
    guarantee: 'round 1 cannot claim a round 0',
    base: 'round-1',
    mutate: (d) => { d.meta.round.prev = 'round-0.data.json'; },
    expect: { keyword: 'type', path: '/meta/round/prev' },
  },
  {
    id: 'format-version-1',
    guarantee: 'a v1 payload is refused loudly, not rendered blank',
    base: 'round-1',
    mutate: (d) => { d.formatVersion = 1; },
    expect: { keyword: 'const', path: '/formatVersion' },
  },

  // ── research ───────────────────────────────────────────────────────────────
  {
    id: 'deep-with-two-sources',
    guarantee: 'deep research has to name what it read',
    base: 'round-2',
    mutate: (d) => { d.meta.research.sources.pop(); },
    expect: { keyword: 'minItems', path: '/meta/research/sources' },
  },
  {
    id: 'round-1-deep-research',
    guarantee: 'round 1 must not make the user wait',
    base: 'round-1',
    mutate: (d) => { d.meta.research.mode = 'deep'; },
    expect: { keyword: 'enum', path: '/meta/research/mode' },
  },
  {
    id: 'round-2-without-trigger',
    guarantee: 'a later round must name what in the last export opened it',
    base: 'round-2',
    mutate: (d) => { delete d.meta.research.trigger; },
    expect: { keyword: 'required', path: '/meta/research', param: 'trigger' },
  },

  // ── carried-over v1 laxness, now closed ────────────────────────────────────
  {
    id: 'phases-block',
    guarantee: 'the phased plan is no longer a fixed part of the contract',
    base: 'round-1',
    mutate: (d) => { d.meta.context.blocks[0].type = 'phases'; },
    expect: { keyword: 'enum', path: '/meta/context/blocks/0/type' },
  },
  {
    id: 'unknown-meta-key',
    guarantee: 'the payload is closed — a typo is an error, not a silent no-op',
    base: 'round-1',
    mutate: (d) => { d.meta.headlne = 'A typo that used to vanish without trace.'; },
    expect: { keyword: 'additionalProperties', path: '/meta', param: 'headlne' },
  },

  // ══ semantic: deliberately schema-VALID, caught only by S1-S15 ═════════════
  {
    id: 'duplicate-question-id',
    guarantee: 'question ids are unique within a round',
    base: 'round-1',
    mutate: (d) => { d.questions[1].id = 'Q1'; },
    expect: { check: 'S1' },
  },
  {
    id: 'duplicate-section-id',
    guarantee: 'section ids are unique',
    base: 'round-1',
    mutate: (d) => { d.sections[1].id = 'P'; },
    expect: { check: 'S2' },
  },
  {
    id: 'section-ref-unknown',
    guarantee: 'every question lands in a section that exists',
    base: 'round-1',
    mutate: (d) => { d.questions[0].section = 'Z'; },
    expect: { check: 'S3' },
  },
  {
    id: 'rec-not-an-option',
    guarantee: 'the recommendation must be one of the options offered',
    base: 'round-1',
    mutate: (d) => { d.questions[0].rec = 'z'; },
    expect: { check: 'S4' },
  },
  {
    id: 'duplicate-option-key',
    guarantee: 'option keys are unique within a question',
    base: 'round-1',
    mutate: (d) => { d.questions[0].options[1].key = 'a'; },
    expect: { check: 'S4' },
  },
  {
    id: 'scope-slots-out-of-order',
    guarantee: 'the five slots appear once each, in canonical order',
    base: 'round-1',
    mutate: (d) => { const s = d.meta.scope; [s[0], s[1]] = [s[1], s[0]]; },
    expect: { check: 'S5' },
  },
  {
    id: 'question-targets-settled-slot',
    guarantee: 'you cannot ask about something you declared settled',
    base: 'round-2',
    mutate: (d) => { d.questions[0].slot = 'goal'; },
    expect: { check: 'S6' },
  },
  {
    id: 'open-slot-with-no-question',
    guarantee: 'every open slot is targeted — S6 and S7 together are exact cover',
    base: 'round-2',
    mutate: (d) => { d.questions[2].slot = 'boundary'; d.questions[3].slot = 'boundary'; },
    expect: { check: 'S7' },
  },
  {
    id: 'all-five-slots-settled',
    guarantee: 'a complete scope produces the kick-off prompt, not another round',
    base: 'round-2',
    mutate: (d) => {
      for (const i of [2, 3]) {
        d.meta.scope[i].state = 'settled';
        d.meta.scope[i].assumed = true;
        d.meta.scope[i].assumption = 'Settled without asking anyone, which is exactly what this check exists to catch.';
      }
    },
    expect: { check: 'S8' },
  },
  {
    id: 'no-advancement-since-prev',
    guarantee: 'a round that settles nothing is not a round',
    base: 'round-2',
    mutate: (d, bases) => {
      // the scope regresses to exactly what round 1 said, and the questions
      // re-target the same two open slots — legal in every structural sense
      d.meta.scope = structuredClone(bases['round-1'].meta.scope);
      d.questions[0].slot = 'goal';
      d.questions[1].slot = 'goal';
      d.questions[2].slot = 'deliverable';
      d.questions[3].slot = 'deliverable';
    },
    expect: { check: 'S9' },
  },
  {
    id: 'regression-without-reopened',
    guarantee: 'a slot that goes backwards has to say why',
    base: 'round-2',
    mutate: (d) => { d.meta.scope[2].reopened = null; },
    expect: { check: 'S9' },
  },
  {
    id: 'evidence-cites-rejected-answer',
    guarantee: 'a rejected question never counts as evidence',
    base: 'round-2',
    mutate: (d) => { d.meta.round.prevAnswers = '../answers/round-1-with-rejection.md'; },
    expect: { check: 'S10' },
  },
  {
    id: 'evidence-cites-absent-question',
    guarantee: 'evidence must resolve against the saved paste-back',
    base: 'round-2',
    mutate: (d) => { d.meta.scope[0].evidence = ['r1:Q9']; },
    expect: { check: 'S10' },
  },
  {
    id: 'of-less-than-n',
    guarantee: 'you cannot be on round 2 of 1',
    base: 'round-2',
    mutate: (d) => { d.meta.round.of = 1; },
    expect: { check: 'S11' },
  },
  {
    id: 'prev-answers-not-on-disk',
    guarantee: 'the previous round\'s files have to actually be there',
    base: 'round-2',
    mutate: (d) => { d.meta.round.prevAnswers = 'round-1.answers-that-do-not-exist.md'; },
    expect: { check: 'S12' },
  },
  {
    id: 'answers-file-for-the-wrong-scope',
    guarantee: 'the paste-back must belong to this scope and this round',
    base: 'round-2',
    mutate: (d) => { d.meta.round.prevAnswers = '../answers/round-1-wrong-scope.md'; },
    expect: { check: 'S12' },
  },
  {
    id: 'evidence-cites-this-round',
    guarantee: 'a round cannot cite answers it has not collected yet',
    base: 'round-2',
    mutate: (d) => { d.meta.scope[0].evidence = ['r2:Q6']; },
    expect: { check: 'S13' },
  },
  {
    id: 'unglossaried-acronym',
    guarantee: 'jargon is caught by requiring explanation, not by banning characters',
    base: 'round-2',
    mutate: (d) => { d.questions[0].options[0].detail = 'One reading, sampled by the RNG on each tick.'; },
    expect: { check: 'S14' },
  },
  {
    id: 'jargon-outside-the-allowed-fields',
    guarantee: 'identifier-shaped tokens live in example and detail, nowhere else',
    base: 'round-2',
    mutate: (d) => { d.questions[0].why = 'The mast sits in the warmest spot, so the CSV would quietly under-report.'; },
    expect: { check: 'S14' },
  },
  {
    id: 'glossary-entry-never-used',
    guarantee: 'a glossary is a contract, not a place to park terms',
    base: 'round-1',
    mutate: (d) => { d.meta.glossary = { OODA: 'a way of describing how quickly someone reacts to what they see' }; },
    expect: { check: 'S14' },
  },
  {
    id: 'technical-question-unresearched',
    guarantee: 'a technical question cannot exist unresearched',
    base: 'round-1',
    mutate: (d) => { d.meta.research.mode = 'none'; },
    expect: { check: 'S15' },
  },
  {
    id: 'favicon-is-two-emoji',
    guarantee: 'the favicon is exactly one emoji — counted in graphemes, which maxLength cannot do',
    base: 'round-1',
    mutate: (d) => { d.meta.favicon = '📎🧹'; },
    expect: { check: 'S16' },
  },
];
