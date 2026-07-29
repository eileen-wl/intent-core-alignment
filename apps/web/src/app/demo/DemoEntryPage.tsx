import {
  Card,
  Container,
  Grid,
  MetadataRow,
  PageHeader,
  Panel,
  ReadingColumn,
  Section,
} from "@/design";
import styles from "./DemoEntryPage.module.css";
import { RoleEntryButton } from "./RoleEntryButton";
import { ROLE_CARDS } from "./roleCards";

/** `/demo` entry content. Presentational and prop-free: each role card
 * renders a `RoleEntryButton` with only the serialisable role literal
 * and label -- this component never creates or forwards a callback
 * closure across the Server/Client boundary. Static scenario copy
 * only; no technical IDs, permission matrices, or raw production
 * records (brief §4). */
export function DemoEntryPage() {
  return (
    <Container>
      <Section spacing={6}>
        <ReadingColumn>
          <PageHeader
            title="ICAS"
            description="ICAS keeps a shared creative intent connected across VFX, CG, and Artist work as a Shot moves through production -- captured once, translated by role, and reviewed by the humans who own each decision."
          />
        </ReadingColumn>
      </Section>

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
        <Grid minColumnWidth="18rem">
          {ROLE_CARDS.map((card) => (
            <Card key={card.role}>
              <h2 className={styles.cardTitle}>{card.title}</h2>
              <p>{card.responsibility}</p>
              <p className={styles.question}>{card.question}</p>
              <RoleEntryButton
                role={card.role}
                label={`Enter as ${card.title}`}
              />
            </Card>
          ))}
        </Grid>
      </Section>
    </Container>
  );
}
