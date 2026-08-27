/* A deterministic "whole base64 file" example value — the payload class the
   example-value modal exists for (an email attachment body). No spaces on
   purpose: the unbroken run is what breaks naive rendering. The sentinel
   proves a consumer holds the value to the very end. */
export const LONG_EXAMPLE_VALUE = `${'JVBERi0xLjcKJcTl8uXrp9Og0MTGCjQgMCBvYmoKPDwvRmlsdGVyL0ZsYXRlRGVjb2RlCg=='.repeat(
  90
)}THE_VERY_END`;
