import { describe, expect, it } from "vitest";
import { appendQuote, toMarkdownQuote } from "#/utils/selection-quote";

describe("toMarkdownQuote", () => {
  it("prefixes every line and keeps inner blank lines inside the quote", () => {
    expect(toMarkdownQuote("  first\r\n\nsecond  \n")).toBe(
      "> first\n>\n> second",
    );
  });
});

describe("appendQuote", () => {
  it("starts an empty composer with the quote and room for the reply", () => {
    expect(appendQuote("  \n", "> hi")).toBe("> hi\n\n");
  });

  it("keeps what was already typed above the quote", () => {
    expect(appendQuote("my note\n", "> hi")).toBe("my note\n\n> hi\n\n");
  });
});
