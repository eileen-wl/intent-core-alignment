import type { VersionMediaRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VersionMediaPanel } from "./VersionMediaPanel";

afterEach(() => {
  cleanup();
});

function media(overrides: Partial<VersionMediaRead> = {}): VersionMediaRead {
  return {
    version_id: "v1",
    source: "ftrack",
    ftrack_linked: true,
    media_state: "playable",
    thumbnail_url: "https://ftrack.example/thumb?sig=abc",
    playable_url: "https://ftrack.example/video?sig=def",
    playable_media_type: "video/mp4",
    playable_component_name: "ftrackreview-mp4",
    external_web_url: null,
    resolved_at: "2026-08-01T00:00:00Z",
    url_expires_at: null,
    unavailable_reason: null,
    ...overrides,
  };
}

describe("VersionMediaPanel", () => {
  it("renders a native, controllable video for a playable Version, with autoplay absent", () => {
    render(<VersionMediaPanel media={media()} />);
    // jsdom exposes <video> without a distinct ARIA role -- query by tag.
    const videoEl = document.querySelector("video") as HTMLVideoElement;
    expect(videoEl).toBeTruthy();
    expect(videoEl).toHaveAttribute("controls");
    expect(videoEl).not.toHaveAttribute("autoplay");
    expect(videoEl).not.toHaveAttribute("muted");
    expect(videoEl.getAttribute("preload")).toBe("metadata");
    expect(videoEl.getAttribute("poster")).toBe(
      "https://ftrack.example/thumb?sig=abc",
    );
  });

  it("uses the real thumbnail as the video poster and shows the real Component name", () => {
    render(<VersionMediaPanel media={media()} />);
    expect(screen.getByText("ftrackreview-mp4")).toBeVisible();
  });

  it("shows a real thumbnail image and an honest unavailable-playable message for thumbnail-only", () => {
    render(
      <VersionMediaPanel
        media={media({
          media_state: "thumbnail_only",
          playable_url: null,
          playable_media_type: null,
          playable_component_name: null,
        })}
      />,
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img).toHaveAttribute("src", "https://ftrack.example/thumb?sig=abc");
    expect(img.alt).toMatch(/Thumbnail/);
    expect(
      screen.getByText("Playable media is unavailable for this Version."),
    ).toBeVisible();
    expect(document.querySelector("video")).toBeNull();
  });

  it("shows the honest external-context-only fallback with no fabricated media", () => {
    render(
      <VersionMediaPanel
        media={media({
          media_state: "external_context_only",
          thumbnail_url: null,
          playable_url: null,
          playable_media_type: null,
          playable_component_name: null,
        })}
      />,
    );
    expect(screen.getByText(/linked to a real ftrack record/)).toBeVisible();
    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows the real external ftrack link only when one is actually provided, with a safe rel attribute", () => {
    render(
      <VersionMediaPanel
        media={media({
          media_state: "external_context_only",
          thumbnail_url: null,
          playable_url: null,
          external_web_url: "https://ftrack.example/open?id=av-1",
        })}
      />,
    );
    const link = screen.getByRole("link", { name: "Open in ftrack" });
    expect(link).toHaveAttribute("href", "https://ftrack.example/open?id=av-1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
    expect(
      screen.getByText(/ftrack authentication may be required/),
    ).toBeVisible();
  });

  it("shows the real, honest unavailable_reason for a manual/unlinked Version -- never a fake black frame", () => {
    render(
      <VersionMediaPanel
        media={media({
          source: "manual",
          ftrack_linked: false,
          media_state: "unavailable",
          thumbnail_url: null,
          playable_url: null,
          playable_media_type: null,
          playable_component_name: null,
          unavailable_reason: "This Version has no linked ftrack record.",
        })}
      />,
    );
    expect(
      screen.getByText("This Version has no linked ftrack record."),
    ).toBeVisible();
    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows a loading state and renders no media while resolution is in flight", () => {
    render(<VersionMediaPanel media={null} isLoading />);
    expect(screen.getByText("Resolving media…")).toBeVisible();
    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows an honest error state with an accessible alert role and a Retry action", () => {
    const onRetry = vi.fn();
    render(
      <VersionMediaPanel
        media={null}
        errorMessage="The ICAS service is unavailable."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The ICAS service is unavailable.",
    );
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeVisible();
  });

  it("offers a Refresh media action for an ftrack-linked Version whenever a retry handler is supplied", () => {
    const onRetry = vi.fn();
    render(<VersionMediaPanel media={media()} onRetry={onRetry} />);
    expect(screen.getByRole("button", { name: "Refresh media" })).toBeVisible();
  });

  it("does not offer a refresh action for a manual/unlinked Version -- there is nothing to re-resolve", () => {
    const onRetry = vi.fn();
    render(
      <VersionMediaPanel
        media={media({
          source: "manual",
          ftrack_linked: false,
          media_state: "unavailable",
        })}
        onRetry={onRetry}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Refresh media" }),
    ).not.toBeInTheDocument();
  });

  it("never renders an upload, write, or approval control", () => {
    render(<VersionMediaPanel media={media()} onRetry={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /Upload/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Approve/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Upload/i)).not.toBeInTheDocument();
  });

  it("never renders a raw UUID, signed token, or external id as visible text", () => {
    render(
      <VersionMediaPanel
        media={media({
          version_id: "8a72858d-8d06-47ab-a28d-5ee077f561c8",
        })}
      />,
    );
    expect(
      screen.queryByText(/8a72858d-8d06-47ab-a28d-5ee077f561c8/),
    ).not.toBeInTheDocument();
  });
});
