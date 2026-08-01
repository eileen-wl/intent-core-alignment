import {
  AuthorityLabel,
  type AuthorityLabelVariant,
  Card,
  ComparisonArea,
  Container,
  Divider,
  EmptyState,
  ErrorState,
  Grid,
  LoadingSkeleton,
  MetadataRow,
  PageHeader,
  Panel,
  PermissionState,
  ReadingColumn,
  Row,
  Section,
  SectionHeader,
  Stack,
  StatusBadge,
  type StatusBadgeStatus,
  SummaryCard,
} from "@/design";
import styles from "./UiFoundationPreview.module.css";

const AUTHORITY_VARIANTS: AuthorityLabelVariant[] = [
  "production-fact",
  "human-intent",
  "human-confirmed",
  "ai-interpretation",
  "ai-proposal",
  "intent-signal",
  "human-review-required",
  "open-question",
  "historical",
  "integration-ready",
  "read-only",
];

const STATUS_BADGES: { status: StatusBadgeStatus; label: string }[] = [
  { status: "neutral", label: "Neutral" },
  { status: "active", label: "Active" },
  { status: "confirmed", label: "Confirmed" },
  { status: "attention", label: "Attention" },
  { status: "blocking", label: "Blocking" },
  { status: "historical", label: "Historical" },
  { status: "integration-ready", label: "Integration-ready" },
  { status: "unavailable", label: "Unavailable" },
];

const SURFACE_SWATCHES = [
  { name: "Page", varName: "--surface-page" },
  { name: "Panel", varName: "--surface-panel" },
  { name: "Elevated", varName: "--surface-elevated" },
  { name: "Muted", varName: "--surface-muted" },
];

const ACCENT_SWATCHES = [
  { name: "Agent (violet)", varName: "--accent-agent" },
  { name: "Production fact / ftrack (blue/teal)", varName: "--accent-fact" },
  { name: "Attention (amber)", varName: "--state-attention" },
  { name: "Blocking (red)", varName: "--state-error" },
  { name: "Historical (grey)", varName: "--state-historical" },
  { name: "Technical success (green)", varName: "--state-success" },
];

/** Development-only demonstration of every Step 7B-1 design-foundation
 * token, layout primitive, and shared component. Static preview
 * content only -- no fetched or persisted production state. */
