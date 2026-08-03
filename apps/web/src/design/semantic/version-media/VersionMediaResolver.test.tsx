import type { VersionMediaRead } from "@intent-core/contracts";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VersionMediaResolver } from "./VersionMediaResolver";
import type { VersionMediaFetchResult } from "./VersionMediaResolver";

afterEach(() => {
  cleanup();
});

function media(overrides: Partial<VersionMediaRead> = {}): VersionMediaRead {
  return {
    version_id: "v1",
    source: "ftrack",
    ftrack_linked: true,
    media_state: "playable",
    thumbnail_url: "https://ftrack.example/thumb",
    playable_url: "https://ftrack.example/video",
    playable_media_type: "video/mp4",
    playable_component_name: "ftrackreview-mp4",
    external_web_url: null,
    resolved_at: "2026-08-01T00:00:00Z",
    url_expires_at: null,
    unavailable_reason: null,
    ...overrides,
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("VersionMediaResolver", () => {
  it("resolves media for the given Version on mount and renders it", async () => {
    const resolve = vi.fn(async (): Promise<VersionMediaFetchResult> => ({
      ok: true,
      media: media(),
    }));
    render(<VersionMediaResolver versionId="v1" resolve={resolve} />);

    expect(screen.getByText("Resolving media…")).toBeVisible();
    await waitFor(() => {
      expect(document.querySelector("video")).toBeTruthy();
    });
    expect(resolve).toHaveBeenCalledWith("v1");
  });

  it("shows the honest error message and a working Retry action when resolution fails", async () => {
    const resolve = vi
      .fn<(versionId: string) => Promise<VersionMediaFetchResult>>()
      .mockResolvedValueOnce({
        ok: false,
        message: "The ICAS service is unavailable.",
      })
      .mockResolvedValueOnce({ ok: true, media: media() });

    render(<VersionMediaResolver versionId="v1" resolve={resolve} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The ICAS service is unavailable.",
      );
    });

    screen.getByRole("button", { name: "Retry" }).click();

    await waitFor(() => {
      expect(document.querySelector("video")).toBeTruthy();
    });
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("requests the new Version's media when the selected Version changes", async () => {
    const resolve = vi.fn(
      async (versionId: string): Promise<VersionMediaFetchResult> => ({
        ok: true,
        media: media({
          version_id: versionId,
          playable_component_name: versionId,
        }),
      }),
    );
    const { rerender } = render(
      <VersionMediaResolver versionId="v1" resolve={resolve} />,
    );
    await waitFor(() => expect(screen.getByText("v1")).toBeVisible());

    rerender(<VersionMediaResolver versionId="v2" resolve={resolve} />);

    await waitFor(() => expect(screen.getByText("v2")).toBeVisible());
    expect(resolve).toHaveBeenCalledWith("v1");
    expect(resolve).toHaveBeenCalledWith("v2");
  });

  it("discards a stale response from a superseded selection instead of overwriting the newly selected Version", async () => {
    const first = deferred<VersionMediaFetchResult>();
    const resolve = vi
      .fn<(versionId: string) => Promise<VersionMediaFetchResult>>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({
        ok: true,
        media: media({
          version_id: "v2",
          playable_component_name: "v2-component",
        }),
      });

    const { rerender } = render(
      <VersionMediaResolver versionId="v1" resolve={resolve} />,
    );
    expect(screen.getByText("Resolving media…")).toBeVisible();

    // The user switches to v2 before v1's request has resolved.
    rerender(<VersionMediaResolver versionId="v2" resolve={resolve} />);
    await waitFor(() => expect(screen.getByText("v2-component")).toBeVisible());

    // The stale v1 response now arrives -- it must not replace v2's panel.
    first.resolve({
      ok: true,
      media: media({
        version_id: "v1",
        playable_component_name: "v1-component",
      }),
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText("v2-component")).toBeVisible();
    expect(screen.queryByText("v1-component")).not.toBeInTheDocument();
  });
});
