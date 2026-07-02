# Tab 1

**Full Stack Developer Technical Assessment**

AI Visibility & Search Intelligence Platform

*Version 1.0  ·  Confidential — Internal Use Only*

# **Background & Context**

We build AI visibility and search intelligence software that helps businesses understand and improve how they appear in AI-generated answers (ChatGPT, Claude, Perplexity, etc.). A core part of our platform is a pipeline that:

* Discovers what questions people are asking AI assistants in a business's competitive space

* Tracks whether the business appears in those AI-generated answers

* Scores and ranks queries by opportunity value (search volume × competitive gap)

* Generates actionable content recommendations to improve AI visibility

This assessment asks you to design and build a simplified version of this pipeline — a RESTful Flask API with an AI-powered multi-agent backend (Task 1\) AND a functional frontend UI to interact with that API (Task 2).

**TASK 1 — Backend: AI Visibility Intelligence API**  

# **What You're Building (Task 1\)**

You will build a RESTful Flask API called the AI Visibility Intelligence API. The API lets a user register a business profile, trigger a multi-agent AI pipeline that discovers high-value queries in their competitive space, and then track and manage those queries over time.

## **The Multi-Agent Pipeline**

The core of this assessment is a pipeline orchestrated across three specialised AI agents. Each agent has a distinct responsibility. They should be implemented as separate, loosely coupled components that the orchestrator calls in sequence.

| Agent | Name | Responsibility |
| :---- | :---- | :---- |
| **Agent 1** | **Query Discovery Agent** | Given a business profile (domain, industry, competitors), generate a set of 10–20 realistic questions that users are likely to ask AI assistants when searching for products or services in this space. Think: 'What is the best SEO content tool?' or 'How does Surfer SEO compare to Clearscope?' These should be commercially relevant, natural-language questions. |
| **Agent 2** | **Visibility Scoring Agent** | Given a discovered query and a target domain, simulate checking whether that domain would appear in an AI-generated answer for that query. Score each query on: estimated search volume (real data), competitive difficulty (0–100), and an opportunity score you design. Return a structured result per query. |
| **Agent 3** | **Content Recommendation Agent** | Given the top-scoring queries where the target domain is NOT appearing, generate 3–5 specific, actionable content recommendations. Each recommendation should state what content to create, why it addresses the query gap, and what keywords/topics to cover. |

| 📌  AI Provider: Use either OpenAI (GPT-4o) or Anthropic (Claude) — your choice. You may use both if you want different agents on different models. Demonstrate deliberate reasoning about model selection in your README. |
| :---- |

# **API Specification**

Implement the following endpoints. All endpoints should return JSON. Authentication is out of scope — no auth layer is required.

## **Business Profile Endpoints**

**POST  /api/v1/profiles**

Register a new business profile. This is the entry point for the pipeline.

**Request body:**

{

  "name": "Surfer SEO",

  "domain": "surferseo.com",

  "industry": "SEO Software",

  "description": "AI-powered SEO content optimization tool",

  "competitors": \["clearscope.io", "marketmuse.com", "frase.io"\]

}

**Response (201):**

{

  "profile\_uuid": "abc-123",

  "name": "Surfer SEO",

  "domain": "surferseo.com",

  "status": "created",

  "created\_at": "2025-01-15T10:00:00Z"

}

**GET  /api/v1/profiles/{profile\_uuid}**

Retrieve a profile and its summary stats (total queries discovered, avg opportunity score).

## **Pipeline Endpoints**

**POST  /api/v1/profiles/{profile\_uuid}/run**

Trigger the full 3-agent pipeline for a profile. This is the core endpoint. The pipeline must run in sequence: Agent 1 → Agent 2 → Agent 3\.

**The response should include:**

* A pipeline run UUID

* Status (completed / failed)

* Count of queries discovered

* Count of queries scored

* Top 3 opportunity queries (with scores)

* Content recommendations from Agent 3

* Total tokens used (if available from your provider)

| ⚡  Performance note: The pipeline may take 10–30 seconds depending on your AI provider. You do not need to implement async/background processing — synchronous is fine. If you do implement async (e.g. Celery), note it in your README as a bonus. |
| :---- |

**GET  /api/v1/profiles/{profile\_uuid}/queries**

Return all discovered queries for a profile, sorted by opportunity score descending.

**Supports query params:**

* ?min\_score=0.5  — filter by minimum opportunity score

* ?status=visible|not\_visible|unknown  — filter by visibility status

* ?page=1\&per\_page=20  — pagination

**Each query object should include:**

* query\_text

