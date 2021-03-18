import {API_URL} from '../config';
import axios from 'axios';

/** modal window */
class Modal {
	constructor() {
		this.modal = document.getElementById('modal_wrapper');
		this.content = document.getElementById('modal_content');
		this.close = document.getElementById('modal_close');
		this.close.addEventListener('click', () => { this.hide() });
	}
	/** show admin panel with user management */
	showAdmin(data) {
		this.content.innerHTML = this.adminPage(data);
		this.bindAdminControls();
	}
	/** admin page template */
	adminPage(data) {
		// variables
		var html = '';
		var count = data.length;

		// go over users, but in reverse
		Object.keys(data).reverse().forEach((i) => {
			html += `<tr>
						<td>${count}</td>
						<td>${data[i].username}</td>
						<td>${data[i].reg_time}</td>
					</tr>`;
			count--;
		});
		return `<div class="user_management_content">
					<div id="add_user_panel">
						<input type="text" class="form-control" placeholder="Username" id="add_user_name">
						<input type="text" class="form-control" placeholder="Password" id="add_user_password">
						<div class="btn btn-primary" id="add_user_btn">Add</div>
					</div>
					<table class="table table-striped table-hover">
						<thead>
							<tr>
								<th>#</th>
								<th>Name</th>
								<th>Date Created</th>
							</tr>
						</thead>
						<tbody id="user_list">${html}</tbody>
					</table>
				</div>
				<div class="mass_approval_panel">
					<label for="sector_mass_approval" style="display: block;">Approve all polygons inside of this sector:</label>
					<input type="text" class="form-control" placeholder="Sector id" id="sector_mass_approval">
					<div class="btn btn-primary" id="approve_polygons_in_sector">Do it</div>
				</div>`;
	}
	/** add controls to admin panel */
	bindAdminControls() {
		// mass approve polygons inside a sector
		document.getElementById('approve_polygons_in_sector').addEventListener('click', () => {
			// sector gid
			var gid = document.getElementById('sector_mass_approval').value;
			if (gid) {
				axios.post(`${API_URL}/mass_change_approval`, {
					gid: gid,
					approval: true
				}).then((out) => {
					var data = out.data;
					if (data.success) {
						alert('success!');
					} else {
						alert(data.posted);
					}
				}).catch((error) => {
					console.error(error);
				});
			} else {
				alert('empty gid')
			}
		})

		// add a new user
		document.getElementById('add_user_btn').addEventListener('click', () => {
			let usernameField = document.getElementById('add_user_name');
			let passwordField = document.getElementById('add_user_password');

			let username = usernameField.value;
			let password = passwordField.value;

			if (username && password) {
				axios.post(`${API_URL}/register_new_user`, {
					username: username,
					password: password
				}).then((out) => {
					var data = out.data;
					if (data.success) {
						// get last number
						let lastCount = parseInt(document.querySelectorAll('.table > tbody > tr > td')[0].innerText);

						// prepend new user to the table
						let newUserEntry = `<tr>
												<td>${lastCount+1}</td>
												<td>${username}</td>
												<td>just now</td>
											</tr>`;
						document.getElementById('user_list').append(newUserEntry);

						// reset input fields
						usernameField.value = '';
						passwordField.value = '';
					}
					alert(data.posted);
				}).catch((error) => {
					console.error(error);
				});
			} else {
				alert('empty username or password')
			}
		})
	}
	/** show modal */
	show() {
		this.modal.style.display = 'block';
	}
	/** hide modal */
	hide() {
		this.modal.style.display = 'none';
	}
}

export default Modal;