'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress } from '@/lib/utils/geocode';
import type { Database } from '@/lib/supabase/database.types';

type Unit = Database['public']['Tables']['units']['Row'];
type UnitAttributes = Database['public']['Tables']['unit_attributes']['Row'];

export interface UnitWithAttributes extends Unit {
  unit_attributes?: UnitAttributes;
}

interface GeocodedPin {
  id: string;
  lat: number;
  lng: number;
  unit: UnitWithAttributes;
}

interface MapViewProps {
  units: UnitWithAttributes[];
  highlightedId: string | null;
  selectedId: string | null;
  onSelect: (unit: UnitWithAttributes | null) => void;
  isSplit: boolean;
}

function MapBoundsFitter({ pins }: { pins: GeocodedPin[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  // Reset when pins are cleared (new unit set loaded)
  useEffect(() => {
    if (pins.length === 0) hasFitted.current = false;
  }, [pins.length]);

  // Fit bounds once we have enough pins to get a good view, then leave the
  // user free to pan — don't keep re-centering as more pins trickle in.
  useEffect(() => {
    if (hasFitted.current || pins.length === 0) return;

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
  }, [pins, map]);

  return null;
}

function MapResizer({ isSplit }: { isSplit: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 50);
  }, [isSplit, map]);
  return null;
}

export default function MapView({ units, highlightedId, selectedId, onSelect, isSplit }: MapViewProps) {
  const [pins, setPins] = useState<GeocodedPin[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (units.length === 0) {
      setPins([]);
      return;
    }

    // Reset BEFORE firing requests so we never append to stale data
    setPins([]);
    let cancelled = false;
    setGeocoding(true);

    // Fire all requests concurrently — in-flight deduplication in geocode.ts
    // means React StrictMode double-invocations share one server request each.
    // The server queue serialises calls to Nominatim at 400ms intervals.
    let remaining = units.length;
    units.forEach(async (unit) => {
      try {
        const coords = await geocodeAddress(unit.address, unit.postcode, unit.city);
        if (coords && !cancelled) {
          setPins(prev => {
            // Avoid duplicates if effect fires more than once
            if (prev.some(p => p.id === unit.id)) return prev;
            return [...prev, { id: unit.id, lat: coords.lat, lng: coords.lng, unit }];
          });
        }
      } finally {
        remaining--;
        if (remaining === 0 && !cancelled) setGeocoding(false);
      }
    });

    return () => { cancelled = true; };
  }, [units]);

  const getBeds = (unit: UnitWithAttributes) =>
    unit.unit_attributes?.bedrooms ?? unit.bedrooms ?? null;

  return (
    <div className="relative w-full h-full" style={{ minHeight: 0 }}>
      {geocoding && pins.length === 0 && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-[#0d0d18]/80 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/50 text-sm">Loading map…</p>
          </div>
        </div>
      )}

      {geocoding && pins.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-black/70 backdrop-blur-sm text-white/60 text-xs px-3 py-1.5 rounded-full border border-white/10 pointer-events-none">
          Loading more pins…
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

        <MapBoundsFitter pins={pins} />
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
