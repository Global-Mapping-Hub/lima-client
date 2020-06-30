import App from './app';

$(function() {
	$.get('/api/monlive/user', function(data) {
		if (data.user) {
			// hide login form
			$('#login_form').hide();

			// show css loader
			$('#spinner_wrapper').show();

			// init our application
			let app = new App(data.user);
				app.initControls();

			// set username
			$('#header_username').html(data.user.username);
		} else {
			// user is not logged in, check url params
			const urlParams = new URLSearchParams(window.location.search);
			const info = urlParams.get('info');
			if (info) {
				$('#error-message').html(info);
				$('#error-message').show();
			}
		}
	});
});

