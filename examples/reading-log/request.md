# The input request

What the user actually typed. Everything else in this directory was produced from it.

---

> I want to keep track of the books I read. I've tried Goodreads twice and bounced off
> both times — too much social stuff, and logging a book takes about six taps. I mostly
> finish books on the train home, so whatever this is, it needs to work there.
>
> I can write code, I just haven't decided what to build. Can you help me work out what
> it should actually be before I start?

---

## What this directory shows

A two-round scope, end to end:

| File | |
|---|---|
| `round-1.data.json` | round 1 — goal and deliverable. 5 questions, 2 sections. |
| `round-1.answers.md` | the paste-back, saved verbatim. One CHANGED, one OWN, one REJECTED, one FLAGGED. |
| `round-2.data.json` | round 2 — the train problem, boundary and verification, written from those answers. Its `meta.scope` shows the state **after** the close, which is why every slot reads `settled`; `round-2.answers.md` is what was actually asked. |
| `round-2.answers.md` | the second paste-back. |
| `SCOPE.md` | the record: five slots, each with the answers that earned it. |
| `KICKOFF.md` | the deliverable — a brief a fresh session can act on with nothing else. |

No `.html` is checked in. The documents are built from the data:

```bash
node skills/megascope/assets/megascope.mjs build examples/reading-log/round-1.data.json scratch/round-1.html
```

The close is checkable — this exits 0:

```bash
node skills/megascope/assets/megascope.mjs ready examples/reading-log/
```

Two things worth reading for:

- **Round 2 could not have been written before round 1 came back.** Q6 exists because the user
  rejected Q3, and Q8 exists because their own-words answer to Q4 opened something round 1 did not
  contain.
- **Round 1 settled three slots by assumption** and round 2 reopened one of them. That is the
  normal move, not a failure: you cannot ask what "done" means before you know what the thing is.
