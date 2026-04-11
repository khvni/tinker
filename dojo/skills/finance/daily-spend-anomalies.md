---
name: daily-spend-anomalies
description: Pull yesterday's spend anomalies from Snowflake and post a summary to Slack.
author: finance-team
team: finance
tags:
  - snowflake
  - slack
  - anomaly-detection
version: 0.1.0
requires:
  integrations:
    - snowflake
    - slack
---

# Daily Spend Anomalies

When the user asks for yesterday's spend anomalies, do the following:

1. Query `snowflake` for yesterday's transactions grouped by category, merchant, and cost center.
2. Compare each group to its trailing-30-day baseline. Flag anything that is:
   - More than 3σ above baseline, or
   - More than 2× the 30-day median, or
   - A net-new merchant above $5k.
3. Group flagged items by cost center and rank by dollar impact.
4. Draft a short Slack summary (under 1000 characters):
   - Total anomalous spend.
   - Top 5 line items with merchant, amount, and category.
   - A one-line "worth investigating" callout if anything looks like fraud or misclassification.
5. Post the summary to the Slack channel the user specified, or to `#fin-ops` by default.

This skill is designed to be run on a cron (e.g., `0 8 * * *`). When invoked from the scheduler, read the target channel from the scheduled-job metadata.
