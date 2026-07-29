import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReadOnlyAuthorityNotice } from "./ReadOnlyAuthorityNotice";

afterEach(() => {
  cleanup();
});

describe("ReadOnlyAuthorityNotice", () => {
  it("represents Artist read-only Anchor authority correctly", () => {
    render(
      <ReadOnlyAuthorityNotice
        ownerRole="vfx_supervisor"
        objectLabel="Core Anchor"
      />,
    );
    expect(screen.getByText("Read-only for your role")).toBeVisible();
    expect(
      screen.getByText(/Human VFX Supervisor controls the Core Anchor/),
    ).toBeVisible();
  });

  it("is not rendered as an error", () => {
    render(
      <ReadOnlyAuthorityNotice
        ownerRole="cg_supervisor"
        objectLabel="Execution Anchor"
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
