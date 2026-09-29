import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddressSearchBox, Banner, MapPicker } from '../components';
import {
  fetchBusinessDetails,
  listBusinessTypes,
  listCities,
  listCountries,
  listIndustries,
  listStates,
  updateBusinessProfile,
  uploadBannerImages,
} from '../services/adminApi';

const getUserName = (user) =>
  user?.name || user?.full_name || user?.fullName || user?.username || user?.mobile || `Business #${user?.id || ''}`;

/* ── Hours presets (same as create form) ───────────────────────── */
const HOURS_PRESETS = [
  { label: 'Mon – Sat, 9:00 AM – 6:00 PM', value: 'Mon – Sat, 9:00 AM – 6:00 PM' },
  { label: 'Mon – Sat, 10:00 AM – 7:00 PM', value: 'Mon – Sat, 10:00 AM – 7:00 PM' },
  { label: 'Mon – Sun, 9:00 AM – 9:00 PM', value: 'Mon – Sun, 9:00 AM – 9:00 PM' },
  { label: 'Mon – Sun, 24 Hours', value: 'Mon – Sun, 24 Hours' },
  { label: 'Mon – Fri, 9:00 AM – 6:00 PM', value: 'Mon – Fri, 9:00 AM – 6:00 PM' },
  { label: 'Mon – Fri, 10:00 AM – 7:00 PM', value: 'Mon – Fri, 10:00 AM – 7:00 PM' },
  { label: 'Mon – Sat, 8:00 AM – 8:00 PM', value: 'Mon – Sat, 8:00 AM – 8:00 PM' },
  { label: 'Tue – Sun, 11:00 AM – 10:00 PM', value: 'Tue – Sun, 11:00 AM – 10:00 PM' },
  { label: 'Custom', value: '__custom__' },
];

const NATURE_OPTIONS = [
  'Manufacturer', 'Wholesaler', 'Retailer', 'Distributor', 'Service Provider',
  'Consultant', 'Importer', 'Exporter', 'Trader', 'Other',
];

/* ── Field definitions ──────────────────────────────────────────── */
const BUSINESS_PROFILE_FIELDS = [
  { key: 'businessName',        label: 'Business Name',          required: true, span: true },
  { key: 'ownerName',           label: 'Owner Name',           required: true },
  { key: 'contactNumber',       label: 'Contact Number',         type: 'tel' },
  { key: 'whatsappNumber',      label: 'WhatsApp Number',        type: 'tel' },
  { key: 'email',               label: 'Business Email',         type: 'email' },
  { key: 'industry',            label: 'Industry',               type: 'industry',    required: true },
  { key: 'businessSegment',     label: 'Business Segment',       type: 'segment',     required: true },
  { key: 'businessType',        label: 'Business Type',          type: 'businessType', required: true },
  { key: 'gstChoice',           label: 'Does the business have GST?', type: 'gstChoice', required: true },
  { key: 'gstNumber',           label: 'GST Number' },
  { key: 'businessPan',         label: 'Business PAN',           required: true },
  { key: 'aadhaar',             label: 'Aadhaar Number' },
  { key: 'udyam',               label: 'Udyam Registration' },
  { key: 'nature',              label: 'Nature of Business',     type: 'nature' },
  { key: 'experience',          label: 'Experience' },
  { key: 'hours',               label: 'Business Hours',         type: 'hours' },
  { key: 'serviceArea',         label: 'Service Area' },
  { key: 'serviceRadius',       label: 'Service Radius',         type: 'number' },
  { key: 'modeOfService',       label: 'Mode of Service',        type: 'modeOfService' },
  { key: 'languagesSupported',  label: 'Languages Supported' },
  { key: 'primaryCategoryId',   label: 'Primary Category ID',   type: 'number' },
  { key: 'primarySubCategoryId',label: 'Primary Sub-Category ID', type: 'number' },
  { key: 'address',             label: 'Address',                type: 'textarea', span: true, required: true },
  { key: 'formattedAddress',    label: 'Formatted Address',      type: 'textarea', span: true },
  { key: 'placeId',             label: 'Place ID' },
  { key: 'plotNo',              label: 'Plot No' },
  { key: 'landmark',            label: 'Landmark' },
  { key: 'postalCode',          label: 'Postal Code',            required: true },
  { key: 'countryCode',         label: 'Country',                type: 'country' },
  { key: 'stateCode',           label: 'State',                  type: 'state' },
  { key: 'cityCode',            label: 'City',                   type: 'city' },
  { key: 'latitude',            label: 'Latitude',               type: 'number' },
  { key: 'longitude',           label: 'Longitude',              type: 'number' },
  { key: 'logo',                label: 'Logo URL' },
  { key: 'galleryImages',       label: 'Gallery Photos',         type: 'gallery', span: true },
  { key: 'website',             label: 'Website',                type: 'url' },
  { key: 'branchAddress',       label: 'Branch Address',         type: 'textarea', span: true },
  { key: 'description',         label: 'Description',            type: 'textarea', span: true },
  { key: 'mapLink',             label: 'Map Link' },
  { key: 'licenseNumber',       label: 'License Number' },
  { key: 'paymentMethods',      label: 'Payment Methods',        type: 'textarea', span: true },
  { key: 'refundPolicy',        label: 'Refund Policy',          type: 'textarea', span: true },
  { key: 'serviceHighlights',   label: 'Service Highlights',     type: 'textarea', span: true },
  { key: 'accountHolderName',   label: 'Account Holder Name' },
  { key: 'bankName',            label: 'Bank Name' },
  { key: 'accountNumber',       label: 'Account Number' },
  { key: 'ifscCode',            label: 'IFSC Code' },
  { key: 'razorpayKey',         label: 'Razorpay Key' },
];

