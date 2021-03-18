// 3rd party libs
import L from 'leaflet';
import 'leaflet-hash';
import 'leaflet-draw';
import 'leaflet-editable';
import 'leaflet-ajax';
import 'leaflet-side-by-side';
import * as esri from 'esri-leaflet';
import 'leaflet.vectorgrid';

import datepicker from 'js-datepicker'
import moment from 'moment';
import axios from 'axios';
import md5 from 'md5';
import {default as turfarea} from '@turf/area';
import {default as turfbbox} from '@turf/bbox';
import {Toast} from 'toaster-js';

import 'toaster-js/default.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'js-datepicker/dist/datepicker.min.css';

// local
import * as Config from '../config';
import {dataToTables} from '../Utilities/Templates';
import {dateline, strToDateUTC} from '../Utilities/Functions';

import PolygonPopup from './PolygonPopup';
import Spinner from '../Elements/Spinner';
import SentinelHubLayer from '../Utilities/SentinelHubLayer';
import LayerControl from './LayerControl';

// drawn items styling
const approvedFill = '#4caf50';
const normalFill = '#3388ff';

// fishnet styling
const doneFish = '#3caf50';
const rawFish = '#2388ff';

/** all the leaflet related stuff is sitting here */
class MapSlippy {
	constructor(props) {
		// main dom map element
		this.mapDOM = document.getElementById(Config.MAP_ID);

		// events
		this.userRights = props.userRights;
		this.onGeometryAddEmit = props.onGeometryAddEmit;
		this.onAdminApprovalChange = props.onAdminApprovalChange;
		this.onGeometryRemove = props.onGeometryRemove;
		this.onAdminFishnetChange = props.onAdminFishnetChange;
		this.onAdminMarkerSave = props.onAdminMarkerSave;
		this.onAdminMarkerRemove = props.onAdminMarkerRemove;

		// init leaflet map
		this.map = L.map(Config.MAP_ID, {
			renderer: L.canvas(),
			minZoom:3,
			maxZoom: 22,
			zoomControl: false,
			editable: true
		}).setView([51.73, 47.20], 3);

		// leaflet draw vars, currently selected feature and feature group with drawn items
		this.drawnItems = L.featureGroup().addTo(this.map);

		// spinner dom
		this.spinner = new Spinner();

		// vars
		this.sentinelToken = false; // whether sentinel-hub token was set
		this.comparisonMode = false;
		this.cacheBypass = new Date().getTime();

		// admin marker vars
		this.adminMarkerType = 'red';

		// init the rest
		this.initDefaults();
		this.addCalendars();
		this.initDrawnItemsEvents();

		// get Sentinel-Hub token
		this.getSentinelHubToken(() => {
			this.checkCalendarColors();
		});

		// admin markers
		if (this.userRights) this.adminMarkerControls();
		this.loadAdminMarkers();

		this.initCalendars();
		this.addControls();
		this.addLayers();
		this.initVectorData();
		this.initLDraw();
	}
	/** set events */
	setEvents(props) {
		this.onMagicControl = props.onMagicControl;
	}
	/** init map defaults */
	initDefaults() {
		// scale
		new L.control.scale().addTo(this.map);

		// show position hash
		new L.Hash(this.map);

		// map panes
		this.map.createPane('shub');
		this.map.createPane('shub_compare');
		this.map.createPane('borders');
		this.map.createPane('fishnet');
		this.map.createPane('hotspots');
		this.map.createPane('drawn');
		this.map.createPane('temp_drawn');
		this.map.createPane('local');
		
		this.map.getPane('shub').style.zIndex = 240;
		this.map.getPane('shub_compare').style.zIndex = 250;
		this.map.getPane('borders').style.zIndex = 260;
		this.map.getPane('fishnet').style.zIndex = 300;
		this.map.getPane('hotspots').style.zIndex = 350;
		this.map.getPane('drawn').style.zIndex = 400;
		this.map.getPane('temp_drawn').style.zIndex = 410;
		this.map.getPane('local').style.zIndex = 411;

		// renderer
		this.drawnRenderer = L.svg({pane:'temp_drawn'});

		// on map change => reinit the calendar
		this.map.on('moveend', () => {
			let bounds = this.map.getBounds();
			let SW = bounds._southWest;
			let NE = bounds._northEast;
			let bbox = [NE.lng, SW.lat, SW.lng, NE.lat];

			this.currentBBox = bbox;
			this.checkCalendarColors();
		});
	}
	/** add other leaflet controls */
	addControls() {
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

		// experimental selection tool (magic wand!)
		const magicWand = L.Control.extend({
			options: { position: 'topleft' },
			onAdd: () => {
				var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-custom-button leaflet-magic');
					container.onclick = () => {
						this.onMagicControl();
					}
				return container;
			}
		});
		this.map.addControl(new magicWand);

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

		// button to reload vectorgrid layers
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

	
	/** BASEMAPS & LAYERS */
	/** add basemaps and custom layers */
	addLayers() {
		this.addBasemaps();
		this.addCustomLayers();

		// add custom layer control
		this.layerControl = new LayerControl({
			onBaseLayerChange: (e) => {
				// add this layer to the map
				let layer = e.layer;
					layer.addTo(this.map)

				// change comparions imagery according to the basemap change
				if (e.name.includes('FC')) {
					this.sentinel2_basemap_compare.setLayers('S2-11-8-2');
				} else if (e.name.includes('TC')) {
					this.sentinel2_basemap_compare.setLayers('TRUE-COLOR');
				}
			},
			onOverlayChange: (data) => {
				// add/remove the layer
				if (data.status) data.layer.addTo(this.map);
				else data.layer.removeFrom(this.map);

				// remove both vectorgrid and newly drawn items
				if (data.name.includes('Drawn items')) {
					if (data.status) {
						data.layer.addTo(this.map);
						this.map.addLayer(this.drawnItems);
					} else {
						data.layer.removeFrom(this.map);
						this.map.removeLayer(this.drawnItems);
					}
				}
			},
			map: this.map,
			baseLayers: this.baseLayers,
			overlayLayers: this.overlayLayers
		});
	}

	/** add basemaps */
	addBasemaps() {
		// high resolution
		this.osmBasemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
		this.esriBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: '&copy; <a href="http://www.esri.com/">ESRI.com</a>'});

