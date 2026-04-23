export interface ExtractedLink {
  text: string;
  href: string;
  ariaLabel: string;
  title: string;
  role: string;
}

export interface ExtractedButton {
  text: string;
  ariaLabel: string;
  title: string;
  role: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  capturedAt: string;
  headings: string[];
  links: ExtractedLink[];
  buttons: ExtractedButton[];
  bodyText: string;
  rawHtml: string;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleText(value: string | null | undefined): string {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

export function extractPageSnapshot(doc: Document = document, loc: Location = location): PageSnapshot {
  const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((anchor) => ({
      text: cleanText(anchor.innerText || anchor.textContent),
      href: anchor.href,
      ariaLabel: cleanText(anchor.getAttribute("aria-label")),
      title: cleanText(anchor.getAttribute("title")),
      role: cleanText(anchor.getAttribute("role"))
    }))
    .filter((link) => link.href);

  const buttons = Array.from(doc.querySelectorAll<HTMLElement>("button,[role='button']")).map((button) => ({
    text: cleanText(button.innerText || button.textContent),
    ariaLabel: cleanText(button.getAttribute("aria-label")),
    title: cleanText(button.getAttribute("title")),
    role: cleanText(button.getAttribute("role") || button.tagName.toLowerCase())
  }));

  const headings = uniqueNonEmpty(
    Array.from(doc.querySelectorAll<HTMLElement>("h1,h2,h3,[role='heading']")).map(
      (heading) => heading.innerText || heading.textContent || ""
    )
  );

  return {
    url: loc.href,
    title: doc.title,
    capturedAt: new Date().toISOString(),
    headings,
    links,
    buttons,
    bodyText: visibleText(doc.body?.innerText || doc.body?.textContent || ""),
    rawHtml: doc.documentElement?.outerHTML || ""
  };
}
