import {S2_WMS, apiUrl, vtilesUrl, bingApiKey, arcgisHotspots} from '../config';
import {
	dateline,
	SentinelHubLayer,
	tooltipGen,
	fishnetTooltipGen,
	strToDateUTC,
	dataToTables,
	DATE_FORMAT
} from '../utils';

const ONE_DAY = 1000*60*60*24; // milliseconds in one day

// drawn items styling
const approvedFill = '#4caf50';
const normalFill = '#3388ff';

// fishnet styling
const doneFish = '#3caf50';
const rawFish = '#2388ff';

// socket.io init
const socket = io({path: (apiUrl) ? `${apiUrl}/socket.io` : ''});
const mouseSocket = io('/micemove', {path: (apiUrl) ? `${apiUrl}/socket.io` : ''});

/******************/
/* main map class */
export class monitoringMap {
	constructor() {
		// init leaflet map
		this.map = L.map('map_new', {
			renderer: L.canvas(),
			minZoom:3,
			maxZoom: 22,
			zoomControl: false,
			editable: true
		}).setView([51.73, 47.20], 3);

		// scale
		L.control.scale().addTo(this.map);

		// show position hash
		var hash = new L.Hash(this.map);

		// map panes
		this.map.createPane('shub');
		this.map.createPane('shub_compare');
		this.map.createPane('russia_borders');
		this.map.createPane('hotspots');
		this.map.createPane('fishnet');
		this.map.createPane('drawn');
		this.map.createPane('temp_drawn');
		
		this.map.getPane('shub').style.zIndex = 240;
		this.map.getPane('shub_compare').style.zIndex = 250;
		this.map.getPane('russia_borders').style.zIndex = 260;
		this.map.getPane('hotspots').style.zIndex = 300;
		this.map.getPane('fishnet').style.zIndex = 350;
		this.map.getPane('drawn').style.zIndex = 400;
		this.map.getPane('temp_drawn').style.zIndex = 410;

		// renderer
		this.drawnRenderer = L.svg({pane:'temp_drawn'});//L.canvas({pane: 'drawn'});

		// leaflet draw vars, currently selected feature and feature group with drawn items
		this.selectedFeature = null;
		this.drawnItems = L.featureGroup().addTo(this.map);


		/***********************/
		/* custom map controls */
		/***********************/
		// all the date related stuff
		// add date blocks
		this.comparisonMode = false;
		this.date_control_main = L.control({position: 'topleft'});
		this.date_control_secondary = L.control({position: 'topright'});
		this.date_control_main.onAdd = () => {
			var div = L.DomUtil.create('div', 'date_main_wrapper');
				div.innerHTML = `<div id="date_main_controls">
									<button id="prev_main"><</button>
									<input id="date_main">
									<button id="next_main">></button>
								</div>`;
				L.DomEvent.disableClickPropagation(div);
			return div;
		};
		this.date_control_secondary.onAdd = () => {
			var div = L.DomUtil.create('div', 'date_secondary_wrapper');
				div.innerHTML = `<div id="date_secondary_controls">
									<button id="prev_secondary"><</button>
									<input id="date_secondary">
									<button id="next_secondary">></button>
								</div>`;
				L.DomEvent.disableClickPropagation(div);
			return div;
		};

		this.date_control_main.addTo(this.map);
		this.date_control_secondary.addTo(this.map);

		// init date config
		var now = new Date();
		var startTimestamp = now.getTime() + now.getTimezoneOffset()*60*1000;
		this.startDate = new Date(startTimestamp); //previous day
		$('#date_main').val($.datepicker.formatDate(DATE_FORMAT, this.startDate));
		$('#date_secondary').val($.datepicker.formatDate(DATE_FORMAT, this.startDate));

		this.cacheBypass = new Date().getTime();


		// comparison slider button
		const comparisonSliderBtn = L.Control.extend({
			options: { position: 'topleft' },
			onAdd: () => {
				var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-custom-button leaflet-compare');
					container.onclick = () => {
						this.toggleComparing();
					}
				return container;
			}
		});
		this.map.addControl(new comparisonSliderBtn);

		// change comparions imagery according to the basemap change
		this.map.on('baselayerchange', (layer) => {
			if (layer.name.includes('FC')) {
				this.sentinel2_basemap_compare.setLayers('S2-11-8-2');
			} else if (layer.name.includes('TC')) {
				this.sentinel2_basemap_compare.setLayers('TRUE-COLOR');
			}
		});

		// new control for leaderbords button | modal with stats
		const stats_modal = L.Control.extend({
			options: {
				position: 'topleft' 
			},
			onAdd: () => {
				var button = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-stats');
				L.DomEvent.disableClickPropagation(button); // so you can't click through
				button.onclick = () => {
					this.getLeaderboards((data) => {
						// close in on the page elements
						var modal = document.getElementById('modal_wrapper');

						// set modal content and show the window
						var content = document.getElementById('modal_content');
							content.innerHTML = dataToTables(data);
						modal.style.display = "block";

						window.onclick = function(event) {
							if (event.target == modal) {
								modal.style.display = "none";
							}
						}
					});
				}
				return button;
			}
		});
		this.map.addControl(new stats_modal);
	}

