# Build brief — a reading log

Self-contained. You need nothing from the conversation that produced this.

## What to build

A one-page build plan for a personal reading log, plus a sketch of its logging screen.

**The deliverable is the plan, not the app.** The person you are writing for can code; what they
have not decided is what to build. Write for someone reading it on a train: one page, plain
language, and an explicit list of what *not* to build — they asked for that specifically, saying
it is the part they always get wrong.

## The goal

A log they actually keep up. They have tried Goodreads twice and abandoned it twice, both times
because logging a book took about six taps and the social side got in the way. Speed is the whole
product.

## What's already decided

| | |
|---|---|
| **Fields** | Title only, to start. |
| **Entries** | Both finished *and* abandoned books. Abandoning happens more often than finishing. |
| **Data shape** | Entries must be able to gain fields later without breaking or rewriting old ones. |
| **Offline** | Tapping save in a tunnel saves immediately, on the device, and syncs later if it needs to. It must never show an error and ask them to come back. |
| **Backup** | A copy lives somewhere other than the phone. |
| **Platform** | Phone. This happens on a commute, not at a desk. |
| **Accounts** | None. No feed, no friends, nobody else ever sees it. |

## Out of scope

- Anything social: sharing, following, feeds, public lists. Ruled out twice, explicitly.
- Ratings, reviews, page counts, progress tracking. All of it was offered and declined — that is
  the shape of the app they already quit.
- Importing existing data from Goodreads. Offered and not chosen.

Out of scope is not "later". Adding any of it back is a decision to re-open, not an omission
to fix.

## How to know it is done

1. **Day one:** logging a finished book takes **three taps or fewer**. Count them. This is the bar
   Goodreads failed at six.
2. **A month later:** they are still using it. This is the real test, and it cannot be checked on
   day one, which is why the tap count exists.

## Decided by assumption, not agreement

Nothing. Every line above rests on an answer they gave.

One open thread, flagged rather than unresolved: they asked what the off-phone backup *actually
involves* to set up. They said it is not a blocker, but they want it spelled out in the plan
rather than left as "sync it somewhere". Answer it in the plan.

## Where this came from

`examples/reading-log/` — two rounds of scoping. `SCOPE.md` has each decision with the answer that
earned it; `round-N.answers.md` are the user's replies verbatim.
