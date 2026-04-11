---
name: analyze-gong-competitive
description: Analyze a Gong call, extract competitive mentions, and draft a battlecard.
author: sales-team
team: sales
tags:
  - gong
  - salesforce
  - competitive
version: 0.1.0
requires:
  integrations:
    - gong
    - salesforce
---

# Analyze Gong Competitive Mentions

When the user asks you to analyze a Gong call for competitive intelligence, do the following in order:

1. Use the `gong` integration to fetch the full transcript of the specified call.
2. Scan the transcript for mentions of competitors by name. Maintain a rolling list of known competitors from prior battlecards.
3. For each mention, capture:
   - The verbatim quote with ~20 words of surrounding context.
   - Which speaker said it (prospect, rep, or other).
   - The sentiment (positive/neutral/negative toward our product).
4. Use the `salesforce` integration to pull the associated opportunity record and enrich each finding with deal size, stage, and account owner.
5. Draft a one-page battlecard grouped by competitor, listing the top three objections and the strongest responses already in the transcript.
6. Return the battlecard as inline markdown so it renders as a new tab in the workspace.

Do not fabricate competitor features. Only use what is in the transcript, the opportunity record, and any installed competitive-intel skills.