* estimated\_search\_volume (integer)

* competitive\_difficulty (0–100)

* opportunity\_score (float, 0–1, your formula)

* domain\_visible (boolean)

* visibility\_position (integer or null)

* discovered\_at (ISO timestamp)

**GET  /api/v1/profiles/{profile\_uuid}/recommendations**

Return content recommendations generated by Agent 3\.

**Each recommendation should include:**

* recommendation\_uuid

* target\_query\_uuid (the query this addresses)

* content\_type (e.g. blog\_post, landing\_page, faq)

* title (suggested content title)

* rationale (why this content addresses the gap)

* target\_keywords (list of strings)

* priority (high / medium / low)

**POST  /api/v1/queries/{query\_uuid}/recheck**

Re-run Agent 2 (visibility scoring) on a single query. Returns updated scoring data. Useful for re-checking a query after content has been published.

# **Database & Data Models**

Use SQLAlchemy with SQLite or PostgreSQL. Define models for at least the following entities. The exact schema is your design decision — this is part of the evaluation.

| Model | Required Fields (minimum) |
| :---- | :---- |
| **BusinessProfile** | uuid, name, domain, industry, description, competitors (JSON), status, created\_at, updated\_at |
| **PipelineRun** | uuid, profile\_uuid (FK), status, queries\_discovered, queries\_scored, tokens\_used, error\_message, started\_at, completed\_at |
| **DiscoveredQuery** | uuid, profile\_uuid (FK), run\_uuid (FK), query\_text, estimated\_search\_volume, competitive\_difficulty, opportunity\_score, domain\_visible, visibility\_position, discovered\_at |
| **ContentRecommendation** | uuid, profile\_uuid (FK), query\_uuid (FK), content\_type, title, rationale, target\_keywords (JSON), priority, created\_at |

You may add additional fields, relationships, or models as you see fit. Justify your schema decisions briefly in the README.

# **Technical Requirements (Task 1\)**

## **Must Have**

1. Flask application with proper app factory pattern (create\_app())

2. SQLAlchemy models with migrations (Flask-Migrate or Alembic)

3. Three distinct AI agent functions/classes with clear separation of concerns

4. Prompt engineering: system prompts that produce structured, parseable JSON output from the LLM

5. JSON validation and error handling on every AI response — the pipeline must not crash on malformed LLM output

6. Proper HTTP status codes and consistent error response format across all endpoints

7. Environment variable management for API keys (.env / python-dotenv)

8. A runnable application — we must be able to clone and run it with docker-compose up or a simple setup script

9. A README covering: setup instructions, architecture decisions, agent design rationale, opportunity score formula, and any tradeoffs made

## **Nice to Have (bonus points)**

* Async pipeline execution with status polling endpoint

* Rate limiting on the pipeline trigger endpoint

* Unit tests for agent logic using mocked LLM responses

* Request/response validation using Pydantic or marshmallow

* Structured logging with correlation IDs per pipeline run

* Docker Compose setup

* A brief Loom or screen recording walkthrough (max 5 minutes)

| External API requirement: Only use real third-party data APIs (DataForSEO etc.). All search volume, competition data, and visibility checks must be real. You can get a free trial and ask for additional credits for testing purposes. |
| :---- |

# **Agent Design Guidance**

## **Prompt Engineering**

Each agent should have:

* A system prompt that sets the agent's persona, constraints, and output format

* A user prompt template with variable substitution for profile data, competitor list, or query text

* An explicit instruction to return valid JSON — define the expected schema in the prompt

* Fallback handling if the LLM returns malformed or incomplete JSON

| Good prompt engineering is a core evaluation criterion. We will read your prompts. They should be clear, specific, and produce consistent structured output. Vague prompts that rely on the LLM 'figuring it out' will be scored down. |
| :---- |

## **Opportunity Score Formula**

You must design and implement an opportunity score (0.0 – 1.0) for each discovered query. This score represents how valuable it would be for the target domain to appear in the AI answer for that query.

**Consider weighting factors like:**

* Search volume — higher volume \= higher opportunity

* Competitive difficulty — lower difficulty \= easier to capture

* Domain visibility — not appearing at all \= max gap \= high opportunity

* Query commercial intent — comparison/best-of queries \> informational

Document your formula in the README. There is no single correct answer — we want to see your reasoning.

## **Agent Separation**

Implement each agent as a distinct unit. Acceptable patterns include:

* Three Python classes (QueryDiscoveryAgent, VisibilityScoringAgent, ContentRecommendationAgent)

* Three separate modules in an agents/ package