		// medium resolution
		let startDate = strToDateUTC(this.mainDOMElement.value);
		let satDate = moment(startDate).format(Config.DATE_DB_FORMAT);

		this.sentinel2_basemap = new SentinelHubLayer(satDate, 'shub');
		this.sentinel2_alt_basemap = new SentinelHubLayer(satDate, 'shub', 'S2-11-8-2');
		this.sentinel2_basemap_compare = new SentinelHubLayer(satDate, 'shub_compare'); // for comparison

		// show layer control
		this.baseLayers = {
			'OSM': this.osmBasemap,
			'Sentinel-2 TC': this.sentinel2_basemap.getLayer(),
			'Sentinel-2 FC (11-8-2)': this.sentinel2_alt_basemap.getLayer(),
			'ESRI': this.esriBasemap,
		};
	}
	/** add other layers */
	addCustomLayers() {
		// hotspots
		this.hotspots2020 = esri.featureLayer({
			url: Config.ARCGIS_HOTSPOTS,
			renderer: L.canvas(),
			interactive: true,
			pointToLayer: function (geojson, latlng) {
				let marker = L.circleMarker(latlng, {
					pane: 'hotspots',
					radius: 1,
					fillColor: 'red',
					color: 'red',
					weight: 2,
					opacity: 1,
					fillOpacity: 1
				})

				marker.on('click', function(e) {
					let hsDate = new Date(e.target.feature.properties.ACQ_DATE);
					L.popup().setLatLng(e.latlng).setContent(`${hsDate}`).openOn(this.map);
				}.bind(this))

				return marker;
			}.bind(this)
		})
		this.overlayLayers = {
			'Hotspots': this.hotspots2020
		};

		// russia borders
		L.geoJson.ajax('./data/admin_level_3.json', {
			style: {
				pane: 'borders',
				weight: 2,
				opacity: 0.8,
				color: '#337ab7',
				fillOpacity: 0,
				coordsToLatLng: dateline
			}
		}).addTo(this.map);
	}
	/** click events on newly drawn features */
	initDrawnItemsEvents() {
		// when you click and right-click features
		this.drawnItems.on('click', (e) => {
			this.onFeatureLeftClick(e.latlng, e.layer.feature.properties)
		});
		// on right click
		this.drawnItems.on('contextmenu', (e) => {
			this.onFeatureRightClick(e.layer.feature.properties);
		});
	}
	/** when user left-clicks the feature */
	onFeatureLeftClick(latlng, props) {
		this.getPolygonInfo(props.geoid, (data) => {
			// get popup content
			let popupContent = this.constructPopup(data);
			// create and open a new popup
			L.popup().setLatLng(latlng).setContent(popupContent).openOn(this.map);
		});
	}
	/** when user right-click the feature */
	onFeatureRightClick(props) {
		this.getPolygonInfo(props.geoid, (data) => {
			if (this.userRights) this.changeApproval(data.geoid, !data.approved);
		});
	}
	/** set popup properties and return the content */
	constructPopup(data) {
		let popup = new PolygonPopup({
			onSaveClick: (id, text, approval) => {
				this.saveFeature(id, text);
				if (this.userRights) this.changeApproval(id, approval);
			},
			onEditClick: (id) => {
				this.editFeature(id);
			},
			onRemoveClick: (id) => {
				this.handleRemoveButton(id);
			},
		});
		// generate and return the content
		return popup.generateContent(data, this.current_user, this.userRights);
	}

	/** load all geojson features from the db */
	initVectorData() {
		// create styling object
		let pbfStyling = {};
			pbfStyling[Config.VTILES_NAME] = (p, zoom) => {
				return {
					fillColor: (p.approved) ? approvedFill : normalFill,
					color: (p.approved) ? approvedFill : normalFill,
					...Config.POLYGON_DEFAULT_STTYLING
				}
			};

		// first users' polygons
		this.pbfSource = Config.VTILES_URL;
		this.pbfLayer = L.vectorGrid.protobuf(this.pbfSource, {
			rendererFactory: L.canvas.tile,
			pane: 'drawn',
			getFeatureId: function(f) {
				return f.properties.geoid;
			},
			vectorTileLayerStyles: pbfStyling,
			interactive: true,
		}).addTo(this.map);
		this.pbfLayer.once('load ', () => {
			this.spinner.hide(); // hide spinner
			this.layerControl.addOverlay(this.pbfLayer, 'Drawn items', true);
		})
		
		// when you left click features
		this.pbfLayer.on('click', (e) => {
			this.onFeatureLeftClick(e.latlng, e.layer.properties)
		});

		// change styling on right-click
		this.pbfLayer.on('contextmenu', (e) => {
			this.onFeatureRightClick(e.layer.properties);
		});
	}



	/** CALENDARS */
	/** add leaflet date controls */
	addCalendars() {
		// calendar vars
		this.mainDOM = 'date_main';
		this.secondaryDOM = 'date_secondary';
		
		// main calendar
		this.dateControlMain = L.control({position: 'topleft'});
		this.dateControlMain.onAdd = () => {
			var div = L.DomUtil.create('div', 'date_main_wrapper');
				div.innerHTML = `<div id="date_main_controls">
									<button id="prev_main" data-delta="-1"><</button>
									<input id="${this.mainDOM}">
									<button id="next_main" data-delta="1">></button>
								</div>`;
				L.DomEvent.disableClickPropagation(div);
			return div;
		};

		// secondary calendar
		this.dateControlSecondary = L.control({position: 'topright'});
		this.dateControlSecondary.onAdd = () => {
			var div = L.DomUtil.create('div', 'date_secondary_wrapper');
				div.innerHTML = `<div id="date_secondary_controls">
									<input id="${this.secondaryDOM}">
								</div>`;
				L.DomEvent.disableClickPropagation(div);
			return div;
		};

		// add them both
		this.dateControlMain.addTo(this.map);
		this.dateControlSecondary.addTo(this.map);

		// and the get the refs
		this.mainDOMElement = document.getElementById(this.mainDOM);
		this.secondaryDOMElement = document.getElementById(this.secondaryDOM);

		// init date config
		this.startDate = new Date();
		this.mainDOMElement.value = moment(this.startDate).format(Config.MOMENT_FORMAT);
		this.secondaryDOMElement.value = moment(this.startDate).format(Config.MOMENT_FORMAT);
	}
	/** setup calendars with datepicker-js */
	initCalendars(dates) {
		this.availableDates = (dates) ? dates: (this.availableDates) ? this.availableDates : [];
		this.mainDatePicker = datepicker(this.mainDOMElement, {
			id: 1,
			startDay: 1, // calendar week starts on a Monday.
			onMonthChange: instance => { // do stuff when the month changes.
				this.getSentinelHubDates(this.currentBBox, instance.currentYear, instance.currentMonth + 1, (dates) => {
					this.recolorCalendar(this.mainDOM, dates);
				})
			},
			maxDate: new Date(),
			events: this.availableDates.map(el => new Date(el)),
			formatter: (input, date, instance) => {
				input.value = moment(date).format(Config.MOMENT_FORMAT);
			},
			onSelect: () => {
				this.onMainCalendarChange();
			}
		});

		this.secondaryDatePicker = datepicker(this.secondaryDOMElement, {
			id: 2,
			startDay: 1, // calendar week starts on a Monday.
			onMonthChange: instance => { // do stuff when the month changes.
				this.getSentinelHubDates(this.currentBBox, instance.currentYear, instance.currentMonth + 1, (dates) => {
					this.recolorCalendar(this.secondaryDOM, dates);
				})
			},
			maxDate: new Date(),
			events: this.availableDates.map(el => new Date(el)),
			formatter: (input, date, instance) => {
				input.value = moment(date).format(Config.MOMENT_FORMAT);
			},
			onSelect: () => {
				var date2 = strToDateUTC(this.secondaryDOMElement.value);
				this.sentinel2_basemap_compare.setDate(date2);
			}
		});

		// bind prev/next buttons
		document.querySelectorAll('#prev_main, #next_main').forEach((el) => {
			el.onclick = (e) => {
				let delta = parseInt(e.target.dataset.delta);
				let currentDate = strToDateUTC(this.mainDOMElement.value);
				let date = moment(currentDate).add(delta, 'days');
				this.setMainCalendar(date);
			};
		})
	}
	/** set dates in main calendar */
	setMainCalendar(date) {
		let dateObj = moment(date).toDate();
		this.mainDatePicker.setDate(dateObj);
		this.onMainCalendarChange();
	}
	/** do on month change */
	onMainCalendarChange() {
		var date1 = strToDateUTC(this.mainDOMElement.value);
		// sentinel-hub layers
		this.sentinel2_basemap.setDate(date1);
		this.sentinel2_alt_basemap.setDate(date1);
	}
	/** return available dates | for sentinel-hub */
	allowedDates(date) {
		date = moment(date).format(Config.DATE_DB_FORMAT);
		return [true, (this.availableDates.indexOf(date) !== -1) ? "sat-class" : ""];
	}


	/** LEAFLET.DRAW & LEAFLET.EDITABLE */
	/** init draw & editable controls and events */
	initLDraw() {
		// This is a hack due to a bug in leaflet.draw
		// https://github.com/Leaflet/Leaflet.draw/issues/1005
		window.type = undefined;

		// create a new draw control and set it up
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
						editing: { className: ""} // fix #804
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
			this.newObjectCreated(e.layer);
		});

		// on objects' edit | leaflet.editable
		this.map.on('editable:disable', (e) => {
			var layer = e.layer;
			var geoid = layer.feature.properties.geoid;
			var geojson = layer.toGeoJSON();
			var area_ha = (turfarea(geojson))/10000; // sq.m to ha

			// disable drawing mode
			this.drawingEnabled = false;

			// save to db
			this.prepAndSave(geoid, area_ha, geojson, () => {
				this.onGeometryAddEmit(this.current_user, geojson);
			})

			// close the popup
			this.map.closePopup();
		});
	}
	/** do this when new polygon was created */
	newObjectCreated(layer) {
		var geoid = md5((new Date().getTime()).toString() + this.current_user);
		var geojson = layer.toGeoJSON();
		var area_ha = (turfarea(geojson))/10000; // sq.m to ha

		var feature = layer.feature = layer.feature || {};
			feature.type = feature.type || "Feature";
		var props = feature.properties = feature.properties || {};
			props.geoid = geoid;
			props.area = area_ha;

		// save NEW feature to the db
		this.prepAndSave(geoid, area_ha, geojson, () => {
			var geojson = layer.toGeoJSON();
			// show NEW feature on the map
			this.addGeometryLayer(geojson, this.current_user);
			// emit geometry creation to other users
			this.onGeometryAddEmit(this.current_user, geojson);
		})

		// close the popup
		this.map.closePopup();
	}
	/** do some last minute calculations and save */
	prepAndSave(geoid, area_ha, geojson, callback) {
		// save NEW feature to the db
		var rawDate_main = strToDateUTC(this.mainDOMElement.value);
		var rawDate_secondary = strToDateUTC(this.secondaryDOMElement.value);
		var rawDate_bigger = (rawDate_main.getTime() > rawDate_secondary.getTime()) ? 'date_main' : 'date_secondary';
		var date_field = (this.comparisonMode) ? rawDate_bigger : 'date_main'; // check if slider mode is on
		var date = moment(strToDateUTC(document.getElementById(date_field).value)).format(Config.DATE_DB_FORMAT);

		this.save_geom(geoid, area_ha, geojson, '', date, () => {
			if (callback) callback();
		});
	}
	/** save geometry & comments to the database */
	save_geom(geoid, area, g, comments, date, callback) {
		axios.post(`${Config.API_URL}/save`, {
			geoid: geoid,
			area: area,
			geom: JSON.stringify(g.geometry),
			comments: comments,
			date: date,
		}).then((out) => {
			this.onRequestSuccess(out.data);
			if (out.data.success) callback()
		}).catch((err) => {
			alert(err);
		})
	};


	/** POLYGON ROUTINES */
	/** edit feature */
	editFeature(geoid) {
		// we need check whether this feature is already on the map, or if it's still a vectorgrid tile
		console.log(geoid);
		// let's hide the original one from the vectorgrid if present
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
	/** get polygon's geometry from the db */
	getPolygonGeometry(geoid, callback) {
		axios.get(`${Config.API_URL}/polygeometry/${geoid}`).then((out) => {
			callback(out.data);
		}).catch((error) => {
			console.error(error);
		})
	}
	/** add a new feature to the map */
	addGeometryLayer(data) {
		L.geoJSON(data, {
			renderer: this.drawnRenderer,
			style: function(feature) {
				return {
					opacity: 0.7,
					color: (feature.properties.approved) ? approvedFill : normalFill,
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
	/** edit a copy of the feature */
	editFeatureCopy(geoid) {
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

	/** get polygon's info from the db */
	getPolygonInfo(geoid, callback) {
		axios.get(`${Config.API_URL}/polyinfo/${geoid}`).then((out) => {
			callback(out.data);
		}).catch((error) => {
			console.error(error);
		})
	}
	/** load polygon's geom and calculate the bbox */
	getPolygonBoundingBox(geoid, callback) {
		axios.get(`${Config.API_URL}/polygeometry/${geoid}`).then((out) => {
			var geojson = JSON.parse(out.data.st_asgeojson);
			var bbox = turfbbox(geojson);
			var corner1 = L.latLng(bbox[1], bbox[0]),
				corner2 = L.latLng(bbox[3], bbox[2]),
				leafletBBox = L.latLngBounds(corner1, corner2);
			callback(leafletBBox);
		}).catch((error) => {
			console.error(error);
		})
	}
	/** save polygon data + comments */
	saveFeature(geoid, comments) {
		// disable edited layer, which also saves the geometry
		try { this.selectedFeature.disableEdit() } catch(e) {}

		// save comments to the db
		axios.post(`${Config.API_URL}/save_comment`, {
			geoid:geoid,
			comments:comments
		}).then((out) => {
			this.map.closePopup(); // close popup
			this.onRequestSuccess(out.data); // show output
		}).catch((err) => {
			alert(err);
		})
	}
	/** zoom to specified bbox */
	zoomToFeature(bbox) {
		this.map.fitBounds(bbox);
	}
	/** change approval status of db features */
	changeApproval(geoid, approval) {
		axios.post(`${Config.API_URL}/change_approval`, {
			geoid:geoid,
			approval:approval
		}).then((out) => {
			this.onRequestSuccess(out.data);
			if (out.data.success) {
				this.onAdminApprovalChange(this.current_user, geoid, approval);
				this.changeApprovalStyling(geoid, approval);
			}
		}).catch((err) => {
			alert(err);
		})
	};
	/** change polygon color depending on the approval status */
	changeApprovalStyling(geoid, approval) {
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


	/** FISHNET ROUTINES */
	/** load fishnet cell's info from the db */
	getFishnetCell(gid, callback) {
		axios.get(`${Config.API_URL}/fishcellinfo/${gid}`).then((out) => {
			callback(out.data);
		}).catch((error) => {
			console.error(error);
		})
	}
	/** change approval status of the fishnet cell */
	changeFishnetStatus(gid, status) {
		axios.post(`${Config.API_URL}/fishnet_change`, {
			gid:gid,
			status:status
		}).then((out) => {
			this.onRequestSuccess(out.data);
			if (out.data.success) {
				this.onAdminFishnetChange(this.current_user, gid, status);
				this.changeFishnetStyling(gid, status);
			}
		}).catch((err) => {
			alert(err);
		})
	};
	/** change the color of the fishnet cell */
	changeFishnetStyling(gid, status) {
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


	/** REMOVING STUFF FROM THE MAP */
	/** remove button */
	handleRemoveButton(geoid) {
		this.removeFeature(geoid, () => {
			this.onGeometryRemove(this.current_user, geoid);
		});
	}
	/** removing feature from the db */
	removeFeature(geoid, callback) {
		// close popup
		this.map.closePopup();

		// remove from the db
		axios.get(`${Config.API_URL}/delete/${geoid}`).then((out) => {
			this.onRequestSuccess(out.data);
			if (out.data.success) { // remove from the map if successfull
				this.removeFeatureVisibly(geoid);
				callback();
			}
		}).catch((error) => {
			console.error(error);
		})
	};
	/** remove feature from the map + hide it on vectorgrid */
	removeFeatureVisibly(geoid) {
		this.drawnItems.eachLayer((layer) => {
			var props = layer.feature.properties;
			if (props.geoid === geoid) {
				this.map.removeLayer(layer);
				this.drawnItems.removeLayer(layer);
			}
		});

		this.pbfLayer.setFeatureStyle(geoid, {color: 'transparent'});
	};

	
	/** Sentinel-Hub */
	/** retrieve sentinel-hub data and recolor the calendar */
	checkCalendarColors() {
		let currentDate = moment(this.mainDOMElement.value, Config.CALENDAR_FORMAT).toDate();
		let currentYear = currentDate.getFullYear();
		let currentMonth = currentDate.getMonth() + 1;
		this.getSentinelHubDates(this.currentBBox, currentYear, currentMonth, (dates) => {
			this.recolorCalendar(this.mainDOM, dates);
		})
	}
	/** request Sentinel-Hub API token */
	getSentinelHubToken(cb) {
		axios.get(`${Config.API_URL}/sh/gettoken`).then((out) => {
			if (out.data === 'success') this.sentinelToken = true;
			if (cb) cb();
		}).catch((error) => {
			console.error(error);
		})
	}
	/** request Sentinel-Hub API token */
	getSentinelHubDates(bbox, year, month, callback) {
		let monthPadded = month.toString().padStart(2,'0');
		let yearAJAX = parseInt(year);
		let lastDay = new Date(yearAJAX, parseInt(month), 0);
		let lastDatePadded = lastDay.getDate().toString().padStart(2,'0');

		if (this.sentinelToken) {
			axios.post(`${Config.API_URL}/sh/getdates`, {
				bbox: bbox,
				datetime: `${year}-${monthPadded}-01T00:00:00Z/${year}-${monthPadded}-${lastDatePadded}T00:00:00Z`,
				collection: "sentinel-2-l2a",
				limit: 50,
			}).then((out) => {
				var data = out.data;
				if (data.features) {
					this.availableDates = data.features;
					callback(data.features);
				}
			});
		}
	}
	/** highlight dates with imagery in the calendar */
	recolorCalendar(dom, dates) {
		console.log('recoloring calendar');
		document.querySelectorAll(`#${dom}_controls > .qs-datepicker-container .qs-num`).forEach((el) => {
			let calendarDay = parseInt(el.innerText);
			let daysArray = dates.map(elem => parseInt(elem.split('-')[2])); // dates -> this.availableDates
			if (daysArray.indexOf(calendarDay) !== -1) {
				el.classList.add('qs-event')
			} else {
				el.classList.remove('qs-event')
			}
		})
	}


	/** Admin markers */
	/** controls, loading and adding them */
	adminMarkerControls() {
		// admin marker red
		const adminMarkerRed = L.Control.extend({
			options: { position: 'bottomleft' },
			onAdd: () => {
				var button = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-custom-button leaflet-adminmarker-red');
					button.onclick = () => {
						this.adminMarkerType = 'red';
						this.markerPlacementMode();
					}
				L.DomEvent.disableClickPropagation(button); // so you can't click through
				return button;
			}
		});
		this.map.addControl(new adminMarkerRed);

		// admin marker green
		const adminMarkerGreen = L.Control.extend({
			options: { position: 'bottomleft' },
			onAdd: () => {
				var button = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-custom-button leaflet-adminmarker-green');
					button.onclick = () => {
						this.adminMarkerType = 'green';
						this.markerPlacementMode();
					}
				L.DomEvent.disableClickPropagation(button);
				return button;
			}
		});
		this.map.addControl(new adminMarkerGreen);
	}
	/** place admin marker and when ok is clicked => replace with a mtype one */
	markerPlacementMode() {
		let okBtn = document.getElementById('admin_marker_ok');
			okBtn.style.display = 'block';

		var center = this.map.getCenter();

		// remove old
		if (this.map.hasLayer(this.adminMarker)) this.adminMarker.removeFrom(this.map);

		// add marker
		this.adminMarker = this.leafletAdminMarker(center, '', this.adminMarkerType);

		// bind tooltip
		this.adminMarker.bindTooltip("Move me!", {permanent: true}).addTo(this.map);

		okBtn.onclick = () => {
			let latlng = this.adminMarker.getLatLng();
			let mid = md5((new Date().getTime()).toString() + this.current_user);
			let date = moment(strToDateUTC(this.mainDOMElement.value)).format(Config.DATE_DB_FORMAT);

			this.saveAdminMarker(latlng, mid, this.adminMarkerType, date, () => {
				// emit to other users
				this.onAdminMarkerSave(latlng, mid, this.adminMarkerType, date);

				// remove temp marker
				this.adminMarker.removeFrom(this.map);

				// add new marker to the layer
				this.saveAdminMarkerVisibly(latlng, mid, this.adminMarkerType, date);

				// hide OK button again
				okBtn.style.display = 'none';
			});
		}
	}

	/** load geojson markers from the database */
	loadAdminMarkers() {
		axios.get(`${Config.API_URL}/load_admin_markers`).then((out) => {
			let data = out.data;
			this.adminMarkers = L.geoJSON(data, {
				pointToLayer: (feature, latlng) => {
					return this.constructAdminMarker(latlng, feature.properties.mid, feature.properties.mtype, feature.properties.date);
				}
			}).addTo(this.map);
			this.layerControl.addOverlay(this.adminMarkers, 'Points of Interest', true);
		}).catch((error) => {
			console.error(error);
		})
	}
	/** save marker to the DB */
	saveAdminMarker(latlng, mid, type, date, callback) {
		let lat = latlng['lat'];
		let lng = latlng['lng'];
		axios.post(`${Config.API_URL}/add_admin_marker`, {
			mid: mid,
			type: type,
			date: date,
			geom: JSON.stringify({type: "Point", coordinates: [lng, lat]}),
		}).then((out) => {
			this.onRequestSuccess(out.data);
			if (out.data.success && callback) callback();
		}).catch((err) => {
			alert('error adding marker', err);
		})
	}
	/** add marker to the map */
	saveAdminMarkerVisibly(latlng, mid, type, date) {
		let newMarker = this.constructAdminMarker(latlng, mid, type, date); 
		this.adminMarkers.addLayer(newMarker);
	}

	/** remove marker from the DB */
	removeAdminMarker(mid, callback) {
		axios.post(`${Config.API_URL}/add_admin_marker`, {mid: mid}).then((out) => {
			this.onRequestSuccess(out.data);
			if (out.data.success && callback) callback();
		}).catch((err) => {
			alert('error adding marker', err);
		})
	}
	/** remove marker from the map */
	removeAdminMarkerVisibly(mid) {
		this.adminMarkers.eachLayer((layer) => {
			if (layer.options.id === mid) {
				this.adminMarkers.removeLayer(layer);
			}
		});
	}
	/** return a leaflet marker depending in its coordinates and type */
	constructAdminMarker(latlng, mid, mtype, date) {
		let marker = this.leafletAdminMarker(latlng, mid, mtype)

		// create remove btn
		let popup = document.createElement('div');
		let dateBlock = document.createElement('div');
			dateBlock.innerText = date;
		let removeBtn = document.createElement('div');
			removeBtn.className = 'popup-marker-remove';
			removeBtn.innerText = 'Remove';
			removeBtn.dataset.mid = mid;
			removeBtn.onclick = () => {
				this.removeAdminMarker(mid, () => {
					this.onAdminMarkerRemove(mid);
					this.removeAdminMarkerVisibly(mid);
				});
			}
		popup.appendChild(dateBlock);
		if (this.userRights) popup.appendChild(removeBtn);

		// bind it to the marker
		marker.bindPopup(popup)

		return marker;
	}
	/** leaflet admin marker */
	leafletAdminMarker(latlng, mid, type) {
		return L.marker(latlng, {
			id: mid,
			draggable: true,
			pane: 'local',
			icon: new L.Icon({
				iconUrl: `./lib/images/color-markers/marker-icon-${type}.png`,
				iconSize: [25, 41],
				iconAnchor: [12, 41],
				popupAnchor: [1, -34]
			})
		});
	}


	/** OTHER STUFF */
	/** canvas points to polygons */
	pointsToPolygon(data) {
		// get coordinates of the topleft map corner
		let nw = this.map.latLngToLayerPoint(this.map.getBounds().getNorthWest());

		// for each polygon
		for (let i = 0; i < data.length ; i++) {
			console.log(data[i]);
			// go over points, convert them to leaflet coordinates and offset based on NW corner
			let latlngs = data[i].map(point => this.map.layerPointToLatLng(L.point(point.x + nw.x, point.y + nw.y)));

			// create a red polygon from an array of LatLng points
			let polygon = L.polygon(latlngs, {color: 'red'})//.addTo(this.map);

			// add on map
			this.drawnItems.addLayer(polygon);
			this.newObjectCreated(polygon);
		}
	}
	/** toggle comparison mode */
	toggleComparing() {
		this.comparisonMode = !this.comparisonMode;
		let secondaryDateWrapper = document.querySelector('.date_secondary_wrapper');
		if (this.comparisonMode) {
			//show second date picker
			secondaryDateWrapper.style.display = 'block';

			// check which imagery is picked atm
			let activeBasemap = this.layerControl.getActiveBaseLayer();
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
			secondaryDateWrapper.style.display = 'none';
			this.map.removeControl(this.comparisonSlider);
			this.map.removeLayer(this.sentinel2_basemap_compare.getLayer());
		}
	}
	/** request all data and save as KML */
	saveKML() {
		// show the spinning loader
		this.spinner.show();

		this.getGeoJSON({}, (data) => {
			// convert geojson to kml
			var kml = tokml(data);

			// init file download
			var element = document.createElement('a');
				element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(kml));
				element.setAttribute('download', `data.kml`);
				element.style.display = 'none';

				document.body.appendChild(element);
				element.click();
				document.body.removeChild(element);

			// hide the spinner once everything is done
			this.spinner.hide();
		})
	}
	/** load geojson of the polygon */
	getGeoJSON(post_data, callback) {
		axios.post(`${Config.API_URL}/load`, post_data).then((out) => {
			callback(out.data);
		}).catch((err) => {
			alert('error loading info', err);
		})
	}
	/** get leaderboards data */
	getLeaderboards(callback) {
		axios.get(`${Config.API_URL}/stats`).then((out) => {
			callback(out.data);
		}).catch((error) => {
			console.error(error);
		})
	}

	/** re-render with new window size */ 
	invalidate() {
		this.map.invalidateSize()
	}
	/** make the map dom element smaller, so the header would fit */
	makeSmaller() {
		this.mapDOM.style.top = '50px';
	}
	/** do after a successful request */
	onRequestSuccess(data) {
		new Toast(
			data.posted,
			(!data.success) ? Toast.TYPE_ERROR : Toast.TYPE_DONE,
			Toast.TIME_NORMAL
		);
	}
}

export default MapSlippy;