export function UiFoundationPreview() {
  return (
    <main className={styles.main}>
      <Container>
        <Section spacing={6}>
          <PageHeader
            eyebrow="Development preview"
            title="ICAS UI Foundation"
            description="Shared design tokens, layout primitives, and components for the role-aware ICAS product experience (Step 7B-1). Not part of the portfolio-facing navigation."
          />
        </Section>

        <Section>
          <SectionHeader
            title="Typography hierarchy"
            description="Sample sizes only -- this page keeps one real h1 (the page title above) and a normal heading order elsewhere."
          />
          <Stack gap={2}>
            <p style={{ fontSize: "var(--font-size-2xl)", fontWeight: 600 }}>
              Heading level 1 style
            </p>
            <p style={{ fontSize: "var(--font-size-xl)", fontWeight: 600 }}>
              Heading level 2 style
            </p>
            <p style={{ fontSize: "var(--font-size-lg)", fontWeight: 600 }}>
              Heading level 3 style
            </p>
            <p style={{ fontSize: "var(--font-size-md)", fontWeight: 600 }}>
              Heading level 4 style
            </p>
            <p>
              Body text sets the baseline reading size and line height for
              Intent Workspace copy, Anchor summaries, and Agent evidence.
            </p>
            <small>Small text carries secondary, de-emphasised detail.</small>
          </Stack>
        </Section>

        <Section>
          <SectionHeader title="Surfaces" />
          <Grid minColumnWidth="12rem">
            {SURFACE_SWATCHES.map((swatch) => (
              <Card key={swatch.varName}>
                <div
                  aria-hidden="true"
                  style={{
                    height: "3rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                    background: `var(${swatch.varName})`,
                    marginBottom: "var(--space-2)",
                  }}
                />
                <strong>{swatch.name}</strong>
                <div>
                  <small>{swatch.varName}</small>
                </div>
              </Card>
            ))}
          </Grid>
        </Section>

        <Section>
          <SectionHeader title="Accent and state colours" />
          <Grid minColumnWidth="14rem">
            {ACCENT_SWATCHES.map((swatch) => (
              <Card key={swatch.varName}>
                <div
                  aria-hidden="true"
                  style={{
                    height: "3rem",
                    borderRadius: "var(--radius-sm)",
                    background: `var(${swatch.varName})`,
                    marginBottom: "var(--space-2)",
                  }}
                />
                <strong>{swatch.name}</strong>
                <div>
                  <small>{swatch.varName}</small>
                </div>
              </Card>
            ))}
          </Grid>
        </Section>

        <Section>
          <SectionHeader
            title="Reading column"
            description="Prose-width content, e.g. Intent Workspace copy."
          />
          <ReadingColumn>
            <Panel>
              <p>
                This paragraph sits inside a `ReadingColumn`, which caps line
                length at the reading content width regardless of the viewport,
                so long-form Anchor and Assessment text stays legible on wide
                desktop monitors.
              </p>
            </Panel>
          </ReadingColumn>
        </Section>

        <Section>
          <SectionHeader
            title="Comparison area"
            description="Full-width side-by-side content, e.g. a HumanGate before/after."
          />
          <ComparisonArea>
            <Panel>
              <SectionHeader title="Before" level={3} />
              <p>Previous Core Anchor revision text goes here.</p>
            </Panel>
            <Panel>
              <SectionHeader title="After" level={3} />
              <p>Proposed Core Anchor revision text goes here.</p>
            </Panel>
          </ComparisonArea>
        </Section>

        <Section>
          <SectionHeader title="Cards and panels" />
          <Grid minColumnWidth="16rem">
            <SummaryCard
              label="High-attention Shots"
              value={3}
              description="Shots with an unresolved Intent Signal."
              status={<StatusBadge status="attention" label="Attention" />}
            />
            <SummaryCard label="Confirmed Anchors" value={12} />
            <SummaryCard label="Open questions" value={0} />
          </Grid>
        </Section>

        <Section>
          <SectionHeader title="Authority labels" />
          <p>
            Every distinction uses a marker, border style, and colour together
            -- never colour alone.
          </p>
          <Row gap={3}>
            {AUTHORITY_VARIANTS.map((variant) => (
              <AuthorityLabel key={variant} variant={variant} />
            ))}
          </Row>
        </Section>

        <Section>
          <SectionHeader title="Status badges" />
          <Row gap={3}>
            {STATUS_BADGES.map((badge) => (
              <StatusBadge
                key={badge.status}
                status={badge.status}
                label={badge.label}
              />
            ))}
          </Row>
        </Section>

        <Section>
          <SectionHeader title="Metadata row" />
          <Panel>
            <MetadataRow
              items={[
                { label: "Created", value: "2026-07-28T01:47:33Z" },
                { label: "Provider", value: "deepseek" },
                {
                  label: "Prompt version",
                  value: "core_cross_role_assessment.v1",
                },
              ]}
            />
          </Panel>
        </Section>

        <Section>
          <SectionHeader title="Empty, error, and permission states" />
          <Grid minColumnWidth="18rem">
            <EmptyState
              title="No Shots yet"
              description="Create a Project and a Shot to get started."
            />
            <ErrorState
              title="Agent Run failed"
              description="The provider returned an invalid response. See Evidence for details."
            />
            <PermissionState description="Ask a VFX Supervisor to confirm this Anchor." />
          </Grid>
        </Section>

        <Section>
          <SectionHeader title="Loading skeleton" />
          <Stack gap={4}>
            <LoadingSkeleton
              variant="text"
              lines={3}
              label="Loading Shot summary"
            />
            <LoadingSkeleton
              variant="block"
              height="6rem"
              label="Loading Anchor panel"
            />
          </Stack>
        </Section>

        <Section>
          <SectionHeader
            title="Responsive grid"
            description="Resize the viewport to see columns reflow."
          />
          <Grid minColumnWidth="10rem">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>Grid item {index + 1}</Card>
            ))}
          </Grid>
        </Section>

        <Divider />

        <Section>
          <SectionHeader title="Keyboard-focusable controls" />
          <p>Tab through these to confirm the focus ring is visible.</p>
          <Row gap={3}>
            <button type="button">Primary action</button>
            <a href="#">Text link</a>
            <label>
              Text input <input type="text" placeholder="Type here" />
            </label>
          </Row>
        </Section>
      </Container>
    </main>
  );
}
