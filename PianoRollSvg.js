(function(){
	const blackKeys = { 1: !0, 3: !0, 6: !0, 8: !0, 10: !0 }
	const fullSteps = { 0: !0, 5: !0 }
	const styles = `
		<style>
			svg { background-color: #fff; }
			.line { stroke: #eee; stroke-width: 1px; }
			.line_verse { stroke: #bbb; }
			.line_C { stroke: #333; stroke-width: 2px }
			.line_F { stroke: #333; }
			.line_blackKey { stroke: #ddd; }
			.note { fill: #fff; stroke: #000; }
			.note_black { fill: #666; }
			.note_staggered { fill-opacity: 0.6; }
			.note_black_staggered { fill: #000; fill-opacity: 0.5; }
			.blackRow { fill: #ddd; }
			.blackRow_lower { fill: #bbb; }
			.octaveText { font-weight: bold; font-size: 24px; font-family: 'Helvetica Neue', Helvetica, sans-serif; fill: #aaa; }
		</style>\n`

	const midiParser = typeof require != 'undefined' ? require('midi-parser-js') : MidiParser

	/**
	 * Generates a customizable SVG piano roll from a base64 MIDI file.
	 */
	class PianoRollSvg {
		_song;
		_totalBars;
		_config;

		constructor(base64midi) {
			this._song = PianoRollSvg.convertMidiToSong(base64midi)
		}

		getSong() {
			return this._song
		}

		static getDefaultConfig() {
			return {
				barsPerRow: 4,
				barSubdivisions: 4,
				width: 960,
				lineHeight: 10,
				rowSpacing: 48,
				tracksToRender: { 0: true },
				transposeTracks: {},
				staggered: true,
				splitSVGs: false,
				trimStart: null,
				trimEnd: null,
				timeDivision: null,
				removeShorterThan: 4,
			}
		}

		get _barDuration() {
			return (this._config.timeDivision || this._song.timeDivision) * this._config.barSubdivisions
		}

		/**
		 * @returns a SVG preview of a single MIDI track (`pianoRoll.getSong().tracks[x]`)
		 */
		renderTrackPreview(track) {
			let notes = track.notes
			let lowestNote = Math.max(track.minNote - 1, 0)
			let highestNote = Math.max(lowestNote + 12, Math.min(track.maxNote + 1, 127))
			let duration = this._song.duration
			let range = highestNote - lowestNote

			let svg = elm(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${range}" height="${range * 2}" preserveAspectRatio="none" class="previewRoll">`
			)

			let barsSvg = g(0, 0, 'previewRoll__bars')
			svg.push(barsSvg)

			for (let i = 0; i < duration; i += this._song.timeDivision) {
				barsSvg.push(`<path d="M${i / duration * 100} 0 v${range}" />`)
			}

			for (let note of notes) {
				let width = Math.max(0.1, note.duration / duration * 100)
				let x = note.time / duration * 100
				let y = highestNote - note.note
				svg.push(`<rect class="previewRoll__note" width="${width}" height="1" transform="translate(${x} ${y})"/>`)
			}

			return svg.toString()
		}

		/**
		 * @returns a SVG of the loaded MIDI file
		 */
		render(config = {}) {
			this._config = { ...PianoRollSvg.getDefaultConfig(), ...config }

			let width = this._config.width + 1

			let [ children, height ] = this._renderContent()

			if (this._config.splitSVGs) {
				let style = children[0]
				let output = []

				for (let row of children.slice(1)) {
					let rowHeight = row.openingTag.match(/data-height="(.*?)"/)[1] * 1 + 1
					row.openingTag = row.openingTag.replace(/transform=".*?"/, '')
					
					let svg = elm(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rowHeight}" width="${width}" class="pianoRoll" style="margin-bottom: ${config.rowSpacing}px">`)
					svg.push(style)
					svg.push(row)

					output.push(svg.toString())
				}

				return output.join('\n')
			} else {
				let svg = elm(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" class="pianoRoll">`)
				svg.children = children
				return svg.toString()
			}

		}

		_renderContent() {
			let content = []
			content.push(styles)

			let rows = this._sliceTrackToRows(this._trimTrack(this._getMergedTracks()))
			let rowDuration = this._barDuration * this._config.barsPerRow
			let curY = 0
			let cfg = this._config
			let lh2 = cfg.lineHeight / 2
			let lh4 = cfg.lineHeight / 4
			let timeDiv = cfg.timeDivision || this._song.timeDivision

			for (let row of rows) {
				let minNote = Math.max(Math.floor(row.minNote / 12) * 12, Math.floor((row.minNote - 5) / 12) * 12 + 5) // snap to C or F in the octave
				let maxNote = row.maxNote - minNote < 11 ? minNote + 11 : row.maxNote
				let height = this._getYBottom(minNote, maxNote)
				let group = g(0, curY, 'row')
				group.openingTag = group.openingTag.slice(0, -1) + ` data-height="${height}">`
				content.push(group)

				// vertical/bar lines
				for (let i = 0; i <= rowDuration; i += timeDiv) {
					let x = i / rowDuration * cfg.width + 0.5
					let classes = [ 'line', (i / timeDiv) % this._config.barSubdivisions == 0 && 'line_verse' ].filter(Boolean).join(' ')
					group.push(`<line class="${classes}" x1="${x}" y1="0" x2="${x}" y2="${height}" />`)
				}

				// background stripes
				if (cfg.staggered) {
					for (let i = maxNote; i > minNote - 2; i--) {
						let y = this._getYTop(i, maxNote)

						if (blackKeys[i % 12]) {
							let classes = [ 'blackRow', (i % 12) < 4 && 'blackRow_lower' ].filter(Boolean).join(' ')
							// group.push(`<rect class="${classes}" x="1" y="${y + lh4}" width="${cfg.width - 1}" height="${lh2}" />`)
							group.push(`<line class="line line_blackKey" x1="0" y1="${y + lh2 + 0.5}" x2="${cfg.width}" y2="${y + lh2 + 0.5}" />`)
						}
					}
				} else {
					for (let i = minNote; i <= maxNote; i++) {
						if (!blackKeys[i % 12]) continue
						let classes = [ 'blackRow', (i % 12) < 4 && 'blackRow_lower' ].filter(Boolean).join(' ')
						group.push(`<rect class="${classes}" x="1" y="${this._getYTop(i, maxNote) + 0.5}" width="${cfg.width - 1}" height="${cfg.lineHeight}" />`)
					}
				}

				// labels
				for (let i = minNote; i < maxNote - 2; i++) {
					if (i % 12 != 0) continue

					group.push(`<text class="octaveText" x="${(cfg.width / 960) * 4}" y="${this._getYBottom(i, maxNote) - lh2}">` +
						`${Math.floor(i / 12) - 1}</text>`)
				}

				// horizontal guide lines
				for (let i = maxNote + 1; i >= minNote; i--) {
					if (i != maxNote + 1 && i % 12 != 0 && i % 12 != 5) continue
					
					let y = (i == maxNote + 1 )? 0 : this._getYBottom(i, maxNote) + 0.5

					if (i % 12 == 0) {
						group.push(`<line class="line line_C" x1="0" y1="${y}" x2="${cfg.width}" y2="${y}" />`)
					} else {
						group.push(`<line class="line line_F" x1="0" y1="${y}" x2="${cfg.width}" y2="${y}" />`)
					}
				}

				// notes
				for (let note of row.notes) {
					let isBlack = blackKeys[note.note % 12]
					let classes = [
						'note',
						isBlack && 'note_black',
						cfg.staggered && 'note_staggered',
						cfg.staggered && isBlack && 'note_black_staggered',
					].filter(Boolean).join(' ')

					group.push(
						`<rect class="${classes}" ` +
						`x="${note.time / rowDuration * cfg.width + 0.5}" ` +
						`y="${this._getYTop(note.note, maxNote) + 0.5 + (cfg.staggered ? 1 : 0)}" ` +
						`width="${note.duration / rowDuration * cfg.width}" ` +
						`height="${cfg.lineHeight - (cfg.staggered ? 2 : 0)}" />`
					)
				}

				curY += height + cfg.rowSpacing
			}

			return [ content, curY ]
		}

		_getYTop(note, maxNote) {
			if (note > maxNote) throw new Error('Not implemented')

			if (this._config.staggered) {
				let y = 0

				for (let i = maxNote; i > note; i--) y += fullSteps[i % 12] ? 1 : 0.5

				return y * this._config.lineHeight
			} else {
				return (maxNote - note) * this._config.lineHeight
			}
		}

		_getYBottom(note, maxNote) {
			return this._getYTop(note, maxNote) + this._config.lineHeight
		}

		/**
		 * Combines selected song tracks into a single track and transposes their notes (if applicable).
		 * @returns a single track
		 */
		_getMergedTracks() {
			let trkDict = this._config.tracksToRender
			let transposeDict = this._config.transposeTracks
			let notes = []
			let minNote = 127
			let maxNote = 0

			for (let i = 0; i < this._song.tracks.length; i++) {
				if (!trkDict[i]) continue

				if (transposeDict[i]) {
					let trans = transposeDict[i]

					for (let note of this._song.tracks[i].notes) {
						let newNote = {
							...note,
							note: note.note + trans,
						}

						minNote = Math.min(minNote, newNote.note)
						maxNote = Math.max(maxNote, newNote.note)

						notes.push(newNote)
					}
				} else {
					let trk = this._song.tracks[i]
					minNote = Math.min(minNote, trk.minNote)
					maxNote = Math.max(maxNote, trk.maxNote)

					notes = notes.concat(trk.notes)
				}
			}

			return {
				minNote,
				maxNote,
				notes,
			}
		}

		/**
		 * Discards notes outside of the specified trim range and shortens overlapping notes to fit
		 * within the trim range, note times are normalized to start at the first bar.
		 * @returns track with trimmed notes
		 */
		_trimTrack(track) {
			if (!this._config.trimStart && !this._config.trimEnd) return track

			let start = (this._config.trimStart || 0) * this._barDuration
			let end = Math.min(this._song.duration, (this._config.trimEnd ?? Infinity) * this._barDuration) - start

			let notes = []

			for (let note of track.notes) {
				let noteStart = Math.max(0, note.time - start)
				let noteEnd = Math.min(end - 1, note.time + note.duration - start)
				if (noteEnd - noteStart <= 0) continue

				notes.push({
					...note,
					time: noteStart,
					duration: noteEnd - noteStart,
				})
			}

			return {
				...track,
				notes,
			}
		}

		/**
		 * @returns rows with notes sliced to fit within a row and note times normalized to 0
		 */
		_sliceTrackToRows(track) {
			let rows = []
			let trkNotes = JSON.parse(JSON.stringify(track.notes))
			let rowDuration = this._barDuration * this._config.barsPerRow
			let trackStart = (this._config.trimStart || 0) * this._barDuration
			let trackDuration = Math.min(this._song.duration, (this._config.trimEnd ?? Infinity) * this._barDuration) - trackStart
			let minLen = Math.max(0, this._config.removeShorterThan ?? 0)

			for (let start = 0; start < trackDuration; start += rowDuration) {
				let end = start + rowDuration
				let notes = []
				let leftTrkNotes = []
				let minNote = 127
				let maxNote = 0

				for (let note of trkNotes) {
					let noteEnd = note.time + note.duration

					if (note.time >= start && noteEnd <= end) { // contained within the row
						notes.push({
							...note,
							time: note.time - start,
						})

						minNote = Math.min(minNote, note.note)
						maxNote = Math.max(maxNote, note.note)
					} else if (note.time >= start && note.time < end && noteEnd > end) { // sticks out of the row, needs to be split
						let splitNoteStart = {
							...note,
							time: note.time - start,
							duration: end - note.time,
						}

						let splitNoteEnd = {
							...note,
							time: end,
							duration: note.duration - splitNoteStart.duration,
						}

						if (splitNoteStart.duration > minLen) {
							notes.push(splitNoteStart)
							minNote = Math.min(minNote, note.note)
							maxNote = Math.max(maxNote, note.note)
						}
						
						leftTrkNotes.push(splitNoteEnd)
					} else { // outside of the row
						leftTrkNotes.push(note)
					}
				}

				if (minNote > maxNote) {
					minNote = 48
					maxNote = 48
				}

				trkNotes = leftTrkNotes

				rows.push({
					minNote,
					maxNote,
					notes,
				})
			}

			return rows
		}

		/**
		 * Converts raw midi file to a more useful intermediate format - a "song".
		 * A song contains named tracks. Tracks contain notes with a start time and a duration. All
		 * the other events are discarded, as well as the channel data.
		 */
		static convertMidiToSong(base64midi) {
			let midi = midiParser.parse(base64midi)

			midi.track.forEach((trk) => {
				let totalTime = 0
				trk.event.forEach((evt) => {
					totalTime += evt.deltaTime
					evt.time = totalTime
				})
			})

			// console.log(midi)
			let song = {
				timeDivision: midi.timeDivision,
				tracks: null,
				duration: 0,
			}

			let tracks
			let songDuration = midi.timeDivision

			if (midi.formatType == 0) { // 1 track split by channels
				tracks = new Array(16).fill(null).map((dummy, i) => ({ title: `Channel ${i}`, events: [] }))
				midi.track[0].event.forEach((evt) => {
					if (evt.channel === undefined) return
					tracks[evt.channel].events.push(evt)
				})
			} else if (midi.formatType > 0) {
				tracks = midi.track.map((trk, i) => ({
					title: trk.event.find(e => e.type == 255 && e.metaType == 3)?.data || `Track ${i + 1}`,
					events: trk.event,
				}))

				if (midi.formatType == 2) { // track 0 contains only metadata, discard
					tracks = tracks.slice(1)
				}
			}

			song.tracks = tracks.map((trk) => {
				let heldNotes = {}
				let minNote = 127
				let maxNote = 0

				let notes = trk.events.reduce((arr, ev) => {
					if (ev.type == 8 || (ev.type == 9 && ev.data[1] == 0)) { // note off
						if (heldNotes[ev.data[0]]) {
							let note = heldNotes[ev.data[0]]
							delete heldNotes[ev.data[0]]

							note.velOff = ev.data[1]
							note.duration = ev.time - note.time
							arr.push(note)

							songDuration = Math.max(songDuration, note.time + note.duration)
						}
					} else if (ev.type == 9) { // note on
						heldNotes[ev.data[0]] = {
							time: ev.time,
							note: ev.data[0],
							velOn: ev.data[1],
							velOff: 127,
							duration: 0,
						}

						minNote = Math.min(ev.data[0], minNote)
						maxNote = Math.max(ev.data[0], maxNote)
					}

					return arr
				}, [])

				return {
					title: trk.title,
					minNote,
					maxNote,
					notes,
				}
			}).filter(trk => trk.notes.length > 0)

			song.duration = songDuration

			return song
		}
	}


	/**
	 * Virtual XML/SVG node.
	 */
	class VirtualNode {
		constructor(openingTag, /* optional */closingTag) {
			this.openingTag = openingTag
			this.closingTag = closingTag
			this.children = []
		}

		push(virtualNodeOrText, insertAfterIndex) {
			if (!this.closingTag) throw new Error("Can't push node as a child of a self-closing node.")
			if (!(virtualNodeOrText instanceof VirtualNode)) {
				virtualNodeOrText = new VirtualNode(virtualNodeOrText)
			}

			if (insertAfterIndex === undefined) {
				this.children.push(virtualNodeOrText)
			} else {
				this.children.splice(insertAfterIndex, 0, virtualNodeOrText)
			}

			return virtualNodeOrText
		}

		toString(indent) {
			indent = indent || 0
			let out = 
				`${'  '.repeat(indent)} ${this.openingTag}\n` +
				this.children.map(c => c.toString(indent + 1)).join('') +
				(this.closingTag ? `${'  '.repeat(indent)} ${this.closingTag}\n` : '')
			return out
		}
	}

	/** Shorthand function - creates a VirtualNode and adds a closing tag, if necessary. */
	function elm(openingTag, /* optional */closingTag) {
		if (!closingTag) {
			let match = openingTag.match(/<([^ \>]+)/)
			if (!match) throw new Error('Unable to parse the opening tag.')
			closingTag = `</${match[1]}>`
		}

		return new VirtualNode(openingTag, closingTag)
	}

	function g(x, y, cls) {
		if (!x && !y) return new VirtualNode('<g' + (cls ? ` class="${cls}"` : '') + '>', '</g>')

		return new VirtualNode('<g' + (cls ? ` class="${cls}"` : '') + ` transform="translate(${x} ${y})">`, '</g>')
	}


	// ES module/browser export

	if (typeof module !== 'undefined') {
		module.exports = PianoRollSvg
	} else {
		let _global = typeof window === 'object' && window.self === window && window ||
			typeof self === 'object' && self.self === self && self ||
			typeof global === 'object' && global.global === global && global

		_global.PianoRollSvg = PianoRollSvg
	}
})()