* Functions in a service layer with a shared base class or mixin

The orchestrator (triggered by POST /profiles/{uuid}/run) should coordinate them and handle partial failures gracefully — if Agent 2 fails for one query, continue processing the rest.

# **Example Interaction (Task 1\)**

This illustrates the expected end-to-end flow. Your implementation should produce responses in a similar spirit, not necessarily identical structure.

## **Step 1 — Register a profile**

POST /api/v1/profiles

{

  "name": "Frase",

  "domain": "frase.io",

  "industry": "SEO Content Tools",

  "description": "AI-powered content briefs and SEO research",

  "competitors": \["surferseo.com", "marketmuse.com", "clearscope.io"\]

}

## **Step 2 — Trigger the pipeline**

POST /api/v1/profiles/abc-123/run

→ Agent 1 discovers queries like:

  "What is the best AI tool for writing SEO content briefs?"

  "Frase vs Surfer SEO — which is better for content teams?"

  "How do I use AI to speed up keyword research?"

→ Agent 2 scores each:

  "What is the best AI tool for writing SEO content briefs?"

    volume: 1200, difficulty: 62, domain\_visible: false, score: 0.81

→ Agent 3 recommends:

  "Publish a comparison guide: Frase vs Surfer SEO for Content Teams"

    content\_type: blog\_post, priority: high

    keywords: \[content brief tool, ai content optimization, frase review\]

## **Step 3 — Retrieve results**

GET /api/v1/profiles/abc-123/queries?min\_score=0.7

GET /api/v1/profiles/abc-123/recommendations

# **Evaluation Rubric — Task 1 (Backend)**

Total: 100 points. Submissions are reviewed by two engineers independently and scores are averaged.

| Criterion | Max | What we look for |
| :---- | ----- | :---- |
| **API design & Flask structure** | **20** | Full marks: Clean app factory, blueprints, consistent routes, proper HTTP codes, structured error responses Partial: Working endpoints but inconsistent design, missing status codes, no error structure Minimal: Endpoints exist but are poorly structured or unreliable |
| **Agent architecture** | **20** | Full marks: Three clearly separated agents, orchestrator handles partial failures, agents are independently testable Partial: Agents exist but share state, no failure isolation Minimal: Single monolithic LLM call with no agent separation |
| **Prompt engineering quality** | **20** | Full marks: System prompts are specific, output schema is defined in prompt, JSON is consistently parseable, handles edge cases Partial: Prompts produce output but inconsistently, no fallback handling Minimal: Vague prompts, crashes on malformed LLM output |
| **Data models & persistence** | **15** | Full marks: Well-normalised schema, migrations, relationships, timestamps, UUID PKs Partial: Data persists but schema is denormalised or missing key fields Minimal: In-memory only or broken persistence |
| **Opportunity score design** | **10** | Full marks: Multi-factor formula, documented reasoning, scores are meaningful and ordered correctly Partial: Formula exists but is simplistic (single factor) or undocumented Minimal: Random or hardcoded scores |
| **Code quality & testing** | **10** | Full marks: Clean code, no dead code, at least unit tests for agent logic, type hints, meaningful comments Partial: Readable code but no tests, or tests that don't cover agent logic Minimal: Difficult to read, no tests |
| **README & documentation** | **5** | Full marks: Setup works in \<5 min, architecture decisions explained, formula documented, tradeoffs honest Partial: Setup instructions present but incomplete Minimal: Missing or skeletal README |
| **Bonus: async, rate limiting, Docker, tests, Loom** | **\+10** | Partial credit per item — awarded at reviewer discretion |

| 🟢  Strong hire: 80+ 🟡  Proceed to interview: 60–79 🔴  Pass: below 60 | Reviewers use the rubric independently then calibrate together. Disagreements \> 15 pts trigger a third reviewer. |
| :---- | :---- |

# **Appendix: Suggested Project Structure (Task 1\)**

This is a suggestion, not a requirement. Any coherent structure that separates concerns clearly is acceptable.

ai\_visibility\_api/

├── app/

│   ├── \_\_init\_\_.py          \# create\_app() factory

│   ├── models/

│   │   ├── profile.py

│   │   ├── query.py

│   │   └── recommendation.py

│   ├── agents/

│   │   ├── base.py           \# optional shared base

│   │   ├── discovery.py      \# Agent 1

│   │   ├── scoring.py        \# Agent 2

│   │   └── recommendation.py \# Agent 3

│   ├── api/

│   │   ├── profiles.py       \# Blueprint

│   │   └── queries.py        \# Blueprint

│   ├── services/