const getEditTabForField = (key) => {
  const generalKeys = new Set([
    'businessName', 'ownerName', 'contactNumber', 'whatsappNumber', 'email',
    'industry', 'businessSegment', 'businessType', 'gstChoice', 'gstNumber', 'businessPan', 'aadhaar', 'udyam',
    'nature', 'experience', 'hours', 'serviceArea', 'serviceRadius', 'modeOfService',
    'languagesSupported', 'logo', 'galleryImages', 'website', 'licenseNumber', 'description',
    'primaryCategoryId', 'primarySubCategoryId',
  ]);
  const addressKeys = new Set([
    'address', 'formattedAddress', 'placeId', 'plotNo', 'landmark', 'postalCode',
    'countryCode', 'stateCode', 'cityCode', 'latitude', 'longitude', 'branchAddress', 'mapLink',
  ]);
  const bankingKeys = new Set(['accountHolderName', 'bankName', 'accountNumber', 'ifscCode', 'razorpayKey']);
  const policyKeys  = new Set(['paymentMethods', 'refundPolicy', 'serviceHighlights']);

  if (generalKeys.has(key)) return 'general';
  if (addressKeys.has(key)) return 'address';
  if (bankingKeys.has(key)) return 'bank';
  if (policyKeys.has(key))  return 'policy';
  return 'general';
};

/* ── Validation ────────────────────────────────────────────────── */
const PHONE_RE  = /^[6-9][0-9]{9}$/;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GST_RE    = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE    = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE   = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const POSTAL_RE = /^[1-9][0-9]{5}$/;
const URL_RE    = /^https?:\/\/.+\..+/;

