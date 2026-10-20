# Crit 10 reflection

## What was the breakthrough that moved the work forward?

I directed the addition of server-side logging that records key player
actions and identifies which player performed each one, while leaving out
passwords and message text. Unlike the in-game Activity feed, these logs
provide diagnostic information for tracing game events and investigating
unexpected behaviour. This helped me understand that visible feedback in the
interface and backend logging serve different purposes. A future improvement
would be to add severity levels and structured output, making relevant events
easier to find as the application grows.

The same week showed that my readings can mislead. `pnpm check` first failed
28 tests because they ran against an old server. Later
it failed 9 because I hadn't started the server with CI's settings. My own
plan said the expedition work was still unpushed, yet it had been live for
days. None of these was a bug in the game. Each was a reading that didn't
describe the current state. Writing down who may see and change what also
exposed two claims of mine that the code didn't support.

## What did this work change about who I want to be as a software developer?

In crit 9 I wrote that I wanted to get better at evaluating results. This
week taught me what that evaluation should rest on: state I have checked, not
a summary, whether the summary comes from an agent or from my own notes. I
want to treat "how will I know when this goes wrong?" as a design question
from the start, not something added after a feature ships.

It also made me more deliberate about directing the work. I approved the
logging plan before any code was written, and kept the chat redesign on a
separate branch so the live game wouldn't change the night before the crit.
That redesign has only been checked with screenshots so far. No one has
played it yet.
