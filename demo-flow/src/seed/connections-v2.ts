/** Connections list + per-tool permissions.
 *
 * Layout pattern derived from the desktop-app reference the user shared.
 * Every connection splits its tools into read-only and write/delete buckets.
 * Each tool has a 3-state permission (auto | allow | ask).
 */

export type PermState = "auto" | "allow" | "ask";

export type ToolPermission = {
  id: string;
  name: string;
  state: PermState;
};

export type ConnectionV2 = {
  id: string;
  name: string;
  logo: Logo;
  connected: boolean;
  description: string;
  readOnly: ReadonlyArray<ToolPermission>;
  writeDelete: ReadonlyArray<ToolPermission>;
};

export type Logo = {
  kind: "square";
  bg: string;
  fg: string;
  /** single character or short acronym rendered inside the square */
  mark: string;
};

const L = (bg: string, fg: string, mark: string): Logo => ({ kind: "square", bg, fg, mark });

/** Ordered to match the reference desktop app's sidebar. */
export const connectionsV2: ReadonlyArray<ConnectionV2> = [
  {
    id: "slack",
    name: "Slack",
    logo: L("#ffffff", "#611f69", "#"),
    connected: true,
    description:
      "Search messages, access channels, read threads, and stay connected with your team's communications. Find relevant discussions and context quickly.",
    readOnly: [
      { id: "slack-ro-1", name: "Schedule message", state: "allow" },
      { id: "slack-ro-2", name: "Search publics", state: "allow" },
      { id: "slack-ro-3", name: "Search public and privates", state: "allow" },
      { id: "slack-ro-4", name: "Search channels", state: "allow" },
      { id: "slack-ro-5", name: "Search users", state: "allow" },
      { id: "slack-ro-6", name: "Read channels", state: "allow" },
      { id: "slack-ro-7", name: "Read threads", state: "allow" },
      { id: "slack-ro-8", name: "Read canvas", state: "allow" },
      { id: "slack-ro-9", name: "Read user profiles", state: "allow" },
    ],
    writeDelete: [
      { id: "slack-w-1", name: "Send message", state: "ask" },
      { id: "slack-w-2", name: "Create canvas", state: "allow" },
      { id: "slack-w-3", name: "Update canvas", state: "allow" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    logo: L("#ffffff", "#1a1a1a", "N"),
    connected: true,
    description:
      "Read and write across workspace pages, databases, and properties. Use Notion as the canonical home for playbooks, QBRs, and written records.",
    readOnly: [
      { id: "n-ro-1", name: "Search pages", state: "allow" },
      { id: "n-ro-2", name: "Read page content", state: "allow" },
      { id: "n-ro-3", name: "Query databases", state: "allow" },
      { id: "n-ro-4", name: "Read comments", state: "allow" },
    ],
    writeDelete: [
      { id: "n-w-1", name: "Append to page", state: "allow" },
      { id: "n-w-2", name: "Create page", state: "ask" },
      { id: "n-w-3", name: "Update database row", state: "ask" },
      { id: "n-w-4", name: "Delete page", state: "ask" },
    ],
  },
  {
    id: "ms365",
    name: "Microsoft 365",
    logo: L("#ffffff", "#0078d4", "M"),
    connected: true,
    description:
      "Access the Microsoft Graph — people, org hierarchy, calendar, and mail metadata. Read-mostly scope keeps the employee in control of what gets sent on their behalf.",
    readOnly: [
      { id: "m-ro-1", name: "Read people + profile", state: "allow" },
      { id: "m-ro-2", name: "Read org hierarchy", state: "allow" },
      { id: "m-ro-3", name: "List calendar events", state: "allow" },
      { id: "m-ro-4", name: "Read mail metadata", state: "allow" },
      { id: "m-ro-5", name: "Read Teams membership", state: "auto" },
    ],
    writeDelete: [
      { id: "m-w-1", name: "Create calendar event", state: "ask" },
      { id: "m-w-2", name: "Draft email (no send)", state: "allow" },
      { id: "m-w-3", name: "Send email", state: "ask" },
    ],
  },
  {
    id: "linear",
    name: "Linear",
    logo: L("#5e6ad2", "#ffffff", "L"),
    connected: true,
    description:
      "Query issues, cycles, projects, and milestones. Create follow-ups from account conversations without leaving the workspace.",
    readOnly: [
      { id: "l-ro-1", name: "List issues", state: "allow" },
      { id: "l-ro-2", name: "Read project", state: "allow" },
      { id: "l-ro-3", name: "Read cycle", state: "allow" },
    ],
    writeDelete: [
      { id: "l-w-1", name: "Create issue", state: "allow" },
      { id: "l-w-2", name: "Update issue status", state: "ask" },
      { id: "l-w-3", name: "Delete issue", state: "ask" },
    ],
  },
  {
    id: "datadog",
    name: "Datadog",
    logo: L("#632ca6", "#ffffff", "D"),
    connected: true,
    description:
      "Query metrics, logs, and APM traces. Useful for ops digests and customer-incident correlation.",
    readOnly: [
      { id: "d-ro-1", name: "Query metrics", state: "allow" },
      { id: "d-ro-2", name: "Search logs", state: "allow" },
      { id: "d-ro-3", name: "Read dashboard", state: "allow" },
    ],
    writeDelete: [
      { id: "d-w-1", name: "Create monitor", state: "ask" },
    ],
  },
  {
    id: "sap-concur",
    name: "SAP Concur",
    logo: L("#0079c1", "#ffffff", "S"),
    connected: true,
    description:
      "Pull travel + expense context when drafting customer follow-ups. Know who visited whom, when, and whether a T&E report was filed.",
    readOnly: [
      { id: "sc-ro-1", name: "List expense reports", state: "allow" },
      { id: "sc-ro-2", name: "Read travel itineraries", state: "allow" },
      { id: "sc-ro-3", name: "Search vendors", state: "allow" },
    ],
    writeDelete: [
      { id: "sc-w-1", name: "Start expense report", state: "ask" },
      { id: "sc-w-2", name: "Submit for approval", state: "ask" },
    ],
  },
  {
    id: "snowflake",
    name: "Snowflake",
    logo: L("#ffffff", "#29b5e8", "❄"),
    connected: true,
    description:
      "Run parameterized SQL against the shared data warehouse. Scoped to the current employee's role; no DDL.",
    readOnly: [
      { id: "sf-ro-1", name: "Describe schema", state: "allow" },
      { id: "sf-ro-2", name: "Run SELECT", state: "allow" },
      { id: "sf-ro-3", name: "Read query history", state: "allow" },
    ],
    writeDelete: [],
  },
  {
    id: "postgres",
    name: "Postgres",
    logo: L("#336791", "#ffffff", "P"),
    connected: true,
    description:
      "Direct connection to the regional prospect index. Read-only — mutations go through the sales-ops pipeline instead.",
    readOnly: [
      { id: "p-ro-1", name: "List tables", state: "allow" },
      { id: "p-ro-2", name: "Run SELECT", state: "allow" },
    ],
    writeDelete: [],
  },
  {
    id: "granola",
    name: "Granola",
    logo: L("#f4efe4", "#1a1612", "G"),
    connected: true,
    description:
      "Read meeting notes authored in Granola. A complement to Otter transcripts — Granola captures the human-written summary after the fact.",
    readOnly: [
      { id: "g-ro-1", name: "List notes", state: "allow" },
      { id: "g-ro-2", name: "Read note", state: "allow" },
    ],
    writeDelete: [
      { id: "g-w-1", name: "Append to note", state: "allow" },
    ],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    logo: L("#00a1e0", "#ffffff", "S"),
    connected: true,
    description:
      "Query Accounts, Contacts, Opportunities, and Activities. The CRM is the source of truth for every customer-facing decision.",
    readOnly: [
      { id: "sfdc-ro-1", name: "Read Account", state: "allow" },
      { id: "sfdc-ro-2", name: "Read Contact", state: "allow" },
      { id: "sfdc-ro-3", name: "Read Opportunity", state: "allow" },
      { id: "sfdc-ro-4", name: "Read Activity", state: "allow" },
      { id: "sfdc-ro-5", name: "Run SOQL", state: "auto" },
    ],
    writeDelete: [
      { id: "sfdc-w-1", name: "Log activity", state: "allow" },
      { id: "sfdc-w-2", name: "Update opportunity", state: "ask" },
      { id: "sfdc-w-3", name: "Create contact", state: "ask" },
    ],
  },
  {
    id: "gong",
    name: "Gong",
    logo: L("#6f42c1", "#ffffff", "G"),
    connected: true,
    description:
      "Read call transcripts and highlights for any account in the regional book.",
    readOnly: [
      { id: "gg-ro-1", name: "Search calls", state: "allow" },
      { id: "gg-ro-2", name: "Read transcript", state: "allow" },
      { id: "gg-ro-3", name: "Read highlights", state: "allow" },
    ],
    writeDelete: [],
  },
  {
    id: "apollo",
    name: "Apollo",
    logo: L("#3a44c3", "#ffffff", "A"),
    connected: true,
    description:
      "Enrich companies and contacts, verify emails, and run prospecting searches. The first-stop data source for outbound.",
    readOnly: [
      { id: "a-ro-1", name: "Find company", state: "allow" },
      { id: "a-ro-2", name: "Find contact", state: "allow" },
      { id: "a-ro-3", name: "Verify email", state: "allow" },
      { id: "a-ro-4", name: "Enrich by domain", state: "allow" },
    ],
    writeDelete: [
      { id: "a-w-1", name: "Save sequence", state: "ask" },
      { id: "a-w-2", name: "Start sequence", state: "ask" },
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    logo: L("#ff7a59", "#ffffff", "H"),
    connected: true,
    description:
      "Marketing-side CRM context — form submissions, campaign touches, lifecycle stage, and lead score. Useful for triaging inbound and mapping to SFDC.",
    readOnly: [
      { id: "hs-ro-1", name: "Read contact", state: "allow" },
      { id: "hs-ro-2", name: "Read company", state: "allow" },
      { id: "hs-ro-3", name: "List form submissions", state: "allow" },
      { id: "hs-ro-4", name: "Read lifecycle stage", state: "allow" },
    ],
    writeDelete: [
      { id: "hs-w-1", name: "Update contact property", state: "ask" },
      { id: "hs-w-2", name: "Enroll in workflow", state: "ask" },
    ],
  },
  {
    id: "servo",
    name: "Servo",
    logo: L("#1a1612", "#ffffff", "S"),
    connected: true,
    description:
      "Internal ticketing for lab-ops, service contracts, and field-engineer scheduling.",
    readOnly: [
      { id: "sv-ro-1", name: "Search tickets", state: "allow" },
      { id: "sv-ro-2", name: "Read ticket", state: "allow" },
    ],
    writeDelete: [
      { id: "sv-w-1", name: "Open ticket", state: "allow" },
      { id: "sv-w-2", name: "Reassign ticket", state: "ask" },
    ],
  },
  {
    id: "hex",
    name: "Hex",
    logo: L("#ff4554", "#ffffff", "H"),
    connected: true,
    description:
      "Read Hex notebook cells, run saved projects against the warehouse, and attach outputs to conversations.",
    readOnly: [
      { id: "hx-ro-1", name: "List projects", state: "allow" },
      { id: "hx-ro-2", name: "Read cell output", state: "allow" },
    ],
    writeDelete: [
      { id: "hx-w-1", name: "Run project", state: "allow" },
      { id: "hx-w-2", name: "Publish snapshot", state: "ask" },
    ],
  },
  {
    id: "gworkspace",
    name: "Google Workspace",
    logo: L("#4285f4", "#ffffff", "G"),
    connected: true,
    description:
      "Personal-layer context: Drive, Gmail, Calendar. Drafts-only for mail so the employee ships every message themselves.",
    readOnly: [
      { id: "gw-ro-1", name: "Read Drive", state: "allow" },
      { id: "gw-ro-2", name: "Search Gmail", state: "allow" },
      { id: "gw-ro-3", name: "Read Calendar", state: "allow" },
    ],
    writeDelete: [
      { id: "gw-w-1", name: "Create draft", state: "allow" },
      { id: "gw-w-2", name: "Send email", state: "ask" },
      { id: "gw-w-3", name: "Create calendar event", state: "ask" },
    ],
  },
];

/** Compute the rollup state for a bucket of tools — matches reference app's
 * "Allow" / "Mixed" / "Ask" badge next to each section header. */
export function bucketRollup(tools: ReadonlyArray<ToolPermission>): "auto" | "allow" | "ask" | "mixed" | "empty" {
  if (tools.length === 0) return "empty";
  const first = tools[0]!.state;
  return tools.every((t) => t.state === first) ? first : "mixed";
}
