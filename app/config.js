// where your server part is hosted
export const API_URL = '/api/monlive';
export const SOCKET_URL = `${API_URL}/socket.io`;

// vector tiles retrieved from the PostgreSQL DB
export const VTILES_NAME = `monitoring.ba2020_winter`;
export const VTILES_URL = `https://maps.greenpeace.org/api/vtiles/${VTILES_NAME}/{z}/{x}/{y}.pbf`;

// Sentinel-2 WMS url
export const S2_WMS = 'https://services.sentinel-hub.com/ogc/wms/1fb23233-58fc-44dd-8a30-342ae7d1d084';

// hotspots, ArcGIS url
export const ARCGIS_HOTSPOTS = 'https://maps.greenpeace.org/arcgis/rest/services/wms/russia_hotspots_winter_2020/MapServer/0';

// if you don't know what this is, do not touch
export const MAP_ID = 'map';
export const CALENDAR_FORMAT = 'dd.mm.yy';
export const MOMENT_FORMAT = 'DD.MM.YYYY';
export const DATE_DB_FORMAT = 'YYYY-MM-DD';

// polygon styling
export const POLYGON_DEFAULT_STTYLING = {
	fill: true,
	weight: 2,
	fillOpacity: 0.2,
	opacity: 0.7
}