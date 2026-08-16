import { roleForPathname } from "@/lib/demoIdentity";
import { ROLE_CARDS } from "./demo/roleCards";
import { RoleEntryButton } from "./demo/RoleEntryButton";
import styles from "./RoleSelectionHome.module.css";

/** Step 7C-1 locked IA: the Role-selection Home. Deliberately renders
 * no `AppShell`, no role-specific sidebar, no preselected human
 * identity, and no Exit role view -- those only ever appear once a
 * role workspace has actually been entered. VFX Supervisor, CG
 * Supervisor, and Artist are all fully available roles (CG enabled in
 * Step 7C-4, Artist enabled in Step 7C-5). There is no Guided card, no
 * Explore card, and no Future-ftrack-launch card: those belonged to the
 * retired Demo Entry surface.
 *
 * `returnTo` (Step 7C-4 completion, already validated safe by the
 * caller -- see `page.tsx`) is forwarded only to the one role button
 * whose route prefix it actually belongs to, never to every button:
 * picking a *different* role than the one the deep link was for must
 * never carry that other role's intended route along with it. */
export function RoleSelectionHome({
  returnTo = null,
}: {
  returnTo?: string | null;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <span className={styles.brand}>ICAS</span>
        <h1>Choose your role to enter ICAS</h1>
        <p>
          Select the human role you&apos;re entering as. Confirmed intent,
          decisions, and review authority are scoped to your role.
        </p>
      </header>

      <div className={styles.roleGrid}>
        {ROLE_CARDS.map((card) => {
          const matchesReturnTo =
            returnTo !== null && roleForPathname(returnTo) === card.role;
          return (
            <article key={card.role} className={styles.roleCard}>
              <h2>{card.title}</h2>
              <p className={styles.responsibility}>{card.responsibility}</p>
              <p className={styles.question}>{card.question}</p>
              <RoleEntryButton
                role={card.role}
                label={`Enter as ${card.title}`}
                pendingLabel={`Entering as ${card.title}…`}
                returnTo={matchesReturnTo ? returnTo : null}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
