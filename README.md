# dsh-directions

Fork one conversation into independent **direction branches** and synthesize the results back.

## What it does

- **Fork a direction** — type a side question in the *方向 (Directions)* view and press `Ctrl+Enter`.
  The branch is a real child session (fork subagent) that inherits the completed turns of the
  current conversation, then explores on its own. The main thread is never touched.
- **Watch the board** — the view lists every branch started from this conversation: status
  (running / done / failed / interrupted), the question, a one-glance conclusion, token usage,
  time, and whether it has already been folded back.
- **Synthesize** — select one or more branches and press *综合选中方向*. The plugin appends one
  visible user message to the main conversation containing the chosen conclusions and a
  synthesis instruction, so the main agent answers with the combined result.
- **Open / stop** — open a branch as its own conversation, or stop a branch that is still running.

## Cost note

Each branch re-sends the inherited conversation on its first request and then accumulates its own
usage, so branches cost tokens independently. The board shows each branch's own usage.

## Usage

1. Start (or resume) a conversation so its agent is live.
2. Switch the conversation body to the **方向** view.
3. Write the side question, `Ctrl+Enter`.
4. Repeat for other directions, then select and synthesize.

The board is read-only against the session log: it derives state from child sessions and the
subagent catalog, so it works for branches created in earlier visits too.
