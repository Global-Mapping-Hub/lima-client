import io from 'socket.io-client';
import md5 from 'md5';
import axios from 'axios';
import 'leaflet-search';

import MapSlippy from './MapSlippy';
import FishnetPopup from './FishnetPopup';
import {API_URL, SOCKET_URL} from '../config';

// fishnet styling
const doneFish = '#3caf50';
const rawFish = '#2388ff';

// socket.io init
const socket = io({path: (API_URL) ? SOCKET_URL : ''});
const mouseSocket = io('/micemove', {path: (API_URL) ? SOCKET_URL : ''});

/** map class with sockets logic */
class MapLive extends MapSlippy {
	constructor(userDetails) {
		// set events
		super({
			userRights: userDetails.editor,
			onGeometryAddEmit: (user, geojson) => {
				socket.emit('user_created_geometry', user, geojson);
			},
			onAdminApprovalChange: (user, geoid, approval) => {
				socket.emit('admin_changed_approval', user, geoid, approval);
			},
			onGeometryRemove: (user, geoid) => {
				socket.emit('user_removed_geometry', user, geoid);
			},
			onAdminFishnetChange: (user, gid, status) => {
				socket.emit('admin_changed_fishnet', user, gid, status);
			},
			onAdminMarkerSave: (latlng, mid, markerType, date) => {
				socket.emit('admin_added_marker', latlng, mid, markerType, date);
			},
			onAdminMarkerRemove: (mid) => {
				socket.emit('admin_removed_marker', mid);
			}
		});

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

		// load the fishnet on map init
		this.loadFishnet(() => {
			// fishnet search control
			this.addFishnetSearchControl();

			// set params
			this.map.on('draw:drawstart', () => { this.drawingEnabled = true; });
			this.map.on('draw:drawstop', () => { this.drawingEnabled = false; });
			this.map.on('editable:enable', () => { this.drawingEnabled = true; });
		});

		// custom gp & gmh attribution
		this.map.attributionControl.addAttribution('<a href="https://greenpeace.ru/">Greenpeace</a> / <a href="https://maps.greenpeace.org/">Global Mapping Hub</a>');
	}

	/** load fishnet routine */
	loadFishnet(callback) {
		axios.get(`${API_URL}/load_fishnet`).then((out) => {
			var data = out.data;
			this.fishnetLayer = L.geoJSON(data, {
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
			this.layerControl.addOverlay(this.fishnetLayer, 'Sectors', true);

			// on fishnet cell click
			this.fishnetLayer.on('click', (e) => {
				var props = e.layer.feature.properties;
				this.getFishnetCell(props.gid, (data) => {
					// create a new popup instance
					let popup = new FishnetPopup({
						onSave: (gid, status) => {
							this.changeFishnetStatus(gid, status);
						}
					});
					// generate content
					let popupContent = popup.generateContent(data, this.userRights);

					// create and open a new popup
					L.popup()
						.setLatLng(e.latlng)
						.setContent(popupContent)
						.openOn(this.map);
				});
			});

			if (callback) callback();
		}).catch((error) => {
			console.error(error);
		})
	}

	/** add fishnet search control */
	addFishnetSearchControl() {
		this.searchControl = new L.Control.Search({
			layer: this.fishnetLayer,
			propertyName: 'gid',
			marker: false,
			moveToLocation: function(latlng, title, map) {
				//map.fitBounds( latlng.layer.getBounds() );
				var zoom = map.getBoundsZoom(latlng.layer.getBounds());
				map.setView(latlng, zoom); // access the zoom
			}
		})
		this.map.addControl(this.searchControl);
	}

	/** mouse movement update */
	mouseMovements() {
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

	/** initialize all the network events */
	initEvents() {
		// show user mice
		const mousePointer = L.icon({ iconUrl: './lib/images/mouse.png', iconSize: [20, 30], iconAnchor: [0, 0]});
		mouseSocket.on('user_mouse_update', (socket_user, socket_user_addition, lat, lng) => {
			// if emitted user is not current user or if username is the same but the special md5 addition is different (other tab or browser window)
			if ((this.current_user !== socket_user) || (this.current_user === socket_user && this.userAddition !== socket_user_addition)) {
				// add a new user to the feature layer
				// TODO: rewrite=========================================
				const tooltipText = `${socket_user}` // (${socket_user_addition})`;
				const userID = `${socket_user}_${socket_user_addition}`;
				if (this.user_pointers.getLayers().length == 0) {
					var marker = L.marker([lat, lng], {icon:mousePointer, userid:userID});
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
						var marker = L.marker([lat, lng], {icon:mousePointer, userid:userID});
							marker.bindTooltip(tooltipText, {permanent: true});
							marker.addTo(this.user_pointers);
						//console.log('create new marker');
					}
				}
			}
		});

		/** show other users' geometry */
		socket.on('user_created_geometry', (socket_user, geojson) => {
			this.addGeometryLayer(geojson, socket_user);
		});

		/** remove geometry removed by other users */
		socket.on('user_removed_geometry', (socket_user, geoid) => {
			this.removeFeatureVisibly(geoid);
		});

		/** change styling of the feature approved by an admin */
		socket.on('admin_changed_approval', (socket_user, geoid, approved) => {
			this.changeApprovalStyling(geoid, approved);
		});

		/** change styling of the fishnet cell changed by an admin */
		socket.on('admin_changed_fishnet', (socket_user, geoid, approved) => {
			if (this.current_user !== socket_user) {
				this.changeFishnetStyling(geoid, approved);
			}
		});

		/** admin added a marker */
		socket.on('admin_added_marker', (latlng, mid, type, date) => {
			this.saveAdminMarkerVisibly(latlng, mid, type, date);
		});
		/** admin removed a marker */
		socket.on('admin_removed_marker', (mid) => {
			this.removeAdminMarkerVisibly(mid);
		});
		

		/** on timeout, when server restart, show an error message */
		socket.on('connect_error', (error) => { //connect_timeout
			console.log('connect_error ', error);
			//$('#global_error').html('Losing connection, please reload the page')
			//$('#global_error').show();
		});

		socket.on('reconnect', (attemptNumber) => {
			//$('#global_error').hide();
		});
	}
}

export default MapLive;