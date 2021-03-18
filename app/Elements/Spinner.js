/**  spinner loader thingy */
class Spinner {
	constructor() {
		this.spinner = document.getElementById('spinner_wrapper');
	}
	/** show loading progress */
	show() {
		this.spinner.style.display = 'block';
	}
	/** hide the spinner */
	hide() {
		this.spinner.style.display = 'none';
	}
}

export default Spinner;