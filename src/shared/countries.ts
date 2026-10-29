/**
 * Where a driver races from, for the country flags of the relative, the standings and the
 * battle. The session YAML gives each driver a flair (DriverInfo.Drivers[].FlairName, e.g.
 * 'Spain', 'United Kingdom', 'Brazil'; '-none-' when they chose none; ClubName now says 'None'),
 * worded in English as iRacing writes it. It is matched by its words (case, accents and
 * punctuation ignored) against the countries and the usual alternative names, and becomes a
 * flag code of country-flag-icons (renderer ui/CountryFlag.vue): ISO 3166 alpha-2, or one of
 * its own codes for the home nations ('GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR'), Catalonia
 * ('ES-CT'), Kosovo ('XK') and the European Union ('EU').
 *
 * FlairID is not used: iRacing does not publish its ids, and every flair names its country.
 * Pure.
 */

/**
 * Flag code, then the names it goes by (the first one is the country's English short name).
 * Every code is one of country-flag-icons' 3x2 flags (countries.test.ts checks them all).
 */
const TABLE: readonly (readonly [code: string, ...names: string[]])[] = [
  ['AD', 'Andorra'],
  ['AE', 'United Arab Emirates', 'UAE'],
  ['AF', 'Afghanistan'],
  ['AG', 'Antigua and Barbuda'],
  ['AI', 'Anguilla'],
  ['AL', 'Albania'],
  ['AM', 'Armenia'],
  ['AO', 'Angola'],
  ['AQ', 'Antarctica'],
  ['AR', 'Argentina'],
  ['AS', 'American Samoa'],
  ['AT', 'Austria'],
  ['AU', 'Australia'],
  ['AW', 'Aruba'],
  ['AX', 'Aland Islands', 'Åland Islands'],
  ['AZ', 'Azerbaijan'],
  ['BA', 'Bosnia and Herzegovina', 'Bosnia'],
  ['BB', 'Barbados'],
  ['BD', 'Bangladesh'],
  ['BE', 'Belgium'],
  ['BF', 'Burkina Faso'],
  ['BG', 'Bulgaria'],
  ['BH', 'Bahrain'],
  ['BI', 'Burundi'],
  ['BJ', 'Benin'],
  ['BL', 'Saint Barthelemy'],
  ['BM', 'Bermuda'],
  ['BN', 'Brunei', 'Brunei Darussalam'],
  ['BO', 'Bolivia', 'Bolivia, Plurinational State of'],
  ['BQ', 'Bonaire, Sint Eustatius and Saba', 'Caribbean Netherlands'],
  ['BR', 'Brazil'],
  ['BS', 'Bahamas'],
  ['BT', 'Bhutan'],
  ['BV', 'Bouvet Island'],
  ['BW', 'Botswana'],
  ['BY', 'Belarus'],
  ['BZ', 'Belize'],
  ['CA', 'Canada'],
  ['CC', 'Cocos (Keeling) Islands', 'Cocos Islands'],
  ['CD', 'Congo, Democratic Republic of the', 'Democratic Republic of the Congo', 'DR Congo'],
  ['CF', 'Central African Republic'],
  ['CG', 'Congo', 'Republic of the Congo'],
  ['CH', 'Switzerland'],
  ['CI', "Cote d'Ivoire", 'Ivory Coast'],
  ['CK', 'Cook Islands'],
  ['CL', 'Chile'],
  ['CM', 'Cameroon'],
  ['CN', 'China', "China, People's Republic of"],
  ['CO', 'Colombia'],
  ['CR', 'Costa Rica'],
  ['CU', 'Cuba'],
  ['CV', 'Cabo Verde', 'Cape Verde'],
  ['CW', 'Curacao', 'Curaçao'],
  ['CX', 'Christmas Island'],
  ['CY', 'Cyprus'],
  ['CZ', 'Czechia', 'Czech Republic'],
  ['DE', 'Germany'],
  ['DJ', 'Djibouti'],
  ['DK', 'Denmark'],
  ['DM', 'Dominica'],
  ['DO', 'Dominican Republic'],
  ['DZ', 'Algeria'],
  ['EC', 'Ecuador'],
  ['EE', 'Estonia'],
  ['EG', 'Egypt'],
  ['EH', 'Western Sahara'],
  ['ER', 'Eritrea'],
  ['ES', 'Spain'],
  ['ES-CT', 'Catalonia', 'Catalunya'],
  ['ET', 'Ethiopia'],
  ['EU', 'European Union', 'Europe'],
  ['FI', 'Finland'],
  ['FJ', 'Fiji'],
  ['FK', 'Falkland Islands', 'Falkland Islands (Malvinas)'],
  ['FM', 'Micronesia', 'Micronesia, Federated States of'],
  ['FO', 'Faroe Islands'],
  ['FR', 'France'],
  ['GA', 'Gabon'],
  [
    'GB',
    'United Kingdom',
    'Great Britain',
    'UK',
    'United Kingdom of Great Britain and Northern Ireland'
  ],
  ['GB-ENG', 'England'],
  ['GB-NIR', 'Northern Ireland'],
  ['GB-SCT', 'Scotland'],
  ['GB-WLS', 'Wales'],
  ['GD', 'Grenada'],
  ['GE', 'Georgia'],
  ['GF', 'French Guiana'],
  ['GG', 'Guernsey'],
  ['GH', 'Ghana'],
  ['GI', 'Gibraltar'],
  ['GL', 'Greenland'],
  ['GM', 'Gambia'],
  ['GN', 'Guinea'],
  ['GP', 'Guadeloupe'],
  ['GQ', 'Equatorial Guinea'],
  ['GR', 'Greece'],
  ['GS', 'South Georgia and the South Sandwich Islands'],
  ['GT', 'Guatemala'],
  ['GU', 'Guam'],
  ['GW', 'Guinea-Bissau'],
  ['GY', 'Guyana'],
  ['HK', 'Hong Kong'],
  ['HM', 'Heard Island and McDonald Islands'],
  ['HN', 'Honduras'],
  ['HR', 'Croatia'],
  ['HT', 'Haiti'],
  ['HU', 'Hungary'],
  ['ID', 'Indonesia'],
  ['IE', 'Ireland', 'Republic of Ireland'],
  ['IL', 'Israel'],
  ['IM', 'Isle of Man'],
  ['IN', 'India'],
  ['IO', 'British Indian Ocean Territory'],
  ['IQ', 'Iraq'],
  ['IR', 'Iran', 'Iran, Islamic Republic of'],
  ['IS', 'Iceland'],
  ['IT', 'Italy'],
  ['JE', 'Jersey'],
  ['JM', 'Jamaica'],
  ['JO', 'Jordan'],
  ['JP', 'Japan'],
  ['KE', 'Kenya'],
  ['KG', 'Kyrgyzstan'],
  ['KH', 'Cambodia'],
  ['KI', 'Kiribati'],
  ['KM', 'Comoros'],
  ['KN', 'Saint Kitts and Nevis'],
  ['KP', 'North Korea', "Korea, Democratic People's Republic of"],
  ['KR', 'South Korea', 'Korea', 'Korea, Republic of', 'Republic of Korea'],
  ['KW', 'Kuwait'],
  ['KY', 'Cayman Islands'],
  ['KZ', 'Kazakhstan'],
  ['LA', 'Laos', "Lao People's Democratic Republic"],
  ['LB', 'Lebanon'],
  ['LC', 'Saint Lucia'],
  ['LI', 'Liechtenstein'],
  ['LK', 'Sri Lanka'],
  ['LR', 'Liberia'],
  ['LS', 'Lesotho'],
  ['LT', 'Lithuania'],
  ['LU', 'Luxembourg'],
  ['LV', 'Latvia'],
  ['LY', 'Libya'],
  ['MA', 'Morocco'],
  ['MC', 'Monaco'],
  ['MD', 'Moldova', 'Moldova, Republic of'],
  ['ME', 'Montenegro'],
  ['MF', 'Saint Martin'],
  ['MG', 'Madagascar'],
  ['MH', 'Marshall Islands'],
  ['MK', 'North Macedonia', 'Macedonia'],
  ['ML', 'Mali'],
  ['MM', 'Myanmar', 'Burma'],
  ['MN', 'Mongolia'],
  ['MO', 'Macao', 'Macau'],
  ['MP', 'Northern Mariana Islands'],
  ['MQ', 'Martinique'],
  ['MR', 'Mauritania'],
  ['MS', 'Montserrat'],
  ['MT', 'Malta'],
  ['MU', 'Mauritius'],
  ['MV', 'Maldives'],
  ['MW', 'Malawi'],
  ['MX', 'Mexico'],
  ['MY', 'Malaysia'],
  ['MZ', 'Mozambique'],
  ['NA', 'Namibia'],
  ['NC', 'New Caledonia'],
  ['NE', 'Niger'],
  ['NF', 'Norfolk Island'],
  ['NG', 'Nigeria'],
  ['NI', 'Nicaragua'],
  ['NL', 'Netherlands', 'The Netherlands', 'Holland'],
  ['NO', 'Norway'],
  ['NP', 'Nepal'],
  ['NR', 'Nauru'],
  ['NU', 'Niue'],
  ['NZ', 'New Zealand'],
  ['OM', 'Oman'],
  ['PA', 'Panama'],
  ['PE', 'Peru'],
  ['PF', 'French Polynesia'],
  ['PG', 'Papua New Guinea'],
  ['PH', 'Philippines'],
  ['PK', 'Pakistan'],
  ['PL', 'Poland'],
  ['PM', 'Saint Pierre and Miquelon'],
  ['PN', 'Pitcairn', 'Pitcairn Islands'],
  ['PR', 'Puerto Rico'],
  ['PS', 'Palestine', 'Palestine, State of'],
  ['PT', 'Portugal'],
  ['PW', 'Palau'],
  ['PY', 'Paraguay'],
  ['QA', 'Qatar'],
  ['RE', 'Reunion', 'Réunion'],
  ['RO', 'Romania'],
  ['RS', 'Serbia'],
  ['RU', 'Russia', 'Russian Federation'],
  ['RW', 'Rwanda'],
  ['SA', 'Saudi Arabia'],
  ['SB', 'Solomon Islands'],
  ['SC', 'Seychelles'],
  ['SD', 'Sudan'],
  ['SE', 'Sweden'],
  ['SG', 'Singapore'],
  ['SH', 'Saint Helena', 'Saint Helena, Ascension and Tristan da Cunha'],
  ['SI', 'Slovenia'],
  ['SJ', 'Svalbard and Jan Mayen'],
  ['SK', 'Slovakia'],
  ['SL', 'Sierra Leone'],
  ['SM', 'San Marino'],
  ['SN', 'Senegal'],
  ['SO', 'Somalia'],
  ['SR', 'Suriname'],
  ['SS', 'South Sudan'],
  ['ST', 'Sao Tome and Principe'],
  ['SV', 'El Salvador'],
  ['SX', 'Sint Maarten'],
  ['SY', 'Syria', 'Syrian Arab Republic'],
  ['SZ', 'Eswatini', 'Swaziland'],
  ['TC', 'Turks and Caicos Islands'],
  ['TD', 'Chad'],
  ['TF', 'French Southern Territories'],
  ['TG', 'Togo'],
  ['TH', 'Thailand'],
  ['TJ', 'Tajikistan'],
  ['TK', 'Tokelau'],
  ['TL', 'Timor-Leste', 'East Timor'],
  ['TM', 'Turkmenistan'],
  ['TN', 'Tunisia'],
  ['TO', 'Tonga'],
  ['TR', 'Turkey', 'Türkiye', 'Turkiye'],
  ['TT', 'Trinidad and Tobago'],
  ['TV', 'Tuvalu'],
  ['TW', 'Taiwan', 'Chinese Taipei', 'Taiwan, Province of China'],
  ['TZ', 'Tanzania', 'Tanzania, United Republic of'],
  ['UA', 'Ukraine'],
  ['UG', 'Uganda'],
  ['UM', 'United States Minor Outlying Islands'],
  ['US', 'United States', 'United States of America', 'USA', 'US'],
  ['UY', 'Uruguay'],
  ['UZ', 'Uzbekistan'],
  ['VA', 'Holy See', 'Vatican City'],
  ['VC', 'Saint Vincent and the Grenadines'],
  ['VE', 'Venezuela', 'Venezuela, Bolivarian Republic of'],
  ['VG', 'British Virgin Islands', 'Virgin Islands, British'],
  ['VI', 'US Virgin Islands', 'Virgin Islands, U.S.'],
  ['VN', 'Vietnam', 'Viet Nam'],
  ['VU', 'Vanuatu'],
  ['WF', 'Wallis and Futuna'],
  ['WS', 'Samoa'],
  ['XK', 'Kosovo'],
  ['YE', 'Yemen'],
  ['YT', 'Mayotte'],
  ['ZA', 'South Africa'],
  ['ZM', 'Zambia'],
  ['ZW', 'Zimbabwe']
]

