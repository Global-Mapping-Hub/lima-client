import moment from 'moment';

/** custom leaflet popup */
class PolygonPopup {
	constructor(props) {
		this.onSaveClick = props.onSaveClick;
		this.onEditClick = props.onEditClick;
		this.onRemoveClick = props.onRemoveClick;
	}
	
	/** return polygon popup content */
	generateContent(feature, username, editor) {
		this.feature = feature;
		this.dateFormatted = moment(this.feature.date).format('YYYY-MM-DD');

		// check if edit button should be disabled
		this.editButtons = true;

		// first lets check if user is an editor, that solves everything usually :)
		// if user is not an editor
		if (!editor) {
			// now check if the feature is approved or if the user is not the the owner of this feature
			if (this.feature.approved || this.feature.owner !== username) this.editButtons = false;
		}

		let popup = document.createElement('div');
			popup.innerHTML = this.createPopupEntries({
				'ID': this.feature.id,
				'GeoID': this.feature.geoid,
				'Area': this.feature.area,
				'Date': this.dateFormatted,
				'Created by': this.feature.owner,
				'Approved': this.feature.approved
			});

		let approvalSelect = document.createElement('select');
			approvalSelect.id = `approval_${this.feature.geoid}`;
			approvalSelect.innerHTML = `
				<option ${(this.feature.approved) ? 'selected' : ''} value="true">Yes</option>
				<option ${(!this.feature.approved) ? 'selected' : ''} value="false">No</option>
			`;

		let textarea = document.createElement('textarea');
			textarea.className = 'popup_textarea';
			textarea.id = `txt_${this.feature.geoid}`;
			textarea.rows = 3;
			textarea.innerText = `${this.feature.comments}`;

		let saveBtn = document.createElement('div');
			saveBtn.className = `btn btn-success`;
			saveBtn.id = "btn-save";
			saveBtn.innerText = 'Save feature';

		let editBtn = document.createElement('div');
			editBtn.className = `btn btn-warning`;
			editBtn.id = "btn-edit-geometry";
			editBtn.innerText = 'Edit geometry';

		let removeBtn = document.createElement('div');
			removeBtn.className = `btn btn-danger`;
			removeBtn.id = "btn-remove";
			removeBtn.innerText = 'Delete';

		// save feature (and comments)
		saveBtn.addEventListener('click', (e) => {
			let id = this.feature.geoid;
			let text = textarea.value;
			let approval = approvalSelect.value;

			this.onSaveClick(id, text, approval);
		})

		// edit geometry
		editBtn.addEventListener('click', (e) => {
			this.onEditClick(this.feature.geoid);
		})

		// remove feature
		removeBtn.addEventListener('click', (e) => {
			this.onRemoveClick(this.feature.geoid);
		})

		// append everything
		if (editor) popup.appendChild(approvalSelect);
		popup.appendChild(textarea);
		popup.appendChild(saveBtn);
		if (this.editButtons) popup.appendChild(editBtn);
		if (this.editButtons) popup.appendChild(removeBtn);

		return popup;
	}

	/** create simple popup element */
	createPopupEntries(obj) {
		let html = '';
		for (const [key, value] of Object.entries(obj)) {
			html += `<div><strong>${key}</strong>: ${value}</div>`;
		}
		return html;
	}
}

export default PolygonPopup;