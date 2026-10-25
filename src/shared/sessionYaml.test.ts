import { describe, it, expect } from 'vitest'
import { load } from 'js-yaml'
import { parseSessionMeta } from './session'
import { parseSessionYaml, sanitizeSessionYaml } from './sessionYaml'

const WEIRD_NAMES = ['Foo: Bar', '@weird', 'Team #1', 'True', '12345', "O'Neil", '- dash', '']

function driversYaml(names: readonly string[]): string {
  return [
    'DriverInfo:',
    ' Drivers:',
    ...names.flatMap((name, i) => [` - CarIdx: ${i}`, `   UserName: ${name}`, `   IRating: 1000`])
  ].join('\n')
}

function userNames(doc: unknown): unknown[] {
  const drivers = (doc as { DriverInfo: { Drivers: { UserName: unknown }[] } }).DriverInfo.Drivers
  return drivers.map((d) => d.UserName)
}

// Shape and spacing of a real session string (one-space indents, trailing
// blanks after empty values, '...' terminator), trimmed to the useful keys.
const SESSION_YAML = `---
WeekendInfo:
 TrackName: spa 2022 up
 TrackID: 524
 TrackLength: 6.93 km
 TrackLengthOfficial: 7.00 km
 TrackDisplayName: Circuit de Spa-Francorchamps
 TrackDisplayShortName: Spa
 WeekendOptions:
  NumStarters: 4
  Date: 2024-03-18
 TelemetryOptions:
  TelemetryDiskFile: ""

SessionInfo:
 Sessions:
 - SessionNum: 0
   SessionLaps: unlimited
   SessionTime: 600.0000 sec
   SessionType: Practice
   SessionName: PRACTICE
   ResultsPositions:
   ResultsFastestLap:
   - CarIdx: 255
     FastestLap: 0
     FastestTime: -1.0000
 - SessionNum: 2
   SessionLaps: 12
   SessionType: Race
   SessionName: RACE

DriverInfo:
 DriverCarIdx: 1
 DriverUserID: 123456
 PaceCarIdx: 0
 DriverCarEstLapTime: 137.6425
 DriverSetupName: wet: v2 #3.sto
 Drivers:
 - CarIdx: 0
   UserName: Pace Car
   AbbrevName:
   Initials:
   UserID: -1
   TeamName: Pace Car
   CarNumber: "0"
   CarClassID: 11
   CarIsPaceCar: 1
   CarScreenNameShort: safety pcporsche911cup
   CarClassShortName:
   CarClassMaxFuelPct: 1.000 %
   CarClassColor: 0
   CarClassEstLapTime: 160.0000
   IRating: 0
   LicString: R 0.01
   LicColor: 0xundefined
   IsSpectator: 0
 - CarIdx: 1
   UserName: Foo: Bar
   AbbrevName: Bar, F
   Initials: FB
   UserID: 123456
   TeamName: Team #1
   CarNumber: "7"
   CarClassID: 4029
   CarIsPaceCar: 0
   CarScreenNameShort: Porsche 911 GT3 R
   CarClassShortName: GT3
   CarClassColor: 0xffda59
   CarClassEstLapTime: 137.6425
   IRating: 2345
   LicString: A 4.60
   LicColor: 0x0153db
   IsSpectator: 0
 - CarIdx: 2
   UserName: @weird
   AbbrevName:
   Initials:
   TeamName: O'Neil Racing
   CarNumber: "42"
   CarClassID: 4083
   CarIsPaceCar: 0
   CarScreenNameShort: Mazda MX-5
   CarClassShortName: MX5
   CarClassColor: 0x33ceff
   CarClassEstLapTime: 151.2000
   IRating: 1350
   LicString: D 2.10
   LicColor: 0xfc8a27
   IsSpectator: 0
 - CarIdx: 63
   UserName: 12345
   TeamName: True
   CarNumber: ""
   CarClassID: 0
   CarIsPaceCar: 0
   CarClassShortName:
   CarScreenNameShort:
   CarClassColor: 0xffffff
   IRating: 1
   LicString: B 3.00
   LicColor: 0x00c702
   IsSpectator: 1

...
`

