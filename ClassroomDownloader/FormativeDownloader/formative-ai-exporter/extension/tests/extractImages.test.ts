import { beforeEach, describe, expect, it } from "vitest";
import { extractImages } from "../src/lib/capture/extractImages";

describe("extractImages", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("handles img, svg, canvas metadata, and background-image URLs", () => {
    document.body.innerHTML = `
      <img id="diagram" src="https://example.test/diagram.png" alt="diagram" />
      <picture>
        <source srcset="https://example.test/small.png 1x, https://example.test/large.png 2x" />
        <img src="https://example.test/fallback.png" alt="fallback" />
      </picture>
      <svg><title>Graph</title><circle cx="5" cy="5" r="5"></circle></svg>
      <canvas id="drawing" width="320" height="180"></canvas>
      <div style="background-image: url('https://example.test/background.png')" aria-label="background diagram"></div>
    `;

    Object.defineProperty(document.querySelector("#diagram"), "naturalWidth", { value: 640 });
    Object.defineProperty(document.querySelector("#diagram"), "naturalHeight", { value: 320 });

    const images = extractImages(document);

    expect(images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "img",
          src: "https://example.test/diagram.png",
          alt: "diagram",
          width: 640,
          height: 320
        }),
        expect.objectContaining({
          kind: "picture-source",
          srcset: "https://example.test/small.png 1x, https://example.test/large.png 2x"
        }),
        expect.objectContaining({ kind: "svg", outer_html: expect.stringContaining("<svg") }),
        expect.objectContaining({ kind: "canvas", width: 320, height: 180 }),
        expect.objectContaining({
          kind: "css-background",
          src: "https://example.test/background.png",
          alt: "background diagram"
        })
      ])
    );
  });
});
