import type { VersionMediaRead } from "@intent-core/contracts";

import styles from "./VersionMediaPanel.module.css";

/** Step 9B-4 -- the one shared, read-only media-context panel every
 * Version-focused page (`VersionsWorkspacePage.tsx`, `VersionReviewPage
 * .tsx`, `CurrentVersionPage.tsx`) renders for its selected Version.
 * Every URL is transient (never persisted, resolved fresh per request
 * by the caller) -- this component never fetches anything itself; it
 * only renders whatever `media`/`isLoading`/`errorMessage` its caller
 * already resolved (either a client-side `VersionMediaResolver` or a
 * server-rendered loader).
 *
 * Branches only on the real `media_state` discriminator -- never
 * infers playability from a URL's mere presence, and never renders a
 * fake/placeholder video frame for a non-playable state. Media is
 * always Production Evidence/source context (§7/§8 of the locked task)
 * -- this component has no opinion on Evidence/Agent/Human layering
 * placement; callers wrap it in their own `EvidenceLayerSection` where
 * that convention applies. */
export function VersionMediaPanel({
  media,
  isLoading = false,
  errorMessage = null,
  onRetry,
}: {
  media: VersionMediaRead | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}) {
  if (isLoading) {
    return (
      <div className={styles.panel}>
        <p className={styles.status}>Resolving media…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={styles.panel}>
        <p className={styles.status} role="alert">
          {errorMessage}
        </p>
        {onRetry && (
          <button
            type="button"
            className={styles.retryButton}
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (media === null) {
    return (
      <div className={styles.panel}>
        <p className={styles.status}>No media context is available.</p>
      </div>
    );
  }

  const showRefresh = media.ftrack_linked && onRetry;

  return (
    <div className={styles.panel}>
      {media.media_state === "playable" && media.playable_url && (
        <>
          <video
            className={styles.video}
            controls
            preload="metadata"
            poster={media.thumbnail_url ?? undefined}
          >
            <source
              src={media.playable_url}
              type={media.playable_media_type ?? undefined}
            />
            Your browser does not support playing this video directly.
          </video>
          {media.playable_component_name && (
            <p className={styles.caption}>{media.playable_component_name}</p>
          )}
        </>
      )}

      {media.media_state === "thumbnail_only" && media.thumbnail_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a
              transient, signed ftrack URL cannot go through next/image's
              remote-pattern allowlist or its persistent optimisation cache. */}
          <img
            className={styles.thumbnail}
            src={media.thumbnail_url}
            alt={
              media.playable_component_name
                ? `Thumbnail for ${media.playable_component_name}`
                : "Thumbnail for this Production Version"
            }
          />
          <p className={styles.status}>
            Playable media is unavailable for this Version.
          </p>
        </>
      )}

      {media.media_state === "external_context_only" && (
        <p className={styles.status}>
          This Version is linked to a real ftrack record, but no thumbnail or
          playable media could be resolved for it.
          {media.external_web_url && (
            <>
              {" "}
              <a
                href={media.external_web_url}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.externalLink}
              >
                Open in ftrack
              </a>{" "}
              (ftrack authentication may be required).
            </>
          )}
        </p>
      )}

      {media.media_state === "unavailable" && (
        <p className={styles.status}>
          {media.unavailable_reason ?? "Media is unavailable for this Version."}
        </p>
      )}

      {showRefresh && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Refresh media
        </button>
      )}
    </div>
  );
}
