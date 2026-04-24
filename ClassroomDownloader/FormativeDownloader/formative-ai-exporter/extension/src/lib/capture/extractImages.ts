import type { ImageRecord } from "../archive/schema";
import { getBoundingBox, normalizeSpace, textOf } from "./domUtils";

const MAX_INLINE_SVG_LENGTH = 200_000;

export function extractImages(root: ParentNode = document): ImageRecord[] {
  const images: ImageRecord[] = [];

  for (const image of Array.from(root.querySelectorAll("img"))) {
    images.push({
      kind: "img",
      src: image.currentSrc || image.src,
      current_src: image.currentSrc || "",
      alt: image.alt || "",
      width: image.naturalWidth,
      height: image.naturalHeight,
      natural_width: image.naturalWidth,
      natural_height: image.naturalHeight,
      bounding_box: getBoundingBox(image)
    });
  }

  for (const source of Array.from(root.querySelectorAll<HTMLSourceElement>("picture source"))) {
    images.push({
      kind: "picture-source",
      srcset: source.srcset || source.getAttribute("srcset") || "",
      bounding_box: getBoundingBox(source.closest("picture") ?? source)
    });
  }

  for (const svg of Array.from(root.querySelectorAll("svg"))) {
    images.push({
      kind: "svg",
      text: textOf(svg),
      outer_html: svg.outerHTML.slice(0, MAX_INLINE_SVG_LENGTH),
      bounding_box: getBoundingBox(svg)
    });
  }

  for (const canvas of Array.from(root.querySelectorAll("canvas"))) {
    images.push({
      kind: "canvas",
      width: canvas.width,
      height: canvas.height,
      bounding_box: getBoundingBox(canvas),
      note: "Use page screenshot as visual backup for canvas content."
    });
  }

  for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    for (const src of extractBackgroundUrls(element)) {
      images.push({
        kind: "css-background",
        src,
        alt: normalizeSpace(element.getAttribute("aria-label") || element.getAttribute("title")),
        bounding_box: getBoundingBox(element)
      });
    }
  }

  for (const iframe of Array.from(root.querySelectorAll("iframe"))) {
    images.push({
      kind: "iframe",
      src: iframe.src,
      title: iframe.title,
      bounding_box: getBoundingBox(iframe)
    });
  }

  for (const embed of Array.from(root.querySelectorAll("embed"))) {
    images.push({
      kind: "embed",
      src: embed.src,
      bounding_box: getBoundingBox(embed)
    });
  }

  for (const video of Array.from(root.querySelectorAll("video"))) {
    images.push({
      kind: "video",
      src: video.currentSrc || video.src,
      poster: video.poster,
      width: video.videoWidth,
      height: video.videoHeight,
      bounding_box: getBoundingBox(video)
    });
  }

  return images;
}

function extractBackgroundUrls(element: HTMLElement): string[] {
  const backgroundImage =
    globalThis.getComputedStyle?.(element).backgroundImage || element.style.backgroundImage || "";

  if (!backgroundImage || backgroundImage === "none") {
    return [];
  }

  return Array.from(backgroundImage.matchAll(/url\((['"]?)(.*?)\1\)/g))
    .map((match) => match[2])
    .filter(Boolean);
}