const validateBusinessForm = (form) => {
  const errors = {};

  if (!form.businessName?.trim()) {
    errors.businessName = 'Business name is required.';
  } else if (form.businessName.trim().length < 2) {
    errors.businessName = 'Business name must be at least 2 characters.';
  }

  if (!form.ownerName?.trim()) {
    errors.ownerName = 'Owner name is required.';
  } else if (form.ownerName.trim().length < 2) {
    errors.ownerName = 'Owner name must be at least 2 characters.';
  }

  if (!form.industry?.trim()) {
    errors.industry = 'Industry is required.';
  }
  if (!form.businessSegment?.trim()) {
    errors.businessSegment = 'Segment is required.';
  }
  if (!form.businessType?.trim()) {
    errors.businessType = 'Business type is required.';
  }
  if (!form.address?.trim()) {
    errors.address = 'Address is required.';
  }

  if (form.email?.trim() && !EMAIL_RE.test(form.email.trim())) {
    errors.email = 'Enter a valid business email address.';
  }
  if (form.contactNumber?.trim() && !PHONE_RE.test(form.contactNumber.trim())) {
    errors.contactNumber = 'Enter a valid 10-digit Indian mobile number.';
  }
  if (form.whatsappNumber?.trim() && !PHONE_RE.test(form.whatsappNumber.trim())) {
    errors.whatsappNumber = 'Enter a valid 10-digit Indian mobile number.';
  }
  if (!form.gstChoice?.trim()) {
    errors.gstChoice = 'Select whether the business has GST.';
  }
  if (form.gstChoice === 'GST') {
    if (!form.gstNumber?.trim()) {
      errors.gstNumber = 'GST number is required.';
    } else if (!GST_RE.test(form.gstNumber.trim().toUpperCase())) {
      errors.gstNumber = 'Invalid GST. Example: 22AAAAA0000A1Z5';
    }
  }
  if (form.gstChoice === 'NON_GST') {
    if (!form.aadhaar?.trim()) {
      errors.aadhaar = 'Aadhaar number is required.';
    } else if (!/^[0-9]{12}$/.test(form.aadhaar.trim().replace(/\D/g, ''))) {
      errors.aadhaar = 'Enter a valid 12-digit Aadhaar number.';
    }
  }

  // PAN is only mandatory on its own when the business has neither GST nor Aadhaar to
  // identify it — GST encodes a PAN already, and Aadhaar is an accepted alternative proof.
  const hasGstIdentity = form.gstChoice === 'GST' && form.gstNumber?.trim();
  const hasAadhaarIdentity = form.gstChoice === 'NON_GST' && form.aadhaar?.trim();
  if (!hasGstIdentity && !hasAadhaarIdentity && !form.businessPan?.trim()) {
    errors.businessPan = 'PAN number is required when GST and Aadhaar are both missing.';
  } else if (form.businessPan?.trim() && !PAN_RE.test(form.businessPan.trim().toUpperCase())) {
    errors.businessPan = 'Invalid PAN. Example: AAAAA0000A';
  }
  if (form.ifscCode?.trim() && !IFSC_RE.test(form.ifscCode.trim().toUpperCase())) {
    errors.ifscCode = 'Invalid IFSC. Example: SBIN0001234';
  }
  if (!form.postalCode?.trim()) {
    errors.postalCode = 'PIN code is required.';
  } else if (!POSTAL_RE.test(form.postalCode.trim())) {
    errors.postalCode = 'Enter a valid 6-digit PIN code.';
  }
  if (form.website?.trim() && !URL_RE.test(form.website.trim())) {
    errors.website = 'Must start with http:// or https://';
  }
  if (form.latitude?.toString().trim()) {
    const lat = Number(form.latitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = 'Latitude must be between -90 and 90.';
    }
  }
  if (form.longitude?.toString().trim()) {
    const lng = Number(form.longitude);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      errors.longitude = 'Longitude must be between -180 and 180.';
    }
  }
  if (form.accountNumber?.trim() && !/^[0-9]{9,18}$/.test(form.accountNumber.trim())) {
    errors.accountNumber = 'Account number must be 9–18 digits.';
  }

  return errors;
};

/* ── Form mapping ───────────────────────────────────────────── */
const buildBusinessFormState = (profile) => {
  const state = BUSINESS_PROFILE_FIELDS.reduce((acc, field) => {
    const value = profile?.[field.key];
    acc[field.key] = value !== null && value !== undefined ? value : '';
    return acc;
  }, {});
  // Older profiles saved before gstChoice existed don't have it set — infer it from
  // whichever of GST number / Aadhaar is actually on file, so editing one doesn't
  // suddenly demand the other be filled in too.
  if (!state.gstChoice) {
    if (state.gstNumber) state.gstChoice = 'GST';
    else if (state.aadhaar) state.gstChoice = 'NON_GST';
  }
  state.galleryImages = Array.isArray(profile?.galleryImages) ? profile.galleryImages : [];
  return state;
};

