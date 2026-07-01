# Release checklist

Manual verification matrix before publishing a release. Run each cell against a
demo app that holds one field of every supported type plus a subtable and
process-management fields.

## Browser x screen matrix

| Case | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Detail: copy each of the 3 formats | | | | |
| List (`list` view): copy each of the 3 formats | | | | |
| List (`custom` view): button appears and copies | | | | |
| List: filtered and sorted result matches output order | | | | |
| List: record cap reached shows the "先頭N件" toast | | | | |
| Settings: create, edit, reorder, delete profiles | | | | |

## Targeted cases (TC-41 to TC-46)

- TC-41 (Safari): copy 600 records to a Markdown table. Route A must write
  without a `NotAllowedError` after the cursor fetch.
- TC-42 (kintone mobile app, iOS and Android): copy the 3 formats on the detail
  screen and paste into a notes app. The list screen shows no button.
- TC-43: paste each format into Slack, Notion, a GitHub issue, and Excel. Tables
  render in Notion and GitHub, the bullet list renders in Slack, TSV lands in
  spreadsheet cells. Slack not rendering the table is expected.
- TC-44: open a calendar view. No button appears.
- TC-45: start a list copy of 5000 records, then navigate to a detail screen
  mid-fetch. No error appears and the clipboard is unchanged.
- TC-46 (detail): using only the keyboard, Tab to the button, Enter to open the
  menu, Arrow keys to move, Enter to copy. The full path works.

## Pre-publish

- Screenshots taken on an English demo environment with no real names.
- `private.ppk` kept out of the commit.
- README limitations reflect the shipped build.
