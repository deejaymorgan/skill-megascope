// inject.mjs — kept as a stable import path for the dev scripts.
//
// The operation itself now lives in `skills/megascope/assets/megascope.mjs`,
// inside the skill, where a run can actually reach it. It used to live only
// here, which is why SKILL.md told Claude to read a 53 KB engine and splice the
// data block by hand every run.
export { injectData } from '../skills/megascope/assets/megascope.mjs';