/** Lower case, no accents, '&' as 'and', every run of other characters one space. */
export function flairKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
}

const BY_NAME: ReadonlyMap<string, string> = (() => {
  const out = new Map<string, string>()
  for (const [code, ...names] of TABLE) {
    for (const n of names) out.set(flairKey(n), code)
  }
  return out
})()

/** Every flag code countryOfFlair can give (each a country-flag-icons 3x2 flag). */
export const COUNTRY_CODES: readonly string[] = Object.freeze(TABLE.map(([code]) => code))

const CODES: ReadonlySet<string> = new Set(COUNTRY_CODES)

/** A flag code countryOfFlair gives ('ES', 'GB-SCT'). */
export function isCountryCode(v: unknown): v is string {
  return typeof v === 'string' && CODES.has(v)
}

/** The English short name of a code ('Spain'); '' for anything else. */
export function countryName(code: string): string {
  for (const [c, name] of TABLE) if (c === code) return name ?? ''
  return ''
}

/**
 * The global flag: a driver who flies no country ('-none-', a flair that is no country, such as
 * the neutral one drivers under a national ban race with, or one this table does not know).
 * CountryFlag.vue draws it as a globe of OverLap's own, not a country-flag-icons flag.
 */
export const GLOBAL_FLAG = 'GLOBAL'

/**
 * The flag code of a FlairName ('Spain' -> 'ES', 'United Kingdom' -> 'GB', 'Scotland' ->
 * 'GB-SCT'); GLOBAL_FLAG for none ('-none-', 'None'), a flair that is no country, or one this
 * table does not know; '' when there is no flair at all (an empty or missing FlairName).
 */
export function countryOfFlair(name: string): string {
  if (name.trim() === '') return ''
  return BY_NAME.get(flairKey(name)) ?? GLOBAL_FLAG
}
