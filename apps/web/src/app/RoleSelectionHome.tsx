import { roleForPathname } from "@/lib/demoIdentity";
import { ROLE_CARDS } from "./demo/roleCards";
import { RoleEntryButton } from "./demo/RoleEntryButton";
import styles from "./RoleSelectionHome.module.css";

/** Step 7C-1 locked IA: the Role-selection Home. Deliberately renders
 * no `AppShell`, no role-specific sidebar, no preselected human
 * identity, and no Exit role view -- those only ever appear once a
 * role workspace has actually been entered. VFX Supervisor and CG
 * Supervisor are both fully available roles (CG enabled in Step 7C-4);
 * Artist is shown, honestly marked Upcoming, until Step 7C-5 -- never a
 * clickable action. There is no Guided card, no Explore card, and no
 * Future-ftrack-launch card: those belonged to the retired Demo Entry
 * surface.
 *
 * `returnTo` (Step 7C-4 completion, already validated safe by the
 * caller -- see `page.tsx`) is forwarded only to the one role button
 * whose route prefix it actually belongs to, never to every button:
 * picking a *different* role than the one the deep link was for must
 * never carry that other role's intended route along with it. */
export function RoleSelectionHome({ returnTo = null }: { returnTo?: string | null }) {
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
          const available = card.role === "vfx_supervisor" || card.role === "cg_supervisor";
          const matchesReturnTo = returnTo !== null && roleForPathname(returnTo) === card.role;
          return (
            <article key={card.role} className={styles.roleCard}>
              <h2>{card.title}</h2>
              <p className={styles.responsibility}>{card.responsibility}</p>
              <p className={styles.question}>{card.question}</p>
              {available ? (
                <RoleEntryButton
                  role={card.role}
                  label={`Enter as ${card.title}`}
                  returnTo={matchesReturnTo ? returnTo : null}
                />
              ) : (
                <span className={styles.upcoming} aria-disabled="true">
                  Upcoming
                </span>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
