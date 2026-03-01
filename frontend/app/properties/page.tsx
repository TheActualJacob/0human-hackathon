'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Search, MapPin, Bed, Bath, Calendar,
  Home, Shield, SlidersHorizontal, ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';

type Unit = Database['public']['Tables']['units']['Row'];
type UnitAttributes = Database['public']['Tables']['unit_attributes']['Row'];

interface UnitWithAttributes extends Unit {
  unit_attributes?: UnitAttributes;
}

export default function PropertiesPage() {
  const [units, setUnits] = useState<UnitWithAttributes[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minRent: '',
    maxRent: '',
    bedrooms: '',
    city: ''
  });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchPublicListings();
  }, []);

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
            has_garden_access
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        setFetchError(error.message);
        setUnits([]);
        setLoading(false);
        return;
      }
      setFetchError(null);

      let data = (raw || []).filter((u: any) =>
        (!u.listing_status || u.listing_status === 'public')
        && Array.isArray(u.images) && u.images.length > 0
      );

      if (filters.minRent) data = data.filter((u: any) => u.rent_amount && parseFloat(u.rent_amount) >= parseFloat(filters.minRent));
      if (filters.maxRent) data = data.filter((u: any) => u.rent_amount && parseFloat(u.rent_amount) <= parseFloat(filters.maxRent));
      if (filters.city) data = data.filter((u: any) => u.city?.toLowerCase().includes(filters.city.toLowerCase()));

      let filteredData = data || [];

      if (searchTerm) {
        filteredData = filteredData.filter(unit =>
          unit.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.unit_identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.listing_description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (filters.bedrooms && filters.bedrooms !== 'any') {
        filteredData = filteredData.filter(unit =>
          unit.unit_attributes?.bedrooms === parseInt(filters.bedrooms) ||
          unit.bedrooms === parseInt(filters.bedrooms)
        );
      }

      setUnits(filteredData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Immediately';
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getBeds = (unit: UnitWithAttributes): number | null => {
    if (unit.unit_attributes?.bedrooms != null) return unit.unit_attributes.bedrooms;
    if (unit.bedrooms != null) return unit.bedrooms;
    return null;
  };

  const getBaths = (unit: UnitWithAttributes): number | null => {
    if (unit.unit_attributes?.bathrooms != null) return unit.unit_attributes.bathrooms;
    if (unit.bathrooms != null) return unit.bathrooms;
    return null;
  };

  const tags = (unit: UnitWithAttributes) => {
    const t: string[] = [];
    if (unit.unit_attributes?.furnished_status) t.push(unit.unit_attributes.furnished_status.replace(/_/g, ' '));
    if (unit.unit_attributes?.has_parking) t.push('Parking');
    if (unit.unit_attributes?.has_garden_access) t.push('Garden');
    return t;
  };

  return (
    <div className="flex-1 p-8">
      <style>{`
        @keyframes shimmer-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .card-appear { animation: fade-up 0.4s ease forwards; }
        .skeleton-shimmer { position: relative; overflow: hidden; background: rgba(255,255,255,0.04); }
        .skeleton-shimmer::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); animation: shimmer-bar 1.5s infinite; }
        .property-card { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
        .property-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.4); }
      `}</style>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-1">Browse Properties</h1>
        <p className="text-muted-foreground">Find your next home from verified listings</p>
      </div>

      {/* Search + filters */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 focus-within:border-primary/50 transition-colors">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none text-sm"
              placeholder="Search by address, city, or description…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPublicListings()}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
          <button
            onClick={fetchPublicListings}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 transition-colors text-sm font-medium text-primary-foreground"
          >
            Search
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 bg-card border border-border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Min Rent (£)', key: 'minRent', placeholder: '0' },
              { label: 'Max Rent (£)', key: 'maxRent', placeholder: '5000' },
              { label: 'City', key: 'city', placeholder: 'London…' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-muted-foreground text-xs mb-1 block">{f.label}</label>
                <input
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  placeholder={f.placeholder}
                  value={(filters as any)[f.key]}
                  onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label className="text-muted-foreground text-xs mb-1 block">Bedrooms</label>
              <select
                className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
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
          </div>
        )}
      </div>

      {/* Results */}
      <div>
        {/* Count row */}
        {!loading && !fetchError && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-semibold">{units.length}</span> properties available
            </p>
            <div className="text-muted-foreground text-xs flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-400" />
              All landlords verified
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/8 overflow-hidden" style={{ animationDelay: `${i * 0.08}s` }}>
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

        {/* Error / empty */}
        {!loading && (fetchError || units.length === 0) && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <Home className="h-10 w-10 text-white/20" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {fetchError ? 'Unable to load listings' : 'No properties found'}
            </h3>
            <p className="text-white/30 text-sm max-w-xs">
              {fetchError
                ? 'Check back soon — landlords are setting up their properties.'
                : 'Try adjusting your search or filters to see more results.'}
            </p>
          </div>
        )}

        {/* Property cards */}
        {!loading && !fetchError && units.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {units.map((unit, i) => {
              const beds = getBeds(unit);
              const baths = getBaths(unit);
              const unitTags = tags(unit);

              return (
                <div
                  key={unit.id}
                  className="property-card bg-card border border-border rounded-2xl overflow-hidden cursor-pointer card-appear"
                  style={{ animationDelay: `${i * 0.06}s` }}
                  onClick={() => router.push(`/properties/${unit.id}`)}
                >
                  {/* Image */}
                  {unit.images && unit.images.length > 0 ? (
                    <div className="h-52 relative overflow-hidden">
                      <img
                        src={unit.images[0]}
                        alt={unit.unit_identifier}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {unit.images.length > 1 && (
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs font-medium">
                          +{unit.images.length - 1} photos
                        </div>
                      )}
                      {/* Price overlay */}
                      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
                        <span className="text-white font-bold">£{unit.rent_amount}</span>
                        <span className="text-white/50 text-xs">/mo</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-52 bg-gradient-to-br from-indigo-950/40 to-purple-950/30 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-5"
                        style={{
                          backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
                          backgroundSize: '30px 30px'
                        }}
                      />
                      <Home className="h-12 w-12 text-indigo-500/40 mb-2" />
                      {/* Price overlay */}
                      <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
                        <span className="text-white font-bold">£{unit.rent_amount}</span>
                        <span className="text-white/50 text-xs">/mo</span>
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5">
                    <div className="mb-3">
                      <h3 className="text-white font-bold text-lg leading-tight mb-1 line-clamp-1">
                        {unit.unit_identifier}
                      </h3>
                      <div className="flex items-center gap-1 text-white/40 text-sm">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">{unit.address}, {unit.city}</span>
                      </div>
                    </div>

                    {/* Bed / bath row */}
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

                    {/* Description */}
                    {unit.listing_description && (
                      <p className="text-white/30 text-xs leading-relaxed mb-3 line-clamp-2">
                        {unit.listing_description}
                      </p>
                    )}

                    {/* Tags */}
                    {unitTags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mb-4">
                        {unitTags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/40 text-xs capitalize">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* CTA */}
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/properties/${unit.id}`); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white text-sm font-medium transition-all duration-200"
                    >
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
