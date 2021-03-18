import 'leaflet/dist/leaflet.css';
import 'leaflet-search/dist/leaflet-search.min.css';
import '../lib/bootstrap.min.css';
import '../lib/style.css';

import {API_URL} from './config';
import axios from 'axios';

import LoginForm from './Elements/Login';
import Spinner from './Elements/Spinner';
import GlobalError from './Elements/GlobalError';

import MapLive from './Map/MapLive';
import Header from './Elements/Header';
import Modal from './Elements/Modal';

import MagicModal from './Elements/MagicModal';

const login = new LoginForm();
const spinner = new Spinner();
const globalError = new GlobalError();

/** main app */
class App {
	constructor(userDetails) {
		// user permissions check | there is always a server check
		this.userRights = userDetails.editor;

		// map init
		this.map = new MapLive(userDetails);

		// spinner
		this.spinner = new Spinner();

		// header and modal
		this.modal = new Modal();
		this.header = new Header({
			onLogoutClick: () => {
				window.location.reload();
			},
			onAdminPanelClick: (data) => {
				this.modal.showAdmin(data);
				this.modal.show();
			},
			onSaveKMLClick: () => {
				this.map.saveKML();
			},
			onGeoidSearch: (geoid) => {
				this.map.getPolygonBoundingBox(geoid, (bbox) => {
					this.map.zoomToFeature(bbox);
				});
			}
		});
		this.header.setUsername(userDetails.username);
		this.header.initControls();


		// show top panel if user is an admin, there is also a server-side check
		if (this.userRights) {
			this.header.show();
			this.header.showAdmin();
			this.map.makeSmaller();
		}


		// magic wand modal
		this.magicModal = new MagicModal({
			onInit: () => { this.spinner.show() },
			onTraceSuccess: (data) => { this.map.pointsToPolygon(data) },
			onEnd: () => { this.spinner.hide() }
		});

		// set map events
		this.map.setEvents({
			onMagicControl: () => {
				this.magicModal.init();
			}
		})
	}
}

/** request user and check if he logged in */
axios.get(`${API_URL}/user`).then((out) => {
	let data = out.data;
	if (data.user) {
		login.hide();
		spinner.show();

		// init our application
		new App(data.user);
	} else {
		// user is not logged in, check url params
		let urlParams = new URLSearchParams(window.location.search);
		let info = urlParams.get('info');
		if (info) {
			globalError.setText(info);
			globalError.show();
		}
	}
}).catch((error) => {
	console.error(error);
})