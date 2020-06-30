<!DOCTYPE html>
<html>
	<head>
		<title>Lima - Live mapping</title>
		<meta charset="utf-8"/>
		<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
		
		<script src="dist/jquery.min.js"></script>
		<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.js"></script>

		<script src="dist/leaflet/leaflet.js"></script>
		<script src="dist/leaflet/esri-leaflet.js"></script>
		<script src="dist/leaflet/leaflet.ajax.min.js"></script>
		<script src="dist/leaflet/leaflet.bing.js"></script>
		<script src="dist/leaflet/tokml.js"></script>
		<script src="dist/leaflet/togeojson.js"></script>
		<script src="dist/leaflet/leaflet.draw.js"></script>
		<script src="dist/leaflet/Leaflet.Editable.js"></script>
		<script src="dist/leaflet/leaflet.sbs.js"></script>
		<script src="dist/leaflet/leaflet.active-layers.min.js"></script>
		<script src="dist/leaflet/leaflet-search.src.js"></script>
		<script src="dist/leaflet/leaflet-hash.js"></script>
		<script src="dist/leaflet/leaflet-pip.js"></script>
		<script src="dist/leaflet/Leaflet.VectorGrid.bundled.min.js"></script>

		<script src="dist/turf.min.js"></script>
		<script src="dist/moment.js"></script>
		<script src="dist/md5.min.js"></script>
		<script src="dist/socket.io/socket.io.js"></script>
		
		<link rel="stylesheet" href="lib/leaflet.css"/>
		<link rel="stylesheet" href="lib/leaflet.draw.css"/>
		<link rel="stylesheet" href="lib/leaflet-search.min.css"/>
		<link rel="stylesheet" href="lib/style.css"/>
		<link rel="stylesheet" href="//code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">
		<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css" integrity="sha384-HSMxcRTRxnN+Bdg0JdbxYKrThecOKuH5zCYotlSAcp1+c8xmyTe9GYg1l9a69psu" crossorigin="anonymous">
	</head>
	<body>
		<!-- login form -->
		<div id="login_form">
			<form action="/api/monlive/login" method="post">
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
			</form>
		</div>

		<!-- css spinner -->
		<div id="spinner_wrapper">
			<div class="spinner">
				<div class="rect1"></div>
				<div class="rect2"></div>
				<div class="rect3"></div>
				<div class="rect4"></div>
				<div class="rect5"></div>
			</div>
		</div>

		<!--  -->
		<div id="global_error" class="alert alert-danger">placeholder</div>

		<!-- modal with leaderboards -->
		<div id="modal_wrapper">
			<div id="modal_inner">
				<span id="modal_close">&times;</span>
				<div id="modal_content"></div>
			</div>
		</div>

		<div id="header_wrapper">
			<div id="header">
				<div id="header_welcome">Hello, <span id="header_username">username</span></div>
				<div id="header_buttons">
					<div id="header_admin" class="header_btn">Admin panel</div>
					<div id="btn_saveKML" class="header_btn">Save KML</div>
					<div id="header_logout" class="header_btn">Logout</div>
				</div>
				<div id="header_search">
					<div style="font-size: .6em;" class="field">
						<label>GeoID Search:</label>
						<input type="text" id="geoid_search" name="geoid">
					</div>
				</div>
			</div>
		</div>

		<!-- messages log -->
		<div id="messages_wrapper">
			<div id="danger" class="alert alert-danger" style="display:none;"></div>
			<div id="success" class="alert alert-success" style="display:none;"></div>

			<div id="messages">
				<div id="log_close">×</div>
				<div id="messages_log"></div>
			</div>
		</div>
		<!-- open messages log -->
		<div id="log_open">full log</div>

		<!-- map element -->
		<div id="map_new"></div>
	</body>
	<script type="module" src="./src/main.js"></script>
</html>