const buildBusinessPayload = (form) => {
  const payload = BUSINESS_PROFILE_FIELDS.reduce((acc, field) => {
    const value = form?.[field.key];
    if (value === null || value === undefined || value === '') {
      acc[field.key] = null;
      return acc;
    }
    if (field.type === 'number') {
      const parsed = Number(value);
      acc[field.key] = Number.isNaN(parsed) ? null : parsed;
      return acc;
    }
    acc[field.key] = typeof value === 'string' ? value.trim() : value;
    return acc;
  }, {});
  // Only the chosen KYC path's identifier should be saved — clear whichever one the
  // gstChoice toggle says doesn't apply, instead of persisting stale leftover data.
  if (form.gstChoice === 'GST') payload.aadhaar = null;
  if (form.gstChoice === 'NON_GST') payload.gstNumber = null;
  return payload;
};

/* ── Select field renderer ─────────────────────────────────────── */
function SelectField({ value, onChange, options, placeholder, disabled, ...props }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} onBlur={props.onBlur}>
      <option value="">{placeholder}</option>
      {options.map((opt) => {
        const val  = typeof opt === 'string' ? opt : (opt.value || opt.id || opt.typeName || opt.name || String(opt));
        const label = typeof opt === 'string' ? opt : (opt.label || opt.typeName || opt.name || val);
        return <option key={val} value={val}>{label}</option>;
      })}
    </select>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
