import React from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardType,
  Copy,
  MessageSquarePlus,
  Reply,
  Square,
  Volume2,
} from "lucide-react";
import { I18nKey } from "#/i18n/declaration";
import { useNavigation } from "#/context/navigation-context";
import { useConversationStore } from "#/stores/conversation-store";
import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import { toMarkdownQuote } from "#/utils/selection-quote";

/** Gap between the selection and the toolbar, in pixels. */
const TOOLBAR_GAP_PX = 8;
/** Approximate toolbar height, used to flip it below a selection near the top. */
const TOOLBAR_HEIGHT_PX = 36;
const NEW_CONVERSATION_PATH = "/conversations";

interface SelectionSnapshot {
  text: string;
  html: string;
  top: number;
  bottom: number;
  centerX: number;
}

function readSelectionInside(
  container: HTMLElement | null,
): SelectionSnapshot | null {
  if (!container) return null;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const text = selection.toString().trim();
  if (text.length === 0) return null;

  const holder = document.createElement("div");
  holder.appendChild(range.cloneContents());
  const rect = range.getBoundingClientRect();

  return {
    text,
    html: holder.innerHTML,
    top: rect.top,
    bottom: rect.bottom,
    centerX: rect.left + rect.width / 2,
  };
}

async function copyRich(text: string, html: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(text);
}

interface ToolbarButtonProps {
  label: string;
  testId: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({
  label,
  testId,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <StyledTooltip content={label} placement="top">
      <button
        type="button"
        data-testid={testId}
        aria-label={label}
        onClick={onClick}
        className="button-base flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-interactive-hover"
      >
        {children}
      </button>
    </StyledTooltip>
  );
}

/**
 * Floating actions for text selected in the message feed: reply with a
 * quote, read aloud, start a new conversation from the selection, and copy
 * with or without formatting.
 */
export function MessageSelectionToolbar({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const { t, i18n } = useTranslation("openhands");
  const { navigate } = useNavigation();
  const [snapshot, setSnapshot] = React.useState<SelectionSnapshot | null>(
    null,
  );
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // Show only once the drag (or keyboard selection) ends, so the toolbar
    // doesn't chase the pointer while the user is still selecting.
    const show = () => setSnapshot(readSelectionInside(container));
    const hideWhenCleared = () => {
      if (!readSelectionInside(container)) setSnapshot(null);
    };
    const hide = () => setSnapshot(null);

    document.addEventListener("pointerup", show);
    document.addEventListener("keyup", show);
    document.addEventListener("selectionchange", hideWhenCleared);
    container.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerup", show);
      document.removeEventListener("keyup", show);
      document.removeEventListener("selectionchange", hideWhenCleared);
      container.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, [containerRef]);

  // Stop reading when the conversation view goes away.
  React.useEffect(
    () => () => {
      if (canSpeak) window.speechSynthesis.cancel();
    },
    [canSpeak],
  );

  if (!snapshot) return null;

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setSnapshot(null);
  };

  const handleQuote = () => {
    useConversationStore
      .getState()
      .quoteIntoComposer(toMarkdownQuote(snapshot.text));
    clearSelection();
  };

  const handleSpeak = () => {
    if (!canSpeak) return;
    const synth = window.speechSynthesis;
    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(snapshot.text);
    utterance.lang = i18n.language;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setIsSpeaking(true);
  };

  const handleNewConversation = () => {
    useConversationStore
      .getState()
      .setMessageToSend(toMarkdownQuote(snapshot.text), "home");
    clearSelection();
    navigate(NEW_CONVERSATION_PATH);
  };

  const handleCopy = async (rich: boolean) => {
    if (rich) {
      await copyRich(snapshot.text, snapshot.html);
    } else {
      await navigator.clipboard.writeText(snapshot.text);
    }
    displaySuccessToast(t(I18nKey.CHAT_INTERFACE$SELECTION_COPIED));
    clearSelection();
  };

  const placeBelow = snapshot.top < TOOLBAR_HEIGHT_PX + TOOLBAR_GAP_PX;
  const top = placeBelow
    ? snapshot.bottom + TOOLBAR_GAP_PX
    : snapshot.top - TOOLBAR_HEIGHT_PX - TOOLBAR_GAP_PX;

  // Rendered in place (not portaled) so it stays inside the scoped style root.
  return (
    <div
      role="toolbar"
      aria-label={t(I18nKey.CHAT_INTERFACE$SELECTION_TOOLBAR)}
      data-testid="message-selection-toolbar"
      // Keep the selection alive while a button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onPointerUp={(event) => event.stopPropagation()}
      className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-tertiary p-1 shadow-lg"
      // Measured selection coordinates; these can't be static classes.
      // eslint-disable-next-line shadcn/no-inline-styles
      style={{ top, left: snapshot.centerX }}
    >
      <ToolbarButton
        label={t(I18nKey.CHAT_INTERFACE$SELECTION_QUOTE)}
        testId="selection-quote"
        onClick={handleQuote}
      >
        <Reply size={15} aria-hidden />
      </ToolbarButton>
      {canSpeak && (
        <ToolbarButton
          label={t(
            isSpeaking
              ? I18nKey.CHAT_INTERFACE$SELECTION_STOP_READING
              : I18nKey.CHAT_INTERFACE$SELECTION_READ_ALOUD,
          )}
          testId="selection-read-aloud"
          onClick={handleSpeak}
        >
          {isSpeaking ? (
            <Square size={13} aria-hidden />
          ) : (
            <Volume2 size={15} aria-hidden />
          )}
        </ToolbarButton>
      )}
      <ToolbarButton
        label={t(I18nKey.CHAT_INTERFACE$SELECTION_NEW_CONVERSATION)}
        testId="selection-new-conversation"
        onClick={handleNewConversation}
      >
        <MessageSquarePlus size={15} aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t(I18nKey.CHAT_INTERFACE$SELECTION_COPY)}
        testId="selection-copy"
        onClick={() => handleCopy(true)}
      >
        <Copy size={15} aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t(I18nKey.CHAT_INTERFACE$SELECTION_COPY_PLAIN)}
        testId="selection-copy-plain"
        onClick={() => handleCopy(false)}
      >
        <ClipboardType size={15} aria-hidden />
      </ToolbarButton>
    </div>
  );
}
