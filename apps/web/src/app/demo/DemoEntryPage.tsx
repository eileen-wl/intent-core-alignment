import Image from "next/image";

import { AppShell } from "@/design";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import styles from "./DemoEntryPage.module.css";
import { RoleEntryButton } from "./RoleEntryButton";
import { exitRoleView } from "./actions";

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.02 6.9 18.7l.98-5.68L3.75 9l5.7-.83L12 3Z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.75 7.25A2.25 2.25 0 0 1 6 5h3.1l1.75 2H18a2.25 2.25 0 0 1 2.25 2.25v7.5A2.25 2.25 0 0 1 18 19H6a2.25 2.25 0 0 1-2.25-2.25v-9.5Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10.5v5" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5c.45 3.1 2.15 4.8 5.25 5.25C14.15 9.2 12.45 10.9 12 14c-.45-3.1-2.15-4.8-5.25-5.25C9.85 8.3 11.55 6.6 12 3.5Z" />
      <path d="M18.25 14.5c.22 1.55 1.07 2.4 2.62 2.62-1.55.23-2.4 1.08-2.62 2.63-.23-1.55-1.08-2.4-2.63-2.63 1.55-.22 2.4-1.07 2.63-2.62Z" />
    </svg>
  );
}

/** Portfolio entry for the guided D1 scenario. The shell is visual only:
 * trusted Demo identity is still established exclusively by the existing
 * Server Actions when a user chooses Guided or Browse. */
export function DemoEntryPage({
  guidedEntryError = false,
}: {
  guidedEntryError?: boolean;
}) {
  return (
    <AppShell
      name="Maya Chen"
      role="VFX Supervisor"
      onExitRole={exitRoleView}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx"
      navigationMode="demo-entry"
    >
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1>Choose how you want to enter ICAS</h1>
          <p>
            You&apos;re in Demo mode — a guided environment for showcasing the
            VFX alignment workflow.
            <br />
            Select a path to begin.
          </p>
        </header>

        {guidedEntryError && (
          <div className={styles.error} role="alert">
            <strong>The guided demonstration couldn&apos;t start</strong>
            <span>The ICAS service is unavailable. Try again in a moment.</span>
          </div>
        )}

        <section className={styles.guidedCard} aria-labelledby="guided-title">
          <div className={styles.guidedMain}>
            <span className={`${styles.iconTile} ${styles.guidedIcon}`}>
              <StarIcon />
            </span>

            <div className={styles.guidedText}>
              <h2 id="guided-title">Guided D1 walkthrough</h2>
              <p>
                Jump straight into a curated demo shot with realistic alignment
                context and intent.
              </p>
            </div>

            <div className={styles.guidedAction}>
              <RoleEntryButton
                role="vfx_supervisor"
                label="Start guided demonstration"
                variant="primary"
                guided
              />
            </div>

            <div className={styles.previewFrame}>
              <Image
                src="/demo/d1-shot-preview.png"
                alt="Dusk confrontation between two figures on a reflective waterfront"
                width={260}
                height={164}
                priority
              />
            </div>

            <article className={styles.shotCard}>
              <p className={styles.projectLabel}>D1 Demo Project</p>
              <h3>Shot 010 — Final confrontation</h3>
              <p className={styles.shotDescription}>
                A restrained dusk confrontation that stays internal and
                controlled through to its climax.
              </p>
              <div className={styles.metadata}>
                <span className={styles.metadataPill}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  No linked ftrack entity
                </span>
                <span className={styles.metadataPill}>
                  D1_STEP3_VFX_REVIEW_001 (v1)
                </span>
              </div>
            </article>
          </div>

          <div className={styles.guidedFooter}>
            <SparkleIcon />
            <span>This path takes you directly into the featured demo shot.</span>
          </div>
        </section>

        <section className={styles.optionRow} aria-labelledby="explore-title">
          <span className={styles.iconTile}>
            <FolderIcon />
          </span>
          <div className={styles.optionCopy}>
            <h2 id="explore-title">Explore manually</h2>
            <p>
              Browse the Alignment Inbox and choose any project or shot to
              explore on your own.
            </p>
          </div>
          <RoleEntryButton
            role="vfx_supervisor"
            label="Browse Alignment Inbox"
            variant="secondary"
          />
        </section>

        <section className={styles.optionRow} aria-labelledby="future-title">
          <span className={styles.iconTile}>
            <InfoIcon />
          </span>
          <div className={styles.optionCopy}>
            <h2 id="future-title">Future ftrack launch</h2>
            <p>
              ICAS can also be launched from ftrack when connected.
              <br />
              In this demo, ftrack integration is not yet active.
            </p>
          </div>
          <span className={styles.unavailable}>Not available in demo</span>
        </section>
      </div>
    </AppShell>
  );
}
