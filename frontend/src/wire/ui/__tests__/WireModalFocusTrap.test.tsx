import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WireModal } from "../WireModal";

describe("WireModal focus trap", () => {
  it("cycles focus within the modal when tabbing", async () => {
    const user = userEvent.setup();
    const onClose = () => {};

    render(
      <WireModal title="Test Modal" onClose={onClose}>
        <div className="p-4">
          <button type="button">First</button>
          <button type="button">Second</button>
          <button type="button">Third</button>
        </div>
      </WireModal>
    );

    // WireModal focuses the first focusable element, which is the close button in the header.
    expect(document.activeElement).toHaveTextContent("✕");

    await user.tab();
    expect(document.activeElement).toHaveTextContent("First");

    await user.tab();
    expect(document.activeElement).toHaveTextContent("Second");

    await user.tab();
    expect(document.activeElement).toHaveTextContent("Third");

    // Next tab wraps to close button (first focusable)
    await user.tab();
    expect(document.activeElement).toHaveTextContent("✕");

    // Shift+Tab from close wraps to last focusable
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveTextContent("Third");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    let closed = false;
    const onClose = () => {
      closed = true;
    };

    render(
      <WireModal title="Esc Modal" onClose={onClose}>
        <div className="p-4">
          <button type="button">Ok</button>
        </div>
      </WireModal>
    );

    await user.keyboard("{Escape}");
    expect(closed).toBe(true);
  });
});

