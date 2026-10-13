export interface SystemTemplateDefinition {
  name: string;
  slug: string;
  category: 'Work' | 'Personal' | 'Engineering' | 'Product' | 'Research' | 'Education' | 'General';
  icon: string;
  description: string;
  tags?: string;
  content: any;
}

export const BUILTIN_TEMPLATES: SystemTemplateDefinition[] = [
  // ─── 1. WORK (1-8) ──────────────────────────────────────────────────────────
  {
    name: 'Weekly Review',
    slug: 'weekly-review',
    category: 'Work',
    icon: '📊',
    description: 'Weekly sprint retrospective, completed deliverables, and next week plan.',
    tags: 'work,planning,retrospective,sprint',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Weekly Operational Review' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Week Ending: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'YYYY-MM-DD' }, { type: 'text', text: ' | Reviewer: Operator' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Accomplishments & Completed Work' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Shipped sovereign authentication system' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Audited PostgreSQL indexes for document query latency' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Metrics & KPI Performance' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Target SLA: 99.9% uptime achieved' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mean latency: < 45ms across primary endpoints' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Blockers & Learnings' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Identify any systemic friction, external dependencies, or technical debt requiring remediation.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Next Week Key Priorities' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Execute permission matrix hardening' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Publish interactive template gallery components' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Meeting Notes',
    slug: 'meeting-notes',
    category: 'Work',
    icon: '👥',
    description: 'Structured agenda, attendees, discussion points, decisions, and action items.',
    tags: 'meeting,notes,team,sync',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Meeting Sync: Strategic Alignment' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Date: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'YYYY-MM-DD' }, { type: 'text', text: ' | Lead: Operator' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Participants' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Principal Architect' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Product Lead' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Security Specialist' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Discussion Agenda' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Review architecture milestones, verify token hashing, evaluate email delivery sandboxes.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Decisions Made' }] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'DECISION: All document invitations will require cryptographic single-use SHA-256 tokens and strict 7-day expiration.' }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Action Items' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Implement DocumentMembership transactional acceptance' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Configure email invite link resolver' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Project Plan',
    slug: 'project-plan',
    category: 'Work',
    icon: '🎯',
    description: 'Comprehensive project charter, objectives, milestones, deliverables, and risks.',
    tags: 'project,charter,planning,roadmap',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Project Plan: System Modernization' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Executive Summary & Objective' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Establish a sovereign, enterprise-grade document workspace with verified permissions, robust templates, and audit trails.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Project Scope & Deliverables' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deliverable A: 40-template searchable catalog with one-click instantiation.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deliverable B: Role-based sharing with Viewer, Commenter, Editor, and Owner controls.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deliverable C: End-to-end email invitation delivery and acceptance.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Milestones & Target Dates' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Phase 1: Database schema synchronization & migrations' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Phase 2: Template catalog UI & preview integration' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Phase 3: Sharing modal and permission verification tests' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Risk Management & Mitigations' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Potential concurrency conflicts are mitigated through integer-based optimistic concurrency control (OCC).' }] },
      ],
    },
  },
  {
    name: 'Daily Work Log',
    slug: 'daily-work-log',
    category: 'Work',
    icon: '📋',
    description: 'Track daily focused tasks, completed milestones, blockers, and handoff notes.',
    tags: 'daily,work,productivity,log',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Daily Work Log' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Date: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'YYYY-MM-DD' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Today’s Essential Focus (Top 3)' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Priority Alpha: Implement secure share authorization gates' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Priority Beta: Wire email acceptance token validation' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Priority Gamma: Verify 40 system templates database seeding' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Completed Milestones' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Verified Prisma client schema regeneration with 0 type errors.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Blockers & Handoff Notes' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'None identified. System telemetry operating under normal parameters.' }] },
      ],
    },
  },
  {
    name: 'Decision Record',
    slug: 'decision-record',
    category: 'Work',
    icon: '⚡',
    description: 'Document crucial operational or organizational decisions with context and consequences.',
    tags: 'decision,governance,adr,work',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Organizational Decision Record: DR-01' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Context & Problem Statement' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'As document collaboration scales, workspace members need explicit granular rights (View, Comment, Edit) rather than binary access.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Considered Options' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option 1: Rely solely on workspace-level roles.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option 2: Implement dedicated DocumentMembership table with per-document overrides.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Chosen Outcome & Rationale' }] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'We selected Option 2. Explicit per-document memberships enable safe external sharing and least-privilege collaboration.' }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Consequences & Follow-Ups' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Audit all document update APIs for role-level checks' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Retrospective',
    slug: 'retrospective',
    category: 'Work',
    icon: '🔄',
    description: 'Structured sprint retrospective for team reflection, improvements, and action items.',
    tags: 'retrospective,agile,team,sprint',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Sprint Retrospective' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Sprint: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'Sprint 24' }, { type: 'text', text: ' | Focus: Document Operating System' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. What Went Well (Wins)' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Monochrome visual aesthetic feels polished and cohesive.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'TipTap formatting controls respond with zero lag.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. What Could Be Improved' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sharing dialog needed clearer distinction between public links and invitations.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Action Items for Next Cycle' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deploy dedicated collaborator invitation management' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Add preview dialog before applying any workspace template' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Client Brief',
    slug: 'client-brief',
    category: 'Work',
    icon: '🤝',
    description: 'Define client background, project goals, deliverables, timeline, and communication protocols.',
    tags: 'client,brief,consulting,proposal',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Client Project Brief' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Client Background' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Client Name, Industry, Key Stakeholders, and Primary Business Context.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Project Goals & Target Outcomes' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Primary Objective: Accelerate operational velocity by 40%.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Secondary Objective: Consolidate scattered knowledge bases into sovereign documents.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Scope & Key Deliverables' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Architecture blueprint document delivered' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sovereign database deployment verification' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Project Status Report',
    slug: 'project-status-report',
    category: 'Work',
    icon: '📈',
    description: 'Executive project summary, milestone status, accomplishments, and risk mitigations.',
    tags: 'status,report,executive,management',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Executive Project Status Report' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Status: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'ON TRACK [GREEN]' }, { type: 'text', text: ' | Date: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'YYYY-MM-DD' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Executive Summary' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'All sprint deliverables on schedule. Core security authorization tests pass with 100% compliance.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Accomplishments This Period' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Synchronized database schemas and generated Prisma models.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Implemented email delivery provider abstraction.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Upcoming Milestones' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Finalize Notes-to-Tasks engine review panel' }] }] },
        ]},
      ],
    },
  },

  // ─── 2. PERSONAL (9-14) ─────────────────────────────────────────────────────
  {
    name: 'Daily Journal',
    slug: 'daily-journal',
    category: 'Personal',
    icon: '📓',
    description: 'Daily reflection, priority focal points, deliberate gratitude, and evening debrief.',
    tags: 'journal,personal,reflection,habits',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Daily Journal' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Date: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'YYYY-MM-DD' }, { type: 'text', text: ' | Focus: Intentional Clarity' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Morning Intentions & Gratitude' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'I am grateful for the deep focus of uninterrupted mornings.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'I will prioritize deliberate craftsmanship over rushed output.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Essential Focus Today' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Single critical objective for today' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Physical wellness & renewal session' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Evening Reflection & Wins' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'What went exceptionally well? What lesson will I carry into tomorrow?' }] },
      ],
    },
  },
  {
    name: 'Personal Goals',
    slug: 'personal-goals',
    category: 'Personal',
    icon: '🎯',
    description: 'Quarterly and annual goal setting with milestones, habit linkages, and reflection.',
    tags: 'goals,personal,vision,growth',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Personal Goal Blueprint' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Life Domains' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Health & Vitality: Build endurance and consistent sleep hygiene.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Craft & Mastery: Architect sovereign software systems.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Relationships & Community: Foster high-trust connections.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Milestone Targets' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Q1 Milestone: Complete deep reading of 6 domain books' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Q2 Milestone: Launch open source telemetry tooling' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Habit Review',
    slug: 'habit-review',
    category: 'Personal',
    icon: '🔁',
    description: 'Track daily habits, analyze weekly consistency, and refine behavioral routines.',
    tags: 'habits,routine,personal,tracking',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Weekly Habit Review & Audit' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Keystone Habits' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '6:30 AM wake up with zero snooze' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '45-minute morning deep focus session' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Zero phone usage 30 mins before sleep' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Weekly Analysis' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Analyze environmental triggers, friction points, and reward systems.' }] },
      ],
    },
  },
  {
    name: 'Reading Notes',
    slug: 'reading-notes',
    category: 'Personal',
    icon: '📖',
    description: 'Book insights, memorable quotes, synthesized takeaways, and practical applications.',
    tags: 'books,reading,learning,notes',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Reading Notes: Title of Book' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Author: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'Author Name' }, { type: 'text', text: ' | Finished: YYYY-MM-DD | Rating: ★★★★★' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Thesis in One Sentence' }] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Synthesize the book’s central argument in a single clear, profound statement.' }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Top 3 Key Takeaways' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Takeaway 1: How systems outperform goals.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Takeaway 2: The role of friction in behavior modification.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Actionable Application' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Incorporate principle into morning architecture workflow' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Travel Planner',
    slug: 'travel-planner',
    category: 'Personal',
    icon: '✈️',
    description: 'Itinerary, flight bookings, accommodation details, and preparation checklists.',
    tags: 'travel,itinerary,planning,vacation',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Travel Planner: Destination' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Dates: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'YYYY-MM-DD to YYYY-MM-DD' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Logistics & Reservations' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Outbound Flight: Flight #, Confirmation Code' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lodging: Hotel / Apartment Address, Check-in details' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Packing & Preparation Checklist' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Passport and travel documentation verified' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Power adapters and mobile workspace hardware' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Personal Knowledge Note',
    slug: 'personal-knowledge-note',
    category: 'Personal',
    icon: '🧠',
    description: 'Atomic Zettelkasten-style knowledge capture with backlinks and synthesis.',
    tags: 'zettelkasten,knowledge,notes,pkm',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Atomic Knowledge Note: Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Tags: #architecture #concurrency #security' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Idea' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'State the atomic insight clearly in your own words.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Connected Ideas & Backlinks' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contrasts with: Naive locking mechanisms' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Supports: Zero-downtime database migrations' }] }] },
        ]},
      ],
    },
  },

  // ─── 3. ENGINEERING (15-22) ─────────────────────────────────────────────────
  {
    name: 'Technical Documentation',
    slug: 'technical-documentation',
    category: 'Engineering',
    icon: '⚙️',
    description: 'System specifications, architecture invariants, data contracts, and error recovery.',
    tags: 'engineering,spec,architecture,docs',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Technical Specification & System Blueprint' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Architecture & Protocol Overview' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Overview of system boundary, database transaction boundaries, and network contracts.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Data Model Invariants' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'All operations require authenticated session cookies and workspace membership validation.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Error Handling & Recovery Policies' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '409 Conflict triggers client version reload' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '401/403 redirects cleanly to authentication boundary' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'API Documentation',
    slug: 'api-documentation',
    category: 'Engineering',
    icon: '🔌',
    description: 'REST/GraphQL endpoint reference with headers, request/response bodies, and status codes.',
    tags: 'api,rest,endpoints,engineering',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'API Specification: Document Service' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Authentication & Base URL' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Base URL: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'http://localhost:4000/api' }, { type: 'text', text: ' | Cookie: session_token' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'POST /api/documents/:id/invitations' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Send a cryptographically hashed invitation to a collaborator.' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Request Schema' }] },
        { type: 'codeBlock', attrs: { language: 'json' }, content: [{ type: 'text', text: '{\n  "recipientEmail": "colleague@workspace.app",\n  "role": "VIEWER",\n  "message": "Please review the architecture spec."\n}' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Response (201 Created)' }] },
        { type: 'codeBlock', attrs: { language: 'json' }, content: [{ type: 'text', text: '{\n  "success": true,\n  "data": {\n    "invitation": {\n      "id": "cuid-123",\n      "recipientEmail": "colleague@workspace.app",\n      "role": "VIEWER",\n      "status": "PENDING"\n    }\n  }\n}' }] },
      ],
    },
  },
  {
    name: 'Architecture Decision Record',
    slug: 'architecture-decision-record',
    category: 'Engineering',
    icon: '🏛️',
    description: 'Record architectural choices, technical context, considered options, and tradeoffs.',
    tags: 'adr,architecture,engineering,design',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'ADR-002: Optimistic Concurrency Control' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Status: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'ACCEPTED' }, { type: 'text', text: ' | Date: 2026-10-13' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Context' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Multiple collaborators may edit documents concurrently. Without version checking, the last writer silently clobbers earlier updates.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Decision' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'We enforce an integer version field on the Document table. Every update increments the version. Mismatched versions return HTTP 409 Conflict.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Consequences' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Positive: Eliminates silent data loss.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Positive: Clean conflict UI prompts operator to reconcile changes.' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Bug Investigation',
    slug: 'bug-investigation',
    category: 'Engineering',
    icon: '🐛',
    description: 'Systematic root-cause analysis, reproduction steps, telemetry findings, and fix plan.',
    tags: 'bug,investigation,rca,engineering',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Bug Investigation: Issue #409' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Symptoms & Severity' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Severity: P2 (Medium) | Symptoms: Stale document version returned when rapid saves overlap.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Reproduction Protocol' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1. Open document across two independent browser contexts.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2. Modify text in Context A; autosave triggers.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '3. Attempt mutation in Context B with stale version.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Root Cause Analysis' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Debounce window was not synchronizing client version state upon HTTP response.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Resolution & Regression Test' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Update client version immediately on save success' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Add automated integration test for 409 conflict handling' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Incident Report',
    slug: 'incident-report',
    category: 'Engineering',
    icon: '🚨',
    description: 'Post-incident review, service impact, incident timeline, root cause, and remediation.',
    tags: 'incident,postmortem,devops,reliability',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Post-Incident Review: INC-2026-10' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Impact: 0 downtime | Severity: SEV-3 | Lead: SRE Operator' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Incident Summary' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Prisma Windows DLL query engine locked by background process during schema push.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Incident Timeline' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '16:40 UTC: Schema update initiated.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '16:42 UTC: Query engine file lock identified.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '16:44 UTC: Daemon safely suspended, client files updated, process restored.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Preventive Measures' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Documented safe generator protocol in Knowledge Base' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Deployment Checklist',
    slug: 'deployment-checklist',
    category: 'Engineering',
    icon: '🚀',
    description: 'Production release checklist with pre-deploy, migration, and smoke test stages.',
    tags: 'deploy,devops,release,checklist',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Production Release Verification Checklist' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Pre-Deployment Quality Gates' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Run backend TypeScript check (npx tsc --noEmit) with 0 errors' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Run frontend production build (next build) successfully' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Run automated document integration test suite (24/24 passing)' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Deployment & Migration Execution' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Apply Prisma database schema synchronizations' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Verify PostgreSQL connection pooling & health checks' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Post-Deployment Smoke Tests' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Verify template instantiation from UI gallery' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Verify email invitation sending & permission enforcement' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Code Review Notes',
    slug: 'code-review-notes',
    category: 'Engineering',
    icon: '🔍',
    description: 'Architectural observations, code quality reviews, and follow-up tasks.',
    tags: 'code,review,engineering,quality',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Code Review: Pull Request #88' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Branch: feature/secure-sharing | Author: Operator' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Architectural Overview' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Evaluates the document authorization middleware, ensures token hashes are single-use, and verifies that Viewer roles cannot mutate content.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Required Enhancements' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ensure recipient email is normalized to lowercase before token creation' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Add transactional boundary to invitation acceptance endpoint' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'System Design Document',
    slug: 'system-design-document',
    category: 'Engineering',
    icon: '📐',
    description: 'High-level architecture, capacity planning, distributed components, and resilience.',
    tags: 'system,design,engineering,architecture',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'High-Level System Design: Document Graph' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Functional & Non-Functional Requirements' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P99 read latency < 50ms for document fetches.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Zero data loss with automated version snapshots and rollback capability.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Data Storage Strategy' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'PostgreSQL 16 serves as authoritative database. Document AST stored in JSONB column. Attachments stored on disk with cryptographic key references.' }] },
      ],
    },
  },

  // ─── 4. PRODUCT (23-30) ─────────────────────────────────────────────────────
  {
    name: 'Brainstorming',
    slug: 'brainstorming',
    category: 'Product',
    icon: '💡',
    description: 'Unconstrained ideation canvas, user pain points, feature hypotheses, and pros/cons.',
    tags: 'ideation,brainstorming,product,canvas',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Ideation & Brainstorming Canvas' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Problem Statement' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'How might we enable knowledge workers to transform raw unstructured meeting notes into real project tasks in under 5 seconds?' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Raw Concepts & Hypotheses' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Concept A: AI Action-Items detector highlighting candidate checklist items.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Concept B: Interactive confirmation review panel with single-click Task creation.' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Product Requirements Document',
    slug: 'product-requirements-document',
    category: 'Product',
    icon: '📄',
    description: 'Complete PRD: Problem definition, target personas, user stories, and acceptance criteria.',
    tags: 'prd,product,spec,requirements',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'PRD: Workspace Template Catalog & Sharing' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Problem Background & Opportunity' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Users require high-conviction templates and secure collaborator sharing with verifiable backend permissions.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. User Personas' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lead Architect: Demands exact technical specs and audit trails.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Executive Operator: Requires weekly review templates and instant sharing.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Acceptance Criteria' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Template selection creates real document with predefined sections' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Viewer role cannot edit document content' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Feature Specification',
    slug: 'feature-specification',
    category: 'Product',
    icon: '📑',
    description: 'Detailed feature design, user flow states, boundary conditions, and telemetry.',
    tags: 'feature,spec,product,design',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Feature Spec: Secure Collaborator Invitations' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'User Flow & State Machine' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Owner inputs email and selects role -> backend generates 256-bit token hash -> email sent -> recipient clicks URL -> validates session and email -> membership granted.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Edge Cases & Safeguards' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Token single-use: Immediately invalidate on acceptance.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Email mismatch: Reject acceptance if logged in with wrong account.' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'User Research',
    slug: 'user-research',
    category: 'Product',
    icon: '🔬',
    description: 'Research goals, target cohort, synthesis of user interviews, and strategic takeaways.',
    tags: 'research,ux,product,interviews',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'User Research Findings: Document Workflows' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Research Objectives' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Understand how engineering and product leads organize multi-document projects and manage external client visibility.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Findings' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '85% of users prefer pre-populated structured sections over blank editors.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '92% prioritize permission certainty (guaranteeing that clients cannot edit internal notes).' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'User Interview Notes',
    slug: 'user-interview-notes',
    category: 'Product',
    icon: '🎙️',
    description: 'Capture interview transcript, participant background, friction points, and direct quotes.',
    tags: 'interview,transcript,user,feedback',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'User Interview: Participant Alpha' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Role: Senior Engineering Manager | Company Size: 120 employees | Date: YYYY-MM-DD' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Primary Friction Points' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Struggles with disconnected tools where meeting notes are written in one app and tasks manually copied into another.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Direct Quotes' }] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '"If the platform can turn my meeting notes directly into tracked tasks with one click, I will use it every single day."' }] }] },
      ],
    },
  },
  {
    name: 'Product Roadmap',
    slug: 'product-roadmap',
    category: 'Product',
    icon: '🗺️',
    description: 'Strategic product roadmap organized by Horizon 1 (Now), Horizon 2 (Next), and Horizon 3 (Later).',
    tags: 'roadmap,strategy,planning,product',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Product Roadmap & Strategic Horizons' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Horizon 1: Current Focus [Now]' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deliver 40-template searchable catalog with instant preview' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Implement secure email invitations with permission roles' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Notes-to-Tasks review engine' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Horizon 2: High Priority [Next]' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real-time collaborative presence cursors via WebSockets' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Release Notes',
    slug: 'release-notes',
    category: 'Product',
    icon: '📢',
    description: 'Document feature releases, major enhancements, bug fixes, and upgrade guidelines.',
    tags: 'release,changelog,announcement,product',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Release Notes: Version 2.4.0' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Release Date: ' }, { type: 'text', marks: [{ type: 'code' }], text: '2026-10-13' }, { type: 'text', text: ' | Focus: Sovereign Document Workflows' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What’s New' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '40 Built-in Workspace Templates across 8 categories.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Enterprise Sharing dialog with Viewer, Commenter, Editor, and Owner roles.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cryptographic email invitation workflow with token expiration.' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Experiment Plan',
    slug: 'experiment-plan',
    category: 'Product',
    icon: '🧪',
    description: 'A/B test hypothesis, target metrics, experimental cohorts, and statistical decision rules.',
    tags: 'experiment,growth,ab-test,metrics',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Experiment Plan: Template Onboarding Adoption' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Hypothesis' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Prompting users with categorized template recommendations upon new document creation will increase 7-day document engagement by 35%.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Metrics & Guardrails' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Primary: Document retention & total words authored.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Guardrail: Zero increase in document abandonment.' }] }] },
        ]},
      ],
    },
  },

  // ─── 5. RESEARCH AND EDUCATION (31-36) ──────────────────────────────────────
  {
    name: 'Research Notes',
    slug: 'research-notes',
    category: 'Research',
    icon: '🔬',
    description: 'Hypothesis framing, literature benchmarks, observational data, and syntheses.',
    tags: 'research,academic,science,notes',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Research Investigation & Data Synthesis' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Research Question' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'What is the comparative latency tradeoff between optimistic concurrency control and distributed lock leases?' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Empirical Evidence & Observations' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Data Point 1: OCC reduces write contention latency by 68% in low-conflict workloads.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Adopt OCC with automatic retry prompts for user-facing document mutations.' }] },
      ],
    },
  },
  {
    name: 'Literature Review',
    slug: 'literature-review',
    category: 'Research',
    icon: '📚',
    description: 'Systematic review of academic publications, source comparisons, and theoretical gaps.',
    tags: 'literature,review,papers,research',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Systematic Literature Review' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Topic & Methodology' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Analysis of conflict-free replicated data types (CRDTs) and operational transformation in collaborative text systems.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Synthesized Sources' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Shapiro et al. (2011): Comprehensive study of CRDT convergence invariants.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Identified Gaps' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Existing research underemphasizes UX clarity when server conflicts require manual operator resolution.' }] },
      ],
    },
  },
  {
    name: 'Study Notes',
    slug: 'study-notes',
    category: 'Education',
    icon: '📓',
    description: 'Concept breakdown, foundational terminology, formula references, and review questions.',
    tags: 'study,learning,education,notes',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Conceptual Study Notes: Topic' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Terminology & Definitions' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Term A: Foundational mathematical or architectural definition.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Self-Testing Questions' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Can I explain this concept to a colleague without referencing notes?' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Cornell Notes',
    slug: 'cornell-notes',
    category: 'Education',
    icon: '📝',
    description: 'Traditional Cornell note-taking format: cue column, lecture notes, and bottom summary.',
    tags: 'cornell,notes,lecture,education',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Cornell Notes: Topic / Lecture' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Cues & Prompt Questions (Left Column)' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'What is the primary mechanism of token authentication?' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Detailed Lecture Notes (Right Column)' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Token hashes are stored in the database. Raw tokens are never logged. High entropy guarantees resistance to brute force.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Summary Synthesis' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Summarize the core concepts in 2-3 concise sentences.' }] },
      ],
    },
  },
  {
    name: 'Exam Preparation',
    slug: 'exam-preparation',
    category: 'Education',
    icon: '🎓',
    description: 'Exam study schedule, high-yield topic checklist, mock test scores, and formula sheet.',
    tags: 'exam,prep,study,education',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Exam Preparation & Mastery Plan' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Exam Date: ' }, { type: 'text', marks: [{ type: 'code' }], text: 'YYYY-MM-DD' }, { type: 'text', text: ' | Target Grade: 95%+' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'High-Yield Topics Checklist' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Module 1: Distributed consistency and ACID transactions' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Module 2: Network security protocols and cryptographic token hashing' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Research Paper Outline',
    slug: 'research-paper-outline',
    category: 'Research',
    icon: '📑',
    description: 'Academic paper blueprint: Abstract, Introduction, Related Work, Methodology, Results, Discussion.',
    tags: 'paper,outline,academic,research',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Research Paper Blueprint' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Abstract' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Provide a 200-word concise synthesis of the problem, proposed solution, and empirical results.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Introduction & Motivation' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Outline the contemporary bottleneck and explain why existing solutions fall short.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Proposed Architecture & Methodology' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Formalize data models, invariants, and implementation mechanics.' }] },
      ],
    },
  },

  // ─── 6. GENERAL (37-40) ─────────────────────────────────────────────────────
  {
    name: 'Blank Document',
    slug: 'blank-document',
    category: 'General',
    icon: '📄',
    description: 'Clean slate with standard typographical margins and unconstrained canvas.',
    tags: 'blank,empty,minimal,general',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Untitled Document' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Start writing or press ' }, { type: 'text', marks: [{ type: 'code' }], text: '/' }, { type: 'text', text: ' for commands...' }] },
      ],
    },
  },
  {
    name: 'Checklist',
    slug: 'checklist',
    category: 'General',
    icon: '✅',
    description: 'Simple, focused actionable checklist with priority groupings and completion status.',
    tags: 'checklist,tasks,todo,general',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Action Checklist' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Immediate Tasks' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First critical action item' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second critical action item' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Follow-Up Items' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Later follow-up action' }] }] },
        ]},
      ],
    },
  },
  {
    name: 'Comparison Table',
    slug: 'comparison-table',
    category: 'General',
    icon: '⚖️',
    description: 'Structured comparison matrix with evaluation criteria, pros/cons, and final recommendation.',
    tags: 'comparison,matrix,evaluation,tradeoffs',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Option Evaluation & Comparison Matrix' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Executive Summary' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Evaluate Option Alpha versus Option Beta against architectural criteria.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Evaluation Matrix' }] },
        { type: 'table', content: [
          { type: 'tableRow', content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Criteria' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option Alpha' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option Beta' }] }] },
          ]},
          { type: 'tableRow', content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Latency' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '< 20ms' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '~ 100ms' }] }] },
          ]},
          { type: 'tableRow', content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Complexity' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Low' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Moderate' }] }] },
          ]},
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Final Recommendation' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Select Option Alpha based on superior latency and simplicity.' }] },
      ],
    },
  },
  {
    name: 'Structured Project Notes',
    slug: 'structured-project-notes',
    category: 'General',
    icon: '🗂️',
    description: 'Modular project notebook with goals, ongoing notes, decisions, and immediate next steps.',
    tags: 'project,notes,workspace,general',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Structured Project Notes' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Project Goals & Boundary' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Clear statement of the project’s purpose and constraints.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Working Notes' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note 1: Track key architectural developments.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note 2: Maintain strict data boundaries.' }] }] },
        ]},
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Next Steps' }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Finalize implementation checklist' }] }] },
        ]},
      ],
    },
  },
];
