import type { HumanRole } from "@intent-core/contracts";

import {
  AgentAdvisoryNotice,
  AgentRunReference,
  ConfirmationRequiredPanel,
  Container,
  ContextSnapshotReference,
  Divider,
  EvidenceProvenanceDrawer,
  FtrackLinkageBadge,
  FtrackObjectLinkage,
  FtrackSyncSummary,
  Grid,
  HumanDecisionNotice,
  IntegrationAvailabilityNotice,
  IntentSignalBadge,
  IntentSignalBanner,
  IntentSignalCard,
  IntentSignalDetail,
  IntentSignalIndicator,
  IntentSignalTray,
  PageHeader,
  Panel,
  ReadOnlyAuthorityNotice,
  ReadingColumn,
  Row,
  Section,
  SectionHeader,
  Stack,
  type IntentSignalAvailability,
} from "@/design";
import {
  FIXTURE_AGENT_RUN,
  FIXTURE_AGENT_RUN_FAILED,
  FIXTURE_CONTEXT_SNAPSHOT,
  FIXTURE_EVIDENCE,
  FIXTURE_HUMAN_GATE,
  FIXTURE_INTENT_SIGNAL,
  FIXTURE_INTENT_SIGNAL_LOW,
  FIXTURE_SYNC_CURSOR,
  FIXTURE_WRITEBACK_FAILED,
  FIXTURE_WRITEBACK_PENDING,
} from "./fixtures";
import styles from "./SemanticComponentsPreview.module.css";

const AVAILABLE: IntentSignalAvailability = {
  status: "available",
  signal: FIXTURE_INTENT_SIGNAL,
};
const AVAILABLE_LOW: IntentSignalAvailability = {
  status: "available",
  signal: FIXTURE_INTENT_SIGNAL_LOW,
};
const NO_ASSESSMENT: IntentSignalAvailability = { status: "no-assessment" };
const GENERATION_FAILED: IntentSignalAvailability = {
  status: "generation-failed",
};

const ROLES: HumanRole[] = ["vfx_supervisor", "cg_supervisor", "artist"];
const ROLE_TITLE: Record<HumanRole, string> = {
  vfx_supervisor: "VFX Supervisor",
  cg_supervisor: "CG Supervisor",
  artist: "Artist",
};

const SECTIONS = [
  { id: "intent-signal", label: "Intent Signal" },
  { id: "role-wording", label: "Role wording" },
  { id: "failure-states", label: "Failure states" },
  { id: "authority", label: "Authority" },
  { id: "evidence", label: "Evidence & Provenance" },
  { id: "ftrack", label: "ftrack linkage" },
];

/** Development-only demonstration of every Step 7B-3 semantic
 * component: Intent Signal (six presentation levels), authority /
 * advisory distinctions, Evidence / Provenance, and ftrack linkage.
 * Every value below is invented fixture data -- see fixtures.ts. This
 * is a component gallery, not a role dashboard: there is no
 * application shell, sidebar, or top bar here. */
