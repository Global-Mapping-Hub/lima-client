/** fishnet popup */
class FishnetPopup {
	constructor(props) {
		this.onSave = props.onSave;
	}
	
	/** return popup content */
	generateContent(props, editor) {
		let popup = document.createElement('div');
			popup.innerHTML = this.createPopupEntries({
				'GID': props.gid,
				'Done': props.done,
			});

		let fishnetSelect = document.createElement('select');
			fishnetSelect.id = `fishnet_done_${props.gid}`;
			fishnetSelect.innerHTML = `
				<option ${(props.done) ? 'selected' : ''} value="true">Yes</option>
				<option ${(!props.done) ? 'selected' : ''} value="false">No</option>
			`;

		let saveBtn = document.createElement('div');
			saveBtn.className = `btn btn-success`;
			saveBtn.id = "btn-save-fishnet";
			saveBtn.innerText = 'Save';

		// save fishnet cell
		saveBtn.addEventListener('click', (e) => {
			let gid = props.gid;
			let status = fishnetSelect.value;
			this.onSave(gid, status);
		})

		// append everything
		if (editor) {
			popup.appendChild(fishnetSelect);
			popup.appendChild(saveBtn);
		}

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

export default FishnetPopup;