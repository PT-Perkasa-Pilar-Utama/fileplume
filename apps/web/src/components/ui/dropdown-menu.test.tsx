import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu.tsx";

describe("DropdownMenu component", () => {
  test("renders closed dropdown without content", () => {
    const html = renderToString(
      <DropdownMenu open={false}>
        <DropdownMenuTrigger>Toggle</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(html).toContain("Toggle");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).not.toContain("Item 1");
    expect(html).not.toContain('role="menu"');
  });

  test("renders open dropdown with content and menu items", () => {
    const html = renderToString(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger>Toggle</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Akun</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Keluar</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="menu"');
    expect(html).toContain('role="menuitem"');
    expect(html).toContain("Akun");
    expect(html).toContain("Profil");
    expect(html).toContain("Keluar");
    expect(html).toContain("text-destructive");
  });

  test("renders trigger with asChild correctly", () => {
    const html = renderToString(
      <DropdownMenu open={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="custom-trigger">
            Custom Trigger
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Option</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(html).toContain("custom-trigger");
    expect(html).toContain("Custom Trigger");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="menu"');
  });
});