export function SemanticComponentsPreview() {
  return (
    <Container>
      <Section spacing={5}>
        <ReadingColumn>
          <PageHeader
            eyebrow="Development preview"
            title="ICAS Semantic Components"
            description="Step 7B-3 shared components for Intent Signal, human/Agent authority, Evidence and Provenance, and ftrack linkage -- a component gallery, not a role dashboard."
          />
          <p className={styles.fixtureNotice}>
            Development fixture — not live production data
          </p>
        </ReadingColumn>
      </Section>

      <Section spacing={6}>
        <nav aria-label="Sections on this page" className={styles.index}>
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={styles.indexLink}
            >
              {section.label}
            </a>
          ))}
        </nav>
      </Section>

      <Section id="intent-signal">
        <SectionHeader
          title="Intent Signal"
          description="One shared IntentSignalRead fixture, shown at all six presentation levels the product uses for it -- the level changes the treatment, never the underlying data."
        />

        <Stack gap={5}>
          <div>
            <h3 className={styles.levelTitle}>1 · Global indicator</h3>
            <p className={styles.levelHint}>
              A quiet state marker for a top bar -- presence and level only,
              never a count.
            </p>
            <Row gap={5}>
              <IntentSignalIndicator availability={AVAILABLE} />
              <IntentSignalIndicator availability={NO_ASSESSMENT} />
            </Row>
          </div>

          <Divider />

          <div>
            <h3 className={styles.levelTitle}>2 · Signal tray</h3>
            <p className={styles.levelHint}>
              Up to three relevant signals, current and historical distinguished
              at a glance.
            </p>
            <IntentSignalTray
              items={[
                {
                  id: "1",
                  contextLabel: "Shot 010 · Final confrontation",
                  signal: FIXTURE_INTENT_SIGNAL,
                },
                {
                  id: "2",
                  contextLabel: "Shot 020 · Aftermath",
                  signal: FIXTURE_INTENT_SIGNAL_LOW,
                  historical: true,
                },
              ]}
            />
          </div>

          <Divider />

          <div>
            <h3 className={styles.levelTitle}>3 · Homepage card</h3>
            <p className={styles.levelHint}>
              Leads with the conclusion; the same fixture reads differently per
              role.
            </p>
            <Grid minColumnWidth="17rem">
              {ROLES.map((role) => (
                <IntentSignalCard
                  key={role}
                  availability={AVAILABLE}
                  role={role}
                  contextLabel="Shot 010 · Final confrontation"
                  detailHref="#intent-signal"
                />
              ))}
            </Grid>
          </div>

          <Divider />

          <div>
            <h3 className={styles.levelTitle}>4 · List-row badge</h3>
            <p className={styles.levelHint}>
              Genuinely compact -- for a Shot/Task card row, not a standalone
              statement.
            </p>
            <Row gap={3}>
              <IntentSignalBadge availability={AVAILABLE} />
              <IntentSignalBadge availability={AVAILABLE_LOW} />
              <IntentSignalBadge availability={NO_ASSESSMENT} />
            </Row>
          </div>

          <Divider />

          <div>
            <h3 className={styles.levelTitle}>5 · Contextual banner</h3>
            <p className={styles.levelHint}>
              A restrained left-accent strip, not a full-width coloured block.
            </p>
            <Stack gap={3}>
              {ROLES.map((role) => (
                <IntentSignalBanner
                  key={role}
                  availability={AVAILABLE}
                  role={role}
                  contextLabel="Shot 010 · Final confrontation"
                />
              ))}
            </Stack>
          </div>

          <Divider />

          <div>
            <h3 className={styles.levelTitle}>
              6 · Detail view — latest vs. historical
            </h3>
            <p className={styles.levelHint}>
              Conclusion, facts, role coverage, drivers, caveats, then
              provenance, in that order.
            </p>
            <Grid minColumnWidth="22rem">
              <Panel>
                <IntentSignalDetail
                  signal={FIXTURE_INTENT_SIGNAL}
                  role="vfx_supervisor"
                  variant="latest"
                  provenance={
                    <EvidenceProvenanceDrawer
                      evidence={FIXTURE_EVIDENCE}
                      run={FIXTURE_AGENT_RUN}
                      snapshot={FIXTURE_CONTEXT_SNAPSHOT}
                      label="Supporting assessment"
                    />
                  }
                />
              </Panel>
              <Panel tone="muted">
                <IntentSignalDetail
                  signal={FIXTURE_INTENT_SIGNAL_LOW}
                  role="vfx_supervisor"
                  variant="historical"
                />
              </Panel>
            </Grid>
          </div>
        </Stack>
      </Section>

      <Section id="role-wording">
        <SectionHeader
          title="Role wording"
          description="The persisted Intent Signal is one object; role is a presentation mapping applied at render time, not three separate records."
        />
        <Row gap={4}>
          {ROLES.map((role) => (
            <div key={role} className={styles.roleColumn}>
              <p className={styles.roleTitle}>{ROLE_TITLE[role]}</p>
              <IntentSignalCard availability={AVAILABLE} role={role} />
            </div>
          ))}
        </Row>
      </Section>

      <Section id="failure-states">
        <SectionHeader
          title="Honest failure states"
          description="No optimistic placeholder content -- a missing or failed assessment says so plainly."
        />
        <Grid minColumnWidth="17rem">
          <IntentSignalCard
            availability={NO_ASSESSMENT}
            role="vfx_supervisor"
          />
          <IntentSignalCard
            availability={GENERATION_FAILED}
            role="vfx_supervisor"
          />
        </Grid>
      </Section>

      <Section id="authority">
        <SectionHeader
          title="Human authority vs. Agent advisory"
          description="One shared visual grammar (owner, authority type, state, detail) across all three -- human authority is never a stronger colour than Agent advisory, just a different, equally restrained one."
        />
        <Stack gap={4}>
          <HumanDecisionNotice
            objectLabel="Core Anchor revision 3"
            confirmingRole="vfx_supervisor"
            confirmedAt="2026-07-19T12:00:00Z"
            rationale="Matches the approved restrained-confrontation intent."
          />
          <HumanDecisionNotice
            objectLabel="Execution Anchor revision 1"
            confirmingRole="cg_supervisor"
            confirmedAt="2026-07-19T15:00:00Z"
          />
          <AgentAdvisoryNotice
            variant="ai-interpretation"
            agentType="core_agent"
            capability="cross_role_assessment"
            provider="deepseek"
            generatedAt="2026-07-20T10:00:00Z"
          />
          <ConfirmationRequiredPanel
            gateType={FIXTURE_HUMAN_GATE.gate_type}
            requiredRole={FIXTURE_HUMAN_GATE.required_role}
            openedAt={FIXTURE_HUMAN_GATE.opened_at}
          />
          <ReadOnlyAuthorityNotice
            ownerRole="cg_supervisor"
            objectLabel="Execution Anchor"
          />
        </Stack>
      </Section>

      <Section id="evidence">
        <SectionHeader
          title="Evidence and Provenance"
          description="Inspectable without overwhelming the primary work -- human-readable labels lead, technical identifiers stay secondary and monospace."
        />
        <EvidenceProvenanceDrawer
          evidence={FIXTURE_EVIDENCE}
          run={FIXTURE_AGENT_RUN}
          snapshot={FIXTURE_CONTEXT_SNAPSHOT}
        />
        <Grid minColumnWidth="16rem">
          <div>
            <p className={styles.levelHint}>Failed Agent Run</p>
            <AgentRunReference run={FIXTURE_AGENT_RUN_FAILED} />
          </div>
          <div>
            <p className={styles.levelHint}>Missing provenance</p>
            <Stack gap={2}>
              <AgentRunReference run={null} />
              <ContextSnapshotReference snapshot={null} />
            </Stack>
          </div>
        </Grid>
      </Section>

      <Section id="ftrack">
        <SectionHeader
          title="ftrack linkage"
          description="Contextual production linkage, not an integration-admin dashboard. Linked/not-linked/unavailable is the most important distinction; write-back is secondary."
        />
        <Grid minColumnWidth="16rem">
          <FtrackObjectLinkage objectType="Shot" source="ftrack" />
          <FtrackObjectLinkage objectType="Task" source="manual" />
          <div>
            <p className={styles.levelHint}>Badge only</p>
            <Row gap={2}>
              <FtrackLinkageBadge source="ftrack" />
              <FtrackLinkageBadge source="manual" />
            </Row>
          </div>
        </Grid>

        <Divider />

        <Grid minColumnWidth="16rem">
          <div>
            <p className={styles.levelHint}>Write-back — not requested</p>
            <IntegrationAvailabilityNotice writeback={null} />
          </div>
          <div>
            <p className={styles.levelHint}>Write-back — pending</p>
            <IntegrationAvailabilityNotice
              writeback={FIXTURE_WRITEBACK_PENDING}
            />
          </div>
          <div>
            <p className={styles.levelHint}>Write-back — failed</p>
            <IntegrationAvailabilityNotice
              writeback={FIXTURE_WRITEBACK_FAILED}
            />
          </div>
          <div>
            <p className={styles.levelHint}>System reconciliation summary</p>
            <FtrackSyncSummary cursor={FIXTURE_SYNC_CURSOR} />
          </div>
        </Grid>
      </Section>
    </Container>
  );
}
