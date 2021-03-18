/** leaderboards */
export function dataToTables(data) {
	// lets check the area stats first
	var tableArea = '';
	data.area.forEach((el) => {
		tableArea += `<tr><td>${el.owner}</td><td>${el.area}</td></tr>`
	});
	tableArea = `<table class="table leaderboard">
					<thead class="thead-custom">
						<tr><th scope="col">Username</th><th scope="col">Area, ha</th></tr>
					</thead>
					<tbody>${tableArea}</tbody>
				</table>`

	// and then the polygon count
	var tableCount = '';
	data.count.forEach((el) => {
		tableCount += `<tr><td>${el.owner}</td><td>${el.count}</td></tr>`
	});
	tableCount = `<table class="table leaderboard">
					<thead class="thead-custom">
						<tr><th scope="col">Username</th><th scope="col">Count, ha</th></tr>
					</thead>
					<tbody>${tableCount}</tbody>
				</table>`
	return `${tableArea} ${tableCount}`;
}

/** user management page */
export function adminPage(data) {
	// variables
	var html = '';
	var count = data.length;

	// go over users, but in reverse
	Object.keys(data).reverse().forEach((i) => {
		html += userEntry(count, data[i]);
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
					<tbody>${html}</tbody>
				</table>
			</div>
			<div class="mass_approval_panel">
				<label for="sector_mass_approval" style="display: block;">Approve all polygons inside of this sector:</label>
				<input type="text" class="form-control" placeholder="Sector id" id="sector_mass_approval">
				<div class="btn btn-primary" id="approve_polygons_in_sector">Do it</div>
			</div>`;
}

/** template for a new user's entry in the admin panel */
export function userEntry(count, data) {
	return `<tr>
				<td>${count}</td>
				<td>${data.username}</td>
				<td>${data.reg_time}</td>
			</tr>`
}