	// toggle comparison mode
	toggleComparing = () => {
		this.comparisonMode = !this.comparisonMode;
		if (this.comparisonMode) {
			//show second date picker
			$('.date_secondary_wrapper').show();

			// check which imagery is picked atm
			let activeBasemap = this.layer_control.getActiveBaseLayer();
			let activeSecondLayer = this.sentinel2_basemap_compare;

			// add second imagery and comparison control
			// if False Color => add it | if it's something else add True Color
			if (activeBasemap.name.includes('FC')) {
				activeSecondLayer.setLayers('S2-11-8-2');
				activeSecondLayer.getLayer().addTo(this.map);
			}
			activeSecondLayer.getLayer().addTo(this.map);
			this.comparisonSlider = L.control.sideBySide(this.sentinel2_basemap, activeSecondLayer.getLayer()).addTo(this.map);
		} else {
			//hide second date picker
			$('.date_secondary_wrapper').hide();
			this.map.removeControl(this.comparisonSlider);
			this.map.removeLayer(this.sentinel2_basemap_compare.getLayer());
		}
	}

	// invalidate
	invalidate = () => { this.map.invalidateSize() }
	
	// basemaps
	initBasemaps() {
		// high resolution
		var osm_basemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(this.map);
		var bing_basemap = new L.BingLayer(bingApiKey, {type: 'Aerial'});
		var esri_basemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: '&copy; <a href="http://www.esri.com/">ESRI.com</a>'});

		// medium resolution
		this.sentinel2_basemap = new SentinelHubLayer(S2_WMS, 'shub');
		this.sentinel2_alt_basemap = new SentinelHubLayer(S2_WMS, 'shub', 'S2-11-8-2');

		// medium resolution for comparison
		this.sentinel2_basemap_compare = new SentinelHubLayer(S2_WMS, 'shub_compare');

		// hotspots
		this.hotspots2020 = L.esri.featureLayer({
			url: arcgisHotspots,
			renderer: L.canvas(),
			interactive: false,
			pointToLayer: function (geojson, latlng) {
				return L.circleMarker(latlng, {
					//pane: 'hotspots',
					radius: 1,
					fillColor: 'orange',
					color: 'red',
					weight: 1,
					opacity: 1,
					fillOpacity: 0.7
				})
			}
		}).addTo(this.map);

		// show layer control
		this.baseLayers = {
			'OSM': osm_basemap,
			'Sentinel-2 TC': this.sentinel2_basemap.getLayer(),
			'Sentinel-2 FC (11-8-2)': this.sentinel2_alt_basemap.getLayer(),
			'Bing': bing_basemap,
			'ESRI': esri_basemap,
		};
		this.overlayLayers = { 'Hotspots': this.hotspots2020 }
		this.layer_control = L.control.activeLayers(this.baseLayers, this.overlayLayers, {collapsed: false});
		this.layer_control.addTo(this.map);

		// russia borders
		L.geoJson.ajax('./data/russia_borders.json', {
			style: {
				pane: 'russia_borders',
				weight: 2,
				opacity: 0.8,
				color: '#337ab7',
				fillOpacity: 0,
				coordsToLatLng: dateline
			}
		}).addTo(this.map);
	}

	// utils
	saveKML = () => {
		// show the spinning loader
		$('#spinner_wrapper').show();

		this.ajaxGeoJSON({}, (data) => {
			// convert geojson to kml
			var kml = tokml(data);

			// init file download
			var rawDate_main = strToDateUTC($('#date_main').val());
			var rawDate_secondary = strToDateUTC($('#date_secondary').val());
			var rawDate_bigger = (rawDate_main.getTime() > rawDate_secondary.getTime()) ? rawDate_main : rawDate_secondary;

			var rawDate = (this.comparisonMode) ? rawDate_bigger : rawDate_main; // if comparison is active, get the date from the right panel (after)

			var filenameDate = moment(rawDate).format('YYYY-MM-DD');
			var element = document.createElement('a');
				element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(kml));
				element.setAttribute('download', `${filenameDate}.kml`);
				element.style.display = 'none';

				document.body.appendChild(element);
				element.click();
				document.body.removeChild(element);

			// hide the spinner once everything is done
			$('#spinner_wrapper').hide();
		})
	}

	// =======================================
	// load geojson polygons - MAIN LOGIC
	ajaxGeoJSON = (post_data, callback) => {
		$.ajax({
			type: 'POST',
			url: `${apiUrl}/load`,
			dataType: 'json',
			data: post_data,
			success: (data) => {
				callback(data);
			},
			error: (error) => {
				console.log('error loading info', error);
			}
		});
	}

	// load polygons' info from the db
	getLeaderboards = (callback) => {
		$.get(`${apiUrl}/stats`, (data) => {
			callback(data);
		});
	}

	// load polygons' info from the db
	getPolygonInfo = (geoid, callback) => {
		$.get(`${apiUrl}/polyinfo/${geoid}`, (data) => {
			callback(data);
		});
	}
	// load fishnet cell info from the db
	getFishnetCell = (gid, callback) => {
		$.get(`${apiUrl}/fishcellinfo/${gid}`, (data) => {
			callback(data);
		});
	}

	// add a new feature to the map and to the sidebar
	addGeometryLayer = (data, user) => {
		L.geoJSON(data, {
			//renderer: L.canvas({pane: 'drawn'}),
			renderer: this.drawnRenderer,
			style: function(feature) {
				var p = feature.properties;
				return {
					opacity: 0.7,
					color: (p.approved) ? approvedFill : normalFill,
					fillOpacity: 0.1
				}
			},
			onEachFeature: (feature, layer) => {
				var p = feature.properties;

				// check if feature is already on the map => in which case remove it
				this.drawnItems.eachLayer((layer) => {
					var drawn_params = layer.feature.properties;
					if (drawn_params.geoid === p.geoid) {
						this.map.removeLayer(layer);
						this.drawnItems.removeLayer(layer);
					}
				});

				// hide from the vectorgrid, if it's there
				this.pbfLayer.setFeatureStyle(p.geoid, { color: 'transparent' });
				
				// add on map
				this.drawnItems.addLayer(layer);
			}
		});
	};

	// load all geojson features from the db
	initVectorData = () => {
		this.pbfSource = vtilesUrl;
		this.pbfLayer = L.vectorGrid.protobuf(this.pbfSource, {
			rendererFactory: L.canvas.tile,
			pane: 'drawn',
			getFeatureId: function(f) {
				return f.properties.geoid;
			},
			vectorTileLayerStyles: {
				'public.platform': (p, zoom) => {
					return {
						fill: true,
						weight: 2,
						fillColor: (p.approved) ? approvedFill : normalFill,
						color: (p.approved) ? approvedFill : normalFill,
						fillOpacity: 0.2,
						opacity: 0.7,
					}
				}
			},
			interactive: true,
		}).addTo(this.map);
		this.pbfLayer.once('load ', () => {
			// hide spinner
			$('#spinner_wrapper').hide();

			// add this layer to layer control
			this.layer_control.addOverlay(this.pbfLayer, 'Burned areas');
		})
		
		// when you left click features
		this.pbfLayer.on('click', (e) => {
			var props = e.layer.properties;
			this.getPolygonInfo(props.geoid, (data) => {
				// create and open a new popup window
				L.popup()
					.setLatLng(e.latlng)
					.setContent(tooltipGen(data, this.current_user, this.userRights))
					.openOn(this.map);
			});
		});


		// change styling on right-click
		this.pbfLayer.on('contextmenu', (e) => {
			var props = e.layer.properties;
			this.getPolygonInfo(props.geoid, (data) => {
				if (this.userRights) this.changeApproval(data.geoid, !data.approved);
			});
		});


		// hide absolutely everything on overlay change | rewrite, we don't need jquery here
		$('body').on('click', '.leaflet-control-layers-selector', (e) => {
			var checked = e.target.checked;
			var text = e.target.parentElement.outerText
			if (text.includes('Burned areas')) {
				(checked) ? this.map.addLayer(this.drawnItems) : this.map.removeLayer(this.drawnItems);
			}
		})
	}

	// edit feature
	// we need check whether this feature is already on the map, or if it's still a vectorgrid tile
	editFeature = (geoid) => {
		console.log(geoid);
		// now let's hide the original one from the vectorgrid
		this.pbfLayer.setFeatureStyle(geoid, { color: 'transparent' });
		// create a copy of feature's geometry by retrieving latest data from the DB
		this.getPolygonGeometry(geoid, (data) => {
			var geojson = {"type":"FeatureCollection", "features":[{"type": "Feature", "geometry": '', "properties": {}}]}
			Object.entries(data).forEach(([key, value]) => {
				if (key === 'st_asgeojson') {
					geojson.features[0].geometry = JSON.parse(value);
				} else {
					geojson.features[0].properties[key] = value;
				}
			});
			// add copy to the map
			this.addGeometryLayer(geojson, data.owner);

			// edit copy, the rest is just like it was
			this.editFeatureCopy(geoid);
		});
	}

	// load polygons' info from the db
	getPolygonGeometry = (geoid, callback) => {
		$.get(`${apiUrl}/polygeometry/${geoid}`, (data) => {
			callback(data);
		});
	}

	// load polygons' geom and calculate the bbox
	getPolygonBoundingBox = (geoid, callback) => {
		$.get(`${apiUrl}/polygeometry/${geoid}`, (data) => {
			var geojson = JSON.parse(data.st_asgeojson);
			var bbox = turf.bbox(geojson);
			var corner1 = L.latLng(bbox[1], bbox[0]),
				corner2 = L.latLng(bbox[3], bbox[2]),
				leafletBbox = L.latLngBounds(corner1, corner2);
			callback(leafletBbox);
		});
	}
	// zoom to specified bbox
	zoomToFeature(bbox) {
		this.map.fitBounds(bbox);
	}

	// edit a copy of the feature
	editFeatureCopy = (geoid) => {
		// go over all layers and enable clicked one
		this.drawnItems.eachLayer((layer) => {
			var props = layer.feature.properties;
			if (props.geoid === geoid) {
				if (this.selectedFeature != layer && this.selectedFeature) {
					this.selectedFeature.disableEdit();
				}
				this.selectedFeature = layer;
				layer.enableEdit();
				this.map.closePopup();
			}
		});
	}


	// do after a successful ajax request
	onAJAXrequest = (data) => {
		// show popup status window
		if (!data.success) {
			$('#success').hide();
			$('#danger').fadeIn(2000).html(data.posted).fadeOut(2500);
		} else {
			$('#danger').hide();
			$('#success').fadeIn(2000).html('<p>' + data.posted + '</p>').fadeOut(2500);
		}

		// add the same information to logs
		var timestamp = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
		$('#messages_log').prepend(`
			<div class=${(data.success) ? 'success-msg' : 'error-msg'}>[${timestamp}] ${data.posted}</div>
		`);
	}

	/* ================== */
	/* save geometry data */
	/* ================== */
	save_geom = (geoid, area, g, comments, date, callback) => {
		$.ajax({
			type: 'POST',
			url: `${apiUrl}/save`,
			dataType: 'json',
			data: {
				geoid: geoid,
				area: area,
				geom: JSON.stringify(g.geometry),
				comments: comments,
				date: date,
			},
			success: (data) => {
				this.onAJAXrequest(data);
				if (data.success) callback()
			}
		});
	};


	// date routines
	// init controls | change basemap date
	alterDateMain = (delta) => {
		var date = $.datepicker.parseDate(DATE_FORMAT, $('#date_main').val());
		$('#date_main').val($.datepicker.formatDate(DATE_FORMAT, new Date(date.valueOf() + delta * ONE_DAY))).change();
	}
	alterDateSecondary = (delta) => {
		var date = $.datepicker.parseDate(DATE_FORMAT, $('#date_secondary').val());
		$('#date_secondary').val($.datepicker.formatDate(DATE_FORMAT, new Date(date.valueOf() + delta * ONE_DAY))).change();
	}
	initControls = () => {
		document.getElementById("prev_main").onclick = this.alterDateMain.bind(null, -1);
		document.getElementById("prev_secondary").onclick = this.alterDateSecondary.bind(null, -1);
		document.getElementById("next_main").onclick = this.alterDateMain.bind(null, 1);
		document.getElementById("next_secondary").onclick = this.alterDateSecondary.bind(null, 1);
		
		$('#date_main').datepicker({dateFormat: DATE_FORMAT}).change(() => {
			var date = strToDateUTC($('#date_main').val());

			// sentinel-hub layers
			this.sentinel2_basemap.setDate(date);
			this.sentinel2_alt_basemap.setDate(date);
		});

		$('#date_secondary').datepicker({dateFormat: DATE_FORMAT}).change(() => {
			var date = strToDateUTC($('#date_secondary').val());
			this.sentinel2_basemap_compare.setDate(date);
		});
	}


	// ============ //
	// leaflet.draw //
	// ============ //
	initPolygonDrawing = () => {
		this.drawPolygon = new L.Draw.Polygon(this.map).enable();
	}
	removeLastPolygonVertex = () => {
		this.drawPolygon.deleteLastVertex();
	}

	initLDraw() {
		this.drawControl = new L.Control.Draw({
			edit: {
				featureGroup: this.drawnItems,
				poly: {
					allowIntersection: false
				}
			},
			draw: {
				polygon: {
					allowIntersection: false,
					showArea: true,
					shapeOptions: {
						fillOpacity: 0.01,
					}
				},
				marker: false,
				circle: false,
				rectangle: false,
				polyline: false,
				circlemarker: false
			}
		});
		this.map.addControl(this.drawControl);

		// once new obj was created
		this.map.on('draw:created', (e) => {
			var layer = e.layer;
			var area_ha = (turf.area(layer.toGeoJSON()))/10000; // sq.m to ha
			//var geoid = md5(new Date().getTime());
			var geoid = md5((new Date().getTime()).toString() + this.current_user);

			var feature = layer.feature = layer.feature || {};
				feature.type = feature.type || "Feature";
			var props = feature.properties = feature.properties || {};
				props.geoid = geoid;
				props.area = area_ha;

			// save NEW feature to the db
			var rawDate_main = strToDateUTC($('#date_main').val());
			var rawDate_secondary = strToDateUTC($('#date_secondary').val());
			var rawDate_bigger = (rawDate_main.getTime() > rawDate_secondary.getTime()) ? '#date_main' : '#date_secondary';
			var date_field = (this.comparisonMode) ? rawDate_bigger : '#date_main'; // check if slider mode is on
			var date = moment(strToDateUTC($(date_field).val())).format('YYYY-MM-DD');
			this.save_geom(geoid, area_ha, layer.toGeoJSON(), '', date, () => {
				var geojson = layer.toGeoJSON();
				// show NEW feature on the map
				this.addGeometryLayer(geojson, this.current_user);
				// emit geometry creation to other users
				socket.emit('user_created_geometry', this.current_user, geojson);
			});

			// close the popup
			this.map.closePopup();
		});

		// on objects edit | leaflet.editable
		this.map.on('editable:disable', (e) => {
			// init vars
			var layer = e.layer;
			let geoid = layer.feature.properties.geoid;
			var geojson = layer.toGeoJSON();
			var area_ha = (turf.area(geojson))/10000; // sq.m to ha

			// disable drawing mode
			this.drawingEnabled = false;

			// save to db
			var rawDate_main = strToDateUTC($('#date_main').val());
			var rawDate_secondary = strToDateUTC($('#date_secondary').val());
			var rawDate_bigger = (rawDate_main.getTime() > rawDate_secondary.getTime()) ? '#date_main' : '#date_secondary';
			var date_field = (this.comparisonMode) ? rawDate_bigger : '#date_main'; // check if slider mode is on
			var date = moment(strToDateUTC($(date_field).val())).format('YYYY-MM-DD');
			this.save_geom(geoid, area_ha, geojson, '', date, () => {
				socket.emit('user_created_geometry', this.current_user, geojson);
			});

			// close the popup
			this.map.closePopup();
		});
	}

	initVectorGridReload = () => {
		// reload vectorgrid layer
		const refreshBtn = L.Control.extend({
			options: { position: 'topleft' },
			onAdd: () => {
				var btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-custom-button leaflet-refresh');
					btn.onclick = () => {
						// reload
						window.stop();
						this.pbfLayer.setUrl(`${this.pbfSource}?ver=${this.cacheBypass}`, false);
					}
				return btn;
			}
		});
		this.map.addControl(new refreshBtn);
	}

	// save feature data + comments
	saveFeature = (geoid, comments) => {
		// disable edited layer, which also saves the geometry
		try { this.selectedFeature.disableEdit() } catch(e) {}

		// save comments to the db
		$.ajax({
			type: 'POST',
			url: `${apiUrl}/save_comment`,
			dataType: 'json',
			data: { geoid:geoid, comments:comments },
			success: (data) => {
				// close popup
				this.map.closePopup();

				// show output
				this.onAJAXrequest(data);
			}
		});
	}

	// admin can change approval status of db features
	changeApproval = (geoid, approval) => {
		$.ajax({
			type: 'POST',
			url: `${apiUrl}/change_approval`,
			dataType: 'json',
			data: { geoid:geoid, approval:approval },
			success: ((data) => {
				this.onAJAXrequest(data);
				if (data.success) {
					socket.emit('admin_changed_approval', this.current_user, geoid, approval);
					this.changeApprovalStyling(geoid, approval);
				}
			}),
		});
	};
	changeApprovalStyling = (geoid, approval) => {
		// first let's set the approval boolean (in case approval value was of type string)
		var approval_bool = approval;
		if (typeof(approval) !== 'boolean') approval_bool = (approval === 'true');
		var approval_styling = {
			opacity: 0.75,
			color: (approval_bool) ? approvedFill : normalFill,
			fillOpacity: 0.3
		}

		// now go over locally drawn features and change the approval styling
		this.drawnItems.eachLayer((layer) => {
			var props = layer.feature.properties;
			if (props.geoid === geoid) {
				layer.setStyle(approval_styling);
			}
		});

		// if however, there was no such feature, that means it's in vector grid, change its styling as well
		this.pbfLayer.setFeatureStyle(geoid, approval_styling);
	}

	// admin can change 'done' status of the fishnet
	changeFishnetStatus = (gid, status) => {
		$.ajax({
			type: 'POST',
			url: `${apiUrl}/fishnet_change`,
			dataType: 'json',
			data: { gid:gid, status:status },
			success: ((data) => {
				this.onAJAXrequest(data);
				if (data.success) {
					socket.emit('admin_changed_fishnet', this.current_user, gid, status);
					this.changeFishnetStyling(gid, status);
				}
			}),
		});
	};
	changeFishnetStyling = (gid, status) => {
		this.fishnet_layer.eachLayer((layer) => {
			var props = layer.feature.properties;
			if (props.gid === parseInt(gid)) {
				var boolean = (status === 'true');
				layer.setStyle({
					opacity: 0.75,
					color: (boolean) ? doneFish : rawFish,
					fillOpacity: 0.3
				});
			}
		});
	}

	// remove feature BUTTON routines
	handleRemoveButton = (geoid) => {
		this.removeFeature(geoid, () => {
			socket.emit('user_removed_geometry', this.current_user, geoid);
		});
	}

	// ======================== //
	// removing feature from db
	removeFeature = (geoid, callback) => {
		// close popup
		this.map.closePopup();

		// remove from the db
		$.get(`${apiUrl}/delete/${geoid}`, (data) => {
			this.onAJAXrequest(data);
			if (data.success) { // remove from the map if successfull
				this.removeFeatureVisibly(geoid);
				callback();
			}
		});
	};
	
	removeFeatureVisibly = (geoid) => {
		// remove feature from map itself
		this.drawnItems.eachLayer((layer) => {
			var props = layer.feature.properties;
			if (props.geoid === geoid) {
				this.map.removeLayer(layer);
				this.drawnItems.removeLayer(layer);
			}
		});

		// hide it on vectorgrid
		this.pbfLayer.setFeatureStyle(geoid, {color: 'transparent'});
	};
}

