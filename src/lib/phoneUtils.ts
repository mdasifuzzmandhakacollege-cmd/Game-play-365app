import {
  parsePhoneNumberFromString,
  AsYouType,
  isValidPhoneNumber,
  getCountryCallingCode,
  CountryCode
} from 'libphonenumber-js';

export interface CountryInfo {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  priority?: number;
}

/**
 * Standard international countries list with calling codes and flag emojis.
 * Not restricted or biased to any single country.
 */
export const INTERNATIONAL_COUNTRIES: CountryInfo[] = [
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', priority: 1 },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', priority: 2 },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', priority: 3 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', priority: 4 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', priority: 5 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', priority: 6 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', priority: 7 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', priority: 8 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', priority: 9 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', priority: 10 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', priority: 11 },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼' },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲' },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭' },
  { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱' },
  { code: 'RO', name: 'Romania', dialCode: '+40', flag: '🇷🇴' },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪' }
];

/**
 * Validates and normalizes international phone number using libphonenumber-js.
 * Strictly adheres to E.164 standard. Never uses homemade regex.
 */
export function validateAndNormalizePhoneNumber(
  input: string,
  defaultCountry: CountryCode = 'BD'
): {
  isValid: boolean;
  e164: string | null;
  internationalFormatted: string | null;
  nationalFormatted: string | null;
  countryCode: CountryCode | null;
  callingCode: string | null;
  error: string | null;
} {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      e164: null,
      internationalFormatted: null,
      nationalFormatted: null,
      countryCode: null,
      callingCode: null,
      error: 'Phone number is required.'
    };
  }

  const cleanInput = input.trim();

  try {
    const phoneNumber = parsePhoneNumberFromString(cleanInput, defaultCountry);

    if (!phoneNumber) {
      return {
        isValid: false,
        e164: null,
        internationalFormatted: null,
        nationalFormatted: null,
        countryCode: null,
        callingCode: null,
        error: 'Please enter a valid international mobile number.'
      };
    }

    const isValid = phoneNumber.isValid();
    if (!isValid) {
      return {
        isValid: false,
        e164: null,
        internationalFormatted: phoneNumber.formatInternational() || null,
        nationalFormatted: phoneNumber.formatNational() || null,
        countryCode: (phoneNumber.country as CountryCode) || null,
        callingCode: phoneNumber.countryCallingCode ? `+${phoneNumber.countryCallingCode}` : null,
        error: 'Invalid phone number format for the selected country.'
      };
    }

    return {
      isValid: true,
      e164: phoneNumber.number, // Canonical E.164 e.g. +8801712345678
      internationalFormatted: phoneNumber.formatInternational(), // e.g. +880 1712-345678
      nationalFormatted: phoneNumber.formatNational(),
      countryCode: (phoneNumber.country as CountryCode) || defaultCountry,
      callingCode: `+${phoneNumber.countryCallingCode}`,
      error: null
    };
  } catch {
    return {
      isValid: false,
      e164: null,
      internationalFormatted: null,
      nationalFormatted: null,
      countryCode: null,
      callingCode: null,
      error: 'Failed to parse international phone number.'
    };
  }
}

/**
 * Formats user input as they type
 */
export function formatPhoneNumberAsYouType(input: string, country?: CountryCode): string {
  if (!input) return '';
  const formatter = new AsYouType(country);
  return formatter.input(input);
}

/**
 * Look up country info by ISO Alpha-2 code
 */
export function getCountryByCode(code: string): CountryInfo {
  const upper = code?.toUpperCase();
  const found = INTERNATIONAL_COUNTRIES.find((c) => c.code === upper);
  if (found) return found;
  
  // Fallback lookup calling code dynamically via libphonenumber-js
  try {
    const callingCode = getCountryCallingCode(upper as CountryCode);
    return {
      code: upper as CountryCode,
      name: upper,
      dialCode: `+${callingCode}`,
      flag: '🌐'
    };
  } catch {
    return INTERNATIONAL_COUNTRIES[0];
  }
}

/**
 * Search countries by name or calling code
 */
export function searchCountries(queryText: string): CountryInfo[] {
  if (!queryText || !queryText.trim()) {
    return INTERNATIONAL_COUNTRIES;
  }
  const q = queryText.toLowerCase().trim();
  return INTERNATIONAL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q)
  );
}
