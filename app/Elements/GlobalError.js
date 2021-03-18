/** global error messages for timeouts or connection issues */
class GlobalError {
	constructor() {
		this.block = document.getElementById('global_error');
	}
	/** set error text */
	setText(error) {
		this.block.innerText = error;
	}
	/** show error window */
	show() {
		this.block.style.display = 'block';
	}
	/** hide error window */
	hide() {
		this.block.style.display = 'none';
	}
}

export default GlobalError;