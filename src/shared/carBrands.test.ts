import { describe, expect, it } from 'vitest'
import {
  BRAND_IDS,
  BRAND_MARK_MODES,
  BRANDS,
  brandInfo,
  brandMarksShown,
  brandOfCar,
  brandsByCarIdx,
  carIdentityOf,
  distinctBrands,
  hasMultipleBrands,
  type BrandId
} from './carBrands'

/** iRacing CarScreenName -> make (road, oval, dirt, formula, rallycross; old and current). */
const BY_NAME: ReadonlyArray<readonly [name: string, brand: BrandId]> = [
  // Sports cars and prototypes
  ['Acura ARX-06 GTP', 'acura'],
  ['Acura NSX GT3 EVO 22', 'acura'],
  ['Aston Martin Vantage GT3 EVO', 'aston-martin'],
  ['Aston Martin Vantage GT4', 'aston-martin'],
  ['Aston Martin DBR9 GT1', 'aston-martin'],
  ['Audi R8 LMS EVO II GT3', 'audi'],
  ['Audi RS 3 LMS TCR', 'audi'],
  ['Audi 90 GTO', 'audi'],
  ['Audi R18', 'audi'],
  ['BMW M Hybrid V8', 'bmw'],
  ['BMW M4 GT3 EVO', 'bmw'],
  ['BMW M4 G82 GT4 Evo', 'bmw'],
  ['BMW M8 GTE', 'bmw'],
  ['BMW Z4 GT3', 'bmw'],
  ['BMW M2 CS Racing', 'bmw'],
  ['Cadillac V-Series.R GTP', 'cadillac'],
  ['Cadillac CTS-V Racecar', 'cadillac'],
  ['Chevrolet Corvette Z06 GT3.R', 'chevrolet'],
  ['Chevrolet Corvette C8.R GTE', 'chevrolet'],
  ['Chevrolet Corvette C7 Daytona Prototype', 'chevrolet'],
  ['Chevrolet Corvette C6.R GT1', 'chevrolet'],
  ['Dallara P217', 'dallara'],
  ['Ferrari 296 GT3', 'ferrari'],
  ['Ferrari 488 GT3 Evo 2020', 'ferrari'],
  ['Ferrari 488 GTE', 'ferrari'],
  ['Ferrari 499P', 'ferrari'],
  ['Ford Mustang GT3', 'ford'],
  ['Ford Mustang GT4', 'ford'],
  ['Ford GT GTE', 'ford'],
  ['Ford Mustang FR500S', 'ford'],
  ['HPD ARX-01c', 'honda'],
  ['Honda Civic Type R TCR', 'honda'],
  ['Hyundai Elantra N TCR', 'hyundai'],
  ['Hyundai Veloster N TC', 'hyundai'],
  ['Kia Optima', 'kia'],
  ['Lamborghini Huracán GT3 EVO', 'lamborghini'],
  ['Ligier JS P320', 'ligier'],
  ['Global Mazda MX-5 Cup', 'mazda'],
  ['Mazda MX-5 Roadster', 'mazda'],
  ['McLaren 720S GT3 EVO', 'mclaren'],
  ['McLaren 570S GT4', 'mclaren'],
  ['McLaren MP4-12C GT3', 'mclaren'],
  ['Mercedes-AMG GT3 2020', 'mercedes-amg'],
  ['Mercedes-AMG GT4', 'mercedes-amg'],
  ['Nissan GTP ZX-T', 'nissan'],
  ['Pontiac Solstice', 'pontiac'],
  ['Pontiac Solstice - Rookie', 'pontiac'],
  ['Porsche 911 GT3 Cup (992)', 'porsche'],
  ['Porsche 911 GT3 R (992)', 'porsche'],
  ['Porsche 911 RSR', 'porsche'],
  ['Porsche 718 Cayman GT4 Clubsport MR', 'porsche'],
  ['Porsche 963 GTP', 'porsche'],
  ['Porsche 919', 'porsche'],
  ['Porsche Mission R', 'porsche'],
  ['Radical SR8', 'radical'],
  ['Radical SR10', 'radical'],
  ['Renault Clio R.S. V', 'renault'],
  ['Riley MkXX Daytona Prototype - 2008', 'riley'],
  ['Ruf RT 12R Track', 'ruf'],
  ['SCCA Spec Racer Ford', 'ford'],
  ['Toyota GR86', 'toyota'],
  ['VW Jetta TDI Cup', 'volkswagen'],
  // Formula
  ['Dallara F3', 'dallara'],
  ['Dallara iR-01', 'dallara'],
  ['Dallara IR18', 'dallara'],
  ['IndyCar Dallara DW12', 'dallara'],
  ['Super Formula Lights', 'dallara'],
  ['Super Formula SF23 - Toyota', 'toyota'],
  ['Super Formula SF23 - Honda', 'honda'],
  ['Formula Renault 2.0', 'renault'],
  ['Formula Renault 3.5', 'renault'],
  ['Indy Pro 2000 PM-18', 'tatuus'],
  ['USF 2000', 'tatuus'],
  ['Tatuus USF-17', 'tatuus'],
  ['Lotus 79', 'lotus'],
  ['Lotus 49', 'lotus'],
  ['McLaren MP4-30', 'mclaren'],
  ['Mercedes-AMG W13 E Performance', 'mercedes-amg'],
  ['Mercedes-AMG W12 E Performance', 'mercedes-amg'],
  ['Williams-Toyota FW31', 'williams'],
  ['Ray FF1600', 'ray'],
  ['Skip Barber Formula 2000', 'skip-barber'],
  ['Pro Mazda', 'mazda'],
  ['Star Mazda', 'mazda'],
  // Oval
  ['NASCAR Cup Series Next Gen Chevrolet Camaro ZL1', 'chevrolet'],
  ['NASCAR Cup Series Next Gen Ford Mustang', 'ford'],
  ['NASCAR Cup Series Next Gen Toyota Camry', 'toyota'],
  ['NASCAR Xfinity Chevrolet Camaro', 'chevrolet'],
  ['NASCAR Xfinity Ford Mustang', 'ford'],
  ['NASCAR Xfinity Toyota GR Supra', 'toyota'],
  ['NASCAR Truck Chevrolet Silverado', 'chevrolet'],
  ['NASCAR Truck Ford F150', 'ford'],
  ['NASCAR Truck Toyota Tundra TRD Pro', 'toyota'],
  ['ARCA Menards Chevrolet Impala', 'chevrolet'],
  ['ARCA Menards Ford Fusion', 'ford'],
  ['ARCA Menards Toyota Camry', 'toyota'],
  ['NASCAR Legends Buick LeSabre - 1987', 'buick'],
  ['NASCAR Legends Chevrolet Monte Carlo - 1987', 'chevrolet'],
  ['NASCAR Legends Ford Thunderbird - 1987', 'ford'],
  ['NASCAR Legends Pontiac Grand Prix - 1987', 'pontiac'],
  ['NASCAR Gen 4 Ford Taurus - 2003', 'ford'],
  ['Chevrolet Monte Carlo SS', 'chevrolet'],
  ['Legends Ford 34 Coupe', 'ford'],
  ["Legends Ford '34 Coupe - Rookie", 'ford'],
  ['Supercars Ford Mustang GT', 'ford'],
  ['Supercars Holden ZB Commodore', 'holden'],
  ['Supercars Chevrolet Camaro Gen 3', 'chevrolet'],
  ['V8 Supercar Ford FG Falcon - 2014', 'ford'],
  ['V8 Supercar Holden VF Commodore - 2014', 'holden'],
  ['Dodge Charger', 'dodge'],
  // Dirt and rallycross
  ["Dirt Legends Ford '34 Coupe", 'ford'],
  ['Ford Fiesta RS WRC', 'ford'],
  ['Subaru WRX STI', 'subaru'],
  ['VW Beetle', 'volkswagen'],
  ['VW Beetle - Lite', 'volkswagen'],
  ['Volkswagen Beetle GRC', 'volkswagen'],
  // Spec cars no make builds
  ['Late Model Stock', 'unknown'],
  ['Super Late Model', 'unknown'],
  ['SK Modified', 'unknown'],
  ['NASCAR Whelen Tour Modified', 'unknown'],
  ['Street Stock', 'unknown'],
  ['Mini Stock', 'unknown'],
  ['Silver Crown', 'unknown'],
  ['Sprint Car', 'unknown'],
  ['Dirt Late Model - Pro', 'unknown'],
  ['Dirt Sprint Car - 410', 'unknown'],
  ['Dirt Sprint Car - 305 Non-Winged', 'unknown'],
  ['Dirt Midget', 'unknown'],
  ['Dirt UMP Modified', 'unknown'],
  ['Dirt Big Block Modified', 'unknown'],
  ['Dirt Street Stock', 'unknown'],
  ['Lucas Oil Off Road Pro 2 Lite', 'unknown'],
  ['Stadium Super Truck', 'unknown'],
  ['Formula Vee', 'unknown'],
  ['', 'unknown']
]

