# Lease Context Documents

Place your lease template and property information documents in this folder. The prospect AI agent reads every file here and uses the content to answer questions from people enquiring about renting a property.

## Supported file formats

| Format | Extension |
|--------|-----------|
| Plain text | `.txt` |
| Markdown | `.md` |
| PDF | `.pdf` |
| Word document | `.docx` |

## What to put here

- **Lease templates** — example AST agreements, Scotland PRTs, etc.
- **Property info sheets** — details about your properties, included appliances, utility arrangements, parking, pets policy, etc.
- **Application requirements** — what you expect from applicants (income multiples, reference requirements, ID needed, etc.).
- **Frequently asked questions** — common questions you receive about your properties.
- **House rules or welcome guides** — building rules, bin collection days, etc.

## Notes

- Files are loaded when the backend starts. Restart the backend after adding new documents.
- All files in this folder are concatenated and injected into the AI's system prompt.
- Keep individual files under ~100 KB for best results.