function BusinessProfileEditPage({ token }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [message, setMessage]     = useState({ type: 'info', text: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [viewUser, setViewUser]   = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [form, setForm]           = useState(() => buildBusinessFormState(null));
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched]     = useState({});
  const [activeTab, setActiveTab] = useState('general');

  // Reference data for dropdowns
  const [industries, setIndustries]   = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [countries, setCountries]     = useState([]);
  const [states, setStates]           = useState([]);
  const [cities, setCities]           = useState([]);
  const [customHours, setCustomHours] = useState(false);

  // Logo upload
  const logoInputRef = useRef(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Gallery photos upload
  const galleryInputRef = useRef(null);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  /* ── Load industries + countries on mount ────────────────────── */
  useEffect(() => {
    listIndustries(token).then((res) => {
      setIndustries(Array.isArray(res?.data) ? res.data : []);
    }).catch(() => setIndustries([]));
    listCountries(token).then((res) => {
      setCountries(Array.isArray(res?.data) ? res.data : []);
    }).catch(() => setCountries([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Reload business types when segment changes ─────────────── */
  useEffect(() => {
    if (!form.businessSegment) { setBusinessTypes([]); return; }
    listBusinessTypes(token, form.businessSegment).then((res) => {
      setBusinessTypes(Array.isArray(res?.data) ? res.data : []);
    }).catch(() => setBusinessTypes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.businessSegment]);

  // Reload states when countryCode changes — only touches the *option list*, never the
  // form's own stateCode/cityCode, so hydrating an existing profile's saved code doesn't
  // get wiped out while the matching reference list is still loading in.
  useEffect(() => {
    if (!form.countryCode) { setStates([]); setCities([]); return; }
    listStates(token, form.countryCode).then((res) => {
      setStates(Array.isArray(res?.data) ? res.data : []);
    }).catch(() => setStates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.countryCode]);

  // Reload cities when stateCode changes — same non-destructive rule as above.
  useEffect(() => {
    if (!form.stateCode) { setCities([]); return; }
    listCities(token, form.stateCode).then((res) => {
      setCities(Array.isArray(res?.data) ? res.data : []);
    }).catch(() => setCities([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.stateCode]);

  /* ── Load profile ──────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      setMessage({ type: 'info', text: '' });
      try {
        const response = await fetchBusinessDetails(token, id);
        const data = response?.data || {};
        setViewUser(data.user || null);
        const profile = data.businessProfile || null;
        setBusinessProfile(profile);
        setForm(buildBusinessFormState(profile));
        // Detect if current hours value is a custom (non-preset) value
        const currentHours = profile?.hours || '';
        const isCustom = currentHours && !HOURS_PRESETS.find((p) => p.value === currentHours && p.value !== '__custom__');
        setCustomHours(Boolean(isCustom));
      } catch (error) {
        setMessage({ type: 'error', text: error.message || 'Failed to load business profile.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Real-time validation if touched
    if (touched[key] || formErrors[key]) {
      const allErrors = validateBusinessForm({ ...form, [key]: value });
      setFormErrors((prev) => {
        const next = { ...prev };
        if (allErrors[key]) next[key] = allErrors[key];
        else delete next[key];
        return next;
      });
    }
    // When segment changes, clear businessType
    if (key === 'businessSegment') {
      setForm((prev) => ({ ...prev, businessSegment: value, businessType: '' }));
    }
  };

  const handleBlur = (key) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    const allErrors = validateBusinessForm(form);
    if (allErrors[key]) {
      setFormErrors((prev) => ({ ...prev, [key]: allErrors[key] }));
    }
  };

  const openLogoUpload = () => {
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
      logoInputRef.current.click();
    }
  };

  const handleLogoFile = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    setMessage({ type: 'info', text: '' });
    try {
      const response = await uploadBannerImages(token, [file]);
      const url = response?.data?.urls?.[0];
      if (!url) throw new Error('Upload failed. No file URL returned.');
      handleChange('logo', url);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload logo.' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const openGalleryUpload = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  const handleGalleryFiles = async (event) => {
    const files = Array.from(event?.target?.files || []);
    if (!files.length) return;
    setIsUploadingGallery(true);
    setMessage({ type: 'info', text: '' });
    try {
      const response = await uploadBannerImages(token, files);
      const urls = Array.isArray(response?.data?.urls) ? response.data.urls : [];
      if (!urls.length) throw new Error('Upload failed. No file URLs returned.');
      setForm((prev) => ({ ...prev, galleryImages: [...(prev.galleryImages || []), ...urls] }));
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload photos.' });
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const removeGalleryImage = (url) => {
    setForm((prev) => ({ ...prev, galleryImages: (prev.galleryImages || []).filter((u) => u !== url) }));
  };

  const handleHoursPreset = (val) => {
    if (val === '__custom__') {
      setCustomHours(true);
      handleChange('hours', '');
    } else {
      setCustomHours(false);
      handleChange('hours', val);
    }
  };

  /* ── Map pick ───────────────────────────────────────────────── */
  const handleMapPick = useCallback((lat, lng) => {
    handleChange('latitude', lat);
    handleChange('longitude', lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Address search result → fill fields (same flow as Business Create) ─── */
  const handleAddressSelect = useCallback((place) => {
    const matchCode = (list, nameKey, codeKey, query) => {
      if (!query) return '';
      const q = query.toLowerCase().trim();
      const exact = list.find((i) => (i[nameKey] || '').toLowerCase() === q);
      if (exact) return exact[codeKey];
      const partial = list.find((i) => (i[nameKey] || '').toLowerCase().startsWith(q) || q.startsWith((i[nameKey] || '').toLowerCase()));
      return partial ? partial[codeKey] : '';
    };

    const newCountry = place.countryCode || 'IN';

    listStates(token, newCountry).then((stRes) => {
      const stList = Array.isArray(stRes?.data) ? stRes.data : [];
      setStates(stList);
      const matchedState = matchCode(stList, 'name', 'code', place.stateCode);

      if (matchedState) {
        listCities(token, matchedState).then((ctRes) => {
          const ctList = Array.isArray(ctRes?.data) ? ctRes.data : [];
          setCities(ctList);
          const matchedCity = matchCode(ctList, 'name', 'code', place.cityCode);
          setForm((prev) => ({
            ...prev,
            address:     place.address    || prev.address,
            plotNo:      place.plotNo     || prev.plotNo,
            landmark:    place.landmark   || prev.landmark,
            postalCode:  place.postalCode || prev.postalCode,
            countryCode: newCountry,
            stateCode:   matchedState,
            cityCode:    matchedCity || '',
            latitude:    place.lat || prev.latitude,
            longitude:   place.lng || prev.longitude,
          }));
        }).catch(() => {
          setForm((prev) => ({
            ...prev,
            address: place.address || prev.address, plotNo: place.plotNo || prev.plotNo,
            landmark: place.landmark || prev.landmark, postalCode: place.postalCode || prev.postalCode,
            countryCode: newCountry, stateCode: matchedState, cityCode: '',
            latitude: place.lat || prev.latitude, longitude: place.lng || prev.longitude,
          }));
        });
      } else {
        setForm((prev) => ({
          ...prev,
          address: place.address || prev.address, plotNo: place.plotNo || prev.plotNo,
          landmark: place.landmark || prev.landmark, postalCode: place.postalCode || prev.postalCode,
          countryCode: newCountry, stateCode: '', cityCode: '',
          latitude: place.lat || prev.latitude, longitude: place.lng || prev.longitude,
        }));
      }
    }).catch(() => {
      setForm((prev) => ({
        ...prev,
        address: place.address || prev.address, postalCode: place.postalCode || prev.postalCode,
        countryCode: newCountry, latitude: place.lat || prev.latitude, longitude: place.lng || prev.longitude,
      }));
    });

    const addrKeys = ['address', 'plotNo', 'landmark', 'postalCode', 'cityCode', 'stateCode', 'countryCode', 'latitude', 'longitude'];
    setTouched((prev) => { const n = { ...prev }; addrKeys.forEach((k) => { n[k] = true; }); return n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveProfile = async (event) => {
    if (event) event.preventDefault();
    if (!businessProfile?.userId) {
      setMessage({ type: 'error', text: 'Business profile is missing user information.' });
      return;
    }

    const errors = validateBusinessForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      // Mark all fields as touched to show errors
      const allTouched = {};
      BUSINESS_PROFILE_FIELDS.forEach((f) => { allTouched[f.key] = true; });
      setTouched(allTouched);

      const firstErrorTab = getEditTabForField(Object.keys(errors)[0]);
      setActiveTab(firstErrorTab);
      setMessage({ type: 'error', text: 'Please fix the validation errors before saving.' });
      return;
    }

    setIsSaving(true);
    setFormErrors({});
    setTouched({});
    setMessage({ type: 'info', text: '' });

    try {
      const payload = buildBusinessPayload(form);
      // Uppercase GST and PAN before saving
      if (payload.gstNumber) payload.gstNumber = payload.gstNumber.toUpperCase();
      if (payload.businessPan) payload.businessPan = payload.businessPan.toUpperCase();
      if (payload.ifscCode) payload.ifscCode = payload.ifscCode.toUpperCase();
      await updateBusinessProfile(token, businessProfile.userId, payload);
      setMessage({ type: 'success', text: 'Business profile updated.' });
      navigate(`/admin/businesses/${businessProfile.userId}`);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to update business profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Render a single field ─────────────────────────────────── */
  const renderField = (field) => {
    if (field.key === 'gstNumber' && form.gstChoice !== 'GST') return null;
    if (field.key === 'aadhaar' && form.gstChoice !== 'NON_GST') return null;

    const value = form?.[field.key] ?? '';
    const error = formErrors[field.key];
    const isTouched = touched[field.key];
    const showError = Boolean(error && (isTouched || Object.keys(formErrors).length > 0));

    const commonProps = {
      className: showError ? 'input-error' : undefined,
      onBlur: () => handleBlur(field.key),
    };

    let input;
    const fieldType = field.type || 'text';

    // PAN is only mandatory when neither GST nor Aadhaar is present to identify the
    // business — the static FIELDS config can't express that, so override it here to
    // match the same rule used in validateForm() (and stop the browser's native
    // "required" popup from blocking submit when GST/Aadhaar already covers identity).
    const isPanRequired = field.key === 'businessPan'
      ? !(form.gstChoice === 'GST' && form.gstNumber?.trim()) && !(form.gstChoice === 'NON_GST' && form.aadhaar?.trim())
      : Boolean(field.required);

    if (fieldType === 'textarea') {
      input = (
        <textarea
          value={value}
          onChange={(e) => handleChange(field.key, e.target.value)}
          {...commonProps}
        />
      );
    } else if (fieldType === 'industry') {
      const industryOptions = industries.map((ind) => ({
        value: ind?.name || ind?.industryName || String(ind?.id || ''),
        label: ind?.name || ind?.industryName || ind?.title || String(ind?.id || ''),
      }));
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={industryOptions}
          placeholder="— Select industry —"
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'segment') {
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={[
            { value: 'B2B', label: 'B2B (Business to Business)' },
            { value: 'B2C', label: 'B2C (Business to Customer)' },
          ]}
          placeholder="— Select segment —"
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'businessType') {
      const fallbackTypes = ['Manufacturer', 'Trader / Distributor', 'Retailer', 'Service Provider',
        'Wholesaler', 'Importer / Exporter', 'Consultant', 'Other'];
      const typeOptions = businessTypes.length > 0
        ? businessTypes.map((t) => ({
            value: t?.typeName || t?.name || String(t),
            label: t?.typeName || t?.name || String(t),
          }))
        : fallbackTypes.map((n) => ({ value: n, label: n }));
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={typeOptions}
          placeholder={form.businessSegment ? '— Select type —' : '— Select segment first —'}
          disabled={!form.businessSegment && businessTypes.length === 0}
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'gstChoice') {
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={[
            { value: 'GST', label: 'Yes, has GST' },
            { value: 'NON_GST', label: 'No GST' },
          ]}
          placeholder="— Select —"
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'nature') {
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={NATURE_OPTIONS}
          placeholder="— Select nature —"
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'modeOfService') {
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={['Online', 'Offline', 'Both']}
          placeholder="— Select mode —"
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'country') {
      const countryOptions = countries.map((c) => ({ value: c?.code || '', label: c?.name || c?.code || '' }));
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={countryOptions}
          placeholder="— Select country —"
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'state') {
      const stateOptions = states.map((s) => ({ value: s?.code || '', label: s?.name || s?.code || '' }));
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={stateOptions}
          placeholder={form.countryCode ? '— Select state —' : '— Select country first —'}
          disabled={!form.countryCode}
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'city') {
      const cityOptions = cities.map((c) => ({ value: c?.code || '', label: c?.name || c?.code || '' }));
      input = (
        <SelectField
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          options={cityOptions}
          placeholder={form.stateCode ? '— Select city —' : '— Select state first —'}
          disabled={!form.stateCode}
          onBlur={() => handleBlur(field.key)}
        />
      );
    } else if (fieldType === 'hours') {
      const selectedPreset = HOURS_PRESETS.find((p) => p.value === value && p.value !== '__custom__')
        ? value : (customHours || (value && !HOURS_PRESETS.find((p) => p.value === value)) ? '__custom__' : '');
      input = (
        <>
          <select
            value={selectedPreset}
            onChange={(e) => handleHoursPreset(e.target.value)}
            onBlur={() => handleBlur(field.key)}
            className={showError ? 'input-error' : undefined}
          >
            <option value="">— Select hours —</option>
            {HOURS_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {(customHours || (value && !HOURS_PRESETS.find((p) => p.value === value && p.value !== '__custom__'))) ? (
            <input
              type="text"
              placeholder="e.g. Mon – Sat 9:00 AM – 8:00 PM, Sun closed"
              value={value}
              onChange={(e) => handleChange(field.key, e.target.value)}
              style={{ marginTop: 8 }}
              className={showError ? 'input-error' : undefined}
            />
          ) : null}
        </>
      );
    } else if (fieldType === 'number') {
      input = (
        <input
          type="number"
          value={value}
          step={field.key === 'latitude' || field.key === 'longitude' ? 'any' : undefined}
          onChange={(e) => handleChange(field.key, e.target.value)}
          required={isPanRequired}
          {...commonProps}
        />
      );
    } else if (field.key === 'logo') {
      input = (
        <>
          <input
            type="text"
            placeholder="https://... (or upload a file)"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            {...commonProps}
          />
          <div className="bc-doc-upload-row" style={{ marginTop: 8 }}>
            <button type="button" className="ghost-btn small" onClick={openLogoUpload} disabled={isUploadingLogo}>
              {isUploadingLogo ? 'Uploading…' : value ? 'Replace logo' : 'Upload logo'}
            </button>
            {value ? (
              <a href={value} target="_blank" rel="noreferrer" className="bc-doc-uploaded">✓ view</a>
            ) : (
              <span className="bc-hint">No logo uploaded yet</span>
            )}
          </div>
        </>
      );
    } else if (fieldType === 'gallery') {
      const images = Array.isArray(value) ? value : [];
      input = (
        <>
          <div className="gallery-grid">
            {images.map((url) => (
              <div key={url} className="gallery-thumb">
                <img src={url} alt="Business" />
                <button type="button" className="gallery-remove-btn" onClick={() => removeGalleryImage(url)}>✕</button>
              </div>
            ))}
            <button
              type="button"
              className="ghost-btn small gallery-add-btn"
              onClick={openGalleryUpload}
              disabled={isUploadingGallery}
            >
              {isUploadingGallery ? 'Uploading…' : '+ Add Photos'}
            </button>
          </div>
          {images.length === 0 ? <span className="bc-hint">No gallery photos yet</span> : null}
        </>
      );
    } else {
      // text, email, tel, url
      const htmlType = ['email', 'tel', 'url'].includes(fieldType) ? fieldType : 'text';
      input = (
        <input
          type={htmlType}
          value={value}
          onChange={(e) => handleChange(field.key, e.target.value)}
          required={isPanRequired}
          {...commonProps}
        />
      );
    }

    return (
      <label
        key={`business-edit-${field.key}`}
        className={`field ${field.span ? 'field-span' : ''} ${error ? 'field-error' : ''}`}
      >
        <span>
          {field.label}
          {isPanRequired && <span className="field-required"> *</span>}
        </span>
        {input}
        {showError && <span className="field-error-msg">{error}</span>}
      </label>
    );
  };

  const titleName = businessProfile?.businessName || getUserName(viewUser);

  return (
    <div className="users-page business-page business-profile-edit-page">
      <div className="users-head">
        <div>
          <h2 className="panel-title">Edit Business Profile</h2>
          <p className="panel-subtitle">{titleName || 'Update business KYC and details.'}</p>
        </div>
      </div>

      <Banner message={message} onDismiss={() => setMessage({ type: 'info', text: '' })} />

      <div className="panel card business-profile-edit-card">
        {isLoading ? (
          <p className="empty-state">Loading business profile...</p>
        ) : (
          <>
            <div className="user-view-tabs">
              {[
                { key: 'general', label: 'General Details' },
                { key: 'address', label: 'Address Details' },
                { key: 'bank',    label: 'Banking Details' },
                { key: 'policy',  label: 'Policies & Highlights' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`user-view-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'address' ? (
              <div className="bc-address-tab-intro" style={{ padding: '20px 20px 0' }}>
                <p className="bc-section-sub">
                  Search for the business address, then confirm the fields below and adjust the pin on the map.
                  Country/State/City are picked from the same reference list the app uses, so the saved codes
                  always match — typing them by hand risks drifting from what's actually in the database.
                </p>
                <AddressSearchBox onSelect={handleAddressSelect} />
                <div className="bc-map-section">
                  <div className="bc-map-head">
                    <p className="bc-map-title">Pin on Map</p>
                    <p className="bc-map-sub">Click to drop a pin · Drag to adjust</p>
                  </div>
                  <MapPicker
                    lat={form.latitude ? Number(form.latitude) : null}
                    lng={form.longitude ? Number(form.longitude) : null}
                    onPick={handleMapPick}
                  />
                </div>
              </div>
            ) : null}

            <form id="business-edit-form" className="field-grid business-profile-edit-grid" onSubmit={saveProfile}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFile}
                style={{ display: 'none' }}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleGalleryFiles}
                style={{ display: 'none' }}
              />
              {BUSINESS_PROFILE_FIELDS
                .filter((field) => getEditTabForField(field.key) === activeTab)
                .map((field) => renderField(field))}
            </form>

            <div className="form-actions" style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '0 20px 20px' }}>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => navigate(`/admin/businesses/${id || businessProfile?.userId || ''}`)}
              >
                Cancel
              </button>
              <button type="submit" form="business-edit-form" className="primary-btn" disabled={isSaving}>
                {isSaving ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default BusinessProfileEditPage;