/** Short name only (CarScreenNameShort often drops the make). */
const BY_SHORT_NAME: ReadonlyArray<readonly [short: string, brand: BrandId]> = [
  ['MX-5 Cup', 'mazda'],
  ['Corvette C8.R', 'chevrolet'],
  ['992 Cup', 'porsche'],
  ['Huracan GT3', 'lamborghini'],
  ['Camaro ZL1', 'chevrolet'],
  ['Mustang', 'ford'],
  ['Camry', 'toyota'],
  ['IR18', 'dallara'],
  ['PM-18', 'tatuus'],
  ['FF1600', 'ray'],
  ['W13', 'mercedes-amg'],
  ['Civic TCR', 'honda'],
  ['Vantage GT4', 'aston-martin'],
  ['Late Model', 'unknown']
]

/** CarPath only (the car folder: lower case, often one word, with spaces between parts). */
const BY_PATH: ReadonlyArray<readonly [path: string, brand: BrandId]> = [
  ['mx5 mx52016', 'mazda'],
  ['mx5 cup', 'mazda'],
  ['porsche992cup', 'porsche'],
  ['porsche9922gt3r', 'porsche'],
  ['bmwm4gt3', 'bmw'],
  ['bmwlmdh', 'bmw'],
  ['ferrari296gt3', 'ferrari'],
  ['lamborghinievogt3', 'lamborghini'],
  ['audir8lmsevo2gt3', 'audi'],
  ['mercedesamgevogt3', 'mercedes-amg'],
  ['mclaren720sgt3', 'mclaren'],
  ['amvantageevogt3', 'aston-martin'],
  ['chevyvettez06rgt3', 'chevrolet'],
  ['c8rvettegte', 'chevrolet'],
  ['c6r', 'chevrolet'],
  ['fordmustanggt3', 'ford'],
  ['acuransxevo22gt3', 'acura'],
  ['acuraarx06gtp', 'acura'],
  ['cadillacvseriesrgtp', 'cadillac'],
  ['hpdarx01c', 'honda'],
  ['dallarair18', 'dallara'],
  ['dallarap217', 'dallara'],
  ['ligierjsp320', 'ligier'],
  ['radicalsr8', 'radical'],
  ['rayff1600', 'ray'],
  ['skipbarber', 'skip-barber'],
  ['rt2000', 'skip-barber'],
  ['formularenault20', 'renault'],
  ['superformulasf23 toyota', 'toyota'],
  ['superformulasf23 honda', 'honda'],
  ['superformulalights324', 'dallara'],
  ['usf2000usf17', 'tatuus'],
  ['indypro2000pm18', 'tatuus'],
  ['williamsfw31', 'williams'],
  ['lotus79', 'lotus'],
  ['mercedesw13', 'mercedes-amg'],
  ['stockcars2 camaro2022', 'chevrolet'],
  ['stockcars2 mustang2022', 'ford'],
  ['stockcars2 camry2022', 'toyota'],
  ['trucks silverado2019', 'chevrolet'],
  ['trucks tundra2022', 'toyota'],
  ['trucks f150', 'ford'],
  ['legends ford34c', 'ford'],
  ['supercars holdenzb', 'holden'],
  ['hyundaielantracn7', 'hyundai'],
  ['hondacivictyper', 'honda'],
  ['rufrt12r track', 'ruf'],
  ['kiaoptima', 'kia'],
  ['subaruwrxsti', 'subaru'],
  ['vwbeetlegrc', 'volkswagen'],
  ['latemodel', 'unknown'],
  ['superlatemodel', 'unknown'],
  ['dirtsprint winged 410', 'unknown'],
  ['dirtlatemodel pro', 'unknown'],
  ['', 'unknown']
]