describe('sanitizeSessionYaml', () => {
  it('quotes the free-text keys keeping indentation and list markers', () => {
    const src = [
      'DriverInfo:',
      ' DriverSetupName: a: b.sto',
      ' Drivers:',
      ' - UserName: Foo: Bar',
      '   CarIdx: 3',
      '   TeamName: O\'Neil "Racing"',
      '   AbbrevName: ',
      '   Initials:',
      '\t\tUserName: tabbed  '
    ].join('\n')
    expect(sanitizeSessionYaml(src)).toBe(
      [
        'DriverInfo:',
        " DriverSetupName: 'a: b.sto'",
        ' Drivers:',
        " - UserName: 'Foo: Bar'",
        '   CarIdx: 3',
        "   TeamName: 'O''Neil \"Racing\"'",
        "   AbbrevName: ''",
        "   Initials: ''",
        "\t\tUserName: 'tabbed'"
      ].join('\n')
    )
  })

  it('leaves already quoted values and other keys alone', () => {
    const src = [
      " UserName: 'Foo: Bar'",
      ' UserName: "Foo \\"x\\""',
      ' CarScreenName: Foo: Bar',
      ' MyUserName: Foo',
      ' UserName:Foo'
    ].join('\n')
    expect(sanitizeSessionYaml(src)).toBe(src)
    expect(sanitizeSessionYaml(' UserName: "Bubba" Smith')).toBe(` UserName: '"Bubba" Smith'`)
    expect(sanitizeSessionYaml(" UserName: 'a' b 'c'")).toBe(` UserName: '''a'' b ''c'''`)
  })

  it("replaces ': ,' with ': 0,' outside free-text values", () => {
    const src = ' Foo: , 1\n UserName: x: , y'
    expect(sanitizeSessionYaml(src)).toBe(" Foo: 0, 1\n UserName: 'x: , y'")
    expect(() => load(' Foo: , 1')).toThrow()
    expect(load(sanitizeSessionYaml(' Foo: , 1'))).toEqual({ Foo: '0, 1' })
  })

  it('strips control characters but keeps tabs, newlines and U+FFFD', () => {
    const src = 'A: x\u0001y\u007f\r\n UserName: Ma\u0007rc\u0085o�\tZ\r\nB: \ud800c 😀'
    expect(sanitizeSessionYaml(src)).toBe("A: xy\n UserName: 'Marco�\tZ'\nB: c 😀")
  })
})

describe('parseSessionYaml', () => {
  it('keeps weird driver names as exact strings', () => {
    const yaml = driversYaml(WEIRD_NAMES)
    expect(() => load(yaml)).toThrow()
    expect(userNames(parseSessionYaml(yaml))).toEqual(WEIRD_NAMES)
  })

  it('keeps names that plain YAML would retype', () => {
    const names = ['True', 'null', '12345', '0x1F', '2024-01-02', '.inf', '~']
    expect(userNames(parseSessionYaml(driversYaml(names)))).toEqual(names)
  })

  it('parses a full session document into SessionMeta', () => {
    expect(() => load(SESSION_YAML)).toThrow()
    const doc = parseSessionYaml(SESSION_YAML)
    const drivers = (doc as { DriverInfo: { Drivers: Record<string, unknown>[] } }).DriverInfo
      .Drivers
    expect(drivers.map((d) => d.TeamName)).toEqual(['Pace Car', 'Team #1', "O'Neil Racing", 'True'])
    expect(drivers[1]?.AbbrevName).toBe('Bar, F')
    expect(drivers[0]?.AbbrevName).toBe('')
    expect(drivers[1]?.CarClassColor).toBe(16767577)
    expect(drivers[1]?.LicColor).toBe(0x0153db)
    expect((doc as { DriverInfo: Record<string, unknown> }).DriverInfo.DriverSetupName).toBe(
      'wet: v2 #3.sto'
    )

    const meta = parseSessionMeta(doc)
    expect(meta.trackLengthM).toBe(6930)
    expect(meta.trackName).toBe('Circuit de Spa-Francorchamps')
    expect(meta.playerCarIdx).toBe(1)
    expect(meta.paceCarIdx).toBe(0)
    expect(meta.driverCarEstLapTime).toBe(137.6425)
    expect([...meta.sessionTypes]).toEqual([
      [0, 'Practice'],
      [2, 'Race']
    ])
    expect([...meta.drivers.keys()]).toEqual([0, 1, 2, 63])

    const pace = meta.drivers.get(0)
    expect(pace?.isPaceCar).toBe(true)
    expect(pace?.classColor).toBe('#ffffff')
    expect(pace?.licColor).toBe('#fc0706')
    expect(pace?.classShortName).toBe('safety pcporsche911cup')
    expect(pace?.carNumber).toBe('0')

    const me = meta.drivers.get(1)
    expect(me?.userName).toBe('Foo: Bar')
    expect(me?.carNumber).toBe('7')
    expect(me?.classColor).toBe('#ffda59')
    expect(me?.licColor).toBe('#0153db')
    expect(me?.classShortName).toBe('GT3')
    expect(me?.classEstLapTime).toBe(137.6425)
    expect(me?.iRating).toBe(2345)

    expect(meta.drivers.get(2)?.userName).toBe('@weird')
    expect(meta.drivers.get(2)?.classColor).toBe('#33ceff')
    const spec = meta.drivers.get(63)
    expect(spec?.userName).toBe('12345')
    expect(spec?.isSpectator).toBe(true)
    expect(spec?.classShortName).toBe('')
    expect(spec?.carNumber).toBe('')
  })

  it('returns null instead of throwing', () => {
    expect(parseSessionYaml('a: [')).toBeNull()
    expect(parseSessionYaml('a: 1\n b: 2\nc')).toBeNull()
    expect(parseSessionYaml('')).toBeNull()
    expect(parseSessionYaml(null as unknown as string)).toBeNull()
  })

  it('lets duplicate keys override (json mode)', () => {
    expect(parseSessionYaml('A: 1\nA: 2')).toEqual({ A: 2 })
  })
})
