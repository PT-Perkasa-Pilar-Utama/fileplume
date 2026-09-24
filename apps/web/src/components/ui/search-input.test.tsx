import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { SearchInput } from "./search-input.tsx";

describe("SearchInput component", () => {
  test("renders with leading icon by default", () => {
    const html = renderToString(<SearchInput placeholder="Cari..." value="" onChange={() => {}} />);

    expect(html).toContain('placeholder="Cari..."');
    expect(html).toContain("pl-9");
    expect(html).toContain("lucide-search");
  });

  test("renders with trailing icon when configured", () => {
    const html = renderToString(
      <SearchInput
        iconPosition="trailing"
        placeholder="Cari parameter..."
        value="test"
        onChange={() => {}}
      />,
    );

    expect(html).toContain('placeholder="Cari parameter..."');
    expect(html).toContain("pr-9");
    expect(html).toContain("lucide-search");
  });
});
