# Color Scheme — CLI Snippet Manager (snip)

Goal: a modern, high-contrast palette that looks great in terminals and aligns with developer tooling aesthetics.

Primary colors
- Primary (purple): #6D28D9  (used for headings, snippet names)
- Accent (cyan): #06B6D4    (used for tags and interactive hints)
- Success (green): #10B981   (used for success messages and run outputs)
- Warning (amber): #F59E0B   (used for confirmations and cautions)
- Error (red): #EF4444       (used for errors)

Background / text
- Dark background: #0F172A
- Light text: #F8FAFC
- Muted text: #94A3B8

Terminal considerations
- Respect --no-color and TERM capability detection.
- Provide a monochrome-friendly mode.

Sample usage
- snip list: names in Primary, tags in Accent, usage stats in Muted text.
- snip run preview: snippet content in light text, warnings in Warning, success in Success.

