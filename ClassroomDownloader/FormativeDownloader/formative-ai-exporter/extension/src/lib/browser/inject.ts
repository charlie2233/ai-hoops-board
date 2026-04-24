import type { CapturedPage } from "../archive/schema";

export type ClickNextResult =
  | {
      clicked: true;
      label: string;
    }
  | {
      clicked: false;
      reason: string;
      label?: string;
    };

export async function injectExtractPage(tabId: number): Promise<CapturedPage> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPageInPage
  });

  if (!result?.result) {
    throw new Error("Page extraction returned no result.");
  }

  return result.result as CapturedPage;
}

export async function injectClickNext(tabId: number): Promise<ClickNextResult> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: clickNextInPage
  });

  return (
    (result?.result as ClickNextResult | undefined) ?? {
      clicked: false,
      reason: "no_click_result"
    }
  );
}

function extractPageInPage(): CapturedPage {
  const MAX_RAW_HTML_LENGTH = 2_000_000;
  const MAX_INLINE_SVG_LENGTH = 200_000;

  function normalizeSpace(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").trim();
  }

  function textOf(element: Element | null | undefined): string {
    if (!element) {
      return "";
    }

    const htmlElement = element as HTMLElement;
    return normalizeSpace(htmlElement.innerText || element.textContent || "");
  }

  function visibleTextFromBody(): string {
    return (document.body?.innerText || document.body?.textContent || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }

  function box(element: Element) {
    const rect = element.getBoundingClientRect();
    const round = (value: number) => (Number.isFinite(value) ? Math.round(value * 100) / 100 : 0);

    return {
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height)
    };
  }

  function selectorHint(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id.replace(/[^a-zA-Z0-9_-]/g, "\\$&")}` : "";
    const classes = Array.from(element.classList)
      .slice(0, 3)
      .map((className) => `.${className.replace(/[^a-zA-Z0-9_-]/g, "\\$&")}`)
      .join("");

    return `${tagName}${id}${classes}`;
  }

  function guessLabel(element: Element): string {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      return trimLabel(ariaLabel);
    }

    const ariaLabelledBy = element.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      const labelledText = ariaLabelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .map(textOf)
        .filter(Boolean)
        .join(" ");

      if (labelledText) {
        return trimLabel(labelledText);
      }
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      if (element.labels?.length) {
        return trimLabel(Array.from(element.labels).map(textOf).filter(Boolean).join(" "));
      }

      if (element.id) {
        const label = document.querySelector(`label[for="${element.id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`);
        const labelText = textOf(label);
        if (labelText) {
          return trimLabel(labelText);
        }
      }
    }

    const closestLabel = element.closest("label");
    const closestLabelText = textOf(closestLabel);
    if (closestLabelText) {
      return trimLabel(closestLabelText);
    }

    let previous = element.previousElementSibling;
    while (previous) {
      const previousText = textOf(previous);
      if (previousText) {
        return trimLabel(previousText);
      }
      previous = previous.previousElementSibling;
    }

    return trimLabel(textOf(element.parentElement));
  }

  function trimLabel(value: string): string {
    const normalized = normalizeSpace(value);
    return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
  }

  function unique(values: string[]): string[] {
    return Array.from(new Set(values.map(normalizeSpace).filter(Boolean)));
  }

  function buttonText(element: Element): string {
    if (element instanceof HTMLInputElement) {
      return normalizeSpace(element.value || element.getAttribute("aria-label") || element.title);
    }

    return normalizeSpace(element.getAttribute("aria-label") || element.getAttribute("title") || textOf(element));
  }

  function extractAnswers() {
    const answers = [];
    const seen = new WeakSet<Element>();
    const ignoredInputTypes = new Set(["hidden", "submit", "button", "reset", "image"]);

    for (const input of Array.from(document.querySelectorAll("input"))) {
      const type = input.type || "input";
      if (ignoredInputTypes.has(type)) {
        continue;
      }

      seen.add(input);

      if (type === "radio" || type === "checkbox") {
        answers.push({
          kind: type,
          checked: input.checked,
          value: input.value,
          label_guess: guessLabel(input),
          selector_hint: selectorHint(input),
          bounding_box: box(input)
        });
      } else {
        answers.push({
          kind: type,
          value: input.value,
          label_guess: guessLabel(input),
          selector_hint: selectorHint(input),
          bounding_box: box(input)
        });
      }
    }

    for (const textarea of Array.from(document.querySelectorAll("textarea"))) {
      seen.add(textarea);
      answers.push({
        kind: "textarea",
        value: textarea.value,
        label_guess: guessLabel(textarea),
        selector_hint: selectorHint(textarea),
        bounding_box: box(textarea)
      });
    }

    for (const select of Array.from(document.querySelectorAll("select"))) {
      seen.add(select);
      answers.push({
        kind: "select",
        value: select.value,
        selected_text: normalizeSpace(select.selectedOptions?.[0]?.textContent),
        label_guess: guessLabel(select),
        selector_hint: selectorHint(select),
        bounding_box: box(select)
      });
    }

    for (const element of Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"]'))) {
      if (seen.has(element)) {
        continue;
      }

      seen.add(element);
      answers.push({
        kind: "editable",
        value: textOf(element),
        label_guess: guessLabel(element),
        selector_hint: selectorHint(element),
        bounding_box: box(element)
      });
    }

    for (const element of Array.from(document.querySelectorAll('[aria-checked="true"], [aria-selected="true"]'))) {
      if (seen.has(element)) {
        continue;
      }

      answers.push({
        kind: "aria-selected",
        text: textOf(element),
        ariaLabel: element.getAttribute("aria-label") || "",
        label_guess: guessLabel(element),
        selector_hint: selectorHint(element),
        bounding_box: box(element)
      });
    }

    return answers;
  }

  function extractImages() {
    const images = [];

    for (const image of Array.from(document.querySelectorAll("img"))) {
      images.push({
        kind: "img",
        src: image.currentSrc || image.src,
        current_src: image.currentSrc || "",
        alt: image.alt || "",
        width: image.naturalWidth,
        height: image.naturalHeight,
        natural_width: image.naturalWidth,
        natural_height: image.naturalHeight,
        bounding_box: box(image)
      });
    }

    for (const source of Array.from(document.querySelectorAll<HTMLSourceElement>("picture source"))) {
      images.push({
        kind: "picture-source",
        srcset: source.srcset || source.getAttribute("srcset") || "",
        bounding_box: box(source.closest("picture") ?? source)
      });
    }

    for (const svg of Array.from(document.querySelectorAll("svg"))) {
      images.push({
        kind: "svg",
        text: textOf(svg),
        outer_html: svg.outerHTML.slice(0, MAX_INLINE_SVG_LENGTH),
        bounding_box: box(svg)
      });
    }

    for (const canvas of Array.from(document.querySelectorAll("canvas"))) {
      images.push({
        kind: "canvas",
        width: canvas.width,
        height: canvas.height,
        bounding_box: box(canvas),
        note: "Use page screenshot as visual backup for canvas content."
      });
    }

    for (const element of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const backgroundImage = getComputedStyle(element).backgroundImage || element.style.backgroundImage || "";
      if (!backgroundImage || backgroundImage === "none") {
        continue;
      }

      for (const match of Array.from(backgroundImage.matchAll(/url\((['"]?)(.*?)\1\)/g))) {
        if (!match[2]) {
          continue;
        }

        images.push({
          kind: "css-background",
          src: match[2],
          alt: normalizeSpace(element.getAttribute("aria-label") || element.getAttribute("title")),
          bounding_box: box(element)
        });
      }
    }

    for (const iframe of Array.from(document.querySelectorAll("iframe"))) {
      images.push({
        kind: "iframe",
        src: iframe.src,
        title: iframe.title,
        bounding_box: box(iframe)
      });
    }

    for (const embed of Array.from(document.querySelectorAll("embed"))) {
      images.push({
        kind: "embed",
        src: embed.src,
        bounding_box: box(embed)
      });
    }

    for (const video of Array.from(document.querySelectorAll("video"))) {
      images.push({
        kind: "video",
        src: video.currentSrc || video.src,
        poster: video.poster,
        width: video.videoWidth,
        height: video.videoHeight,
        bounding_box: box(video)
      });
    }

    return images;
  }

  function extractLinks() {
    return Array.from(document.querySelectorAll<HTMLAnchorElement | HTMLAreaElement>("a[href], area[href]")).map(
      (link) => ({
        href: link.href,
        text: textOf(link),
        aria_label: normalizeSpace(link.getAttribute("aria-label")),
        title: normalizeSpace(link.getAttribute("title")),
        rel: link.getAttribute("rel") || "",
        target: link.getAttribute("target") || "",
        bounding_box: box(link)
      })
    );
  }

  const rawHtml = document.documentElement.outerHTML;

  return {
    schema_version: "0.1",
    source: "formative-ui",
    page_index: 0,
    title: document.title || "Formative Practice",
    url: location.href,
    captured_at: new Date().toISOString(),
    text: {
      visible_text: visibleTextFromBody(),
      headings: unique(Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map(textOf)),
      buttons: unique(
        Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')).map(
          buttonText
        )
      ),
      aria_labels: unique(
        Array.from(document.querySelectorAll("[aria-label]")).map((element) =>
          normalizeSpace(element.getAttribute("aria-label"))
        )
      ),
      alt_texts: unique(
        Array.from(document.querySelectorAll("[alt]")).map((element) => normalizeSpace(element.getAttribute("alt")))
      ),
      math_texts: unique(Array.from(document.querySelectorAll(".MathJax, .katex, [data-mathml], math")).map(textOf))
    },
    answers: extractAnswers(),
    images: extractImages(),
    links: extractLinks(),
    visual_backup: {
      screenshot_path: "screenshot.png"
    },
    raw_html: rawHtml.slice(0, MAX_RAW_HTML_LENGTH),
    raw_html_truncated: rawHtml.length > MAX_RAW_HTML_LENGTH
  };
}

function clickNextInPage(): ClickNextResult {
  const nextPatterns = [/^next$/i, /continue/i, /next question/i, /next page/i, /forward/i];
  const stopPatterns = [/submit/i, /turn in/i, /finish/i, /^done$/i, /complete/i];

  function normalizeSpace(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").trim();
  }

  function textOf(element: Element): string {
    const htmlElement = element as HTMLElement;
    return normalizeSpace(htmlElement.innerText || element.textContent || "");
  }

  function labelFor(element: HTMLElement): string {
    if (element instanceof HTMLInputElement) {
      return normalizeSpace(element.value || element.getAttribute("aria-label") || element.title);
    }

    return normalizeSpace(element.getAttribute("aria-label") || element.getAttribute("title") || textOf(element));
  }

  function isActionable(element: HTMLElement): boolean {
    const disabled =
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      (element instanceof HTMLButtonElement && element.disabled) ||
      (element instanceof HTMLInputElement && element.disabled);

    return !disabled && Boolean(labelFor(element));
  }

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="button"], a[href], input[type="button"], input[type="submit"]')
  ).filter(isActionable);

  for (const candidate of candidates) {
    const label = labelFor(candidate);
    if (stopPatterns.some((pattern) => pattern.test(label))) {
      return {
        clicked: false,
        reason: "stop_button",
        label
      };
    }
  }

  const next = candidates.find((candidate) => nextPatterns.some((pattern) => pattern.test(labelFor(candidate))));
  if (!next) {
    return {
      clicked: false,
      reason: "no_next_button"
    };
  }

  const label = labelFor(next);
  next.scrollIntoView({ block: "center", inline: "center" });
  next.click();

  return {
    clicked: true,
    label
  };
}
