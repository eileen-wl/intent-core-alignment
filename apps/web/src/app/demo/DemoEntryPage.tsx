import {
  Card,
  Container,
  ErrorState,
  Grid,
  MetadataRow,
  PageHeader,
  Panel,
  ReadingColumn,
  Section,
  SectionHeader,
} from "@/design";
import styles from "./DemoEntryPage.module.css";
import { RoleEntryButton } from "./RoleEntryButton";
import { ROLE_CARDS } from "./roleCards";

/** `/demo` entry content. Presentational and prop-free except for an
 * optional guided-entry failure notice -- each role card renders a
 * `RoleEntryButton` with only the serialisable role literal and label,
 * this component never creates or forwards a callback closure across
 * the Server/Client boundary.
 *
 * Hierarchy (corrected per docs/step-7/10_FTRACK_ENTRY_AND_IA_AMENDMENT.md
 * §4): one dominant "Start guided demonstration" action enters as VFX
 * Supervisor; the three direct role entries move to a visually quieter,
 * collapsed-by-default "Explore by role" section. The guided CTA calls
 * `startGuidedDemonstration` (which additionally resolves the real D1
 * scenario and redirects to its Shot Overview, docs/step-7/16_STEP_7C0D_...md
 * §8.3); each direct role entry still calls the same plain
 * `enterDemoRole` Server Action and role-session mechanism as before --
 * only the visual prominence differs between the direct-entry cards. */
export function DemoEntryPage({
  guidedEntryError = false,
}: {
  guidedEntryError?: boolean;
}) {
  return (
    <Container>
      <Section spacing={6}>
        <ReadingColumn>
          <PageHeader
            eyebrow="Guided portfolio demonstration"
            title="ICAS"
            description="ICAS keeps a shared creative intent connected across VFX, CG, and Artist work as a Shot moves through production -- captured once, translated by role, and reviewed by the humans who own each decision."
          />
        </ReadingColumn>
      </Section>

      {guidedEntryError && (
        <Section>
          <ReadingColumn>
            <ErrorState
              title="The guided demonstration couldn't start"
              description="The ICAS service is unavailable. Try again in a moment."
            />
          </ReadingColumn>
        </Section>
      )}

      <Section>
        <ReadingColumn>
          <Panel>
            <p className={styles.scenarioProject}>
              D1 Demo Project · Shot 010 — Final confrontation
            </p>
            <p>
              A restrained dusk confrontation should remain internal and
              controlled. Camera timing and compositing contrast have begun to
              drift across role interpretations.
            </p>
            <MetadataRow
              items={[
                { label: "Task", value: "Compositing Review" },
                { label: "Version", value: "D1_STEP3_VFX_REVIEW_001" },
              ]}
            />
          </Panel>
        </ReadingColumn>
      </Section>

      <Section>
        <ReadingColumn>
          <div className={styles.primaryCta}>
            <SectionHeader
              title="Start guided demonstration"
              description="Walk through the shared scenario as the VFX Supervisor first. The guided path will move through CG Supervisor and Artist perspectives in a later step."
            />
            <RoleEntryButton
              role="vfx_supervisor"
              label="Start guided demonstration"
              variant="primary"
              guided
            />
          </div>
        </ReadingColumn>
      </Section>

      <Section>
        <ReadingColumn>
          <Panel tone="muted">
            <p>
              This page is a guided portfolio demonstration of one shared
              production scenario. Production users will ultimately launch ICAS
              directly from ftrack -- their verified identity and current
              Project, Shot, Task, or Version context will determine the
              workspace they enter, rather than manually choosing a production
              role.
            </p>
          </Panel>
        </ReadingColumn>
      </Section>

      <Section>
        <details className={styles.exploreByRole}>
          <summary className={styles.exploreSummary}>Explore by role</summary>
          <div className={styles.exploreContent}>
            <p className={styles.exploreDescription}>
              Enter directly as a single role to explore that perspective on its
              own.
            </p>
            <Grid minColumnWidth="18rem">
              {ROLE_CARDS.map((card) => (
                <Card key={card.role}>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <p>{card.responsibility}</p>
                  <p className={styles.question}>{card.question}</p>
                  <RoleEntryButton
                    role={card.role}
                    label={`Enter as ${card.title}`}
                  />
                </Card>
              ))}
            </Grid>
          </div>
        </details>
      </Section>
    </Container>
  );
}
