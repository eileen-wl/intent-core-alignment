import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AgentRunRead,
  CGSupervisorReviewRead,
  ContextReconstructionRead,
  ContextSnapshotRead,
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  DecisionRead,
  ExecutionAnchorRead,
  ExecutionAnchorRevisionRead,
  HumanGateRead,
  IntentBriefRead,
  IntentDecompositionRead,
  ShotRead,
  TaskRead,
  VersionRead,
} from "@intent-core/contracts";

import { ShotAnchorPage } from "./ShotAnchorPage";

const NOW = "2026-01-01T00:00:00Z";

function shot(overrides: Partial<ShotRead> = {}): ShotRead {
  return {
    id: "shot-1",
    project_id: "proj-1",
    name: "SH010",
    source: "manual",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function brief(overrides: Partial<IntentBriefRead> = {}): IntentBriefRead {
  return {
    id: "brief-1",
    shot_id: "shot-1",
    raw_text: "Keep the dread quiet and let it build.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    source_external_id: null,
    created_at: NOW,
    ...overrides,
  };
}

function coreAnchor(overrides: Partial<CoreAnchorRead> = {}): CoreAnchorRead {
  return {
    id: "anchor-1",
    shot_id: "shot-1",
    active_revision_id: "rev-confirmed",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function revision(
  overrides: Partial<CoreAnchorRevisionRead>,
): CoreAnchorRevisionRead {
  return {
    id: "rev-x",
    core_anchor_id: "anchor-1",
    revision_number: 1,
    status: "draft",
    shot_objective: null,
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: null,
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: null,
    confirmed_by_actor_id: null,
    confirmed_at: null,
    supersedes_revision_id: null,
    source_intent_decomposition_id: null,
    created_at: NOW,
    updated_at: NOW,
    constraints: [],
    variation_zones: [],
    drift_risks: [],
    references: [],
    open_questions: [],
    ...overrides,
  };
}

function constraintItem(id: string, content: string, orderIndex = 0) {
  return { id, order_index: orderIndex, content, created_at: NOW };
}

function variationZoneItem(id: string, content: string, orderIndex = 0) {
  return { id, order_index: orderIndex, content, created_at: NOW };
}

function driftRiskItem(id: string, description: string, orderIndex = 0) {
  return { id, order_index: orderIndex, description, created_at: NOW };
}

function referenceItem(
  id: string,
  label: string,
  uri: string | null,
  note: string | null,
  orderIndex = 0,
) {
  return { id, order_index: orderIndex, label, uri, note, created_at: NOW };
}

function openQuestionItem(id: string, question: string, orderIndex = 0) {
  return { id, order_index: orderIndex, question, created_at: NOW };
}

/** A draft revision with all five semantic collections populated, used by
 * the Step 1A-UI test cases below. */
function populatedDraftRevision(
  overrides: Partial<CoreAnchorRevisionRead> = {},
): CoreAnchorRevisionRead {
  return revision({
    id: "rev-draft",
    revision_number: 2,
    status: "draft",
    shot_objective: "Slightly louder now",
    constraints: [
      constraintItem("c1", "Preserve restrained performance", 0),
      constraintItem("c2", "Avoid exaggerated camera movement", 1),
    ],
    variation_zones: [
      variationZoneItem("vz1", "Camera speed may vary slightly", 0),
    ],
    drift_risks: [driftRiskItem("dr1", "Excessive shake weakens tone", 0)],
    references: [
      referenceItem(
        "r1",
        "Mood ref",
        "https://example.invalid/ref",
        "reference note",
        0,
      ),
      referenceItem("r2", "Text-only ref", null, null, 1),
    ],
    open_questions: [
      openQuestionItem("oq1", "Is tension physical or emotional?", 0),
    ],
    ...overrides,
  });
}

function dimensionAnalysis(summary: string, rationale: string) {
  return { summary, rationale };
}

function intentDecomposition(
  overrides: Partial<IntentDecompositionRead> = {},
): IntentDecompositionRead {
  return {
    id: "decomp-1",
    shot_id: "shot-1",
    intent_brief_id: "brief-1",
    context_snapshot_id: "snapshot-decomp-1",
    agent_run_id: "run-decomp-1",
    core_intent_summary: "Keep the dread quiet and let it build.",
    anchor_relevant_content: "A slow, restrained build of tension.",
    dimensions: {
      emotional_tone: dimensionAnalysis(
        "Quiet dread",
        "The brief emphasizes restraint over spectacle.",
      ),
      visual_focus: dimensionAnalysis(
        "Character stillness",
        "Focus stays on the character, not the environment.",
      ),
      rhythm_and_intensity: dimensionAnalysis(
        "Slow build",
        "Intensity should rise gradually, not spike.",
      ),
      character_relationships: dimensionAnalysis(
        "Distance held",
        "The relationship stays unresolved through the shot.",
      ),
      narrative_priority: dimensionAnalysis(
        "Tension over clarity",
        "Ambiguity serves the story more than exposition.",
      ),
      technical_execution_requirements: dimensionAnalysis(
        "Minimal camera movement",
        "Movement would undercut the restraint.",
      ),
      visual_detail_constraints: dimensionAnalysis(
        "Low-key lighting",
        "Bright lighting would break the mood.",
      ),
    },
    candidate_constraints: ["Preserve restrained performance"],
    candidate_variation_zones: ["Camera speed may vary slightly"],
    contextual_information: ["Shot precedes a dialogue-heavy sequence"],
    uncertainties: [],
    created_at: NOW,
    ...overrides,
  };
}

function evidenceReference(
  sourceType: ContextReconstructionRead["reconstructed_context"]["original_intent"]["evidence"][number]["source_type"],
  sourceId: string,
  label: string,
) {
  return { source_type: sourceType, source_id: sourceId, label };
}

function reconstructionItem(
  summary: string,
  rationale: string,
  evidence: ReturnType<typeof evidenceReference>[] = [
    evidenceReference("shot", "shot-1", "Shot SH010"),
  ],
) {
  return { summary, rationale, evidence };
}

function contextReconstruction(
  overrides: Partial<ContextReconstructionRead> = {},
): ContextReconstructionRead {
  return {
    id: "recon-1",
    shot_id: "shot-1",
    context_snapshot_id: "snapshot-reconstruction-1",
    agent_run_id: "run-reconstruction-1",
    reconstructed_context: {
      context_summary:
        "Reconstructed from 1 Intent Decomposition, no confirmed Core Anchor.",
      original_intent: reconstructionItem(
        "Original intent recorded via Intent Brief.",
        "Derived directly from the recorded Intent Brief text.",
        [evidenceReference("intent_brief", "brief-1", "Intent Brief brief-1")],
      ),
      current_creative_direction: reconstructionItem(
        "No Core Anchor direction has yet been established for this Shot.",
        "No CoreAnchor row exists for this Shot.",
      ),
      execution_context: reconstructionItem(
        "No Execution Anchor context is recorded for this Shot's tasks yet.",
        "No ExecutionAnchor rows exist for this Shot's tasks.",
      ),
      key_decisions: [],
      active_constraints: [],
      allowed_variations: [],
      unresolved_questions: [],
      context_gaps: ["No Core Anchor has been established for this Shot."],
    },
    created_at: NOW,
    ...overrides,
  };
}

function task(overrides: Partial<TaskRead> = {}): TaskRead {
  return {
    id: "task-1",
    shot_id: "shot-1",
    name: "Anim block",
    department: "animation",
    source: "manual",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function executionAnchor(
  overrides: Partial<ExecutionAnchorRead> = {},
): ExecutionAnchorRead {
  return {
    id: "ea-1",
    task_id: "task-1",
    active_revision_id: null,
    is_stale: false,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function executionAnchorRevision(
  overrides: Partial<ExecutionAnchorRevisionRead>,
): ExecutionAnchorRevisionRead {
  return {
    id: "ea-rev-1",
    execution_anchor_id: "ea-1",
    core_anchor_revision_id: "rev-confirmed",
    revision_number: 1,
    status: "confirmed",
    technical_boundaries: null,
    parameter_ranges: null,
    delivery_conditions: null,
    production_ready_criteria: null,
    downstream_dependencies: null,
    publish_requirements: null,
    allowed_refinements: null,
    escalation_conditions: null,
    created_by_actor_kind: "human",
    created_by_actor_id: "cg-1",
    created_by_human_role: "cg_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    confirmed_by_human_role: "cg_supervisor",
    confirmed_by_actor_id: "cg-1",
    confirmed_at: NOW,
    supersedes_revision_id: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function cgSupervisorReview(
  overrides: Partial<CGSupervisorReviewRead> = {},
): CGSupervisorReviewRead {
  return {
    id: "cg-review-1",
    project_id: "proj-1",
    shot_id: "shot-1",
    task_id: "task-1",
    execution_anchor_revision_id: "ea-rev-draft",
    context_snapshot_id: "snapshot-cg-1",
    agent_run_id: "run-cg-1",
    review_output: {
      executive_summary: "One recorded field, one constraint considered.",
      execution_direction_read: {
        summary: "Review against the target Execution Anchor revision.",
        rationale: "Directly stated on the target Execution Anchor revision.",
        priority: "high",
        evidence: [
          {
            source_type: "execution_anchor_revision",
            source_id: "ea-rev-draft",
            label: "Execution Anchor revision",
          },
        ],
      },
      actionable_requirements: [],
      technical_concerns: [],
      coordination_concerns: [],
      implementation_priorities: [],
      proposed_execution_guidance: [
        {
          guidance: "Confirm the 24fps boundary is respected in the render.",
          underlying_intent: "Recorded directly on the Execution Anchor.",
          priority: "medium",
          evidence: [
            {
              source_type: "execution_anchor_revision",
              source_id: "ea-rev-draft",
              label: "Execution Anchor revision",
            },
          ],
        },
      ],
      questions_for_human_cg_supervisor: [
        "Does the actual render match this description?",
      ],
      evidence_gaps: [
        "No footage, frame, or render evidence is available to this Agent.",
      ],
    },
    created_at: NOW,
    ...overrides,
  };
}

function decision(overrides: Partial<DecisionRead> = {}): DecisionRead {
  return {
    id: "decision-1",
    decision_type: "confirm_core_anchor",
    owning_human_role: "vfx_supervisor",
    actor_kind: "human",
    actor_id: "vfx-1",
    actor_human_role: "vfx_supervisor",
    rationale: "matches the brief",
    entity_type: "core_anchor_revision",
    entity_id: "rev-confirmed",
    write_back_requested: false,
    supersedes_decision_id: null,
    created_at: NOW,
    ...overrides,
  };
}

function humanGate(overrides: Partial<HumanGateRead> = {}): HumanGateRead {
  return {
    id: "gate-1",
    shot_id: "shot-1",
    core_anchor_revision_id: "rev-draft",
    execution_anchor_revision_id: null,
    gate_type: "core_anchor_confirmation",
    required_role: "vfx_supervisor",
    status: "pending",
    opened_at: NOW,
    resolved_at: null,
    resolved_by_actor_id: null,
    resolved_by_role: null,
    resolved_by_actor_type: null,
    rationale: null,
    decision_id: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function agentRun(overrides: Partial<AgentRunRead> = {}): AgentRunRead {
  return {
    id: "run-123",
    shot_id: "shot-1",
    context_snapshot_id: "snapshot-1",
    agent_type: "core_agent",
    capability: "core_anchor_drafting",
    provider: "deterministic",
    model_name: null,
    prompt_version: null,
    status: "succeeded",
    result_revision_id: "rev-draft",
    error: null,
    started_at: NOW,
    completed_at: NOW,
    ...overrides,
  };
}

function version(overrides: Partial<VersionRead> = {}): VersionRead {
  return {
    id: "version-1",
    shot_id: "shot-1",
    name: "SH010_render_v001",
    version_number: 1,
    description: "First render pass.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: NOW,
    ...overrides,
  };
}

function contextSnapshot(
  overrides: Partial<ContextSnapshotRead> = {},
): ContextSnapshotRead {
  return {
    id: "snapshot-1",
    shot_id: "shot-1",
    payload: { shot: { id: "shot-1", name: "SH010", source: "manual" } },
    created_at: NOW,
    ...overrides,
  };
}

interface Fixture {
  shot: ShotRead | null;
  briefs: IntentBriefRead[];
  intentDecompositions: IntentDecompositionRead[];
  coreAnchor: CoreAnchorRead | null;
  revisions: CoreAnchorRevisionRead[];
  decisions: Record<string, DecisionRead[]>;
  tasks: TaskRead[];
  executionAnchors: Record<string, ExecutionAnchorRead | null>;
  executionAnchorRevisions: Record<string, ExecutionAnchorRevisionRead>;
  executionAnchorRevisionsForTask: Record<
    string,
    ExecutionAnchorRevisionRead[]
  >;
  executionAnchorHumanGates: Record<string, HumanGateRead>;
  cgSupervisorReviews: Record<string, CGSupervisorReviewRead[]>;
  agentRuns: Record<string, AgentRunRead>;
  contextSnapshots: Record<string, ContextSnapshotRead>;
  versions: VersionRead[];
  contextReconstructions: ContextReconstructionRead[];
  humanGates: Record<string, HumanGateRead>;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

/** Installs a stateful `fetch` mock backed by `fixture`, mutating it the
 * same way the real backend would on PATCH/confirm/reject so a page
 * `reload()` sees post-mutation state -- mirrors the
 * httpx.MockTransport-style routers already used on the Python side. */
function installFetchMock(
  fixture: Fixture,
  overrides: {
    onRequest?: (
      method: string,
      path: string,
    ) => Response | Promise<Response> | null;
  } = {},
) {
  const fetchMock = vi.fn(
    async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      const path = url.pathname;
      const method = init?.method ?? "GET";

      const overridden = await overrides.onRequest?.(method, path);
      if (overridden) return overridden;

      if (method === "GET" && path === "/shots/shot-1") {
        return fixture.shot
          ? jsonResponse(200, fixture.shot)
          : jsonResponse(404, { detail: "Shot not found" });
      }
      if (method === "GET" && path === "/intent/shots/shot-1/briefs") {
        return jsonResponse(200, fixture.briefs);
      }
      if (
        method === "GET" &&
        path === "/intent/shots/shot-1/intent-decompositions"
      ) {
        return jsonResponse(200, fixture.intentDecompositions);
      }
      if (
        method === "POST" &&
        path === "/intent/shots/shot-1/intent-decompositions/generate"
      ) {
        const generated = intentDecomposition({
          id: `decomp-${fixture.intentDecompositions.length + 1}`,
        });
        fixture.intentDecompositions = [
          generated,
          ...fixture.intentDecompositions,
        ];
        return jsonResponse(201, generated);
      }
      const applyDecompositionMatch =
        /^\/intent\/intent-decompositions\/([^/]+)\/core-anchor-draft$/.exec(
          path,
        );
      if (method === "POST" && applyDecompositionMatch) {
        const decompositionId = applyDecompositionMatch[1];
        const source = fixture.intentDecompositions.find(
          (d) => d.id === decompositionId,
        );
        if (!source) {
          return jsonResponse(404, {
            detail: "Intent decomposition not found",
          });
        }
        if (fixture.revisions.some((r) => r.status === "draft")) {
          return jsonResponse(409, {
            detail:
              "An editable Core Anchor draft already exists for this shot",
          });
        }
        const generated = revision({
          id: "rev-from-decomp",
          revision_number: fixture.revisions.length + 1,
          status: "draft",
          shot_objective: source.anchor_relevant_content,
          created_by_actor_kind: "agent",
          created_by_actor_id: "core_agent",
          created_by_human_role: null,
          created_by_agent_type: "core_agent",
          created_by_agent_run_id: "run-apply-1",
          source_intent_decomposition_id: source.id,
        });
        fixture.revisions.push(generated);
        return jsonResponse(201, generated);
      }
      if (
        method === "GET" &&
        path === "/intent/shots/shot-1/context-reconstructions"
      ) {
        return jsonResponse(200, fixture.contextReconstructions);
      }
      if (
        method === "POST" &&
        path === "/intent/shots/shot-1/context-reconstructions/generate"
      ) {
        const generated = contextReconstruction({
          id: `recon-${fixture.contextReconstructions.length + 1}`,
        });
        fixture.contextReconstructions = [
          generated,
          ...fixture.contextReconstructions,
        ];
        return jsonResponse(201, generated);
      }
      if (method === "GET" && path === "/intent/shots/shot-1/core-anchor") {
        return fixture.coreAnchor
          ? jsonResponse(200, fixture.coreAnchor)
          : jsonResponse(404, { detail: "Core anchor not found for shot" });
      }
      if (
        method === "GET" &&
        path === "/intent/shots/shot-1/core-anchor/revisions"
      ) {
        return jsonResponse(200, fixture.revisions);
      }
      if (method === "GET" && path === "/tasks") {
        return jsonResponse(200, fixture.tasks);
      }
      if (method === "GET" && path === "/shots/shot-1/versions") {
        return jsonResponse(200, fixture.versions);
      }
      const executionAnchorMatch =
        /^\/intent\/tasks\/([^/]+)\/execution-anchor$/.exec(path);
      if (method === "GET" && executionAnchorMatch) {
        const anchor =
          fixture.executionAnchors[executionAnchorMatch[1]] ?? null;
        return anchor
          ? jsonResponse(200, anchor)
          : jsonResponse(404, { detail: "Execution anchor not found" });
      }
      const executionRevisionMatch =
        /^\/intent\/execution-anchor-revisions\/([^/]+)$/.exec(path);
      if (method === "GET" && executionRevisionMatch) {
        const id = executionRevisionMatch[1];
        const rev =
          fixture.executionAnchorRevisions[id] ??
          Object.values(fixture.executionAnchorRevisionsForTask)
            .flat()
            .find((r) => r.id === id);
        return rev
          ? jsonResponse(200, rev)
          : jsonResponse(404, {
              detail: "Execution anchor revision not found",
            });
      }
      const executionRevisionsForTaskMatch =
        /^\/intent\/tasks\/([^/]+)\/execution-anchor\/revisions$/.exec(path);
      if (method === "GET" && executionRevisionsForTaskMatch) {
        return jsonResponse(
          200,
          fixture.executionAnchorRevisionsForTask[
            executionRevisionsForTaskMatch[1]
          ] ?? [],
        );
      }
      const executionHumanGateMatch =
        /^\/intent\/execution-anchor-revisions\/([^/]+)\/human-gate$/.exec(
          path,
        );
      if (method === "GET" && executionHumanGateMatch) {
        const gate =
          fixture.executionAnchorHumanGates[executionHumanGateMatch[1]];
        return gate
          ? jsonResponse(200, gate)
          : jsonResponse(404, {
              detail: "No persisted human gate exists for this revision",
            });
      }
      const cgReviewsListMatch =
        /^\/intent\/execution-anchor-revisions\/([^/]+)\/cg-supervisor-reviews$/.exec(
          path,
        );
      if (method === "GET" && cgReviewsListMatch) {
        return jsonResponse(
          200,
          fixture.cgSupervisorReviews[cgReviewsListMatch[1]] ?? [],
        );
      }
      const cgReviewGenerateMatch =
        /^\/intent\/execution-anchor-revisions\/([^/]+)\/cg-supervisor-reviews\/generate$/.exec(
          path,
        );
      if (method === "POST" && cgReviewGenerateMatch) {
        const revisionId = cgReviewGenerateMatch[1];
        const existing = fixture.cgSupervisorReviews[revisionId] ?? [];
        const generated = cgSupervisorReview({
          id: `cg-review-${existing.length + 1}`,
          execution_anchor_revision_id: revisionId,
        });
        fixture.cgSupervisorReviews[revisionId] = [generated, ...existing];
        return jsonResponse(201, generated);
      }
      const executionConfirmMatch =
        /^\/intent\/execution-anchor-revisions\/([^/]+)\/confirm$/.exec(path);
      if (method === "POST" && executionConfirmMatch) {
        const id = executionConfirmMatch[1];
        for (const [taskId, list] of Object.entries(
          fixture.executionAnchorRevisionsForTask,
        )) {
          const idx = list.findIndex((r) => r.id === id);
          if (idx === -1) continue;
          if (list[idx].status !== "draft") {
            return jsonResponse(409, {
              detail: "Revision is not in draft status",
            });
          }
          list[idx] = {
            ...list[idx],
            status: "confirmed",
            confirmed_by_human_role: "cg_supervisor",
            confirmed_by_actor_id: "cg-1",
            confirmed_at: NOW,
          };
          const anchor = fixture.executionAnchors[taskId];
          if (anchor) {
            fixture.executionAnchors[taskId] = {
              ...anchor,
              active_revision_id: id,
            };
          }
          const gate = fixture.executionAnchorHumanGates[id];
          if (gate) {
            fixture.executionAnchorHumanGates[id] = {
              ...gate,
              status: "confirmed",
              resolved_at: NOW,
              resolved_by_actor_id: "cg-1",
              resolved_by_role: "cg_supervisor",
              resolved_by_actor_type: "human",
              decision_id: "decision-execution-confirm-1",
            };
          }
          return jsonResponse(200, list[idx]);
        }
        return jsonResponse(404, {
          detail: "Execution anchor revision not found",
        });
      }
      const executionRejectMatch =
        /^\/intent\/execution-anchor-revisions\/([^/]+)\/reject$/.exec(path);
      if (method === "POST" && executionRejectMatch) {
        const id = executionRejectMatch[1];
        for (const list of Object.values(
          fixture.executionAnchorRevisionsForTask,
        )) {
          const idx = list.findIndex((r) => r.id === id);
          if (idx === -1) continue;
          if (list[idx].status !== "draft") {
            return jsonResponse(409, {
              detail: "Revision is not in draft status",
            });
          }
          list[idx] = { ...list[idx], status: "rejected" };
          const gate = fixture.executionAnchorHumanGates[id];
          if (gate) {
            fixture.executionAnchorHumanGates[id] = {
              ...gate,
              status: "rejected",
              resolved_at: NOW,
              resolved_by_actor_id: "cg-1",
              resolved_by_role: "cg_supervisor",
              resolved_by_actor_type: "human",
              decision_id: "decision-execution-reject-1",
            };
          }
          return jsonResponse(200, list[idx]);
        }
        return jsonResponse(404, {
          detail: "Execution anchor revision not found",
        });
      }
      const decisionsMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)\/decisions$/.exec(path);
      if (method === "GET" && decisionsMatch) {
        return jsonResponse(200, fixture.decisions[decisionsMatch[1]] ?? []);
      }
      const humanGateMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)\/human-gate$/.exec(path);
      if (method === "GET" && humanGateMatch) {
        const gate = fixture.humanGates[humanGateMatch[1]];
        return gate
          ? jsonResponse(200, gate)
          : jsonResponse(404, {
              detail: "No persisted human gate exists for this revision",
            });
      }
      const agentRunMatch = /^\/intent\/agent-runs\/([^/]+)$/.exec(path);
      if (method === "GET" && agentRunMatch) {
        const run = fixture.agentRuns[agentRunMatch[1]];
        return run
          ? jsonResponse(200, run)
          : jsonResponse(404, { detail: "Agent run not found" });
      }
      const contextSnapshotMatch =
        /^\/intent\/context-snapshots\/([^/]+)$/.exec(path);
      if (method === "GET" && contextSnapshotMatch) {
        const snapshot = fixture.contextSnapshots[contextSnapshotMatch[1]];
        return snapshot
          ? jsonResponse(200, snapshot)
          : jsonResponse(404, { detail: "Context snapshot not found" });
      }
      const patchRevisionMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)$/.exec(path);
      if (method === "PATCH" && patchRevisionMatch) {
        const id = patchRevisionMatch[1];
        const idx = fixture.revisions.findIndex((r) => r.id === id);
        if (idx === -1)
          return jsonResponse(404, {
            detail: "Core anchor revision not found",
          });
        const changes = JSON.parse(
          String(init?.body),
        ) as Partial<CoreAnchorRevisionRead>;
        if (fixture.revisions[idx].status !== "draft") {
          return jsonResponse(409, {
            detail: "Revision is not in draft status",
          });
        }
        fixture.revisions[idx] = { ...fixture.revisions[idx], ...changes };
        return jsonResponse(200, fixture.revisions[idx]);
      }
      const confirmMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)\/confirm$/.exec(path);
      if (method === "POST" && confirmMatch) {
        const id = confirmMatch[1];
        const idx = fixture.revisions.findIndex((r) => r.id === id);
        if (idx === -1)
          return jsonResponse(404, {
            detail: "Core anchor revision not found",
          });
        if (fixture.revisions[idx].status !== "draft") {
          return jsonResponse(409, {
            detail: "Revision is not in draft status",
          });
        }
        fixture.revisions[idx] = {
          ...fixture.revisions[idx],
          status: "confirmed",
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_by_actor_id: "vfx-1",
          confirmed_at: NOW,
        };
        return jsonResponse(200, fixture.revisions[idx]);
      }
      const rejectMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)\/reject$/.exec(path);
      if (method === "POST" && rejectMatch) {
        const id = rejectMatch[1];
        const idx = fixture.revisions.findIndex((r) => r.id === id);
        if (idx === -1)
          return jsonResponse(404, {
            detail: "Core anchor revision not found",
          });
        if (fixture.revisions[idx].status !== "draft") {
          return jsonResponse(409, {
            detail: "Revision is not in draft status",
          });
        }
        fixture.revisions[idx] = {
          ...fixture.revisions[idx],
          status: "rejected",
        };
        return jsonResponse(200, fixture.revisions[idx]);
      }
      if (
        method === "POST" &&
        path === "/intent/shots/shot-1/core-anchor/generate"
      ) {
        if (fixture.revisions.some((r) => r.status === "draft")) {
          return jsonResponse(409, {
            detail:
              "An editable Core Anchor draft already exists for this shot",
          });
        }
        const generated = revision({
          id: "rev-generated",
          revision_number: fixture.revisions.length + 1,
          status: "draft",
          shot_objective: "[Core Agent draft] generated objective",
          created_by_actor_kind: "agent",
          created_by_actor_id: "core_agent",
          created_by_human_role: null,
          created_by_agent_type: "core_agent",
          created_by_agent_run_id: "run-1",
        });
        fixture.revisions.push(generated);
        return jsonResponse(201, generated);
      }

      throw new Error(`Unhandled request in test: ${method} ${path}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function baseFixture(): Fixture {
  return {
    shot: shot(),
    briefs: [brief()],
    intentDecompositions: [],
    coreAnchor: coreAnchor(),
    revisions: [
      revision({
        id: "rev-confirmed",
        revision_number: 1,
        status: "confirmed",
        shot_objective: "Keep dread quiet",
        confirmed_by_human_role: "vfx_supervisor",
        confirmed_by_actor_id: "vfx-1",
        confirmed_at: NOW,
      }),
      revision({
        id: "rev-draft",
        revision_number: 2,
        status: "draft",
        shot_objective: "Slightly louder now",
      }),
    ],
    decisions: {
      "rev-confirmed": [decision({ entity_id: "rev-confirmed" })],
    },
    tasks: [task()],
    executionAnchors: {
      "task-1": executionAnchor({
        active_revision_id: "ea-rev-1",
        is_stale: true,
      }),
    },
    executionAnchorRevisions: {
      "ea-rev-1": executionAnchorRevision({
        core_anchor_revision_id: "rev-confirmed",
      }),
    },
    executionAnchorRevisionsForTask: {
      "task-1": [
        executionAnchorRevision({
          id: "ea-rev-1",
          core_anchor_revision_id: "rev-confirmed",
        }),
      ],
    },
    executionAnchorHumanGates: {},
    cgSupervisorReviews: {},
    agentRuns: {},
    contextSnapshots: {},
    versions: [],
    contextReconstructions: [],
    humanGates: {
      "rev-confirmed": humanGate({
        id: "gate-confirmed",
        core_anchor_revision_id: "rev-confirmed",
        status: "confirmed",
        resolved_at: NOW,
        resolved_by_actor_id: "vfx-1",
        resolved_by_role: "vfx_supervisor",
        resolved_by_actor_type: "human",
        decision_id: "decision-1",
      }),
      "rev-draft": humanGate({
        id: "gate-draft",
        core_anchor_revision_id: "rev-draft",
        status: "pending",
      }),
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShotAnchorPage", () => {
  it("renders shot info, brief, confirmed anchor, and the current draft", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByRole("heading", { name: /SH010/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Keep the dread quiet and let it build\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep dread quiet")).toBeInTheDocument();
    expect(screen.getByLabelText("Draft revision 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Slightly louder now")).toBeInTheDocument();
  });

  it("shows an empty state when the shot has no Core Anchor yet", async () => {
    const fixture = baseFixture();
    fixture.coreAnchor = null;
    fixture.revisions = [];
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByText("No Core Anchor yet for this shot."),
    ).toBeInTheDocument();
  });

  it("shows stale status and the referenced Core revision for an Execution Anchor", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("Status: Stale")).toBeInTheDocument();
    expect(
      screen.getByText(/References Core Anchor revision #1/),
    ).toBeInTheDocument();
  });

  it("shows a not-found state when the shot does not exist", async () => {
    const fixture = baseFixture();
    fixture.shot = null;
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("Shot not found")).toBeInTheDocument();
  });

  it("lets a VFX Supervisor edit and save a draft's fields", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    const fetchMock = installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const objectiveField = await screen.findByLabelText("Shot objective");
    await user.clear(objectiveField);
    await user.type(objectiveField, "Even quieter than before");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "PATCH",
      );
      expect(patchCall).toBeDefined();
    });
    expect(
      await screen.findByDisplayValue("Even quieter than before"),
    ).toBeInTheDocument();
  });

  it("confirms a draft", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    await screen.findByLabelText("Draft revision 2");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Draft revision 2"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("No draft revision awaiting review."),
    ).toBeInTheDocument();
  });

  it("rejects a draft", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    await screen.findByLabelText("Draft revision 2");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Draft revision 2"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("No draft revision awaiting review."),
    ).toBeInTheDocument();
  });

  it("surfaces a 403 from the backend even though the UI allowed the click", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture, {
      onRequest: (method, path) =>
        method === "POST" && path.endsWith("/confirm")
          ? jsonResponse(403, {
              detail:
                "action requires a human actor with role in ['vfx_supervisor']",
            })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    const draft = await screen.findByLabelText("Draft revision 2");
    await user.click(within(draft).getByRole("button", { name: "Confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Not allowed/);
  });

  it("surfaces a 409 conflict from the backend (e.g. a concurrent edit)", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture, {
      // Simulates someone else confirming/rejecting the same draft between
      // this page's load and the user's click: the backend correctly
      // refuses because the revision is no longer in "draft" status.
      onRequest: (method, path) =>
        method === "POST" && path.endsWith("/reject")
          ? jsonResponse(409, { detail: "Revision is not in draft status" })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    const draft = await screen.findByLabelText("Draft revision 2");
    await user.click(within(draft).getByRole("button", { name: "Reject" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Out of date/);
  });

  it("generates a new Core Agent draft and shows it after reload", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByText("No draft revision awaiting review."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Generate draft with Core Agent" }),
    );

    expect(await screen.findByLabelText(/Draft revision/)).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("[Core Agent draft] generated objective"),
    ).toBeInTheDocument();
  });

  it("shows a loading state while a draft is being generated", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    let resolveGenerate: ((response: Response) => void) | undefined;
    installFetchMock(fixture, {
      onRequest: (method, path) => {
        if (
          method === "POST" &&
          path === "/intent/shots/shot-1/core-anchor/generate"
        ) {
          return new Promise<Response>((resolve) => {
            resolveGenerate = resolve;
          });
        }
        return null;
      },
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    await screen.findByText("No draft revision awaiting review.");
    const button = screen.getByRole("button", {
      name: "Generate draft with Core Agent",
    });
    void user.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generating…" }),
      ).toBeDisabled();
    });
    // Let the held request settle so the test doesn't leak a pending
    // promise/timer into the next test. The generated revision must be
    // added to the fixture too, since the reload triggered by
    // `onGenerated()` re-fetches the revisions list from the fixture, not
    // from this response.
    const generated = revision({ id: "rev-generated", status: "draft" });
    fixture.revisions.push(generated);
    resolveGenerate?.(jsonResponse(201, generated));
    await screen.findByLabelText(/Draft revision/);
  });

  it("disables the Generate Draft action when there is no Intent Brief yet", async () => {
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    fixture.briefs = [];
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const button = await screen.findByRole("button", {
      name: "Generate draft with Core Agent",
    });
    expect(button).toBeDisabled();
    expect(button.parentElement).not.toBeNull();
    expect(
      within(button.parentElement as HTMLElement).getByText(
        "Add an Intent Brief first.",
      ),
    ).toBeInTheDocument();
  });

  it("surfaces a 409 when generation conflicts with an already-existing draft", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    installFetchMock(fixture, {
      // Simulates someone else creating a draft between this page's load
      // and the click.
      onRequest: (method, path) =>
        method === "POST" &&
        path === "/intent/shots/shot-1/core-anchor/generate"
          ? jsonResponse(409, {
              detail:
                "An editable Core Anchor draft already exists for this shot",
            })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    await user.click(
      await screen.findByRole("button", {
        name: "Generate draft with Core Agent",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/Out of date/);
  });

  it("surfaces a 502 when the Core Agent provider fails", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    installFetchMock(fixture, {
      onRequest: (method, path) =>
        method === "POST" &&
        path === "/intent/shots/shot-1/core-anchor/generate"
          ? jsonResponse(502, {
              detail: "Core Agent draft generation failed: timeout",
            })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    await user.click(
      await screen.findByRole("button", {
        name: "Generate draft with Core Agent",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Core Agent generation failed/,
    );
  });

  it("labels the draft as a Human Review Gate and shows agent provenance", async () => {
    const fixture = baseFixture();
    fixture.revisions[1] = revision({
      id: "rev-draft",
      revision_number: 2,
      status: "draft",
      shot_objective: "Generated objective",
      created_by_actor_kind: "agent",
      created_by_actor_id: "core_agent",
      created_by_human_role: null,
      created_by_agent_type: "core_agent",
      created_by_agent_run_id: "run-123",
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      within(gate).getByRole("heading", {
        name: "Core Anchor Human Review Gate",
      }),
    ).toBeInTheDocument();
    expect(
      within(gate).getByText(/agent type: core_agent/),
    ).toBeInTheDocument();
    expect(within(gate).getByText(/agent run id: run-123/)).toBeInTheDocument();
    expect(within(gate).getByText("Required reviewer")).toBeInTheDocument();
    expect(within(gate).getByText("VFX Supervisor")).toBeInTheDocument();
    expect(
      within(gate).getByText(/vfx_supervisor \(vfx-1\)/),
    ).toBeInTheDocument();
  });

  it("enriches agent provenance with the AgentRun's provider/status and the ContextSnapshot's time", async () => {
    const fixture = baseFixture();
    fixture.revisions[1] = revision({
      id: "rev-draft",
      revision_number: 2,
      status: "draft",
      shot_objective: "Generated objective",
      created_by_actor_kind: "agent",
      created_by_actor_id: "core_agent",
      created_by_human_role: null,
      created_by_agent_type: "core_agent",
      created_by_agent_run_id: "run-123",
      context_snapshot_id: "snapshot-1",
    });
    fixture.agentRuns["run-123"] = agentRun({
      id: "run-123",
      status: "succeeded",
      provider: "deterministic",
    });
    fixture.contextSnapshots["snapshot-1"] = contextSnapshot({
      id: "snapshot-1",
      created_at: NOW,
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      await within(gate).findByText(/provider: deterministic/),
    ).toBeInTheDocument();
    expect(within(gate).getByText(/run status: succeeded/)).toBeInTheDocument();
    expect(
      within(gate).getByText(/context snapshot: snapshot-1/),
    ).toBeInTheDocument();
  });

  it("shows the model name and prompt version when present on the AgentRun", async () => {
    const fixture = baseFixture();
    fixture.revisions[1] = revision({
      id: "rev-draft",
      revision_number: 2,
      status: "draft",
      shot_objective: "Generated objective",
      created_by_actor_kind: "agent",
      created_by_actor_id: "core_agent",
      created_by_human_role: null,
      created_by_agent_type: "core_agent",
      created_by_agent_run_id: "run-123",
      context_snapshot_id: "snapshot-1",
    });
    fixture.agentRuns["run-123"] = agentRun({
      id: "run-123",
      status: "succeeded",
      provider: "deepseek",
      model_name: "deepseek-v4-flash",
      prompt_version: "core_anchor_drafting.v1",
    });
    fixture.contextSnapshots["snapshot-1"] = contextSnapshot({
      id: "snapshot-1",
      created_at: NOW,
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      await within(gate).findByText(/model: deepseek-v4-flash/),
    ).toBeInTheDocument();
    expect(
      within(gate).getByText(/prompt version: core_anchor_drafting\.v1/),
    ).toBeInTheDocument();
  });

  it("omits model name and prompt version for a deterministic run", async () => {
    const fixture = baseFixture();
    fixture.revisions[1] = revision({
      id: "rev-draft",
      revision_number: 2,
      status: "draft",
      shot_objective: "Generated objective",
      created_by_actor_kind: "agent",
      created_by_actor_id: "core_agent",
      created_by_human_role: null,
      created_by_agent_type: "core_agent",
      created_by_agent_run_id: "run-123",
      context_snapshot_id: "snapshot-1",
    });
    fixture.agentRuns["run-123"] = agentRun({
      id: "run-123",
      status: "succeeded",
      provider: "deterministic",
      model_name: null,
      prompt_version: null,
    });
    fixture.contextSnapshots["snapshot-1"] = contextSnapshot({
      id: "snapshot-1",
      created_at: NOW,
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    await within(gate).findByText(/provider: deterministic/);
    expect(within(gate).queryByText(/model:/)).not.toBeInTheDocument();
    expect(within(gate).queryByText(/prompt version:/)).not.toBeInTheDocument();
  });

  it("warns that confirming will make Execution Anchors stale when one is currently confirmed", async () => {
    // baseFixture's Execution Anchor is already stale (used by the "stale
    // status" test below) -- override it to not-yet-stale here, since
    // that's the situation where confirming the draft would actually
    // trigger A2's stale cascade.
    const fixture = baseFixture();
    fixture.executionAnchors["task-1"] = executionAnchor({
      active_revision_id: "ea-rev-1",
      is_stale: false,
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      within(gate).getByText(
        /will mark all confirmed Execution Anchors under this shot as stale/,
      ),
    ).toBeInTheDocument();
  });

  it("does not show the stale warning when there is no currently confirmed revision", async () => {
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter(
      (r) => r.status !== "confirmed",
    );
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      within(gate).queryByText(/will mark all confirmed Execution Anchors/),
    ).not.toBeInTheDocument();
  });

  it("shows a clear success state with rationale after confirming", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    await user.type(
      within(gate).getByLabelText("Decision rationale (optional)"),
      "looks aligned with the brief",
    );
    await user.click(within(gate).getByRole("button", { name: "Confirm" }));

    const banner = await screen.findByText(/Confirmed revision #2/);
    expect(banner).toHaveTextContent("looks aligned with the brief");
  });

  it("shows a clear success state after rejecting", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    await user.click(within(gate).getByRole("button", { name: "Reject" }));

    expect(await screen.findByText(/Rejected revision #2/)).toBeInTheDocument();
  });

  it("does not show a decision as successful before the API call resolves", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    let resolveConfirm: ((response: Response) => void) | undefined;
    installFetchMock(fixture, {
      onRequest: (method, path) => {
        if (method === "POST" && path.endsWith("/confirm")) {
          return new Promise<Response>((resolve) => {
            resolveConfirm = resolve;
          });
        }
        return null;
      },
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    await user.click(within(gate).getByRole("button", { name: "Confirm" }));

    // Held open: the API call has not resolved yet, so no success state
    // must appear -- the frontend must not pretend the Gate passed.
    expect(screen.queryByText(/Confirmed revision #2/)).not.toBeInTheDocument();

    const confirmed = { ...fixture.revisions[1], status: "confirmed" as const };
    fixture.revisions[1] = confirmed;
    resolveConfirm?.(jsonResponse(200, confirmed));
    expect(
      await screen.findByText(/Confirmed revision #2/),
    ).toBeInTheDocument();
  });

  it("shows the confirmed revision's recorded decision rationale", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByText(/Decision rationale: matches the brief/),
    ).toBeInTheDocument();
  });

  it("shows the required reviewer role for each Task's Execution Anchor", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByText("Required reviewer: CG Supervisor"),
    ).toBeInTheDocument();
  });

  it("shows an up-to-date Execution Anchor when it is not stale", async () => {
    const fixture = baseFixture();
    fixture.executionAnchors["task-1"] = executionAnchor({
      active_revision_id: "ea-rev-1",
      is_stale: false,
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("Status: Up to date")).toBeInTheDocument();
  });

  it("shows an empty state when the shot has no Versions yet", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("No Versions yet.")).toBeInTheDocument();
  });

  it("lists a Version with a link to its detail page", async () => {
    const fixture = baseFixture();
    fixture.versions = [version()];
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const link = await screen.findByRole("link", {
      name: "SH010_render_v001",
    });
    expect(link).toHaveAttribute("href", "/shots/shot-1/versions/version-1");
    const item = link.closest("li") as HTMLElement;
    expect(within(item).getByText(/v1/)).toBeInTheDocument();
    expect(within(item).getByText("(manual)")).toBeInTheDocument();
  });

  it("shows a general error state with retry when the shot fetch fails outright", async () => {
    installFetchMock(baseFixture(), {
      onRequest: (method, path) =>
        method === "GET" && path === "/shots/shot-1"
          ? jsonResponse(500, { detail: "boom" })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  describe("Core Anchor semantic collections (Step 1A-UI)", () => {
    it("renders all five semantic collections read-only for the confirmed revision, in the fixed display order", async () => {
      const fixture = baseFixture();
      fixture.revisions = [
        revision({
          id: "rev-confirmed",
          revision_number: 1,
          status: "confirmed",
          shot_objective: "Keep dread quiet",
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_by_actor_id: "vfx-1",
          confirmed_at: NOW,
          constraints: [
            constraintItem("c1", "Preserve restrained performance", 0),
          ],
          variation_zones: [
            variationZoneItem("vz1", "Camera speed may vary slightly", 0),
          ],
          drift_risks: [
            driftRiskItem("dr1", "Excessive shake weakens tone", 0),
          ],
          references: [
            referenceItem(
              "r1",
              "Mood ref",
              "https://example.invalid/ref",
              "reference note",
              0,
            ),
          ],
          open_questions: [
            openQuestionItem("oq1", "Is tension physical or emotional?", 0),
          ],
        }),
      ];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByText("Keep dread quiet");
      const headings = await screen.findAllByRole("heading", { level: 4 });
      expect(headings.map((h) => h.textContent)).toEqual([
        "Must preserve",
        "Allowed variation",
        "High-risk drift points",
        "References",
        "Open questions",
      ]);
      expect(
        screen.getByText("Preserve restrained performance"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Camera speed may vary slightly"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Excessive shake weakens tone"),
      ).toBeInTheDocument();
      expect(screen.getByText("Mood ref")).toBeInTheDocument();
      const link = screen.getByRole("link", {
        name: "https://example.invalid/ref",
      });
      expect(link).toHaveAttribute("href", "https://example.invalid/ref");
      expect(screen.getByText("reference note")).toBeInTheDocument();
      expect(
        screen.getByText("Is tension physical or emotional?"),
      ).toBeInTheDocument();
    });

    it("shows an explicit empty state for empty semantic collections instead of hiding the section", async () => {
      const fixture = baseFixture();
      fixture.revisions = [
        revision({
          id: "rev-confirmed",
          revision_number: 1,
          status: "confirmed",
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_by_actor_id: "vfx-1",
          confirmed_at: NOW,
        }),
      ];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByText("No draft revision awaiting review.");
      expect(screen.getAllByText("None specified.")).toHaveLength(5);
      expect(
        screen.getByRole("heading", { level: 4, name: "Must preserve" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 4, name: "References" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Add /i }),
      ).not.toBeInTheDocument();
    });

    it("populates the edit form with existing semantic items for the VFX Supervisor", async () => {
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      expect(
        screen.getByDisplayValue("Preserve restrained performance"),
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Camera speed may vary slightly"),
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Excessive shake weakens tone"),
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Is tension physical or emotional?"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Reference 1 label")).toHaveValue(
        "Mood ref",
      );
      expect(screen.getByLabelText("Reference 1 URI")).toHaveValue(
        "https://example.invalid/ref",
      );
      expect(screen.getByLabelText("Reference 1 note")).toHaveValue(
        "reference note",
      );
      expect(screen.getByLabelText("Reference 2 label")).toHaveValue(
        "Text-only ref",
      );
      expect(screen.getByLabelText("Reference 2 URI")).toHaveValue("");
      expect(screen.getByLabelText("Reference 2 note")).toHaveValue("");
    });

    it("lets a VFX Supervisor add, edit, remove, and reorder items in a single-field collection", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      expect(
        screen.getByRole("button", { name: "Move must-preserve item 1 up" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", {
          name: "Move must-preserve item 2 down",
        }),
      ).toBeDisabled();

      await user.click(
        screen.getByRole("button", { name: "Add must-preserve item" }),
      );
      await user.type(
        screen.getByLabelText("Must preserve item 3"),
        "New constraint",
      );

      await user.click(
        screen.getByRole("button", { name: "Move must-preserve item 3 up" }),
      );
      expect(screen.getByLabelText("Must preserve item 2")).toHaveValue(
        "New constraint",
      );
      expect(screen.getByLabelText("Must preserve item 3")).toHaveValue(
        "Avoid exaggerated camera movement",
      );

      await user.click(
        screen.getByRole("button", { name: "Remove must-preserve item 1" }),
      );
      expect(screen.getByLabelText("Must preserve item 1")).toHaveValue(
        "New constraint",
      );
      expect(screen.getByLabelText("Must preserve item 2")).toHaveValue(
        "Avoid exaggerated camera movement",
      );
      expect(
        screen.queryByLabelText("Must preserve item 3"),
      ).not.toBeInTheDocument();
    });

    it("lets a VFX Supervisor edit a reference's label, URI, and note", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.click(screen.getByRole("button", { name: "Add reference" }));
      await user.type(screen.getByLabelText("Reference 3 label"), "New ref");
      await user.type(
        screen.getByLabelText("Reference 3 URI"),
        "https://example.invalid/new",
      );
      await user.type(screen.getByLabelText("Reference 3 note"), "new note");

      expect(screen.getByLabelText("Reference 3 label")).toHaveValue("New ref");
      expect(screen.getByLabelText("Reference 3 URI")).toHaveValue(
        "https://example.invalid/new",
      );
      expect(screen.getByLabelText("Reference 3 note")).toHaveValue("new note");
    });

    it("sends an explicit empty array when every item in a collection is removed", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      const fetchMock = installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.click(
        screen.getByRole("button", {
          name: "Remove allowed-variation item 1",
        }),
      );
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH"),
        ).toBe(true);
      });
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "PATCH",
      );
      const body = JSON.parse(String(patchCall?.[1]?.body)) as Record<
        string,
        unknown
      >;
      expect(body.variation_zones).toEqual([]);
    });

    it("omits unchanged collections from the PATCH payload", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      const fetchMock = installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.clear(screen.getByLabelText("Must preserve item 1"));
      await user.type(
        screen.getByLabelText("Must preserve item 1"),
        "Edited constraint",
      );
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH"),
        ).toBe(true);
      });
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "PATCH",
      );
      const body = JSON.parse(String(patchCall?.[1]?.body)) as Record<
        string,
        unknown
      >;
      expect(body.constraints).toBeDefined();
      expect(body.variation_zones).toBeUndefined();
      expect(body.drift_risks).toBeUndefined();
      expect(body.references).toBeUndefined();
      expect(body.open_questions).toBeUndefined();
    });

    it("includes a reordered collection in the PATCH payload in its new order", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision({
        open_questions: [
          openQuestionItem("oq1", "Question A", 0),
          openQuestionItem("oq2", "Question B", 1),
        ],
      });
      const fetchMock = installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.click(
        screen.getByRole("button", { name: "Move open-question item 2 up" }),
      );
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH"),
        ).toBe(true);
      });
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "PATCH",
      );
      const body = JSON.parse(String(patchCall?.[1]?.body)) as Record<
        string,
        unknown
      >;
      expect(body.open_questions).toEqual([
        { question: "Question B" },
        { question: "Question A" },
      ]);
    });

    it("blocks the save and shows an inline error for blank required semantic content", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      const fetchMock = installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.clear(screen.getByLabelText("Must preserve item 1"));
      await user.type(screen.getByLabelText("Must preserve item 1"), "   ");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(
        await screen.findByText("Must-preserve item 1 cannot be blank."),
      ).toBeInTheDocument();
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH"),
      ).toBe(false);
    });

    it("shows semantic collections read-only to a CG Supervisor viewing a draft revision", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");

      expect(
        screen.queryByRole("button", { name: "Add must-preserve item" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("Preserve restrained performance"),
      ).toBeInTheDocument();
    });

    it("shows semantic collections read-only to an Artist viewing a draft revision", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.selectOptions(screen.getByLabelText("Role"), "artist");

      expect(
        screen.queryByRole("button", { name: "Add must-preserve item" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("Preserve restrained performance"),
      ).toBeInTheDocument();
    });

    it("uses the server-returned semantic collection as the source of truth after a successful save", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      const serverConfirmedRevision = {
        ...fixture.revisions[1],
        constraints: [
          constraintItem("server-c1", "Server-confirmed constraint", 0),
          constraintItem("server-c2", "Avoid exaggerated camera movement", 1),
        ],
      };
      installFetchMock(fixture, {
        onRequest: (method, path) => {
          if (
            method === "PATCH" &&
            path === "/intent/core-anchor-revisions/rev-draft"
          ) {
            fixture.revisions[1] = serverConfirmedRevision;
            return jsonResponse(200, serverConfirmedRevision);
          }
          return null;
        },
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.clear(screen.getByLabelText("Must preserve item 1"));
      await user.type(
        screen.getByLabelText("Must preserve item 1"),
        "locally typed value",
      );
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");
      expect(
        await screen.findByText("Server-confirmed constraint"),
      ).toBeInTheDocument();
      expect(screen.queryByText("locally typed value")).not.toBeInTheDocument();
    });

    it("preserves unsaved semantic form values after a failed save", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture, {
        onRequest: (method, path) =>
          method === "PATCH" &&
          path === "/intent/core-anchor-revisions/rev-draft"
            ? jsonResponse(500, { detail: "boom" })
            : null,
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.clear(screen.getByLabelText("Must preserve item 1"));
      await user.type(
        screen.getByLabelText("Must preserve item 1"),
        "Unsaved edit",
      );
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByLabelText("Must preserve item 1")).toHaveValue(
        "Unsaved edit",
      );
    });

    it("restores original semantic values and ordering when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.clear(screen.getByLabelText("Must preserve item 1"));
      await user.type(
        screen.getByLabelText("Must preserve item 1"),
        "Temporary edit",
      );
      await user.click(
        screen.getByRole("button", { name: "Add must-preserve item" }),
      );

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByLabelText("Must preserve item 1")).toHaveValue(
        "Preserve restrained performance",
      );
      expect(screen.getByLabelText("Must preserve item 2")).toHaveValue(
        "Avoid exaggerated camera movement",
      );
      expect(
        screen.queryByLabelText("Must preserve item 3"),
      ).not.toBeInTheDocument();
    });

    it("resets semantic local state when a new draft revision replaces the old one", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture, {
        onRequest: (method, path) => {
          if (
            method === "POST" &&
            path === "/intent/shots/shot-1/core-anchor/generate"
          ) {
            const generated = revision({
              id: "rev-generated",
              revision_number: 3,
              status: "draft",
              shot_objective: "[Core Agent draft] generated objective",
              created_by_actor_kind: "agent",
              created_by_actor_id: "core_agent",
              created_by_human_role: null,
              created_by_agent_type: "core_agent",
              created_by_agent_run_id: "run-1",
              constraints: [
                constraintItem("gen-c1", "Fresh generated constraint", 0),
              ],
            });
            fixture.revisions.push(generated);
            return jsonResponse(201, generated);
          }
          return null;
        },
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.clear(screen.getByLabelText("Must preserve item 1"));
      await user.type(
        screen.getByLabelText("Must preserve item 1"),
        "Unsaved leaked edit",
      );

      await user.click(screen.getByRole("button", { name: "Reject" }));
      await screen.findByText("No draft revision awaiting review.");
      await user.click(
        screen.getByRole("button", { name: "Generate draft with Core Agent" }),
      );

      const gate = await screen.findByLabelText(/Draft revision/);
      expect(
        within(gate).queryByDisplayValue("Unsaved leaked edit"),
      ).not.toBeInTheDocument();
      expect(
        within(gate).getByDisplayValue("Fresh generated constraint"),
      ).toBeInTheDocument();
    });
  });

  describe("Step 1A-UI usability and save feedback fixes", () => {
    it("shows 'Changes saved.' as an accessible status after a successful save", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const objectiveField = await screen.findByLabelText("Shot objective");
      await user.clear(objectiveField);
      await user.type(objectiveField, "Even quieter than before");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      const status = await screen.findByText("Changes saved.");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(screen.getByRole("status")).toHaveTextContent("Changes saved.");
    });

    it("disables Save changes and shows 'Saving…' while a save is pending, then shows the success message", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      let resolveSave: ((response: Response) => void) | undefined;
      installFetchMock(fixture, {
        onRequest: (method, path) => {
          if (
            method === "PATCH" &&
            path === "/intent/core-anchor-revisions/rev-draft"
          ) {
            return new Promise<Response>((resolve) => {
              resolveSave = resolve;
            });
          }
          return null;
        },
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      const objectiveField = await screen.findByLabelText("Shot objective");
      await user.clear(objectiveField);
      await user.type(objectiveField, "Even quieter than before");
      void user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
      });
      expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();

      const updated = {
        ...fixture.revisions[1],
        shot_objective: "Even quieter than before",
      };
      fixture.revisions[1] = updated;
      resolveSave?.(jsonResponse(200, updated));

      expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
    });

    it("does not show the success message after a failed save and preserves form values", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      installFetchMock(fixture, {
        onRequest: (method, path) =>
          method === "PATCH" &&
          path === "/intent/core-anchor-revisions/rev-draft"
            ? jsonResponse(500, { detail: "boom" })
            : null,
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      const objectiveField = await screen.findByLabelText("Shot objective");
      await user.clear(objectiveField);
      await user.type(objectiveField, "Attempted edit");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Shot objective")).toHaveValue(
        "Attempted edit",
      );
    });

    it("clears the success message when the user makes a later edit", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const objectiveField = await screen.findByLabelText("Shot objective");
      await user.clear(objectiveField);
      await user.type(objectiveField, "First edit");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await screen.findByText("Changes saved.");

      await user.type(objectiveField, " more");
      expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
    });

    it("clears the success message when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const objectiveField = await screen.findByLabelText("Shot objective");
      await user.clear(objectiveField);
      await user.type(objectiveField, "Saved edit");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await screen.findByText("Changes saved.");

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
    });

    it("clears the success message when the selected revision changes", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      installFetchMock(fixture, {
        onRequest: (method, path) => {
          if (
            method === "POST" &&
            path === "/intent/shots/shot-1/core-anchor/generate"
          ) {
            const generated = revision({
              id: "rev-generated",
              revision_number: 3,
              status: "draft",
              shot_objective: "[Core Agent draft] generated objective",
              created_by_actor_kind: "agent",
              created_by_actor_id: "core_agent",
              created_by_human_role: null,
              created_by_agent_type: "core_agent",
              created_by_agent_run_id: "run-1",
            });
            fixture.revisions.push(generated);
            return jsonResponse(201, generated);
          }
          return null;
        },
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      const objectiveField = await screen.findByLabelText("Shot objective");
      await user.clear(objectiveField);
      await user.type(objectiveField, "Saved edit");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await screen.findByText("Changes saved.");

      await user.click(screen.getByRole("button", { name: "Reject" }));
      await screen.findByText("No draft revision awaiting review.");
      await user.click(
        screen.getByRole("button", { name: "Generate draft with Core Agent" }),
      );

      await screen.findByLabelText(/Draft revision/);
      expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
    });

    it("shows 'Draft details' instead of 'Edit draft' to a CG Supervisor", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");

      expect(
        screen.getByRole("heading", { name: "Draft details" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Edit draft" }),
      ).not.toBeInTheDocument();
    });

    it("shows 'Draft details' instead of 'Edit draft' to an Artist", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.selectOptions(screen.getByLabelText("Role"), "artist");

      expect(
        screen.getByRole("heading", { name: "Draft details" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Edit draft" }),
      ).not.toBeInTheDocument();
    });

    it("hides scalar fields, Save/Cancel, and semantic add/remove/move controls from CG Supervisor and Artist", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");

      for (const roleValue of ["cg_supervisor", "artist"]) {
        await user.selectOptions(screen.getByLabelText("Role"), roleValue);
        expect(
          screen.queryByLabelText("Shot objective"),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Save changes" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Cancel" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Add must-preserve item" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /Remove must-preserve item/ }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /Move must-preserve item/ }),
        ).not.toBeInTheDocument();
      }
    });

    it("shows scalar and all five semantic sections in the CG/Artist read-only draft view", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions[1] = populatedDraftRevision();
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");

      const gate = screen.getByLabelText("Draft revision 2");
      expect(within(gate).getByText("Slightly louder now")).toBeInTheDocument();
      expect(
        within(gate).getByRole("heading", { name: "Must preserve" }),
      ).toBeInTheDocument();
      expect(
        within(gate).getByRole("heading", { name: "Allowed variation" }),
      ).toBeInTheDocument();
      expect(
        within(gate).getByRole("heading", { name: "High-risk drift points" }),
      ).toBeInTheDocument();
      expect(
        within(gate).getByRole("heading", { name: "References" }),
      ).toBeInTheDocument();
      expect(
        within(gate).getByRole("heading", { name: "Open questions" }),
      ).toBeInTheDocument();
      expect(
        within(gate).getByText("Preserve restrained performance"),
      ).toBeInTheDocument();
    });

    it("updates an untouched default Actor id to the new role's default when Role changes", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      expect(screen.getByLabelText("Actor id")).toHaveValue("vfx-1");

      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");
      expect(screen.getByLabelText("Actor id")).toHaveValue("cg-1");

      await user.selectOptions(screen.getByLabelText("Role"), "artist");
      expect(screen.getByLabelText("Actor id")).toHaveValue("artist-1");

      await user.selectOptions(screen.getByLabelText("Role"), "vfx_supervisor");
      expect(screen.getByLabelText("Actor id")).toHaveValue("vfx-1");
    });

    it("preserves a manually entered custom Actor id across Role changes", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      const actorIdField = screen.getByLabelText("Actor id");
      await user.clear(actorIdField);
      await user.type(actorIdField, "custom-reviewer-42");

      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");
      expect(screen.getByLabelText("Actor id")).toHaveValue(
        "custom-reviewer-42",
      );

      await user.selectOptions(screen.getByLabelText("Role"), "artist");
      expect(screen.getByLabelText("Actor id")).toHaveValue(
        "custom-reviewer-42",
      );
    });
  });

  describe("Step 1B: Intent decomposition", () => {
    it("shows the empty state when no decomposition has been generated yet", async () => {
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      const section = await screen.findByRole("region", {
        name: "Intent decomposition",
      });
      expect(
        within(section).getByText("No intent decompositions generated yet."),
      ).toBeInTheDocument();
    });

    it("lets a VFX Supervisor generate a decomposition and shows it after reload", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByRole("region", { name: "Intent decomposition" });
      await user.click(
        screen.getByRole("button", { name: "Generate intent decomposition" }),
      );

      const card = await screen.findByLabelText(/Intent decomposition decomp-/);
      expect(
        within(card).getByText("AI proposal — Core Agent"),
      ).toBeInTheDocument();
    });

    it("shows a loading state while a decomposition is being generated", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      let resolveGenerate: ((response: Response) => void) | undefined;
      installFetchMock(fixture, {
        onRequest: (method, path) => {
          if (
            method === "POST" &&
            path === "/intent/shots/shot-1/intent-decompositions/generate"
          ) {
            return new Promise<Response>((resolve) => {
              resolveGenerate = resolve;
            });
          }
          return null;
        },
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByRole("region", { name: "Intent decomposition" });
      void user.click(
        screen.getByRole("button", { name: "Generate intent decomposition" }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Generating…" }),
        ).toBeDisabled();
      });
      // The held request settles independently of the fixture, so (as with
      // the equivalent Core Anchor draft generation test above) the
      // generated decomposition must be added to the fixture too -- the
      // reload triggered by `onGenerated()` re-fetches the list from the
      // fixture, not from this response.
      const generated = intentDecomposition();
      fixture.intentDecompositions = [
        generated,
        ...fixture.intentDecompositions,
      ];
      resolveGenerate?.(jsonResponse(201, generated));
      await screen.findByLabelText(/Intent decomposition decomp-/);
    });

    it("shows an error when generation fails", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture(), {
        onRequest: (method, path) =>
          method === "POST" &&
          path === "/intent/shots/shot-1/intent-decompositions/generate"
            ? jsonResponse(502, { detail: "Deterministic generator failed" })
            : null,
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByRole("region", { name: "Intent decomposition" });
      await user.click(
        screen.getByRole("button", { name: "Generate intent decomposition" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Core Agent generation failed/,
      );
    });

    it("disables the Generate action when there is no Intent Brief yet", async () => {
      const fixture = baseFixture();
      fixture.briefs = [];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const button = await screen.findByRole("button", {
        name: "Generate intent decomposition",
      });
      expect(button).toBeDisabled();
      expect(button.parentElement).not.toBeNull();
      expect(
        within(button.parentElement as HTMLElement).getByText(
          "Add an Intent Brief first.",
        ),
      ).toBeInTheDocument();
    });

    it("displays all seven dimensions with summary and rationale", async () => {
      const fixture = baseFixture();
      fixture.intentDecompositions = [intentDecomposition()];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Intent decomposition decomp-1",
      );
      for (const [label, summary] of [
        ["Emotional tone", "Quiet dread"],
        ["Visual focus", "Character stillness"],
        ["Rhythm & intensity", "Slow build"],
        ["Character relationships", "Distance held"],
        ["Narrative priority", "Tension over clarity"],
        ["Technical execution requirements", "Minimal camera movement"],
        ["Visual detail constraints", "Low-key lighting"],
      ]) {
        expect(within(card).getByText(label)).toBeInTheDocument();
        expect(within(card).getByText(summary)).toBeInTheDocument();
      }
      expect(
        within(card).getByText("Preserve restrained performance"),
      ).toBeInTheDocument();
      expect(
        within(card).getByText("Camera speed may vary slightly"),
      ).toBeInTheDocument();
      expect(
        within(card).getByText("Shot precedes a dialogue-heavy sequence"),
      ).toBeInTheDocument();
    });

    it("shows an explicit empty-list state for an empty uncertainties list", async () => {
      const fixture = baseFixture();
      fixture.intentDecompositions = [
        intentDecomposition({ uncertainties: [] }),
      ];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Intent decomposition decomp-1",
      );
      expect(
        within(card).getByRole("heading", { name: "Uncertainties" }),
      ).toBeInTheDocument();
      const uncertaintiesHeading = within(card).getByRole("heading", {
        name: "Uncertainties",
      });
      expect(
        uncertaintiesHeading.parentElement &&
          within(uncertaintiesHeading.parentElement as HTMLElement).getByText(
            "None specified.",
          ),
      ).toBeInTheDocument();
    });

    it("shows Agent provenance for a decomposition", async () => {
      const fixture = baseFixture();
      fixture.intentDecompositions = [intentDecomposition()];
      fixture.agentRuns = {
        "run-decomp-1": agentRun({
          id: "run-decomp-1",
          capability: "intent_decomposition",
          provider: "deterministic",
          status: "succeeded",
          result_revision_id: null,
          context_snapshot_id: "snapshot-decomp-1",
        }),
      };
      fixture.contextSnapshots = {
        "snapshot-decomp-1": contextSnapshot({ id: "snapshot-decomp-1" }),
      };
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Intent decomposition decomp-1",
      );
      await within(card).findByText(/provider: deterministic/);
      expect(
        within(card).getByText(/run status: succeeded/),
      ).toBeInTheDocument();
    });

    it("lists multiple decompositions newest first", async () => {
      // The list endpoint is the source of ordering (newest first); the
      // page renders decompositions in the order it receives them rather
      // than re-sorting client-side, so the fixture supplies them
      // pre-sorted -- exactly as the real backend does.
      const fixture = baseFixture();
      fixture.intentDecompositions = [
        intentDecomposition({
          id: "decomp-n",
          created_at: "2026-01-02T00:00:00Z",
        }),
        intentDecomposition({ id: "decomp-o", created_at: NOW }),
      ];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByRole("region", { name: "Intent decomposition" });
      const cards = screen.getAllByLabelText(/Intent decomposition decomp-/);
      expect(cards).toHaveLength(2);
      expect(cards[0]).toHaveAttribute(
        "aria-label",
        "Intent decomposition decomp-n",
      );
      expect(cards[1]).toHaveAttribute(
        "aria-label",
        "Intent decomposition decomp-o",
      );
    });

    it("lets a VFX Supervisor use a decomposition to create a Core Anchor draft", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
      fixture.intentDecompositions = [intentDecomposition()];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Intent decomposition decomp-1",
      );
      await user.click(
        within(card).getByRole("button", { name: "Use in Core Anchor draft" }),
      );

      const gate = await screen.findByLabelText(/Draft revision/);
      expect(
        within(gate).getByText(/Based on intent decomposition decomp-1/),
      ).toBeInTheDocument();
    });

    it("does not show Generate or Use actions for CG Supervisor or Artist", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.intentDecompositions = [intentDecomposition()];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Intent decomposition decomp-1");
      for (const roleValue of ["cg_supervisor", "artist"]) {
        await user.selectOptions(screen.getByLabelText("Role"), roleValue);

        const section = screen.getByRole("region", {
          name: "Intent decomposition",
        });
        expect(
          within(section).queryByRole("button", {
            name: "Generate intent decomposition",
          }),
        ).not.toBeInTheDocument();
        expect(
          within(section).getByText(
            "Only a VFX Supervisor can generate or use an intent decomposition.",
          ),
        ).toBeInTheDocument();
        const card = within(section).getByLabelText(
          "Intent decomposition decomp-1",
        );
        expect(
          within(card).queryByRole("button", {
            name: "Use in Core Anchor draft",
          }),
        ).not.toBeInTheDocument();
        // The decomposition's own content stays readable for every role.
        expect(
          within(card).getByText("Keep the dread quiet and let it build."),
        ).toBeInTheDocument();
      }
    });

    it("disables Use in Core Anchor draft while a draft is already awaiting review", async () => {
      const fixture = baseFixture();
      fixture.intentDecompositions = [intentDecomposition()];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Intent decomposition decomp-1",
      );
      const button = within(card).getByRole("button", {
        name: "Use in Core Anchor draft",
      });
      expect(button).toBeDisabled();
      expect(
        within(card).getByText(/A draft is already awaiting review\./),
      ).toBeInTheDocument();
    });

    it("surfaces a 409 when applying a decomposition conflicts with an already-existing draft", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
      fixture.intentDecompositions = [intentDecomposition()];
      installFetchMock(fixture, {
        // Simulates someone else creating a draft between this page's load
        // and the click.
        onRequest: (method, path) =>
          method === "POST" &&
          path === "/intent/intent-decompositions/decomp-1/core-anchor-draft"
            ? jsonResponse(409, {
                detail:
                  "An editable Core Anchor draft already exists for this shot",
              })
            : null,
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Intent decomposition decomp-1",
      );
      await user.click(
        within(card).getByRole("button", { name: "Use in Core Anchor draft" }),
      );

      expect(await within(card).findByRole("alert")).toHaveTextContent(
        /Out of date/,
      );
    });

    it("keeps the legacy direct-generate action available but not the primary path", async () => {
      const fixture = baseFixture();
      fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
      fixture.coreAnchor = null;
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByText("No Core Anchor yet for this shot.");
      expect(
        screen.getByText(
          /Generate an intent decomposition above, then use it to create/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Advanced: generate a draft directly, without a decomposition",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Generate draft with Core Agent" }),
      ).toBeInTheDocument();
    });
  });

  describe("Step 1C: Context reconstruction", () => {
    it("shows the empty state when no reconstruction has been generated yet", async () => {
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      const section = await screen.findByRole("region", {
        name: "Context reconstruction",
      });
      expect(
        within(section).getByText("No context reconstructions generated yet."),
      ).toBeInTheDocument();
    });

    it("lets a VFX Supervisor generate a reconstruction and shows it after reload", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByRole("region", { name: "Context reconstruction" });
      await user.click(
        screen.getByRole("button", { name: "Generate context reconstruction" }),
      );

      const card = await screen.findByLabelText(
        /Context reconstruction recon-/,
      );
      expect(
        within(card).getByText("AI reconstruction — Core Agent"),
      ).toBeInTheDocument();
    });

    it("shows a loading state while a reconstruction is being generated", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      let resolveGenerate: ((response: Response) => void) | undefined;
      installFetchMock(fixture, {
        onRequest: (method, path) => {
          if (
            method === "POST" &&
            path === "/intent/shots/shot-1/context-reconstructions/generate"
          ) {
            return new Promise<Response>((resolve) => {
              resolveGenerate = resolve;
            });
          }
          return null;
        },
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByRole("region", { name: "Context reconstruction" });
      void user.click(
        screen.getByRole("button", { name: "Generate context reconstruction" }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Generating…" }),
        ).toBeDisabled();
      });
      // The held request settles independently of the fixture, so (as with
      // the equivalent Step 1B generation test above) the generated
      // reconstruction must be added to the fixture too -- the reload
      // triggered by `onGenerated()` re-fetches the list from the fixture,
      // not from this response.
      const generated = contextReconstruction();
      fixture.contextReconstructions = [
        generated,
        ...fixture.contextReconstructions,
      ];
      resolveGenerate?.(jsonResponse(201, generated));
      await screen.findByLabelText(/Context reconstruction recon-/);
    });

    it("shows an error when generation fails", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture(), {
        onRequest: (method, path) =>
          method === "POST" &&
          path === "/intent/shots/shot-1/context-reconstructions/generate"
            ? jsonResponse(502, { detail: "Deterministic generator failed" })
            : null,
      });
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByRole("region", { name: "Context reconstruction" });
      await user.click(
        screen.getByRole("button", { name: "Generate context reconstruction" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Core Agent generation failed/,
      );
    });

    it("renders all structured sections with evidence references", async () => {
      const fixture = baseFixture();
      fixture.contextReconstructions = [
        contextReconstruction({
          reconstructed_context: {
            context_summary: "Reconstructed from a confirmed Core Anchor.",
            original_intent: reconstructionItem(
              "Restrained, character-led chase.",
              "Directly stated in the Intent Brief.",
              [
                evidenceReference(
                  "intent_brief",
                  "brief-1",
                  "Intent Brief brief-1",
                ),
              ],
            ),
            current_creative_direction: reconstructionItem(
              "Confirmed Core Anchor revision #1: Keep dread quiet.",
              "This is the Shot's currently confirmed Core Anchor revision.",
              [
                evidenceReference(
                  "core_anchor_revision",
                  "rev-confirmed",
                  "Core Anchor revision rev-confirmed",
                ),
              ],
            ),
            execution_context: reconstructionItem(
              "1 task(s) have Execution Anchor context recorded.",
              "Derived from the recorded Execution Anchors for this Shot's tasks.",
              [
                evidenceReference(
                  "execution_anchor_revision",
                  "ea-rev-1",
                  "Execution Anchor for task Anim block",
                ),
              ],
            ),
            key_decisions: [
              reconstructionItem(
                "confirm_core_anchor recorded by vfx_supervisor.",
                "Recorded human Decision on core_anchor_revision rev-confirmed.",
                [
                  evidenceReference(
                    "decision",
                    "decision-1",
                    "Decision decision-1",
                  ),
                ],
              ),
            ],
            active_constraints: [
              reconstructionItem(
                "No jump cuts.",
                "Recorded Constraint on Core Anchor revision rev-confirmed.",
                [evidenceReference("constraint", "c1", "Constraint c1")],
              ),
            ],
            allowed_variations: [
              reconstructionItem(
                "Camera speed may vary slightly.",
                "Recorded VariationZone on Core Anchor revision rev-confirmed.",
                [
                  evidenceReference(
                    "variation_zone",
                    "vz1",
                    "Variation zone vz1",
                  ),
                ],
              ),
            ],
            unresolved_questions: [
              reconstructionItem(
                "Is the antagonist visible in frame?",
                "Recorded OpenQuestion on Core Anchor revision rev-confirmed.",
                [
                  evidenceReference(
                    "open_question",
                    "oq1",
                    "Open question oq1",
                  ),
                ],
              ),
            ],
            context_gaps: [],
          },
        }),
      ];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Context reconstruction recon-1",
      );
      for (const heading of [
        "Context summary",
        "Original intent",
        "Current creative direction",
        "Execution context",
        "Key decisions",
        "Active constraints",
        "Allowed variations",
        "Unresolved questions",
        "Context gaps",
      ]) {
        expect(
          within(card).getByRole("heading", { name: heading }),
        ).toBeInTheDocument();
      }
      expect(
        within(card).getByText("Restrained, character-led chase."),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(/intent_brief · brief-1 · Intent Brief brief-1/),
      ).toBeInTheDocument();
      expect(within(card).getByText("No jump cuts.")).toBeInTheDocument();
      // Context gaps is an empty list here -- explicit empty state, not
      // an omitted section.
      expect(within(card).getByText("None specified.")).toBeInTheDocument();
    });

    it("shows a non-empty context gaps list when facts are missing", async () => {
      const fixture = baseFixture();
      fixture.contextReconstructions = [contextReconstruction()];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Context reconstruction recon-1",
      );
      expect(
        within(card).getByText(
          "No Core Anchor has been established for this Shot.",
        ),
      ).toBeInTheDocument();
    });

    it("shows Agent provenance for a reconstruction", async () => {
      const fixture = baseFixture();
      fixture.contextReconstructions = [contextReconstruction()];
      fixture.agentRuns = {
        "run-reconstruction-1": agentRun({
          id: "run-reconstruction-1",
          capability: "context_reconstruction",
          provider: "deterministic",
          status: "succeeded",
          result_revision_id: null,
          context_snapshot_id: "snapshot-reconstruction-1",
        }),
      };
      fixture.contextSnapshots = {
        "snapshot-reconstruction-1": contextSnapshot({
          id: "snapshot-reconstruction-1",
        }),
      };
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Context reconstruction recon-1",
      );
      await within(card).findByText(/provider: deterministic/);
      expect(
        within(card).getByText(/run status: succeeded/),
      ).toBeInTheDocument();
    });

    it("lists multiple reconstructions newest first", async () => {
      // The list endpoint is the source of ordering (newest first); the
      // page renders reconstructions in the order it receives them rather
      // than re-sorting client-side, so the fixture supplies them
      // pre-sorted -- exactly as the real backend does.
      const fixture = baseFixture();
      fixture.contextReconstructions = [
        contextReconstruction({ id: "recon-n" }),
        contextReconstruction({ id: "recon-o" }),
      ];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByRole("region", { name: "Context reconstruction" });
      const cards = screen.getAllByLabelText(/Context reconstruction recon-/);
      expect(cards).toHaveLength(2);
      expect(cards[0]).toHaveAttribute(
        "aria-label",
        "Context reconstruction recon-n",
      );
      expect(cards[1]).toHaveAttribute(
        "aria-label",
        "Context reconstruction recon-o",
      );
    });

    it("does not show the Generate action for CG Supervisor or Artist", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.contextReconstructions = [contextReconstruction()];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Context reconstruction recon-1");
      for (const roleValue of ["cg_supervisor", "artist"]) {
        await user.selectOptions(screen.getByLabelText("Role"), roleValue);

        const section = screen.getByRole("region", {
          name: "Context reconstruction",
        });
        expect(
          within(section).queryByRole("button", {
            name: "Generate context reconstruction",
          }),
        ).not.toBeInTheDocument();
        expect(
          within(section).getByText(
            "Only a VFX Supervisor can generate a context reconstruction.",
          ),
        ).toBeInTheDocument();
        // The reconstruction's own content stays readable for every role.
        const card = within(section).getByLabelText(
          "Context reconstruction recon-1",
        );
        expect(
          within(card).getByText(
            "Reconstructed from 1 Intent Decomposition, no confirmed Core Anchor.",
          ),
        ).toBeInTheDocument();
      }
    });

    it("never renders editing, accept, or reject controls on a reconstruction card", async () => {
      const fixture = baseFixture();
      fixture.contextReconstructions = [contextReconstruction()];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const card = await screen.findByLabelText(
        "Context reconstruction recon-1",
      );
      expect(within(card).queryByRole("textbox")).not.toBeInTheDocument();
      expect(
        within(card).queryByRole("button", { name: /confirm/i }),
      ).not.toBeInTheDocument();
      expect(
        within(card).queryByRole("button", { name: /reject/i }),
      ).not.toBeInTheDocument();
      expect(
        within(card).queryByRole("button", { name: /accept/i }),
      ).not.toBeInTheDocument();
      expect(
        within(card).queryByRole("button", { name: /use/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Step 1D: Persistent human gate", () => {
    it("renders pending gate details on the draft's Human Review Gate", async () => {
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      const draftGate = await screen.findByLabelText("Draft revision 2");
      const gateSection = within(draftGate).getByLabelText("Human review gate");
      expect(within(gateSection).getByText("Pending")).toBeInTheDocument();
      expect(within(gateSection).getByText("gate-dra")).toBeInTheDocument();
      expect(
        within(gateSection).getByText(
          "This Core Agent proposal requires a human decision.",
        ),
      ).toBeInTheDocument();
      // Resolution fields must not appear while pending.
      expect(
        within(gateSection).queryByText("Resolved by"),
      ).not.toBeInTheDocument();
      expect(
        within(gateSection).queryByText("Decision"),
      ).not.toBeInTheDocument();
    });

    it("shows Confirm/Reject for the VFX Supervisor on a pending draft", async () => {
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      const draftGate = await screen.findByLabelText("Draft revision 2");
      expect(
        within(draftGate).getByRole("button", { name: "Confirm" }),
      ).not.toBeDisabled();
      expect(
        within(draftGate).getByRole("button", { name: "Reject" }),
      ).not.toBeDisabled();
    });

    it("shows the pending gate read-only for CG Supervisor and Artist, with no Confirm/Reject", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      for (const roleValue of ["cg_supervisor", "artist"]) {
        await user.selectOptions(screen.getByLabelText("Role"), roleValue);

        const draftGate = screen.getByLabelText("Draft revision 2");
        const gateSection =
          within(draftGate).getByLabelText("Human review gate");
        expect(within(gateSection).getByText("Pending")).toBeInTheDocument();
        expect(
          within(draftGate).getByRole("button", { name: "Confirm" }),
        ).toBeDisabled();
        expect(
          within(draftGate).getByRole("button", { name: "Reject" }),
        ).toBeDisabled();
      }
    });

    it("renders confirmed gate resolution details on the confirmed anchor card", async () => {
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByText("Keep dread quiet");
      const confirmedCard = screen
        .getByText("Keep dread quiet")
        .closest("article");
      expect(confirmedCard).not.toBeNull();
      const gateSection = within(confirmedCard as HTMLElement).getByLabelText(
        "Human review gate",
      );
      expect(within(gateSection).getByText("Confirmed")).toBeInTheDocument();
      expect(within(gateSection).getByText(/vfx-1/)).toBeInTheDocument();
      expect(
        within(gateSection).getByText(/vfx_supervisor/),
      ).toBeInTheDocument();
      // Decision short id (shortId slices to 8 chars: "decision-1" -> "decisio1"? no -- "decision" is exactly 8).
      expect(within(gateSection).getByText("decision")).toBeInTheDocument();
    });

    it("renders rejected gate resolution details on a rejected revision card", async () => {
      const fixture = baseFixture();
      fixture.revisions = [
        ...fixture.revisions.filter((r) => r.status !== "draft"),
        revision({
          id: "rev-rejected",
          revision_number: 3,
          status: "rejected",
          shot_objective: "Too loud",
        }),
      ];
      fixture.humanGates["rev-rejected"] = humanGate({
        id: "gate-rejected",
        core_anchor_revision_id: "rev-rejected",
        status: "rejected",
        resolved_at: NOW,
        resolved_by_actor_id: "vfx-1",
        resolved_by_role: "vfx_supervisor",
        resolved_by_actor_type: "human",
        rationale: "Not aligned with the brief.",
        decision_id: "decision-reject-1",
      });
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByText("Too loud");
      const rejectedCard = screen.getByText("Too loud").closest("article");
      expect(rejectedCard).not.toBeNull();
      const gateSection = within(rejectedCard as HTMLElement).getByLabelText(
        "Human review gate",
      );
      expect(within(gateSection).getByText("Rejected")).toBeInTheDocument();
      expect(
        within(gateSection).getByText("Not aligned with the brief."),
      ).toBeInTheDocument();
      // shortId() slices to 8 chars: "decision-reject-1" -> "decision".
      expect(within(gateSection).getByText("decision")).toBeInTheDocument();
    });

    it("shows a legacy no-gate message for a revision with no persisted gate", async () => {
      const fixture = baseFixture();
      fixture.humanGates = {};
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const draftGate = await screen.findByLabelText("Draft revision 2");
      expect(
        await within(draftGate).findByText(
          "No persisted HumanGate exists for this pre-Step 1D revision.",
        ),
      ).toBeInTheDocument();
    });

    it("lets the VFX Supervisor confirm a legacy draft with no persisted gate", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.humanGates = {};
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const draftGate = await screen.findByLabelText("Draft revision 2");
      await within(draftGate).findByText(
        "No persisted HumanGate exists for this pre-Step 1D revision.",
      );

      await user.click(
        within(draftGate).getByRole("button", { name: "Confirm" }),
      );

      expect(await screen.findByRole("status")).toHaveTextContent(
        /Confirmed revision #2/,
      );
    });

    it("never renders reopen, reset, or edit-gate controls", async () => {
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByLabelText("Draft revision 2");
      expect(
        screen.queryByRole("button", { name: /reopen/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /reset/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /edit gate/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Step 4: Execution Anchor Human Review Gate and CG Supervisor Agent review", () => {
    function fixtureWithDraftExecutionRevision(): Fixture {
      const fixture = baseFixture();
      fixture.executionAnchorRevisionsForTask["task-1"] = [
        ...fixture.executionAnchorRevisionsForTask["task-1"],
        executionAnchorRevision({
          id: "ea-rev-draft",
          revision_number: 2,
          status: "draft",
          core_anchor_revision_id: "rev-confirmed",
          technical_boundaries: "24fps, no motion blur.",
        }),
      ];
      fixture.executionAnchorHumanGates["ea-rev-draft"] = humanGate({
        id: "gate-execution-draft",
        core_anchor_revision_id: null,
        execution_anchor_revision_id: "ea-rev-draft",
        gate_type: "execution_anchor_confirmation",
        required_role: "cg_supervisor",
        status: "pending",
      });
      return fixture;
    }

    it("renders the pending Execution Anchor gate with Confirm/Reject for the CG Supervisor", async () => {
      const user = userEvent.setup();
      installFetchMock(fixtureWithDraftExecutionRevision());
      render(<ShotAnchorPage shotId="shot-1" />);
      await screen.findByLabelText("Execution Anchor draft revision 2");
      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");

      const gate = screen.getByLabelText("Execution Anchor draft revision 2");
      expect(
        within(gate).getByText("Execution Anchor Human Review Gate"),
      ).toBeInTheDocument();
      const gateSection = within(gate).getByLabelText(
        "Execution Anchor human review gate",
      );
      expect(within(gateSection).getByText("Pending")).toBeInTheDocument();
      expect(
        within(gateSection).getByText("CG Supervisor"),
      ).toBeInTheDocument();
      expect(
        within(gate).getByRole("button", { name: "Confirm" }),
      ).not.toBeDisabled();
      expect(
        within(gate).getByRole("button", { name: "Reject" }),
      ).not.toBeDisabled();
    });

    it("shows the pending Execution Anchor gate read-only for VFX Supervisor and Artist", async () => {
      const user = userEvent.setup();
      installFetchMock(fixtureWithDraftExecutionRevision());
      render(<ShotAnchorPage shotId="shot-1" />);
      await screen.findByLabelText("Execution Anchor draft revision 2");

      for (const roleValue of ["vfx_supervisor", "artist"]) {
        await user.selectOptions(screen.getByLabelText("Role"), roleValue);
        const gate = screen.getByLabelText("Execution Anchor draft revision 2");
        expect(
          within(gate).getByRole("button", { name: "Confirm" }),
        ).toBeDisabled();
        expect(
          within(gate).getByRole("button", { name: "Reject" }),
        ).toBeDisabled();
        expect(
          within(gate).getByText(
            "Only a CG Supervisor can confirm or reject this draft.",
          ),
        ).toBeInTheDocument();
      }
    });

    it("lets the CG Supervisor confirm the pending Execution Anchor gate", async () => {
      const user = userEvent.setup();
      installFetchMock(fixtureWithDraftExecutionRevision());
      render(<ShotAnchorPage shotId="shot-1" />);
      await screen.findByLabelText("Execution Anchor draft revision 2");
      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");

      const gate = screen.getByLabelText("Execution Anchor draft revision 2");
      await user.click(within(gate).getByRole("button", { name: "Confirm" }));

      await waitFor(() => {
        const gateSection = screen.getByLabelText(
          "Execution Anchor human review gate",
        );
        expect(within(gateSection).getByText("Confirmed")).toBeInTheDocument();
      });
    });

    it("lets the CG Supervisor reject the pending Execution Anchor gate", async () => {
      const user = userEvent.setup();
      installFetchMock(fixtureWithDraftExecutionRevision());
      render(<ShotAnchorPage shotId="shot-1" />);
      await screen.findByLabelText("Execution Anchor draft revision 2");
      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");

      const gate = screen.getByLabelText("Execution Anchor draft revision 2");
      await user.click(within(gate).getByRole("button", { name: "Reject" }));

      await waitFor(() => {
        const gateSection = screen.getByLabelText(
          "Execution Anchor human review gate",
        );
        expect(within(gateSection).getByText("Rejected")).toBeInTheDocument();
      });
    });

    it("shows the CG Supervisor Agent review section labelled as advisory AI execution review", async () => {
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      expect(
        await screen.findByText("AI execution review — CG Supervisor Agent"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("No CG Supervisor Agent reviews generated yet."),
      ).toBeInTheDocument();
    });

    it("shows the Generate button only for the CG Supervisor, not VFX Supervisor or Artist", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);

      await screen.findByText("AI execution review — CG Supervisor Agent");
      expect(
        screen.queryByRole("button", { name: "Generate CG Supervisor review" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("Only a CG Supervisor can generate a new review."),
      ).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");
      expect(
        await screen.findByRole("button", {
          name: "Generate CG Supervisor review",
        }),
      ).toBeInTheDocument();
    });

    it("generates and renders a CG Supervisor review with its structured output", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<ShotAnchorPage shotId="shot-1" />);
      await screen.findByText("AI execution review — CG Supervisor Agent");
      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");

      await user.click(
        await screen.findByRole("button", {
          name: "Generate CG Supervisor review",
        }),
      );

      expect(
        await screen.findByText(
          "One recorded field, one constraint considered.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Confirm the 24fps boundary is respected in the render.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Does the actual render match this description?"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "No footage, frame, or render evidence is available to this Agent.",
        ),
      ).toBeInTheDocument();
    });

    it("renders an existing CG Supervisor review with no edit, apply, or accept controls", async () => {
      const fixture = baseFixture();
      fixture.cgSupervisorReviews["ea-rev-1"] = [cgSupervisorReview()];
      installFetchMock(fixture);
      render(<ShotAnchorPage shotId="shot-1" />);

      const review = await screen.findByLabelText(
        "CG Supervisor review cg-review-1",
      );
      expect(within(review).getByText(/2026-01-01/)).toBeInTheDocument();
      expect(
        within(review).queryByRole("button", { name: /apply/i }),
      ).not.toBeInTheDocument();
      expect(
        within(review).queryByRole("button", { name: /accept/i }),
      ).not.toBeInTheDocument();
      expect(
        within(review).queryByRole("button", { name: /edit/i }),
      ).not.toBeInTheDocument();
    });
  });
});
