import { useState, useEffect } from 'react';

export function useCountry() {
  const [countryCode, setCountryCode] = useState('');

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => setCountryCode(data.country_code)) // e.g. "IN"
      .catch(() => setCountryCode(''));
  }, []);

  return countryCode;
}