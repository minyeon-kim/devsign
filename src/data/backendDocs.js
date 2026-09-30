// Proposed backend reference documents for project demos.
export const backendReferenceDocs = [
  {
    "id": "doc-backend-architecture",
    "title": "Backend architecture",
    "summary": "Proposed service boundaries, project isolation and the review-to-merge workflow.",
    "authorId": "james",
    "updatedAtLabel": "Today",
    "type": "spec",
    "searchKeywords": [
      "backend",
      "architecture",
      "백엔드",
      "아키텍처"
    ],
    "blocks": [
      {
        "type": "callout",
        "tone": "info",
        "text": "Draft implementation proposal. The current Devsign demo uses client-side state and local storage; the services and schemas below are proposed, not deployed infrastructure."
      },
      {
        "type": "h2",
        "id": "scope",
        "text": "Service boundaries"
      },
      {
        "type": "p",
        "text": "Start with a modular API service and a separate worker. Keep project access, documents, collaboration and merge execution as independent modules sharing one transactional database."
      },
      {
        "type": "table",
        "columns": [
          "Module",
          "Owns",
          "Boundary"
        ],
        "rows": [
          [
            "Projects",
            "Projects, memberships and roles",
            "Every request checks project access"
          ],
          [
            "Documents",
            "Reference docs and document revisions",
            "Published revisions are immutable"
          ],
          [
            "Reviews",
            "Conflicts, approvals and review signatures",
            "Editing a proposal invalidates stale approval"
          ],
          [
            "Merge execution",
            "Merge operations and checkpoints",
            "Only approved proposals may execute"
          ],
          [
            "Workers",
            "Imports, notifications and analysis",
            "Jobs are retryable and idempotent"
          ]
        ]
      },
      {
        "type": "h2",
        "id": "workflow",
        "text": "Review and merge flow"
      },
      {
        "type": "ul",
        "items": [
          "Save edits as a draft revision; preserve the current merged baseline.",
          "Request review against an immutable revision identifier and content signature.",
          "Require all configured approvals before accepting a merge operation.",
          "Lock the target revision and validate the expected baseline inside one transaction.",
          "Write the merged snapshot, checkpoint and audit event atomically; dispatch notifications after commit."
        ]
      },
      {
        "type": "h2",
        "id": "isolation",
        "text": "Project isolation"
      },
      {
        "type": "ul",
        "items": [
          "Derive the actor from the authenticated session; do not trust a user ID from request bodies.",
          "Scope resource queries by project ID and membership. Cross-project IDs must never return data.",
          "Keep API keys and database credentials on the server. Clients receive only permitted document and project data."
        ]
      },
      {
        "type": "h2",
        "id": "delivery",
        "text": "Implementation sequence"
      },
      {
        "type": "ul",
        "items": [
          "Introduce repository interfaces around current demo storage.",
          "Implement read APIs and access checks before switching writes.",
          "Migrate drafts, reviews and checkpoint writes together so there is one authoritative baseline.",
          "Keep a demo adapter for local previews and automated tests."
        ]
      }
    ]
  },
  {
    "id": "doc-database-schema",
    "title": "Database schema & transactions",
    "summary": "Proposed relational entities, keys, indexes and atomic merge writes.",
    "authorId": "james",
    "updatedAtLabel": "Today",
    "type": "spec",
    "searchKeywords": [
      "database",
      "schema",
      "sql",
      "postgres",
      "데이터베이스",
      "스키마"
    ],
    "blocks": [
      {
        "type": "callout",
        "tone": "info",
        "text": "Draft implementation proposal. The current Devsign demo uses client-side state and local storage; the services and schemas below are proposed, not deployed infrastructure."
      },
      {
        "type": "h2",
        "id": "entities",
        "text": "Core entities"
      },
      {
        "type": "table",
        "columns": [
          "Table",
          "Key fields",
          "Relationship"
        ],
        "rows": [
          [
            "projects",
            "id, name, created_at",
            "Project root"
          ],
          [
            "project_members",
            "project_id, user_id, role",
            "Unique project/user pair"
          ],
          [
            "files",
            "id, project_id, path, baseline_revision_id",
            "Unique project/path pair"
          ],
          [
            "file_revisions",
            "id, file_id, content_hash, content_ref, parent_id",
            "Immutable revision history"
          ],
          [
            "conflicts",
            "id, project_id, file_id, proposal_revision_id, stage",
            "Review lifecycle"
          ],
          [
            "reviews",
            "conflict_id, reviewer_id, revision_id, decision",
            "One decision per reviewer/revision"
          ],
          [
            "checkpoints",
            "id, project_id, snapshot_ref, actor_id",
            "Restorable committed snapshots"
          ],
          [
            "reference_docs",
            "id, project_id, title, category, revision_id",
            "Project documentation"
          ],
          [
            "outbox_events",
            "id, project_id, event_type, payload, delivered_at",
            "Post-commit delivery"
          ]
        ]
      },
      {
        "type": "h2",
        "id": "constraints",
        "text": "Constraints and indexes"
      },
      {
        "type": "ul",
        "items": [
          "Use foreign keys for project, file and revision ownership. Validate same-project references at write boundaries.",
          "Index conflicts by project and stage, checkpoints by project and creation time, and documents by project and category.",
          "Store timestamps consistently and sort lists by timestamp plus a stable ID.",
          "Add a unique operation key for merge requests and import jobs to prevent duplicate results."
        ]
      },
      {
        "type": "h2",
        "id": "transactions",
        "text": "Atomic merge transaction"
      },
      {
        "type": "ul",
        "items": [
          "Validate membership, approvals, proposal signature and expected baseline.",
          "Lock the affected file baselines in deterministic order.",
          "Create new revisions and the checkpoint, update baseline pointers, and mark conflicts merged.",
          "Insert audit and outbox events in the same transaction. Roll back every write if any validation fails."
        ]
      },
      {
        "type": "h2",
        "id": "migrations",
        "text": "Migrations and recovery"
      },
      {
        "type": "ul",
        "items": [
          "Use versioned migrations and review generated SQL before release.",
          "Prefer additive changes: deploy readers that accept old and new shapes before backfilling.",
          "Test restoration against a non-production database and validate revision/checkpoint integrity.",
          "Keep large artifact contents outside hot list queries; load content by reference."
        ]
      }
    ]
  },
  {
    "id": "doc-backend-api",
    "title": "Backend API & authorization",
    "summary": "Project-scoped endpoints, authorization checks and optimistic concurrency.",
    "authorId": "james",
    "updatedAtLabel": "Today",
    "type": "spec",
    "searchKeywords": [
      "backend",
      "api",
      "auth",
      "인증",
      "권한",
      "백엔드"
    ],
    "blocks": [
      {
        "type": "callout",
        "tone": "info",
        "text": "Draft implementation proposal. The current Devsign demo uses client-side state and local storage; the services and schemas below are proposed, not deployed infrastructure."
      },
      {
        "type": "h2",
        "id": "routes",
        "text": "Proposed endpoints"
      },
      {
        "type": "table",
        "columns": [
          "Method",
          "Route",
          "Purpose"
        ],
        "rows": [
          [
            "GET",
            "/api/projects/:projectId/docs",
            "List permitted project docs"
          ],
          [
            "GET",
            "/api/projects/:projectId/docs/:docId",
            "Read a document revision"
          ],
          [
            "PATCH",
            "/api/projects/:projectId/files/:fileId/draft",
            "Update a draft with an expected revision"
          ],
          [
            "POST",
            "/api/projects/:projectId/conflicts/:conflictId/reviews",
            "Record approval or requested changes"
          ],
          [
            "POST",
            "/api/projects/:projectId/merges",
            "Execute an approved proposal"
          ],
          [
            "GET",
            "/api/projects/:projectId/checkpoints",
            "Paginate project history"
          ]
        ]
      },
      {
        "type": "h2",
        "id": "access",
        "text": "Access policy"
      },
      {
        "type": "ul",
        "items": [
          "Resolve session identity on the server and enforce membership on every endpoint.",
          "Separate reader, editor, reviewer and merge permissions; ownership does not bypass project access checks.",
          "Authorize resource ownership before returning content or accepting edits.",
          "Audit role changes and merge execution without logging secrets or full document contents."
        ]
      },
      {
        "type": "h2",
        "id": "concurrency",
        "text": "Concurrency and retries"
      },
      {
        "type": "p",
        "text": "Draft writes carry an expected revision. Reject stale writes with a conflict response containing the latest revision ID so the client can compare before retrying. Merge requests carry an idempotency key; repeated requests return the same operation result."
      },
      {
        "type": "h2",
        "id": "errors",
        "text": "Error contract"
      },
      {
        "type": "table",
        "columns": [
          "Status",
          "Meaning",
          "Client behavior"
        ],
        "rows": [
          [
            "401",
            "No valid session",
            "Prompt sign-in"
          ],
          [
            "403",
            "Action not permitted",
            "Show access error without retry"
          ],
          [
            "404",
            "Resource absent or inaccessible",
            "Return to the project list"
          ],
          [
            "409",
            "Revision or baseline changed",
            "Refresh and compare revisions"
          ],
          [
            "422",
            "Invalid input",
            "Show field-level validation"
          ],
          [
            "429",
            "Request limit reached",
            "Retry after the provided delay"
          ]
        ]
      },
      {
        "type": "h2",
        "id": "pagination",
        "text": "Pagination"
      },
      {
        "type": "p",
        "text": "Use stable cursor pagination and a bounded page size. Return a next cursor with the results. Project document search should eventually run server-side with the same access scope as document reads."
      }
    ]
  },
  {
    "id": "doc-backend-jobs",
    "title": "Background jobs & integrations",
    "summary": "Import processing, retry policy and reliable event delivery.",
    "authorId": "james",
    "updatedAtLabel": "Today",
    "type": "spec",
    "searchKeywords": [
      "backend",
      "jobs",
      "queue",
      "worker",
      "webhook",
      "백엔드",
      "비동기"
    ],
    "blocks": [
      {
        "type": "callout",
        "tone": "info",
        "text": "Draft implementation proposal. The current Devsign demo uses client-side state and local storage; the services and schemas below are proposed, not deployed infrastructure."
      },
      {
        "type": "h2",
        "id": "jobs",
        "text": "Job types"
      },
      {
        "type": "table",
        "columns": [
          "Job",
          "Input",
          "Output"
        ],
        "rows": [
          [
            "File import",
            "Project, actor and upload reference",
            "Validated file revisions"
          ],
          [
            "Design analysis",
            "Revision IDs and comparison options",
            "Proposed conflicts"
          ],
          [
            "Notification delivery",
            "Committed outbox event",
            "Delivery status"
          ],
          [
            "Artifact cleanup",
            "Expired upload references",
            "Removal audit record"
          ]
        ]
      },
      {
        "type": "h2",
        "id": "lifecycle",
        "text": "Job lifecycle"
      },
      {
        "type": "ul",
        "items": [
          "Create a queued job only after validating project access and input limits.",
          "Claim a job with a lease; record attempts and heartbeat while processing.",
          "Write results transactionally with a unique deduplication key.",
          "Mark success after results are durable; make repeated execution return the same result."
        ]
      },
      {
        "type": "h2",
        "id": "retries",
        "text": "Failures and retry policy"
      },
      {
        "type": "ul",
        "items": [
          "Retry temporary network and service errors with bounded exponential backoff and jitter.",
          "Treat invalid inputs and authorization failures as terminal.",
          "Move exhausted jobs into a failed state with a safe error message and a manual retry action.",
          "Expose progress to the requesting project; cancellation must not publish partially generated results."
        ]
      },
      {
        "type": "h2",
        "id": "integrations",
        "text": "External integrations"
      },
      {
        "type": "ul",
        "items": [
          "Store integration credentials server-side and scope them to the owning project or team.",
          "Validate webhook signatures before accepting events and reject duplicate event IDs.",
          "Scan and validate imported file types and sizes before generating previews.",
          "Use an outbox to deliver events after commit so rolled-back merges never notify reviewers."
        ]
      }
    ]
  },
  {
    "id": "doc-backend-operations",
    "title": "Backend deployment & operations",
    "summary": "Release checks, observability, recovery and incident response.",
    "authorId": "james",
    "updatedAtLabel": "Today",
    "type": "spec",
    "searchKeywords": [
      "backend",
      "deployment",
      "operations",
      "백엔드",
      "배포",
      "운영"
    ],
    "blocks": [
      {
        "type": "callout",
        "tone": "info",
        "text": "Draft implementation proposal. The current Devsign demo uses client-side state and local storage; the services and schemas below are proposed, not deployed infrastructure."
      },
      {
        "type": "h2",
        "id": "environments",
        "text": "Environment boundaries"
      },
      {
        "type": "ul",
        "items": [
          "Separate development, staging and production data and credentials.",
          "Validate required configuration at startup; do not expose secrets in logs or client bundles.",
          "Use restricted service accounts for the API, worker and migration process."
        ]
      },
      {
        "type": "h2",
        "id": "release",
        "text": "Release checklist"
      },
      {
        "type": "ul",
        "items": [
          "Run API authorization, revision-conflict and merge-transaction tests.",
          "Apply backward-compatible migrations before enabling new writes.",
          "Check readiness, worker health and error rates in staging.",
          "Roll out gradually and retain a tested rollback plan for application code."
        ]
      },
      {
        "type": "h2",
        "id": "observability",
        "text": "Observability"
      },
      {
        "type": "table",
        "columns": [
          "Signal",
          "Purpose"
        ],
        "rows": [
          [
            "Request duration and failures",
            "Detect API regressions"
          ],
          [
            "Database pool usage and slow queries",
            "Find saturation and query bottlenecks"
          ],
          [
            "Queue age, retries and failed jobs",
            "Detect stalled background processing"
          ],
          [
            "Merge conflicts and denied operations",
            "Investigate workflow failures"
          ],
          [
            "Outbox delivery lag",
            "Check event delivery reliability"
          ]
        ]
      },
      {
        "type": "h2",
        "id": "recovery",
        "text": "Backup and recovery"
      },
      {
        "type": "p",
        "text": "Define recovery-point and recovery-time targets with the project owner before production rollout. Document backup ownership, retention and restore procedures. Run restoration drills and verify files, reviews, document revisions and checkpoints together."
      },
      {
        "type": "h2",
        "id": "incidents",
        "text": "Incident response"
      },
      {
        "type": "ul",
        "items": [
          "Identify the affected projects and disable the failing write path when needed.",
          "Preserve audit trails, correlate request and job IDs, and avoid copying sensitive content into incident notes.",
          "Restore service, reconcile incomplete operations, and verify baseline consistency.",
          "Record the cause, corrective action and a test that prevents recurrence."
        ]
      }
    ]
  }
]
