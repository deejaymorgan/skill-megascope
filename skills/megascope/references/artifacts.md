# Artifacts: where they live, and who can see them

A scope produces files, and those files outlive the session that wrote them. This says where they
go, what happens to them by default, and what a run owes the user before any of it is published.

## Where they live

**`docs/scoping/<project>/`, relative to the repository the work is about.** One directory per
scope, named for the subject rather than the date. It is not negotiated per repo and not inferred
from what a repo happens to do with `notes/` or `docs/` — a convention that has to be rediscovered
is a convention that gets read differently every time.

| File | What it is |
|---|---|
| `round-<n>.data.json` | the questions-JSON for one round — the only thing a run generates |
| `round-<n>.answers.md` | the paste-back, saved **verbatim**. Evidence, never edited |
| `round-<n>.html` | the built document. Disposable — regenerate it from the data file |
| `SCOPE.md` | the record: five slots, their text, the answers that earned them |
| `KICKOFF.md` | the deliverable: a brief a fresh session can act on with nothing else |

Outside a repository — scoping something that has no code yet — use `docs/scoping/<project>/` under
whatever directory the work will live in, and say where you put it.

## The default posture is untracked

**Artifacts are local-only unless someone decides otherwise, and that decision is written down.**

This is not caution for its own sake. A scope absorbs whatever it touched on the way to an answer:
the user's own words verbatim, absolute paths with their home directory in them, directory listings
and file inventories pasted in as evidence, the names of things on their disk. None of that is
project decision-making, all of it arrives as a side effect of scoping properly, and it is
invisible in review because it reads as ordinary working detail.

The failure this prevents is specific and has happened: artifacts sat in a directory the repo
ignored, a later session wrote a brief there, the brief was cleared for committing on its merits,
and the personal detail inside it went unexamined because nobody was thinking about the file's
tracking status at the moment they thought about its content. Only git's own ignored-path warning
caught it.

At **intake**, before anything is written:

```bash
node assets/megascope.mjs env docs/scoping/<project>/
```

If E3 says *untracked but NOT ignored*, establish the posture. Prefer `.git/info/exclude` — the
artifacts are local, so the rule that hides them can be local too, and no tracked file changes:

```bash
echo 'docs/scoping/<project>/' >> .git/info/exclude
```

Use the repo's own `.gitignore` instead when the user wants the posture to hold for everyone who
works there, and say that is what you are doing — it edits a tracked file.

## Committing is an opt-in that owes a sanitisation pass

A repo may reasonably track its scoping artifacts. A private repo where the whole team scopes
together; an open-source project whose scope is the interesting part; this repository, which
commits its own scopes as worked examples. **That is a legitimate override, not a mistake** —
what is not legitimate is arriving there without noticing.

So: never commit artifacts because they happen to be in a tracked directory, and never as part of a
sweep. When the user asks for them to be committed, do this first, in this order.

1. **Say what the environment is.** Run `env`. If the repository is public — or its visibility could
   not be determined — say so plainly before anything else, and get an explicit yes. A request to
   commit made without knowing the repo is public is not consent to publish.
2. **Sanitise what will be committed.** Go through it looking for the five things a scope collects
   by accident:
   - absolute paths and home directories — rewrite as repo-relative, or name the thing not the path
   - directory listings, file inventories, sample records, anything pasted in as raw evidence —
     summarise the finding and drop the listing
   - verbatim user text quoted out of `round-<n>.answers.md` — cite `r<n>:<qid>` instead; the
     evidence reference is what the tool checks anyway
   - names, hostnames, addresses, private URLs, anything belonging to a third party
   - anything that describes the machine rather than the decision
3. **Never commit `round-<n>.answers.md`.** It is the user's own words, saved verbatim, and it
   cannot be sanitised without ceasing to be the evidence the tool checks against.
4. **Record the decision** in each committed artifact's status header, below.
5. **Then ask.** Show what changed in the sanitisation pass and let the user confirm the commit.

The test to apply to a line you are unsure about: *would you paste this into a public issue on this
repository?* If the answer needs a pause, the answer is no.

## The status header

Every artifact a run **writes** — `SCOPE.md`, `KICKOFF.md`, any working notes — opens with its
title and then one line saying what its tracking status is:

```markdown
# Kick-off — <subject>

**Tracking:** untracked — local-only. Committing needs a sanitisation pass (`references/artifacts.md`).
```

```markdown
**Tracking:** committed deliberately — sanitised 2026-07-31. Public repository.
```

It is one line and it does one job: a future session opening this file learns its status from the
file itself, rather than inferring it from a directory it has to go and inspect. `env` reads it
too — a directory whose artifacts declare `**Tracking:** committed` reports as a deliberate
override instead of a warning, because the thing worth warning about is a posture nobody chose.

`round-<n>.answers.md` gets **no header**. It is saved exactly as it came back.

## The pointer

Untracked files are invisible to git, which means a fresh session has no way to find them: not in
`git status`, not in `git log`, not in a file listing anyone thinks to run.

So when a scope closes, add one line to the repository's `CLAUDE.md`, under this heading:

```markdown
## Active scoping briefs

- [<subject>](docs/scoping/<project>/KICKOFF.md) — <what it briefs, in a few words>. Untracked.
```

`CLAUDE.md` is tracked and loads into every session's context automatically, which is exactly the
discoverability the artifacts gave up. The pointer survives; the target stays local. Create the
heading if it is not there, keep the line to one, and delete it when the work it briefs is done.

## `env`, and what it will and will not do

```bash
node assets/megascope.mjs env docs/scoping/<project>/
```

| | |
|---|---|
| **E1** | where the directory sits, and which repository it is in |
| **E2** | whether that repository is published, and whether it is public |
| **E3** | the posture actually in force — ignored, tracked, or loose |

`ready` prints the same three rows at the close, so the last thing checked before a hand-over is
the same thing checked at intake.

**It is advisory and it never changes an exit code.** Every fact degrades to *unknown* rather than
failing: no git, no `gh`, no network, no GitHub remote. Unknown visibility is reported as a reason
to treat the repository as public, not as an error. A check that could block a scope from closing
over a missing binary would be switched off within a week, and the posture would go back to being
nobody's job.
