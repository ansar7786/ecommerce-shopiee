/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  const { user } = useAuth();

  const [addresses, setAddresses] = useState([]);
  const [activeAddress, setActiveAddressState] = useState(() => {
    try {
      const saved = localStorage.getItem('kirana_active_address');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [coordinates, setCoordinatesState] = useState(() => {
    try {
      const saved = localStorage.getItem('kirana_coordinates');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  // Set active address and persist
  const setActiveAddress = useCallback((addr) => {
    setActiveAddressState(addr);
    if (addr) {
      try {
        localStorage.setItem('kirana_active_address', JSON.stringify(addr));
      } catch {
        // Ignored
      }
      if (addr.location?.coordinates && addr.location.coordinates.length === 2) {
        const coords = {
          lng: addr.location.coordinates[0],
          lat: addr.location.coordinates[1],
        };
        setCoordinatesState(coords);
        try {
          localStorage.setItem('kirana_coordinates', JSON.stringify(coords));
        } catch {
          // Ignored
        }
      }
    } else {
      localStorage.removeItem('kirana_active_address');
    }
  }, []);

  // Set active coordinates directly
  const setCoordinates = useCallback((coords) => {
    setCoordinatesState(coords);
    if (coords) {
      try {
        localStorage.setItem('kirana_coordinates', JSON.stringify(coords));
      } catch {
        // Ignored
      }
    } else {
      localStorage.removeItem('kirana_coordinates');
    }
  }, []);

  // Fetch addresses for authenticated user
  const fetchAddresses = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/users/me/addresses');
      const list = res.data.addresses || [];
      setAddresses(list);

      // If no active address is currently selected, pick default or first
      setActiveAddressState((current) => {
        if (current && list.some((a) => a._id === current._id)) {
          return current;
        }
        const defaultAddr = list.find((a) => a.isDefault) || list[0] || null;
        if (defaultAddr) {
          try {
            localStorage.setItem('kirana_active_address', JSON.stringify(defaultAddr));
          } catch {
            // Ignored
          }
          if (defaultAddr.location?.coordinates) {
            const coords = {
              lng: defaultAddr.location.coordinates[0],
              lat: defaultAddr.location.coordinates[1],
            };
            setCoordinatesState(coords);
            try {
              localStorage.setItem('kirana_coordinates', JSON.stringify(coords));
            } catch {
              // Ignored
            }
          }
        }
        return defaultAddr;
      });
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    } else {
      setAddresses([]);
    }
  }, [user, fetchAddresses]);

  // Add new address
  const addAddress = async (data) => {
    const res = await api.post('/users/me/addresses', data);
    const created = res.data.address;
    const all = res.data.addresses || [];
    setAddresses(all);
    setActiveAddress(created);
    return created;
  };

  // Delete address
  const deleteAddress = async (id) => {
    const res = await api.delete(`/users/me/addresses/${id}`);
    const remaining = res.data.addresses || [];
    setAddresses(remaining);
    if (activeAddress?._id === id) {
      const nextActive = remaining.find((a) => a.isDefault) || remaining[0] || null;
      setActiveAddress(nextActive);
    }
  };

  // Update address
  const updateAddress = async (id, data) => {
    const res = await api.patch(`/users/me/addresses/${id}`, data);
    const updated = res.data.address;
    const all = res.data.addresses || [];
    setAddresses(all);
    if (activeAddress?._id === id || updated.isDefault) {
      setActiveAddress(updated);
    }
    return updated;
  };

  // Select a saved address as active
  const selectAddress = (addr) => {
    setActiveAddress(addr);
  };

  // Set demo location via dev endpoint
  const setTestLocation = async () => {
    const res = await api.get('/dev/seed-location');
    const { lat, lng, pincode, landmark, line } = res.data;
    const testCoords = { lat, lng };
    setCoordinates(testCoords);
    return { lat, lng, pincode, landmark, line };
  };

  return (
    <LocationContext.Provider
      value={{
        addresses,
        activeAddress,
        coordinates,
        loading,
        fetchAddresses,
        setActiveAddress,
        setCoordinates,
        selectAddress,
        addAddress,
        updateAddress,
        deleteAddress,
        setTestLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

LocationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};
