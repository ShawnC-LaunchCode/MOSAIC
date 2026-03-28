# MOSAIC – Missouri Options & Site Access Information Catalog

## Project purpose
MOSAIC is a statute-driven recreation guidance directory for St. Louis County and St. Charles County, Missouri.

The system helps identify recreation places that are:
- candidate
- needs-review
- likely-excluded

It is a guidance tool, not legal advice, and does not attempt to model individual supervision rules.

## Technical constraints
- TypeScript project
- Static public site
- JSON datasets
- GitHub Pages deployment
- Clear, maintainable code
- No unnecessary complexity

## Architecture
- Restricted source data is private build input
- Candidate source data is curated build input
- Classified output is an internal build artifact
- Public dataset is a slim frontend-safe output