describe('brandOfCar', () => {
  it.each(BY_NAME)('%s -> %s', (name, brand) => {
    expect(brandOfCar({ name })).toBe(brand)
  })

  it.each(BY_SHORT_NAME)('short name %s -> %s', (shortName, brand) => {
    expect(brandOfCar({ shortName })).toBe(brand)
  })

  it.each(BY_PATH)('path %s -> %s', (path, brand) => {
    expect(brandOfCar({ path })).toBe(brand)
  })

  it('ignores case and accents', () => {
    expect(brandOfCar({ name: 'LAMBORGHINI HURACÁN GT3 EVO' })).toBe('lamborghini')
    expect(brandOfCar({ name: 'porsche 911 gt3 cup (992)' })).toBe('porsche')
    expect(brandOfCar({ shortName: 'huracán' })).toBe('lamborghini')
  })

  it('matches whole words only', () => {
    // 'kia' inside a word, 'ford' inside 'Stanford', 'ray' inside 'Raycer', '911' inside '9110'.
    expect(brandOfCar({ name: 'Nakiang Special' })).toBe('unknown')
    expect(brandOfCar({ name: 'Stanford Racer' })).toBe('unknown')
    expect(brandOfCar({ name: 'Raycer 9110' })).toBe('unknown')
  })

  it('takes a make in any field over a model word', () => {
    // A Toyota-engined SF23 whose names only say 'Super Formula' (a Dallara model word).
    expect(brandOfCar({ name: 'Super Formula SF23', path: 'superformulasf23 toyota' })).toBe(
      'toyota'
    )
    // The short name's make wins over the full name's model word.
    expect(brandOfCar({ name: 'Camaro ZL1 1LE', shortName: 'Ford Mustang' })).toBe('ford')
  })

  it('takes the make that comes first when a name has two', () => {
    expect(brandOfCar({ name: 'Williams-Toyota FW31' })).toBe('williams')
    expect(brandOfCar({ name: 'Toyota-powered Williams' })).toBe('toyota')
  })

  it('takes the full name over the short name and the path', () => {
    expect(brandOfCar({ name: 'Audi R8 LMS EVO II GT3', shortName: 'R8', path: 'bmwm4gt3' })).toBe(
      'audi'
    )
  })

  it('handles a car with no fields', () => {
    expect(brandOfCar({})).toBe('unknown')
  })
})

