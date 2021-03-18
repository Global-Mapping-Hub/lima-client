/** custom layer control */
class LayerControl {
	constructor(props) {
		this.block = document.getElementById('layer_control');
		this.activeLayer = {};
		this.toggleStates = {};

		// layers
		this.map = props.map;
		this.baseLayers = props.baseLayers;
		this.overlayLayers = props.overlayLayers;

		// events
		this.onBaseLayerChange = props.onBaseLayerChange;
		this.onOverlayChange = props.onOverlayChange;

		/** construct the layer control */
		this.constructBasemaps();
		this.constructOverlays();
	}

	/** create a block of basemaps */
	constructBasemaps() {
		// this will hold all the base layers
		this.baseDOM = document.createElement('div');
		this.baseDOM.className = 'layers_base_block';

		// go over the baselayers
		let mapLayerNames = Object.keys(this.baseLayers);
		let mapLayerValues = Object.values(this.baseLayers);
		for (let i = 0; i < mapLayerNames.length ; i++) {
			this.addBasemap(mapLayerValues[i], mapLayerNames[i], (i==0) ? true : false);
		};

		// append everything to our window
		this.block.appendChild(this.baseDOM);
	}
	addBasemap(_layer, name, checked = false) {
		// element block that will host stuff inside
		let row = document.createElement('div');
			row.className = 'layers_el';

		// this one contains the icon and the name
		let layerName = document.createElement('div')
			layerName.className = 'layer_name';
			layerName.innerHTML = `<div class="legend_title">${name}</div>`;

		// now the block with all the toggle stuff, design elements first
		let layerToggleBlock = document.createElement('div');
			layerToggleBlock.className = 'toggle';
			layerToggleBlock.innerHTML = `<b class="b switch"></b><b class="b track"></b>`;

		// and then the input for the toggle
		let layerToggle = document.createElement('input');
			layerToggle.className = 'toggle_switch basemap_switch check'
			layerToggle.dataset.category = name;
			layerToggle.type = 'checkbox';
			layerToggle.checked = (checked) ? true : false;

		// add first layer by default
		if (checked) {
			this.activeLayer = {name:name, layer:_layer};
			this.onBaseLayerChange(this.activeLayer);
		}

		// on toggle change event
		layerToggle.onclick = () => {
			// uncheck all other toggles
			this.uncheckOtherBase();

			// check this toggle
			layerToggle.checked = true;

			// set active layer and states
			this.activeLayer = {name:name, layer:_layer};
			this.toggleStates[name] = layerToggle.checked;

			// turn off all other baselayers
			if (this.currentBaseLayer) this.map.removeLayer(this.currentBaseLayer);
			this.currentBaseLayer = _layer;
			this.onBaseLayerChange(this.activeLayer);
		};

		// append toggle itself to the toggle block
		layerToggleBlock.prepend(layerToggle);

		// now append layer name and the toggle to the row
		row.appendChild(layerName);
		row.appendChild(layerToggleBlock);

		// and finally add this category to the full list
		this.baseDOM.appendChild(row);
	}

	/** create a block of overlays */
	constructOverlays() {
		// this will hold all the base layers
		this.overlayDOM = document.createElement('div');
		this.overlayDOM.className = 'layers_overlay_block';

		// go over the overlays
		let names = Object.keys(this.overlayLayers);
		let layers = Object.values(this.overlayLayers);
		for (let i = 0; i < names.length ; i++) {
			this.addOverlay(layers[i], names[i]);
		};

		// append everything to our window
		this.block.appendChild(this.overlayDOM);
	}
	/** add a new overlay to the layer control */
	addOverlay(_layer, name, checked = false) {
		// element block that will host stuff inside
		let row = document.createElement('div');
			row.className = 'layers_el';

		// this one contains the icon and the name
		let overlayName = document.createElement('div')
			overlayName.className = 'layer_name';
			overlayName.innerHTML = `<div class="legend_title">${name}</div>`;

		// now the block with all the toggle stuff, design elements first
		let overlayToggleBlock = document.createElement('div');
			overlayToggleBlock.className = 'toggle';
			overlayToggleBlock.innerHTML = `<b class="b switch"></b><b class="b track"></b>`;

		// and then the input for the toggle
		let overlayToggle = document.createElement('input');
			overlayToggle.className = 'toggle_switch check'
			overlayToggle.dataset.overlay = name;
			overlayToggle.type = 'checkbox';
			overlayToggle.checked = (checked) ? true : false;

		// on toggle change event
		overlayToggle.onclick = (e) => {
			// toggle status
			let toggleStatus = e.target.checked;

			// set the state
			overlayToggle.checked = toggleStatus;

			// set active layer and states
			this.toggleStates[name] = toggleStatus;

			console.log(this.toggleStates);

			// return layer
			this.onOverlayChange({layer:_layer, status:toggleStatus, name:name});
		};

		// append toggle itself to the toggle block
		overlayToggleBlock.prepend(overlayToggle);

		// now append layer name and the toggle to the row
		row.appendChild(overlayName);
		row.appendChild(overlayToggleBlock);

		// and finally add this category to the full list
		this.overlayDOM.appendChild(row);
	}

	/** uncheck other toggles */
	uncheckOtherBase() {
		document.querySelectorAll('.basemap_switch').forEach((toggle) => {
			toggle.checked = false;
		})
	}

	/** return currently active base layer */
	getActiveBaseLayer() {
		return this.activeLayer;
	}
}

export default LayerControl;