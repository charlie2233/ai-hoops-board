import type { LinkRecord } from "../archive/schema";
import { getBoundingBox, normalizeSpace, textOf } from "./domUtils";

export function extractLinks(root: ParentNode = document): LinkRecord[] {
  return Array.from(root.querySelectorAll<HTMLAnchorElement | HTMLAreaElement>("a[href], area[href]")).map(
    (link) => ({
      href: link.href,
      text: textOf(link),
      aria_label: normalizeSpace(link.getAttribute("aria-label")),
      title: normalizeSpace(link.getAttribute("title")),
      rel: link.getAttribute("rel") || "",
      target: link.getAttribute("target") || "",
      bounding_box: getBoundingBox(link)
    })
  );
}
