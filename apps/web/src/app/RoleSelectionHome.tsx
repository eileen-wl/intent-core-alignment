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
 * surface. */
export function RoleSelectionHome() {
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
          return (
            <article key={card.role} className={styles.roleCard}>
              <h2>{card.title}</h2>
              <p className={styles.responsibility}>{card.responsibility}</p>
              <p className={styles.question}>{card.question}</p>
              {available ? (
                <RoleEntryButton role={card.role} label={`Enter as ${card.title}`} />
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
