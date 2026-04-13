# NoComment

NoComment is a Chrome extension for hiding comment sections across the web.

## Rule Patterns

Use URL patterns to decide where comments should be blocked or allowed.

Examples:

- `www.youtube.com/*`
- `www.youtube.com/@theoryofficial`
- `www.youtube.com/channel/UCcFUPGt_tgcP5iMxiBDsXoA`
- `x.com/*/status/*`
- `www.reddit.com/r/news/*`

If a pattern does not include a protocol, NoComment treats it as matching both `http` and `https`.

## Development

1. Install dependencies with `npm install`
2. Build the extension with `npm run build`
3. Load the generated `dist/` folder in `chrome://extensions`

## Notes

- `Block comments everywhere except my Allow List` makes the Allow List act as exceptions.
- `Only block sites in my Block List` keeps comments visible unless a matching rule exists.
- `Collapse` removes the layout space; `Hidden` keeps the space but hides the content.

## License

MIT
