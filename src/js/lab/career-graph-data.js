// Data for the career graph at /lab/career-graph/. Edit this file to change what the
// page shows. The scene, the detail panel and the HTML list are all built from it.
//
// Every fact here is already public on santhoshbelgavi.com or pragmaticagents.dev.
// Keep it that way: do not add a number that is not on one of the two sites, and keep
// the current employer unnamed ("A private equity firm").
//
// NODE FIELDS
//   id     unique key, used by EDGES
//   type   "employer" | "domain" | "system" | "result" | "project"
//   label  short name shown in the scene (keep it under about 30 characters)
//   group  where the node sits in space and in the HTML list: an employer id, a list
//          of employer ids for something used at more than one employer, or "projects"
//   from, to   employers only: years, used to place the employer on the timeline
//   role, years   optional line shown under the title in the detail panel
//   note   one or two plain sentences for the detail panel
//   link   optional path to a case study on this site
//
// EDGES are [from, to] pairs and read: employer -> domain -> system -> result.

// The time axis. Move `to` forward each year.
export const TIMELINE = { from: 2005, to: 2026 };

// Display names for the node types, in the order the filter buttons appear.
export const TYPES = {
  employer: { one: "Employer", many: "Employers" },
  domain: { one: "Business domain", many: "Domains" },
  system: { one: "System or technology", many: "Systems" },
  result: { one: "Result", many: "Results" },
  project: { one: "Independent project", many: "Projects" },
};