describe('the brand table', () => {
  it('has a name and a 2 or 3 letter caps badge per brand, all badges different', () => {
    const badges = new Set<string>()
    for (const id of BRAND_IDS) {
      const b = brandInfo(id)
      expect(b, id).not.toBeNull()
      expect(b?.name.length, id).toBeGreaterThan(0)
      expect(b?.badge, id).toMatch(/^[A-Z]{2,3}$/)
      badges.add(b?.badge ?? '')
    }
    expect(badges.size).toBe(BRAND_IDS.length)
    expect(BRANDS.mazda.badge).toBe('MAZ')
    expect(BRANDS.porsche.badge).toBe('POR')
    expect(BRANDS.bmw.badge).toBe('BMW')
  })

  it('has kebab-case ids and no unknown entry', () => {
    for (const id of BRAND_IDS) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(brandInfo('unknown')).toBeNull()
    expect(BRAND_IDS).not.toContain('unknown')
  })

  it('finds every brand by its own name and its own make word', () => {
    for (const id of BRAND_IDS) {
      expect(brandOfCar({ name: `${BRANDS[id].name} Racecar` }), id).toBe(id)
      for (const make of BRANDS[id].makes) expect(brandOfCar({ name: make }), make).toBe(id)
    }
  })

  it('never gives a make word, model word or path prefix to two brands', () => {
    const seen = new Map<string, string>()
    for (const id of BRAND_IDS) {
      const b = brandInfo(id)
      const keys = [
        ...(b?.makes ?? []).map((w) => `word:${w}`),
        ...(b?.models ?? []).map((w) => `word:${w}`),
        ...(b?.makes ?? []).map((w) => `path:${w.replace(/ /g, '')}`),
        ...(b?.paths ?? []).map((p) => `path:${p}`)
      ]
      for (const k of keys) {
        const other = seen.get(k)
        if (other !== undefined && other !== id) expect.fail(`${k}: ${other} and ${id}`)
        seen.set(k, id)
      }
    }
  })

  it('writes words as the matcher sees them (lower case, single spaces)', () => {
    for (const id of BRAND_IDS) {
      const b = brandInfo(id)
      for (const w of [...(b?.makes ?? []), ...(b?.models ?? [])]) {
        expect(w, id).toMatch(/^[a-z0-9]+( [a-z0-9]+)*$/)
      }
      for (const p of b?.paths ?? []) expect(p, id).toMatch(/^[a-z0-9]+$/)
    }
  })
})

