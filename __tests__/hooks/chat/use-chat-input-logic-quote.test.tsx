import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatInputLogic } from "#/hooks/chat/use-chat-input-logic";
import { useConversationStore } from "#/stores/conversation-store";

const navigation = vi.hoisted(() => ({
  conversationId: "conv-1" as string | undefined,
}));
vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => ({
    conversationId: navigation.conversationId,
  }),
}));

function renderComposer(typed: string) {
  const hook = renderHook(() => useChatInputLogic({ persistDraft: false }));
  const input = document.createElement("div");
  // jsdom has no layout-based innerText, which the composer reads.
  Object.defineProperty(input, "innerText", { value: typed });
  hook.result.current.chatInputRef.current = input;
  return hook;
}

describe("useChatInputLogic quotes", () => {
  beforeEach(() => {
    navigation.conversationId = "conv-1";
    useConversationStore.setState({ messageToSend: null, pendingQuote: null });
  });

  it("appends a quote below the text already typed and consumes it", () => {
    renderComposer("my note");

    act(() => useConversationStore.getState().quoteIntoComposer("> hi"));

    const state = useConversationStore.getState();
    expect(state.messageToSend?.text).toBe("my note\n\n> hi\n\n");
    expect(state.pendingQuote).toBeNull();
  });

  it("leaves a quote alone on the Home composer", () => {
    navigation.conversationId = undefined;
    renderComposer("");

    act(() => useConversationStore.getState().quoteIntoComposer("> hi"));

    expect(useConversationStore.getState().pendingQuote?.text).toBe("> hi");
  });
});
