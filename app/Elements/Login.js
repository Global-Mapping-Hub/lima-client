import {API_URL} from '../config';

/** Login form */
class LoginForm {
	constructor() {
		this.form = document.getElementById('login_form');
		this.form.innerHTML = this.getFormContent();
	}
	/** generate login form */
	getFormContent() {
		return `<form action="${API_URL}/login" method="post">
					<div class="title">
						<h3>Login</h3>
					</div>
					<div class="field">
						<label>Username:</label>
						<input type="text" name="username" />
					</div>
					<div class="field">
						<label>Password:</label>
						<input type="password" name="password" required />
					</div>

					<div class="field">
						<input class="submit-btn" type="submit" value="Submit" required />
					</div>
					<label id="error-message"></label>
				</form>`;
	}
	/** hide login form */
	hide() {
		this.form.style.display = 'none';
	}
}

export default LoginForm;