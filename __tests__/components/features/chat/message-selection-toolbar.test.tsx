import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageSelectionToolbar } from "#/components/features/chat/message-selection-toolbar";
import { useConversationStore } from "#/stores/conversation-store";

function Harness() {
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={ref} data-testid="feed">
        <p data-testid="inside">
          Saldos <strong>on-chain</strong>
        </p>
      </div>
      <p data-testid="outside">Composer area</p>
      <MessageSelectionToolbar containerRef={ref} />
    </>
  );
}

function selectContents(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.pointerUp(document);
}

describe("MessageSelectionToolbar", () => {
  beforeEach(() => {
    // jsdom does not lay out ranges.
    Range.prototype.getBoundingClientRect = () =>
      ({ top: 200, bottom: 220, left: 10, width: 100 }) as DOMRect;
    useConversationStore.setState({ pendingQuote: null });
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  it("appears only for a selection inside the message feed", () => {
    render(<Harness />);

    selectContents(screen.getByTestId("outside"));
    expect(
      screen.queryByTestId("message-selection-toolbar"),
    ).not.toBeInTheDocument();

    selectContents(screen.getByTestId("inside"));
    expect(screen.getByTestId("message-selection-toolbar")).toBeInTheDocument();
  });

  it("queues the selection as a Markdown quote for the composer", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    selectContents(screen.getByTestId("inside"));

    await user.click(screen.getByTestId("selection-quote"));

    expect(useConversationStore.getState().pendingQuote?.text).toBe(
      "> Saldos on-chain",
    );
    expect(
      screen.queryByTestId("message-selection-toolbar"),
    ).not.toBeInTheDocument();
  });

  it("copies the selection without formatting", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<Harness />);
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
    selectContents(screen.getByTestId("inside"));

    await user.click(screen.getByTestId("selection-copy-plain"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Saldos on-chain"),
    );
  });
});