/*===================================================*/
/* all the sockets logic is here + free drawing mode */
/*===================================================*/
export default class liveMonitoringMap extends monitoringMap {
	constructor(userDetails) {
		super();

		// user info setup
		this.userDetails = userDetails;
		this.current_user = this.userDetails.username;
		this.userRights = this.userDetails.editor;
		this.userAddition = md5(new Date().getTime()).substring(28); // last 4 digits

		// live features
		this.user_pointers = L.featureGroup().addTo(this.map);
		this.lat = 0;
		this.lng = 0;
		this.oldlat = 0;
		this.oldlng = 0;
		this.drawingEnabled = false;
		this.mouseMovements();
		this.initEvents();

		// when you click and right-click features
		this.drawnItems.on('click', (e) => {
			var props = e.layer.feature.properties;
			this.getPolygonInfo(props.geoid, (data) => {
				// create and open a new popup window
				L.popup()
					.setLatLng(e.latlng)
					.setContent(tooltipGen(data, this.current_user, this.userRights))
					.openOn(this.map);
			});
		});
		// on right click
		this.drawnItems.on('contextmenu', (e) => {
			var props = e.layer.feature.properties;
			this.getPolygonInfo(props.geoid, (data) => {
				if (this.userRights) this.changeApproval(data.geoid, !data.approved);
			});
		});

		// load the fishnet on map init
		this.loadFishnet(() => {
			// fishnet search control
			this.map.addControl(new L.Control.Search({
				layer: this.fishnet_layer,
				propertyName: 'gid',
				marker: false,
				moveToLocation: function(latlng, title, map) {
					//map.fitBounds( latlng.layer.getBounds() );
					var zoom = map.getBoundsZoom(latlng.layer.getBounds());
					map.setView(latlng, zoom); // access the zoom
				}
			}));

			// since both drawnItems and fishnet are Canvases and blocking each other,
			// we need to propagate click events depending on their relative position
			/*
			this.map.on('click', (e) => {
				var drawnItemsInPoint = leafletPip.pointInLayer(e.latlng, this.pbfLayer);
				var fishnetLayersInPoint = leafletPip.pointInLayer(e.latlng, this.fishnet_layer);

				// check if drawing mode is enabled, then don't show fishnet stats
				//console.log('clicked, drawing mode:', this.drawingEnabled); //debug
				if (!this.drawingEnabled) {
					//or if comparison mode is disabled
					if (!this.comparisonMode) {
						// if there is no drawn Item => click on the fishnet
						if (!drawnItemsInPoint.length && fishnetLayersInPoint.length) {
							var props = fishnetLayersInPoint[0].feature.properties;
							this.getFishnetCell(props.gid, (data) => {
								L.popup()
									.setLatLng(e.latlng)
									.setContent(fishnetTooltipGen(data, this.userRights))
									.openOn(this.map);
							});
						}
					}
				}
			});
			*/
			
			this.fishnet_layer.on('click', (e) => {
				var props = e.layer.feature.properties;
				this.getFishnetCell(props.gid, (data) => {
					L.popup()
						.setLatLng(e.latlng)
						.setContent(fishnetTooltipGen(data, this.userRights))
						.openOn(this.map);
				});
			})
			

			this.map.on('draw:drawstart', () => { this.drawingEnabled = true; });
			this.map.on('draw:drawstop', () => { this.drawingEnabled = false; });
			this.map.on('editable:enable', () => { this.drawingEnabled = true; });
		});

		// custom gp & gmh attribution
		this.map.attributionControl.addAttribution('<a href="https://greenpeace.ru/">Greenpeace</a> / <a href="https://maps.greenpeace.org/">Global Mapping Hub</a>');
	}

