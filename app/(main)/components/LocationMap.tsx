'use client';

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useMemo, useRef } from 'react';

// Fix for default marker icon
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface LocationMapProps {
  lat: number;
  lon: number;
  onPositionChange: (lat: number, lon: number) => void;
}

function DraggableMarker({ position, onPositionChange }: { position: L.LatLngExpression, onPositionChange: (lat: number, lon: number) => void }) {
  const [draggable, setDraggable] = useState(true);
  const markerRef = useRef<L.Marker>(null);
  
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          onPositionChange(lat, lng);
        }
      },
    }),
    [onPositionChange],
  );

  return (
    <Marker
      draggable={draggable}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={customIcon}
    />
  );
}

function MapController({ lat, lon }: { lat: number, lon: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.flyTo([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  
  return null;
}

// Component to handle map clicks to move marker
function MapClickHandler({ onPositionChange }: { onPositionChange: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMap({ lat, lon, onPositionChange }: LocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

  return (
    <MapContainer 
      center={[lat, lon]} 
      zoom={15} 
      style={{ height: '300px', width: '100%', borderRadius: '8px' }}
    >
      <TileLayer
        attribution='Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | <a href="https://openmaptiles.org/" target="_blank">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>'
        url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${apiKey}`}
        maxZoom={20}
      />
      <DraggableMarker position={[lat, lon]} onPositionChange={onPositionChange} />
      <MapController lat={lat} lon={lon} />
      <MapClickHandler onPositionChange={onPositionChange} />
    </MapContainer>
  );
}