describe('carIdentityOf / brandsByCarIdx', () => {
  const yaml = {
    DriverInfo: {
      DriverCarIdx: 1,
      Drivers: [
        {
          CarIdx: 0,
          CarScreenName: 'Porsche 911 GT3 Cup (992) Safety Car',
          CarScreenNameShort: '992 Safety Car',
          CarPath: 'safety pcporsche992cup',
          CarID: 1,
          CarIsPaceCar: 1
        },
        {
          CarIdx: 1,
          CarScreenName: 'BMW M4 GT3 EVO',
          CarScreenNameShort: 'BMW M4 GT3',
          CarPath: 'bmwm4gt3',
          CarID: 132
        },
        { CarIdx: 2, CarScreenName: 'Ferrari 296 GT3', CarPath: 'ferrari296gt3' },
        { CarIdx: 3, CarScreenName: 'Dirt Late Model - Pro', CarPath: 'dirtlatemodel pro' },
        { CarIdx: 4, CarScreenNameShort: 911, CarPath: null },
        { CarIdx: -1, CarScreenName: 'Audi R8' },
        { CarIdx: 2.5, CarScreenName: 'Audi R8' },
        'not a driver',
        { CarIdx: 2, CarScreenName: 'Audi R8 LMS EVO II GT3' }
      ]
    }
  }

  it('reads CarScreenName, CarScreenNameShort and CarPath', () => {
    expect(carIdentityOf(yaml.DriverInfo.Drivers[1])).toEqual({
      name: 'BMW M4 GT3 EVO',
      shortName: 'BMW M4 GT3',
      path: 'bmwm4gt3'
    })
    expect(carIdentityOf({ CarScreenNameShort: 911, CarPath: null })).toEqual({
      name: '',
      shortName: '911',
      path: ''
    })
    expect(carIdentityOf(null)).toEqual({})
    expect(carIdentityOf([1, 2])).toEqual({})
  })

  it('maps every valid CarIdx (the first entry wins on a repeat)', () => {
    expect([...brandsByCarIdx(yaml)]).toEqual([
      [0, 'porsche'],
      [1, 'bmw'],
      [2, 'ferrari'],
      [3, 'unknown'],
      [4, 'porsche']
    ])
  })

  it('is empty for anything but a session with drivers', () => {
    expect(brandsByCarIdx(null).size).toBe(0)
    expect(brandsByCarIdx({}).size).toBe(0)
    expect(brandsByCarIdx({ DriverInfo: { Drivers: 'x' } }).size).toBe(0)
  })
})

describe('multi-make field', () => {
  it('is more than one known make', () => {
    expect(hasMultipleBrands([])).toBe(false)
    expect(hasMultipleBrands(['mazda', 'mazda', 'mazda'])).toBe(false)
    expect(hasMultipleBrands(['porsche', 'bmw'])).toBe(true)
    expect(hasMultipleBrands(['mazda', 'mazda', 'toyota', 'mazda'])).toBe(true)
  })

  it('does not count unknown makes', () => {
    expect(hasMultipleBrands(['unknown', 'unknown'])).toBe(false)
    expect(hasMultipleBrands(['dallara', 'unknown'])).toBe(false)
    expect(hasMultipleBrands(['unknown', 'ford', 'unknown', 'chevrolet'])).toBe(true)
  })

  it('takes any iterable (a Map of brands by CarIdx)', () => {
    const field = new Map<number, BrandId>([
      [0, 'chevrolet'],
      [1, 'ford'],
      [2, 'toyota']
    ])
    expect(hasMultipleBrands(field.values())).toBe(true)
    expect([...distinctBrands(field.values())]).toEqual(['chevrolet', 'ford', 'toyota'])
    expect(distinctBrands(['unknown', 'kia', 'kia']).size).toBe(1)
  })

  it('a real IMSA field: GTP, LMP2 and GT3 makes', () => {
    const cars = [
      'Porsche 963 GTP',
      'Cadillac V-Series.R GTP',
      'Dallara P217',
      'BMW M4 GT3 EVO',
      'Lamborghini Huracán GT3 EVO'
    ].map((name) => brandOfCar({ name }))
    expect(distinctBrands(cars).size).toBe(5)
    expect(hasMultipleBrands(cars)).toBe(true)
  })

  it('a one-make cup is one brand', () => {
    const cars = ['Global Mazda MX-5 Cup', 'Global Mazda MX-5 Cup'].map((name) =>
      brandOfCar({ name })
    )
    expect(hasMultipleBrands(cars)).toBe(false)
  })
})

describe('brandMarksShown', () => {
  it('on, off, or auto (only in a multi-make field)', () => {
    expect(BRAND_MARK_MODES).toEqual(['off', 'on', 'auto'])
    expect(brandMarksShown('on', ['mazda'])).toBe(true)
    expect(brandMarksShown('on', [])).toBe(true)
    expect(brandMarksShown('off', ['porsche', 'bmw'])).toBe(false)
    expect(brandMarksShown('auto', ['porsche', 'bmw'])).toBe(true)
    expect(brandMarksShown('auto', ['mazda', 'mazda'])).toBe(false)
    expect(brandMarksShown('auto', ['unknown', 'dallara'])).toBe(false)
  })
})
