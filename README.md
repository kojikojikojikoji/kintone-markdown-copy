# kintone-markdown-copy

Copy a kintone record or a list view to the clipboard as a Markdown table, a
Markdown bullet list, or TSV. Paste the result into Slack, Notion, GitHub, or a
spreadsheet without reformatting each field by hand.

The plugin adds a "コピー" button to the header of the record detail screen and
the list screen. Click it, pick a format, and the text is on your clipboard. All
work happens in the browser and through the kintone REST API. The plugin makes
no request to any other server.

## What it does

- Adds a copy button with a dropdown of three formats: Markdown table
  (`Markdown表`), Markdown bullet list (`Markdown箇条書き`), and TSV.
- On the detail screen, copies the field values shown in `event.record`.
- On the list screen, fetches every record that matches the current filter and
  sort (up to a configurable cap) and copies them as rows.
- Lets an administrator define up to 10 profiles. A profile is a set of fields,
  their order, the target screen, and format options such as the date-time
  pattern and the empty-value text.
- Converts each field type to text with type-specific rules (see below), then
  escapes the text for the chosen format.

## Supported screens

| Screen | Desktop | Mobile |
|---|---|---|
| Record detail | Yes | Yes |
| Record list (`list` and `custom` views) | Yes | No |
| Calendar view | No button | No button |

The mobile list screen is not supported. Mobile browsers only allow a clipboard
write in the same user gesture, and a list copy fetches records first, which
forces a two-step confirmation on every browser. See "Limitations".

## Field type handling

Each field is turned into text before escaping:

- Text (single and multi line): the value as is.
- Rich text: a small HTML-to-Markdown conversion. Supported tags: `strong`/`b`,
  `em`/`i`, `a`, `ul`/`ol`/`li`, `br`, `p`/`div`, `img` (alt text). Other tags
  are dropped and their text kept.
- Number and numeric calc fields: the value, with an optional thousands
  separator. The field unit is not added.
- Date, time, datetime, created/updated time: formatted per the profile's
  date-time option. Datetime values are converted to the login user's time zone.
- Dropdown, radio, checkbox, multi-select, category: the selected value or
  values joined with a comma.
- User, organization, group, assignee, creator, modifier: the display names.
- Link: the value as is (not wrapped in `[text](url)`).
- Attachment: the file names joined with a comma. File contents are not copied.
- Subtable: on the detail screen, printed as a separate block after the body.
  On the list screen, printed as `(N行)`.

## Where to paste each format

- Markdown table: Notion, GitHub, and other Markdown editors that render tables.
- Markdown bullet list: Slack, Notion, GitHub. Use this for Slack, which does
  not render Markdown tables.
- TSV: Excel, Google Sheets, and other spreadsheets. Numbers paste as numbers
  when the thousands separator is off.

## Install

1. Build the plugin zip:
   ```
   npm install
   npm run build
   npm run pack
   ```
   The first `pack` run creates `private.ppk` and `kintone-markdown-copy.zip`.
   Keep `private.ppk` to keep the plugin id stable across rebuilds. Do not commit
   it.
2. In kintone, open the app settings, go to plugins, and upload
   `kintone-markdown-copy.zip`.

## Configure

Open the plugin settings from the app's plugin list.

1. Create one or more profiles. For each profile, set the name, the target
   screen (detail, list, or both), and the fields to output in order.
2. Set the date-time format, the thousands separator, and the empty-value text
   per profile.
3. Set the "上限件数" (record cap) for list copy, from 1 to 5000. The default is
   500.
4. Choose the default profile.

A profile needs at least one field, and the app needs at least one profile. If a
saved field is later removed from the form, the settings screen reports it by
field code on save.

## Local storage

The plugin stores your last profile and format choice in `localStorage` under
the key `kp-mdcopy-<domain>-<appId>-<userCode>`. This is used to restore the
dropdown selection on your next visit. It holds no record data. To clear it,
remove that key from your browser's storage for the kintone domain.

## Limitations

- Mobile list copy is not supported (see "Supported screens").
- Only `text/plain` is written to the clipboard. No `text/html` flavor.
- Slack does not render Markdown tables. Use the bullet list or TSV for Slack.
- Related-records, labels, borders, spacers, and group frames are not output.
- Attachment and image contents are not copied, only file names.
- Rich text conversion covers the tags listed above. Tables, headings, and text
  color inside rich text are not reproduced.
- The list copy outputs the profile's fields, not the columns shown in the view.

## TODO

- `desktop.js` is about 232 KB before gzip (about 67 KB gzipped), over the
  200 KB before-gzip target in the spec. The size comes from
  `@kintone/rest-api-client`, which the shared spec requires. Revisit if a
  lighter REST path is allowed.
- Deleted-field notification for the record screen is logged to the console
  only; an admin-facing toast is not yet shown (`// TODO(spec FR-18)`).
- Subtable inner-column order follows the form properties order, not the form
  layout (`// TODO(spec FR-7)`).

## Development

```
npm install
npm run typecheck   # tsc --noEmit
npm run test        # vitest (core logic)
npm run build       # dist/desktop.js, dist/mobile.js, dist/config.js
npm run lint        # eslint
npm run pack        # build then package into a plugin zip
```

The `test/e2e` Playwright specs read the target from environment variables
(`KINTONE_BASE_URL`, `KINTONE_USERNAME`, `KINTONE_PASSWORD`, `KINTONE_APP_ID`).
They are not run in CI.

## License

MIT. See [LICENSE](./LICENSE).
