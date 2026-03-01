'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Database } from '@/lib/supabase/database.types';

type Unit = Database['public']['Tables']['units']['Row'];
type UnitAttributes = Database['public']['Tables']['unit_attributes']['Row'];

export interface UnitWithAttributes extends Unit {
  unit_attributes?: UnitAttributes;
}

export interface GeocodedPin {
  id: string;
  lat: number;
  lng: number;
  unit: UnitWithAttributes;
}

interface MapViewProps {
  pins: GeocodedPin[];
  geocoding: boolean;
  highlightedId: string | null;
  selectedId: string | null;
  onSelect: (unit: UnitWithAttributes | null) => void;
  isSplit: boolean;
}

function MapBoundsFitter({ pins, geocoding }: { pins: GeocodedPin[]; geocoding: boolean }) {
  const map = useMap();
  const hasFitted = useRef(false);

  // Reset when pins are cleared (new unit set loaded)
  useEffect(() => {
    if (pins.length === 0) hasFitted.current = false;
  }, [pins.length]);

  // Fit bounds only after geocoding is complete so we get all pins at once,
  // rather than locking onto the very first pin that arrives.
  useEffect(() => {
    if (hasFitted.current || geocoding || pins.length === 0) return;

    hasFitted.current = true;

    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 13);
    } else {
      const lats = pins.map(p => p.lat);
      const lngs = pins.map(p => p.lng);
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [60, 60], maxZoom: 14 }
      );
    }
  }, [pins, geocoding, map]);

  return null;
}

function MapResizer({ isSplit }: { isSplit: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 50);
  }, [isSplit, map]);
  return null;
}

export default function MapView({ pins, geocoding, highlightedId, selectedId, onSelect, isSplit }: MapViewProps) {

  const getBeds = (unit: UnitWithAttributes) =>
    unit.unit_attributes?.bedrooms ?? unit.bedrooms ?? null;

  return (
    <div className="relative w-full h-full" style={{ minHeight: 0 }}>
      {geocoding && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-[#0d0d18] pointer-events-none">
          <div className="text-center">
            <div className="relative w-14 h-14 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <div className="absolute inset-[6px] rounded-full border border-purple-500/30 border-b-purple-400 animate-spin" style={{ animationDuration: '0.75s', animationDirection: 'reverse' }} />
            </div>
            <p className="text-white/70 text-sm font-medium">Placing properties on map</p>
            <p className="text-white/30 text-xs mt-1">
              {pins.length > 0 ? `${pins.length} located so far…` : 'Geocoding addresses…'}
            </p>
          </div>
        </div>
      )}

      <MapContainer
        center={[37.97, 23.72]}
        zoom={11}
        style={{ width: '100%', height: '100%', minHeight: '400px', background: '#0d0d18' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapBoundsFitter pins={pins} geocoding={geocoding} />
        <MapResizer isSplit={isSplit} />

        {pins.map(pin => {
          const isHighlighted = pin.id === highlightedId;
          const isSelected = pin.id === selectedId;
          const beds = getBeds(pin.unit);
          const price = pin.unit.rent_amount;

          return (
            <CircleMarker
              key={pin.id}
              center={[pin.lat, pin.lng]}
              radius={isSelected ? 16 : isHighlighted ? 13 : 10}
              pathOptions={{
                color: isSelected ? '#f59e0b' : isHighlighted ? '#a78bfa' : '#6366f1',
                fillColor: isSelected ? '#d97706' : isHighlighted ? '#7c3aed' : '#4f46e5',
                fillOpacity: 1,
                weight: isSelected ? 3 : isHighlighted ? 2.5 : 1.5,
              }}
              eventHandlers={{
                click: () => onSelect(isSelected ? null : pin.unit),
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -12]}
                opacity={1}
                className="map-tooltip"
              >
                <div style={{
                  background: '#0d0d18',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  minWidth: '140px',
                  pointerEvents: 'none',
                }}>
                  {price && (
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
                      £{price}<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 400 }}>/mo</span>
                    </div>
                  )}
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>
                    {beds != null ? (beds === 0 ? 'Studio' : `${beds} bed`) : ''}{beds != null ? ' · ' : ''}{pin.unit.city}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <style>{`
        .map-tooltip .leaflet-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-tooltip.map-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-tooltip-top.map-tooltip::before {
          display: none !important;
        }
        .leaflet-container {
          background: #0d0d18 !important;
          font-family: inherit !important;
        }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.5) !important;
          color: rgba(255,255,255,0.3) !important;
        }
        .leaflet-control-attribution a {
          color: rgba(255,255,255,0.4) !important;
        }
        .leaflet-control-zoom a {
          background: #1a1a2e !important;
          color: rgba(255,255,255,0.7) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .leaflet-control-zoom a:hover {
          background: #2d2d4e !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}
