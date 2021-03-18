import {API_URL} from '../config';
import axios from 'axios';

/** header panel with buttons */
class Header {
	constructor(props) {
		//events
		this.onLogoutClick = props.onLogoutClick;
		this.onAdminPanelClick = props.onAdminPanelClick;
		this.onSaveKMLClick = props.onSaveKMLClick;
		this.onGeoidSearch = props.onGeoidSearch;

		// dom elements
		this.header = document.getElementById('header_wrapper');
		this.usernameField = document.getElementById('header_username');

		// buttons
		this.adminButton = document.getElementById('header_admin');
		this.logoutButton = document.getElementById('header_logout');
		this.saveKML = document.getElementById('btn_saveKML');
		this.geoidSearch = document.getElementById('geoid_search');

		// set username
		this.setUsername(props.username)
	}
	/** init button routines */
	initControls() {
		// logout
		this.logoutButton.addEventListener('click', () => {
			axios.get(`${API_URL}/logout`).then(() => {
				this.onLogoutClick();
			}).catch((error) => {
				console.error(error);
			})
		});
		
		// 'admin panel' button
		this.adminButton.addEventListener('click', () => {
			axios.get(`${API_URL}/load_users`).then((out) => {
				var data = out.data;
				if (data.success) {
					this.onAdminPanelClick(data.posted);
				}
			}).catch((error) => {
				console.error(error);
			})
		});

		// 'save KML' button
		this.saveKML.addEventListener('click', () => {
			this.onSaveKMLClick();
		});
		
		// search by geoid
		this.geoidSearch.addEventListener('keydown', (e) => {
			if (e.keyCode == 13) {
				let geoid = e.target.value;
				this.onGeoidSearch(geoid);
				return false;
			}
		});
	}
	/** set header username */
	setUsername(username) {
		this.usernameField.innerText = username;
	}
	/** show header */
	show() {
		this.header.style.display = 'block';
	}
	/** hide header */
	hide() {
		this.header.style.display = 'none';
	}
	/** show admin button */
	showAdmin() {
		this.adminButton.style.display = 'block';
	}
	/** hide admin button */
	hideAdmin() {
		this.adminButton.style.display = 'none';
	}
}

export default Header;