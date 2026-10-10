import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navigation, MapPin, Home, Briefcase, Compass, ArrowRight, TestTube } from 'lucide-react';
import { useLocationContext } from '../../context/LocationContext';
import { Button, Input, Card, useToast } from '../../components/ui';
import { LocationPickerMap } from '../../components/map/LocationPickerMap';

const DEFAULT_COORDS = {
  lat: 16.343565,
  lng: 81.054082,
};

export const LocationSetup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { coordinates, setCoordinates, addAddress, setTestLocation } = useLocationContext();

  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [label, setLabel] = useState('Home');
  const [line, setLine] = useState('');
  const [pincode, setPincode] = useState('521356');
  const [landmark, setLandmark] = useState('');
  const [coords, setCoords] = useState(() => ({
    lat: coordinates?.lat || DEFAULT_COORDS.lat,
    lng: coordinates?.lng || DEFAULT_COORDS.lng,
  }));

  useEffect(() => {
    if (coordinates?.lat && coordinates?.lng) {
      setCoords({ lat: coordinates.lat, lng: coordinates.lng });
    }
  }, [coordinates]);

  // Handle GPS "Use my location"
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setCoords(newCoords);
        setCoordinates(newCoords);
        setLocating(false);
        addToast('Location updated from GPS', 'success');
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          addToast('Location permission denied. Please enter your address manually below.', 'info');
        } else {
          addToast('Could not retrieve GPS location. Please enter manually.', 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Handle Dev Test Location
  const handleSetTestLocation = async () => {
    try {
      const data = await setTestLocation();
      setCoords({ lat: data.lat, lng: data.lng });
      setPincode(data.pincode || '521356');
      setLandmark(data.landmark || '');
      setLine(data.line || 'Main Road, Gudlavalleru');
      addToast('Set test location to Gudlavalleru (Dev)', 'success');
    } catch {
      // Fallback in case endpoint is unreachable
      setCoords(DEFAULT_COORDS);
      setPincode('521356');
      setLine('Main Road, Gudlavalleru');
      setLandmark('Gudlavalleru Engineering College');
      addToast('Applied fallback test coordinates', 'info');
    }
  };

  // Submit address
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!line.trim() || !pincode.trim()) {
      addToast('Please fill in address and PIN code', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await addAddress({
        label,
        line: line.trim(),
        pincode: pincode.trim(),
        landmark: landmark.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        isDefault: true,
      });

      addToast('Delivery address saved successfully!', 'success');
      navigate('/app', { replace: true });
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save address. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 max-w-md mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
          {t('customer.locationSetupTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-ink-600 mt-0.5">
          {t('customer.locationSetupSubtitle')}
        </p>
      </div>

      {/* GPS Action & Dev Button */}
      <div className="flex flex-col gap-2.5">
        <Button
          type="button"
          variant="primary"
          size="lg"
          loading={locating}
          onClick={handleUseMyLocation}
          className="w-full min-h-[52px] font-bold text-sm shadow-md gap-2 rounded-2xl"
        >
          <Navigation className="w-5 h-5 fill-current" />
          <span>{t('customer.useMyLocation')}</span>
        </Button>

        {/* DEV ONLY Test Location Button */}
        {import.meta.env.MODE !== 'production' && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleSetTestLocation}
            className="w-full text-xs font-semibold py-2 border-dashed border-primary-400 bg-primary-50/50 text-primary-800 gap-1.5"
          >
            <TestTube className="w-4 h-4 text-primary-600" />
            <span>{t('customer.setTestLocation')}</span>
          </Button>
        )}
      </div>

      <div className="relative flex items-center my-1">
        <div className="flex-grow border-t border-ink-200" />
        <span className="flex-shrink mx-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">
          {t('customer.orEnterManually')}
        </span>
        <div className="flex-grow border-t border-ink-200" />
      </div>

      {/* Address Form Card */}
      <Card className="p-4 bg-white border border-ink-200 shadow-xs space-y-4">
        {/* Label Selector Chips */}
        <div>
          <label className="block text-xs font-bold text-ink-800 uppercase tracking-wider mb-2">
            {t('customer.saveAddressAs')}
          </label>
          <div className="flex gap-2">
            {[
              { id: 'Home', label: t('customer.home'), icon: Home },
              { id: 'Work', label: t('customer.work'), icon: Briefcase },
              { id: 'Other', label: t('customer.other'), icon: Compass },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = label === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLabel(item.id)}
                  className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-primary-50 border-primary-600 text-primary-700 shadow-xs'
                      : 'bg-white border-ink-300 text-ink-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            label={t('customer.addressLine')}
            placeholder="e.g. Flat 302, Sri Sai Towers, Main Road"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('customer.pincode')}
              placeholder="e.g. 521356"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              maxLength={6}
              required
            />
            <Input
              label={t('customer.landmark')}
              placeholder="e.g. Near Water Tank"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
            />
          </div>

          {/* Leaflet Draggable Pin Map */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-ink-800 uppercase tracking-wider">
                Pinpoint on Map
              </span>
              <span className="text-[11px] text-ink-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary-600" />
                Drag marker to adjust
              </span>
            </div>

            <LocationPickerMap
              latitude={coords.lat}
              longitude={coords.lng}
              radiusKm={0}
              height="200px"
              onChange={({ latitude, longitude }) => {
                setCoords({ lat: latitude, lng: longitude });
              }}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="w-full min-h-[56px] text-base font-bold shadow-md gap-2 rounded-2xl"
            >
              <span>{t('customer.saveAndContinue')}</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
