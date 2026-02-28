'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import {
  Search, MapPin, Bed, Bath, Calendar,
  Home, Shield, SlidersHorizontal, ArrowRight, Building2, Zap,
  Map, List, Car, PawPrint, X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';
import type { UnitWithAttributes } from '@/components/properties/MapView';

const MapView = dynamic(() => import('@/components/properties/MapView'), { ssr: false });
const PropertyChatbot = dynamic(() => import('@/components/properties/PropertyChatbot'), { ssr: false });

type Unit = Database['public']['Tables']['units']['Row'];
type UnitAttributes = Database['public']['Tables']['unit_attributes']['Row'];

const defaultFilters = {
  minRent: '',
  maxRent: '',
  bedrooms: 'any',
  bathrooms: 'any',
  city: '',
  furnished: 'any',
  hasParking: false,
  petFriendly: false,
};

type Filters = typeof defaultFilters;

export default function PropertiesPage() {
  const [allUnits, setAllUnits] = useState<UnitWithAttributes[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitWithAttributes | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [chatFilteredIds, setChatFilteredIds] = useState<string[] | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchPublicListings = async () => {
      setLoading(true);
      try {
        const { data: raw, error } = await supabase
          .from('units')
          .select(`
            *,
            unit_attributes (
              bedrooms,
              bathrooms,
              furnished_status,
              has_parking,
              has_garden_access,
              pet_policy
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          setFetchError(error.message);
          setAllUnits([]);
          return;
        }

        const publicUnits = (raw || []).filter(
          (u: any) => !u.listing_status || u.listing_status === 'public'
        ) as UnitWithAttributes[];

        setFetchError(null);
        setAllUnits(publicUnits);
      } catch (err) {
        console.error('Error fetching listings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicListings();
  }, []);

  const getBeds = useCallback((unit: UnitWithAttributes): number | null => {
    if (unit.unit_attributes?.bedrooms != null) return unit.unit_attributes.bedrooms;
    if (unit.bedrooms != null) return unit.bedrooms;
    return null;
  }, []);

  const getBaths = useCallback((unit: UnitWithAttributes): number | null => {
    if (unit.unit_attributes?.bathrooms != null) return unit.unit_attributes.bathrooms;
    if (unit.bathrooms != null) return unit.bathrooms;
    return null;
  }, []);

  const units = useMemo(() => {
    // When Claude has made an explicit selection, show only those properties
    if (chatFilteredIds !== null) {
      const idSet = new Set(chatFilteredIds);
      return allUnits.filter(u => idSet.has(u.id));
    }
    let data = allUnits;
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      data = data.filter(u =>
        u.address?.toLowerCase().includes(s) ||
        u.city?.toLowerCase().includes(s) ||
        u.unit_identifier?.toLowerCase().includes(s) ||
        u.listing_description?.toLowerCase().includes(s)
      );
    }
    if (filters.minRent) data = data.filter(u => u.rent_amount != null && u.rent_amount >= parseFloat(filters.minRent));
    if (filters.maxRent) data = data.filter(u => u.rent_amount != null && u.rent_amount <= parseFloat(filters.maxRent));
    if (filters.city) data = data.filter(u => u.city?.toLowerCase().includes(filters.city.toLowerCase()));
    if (filters.bedrooms !== 'any') {
      const beds = parseInt(filters.bedrooms);
      data = data.filter(u => getBeds(u) === beds);
    }
    if (filters.bathrooms !== 'any') {
      if (filters.bathrooms === '3') {
        data = data.filter(u => (getBaths(u) ?? 0) >= 3);
      } else {
        data = data.filter(u => getBaths(u) === parseInt(filters.bathrooms));
      }
    }
    if (filters.furnished !== 'any') data = data.filter(u => u.unit_attributes?.furnished_status === filters.furnished);
    if (filters.hasParking) data = data.filter(u => u.unit_attributes?.has_parking === true);
    if (filters.petFriendly) data = data.filter(u =>
      u.unit_attributes?.pet_policy != null &&
      u.unit_attributes.pet_policy !== 'no_pets' &&
      u.unit_attributes.pet_policy !== 'No Pets'
    );
    return data;
  }, [allUnits, searchTerm, filters, getBeds, getBaths, chatFilteredIds]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.minRent) c++;
    if (filters.maxRent) c++;
    if (filters.city) c++;
    if (filters.bedrooms !== 'any') c++;
    if (filters.bathrooms !== 'any') c++;
    if (filters.furnished !== 'any') c++;
    if (filters.hasParking) c++;
    if (filters.petFriendly) c++;
    return c;
  }, [filters]);

  const clearFilters = () => {
    setFilters(defaultFilters);
    setChatFilteredIds(null);
  };

  const handleChatFilterToIds = useCallback((ids: string[] | null) => {
    setChatFilteredIds(ids);
    // Highlight the first matched property on the map
    if (ids && ids.length > 0) setHighlightedId(ids[0]);
    else setHighlightedId(null);
  }, []);

  const formatDate = (date: string | null) => {
    if (!date) return 'Immediately';
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const tags = (unit: UnitWithAttributes) => {
    const t: string[] = [];
    if (unit.unit_attributes?.furnished_status) t.push(unit.unit_attributes.furnished_status.replace(/_/g, ' '));
    if (unit.unit_attributes?.has_parking) t.push('Parking');
    if (unit.unit_attributes?.has_garden_access) t.push('Garden');
    return t;
  };

  const handleSelectUnit = (unit: UnitWithAttributes | null) => {
    setSelectedUnit(unit);
  };

  const filterPanel = (
    <div className="mt-3 bg-white/5 border border-white/10 rounded-2xl p-4 text-left backdrop-blur-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-white/40 text-xs mb-1 block">Min Rent (£)</label>
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
            placeholder="0" type="number"
            value={filters.minRent}
            onChange={(e) => setFilters({ ...filters, minRent: e.target.value })}
          />
        </div>
        <div>
          <label className="text-white/40 text-xs mb-1 block">Max Rent (£)</label>
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
            placeholder="5000" type="number"
            value={filters.maxRent}
            onChange={(e) => setFilters({ ...filters, maxRent: e.target.value })}
          />
        </div>
        <div>
          <label className="text-white/40 text-xs mb-1 block">City</label>
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
            placeholder="London…"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
        </div>
        <div>
          <label className="text-white/40 text-xs mb-1 block">Bedrooms</label>
          <select
            className="w-full bg-[#0d0d18] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
            value={filters.bedrooms}
            onChange={(e) => setFilters({ ...filters, bedrooms: e.target.value })}
          >
            <option value="any">Any</option>
            <option value="0">Studio</option>
            <option value="1">1 Bed</option>
            <option value="2">2 Beds</option>
            <option value="3">3 Beds</option>
            <option value="4">4+ Beds</option>
          </select>
        </div>
        <div>
          <label className="text-white/40 text-xs mb-1 block">Bathrooms</label>
          <select
            className="w-full bg-[#0d0d18] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
            value={filters.bathrooms}
            onChange={(e) => setFilters({ ...filters, bathrooms: e.target.value })}
          >
            <option value="any">Any</option>
            <option value="1">1 Bath</option>
            <option value="2">2 Baths</option>
            <option value="3">3+ Baths</option>
          </select>
        </div>
        <div>
          <label className="text-white/40 text-xs mb-1 block">Furnished</label>
          <select
            className="w-full bg-[#0d0d18] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
            value={filters.furnished}
            onChange={(e) => setFilters({ ...filters, furnished: e.target.value })}
          >
            <option value="any">Any</option>
            <option value="unfurnished">Unfurnished</option>
            <option value="part_furnished">Part Furnished</option>
            <option value="fully_furnished">Fully Furnished</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/8">
        <button
          onClick={() => setFilters({ ...filters, hasParking: !filters.hasParking })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filters.hasParking ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
        >
          <Car className="h-3.5 w-3.5" /> Parking
        </button>
        <button
          onClick={() => setFilters({ ...filters, petFriendly: !filters.petFriendly })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filters.petFriendly ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
        >
          <PawPrint className="h-3.5 w-3.5" /> Pet Friendly
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
            <X className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>
    </div>
  );

  // ── MAP MODE ──────────────────────────────────────────────────────────────
  if (showMap) {
    return (
      <div className="h-screen flex flex-col bg-[#05050a] text-white overflow-hidden">
        <style>{`
          .property-card { transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
          .property-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.3); }
        `}</style>

        {/* Compact top bar */}
        <nav className="flex-shrink-0 border-b border-white/5 bg-[#05050a]/90 backdrop-blur-xl z-40 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 mr-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4 text-white" />
              </div>
            </Link>

            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-indigo-500/50 transition-colors max-w-xl">
              <Search className="h-4 w-4 text-white/30 flex-shrink-0" />
              <input
                className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-sm"
                placeholder="Search by address, city…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors flex-shrink-0 ${showFilters ? 'bg-indigo-500 text-white' : 'bg-white/8 text-white/50 hover:text-white hover:bg-white/12'}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setShowMap(false); setSelectedUnit(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white/8 text-white/50 hover:text-white hover:bg-white/12 transition-colors flex-shrink-0"
            >
              <List className="h-4 w-4" /> List
            </button>

            <span className="text-white/30 text-xs flex-shrink-0">
              <span className="text-white font-semibold">{units.length}</span> properties
            </span>
          </div>

          {showFilters && <div className="mt-2">{filterPanel}</div>}
        </nav>

        {/* Map + optional side panel */}
        <div className="flex-1 flex min-h-0" style={{ minHeight: 0 }}>
          {/* Map */}
          <div className="flex-1 min-w-0 h-full" style={{ minHeight: 0 }}>
            <MapView
              units={units}
              highlightedId={highlightedId}
              selectedId={selectedUnit?.id ?? null}
              onSelect={handleSelectUnit}
              isSplit={!!selectedUnit}
            />
          </div>

          {/* Side panel — slides in when a pin is clicked */}
          {selectedUnit && (
            <div className="w-96 flex-shrink-0 border-l border-white/10 bg-[#0d0d18] overflow-y-auto flex flex-col">
              {/* Close */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className="text-white/30 text-xs uppercase tracking-widest font-semibold">Property details</span>
                <button
                  onClick={() => setSelectedUnit(null)}
                  className="h-7 w-7 rounded-lg bg-white/8 hover:bg-white/12 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Image */}
              {selectedUnit.images && selectedUnit.images.length > 0 ? (
                <div className="mx-5 rounded-xl overflow-hidden h-48 flex-shrink-0">
                  <img src={selectedUnit.images[0]} alt={selectedUnit.unit_identifier} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="mx-5 rounded-xl h-48 flex-shrink-0 bg-gradient-to-br from-indigo-950/50 to-purple-950/30 flex items-center justify-center">
                  <Home className="h-12 w-12 text-indigo-500/30" />
                </div>
              )}

              <div className="px-5 py-4 flex-1">
                {/* Price */}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black text-white">£{selectedUnit.rent_amount}</span>
                  <span className="text-white/40 text-sm">/mo</span>
                </div>

                {/* Title + address */}
                <h2 className="text-white font-bold text-lg mb-1">{selectedUnit.unit_identifier}</h2>
                <div className="flex items-center gap-1 text-white/40 text-sm mb-4">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{selectedUnit.address}, {selectedUnit.city}</span>
                </div>

                {/* Stats row */}
                <div className="flex gap-4 mb-4">
                  {getBeds(selectedUnit) != null && (
                    <div className="flex items-center gap-1.5 text-white/60 text-sm">
                      <Bed className="h-4 w-4 text-indigo-400" />
                      <span>{getBeds(selectedUnit) === 0 ? 'Studio' : `${getBeds(selectedUnit)} bed`}</span>
                    </div>
                  )}
                  {getBaths(selectedUnit) != null && (
                    <div className="flex items-center gap-1.5 text-white/60 text-sm">
                      <Bath className="h-4 w-4 text-indigo-400" />
                      <span>{getBaths(selectedUnit)} bath</span>
                    </div>
                  )}
                  {selectedUnit.available_date && (
                    <div className="flex items-center gap-1.5 text-white/60 text-sm">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(selectedUnit.available_date)}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedUnit.listing_description && (
                  <p className="text-white/40 text-sm leading-relaxed mb-4">
                    {selectedUnit.listing_description}
                  </p>
                )}

                {/* Tags */}
                {tags(selectedUnit).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {tags(selectedUnit).map(tag => (
                      <span key={tag} className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-white/40 text-xs capitalize">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={() => router.push(`/properties/${selectedUnit.id}`)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  View Full Details
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST MODE ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#05050a] text-white">
      <style>{`
        @keyframes shimmer-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .card-appear { animation: fade-up 0.5s ease forwards; }
        .skeleton-shimmer { position: relative; overflow: hidden; background: rgba(255,255,255,0.04); }
        .skeleton-shimmer::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); animation: shimmer-bar 1.5s infinite; }
        .property-card { transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
        .property-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.3); }
        .glow-orb { filter: blur(80px); }
      `}</style>

      {/* Navbar */}
      <nav className="border-b border-white/5 bg-[#05050a]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white">PropAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-white/50 hover:text-white transition-colors px-4 py-2">Sign in</Link>
            <Link href="/auth/signup/tenant" className="text-sm font-medium text-white px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
              Apply as Tenant
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="glow-orb absolute top-0 left-1/3 w-96 h-48 bg-indigo-600/20 rounded-full" />
        <div className="glow-orb absolute top-0 right-1/4 w-64 h-48 bg-purple-600/15 rounded-full" />
        <div className="relative container mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs mb-6">
            <Zap className="h-3 w-3" />
            AI-screened properties · Verified landlords
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
            Find Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Next Home
            </span>
          </h1>
          <p className="text-white/40 text-lg max-w-lg mx-auto mb-8">
            Browse verified listings. Apply in minutes. AI-powered screening means faster decisions.
          </p>

          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-sm focus-within:border-indigo-500/50 transition-colors">
              <Search className="h-5 w-5 text-white/30 ml-3 flex-shrink-0" />
              <input
                className="flex-1 bg-transparent text-white placeholder-white/30 outline-none py-2 text-sm"
                placeholder="Search by address, city, or description…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${showFilters ? 'bg-indigo-500 text-white' : 'bg-white/8 text-white/50 hover:text-white hover:bg-white/12'}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowMap(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white/8 text-white/50 hover:text-white hover:bg-white/12 transition-colors"
              >
                <Map className="h-4 w-4" /> Map
              </button>
            </div>

            {showFilters && filterPanel}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-6 py-10">
        {!loading && !fetchError && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-white/40 text-sm">
              <span className="text-white font-semibold">{units.length}</span>{' '}
              {units.length === 1 ? 'property' : 'properties'} available
            </p>
            <div className="text-white/30 text-xs flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-400" />
              All landlords verified
            </div>
          </div>
        )}

        {loading && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/8 overflow-hidden">
                <div className="skeleton-shimmer h-52 w-full" />
                <div className="p-5 space-y-3">
                  <div className="skeleton-shimmer h-5 w-3/4 rounded-lg" />
                  <div className="skeleton-shimmer h-4 w-1/2 rounded-lg" />
                  <div className="skeleton-shimmer h-4 w-full rounded-lg" />
                  <div className="skeleton-shimmer h-10 w-full rounded-xl mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (fetchError || units.length === 0) && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <Home className="h-10 w-10 text-white/20" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {fetchError ? 'Unable to load listings' : 'No properties found'}
            </h3>
            <p className="text-white/30 text-sm max-w-xs">
              {fetchError ? 'Check back soon — landlords are setting up their properties.' : 'Try adjusting your search or filters.'}
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="mt-4 text-sm text-indigo-400 hover:text-indigo-300 underline underline-offset-4">
                Clear all filters
              </button>
            )}
          </div>
        )}

        {!loading && !fetchError && units.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {units.map((unit, i) => {
              const beds = getBeds(unit);
              const baths = getBaths(unit);
              const unitTags = tags(unit);

              return (
                <div
                  key={unit.id}
                  className="property-card bg-[#0d0d18] border border-white/8 rounded-2xl overflow-hidden cursor-pointer card-appear"
                  style={{ animationDelay: `${i * 0.06}s` }}
                  onClick={() => router.push(`/properties/${unit.id}`)}
                  onMouseEnter={() => setHighlightedId(unit.id)}
                  onMouseLeave={() => setHighlightedId(null)}
                >
                  {unit.images && unit.images.length > 0 ? (
                    <div className="h-52 relative overflow-hidden">
                      <img src={unit.images[0]} alt={unit.unit_identifier} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      {unit.images.length > 1 && (
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs font-medium">
                          +{unit.images.length - 1} photos
                        </div>
                      )}
                      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
                        <span className="text-white font-bold">£{unit.rent_amount}</span>
                        <span className="text-white/50 text-xs">/mo</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-52 bg-gradient-to-br from-indigo-950/40 to-purple-950/30 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                      <Home className="h-12 w-12 text-indigo-500/40 mb-2" />
                      <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
                        <span className="text-white font-bold">£{unit.rent_amount}</span>
                        <span className="text-white/50 text-xs">/mo</span>
                      </div>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="mb-3">
                      <h3 className="text-white font-bold text-lg leading-tight mb-1 line-clamp-1">{unit.unit_identifier}</h3>
                      <div className="flex items-center gap-1 text-white/40 text-sm">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">{unit.address}, {unit.city}</span>
                      </div>
                    </div>

                    {(beds != null || baths != null) && (
                      <div className="flex gap-3 mb-3">
                        {beds != null && (
                          <div className="flex items-center gap-1.5 text-white/50 text-sm">
                            <Bed className="h-4 w-4 text-indigo-400" />
                            <span>{beds === 0 ? 'Studio' : `${beds} bed`}</span>
                          </div>
                        )}
                        {baths != null && (
                          <div className="flex items-center gap-1.5 text-white/50 text-sm">
                            <Bath className="h-4 w-4 text-indigo-400" />
                            <span>{baths} bath</span>
                          </div>
                        )}
                        {unit.available_date && (
                          <div className="flex items-center gap-1.5 text-white/50 text-sm ml-auto">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(unit.available_date)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {unit.listing_description && (
                      <p className="text-white/30 text-xs leading-relaxed mb-3 line-clamp-2">{unit.listing_description}</p>
                    )}

                    {unitTags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mb-4">
                        {unitTags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/40 text-xs capitalize">{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/properties/${unit.id}`); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white text-sm font-medium transition-all duration-200"
                      >
                        View Details <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedUnit(unit); setShowMap(true); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/50 hover:text-white text-sm transition-all duration-200"
                        title="View on map"
                      >
                        <Map className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PropertyChatbot
        units={allUnits}
        filteredCount={units.length}
        onFilterToIds={handleChatFilterToIds}
        onResetFilters={clearFilters}
      />

      <footer className="border-t border-white/5 py-8 mt-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-white font-bold text-sm">PropAI</span>
          </Link>
          <p className="text-white/20 text-xs">© 2025 PropAI Ltd. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
