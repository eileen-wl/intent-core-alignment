import Link from "next/link";

import { Container, PageHeader, Panel, ReadingColumn, Section } from "@/design";

/** `/dev` -- Development mode index. Hidden from the portfolio-facing
 * role navigation (brief §10); links out to the existing engineering
 * surfaces rather than duplicating them. */
export function DevIndexPage() {
  return (
    <Container>
      <ReadingColumn>
        <Section spacing={6}>
          <PageHeader
            eyebrow="Development mode"
            title="Development"
            description="Engineering and manual smoke-test surfaces. Not part of the portfolio-facing product -- see /demo for the Demo entry."
          />
        </Section>

        <Section>
          <Panel>
            <h2>UI Foundation preview</h2>
            <p>
              Every Step 7B-1 design token, layout primitive, and shared
              component, demonstrated in isolation.
            </p>
            <Link href="/dev/ui-foundation">Open UI Foundation preview</Link>
          </Panel>
        </Section>

        <Section>
          <Panel>
            <h2>Legacy Shot smoke test</h2>
            <p>
              Engineering / manual smoke-test surface for Steps 1-6: raw Role
              and Actor ID controls, direct Anchor and Agent-run workflows.
              Preserved for validation and backwards compatibility.
            </p>
            <Link href="/shots">Open legacy Shot smoke test</Link>
          </Panel>
        </Section>
      </ReadingColumn>
    </Container>
  );
}
