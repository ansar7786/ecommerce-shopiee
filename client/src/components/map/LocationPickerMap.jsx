import { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default Leaflet icon paths in Vite / React bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Helper component to auto-recenter map when coordinates change
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  useEffect(() => {
    // Invalidate size on mount to avoid grey tiles in drawers/steppers
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

MapUpdater.propTypes = {
  center: PropTypes.arrayOf(PropTypes.number).isRequired,
};

// Component to handle clicking on the map to place marker
const MapEventsHandler = ({ onSelectPosition, readOnly }) => {
  useMapEvents({
    click(e) {
      if (!readOnly && onSelectPosition) {
        onSelectPosition({
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.lng.toFixed(6)),
        });
      }
    },
  });
  return null;
};

MapEventsHandler.propTypes = {
  onSelectPosition: PropTypes.func,
  readOnly: PropTypes.bool,
};

export const LocationPickerMap = ({
  latitude = 16.3477,
  longitude = 81.0457,
  radiusKm = 3,
  onChange,
  readOnly = false,
  height = '280px',
}) => {
  const markerRef = useRef(null);

  const position = useMemo(() => {
    const lat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : 16.3477;
    const lng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : 81.0457;
    return [lat, lng];
  }, [latitude, longitude]);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null && onChange) {
          const latLng = marker.getLatLng();
          onChange({
            latitude: Number(latLng.lat.toFixed(6)),
            longitude: Number(latLng.lng.toFixed(6)),
          });
        }
      },
    }),
    [onChange],
  );

  return (
    <div
      style={{ height }}
      className="w-full rounded-xl overflow-hidden border border-ink-300 relative z-0 shadow-inner"
    >
      <MapContainer
        center={position}
        zoom={14}
        scrollWheelZoom={!readOnly}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={position} />
        {!readOnly && <MapEventsHandler onSelectPosition={onChange} readOnly={readOnly} />}
        <Marker
          draggable={!readOnly}
          eventHandlers={eventHandlers}
          position={position}
          ref={markerRef}
        />
        {radiusKm && radiusKm > 0 && (
          <Circle
            center={position}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#15803D',
              fillColor: '#15803D',
              fillOpacity: 0.12,
              weight: 2,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

LocationPickerMap.propTypes = {
  latitude: PropTypes.number,
  longitude: PropTypes.number,
  radiusKm: PropTypes.number,
  onChange: PropTypes.func,
  readOnly: PropTypes.bool,
  height: PropTypes.string,
};
