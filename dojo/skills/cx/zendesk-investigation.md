---
name: zendesk-investigation
description: Investigate a Zendesk ticket by pulling ticket history, checking account health, and suggesting resolution paths.
author: cx-team
team: cx
tags:
  - zendesk
  - salesforce
  - investigation
version: 0.1.0
requires:
  integrations:
    - zendesk
    - salesforce
---

# Zendesk Investigation

When the user asks you to investigate a Zendesk ticket, do the following:

1. Fetch the full ticket thread from `zendesk`, including internal notes.
2. Pull the reporter's full ticket history over the last 90 days to spot recurring issues.
3. Look up the reporter's account in `salesforce` and check:
   - Plan tier and contract value.
   - Last three CSM touches.
   - Any open escalations or at-risk flags.
4. Summarize the issue in two sentences, then propose up to three concrete resolution paths ranked by user-impact vs. effort.
5. If the account is at-risk or high-value, flag it at the top of the response so the CX lead sees it immediately.

Do not resolve the ticket or send any message on the user's behalf unless the user explicitly asks. Draft language only.
