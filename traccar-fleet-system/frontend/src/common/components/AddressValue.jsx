import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from '@mui/material';
import { useTranslation } from './LocalizationProvider';
import { useCatch } from '../../reactHelper';
import fetchOrThrow from '../util/fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';

const AddressValue = ({ latitude, longitude, originalAddress, autoFetch = false, emptyText = '' }) => {
  const t = useTranslation();

  const addressEnabled = useSelector((state) => state.session.server.geocoderEnabled);

  const [address, setAddress] = useState(originalAddress || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAddress(originalAddress || '');
  }, [latitude, longitude, originalAddress]);

  useEffect(() => {
    if (!autoFetch || originalAddress || latitude == null || longitude == null) {
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const query = new URLSearchParams({ latitude, longitude });
    fetchOrThrow(`${traccarPath('/api/server/geocode')}?${query.toString()}`)
      .then((response) => response.text())
      .then((text) => {
        if (!cancelled && text?.trim()) {
          setAddress(text.trim());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [autoFetch, originalAddress, latitude, longitude]);

  const showAddress = useCatch(async (event) => {
    event.preventDefault();
    const query = new URLSearchParams({ latitude, longitude });
    const response = await fetchOrThrow(`${traccarPath('/api/server/geocode')}?${query.toString()}`);
    setAddress((await response.text()).trim());
  });

  if (address) {
    return address;
  }
  if (loading) {
    return t('sharedResolvingAddress') || 'Resolving address…';
  }
  if (addressEnabled && !autoFetch) {
    return (<Link href="#" onClick={showAddress}>{t('sharedShowAddress')}</Link>);
  }
  return emptyText;
};

export default AddressValue;