export const NODES = [
  // ---------- employers, oldest first (the tour follows this order) ----------
  { id: "goldman", type: "employer", label: "Goldman Sachs", from: 2005, to: 2006, role: "Software Engineer", years: "2005 to 2006",
    note: "Started in 2005 writing C++ for settlement systems. The work was settlement and clearance, replacing the Southeast Asia clearance system." },
  { id: "northern", type: "employer", label: "Northern Trust", from: 2006, to: 2007, role: "Software Engineer", years: "2006 to 2007",
    note: "PL/SQL and data work on stream reconciliation, including converting reports from Actuate to Crystal and scheduling them." },
  { id: "bny", type: "employer", label: "BNY Mellon", from: 2007, to: 2008, role: "Senior Software Engineer", years: "2007 to 2008",
    note: "SWIFT straight-through processing for corporate actions, built as modular PL/SQL, plus data integration for Private Wealth." },
  { id: "citi", type: "employer", label: "Citigroup", from: 2010, to: 2016, role: "Technology Lead and Data Analyst", years: "2010 to 2016",
    note: "The technology side of Private Bank client onboarding, integrated with Pershing NetX360, with KYC, AML and FATCA compliance and AML compliance metrics reporting." },
  { id: "suntrust", type: "employer", label: "SunTrust Mortgage", from: 2016, to: 2017, role: "Business Analyst", years: "2016",
    note: "Enhancements to the Empower loan origination system and workflow redesign and automations on the MSP servicing platform." },
  { id: "pnc", type: "employer", label: "PNC", from: 2017, to: 2022, role: "Senior Consultant and Senior Business Analyst", years: "2017 to 2022",
    note: "Modernizing the banking platform: customer interaction and offer management, the home-equity migration to MSP, and API contracts." },
  { id: "pe", type: "employer", label: "A private equity firm", from: 2022, to: 2026, role: "Senior Business Analyst and Product Owner", years: "2022 to now",
    note: "Treasury and middle-office modernization: margin, loan and derivative settlements. Owned the business architecture and integration design of the wire automation platform.",
    link: "/work/wire-automation/" },

  // ---------- Goldman Sachs ----------
  { id: "d-settlement", type: "domain", label: "Settlement and clearance", group: "goldman",
    note: "Where the career started in 2005: settlement systems at Goldman Sachs." },
  { id: "s-cpp", type: "system", label: "C++", group: "goldman",
    note: "The language of the settlement and clearance work at Goldman Sachs." },

  // ---------- Northern Trust ----------
  { id: "d-recon", type: "domain", label: "Reconciliation", group: "northern",
    note: "Stream reconciliation reporting at Northern Trust." },
  { id: "s-crystal", type: "system", label: "Crystal Reports", group: "northern",
    note: "Reports were converted from Actuate to Crystal and scheduled in Crystal Enterprise." },
  { id: "s-plsql", type: "system", label: "Oracle PL/SQL", group: ["northern", "bny", "citi"],
    note: "Years of PL/SQL and data work at Northern Trust, BNY Mellon and Citigroup." },

  // ---------- BNY Mellon ----------
  { id: "d-corpactions", type: "domain", label: "Corporate actions", group: "bny",
    note: "Modular PL/SQL processed SWIFT MT564 to MT567 messages so that corporate actions reached client portfolios in time." },
  { id: "s-swift", type: "system", label: "SWIFT messaging", group: ["bny", "pe"],
    note: "Used twice, fifteen years apart: corporate actions messages at BNY Mellon, then payment instructions for the wire platform." },
  { id: "r-bny-stp", type: "result", label: "Straight through on SWIFT", group: "bny",
    note: "Corporate-actions settlement at BNY Mellon ran straight through on SWIFT." },

  // ---------- Citigroup ----------
  { id: "d-onboarding", type: "domain", label: "Client onboarding", group: "citi",
    note: "Private Bank client onboarding, including the FATCA, AML and KYC checklists. Production issues were fixed at the source." },
  { id: "d-aml", type: "domain", label: "AML compliance reporting", group: "citi",
    note: "AML compliance metrics: reporting and analytics built on SQL views." },
  { id: "s-pershing", type: "system", label: "Pershing NetX360", group: "citi",
    note: "The onboarding platform was integrated with Pershing NetX360." },
  { id: "s-microstrategy", type: "system", label: "MicroStrategy", group: "citi",
    note: "SQL views fed the MicroStrategy reports for AML compliance metrics." },
  { id: "r-citi-stp", type: "result", label: "90% to 99.9% straight through", group: "citi",
    note: "Straight-through processing for client onboarding went from 90% to 99.9% in three months." },
  { id: "r-citi-days", type: "result", label: "5 days to 1 or 2 days", group: "citi",
    note: "Client onboarding went from five days to one or two days." },

  // ---------- SunTrust Mortgage ----------
  { id: "d-mortgage", type: "domain", label: "Mortgage servicing", group: ["suntrust", "pnc"],
    note: "Mortgage origination and servicing: workflow redesign and automations at SunTrust, then the home-equity migration at PNC." },
  { id: "s-msp", type: "system", label: "Empower and MSP", group: ["suntrust", "pnc"],
    note: "The Black Knight platforms: Empower for loan origination and MSP for servicing." },
  { id: "r-suntrust-29k", type: "result", label: "$29k a month saved", group: "suntrust",
    note: "A bankruptcy-suspense payment process, automated. 50 person-hours a day returned and $29k a month saved." },
  { id: "r-suntrust-nevada", type: "result", label: "$30k a year saved", group: "suntrust",
    note: "The Nevada-loan escrow calculation went the same way: 9 person-days returned and $30k a year saved." },

  // ---------- PNC ----------
  { id: "d-retail", type: "domain", label: "Retail banking", group: "pnc",
    note: "Modernizing the banking platform at PNC." },
  { id: "s-pega", type: "system", label: "PEGA", group: "pnc",
    note: "Customer interaction and offer management ran on PEGA." },
  { id: "s-api", type: "system", label: "API contracts and Swagger", group: "pnc",
    note: "FIS and BIAN API contracts and Swagger definitions." },

  // ---------- A private equity firm ----------
  { id: "d-wires", type: "domain", label: "Wire payments", group: "pe",
    note: "Treasury and middle office. Wires were assembled by hand, sent through bank portals and fax, and tracked in spreadsheets.",
    link: "/work/wire-automation/" },
  { id: "d-fundacct", type: "domain", label: "Fund accounting", group: "pe",
    note: "Fund operations for private markets: allocation and waterfall calculations, European and American style, and fund setup.",
    link: "/work/fund-onboarding-agent/" },
  { id: "s-wireplatform", type: "system", label: "Wire automation platform", group: "pe",
    note: "A modular, configuration-driven platform on rails the firm already owned. New funds, teams and settlement instructions are added as configuration, not code.",
    link: "/work/wire-automation/" },
  { id: "s-kyriba", type: "system", label: "Kyriba", group: "pe",
    note: "The treasury management system. Payment instructions flow through Kyriba and out through SWIFT.",
    link: "/work/wire-automation/" },
  { id: "s-gstb", type: "system", label: "Goldman Sachs Transaction Banking", group: "pe",
    note: "The banking rail that carries execution for the wire platform.",
    link: "/work/wire-automation/" },
  { id: "s-lemonedge", type: "system", label: "LemonEdge", group: "pe",
    note: "The fund accounting platform. Fund setup means configuring waterfall style, commitments, fee terms and allocation rules.",
    link: "/work/fund-onboarding-agent/" },
  { id: "s-vpm", type: "system", label: "VPM, IVP and TriOptima", group: "pe",
    note: "Other fund accounting and operations platforms used in the middle office." },
  { id: "s-fundagent", type: "system", label: "Fund-onboarding agent", group: "pe", years: "2025 to now",
    note: "A Claude-powered agent that reads fund inception documents and drives LemonEdge setup. A fund controller reviews and approves. In active development.",
    link: "/work/fund-onboarding-agent/" },
  { id: "s-claude", type: "system", label: "Claude", group: ["pe", "projects"],
    note: "The model behind the fund-onboarding agent. SanthoshIAS also exposes its data to Claude through an MCP interface." },
  { id: "r-350b", type: "result", label: "$350B+ in wires", group: "pe",
    note: "The platform has processed more than $350B in wires since inception.",
    link: "/work/wire-automation/" },
  { id: "r-stp", type: "result", label: "0% to 99%+ straight through", group: "pe",
    note: "Straight-through processing went from 0% to more than 99%.",
    link: "/work/wire-automation/" },
  { id: "r-swift", type: "result", label: "99.9% instructed via SWIFT", group: "pe",
    note: "99.9% of transactions are instructed via SWIFT.",
    link: "/work/wire-automation/" },
  { id: "r-500k", type: "result", label: "$500K+ saved", group: "pe",
    note: "Declining the vendor proposal saved over $500K in platform spend.",
    link: "/work/wire-automation/" },
  { id: "r-18x", type: "result", label: "18x volume, same headcount", group: "pe",
    note: "The platform absorbed roughly 18x volume growth without headcount growth and without architectural rework.",
    link: "/work/wire-automation/" },
  { id: "r-award", type: "result", label: "Adam Smith Awards 2024", group: "pe",
    note: "The work was recognized in the Adam Smith Awards 2024: Highly Commended, Top Treasury Team. The award went to the client's treasury team.",
    link: "/work/wire-automation/" },
  { id: "r-fundsetup", type: "result", label: "Weeks to days (target)", group: "pe",
    note: "Fund setup time, from weeks to days. This is a target. The agent is still in development.",
    link: "/work/fund-onboarding-agent/" },

  // ---------- independent projects (built and run on the owner's own infrastructure) ----------
  { id: "p-ias", type: "project", label: "SanthoshIAS", group: "projects", years: "2024 to now",
    note: "A financial data gateway that routes requests across six market data providers with automatic failover. It serves Moneta, FlowDeck and APEX.",
    link: "/work/santhoshias/" },
  { id: "p-moneta", type: "project", label: "Moneta", group: "projects", years: "2023 to now",
    note: "A self-hosted personal finance platform: 7,000+ transactions, three years of history, running on a Mac at home.",
    link: "/work/moneta/" },
  { id: "p-flowdeck", type: "project", label: "FlowDeck", group: "projects", years: "2024 to now",
    note: "A self-hosted options-flow analytics platform that replaced a paid SaaS subscription.",
    link: "/work/flowdeck/" },
  { id: "p-apex", type: "project", label: "APEX / AlphaEdge", group: "projects", years: "2023 to now",
    note: "An options analytics and semi-automated trading platform, now at v11, with a five-layer safety architecture. It runs in paper mode.",
    link: "/work/apex/" },
  { id: "p-sentinel", type: "project", label: "Sentinel", group: "projects", years: "2026 to now",
    note: "One dashboard that health-checks every service in the personal stack and turns each recurring failure into a playbook it runs automatically.",
    link: "/work/sentinel/" },
  { id: "p-kidstream", type: "project", label: "KidStream", group: "projects",
    note: "A curated, self-hosted media stack for children. Allowlisted content only, no algorithm, no ads, no tracking.",
    link: "/work/kidstream/" },
  { id: "s-rust", type: "system", label: "Rust", group: "projects",
    note: "SanthoshIAS and the FlowDeck engine are written in Rust." },
  { id: "s-duckdb", type: "system", label: "DuckDB", group: "projects",
    note: "The cache for historical market data in SanthoshIAS and APEX." },
  { id: "s-sqlite", type: "system", label: "Next.js, Hono and SQLite", group: "projects",
    note: "Moneta is a TypeScript monorepo: a Next.js frontend, a Hono API and a single SQLite file." },
  { id: "s-fastapi", type: "system", label: "Python and FastAPI", group: "projects",
    note: "The APEX backend." },
  { id: "r-ias", type: "result", label: "6 providers, 1 endpoint", group: "projects",
    note: "Six data providers unified behind one endpoint for the whole stack.",
    link: "/work/santhoshias/" },
  { id: "r-moneta", type: "result", label: "7s to 15ms data load", group: "projects",
    note: "A performance overhaul took the Moneta data load from about 7 seconds to about 15 milliseconds.",
    link: "/work/moneta/" },
  { id: "r-flowdeck", type: "result", label: "About 800 lines of Rust", group: "projects",
    note: "Roughly 800 lines of Rust at the core replaced the paid subscription. It costs nothing monthly.",
    link: "/work/flowdeck/" },
  { id: "r-apex", type: "result", label: "$86K+ paper losses fixed", group: "projects",
    note: "More than $86K in paper losses were diagnosed and engineered out across versions.",
    link: "/work/apex/" },
];