	// load fishnet routine
	loadFishnet = (callback) => {
		$.get(`${apiUrl}/load_fishnet`, (data) => {
			this.fishnet_layer = L.geoJSON(data, {
				renderer: L.canvas({pane: 'fishnet'}),
				style: function(feature) {
					var p = feature.properties;
					return {
						weight: 1,
						opacity: 0.6,
						color: (p.done) ? doneFish : rawFish,
						fillOpacity: (p.done) ? 0.5 : 0.01,
					}
				},
				onEachFeature: (feature, layer) => {
					var props = feature.properties;
					if (this.userRights) layer.bindTooltip(`<strong>GID</strong>: ${props.gid}`, {sticky: true, direction: 'auto'});
				}
			}).addTo(this.map);
			
			this.layer_control.addOverlay(this.fishnet_layer, 'Sectors');
			callback();
		});
	}

	// mouse movement update
	mouseMovements = () => {
		this.map.addEventListener('mousemove', (e) => {
			this.lat = e.latlng.lat;
			this.lng = e.latlng.lng;
		});
		setInterval(() => {
			if (this.oldlat != this.lat && this.oldlng != this.lng) {
				// add a small id, so we can distinguish between same users :)
				mouseSocket.emit('user_mouse_update', this.current_user, this.userAddition, this.lat, this.lng);
			}
			this.oldlat = this.lat;
			this.oldlng = this.lng;
		}, 500);
	}

