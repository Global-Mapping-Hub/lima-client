import moment from 'moment';
import {MOMENT_FORMAT} from '../config';

/** convert string to UTC date */
export function strToDateUTC(str) {
	var date = moment(str, MOMENT_FORMAT).toDate();
	return new Date(date - date.getTimezoneOffset()*60*1000);
}

/** wrapping the dateline */
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