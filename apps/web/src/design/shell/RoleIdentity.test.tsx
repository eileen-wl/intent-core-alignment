import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoleIdentity } from "./RoleIdentity";

afterEach(() => {
  cleanup();
});

describe("RoleIdentity", () => {
  it("renders the fictional name and fixed role", () => {
    render(<RoleIdentity name="Maya Chen" role="VFX Supervisor" />);
    expect(screen.getByText("Maya Chen")).toBeVisible();
    expect(screen.getByText("VFX Supervisor")).toBeVisible();
  });

  it("announces name and role as one accessible group", () => {
    render(<RoleIdentity name="Maya Chen" role="VFX Supervisor" />);
    expect(
      screen.getByRole("group", { name: "Maya Chen, VFX Supervisor" }),
    ).toBeInTheDocument();
  });
});
