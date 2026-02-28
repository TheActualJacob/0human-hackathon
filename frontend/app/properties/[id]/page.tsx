'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, MapPin, Bed, Bath, Calendar, Home,
  Building2, Shield, Car, PawPrint, Zap, Square,
  Layers, Wind, CheckCircle2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

const MapView = dynamic(() => import('@/components/properties/MapView'), { ssr: false });

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [unit, setUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('units')
        .select(`
          *,
          unit_attributes (
            bedrooms, bathrooms, square_footage, floor_level,
            furnished_status, heating_type,
            has_parking, has_ac, has_lift, has_balcony,
            has_garden_access, has_washing_machine, has_dishwasher,
            pet_policy
          )
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setUnit(data);
      }
      setLoading(false);
    })();
  }, [id]);

  const beds = unit?.unit_attributes?.bedrooms ?? unit?.bedrooms ?? null;
  const baths = unit?.unit_attributes?.bathrooms ?? unit?.bathrooms ?? null;
  const sqft = unit?.unit_attributes?.square_footage ?? unit?.square_footage ?? null;
  const images: string[] = unit?.images ?? [];

  const formatDate = (d: string | null) => {
    if (!d) return 'Available now';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const amenities = unit ? [
    unit.unit_attributes?.has_ac && { icon: Wind, label: 'Air Conditioning' },
    unit.unit_attributes?.has_parking && { icon: Car, label: 'Parking' },
    unit.unit_attributes?.has_lift && { icon: Layers, label: 'Lift' },
    unit.unit_attributes?.has_balcony && { icon: Square, label: 'Balcony' },
    unit.unit_attributes?.has_garden_access && { icon: CheckCircle2, label: 'Garden Access' },
    unit.unit_attributes?.has_washing_machine && { icon: CheckCircle2, label: 'Washing Machine' },
    unit.unit_attributes?.has_dishwasher && { icon: CheckCircle2, label: 'Dishwasher' },
    (unit.unit_attributes?.pet_policy && unit.unit_attributes.pet_policy !== 'no_pets' && unit.unit_attributes.pet_policy !== 'No Pets') && { icon: PawPrint, label: 'Pet Friendly' },
  ].filter(Boolean) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050a] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#05050a] text-white flex flex-col items-center justify-center gap-4">
        <Home className="h-16 w-16 text-white/10" />
        <h1 className="text-2xl font-bold">Property not found</h1>
        <Link href="/properties" className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-4">
          Back to listings
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050a] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-[#05050a]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/properties" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            All properties
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white hidden sm:block">PropAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-white/50 hover:text-white transition-colors px-4 py-2">Sign in</Link>
            <Link href="/auth/signup/tenant" className="text-sm font-medium text-white px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        {/* Image gallery */}
        <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-indigo-950/40 to-purple-950/30">
          {images.length > 0 ? (
            <>
              <div className="h-[420px] relative">
                <img
                  src={images[imgIndex]}
                  alt={unit.unit_identifier}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setImgIndex(i => (i + 1) % images.length)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setImgIndex(i)}
                          className={`h-1.5 rounded-full transition-all ${i === imgIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                        />
                      ))}
                    </div>
                  </>
                )}

                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white/70 text-xs px-3 py-1.5 rounded-lg">
                  {imgIndex + 1} / {images.length}
                </div>
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto bg-black/30">
                  {images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIndex(i)}
                      className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIndex ? 'border-indigo-500' : 'border-transparent opacity-50 hover:opacity-80'}`}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="h-[420px] flex items-center justify-center">
              <Home className="h-20 w-20 text-indigo-500/20" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title + address */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-3xl font-black text-white leading-tight">{unit.unit_identifier}</h1>
                <div className="flex-shrink-0 text-right">
                  <div className="text-3xl font-black text-white">
                    {unit.rent_amount ? `£${unit.rent_amount.toLocaleString()}` : 'POA'}
                  </div>
                  <div className="text-white/40 text-sm">/month</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-white/40 text-sm">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>{unit.address}, {unit.city}{unit.postcode ? ` ${unit.postcode}` : ''}</span>
              </div>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {beds != null && (
                <div className="bg-white/4 border border-white/8 rounded-xl p-4 text-center">
                  <Bed className="h-5 w-5 text-indigo-400 mx-auto mb-2" />
                  <div className="text-white font-bold text-lg">{beds === 0 ? 'Studio' : beds}</div>
                  <div className="text-white/40 text-xs">{beds === 0 ? '' : 'Bedrooms'}</div>
                </div>
              )}
              {baths != null && (
                <div className="bg-white/4 border border-white/8 rounded-xl p-4 text-center">
                  <Bath className="h-5 w-5 text-indigo-400 mx-auto mb-2" />
                  <div className="text-white font-bold text-lg">{baths}</div>
                  <div className="text-white/40 text-xs">Bathrooms</div>
                </div>
              )}
              {sqft != null && (
                <div className="bg-white/4 border border-white/8 rounded-xl p-4 text-center">
                  <Square className="h-5 w-5 text-indigo-400 mx-auto mb-2" />
                  <div className="text-white font-bold text-lg">{sqft}</div>
                  <div className="text-white/40 text-xs">m²</div>
                </div>
              )}
              {unit.unit_attributes?.floor_level != null && (
                <div className="bg-white/4 border border-white/8 rounded-xl p-4 text-center">
                  <Layers className="h-5 w-5 text-indigo-400 mx-auto mb-2" />
                  <div className="text-white font-bold text-lg">{unit.unit_attributes.floor_level}</div>
                  <div className="text-white/40 text-xs">Floor</div>
                </div>
              )}
            </div>

            {/* Description */}
            {unit.listing_description && (
              <div>
                <h2 className="text-white font-bold text-lg mb-3">About this property</h2>
                <p className="text-white/50 leading-relaxed text-sm">{unit.listing_description}</p>
              </div>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <div>
                <h2 className="text-white font-bold text-lg mb-3">Amenities</h2>
                <div className="grid grid-cols-2 gap-2">
                  {(amenities as any[]).map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5 bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                      <Icon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                      <span className="text-white/70 text-sm">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map */}
            <div>
              <h2 className="text-white font-bold text-lg mb-3">Location</h2>
              <div className="rounded-2xl overflow-hidden border border-white/8" style={{ height: 320 }}>
                <MapView
                  units={[unit]}
                  highlightedId={null}
                  selectedId={null}
                  onSelect={() => {}}
                  isSplit={false}
                />
              </div>
              <p className="text-white/30 text-xs mt-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {unit.address}, {unit.city}{unit.postcode ? ` ${unit.postcode}` : ''}
              </p>
            </div>

            {/* Details table */}
            <div>
              <h2 className="text-white font-bold text-lg mb-3">Property details</h2>
              <div className="bg-white/4 border border-white/8 rounded-xl overflow-hidden">
                {[
                  unit.unit_attributes?.furnished_status && ['Furnished', unit.unit_attributes.furnished_status.replace(/_/g, ' ')],
                  unit.unit_attributes?.heating_type && ['Heating', unit.unit_attributes.heating_type.replace(/_/g, ' ')],
                  unit.unit_type && ['Type', unit.unit_type],
                  unit.available_date && ['Available from', formatDate(unit.available_date)],
                  unit.city && ['City', unit.city],
                  unit.country && ['Country', unit.country.toUpperCase()],
                ].filter(Boolean).map(([label, value], i, arr) => (
                  <div key={label as string} className={`flex justify-between px-5 py-3.5 text-sm ${i < arr.length - 1 ? 'border-b border-white/6' : ''}`}>
                    <span className="text-white/40">{label}</span>
                    <span className="text-white capitalize">{value as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-[#0d0d18] border border-white/8 rounded-2xl p-6 sticky top-24">
              <div className="text-center mb-5 pb-5 border-b border-white/8">
                <div className="text-4xl font-black text-white mb-1">
                  {unit.rent_amount ? `£${unit.rent_amount.toLocaleString()}` : 'POA'}
                </div>
                <div className="text-white/40 text-sm">per month</div>
              </div>

              <div className="space-y-3 mb-5">
                {unit.available_date && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Calendar className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                    <span className="text-white/50">Available {formatDate(unit.available_date)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-sm">
                  <Shield className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-white/50">Verified landlord</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Zap className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                  <span className="text-white/50">AI-screened property</span>
                </div>
              </div>

              <Link
                href="/auth/signup/tenant"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors mb-3"
              >
                Apply Now
              </Link>
              <Link
                href="/properties"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-white/60 hover:text-white text-sm transition-colors"
              >
                ← Back to listings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
