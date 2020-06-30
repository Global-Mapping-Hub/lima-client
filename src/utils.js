/* ============== */
/* vars to export */
/* ============== */
export const DATE_FORMAT = 'dd.mm.yy';


/* ================= */
/* custom wms layers */
/* ================= */
export class SentinelHubLayer {
	constructor(wms_layer, pane, usr_layers) {
		var startDate = strToDateUTC($('#date_main').val());
		this.date = moment(startDate).format('YYYY-MM-DD');

		this.layer = L.tileLayer.wms(wms_layer, {
			layers: (usr_layers) ? usr_layers : 'TRUE-COLOR',
			TIME: `${this.date}/${this.date}`,
			WARNINGS: 'YES', // in-image warnings, like "No data available for the specified area"
			MAXCC: 50, // the maximum allowable cloud coverage in percent
			format: 'image/png',
			attribution: '&copy; <a href="https://sentinel-hub.com/">Sentinel-Hub</a> &copy; <a href="https://www.copernicus.eu/en">Copernicus</a>',
			pane: pane
		});
	}
	getLayer() {
		return this.layer;
	}
	setDate(newDate) {
		this.date = moment(newDate).format('YYYY-MM-DD');
		this.layer.setParams({TIME: `${this.date}/${this.date}`}, false);
	}
	setLayers(newLayer) {
		this.layer.setParams({layers: newLayer}, false);
	}
}


/* ========================= */
/* custom tooltip generators */
/* ========================= */
export function tooltipGen(p, username, editor) {
	// format the date
	var dateFormatted = moment(p.date).format('YYYY-MM-DD');

	// check if edit button should be disabled
	var editButtons = true;
	
	// first lets check if user is an editor, that solves everything usually :)
	// if user is not an editor
	if (!editor) {
		// now check if the feature is approved or if the user is not the the owner of this feature
		if (p.approved || p.owner !== username) {
			editButtons = false
		}
	}

	return `
		<div><strong>ID</strong>: ${p.id}</div>
		<div><strong>GeoID</strong>: ${p.geoid}</div>
		<div><strong>Area</strong>: ${p.area}</div>
		<div><strong>Date</strong>: ${dateFormatted}</div>
		<div><strong>Created by</strong>: ${p.owner}</div>
		<div><strong>Approved</strong>: ${p.approved}</div>

		${(editor) ?	`<select id="approval_${p.geoid}">
							<option ${(p.approved) ? 'selected' : ''} value="true">Yes</option>
							<option ${(!p.approved) ? 'selected' : ''} value="false">No</option>
						</select>` : ''}

		<div><textarea class="popup_textarea" id="txt_${p.geoid}" rows="3">${p.comments}</textarea></div>

		<div class="btn btn-success btn-save" data-id="${p.geoid}">Save feature</div>

		${(!editButtons) ? '' : `<div class="btn btn-warning btn-edit-geometry " data-id="${p.geoid}">Edit geometry</div>`}
		${(!editButtons) ? '' : `<div class="btn btn-danger btn-remove" data-id="${p.geoid}">Delete</div>`}
	`
}

// generate a custom tooltip for a fishnet
export function fishnetTooltipGen(p, editor) {
	return `
		<div><strong>GID</strong>: ${p.gid}</div>
		<div><strong>Done</strong>: ${p.done}</div>
		${(editor) ? `<select id="fishnet_done_${p.gid}">
						<option ${(p.done) ? 'selected' : ''} value="true">Yes</option>
						<option ${(!p.done) ? 'selected' : ''} value="false">No</option>
					</select>
					<div class="btn btn-success btn-save-fishnet" data-gid="${p.gid}">Save</div>` : ''}
	`
}


/* ============ */
/* leaderboards */
/* ============ */
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



/* ==================== */
/* user management page */
/* ==================== */
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
export function userEntry(count, data) {
	return `<tr>
				<td>${count}</td>
				<td>${data.username}</td>
				<td>${data.reg_time}</td>
			</tr>`
}


/* ===== */
/* Other */
/* ===== */
// convert string to UTC date
export function strToDateUTC(str) {
	var date = $.datepicker.parseDate(DATE_FORMAT, str);
	return new Date(date - date.getTimezoneOffset()*60*1000);
}

// dateline fixes
export function dateline(coords) {
	longitude = coords[0];
	latitude = coords[1];
	var latlng = L.latLng(latitude, longitude);
	if (longitude <= 0) {
		var new_latlng = L.latLng(coords[1], coords[0] + 360);
		return new_latlng;
	}
	else {
		return latlng.wrap();
	}
}