	initEvents = () => {
		// show user mice
		const mouse_pointer = L.icon({ iconUrl: './lib/images/mouse.png', iconSize: [20, 30], iconAnchor: [0, 0]});
		mouseSocket.on('user_mouse_update', (socket_user, socket_user_addition, lat, lng) => {
			// if emitted user is not current user or if username is the same but the special md5 addition is different (other tab or browser window)
			if ((this.current_user !== socket_user) || (this.current_user === socket_user && this.userAddition !== socket_user_addition)) {
				// add a new user to the feature layer
				// TODO: rewrite=========================================
				const tooltipText = `${socket_user}` // (${socket_user_addition})`;
				const userID = `${socket_user}_${socket_user_addition}`;
				if (this.user_pointers.getLayers().length == 0) {
					var marker = L.marker([lat, lng], {icon:mouse_pointer, userid:userID});
						marker.bindTooltip(tooltipText, {permanent: true});
						marker.addTo(this.user_pointers);
				} else {
					// update coordinates if user exists
					var found = false;
					this.user_pointers.eachLayer(function(layer) {
						if ((layer.options.userid).toString() == userID) {
							layer.setLatLng(new L.LatLng(lat, lng));
							//console.log('update latlng');
							found = true;
						}
					});
					if (!found) {
						var marker = L.marker([lat, lng], {icon:mouse_pointer, userid:userID});
							marker.bindTooltip(tooltipText, {permanent: true});
							marker.addTo(this.user_pointers);
						//console.log('create new marker');
					}
				}
			}
		});

		// show other users' geometry
		socket.on('user_created_geometry', (socket_user, geojson) => {
			// if emitted user is not current user
			var geoid = geojson.properties.geoid;
			console.log(geoid);
			this.addGeometryLayer(geojson, socket_user);
		});

		// remove geometry removed by other users
		socket.on('user_removed_geometry', (socket_user, geoid) => {
			this.removeFeatureVisibly(geoid);
		});

		// change styling of the feature approved by an admin
		socket.on('admin_changed_approval', (socket_user, geoid, approved) => {
			this.changeApprovalStyling(geoid, approved);
		});

		// change styling of the fishnet cell changed by an admin
		socket.on('admin_changed_fishnet', (socket_user, geoid, approved) => {
			if (this.current_user !== socket_user) {
				this.changeFishnetStyling(geoid, approved);
			}
		});


		//===
		// on timeout, when server restart, show an error message
		socket.on('connect_error', (error) => { //connect_timeout
			console.log('connect_error ', error);
			$('#global_error').html('Losing connection, please reload the page')
			$('#global_error').show();
		});

		socket.on('reconnect', (attemptNumber) => {
			$('#global_error').hide();
		});
	}
}