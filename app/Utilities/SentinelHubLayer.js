import moment from 'moment';
import {S2_WMS} from '../config';

/** Custom WMS layers */
class SentinelHubLayer {
	constructor(date, pane, usr_layers) {
		this.date = date;
		this.layer = L.tileLayer.wms(S2_WMS, {
			layers: (usr_layers) ? usr_layers : 'TRUE-COLOR',
			TIME: `${this.date}/${this.date}`,
			WARNINGS: 'YES', // in-image warnings, like "No data available for the specified area"
			MAXCC: 100, // the maximum allowable cloud coverage in percent
			format: 'image/jpg',
			transparent: false,
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

export default SentinelHubLayer;