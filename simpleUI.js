(() => {
	let pianoRollSvg
	let config
	let controls = document.querySelector('#controls')

	function loadMIDI(midiB64, filename, _config) {
		config = _config

		document.title = filename + ' - Printable Piano Roll'

		controls.innerHTML = ''

		let title = document.createElement('h2')
		title.textContent = filename
		controls.appendChild(title)

		pianoRollSvg = new PianoRollSvg(midiB64)

		renderTrackControls()
		renderSVGControls()
		renderActions()

		// editable song title
		document.querySelector('#result > .resultHeading').textContent = config.title
		document.querySelector('#result > .resultHeading').addEventListener('input', function (e) {
			config.title = this.textContent
			sessionStorage['config'] = JSON.stringify(config)
		})

		updateSVG()
	}

	function renderTrackControls() {
		let tracks = document.createElement('div')
		tracks.className = 'tracks'
		tracks.innerHTML = '<div class="tracks__shroud"></div><div class="tracks__shroud"></div>'
		controls.appendChild(tracks)

		const updateConfigTransposeOnKeyUp = function(trkIndex, e) {
			let val = this.value ? parseInt(this.value) : 0
			if (isNaN(val)) return

			if (!config.trackOptions[trkIndex]) config.trackOptions[trkIndex] = {}

			config.trackOptions[trkIndex].transpose = Math.max(-96, Math.min(96, val))

			updateDebounced()
		}

		let trkHeader = document.createElement('div')
		trkHeader.className = 'trackRow trackRow_header'
		trkHeader.innerHTML = 
			'<span class="trackRow__name">Track</span>'+
			'<span class="trackRow__transpose">Transpose</span>'+
			'<span class="trackRow__style">Style</span>'
		tracks.appendChild(trkHeader)

		const styleOptions = `<option value="normal">Normal</option><option value="leftHanded">Left hand</option>`

		pianoRollSvg.getSong().tracks.forEach((trk, i) => {
			let trkRow = document.createElement('div')
			trkRow.className = 'trackRow'
			trkRow.innerHTML = 
				'<label class="trackRow__name"><input type="checkbox"/><span></span></label>'+
				'<input type="text" class="trackRow__transpose" placeholder="0" />'+
				`<select class="trackRow__style">${styleOptions}</select>`+
				'<span class="trackRow__preview"></span>'
			trkRow.querySelector('.trackRow__name > span').textContent = `${trk.title} - ${trk.notes.length}♪`
			trkRow.querySelector('.trackRow__name > input').checked = !!config.tracksToRender[i]
			trkRow.querySelector('.trackRow__preview').innerHTML = pianoRollSvg.renderTrackPreview(trk)
			let transposeInput = trkRow.querySelector('.trackRow__transpose')
			transposeInput.value = config.trackOptions[i]?.transpose || ''
			transposeInput.addEventListener('keyup', updateConfigTransposeOnKeyUp.bind(transposeInput, i))
			tracks.appendChild(trkRow)

			trkRow.querySelector('.trackRow__name > input').addEventListener('change', function(e) {
				config.tracksToRender[i] = this.checked
				updateSVG()
			})

			let styleSelect = trkRow.querySelector('.trackRow__style')
			styleSelect.value = config.trackOptions[i]?.style == 'leftHanded' ? 'leftHanded' : 'normal'
			styleSelect.addEventListener('change', function(e) {
				if (!config.trackOptions[i]) config.trackOptions[i] = {}
				config.trackOptions[i].style = this.value
				updateSVG()
			})
		})
	}

	function renderSVGControls() {
		const updateConfigNumberOnKeyUp = function(cfgId, e) {
			let val = parseInt(this.value)
			if (isNaN(val)) return
			config[cfgId] = val
			updateDebounced()
		}

		const updateConfigNullableNumberOnKeyUp = function(cfgId, e) {
			let val = this.value ? parseInt(this.value) : null
			if (isNaN(val)) return
			config[cfgId] = val
			updateDebounced()
		}

		let cfg = document.createElement('div')
		cfg.className = 'cfg'
		cfg.innerHTML = '<div>'+
			'<label>Style <select class="cfg__style"><option value="staggered">Staggered - like piano keys</option><option value="grid">Grid - like DAW</option></select></label>'+
			'<label>Line height <input type="text" class="cfg__lineHeight"/></label>'+
			'<label>Row spacing <input type="text" class="cfg__rowSpacing"/></label>'+
			'<label>Width <input type="text" class="cfg__width"/> px</label>'+
			'</div><div>'+
			'<label>Bars per row <input type="text" class="cfg__barsPerRow"/></label>'+
			'<label>Bar subdivisions <input type="text" class="cfg__barSubdivisions"/></label>'+
			'<label>MIDI tempo <input type="text" class="cfg__timeDivision"/></label>'+
			'<label>Hide notes shorter than <input type="text" class="cfg__removeShorterThan"/> ticks</label>'+
			'</div><div>'+
			'<label>Skip <input type="text" class="cfg__trimStart" placeholder="0"/> bars</label>'+
			'<label>End at bar #<input type="text" class="cfg__trimEnd"/></label>'+
			'</div>'
		controls.appendChild(cfg)

		let ctrl

		for (let id of [ 'barsPerRow', 'barSubdivisions', 'width', 'lineHeight', 'rowSpacing' ]) {
			ctrl = cfg.querySelector(`.cfg__${id}`)
			ctrl.value = config[id]
			ctrl.addEventListener('keyup', updateConfigNumberOnKeyUp.bind(ctrl, id))
		}

		for (let id of [ 'trimStart', 'trimEnd', 'timeDivision', 'removeShorterThan' ]) {
			ctrl = cfg.querySelector(`.cfg__${id}`)
			ctrl.value = config[id]
			ctrl.addEventListener('keyup', updateConfigNullableNumberOnKeyUp.bind(ctrl, id))
		}

		let song = pianoRollSvg.getSong()
		cfg.querySelector(`.cfg__trimEnd`).placeholder = Math.ceil(song.duration / (song.timeDivision * config.barSubdivisions))
		cfg.querySelector(`.cfg__timeDivision`).placeholder = song.timeDivision

		ctrl = cfg.querySelector(`.cfg__style`)
		ctrl.value = config.staggered ? 'staggered' : 'grid'
		ctrl.addEventListener('change', function(e) {
			config.staggered = this.value == 'staggered'
			updateSVG()
		})
	}

	function renderActions() {
		let actions = document.createElement('div')
		actions.className = 'actions'
		actions.innerHTML = '<div class="cfg__actions">'+
			'<button class="actions__print">🖨️ Print piano roll</button><button class="actions__download">📥 Download SVG</button>'+
			'</div>'
		controls.appendChild(actions)

		actions.querySelector('.actions__print').addEventListener('click', (e) => {
			window.print()
			e.preventDefault()
		})

		actions.querySelector('.actions__download').addEventListener('click', (e) => {
		    let a = document.createElement('a')
			a.setAttribute('href', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pianoRollSvg.render({
				...config,
				splitSVGs: false,
			})))
			a.setAttribute('download', config.title)

			let event = document.createEvent('MouseEvents')
			event.initEvent('click', true, true)
			a.dispatchEvent(event)

			e.preventDefault()
		})
	}

	function updateSVG() {
		document.querySelector('#result > .resultSvg').innerHTML = pianoRollSvg.render(config)
		updateShroud()
		sessionStorage['config'] = JSON.stringify(config)
	}

	function updateShroud() {
		let shroudElms = controls.querySelectorAll('.tracks__shroud')
		
		let x0 = controls.querySelector('.trackRow__preview').offsetLeft
		let trackWidth = controls.querySelector('.trackRow__preview').clientWidth

		let song = pianoRollSvg.getSong()
		let timeDiv = (config.timeDivision || song.timeDivision) * config.barSubdivisions
		let barWidth = trackWidth / (song.duration / timeDiv)

		if (config.trimStart) {
			shroudElms[0].style.left = `${x0}px`
			shroudElms[0].style.width = `${config.trimStart * barWidth}px`
			shroudElms[0].style.display = 'block'
		} else {
			shroudElms[0].style.display = 'none'
		}

		if (config.trimEnd) {
			shroudElms[1].style.right = 0
			shroudElms[1].style.left = `${x0 + config.trimEnd * barWidth}px`
			shroudElms[1].style.display = 'block'
		} else {
			shroudElms[1].style.display = 'none'
		}
	}

	let updateTimer

	function updateDebounced() {
		updateTimer && clearTimeout(updateTimer)

		updateTimer = setTimeout(() => {
			updateSVG()
			updateTimer = null
		}, 500)
	}

	function getBase64FromFile(file) {
		return new Promise((res, rej) => {
			let reader = new FileReader()
			reader.readAsBinaryString(file)
			reader.onload = () => res(btoa(reader.result))
			reader.onerror = rej
		})
	}

	window.addEventListener('resize', () => {
		updateShroud()
	})

	document.querySelector('#filePicker').addEventListener('change', function(e) {
		getBase64FromFile(this.files[0]).then((base64) => {
			sessionStorage['filename'] = this.files[0].name
			sessionStorage['midiB64'] = base64
			sessionStorage['config'] = JSON.stringify({
				title: this.files[0].name.replace(/\.[^\.]*?$/, '').replace(/_/g, ' '),
				...PianoRollSvg.getDefaultConfig(),
				splitSVGs: true,
			})
			this.value = null
			loadMIDI(sessionStorage['midiB64'], sessionStorage['filename'], JSON.parse(sessionStorage['config']))
		}).catch(err => {
			alert('Unable to load file')
			console.error(err)
		})
	})

	if (sessionStorage['midiB64']) {
		loadMIDI(sessionStorage['midiB64'], sessionStorage['filename'], JSON.parse(sessionStorage['config']))
	}

	window.loadMIDI = loadMIDI
})()