export const EDGES = [
  // Goldman Sachs
  ["goldman", "d-settlement"], ["d-settlement", "s-cpp"],
  // Northern Trust
  ["northern", "d-recon"], ["d-recon", "s-plsql"], ["d-recon", "s-crystal"],
  // BNY Mellon
  ["bny", "d-corpactions"], ["d-corpactions", "s-plsql"], ["d-corpactions", "s-swift"], ["s-swift", "r-bny-stp"],
  // Citigroup
  ["citi", "d-onboarding"], ["citi", "d-aml"],
  ["d-onboarding", "s-pershing"], ["d-onboarding", "s-plsql"], ["d-aml", "s-microstrategy"],
  ["s-pershing", "r-citi-stp"], ["s-pershing", "r-citi-days"],
  // SunTrust Mortgage
  ["suntrust", "d-mortgage"], ["d-mortgage", "s-msp"], ["s-msp", "r-suntrust-29k"], ["s-msp", "r-suntrust-nevada"],
  // PNC
  ["pnc", "d-retail"], ["pnc", "d-mortgage"], ["d-retail", "s-pega"], ["d-retail", "s-api"],
  // A private equity firm: wires
  ["pe", "d-wires"], ["d-wires", "s-wireplatform"],
  ["s-wireplatform", "s-kyriba"], ["s-wireplatform", "s-swift"], ["s-wireplatform", "s-gstb"],
  ["s-wireplatform", "r-350b"], ["s-wireplatform", "r-stp"], ["s-wireplatform", "r-500k"],
  ["s-wireplatform", "r-18x"], ["s-wireplatform", "r-award"], ["s-swift", "r-swift"],
  // A private equity firm: fund accounting
  ["pe", "d-fundacct"], ["d-fundacct", "s-lemonedge"], ["d-fundacct", "s-vpm"], ["d-fundacct", "s-fundagent"],
  ["s-fundagent", "s-lemonedge"], ["s-fundagent", "s-claude"], ["s-fundagent", "r-fundsetup"],
  // Independent projects
  ["p-moneta", "p-ias"], ["p-flowdeck", "p-ias"], ["p-apex", "p-ias"],
  ["p-sentinel", "p-ias"], ["p-sentinel", "p-moneta"], ["p-sentinel", "p-flowdeck"], ["p-sentinel", "p-apex"],
  ["p-ias", "s-rust"], ["p-ias", "s-duckdb"], ["p-ias", "s-claude"], ["p-flowdeck", "s-rust"],
  ["p-apex", "s-fastapi"], ["p-apex", "s-duckdb"], ["p-moneta", "s-sqlite"],
  ["p-ias", "r-ias"], ["p-moneta", "r-moneta"], ["p-flowdeck", "r-flowdeck"], ["p-apex", "r-apex"],
];
