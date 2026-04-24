# Smoke Test Report

Use this report for the required real Formative smoke before Chrome Web Store submission.

## Build Under Test

Extension version:

```txt
0.1.0
```

Commit SHA:

```txt
<commit-sha-used-for-smoke>
```

ZIP path:

```txt
extension/.output/formative-ai-exporter-extension-0.1.0-chrome.zip
```

ZIP SHA256:

```txt
<output of: shasum -a 256 extension/.output/formative-ai-exporter-extension-0.1.0-chrome.zip>
```

Browser/version:

```txt
<Chrome or Chromium version>
```

OS:

```txt
<OS and version>
```

## Practice Under Test

Formative practice type:

```txt
<student practice / assignment / quiz / other>
```

Practice length:

```txt
<number of pages/questions captured>
```

Question/response types observed:

```txt
<multiple choice / short response / images / drawing / graphing / other>
```

## Capture Current Page

Result:

```txt
<pass/fail>
```

Downloaded ZIP:

```txt
<download filename or path>
```

Verified contents:

- [ ] `FormativeAIExport/manifest.json`
- [ ] `FormativeAIExport/practice.md`
- [ ] `FormativeAIExport/practice.json`
- [ ] `FormativeAIExport/pages/page_001/page.json`
- [ ] `FormativeAIExport/pages/page_001/page.md`
- [ ] `FormativeAIExport/pages/page_001/visible_text.txt`
- [ ] `FormativeAIExport/pages/page_001/answers.json`
- [ ] `FormativeAIExport/pages/page_001/images.jsonl`
- [ ] `FormativeAIExport/pages/page_001/links.jsonl`
- [ ] `FormativeAIExport/pages/page_001/screenshot.png`
- [ ] `FormativeAIExport/pages/page_001/raw.html`

Notes:

```txt
<text, answers, image/link metadata, screenshot quality, or failure notes>
```

## Capture Whole Practice

Result:

```txt
<pass/fail>
```

Captured page count:

```txt
<page count>
```

Stop reason shown/exported:

```txt
<stop reason>
```

Screenshots present for each page:

```txt
<yes/no>
```

Answers unchanged after capture:

```txt
<yes/no>
```

Stop-before-submit verified:

```txt
<yes/no>
```

No Submit/Finish/Turn In/Done/Complete action clicked:

```txt
<yes/no>
```

Notes:

```txt
<page-walk behavior, missing content, visual fallback notes, or failure notes>
```

## Failures Or Evidence

Failures:

```txt
<none or list failure details>
```

Screenshots or recordings:

```txt
<paths or links to evidence, if any>
```

Final smoke decision:

```txt
<approved for unlisted/deferred submission | blocked>
```
