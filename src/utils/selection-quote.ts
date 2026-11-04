/**
 * Turns selected text into a Markdown blockquote ("> " on every line).
 * Blank lines inside the selection stay part of the quote as a bare ">".
 */
export function toMarkdownQuote(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  return lines
    .map((line) => (line.trim().length > 0 ? `> ${line}` : ">"))
    .join("\n");
}

/**
 * Adds a quote after the text already in the composer, separated by a blank
 * line, and leaves an empty line below it for the reply.
 */
export function appendQuote(existing: string, quote: string): string {
  const base = existing.trimEnd();
  return base.length > 0 ? `${base}\n\n${quote}\n\n` : `${quote}\n\n`;
}