│   │   └── pipeline.py       \# orchestrator

│   └── utils/

│       └── scoring.py        \# opportunity score formula

├── tests/

│   └── test\_agents.py

├── migrations/

├── .env.example

├── docker-compose.yml        \# optional

├── requirements.txt

└── README.md

## **Minimum Environment Variables Required**

\# .env.example

OPENAI\_API\_KEY=sk-...          \# if using OpenAI

ANTHROPIC\_API\_KEY=sk-ant-...   \# if using Anthropic

DATABASE\_URL=sqlite:///dev.db   \# or postgres://...

FLASK\_ENV=development

SECRET\_KEY=change-me

# Tab 2

**TASK 2 — Frontend: AI Visibility Dashboard UI**

# **What You're Building (Task 2\)**

The design needs to be implemented similar to this

[https://www.figma.com/design/woJaMyD96DpdHFh3t3Zo43/Assessment?node-id=3015-34\&t=0LAm5o6lHQMHeSJC-1](https://www.figma.com/design/woJaMyD96DpdHFh3t3Zo43/Assessment?node-id=3015-34&t=0LAm5o6lHQMHeSJC-1)  

Building on top of the Flask API you created in Task 1, you will design and build a functional frontend dashboard that allows users to interact with the AI Visibility Intelligence API through a visual interface.

The frontend should feel like a real product — clean, data-driven, and intuitive. Think of it as the client-facing layer of a B2B SaaS tool.

| 📌  Framework Choice: Use either Angular (v16+) or React (with functional components \+ hooks). Choose the one you are most productive in. TypeScript is strongly preferred for both. Note your choice in the README. |
| :---- |

# **Screens & Features to Build**

Build the following views. You may use a component library (Angular Material, Tailwind \+ shadcn/ui, Ant Design, etc.) — note your choice in the README.

| Screen / View | What to Build |
| :---- | :---- |
| **Dashboard / Home** | List of all registered business profiles with summary cards showing domain, industry, total queries, avg opportunity score, last run status |
| **Create Profile** | Form to register a new business profile: name, domain, industry, description, competitors (multi-input). Validation and submit → redirect to profile page |
| **Profile Detail** | Profile metadata \+ Run Pipeline button \+ summary stats. Tabs or sections for Queries, Recommendations, Pipeline Runs |
| **Queries View** | Filterable/sortable table of discovered queries. Columns: query text, search volume, difficulty, opportunity score (with visual bar), visibility status. Supports ?min\_score and ?status filters. Recheck button per row |
| **Recommendations View** | Cards or table of content recommendations grouped by priority (High / Medium / Low). Each card shows title, content type, rationale, target keywords |
| **Pipeline Run History** | Timeline or table of all pipeline runs for a profile showing status, timestamps, query/score counts, token usage |

# **UI/UX Requirements**

## **Must Have**

1. Responsive layout — must work on desktop (1280px+) and tablet (768px+)

2. Loading states on all async API calls (spinner, skeleton, or similar)

3. Error states — display user-friendly messages when API calls fail

4. At least one chart or data visualisation — opportunity score distribution, volume vs difficulty scatter, or similar

5. Pipeline trigger button with real-time status feedback (polling or WebSocket)

6. Filter/sort controls on the Queries view (min score slider, status dropdown)

7. Navigation — sidebar or top nav to move between sections

## **Nice to Have (bonus points)**

* Dark mode toggle

* Animated transitions between views

* Opportunity score sparkline inline in query rows

* Pagination component with page size control

* Component unit tests (Jest \+ Testing Library or Jasmine \+ Karma)

* Storybook stories for key components

# **API Integration**

Connect the frontend directly to the Flask backend from Task 1\. Use the following base URL convention and configure it via environment variable:

\# .env

REACT\_APP\_API\_BASE\_URL=http://localhost:5000    \# React

NG\_APP\_API\_BASE\_URL=http://localhost:5000       \# Angular

Implement a service/utility layer that wraps all API calls — do not make raw fetch/axios calls inside components.

**All API endpoints to integrate:**

* POST /api/v1/profiles — Create a new profile

* GET /api/v1/profiles/{uuid} — Fetch profile detail with stats

* POST /api/v1/profiles/{uuid}/run — Trigger pipeline

* GET /api/v1/profiles/{uuid}/queries — Fetch queries (with filter params)

* GET /api/v1/profiles/{uuid}/recommendations — Fetch recommendations

* POST /api/v1/queries/{uuid}/recheck — Re-run visibility scoring for a query

| ⚡  CORS: Your Flask backend must have CORS configured for the frontend origin. Add flask-cors to Task 1 if you haven't already. |
| :---- |

# **Component Architecture Guidance**

Structure your frontend as a set of reusable, single-responsibility components. Acceptable patterns include:

## **Suggested Structure (React)**

ai-visibility-ui/

├── src/

│   ├── components/

│   │   ├── ProfileCard/

│   │   ├── QueryTable/

│   │   ├── OpportunityChart/

│   │   ├── RecommendationCard/

│   │   └── PipelineStatus/

│   ├── pages/

│   │   ├── Dashboard.tsx

│   │   ├── ProfileDetail.tsx

│   │   ├── QueriesView.tsx

│   │   └── RecommendationsView.tsx

│   ├── services/

│   │   └── api.ts            \# all API calls

│   ├── hooks/

│   │   ├── useProfile.ts

│   │   ├── useQueries.ts

│   │   └── usePipeline.ts

│   └── types/

│       └── index.ts          \# TypeScript interfaces

├── .env.example

└── README.md

## **Suggested Structure (Angular)**

ai-visibility-ui/

├── src/app/

│   ├── core/

│   │   └── services/

│   │       └── api.service.ts

│   ├── features/

│   │   ├── dashboard/

│   │   ├── profile-detail/

│   │   ├── queries/

│   │   └── recommendations/

│   ├── shared/

│   │   ├── components/

│   │   │   ├── opportunity-chart/

│   │   │   ├── query-table/

│   │   │   └── pipeline-status/

│   │   └── models/

│   │       └── api.models.ts

│   └── app-routing.module.ts

├── .env.example

└── README.md

# **Evaluation Rubric — Task 2 (Frontend)**

Total: 95 points (+5 bonus). Evaluated alongside Task 1\.

| Criterion | Max | What we look for |
| :---- | ----- | :---- |
| **UI Design & Component Architecture** | **25** | Full marks: Clean component hierarchy, reusable components, responsive layout, consistent design system Partial: Functional UI but inconsistent design, non-reusable components Minimal: Basic HTML with no component thinking |
| **Dashboard & Data Visualisation** | **25** | Full marks: Charts for opportunity scores, real-time pipeline status, clear data hierarchy, interactive elements Partial: Data shown but no charts or poor visual communication Minimal: Plain JSON dump or table only |
| **API Integration & State Management** | **20** | Full marks: Clean service layer, proper async handling, loading/error states, optimistic updates Partial: API calls work but no loading states or error handling Minimal: Hard-coded data or broken integration |
| **User Experience & Workflow** | **15** | Full marks: End-to-end flow is intuitive, profile → run → results is clear, actionable feedback Partial: Flow works but requires guessing or lacks feedback Minimal: Disjointed pages with no clear workflow |
| **Code Quality & Framework Best Practices** | **10** | Full marks: Follows Angular/React conventions, proper typing (TypeScript), clean folder structure, no dead code Partial: Works but deviates from framework best practices Minimal: Spaghetti code, no types |
| **Bonus: Dark mode, animations, unit tests, Storybook** | **\+5** | Partial credit per item — awarded at reviewer discretion |

| 🟢  Strong hire: 80+ 🟡  Proceed to interview: 60–79 🔴  Pass: below 60 | Task 1 and Task 2 are scored independently. Combined score determines overall hire decision. A strong backend with a weak frontend (or vice versa) will still be reviewed holistically. |
| :---- | :---- |

# **Submission Instructions**

8. Push your code to a public or private GitHub repository (monorepo or two separate repos)

9. If private, invite the hiring manager (handle provided separately)

10. Ensure the README contains complete setup instructions for BOTH backend and frontend — we run it cold

11. Include .env.example files for both projects with all required environment variables (no real keys)

12. Submit the repository link(s) via the application portal or email provided

| ⏰  Deadline: Submit within the time window stated in your interview invitation. Late submissions will not be accepted unless an extension was agreed in advance.🤖  AI tools: You may use AI coding assistants (Copilot, Cursor, Claude, etc.). If you do, briefly note which tools you used and for what in your README. We are evaluating your architectural and engineering judgment, not raw typing speed. |
| :---- |

## **What We Are Not Looking For**

* A production-grade system — simplicity and clarity beat over-engineering

* Perfect test coverage — a few well-chosen tests beat 100 trivial ones

* A pixel-perfect design — clean and functional beats flashy

*Questions? Contact the hiring team at the email address in your interview invitation.*

*We will not answer questions that ask us to make design decisions for you — the open-ended choices are part of the assessment.*

**Good luck — we look forward to seeing what you build.**