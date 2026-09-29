import { useEffect, useRef, useState } from 'react';

/* ── Nominatim address search ────────────────────────────────── */
export async function searchNominatim(query) {
  if (!query || query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&countrycodes=in`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return [];
  return res.json();
}

/* ── Leaflet Map Picker ──────────────────────────────────────── */
export function MapPicker({ lat, lng, onPick }) {
  const mapInstanceRef = useRef(null);
  const markerRef      = useRef(null);
  const leafletRef     = useRef(null);
  const containerRef   = useRef(null);
  const destroyedRef   = useRef(false);

  useEffect(() => {
    destroyedRef.current = false;

    // Clean up any previous instance on this DOM node
    if (containerRef.current?._leaflet_id) {
      containerRef.current._leaflet_id = null;
    }
    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch (_) {}
      mapInstanceRef.current = null;
      markerRef.current = null;
    }

    import('leaflet').then((L) => {
      if (destroyedRef.current || !containerRef.current) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (containerRef.current._leaflet_id) containerRef.current._leaflet_id = null;

      const initLat = lat || 22.3039;
      const initLng = lng || 70.8022;

      const map = L.map(containerRef.current, { zoomControl: true }).setView([initLat, initLng], lat ? 14 : 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      if (lat && lng) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const p = markerRef.current.getLatLng();
          onPick(p.lat.toFixed(6), p.lng.toFixed(6));
        });
      }

      map.on('click', (e) => {
        const { lat: cLat, lng: cLng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([cLat, cLng]);
        } else {
          markerRef.current = L.marker([cLat, cLng], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', () => {
            const p = markerRef.current.getLatLng();
            onPick(p.lat.toFixed(6), p.lng.toFixed(6));
          });
        }
        onPick(cLat.toFixed(6), cLng.toFixed(6));
      });

      mapInstanceRef.current = map;
      leafletRef.current = L;
    });

    return () => {
      destroyedRef.current = true;
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (_) {}
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      if (containerRef.current) containerRef.current._leaflet_id = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external lat/lng changes to the map (e.g. from address search)
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current || !lat || !lng) return;
    const L = leafletRef.current;
    const pos = [Number(lat), Number(lng)];
    mapInstanceRef.current.setView(pos, 15);
    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos, { draggable: true }).addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current.getLatLng();
        onPick(p.lat.toFixed(6), p.lng.toFixed(6));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return <div ref={containerRef} className="bc-map-container" />;
}

/* ── Address Search Box ──────────────────────────────────────── */
export function AddressSearchBox({ onSelect }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [isLoading, setLoading] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowDrop(true);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchNominatim(val)); }
      catch (_) { setResults([]); }
      finally { setLoading(false); }
    }, 400);
  };

  const pick = (item) => {
    const addr = item.address || {};
    onSelect({
      displayName: item.display_name,
      lat: item.lat,
      lng: item.lon,
      address: [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(', ') || item.display_name.split(',').slice(0, 2).join(',').trim(),
      plotNo: addr.house_number || '',
      landmark: addr.road || addr.pedestrian || '',
      postalCode: addr.postcode || '',
      cityCode: addr.city || addr.town || addr.village || addr.county || '',
      stateCode: addr.state || '',
      countryCode: addr.country_code ? addr.country_code.toUpperCase() : 'IN',
    });
    setQuery(item.display_name);
    setShowDrop(false);
  };

  return (
    <div className="bc-addr-search-wrap" ref={wrapRef}>
      <div className="bc-addr-search-input-row">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="bc-addr-search-icon">
          <circle cx="9" cy="9" r="6" /><path d="m15 15 3 3" />
        </svg>
        <input
          type="text"
          className="bc-addr-search-input"
          placeholder="Search address, area, city…"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setShowDrop(true)}
          autoComplete="off"
        />
        {isLoading ? <span className="bc-addr-spinner" /> : null}
        {query ? (
          <button type="button" className="bc-addr-clear" onClick={() => { setQuery(''); setResults([]); setShowDrop(false); }}>✕</button>
        ) : null}
      </div>
      {showDrop && results.length > 0 ? (
        <ul className="bc-addr-dropdown">
          {results.map((item, i) => {
            const parts = item.display_name.split(',');
            const main  = parts.slice(0, 2).join(',').trim();
            const sub   = parts.slice(2, 5).join(',').trim();
            return (
              <li key={i} className="bc-addr-option" onMouseDown={() => pick(item)}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="bc-addr-opt-icon">
                  <path d="M10 2C6.686 2 4 4.686 4 8c0 4.418 6 10 6 10s6-5.582 6-10c0-3.314-2.686-6-6-6z" />
                  <circle cx="10" cy="8" r="2" />
                </svg>
                <div>
                  <p className="bc-addr-opt-main">{main}</p>
                  {sub ? <p className="bc-addr-opt-sub">{sub}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : showDrop && query.length >= 3 && !isLoading ? (
        <div className="bc-addr-dropdown bc-addr-no-results">No results found</div>
      ) : null}
    </div>
  );
}
