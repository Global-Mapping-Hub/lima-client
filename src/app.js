import liveMonitoringMap from './elements/map';
import {adminPage, userEntry} from './utils';
import {apiUrl} from './config';

export default class App {
	constructor(userDetails) {
		// user permissions check | there is always a server check
		this.userRights = userDetails.editor;

		// map init
		this.map = new liveMonitoringMap(userDetails);
		this.map.initBasemaps();
		this.map.initControls();
		this.map.initVectorData();
		this.map.initLDraw();
		this.map.initVectorGridReload();

		// current feature index to click through them
		this.featureIndex = 0;

		// show top panel if user is an admin, there is also a server-side check
		if (this.userRights) {
			// show header
			$('#header_wrapper').show();
			$('#map_new').css('top','50px');
			
			// show user management button
			$('#header_admin').show();
		}
	}

	initControls() {
		//==============================//
		// header buttons + admin panel //
		//==============================//
		$('#header_logout').on('click', () => {
			$.get(`${apiUrl}/logout`, (data) => {
				window.location.reload()
			});
		});
		$('#header_admin').on('click', () => {
			$.get(`${apiUrl}/load_users`, (data) => {
				if (data.success) {
					$('#modal_wrapper').show();
					$('#modal_content').html(adminPage(data.posted));
				} else {
					alert(data.posted);
				}
			});
		});
		// modal close button
		$('#modal_close').on('click', () => {
			$('#modal_wrapper').hide();
		})
		// mass approve polygons inside a sector
		$('body').on('click', '#approve_polygons_in_sector', () => {
			// sector gid
			var gid = $('#sector_mass_approval').val();
			if (gid) {
				// send request to an endpoint
				$.ajax({
					type: 'POST',
					url: `${apiUrl}/mass_change_approval`,
					dataType: 'json',
					data: {gid: gid, approval: true},
					success: (data) => {
						if (data.success) {
							alert('success!');
						} else {
							alert(data.posted);
						}
					},
					error: (XMLHttpRequest, textStatus, errorThrown) => {
						alert(`error: ${errorThrown}`);
					}
				});
			} else {
				alert('empty gid')
			}
		})
		// add a new user
		$('body').on('click', '#add_user_btn', () => {
			// get entered username and password
			var username = $('#add_user_name').val();
			var password = $('#add_user_password').val();

			// check if fields are not empty
			if (username && password) {
				// send request to an endpoint
				$.ajax({
					type: 'POST',
					url: `${apiUrl}/register_new_user`,
					dataType: 'json',
					data: {username: username, password: password},
					success: (data) => {
						if (data.success) {
							// get last number
							let lastCount = parseInt($('.table > tbody > tr > td')[0].innerText);

							// prepend new user to the table
							let newUserEntry = userEntry(lastCount+1, {username: username, reg_time: 'just now', editor: false});
							$('tbody').prepend(newUserEntry);

							// reset input fields
							$('#add_user_name').val('');
							$('#add_user_password').val('');
						}
						alert(data.posted);
					}
				});
			} else {
				alert('empty username or password')
			}
		})

		//=========================
		// close/open messages log
		$('#log_close').on('click', () => {
			$('#messages').hide();
			$('#log_open').show();
		});
		$('#log_open').on('click', () => {
			$('#messages').show();
			$('#log_open').hide();
		});

		// ===========================
		// save KMLs
		$('#btn_saveKML').on('click', () => {
			this.map.saveKML();
		});

		// =========================
		// search by geoid on enter
		$('#geoid_search').keypress((e) => {
			if (e.which == 13) {
				var geoid = $('#geoid_search').val();
				this.map.getPolygonBoundingBox(geoid, (bbox) => {
					this.map.zoomToFeature(bbox);
				});
				return false;
			}
		});

		//=====================//
		// shortcuts | hotkeys //
		//=====================//
		document.onkeyup = (e) => {
			// if search window or popup are not open
			if (!(
				$('input.search-input').is(':visible') ||
				$('.popup_textarea').is(':visible') ||
				$('#modal_wrapper').is(':visible')
			)) {
				if (e.code) {
					//todo: rewrite
					if (e.code === 'KeyD') $('.leaflet-draw-draw-polygon')[0].click();
					else if (e.code === 'Backspace') $('.leaflet-draw-actions > li > a')[1].click();
					/*
					if (e.code === 'KeyD') this.map.initPolygonDrawing();
					else if (e.code === 'Backspace') this.map.removeLastPolygonVertex();
					else if (e.code.includes('Digit')) {
						var digit = parseInt(e.code.substr(e.code.length - 1));
						$('.leaflet-control-layers-selector')[digit-1].click();
					}
					*/
				}
			}
		}
		// ctrl+z
		document.onkeydown = (e) => {
			var evtobj = window.event? event : e
			if (evtobj.keyCode == 90 && evtobj.ctrlKey) {
				$('.leaflet-draw-actions > li > a')[1].click(); 
			}
		}


		//================//
		// popup controls //
		//================//
		// save feature (and comments)
		$('#map_new').on('click', '.btn-save', (e) => {
			var id = e.target.dataset.id;
			var text = $(`#txt_${id}`).val();
			var approval = $(`#approval_${id}`).val();

			this.map.saveFeature(id, text);
			if (this.userRights) this.map.changeApproval(id, approval);
		});
		// edit geometry
		$('#map_new').on('click', '.btn-edit-geometry', (e) => {
			var id = e.target.dataset.id;
			this.map.editFeature(id);
		});
		// remove feature
		$('#map_new').on('click', '.btn-remove', (e) => {
			var id = e.target.dataset.id;
			this.featureIndex--;
			this.map.handleRemoveButton(id);
		});

		// save da fishy net mon
		$('#map_new').on('click', '.btn-save-fishnet', (e) => {
			var gid = e.target.dataset.gid;
			var status = $(`#fishnet_done_${gid}`).val();
			this.map.changeFishnetStatus(gid, status);
		});
	}
}