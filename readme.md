# MIDI to Printable Piano Roll

![Piano roll example](misc/preview@2x.png)

A tool that converts MIDI files into printable piano rolls. Primarily intended for people who prefer piano rolls found in DAWs over sheet music.

Just drop your local MIDI files, tweak some knobs and print.

## Live app
### https://bladeSk.github.io/midi-to-piano-roll

## Issues

If you have a MIDI file that doesn't display correctly, feel free to create an issue and attach it. Notes not mapping to bars correctly are most likely an issue with the file itself and should be easily correctable by tweaking the MIDI tempo field.

## Local usage

Clone this repo, run `npm i` or `yarn` and open `index.html` in your browser.

## Usage as a Node.js library

`npm i https://github.com/bladeSk/midi-to-piano-roll`

```
const fs = require('fs')
const PianoRollSvg = require('midi-to-piano-roll')

let midi = fs.readFileSync('test.mid', { encoding: 'base64' })
let prSvg = new PianoRollSvg(midi)

// get all the available config options here: PianoRollSvg.getDefaultConfig()
let svg = prSvg.render({
	tracksToRender: { 0: true, 2: true, 3: true },
})

fs.writeFileSync('test.svg', svg)
```
