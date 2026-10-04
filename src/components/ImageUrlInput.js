import { useRef, useState } from 'react';
import { uploadBannerImages } from '../services/adminApi';

const MAX_SIZE_MB = 5;

// URL text field with an "Upload" button: pick an image from the gallery / files, upload it, and fill in its URL.
function ImageUrlInput({ token, value, onChange, placeholder = 'https://...' }) {
  const fileRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_SIZE_MB} MB.`);
      return;
    }
    setError('');
    setIsUploading(true);
    try {
      const response = await uploadBannerImages(token, [file]);
      const url = response?.data?.urls?.[0];
      if (!url) throw new Error('Upload failed. No URL returned.');
      onChange(url);
    } catch (uploadError) {
      setError(uploadError.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {value ? (
          <img
            src={value}
            alt=""
            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', flexShrink: 0 }}
            onError={(e) => { e.target.style.visibility = 'hidden'; }}
            onLoad={(e) => { e.target.style.visibility = 'visible'; }}
          />
        ) : null}
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          style={{
            flexShrink: 0, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
            background: '#f9fafb', fontSize: 13, fontWeight: 600, cursor: isUploading ? 'wait' : 'pointer',
          }}
        >
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {error ? <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{error}</div> : null}
    </div>
  );
}

export default ImageUrlInput;
