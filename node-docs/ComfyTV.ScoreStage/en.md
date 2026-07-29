# Score

> Turn MusicXML into an engraved, playable sheet-music score you can pass down the music lane.

## What this node does

**Score** is the entry point of ComfyTV's symbolic-music lane. You give it a
MusicXML document — pasted into the node, typed in the built-in XML editor, or
wired in from a text source (for example an LLM Text stage) — and it parses,
validates and re-emits it as a clean score. The card renders the notation live
with an OSMD sheet-music engraver (zoom in/out, toggle the raw XML editor), so
you see the actual staves, not just text.

Press **▶ Run** to parse the score on the backend. Parsing is fast; the run
validates the MusicXML, computes a summary (time signature and total note
count, shown in the progress line) and forwards the raw MusicXML downstream as
the `score` output. If the XML is embedded in a larger blob, the node extracts
the `<score-partwise>` … `</score-partwise>` section automatically.

The output is a `COMFYTV_TEXT` payload carrying MusicXML. Feed it to **Score
Performer** (to add timing/feel and get MIDI) and then **Score Synth** (to
render audio).

## When to use it

- You have (or an LLM generated) MusicXML and want to see it engraved and drive
  the rest of the music chain from it.
- You want a single clean source of truth for a piece that several downstream
  stages (performer, synth) consume.
- You want to hand-edit MusicXML and preview the notation before committing.

## Parameters

### text (optional input)
An optional wired text input carrying MusicXML. When connected, it takes
priority over the pasted `musicxml` field, and the on-card XML editor is
disabled — the score comes from upstream (e.g. an LLM Text stage). Type:
`COMFYTV_TEXT`.

### musicxml (on-card XML editor)
The MusicXML document itself, edited in the node's collapsible XML text area.
Used when no `text` input is wired. Paste a full `<score-partwise>` document
here. If neither the input nor this field has content, the run fails with a
"Score needs MusicXML" message.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **score** | `COMFYTV_TEXT` | The validated MusicXML, ready for Score Performer or any music stage |

## Tips

- The engraver in the card is a preview; the run is what emits the score
  downstream. Nothing flows until you press ▶ Run.
- Pasting a document that has extra text around the XML is fine — the node
  trims everything outside the `<score-partwise>` element.
- The progress line reports the detected time signature and note total; use it
  as a quick sanity check that your XML parsed the way you expected.

## Related nodes

- **Score Editor** — draw a score in a piano roll instead of writing MusicXML by hand.
- **Score Performer** — add swing, humanization and instrument profiles, and get a MIDI file.
- **Score Synth** — render a performance to audio with a SoundFont.
- **Bridge** — convert to/from native ComfyUI types. See
  https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md
