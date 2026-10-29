import { describe, expect, it } from 'vitest'
import type { DriverEntry, SessionMeta } from '@shared/types'
import { playerCar } from './loop'

function session(drivers: [number, Partial<DriverEntry>][]): SessionMeta {
  return { drivers: new Map(drivers) } as unknown as SessionMeta
}

describe('playerCar', () => {
  it('is the car model the player is registered in', () => {
    const s = session([
      [3, { carId: 67, carName: 'Mazda MX-5 Cup' }],
      [4, { carId: 132, carName: 'Porsche 911 GT3 R (992)' }]
    ])
    expect(playerCar(s, 4)).toEqual({ carId: 132, carName: 'Porsche 911 GT3 R (992)' })
  })

  it('is null without a player, a driver entry or a CarID', () => {
    const s = session([[3, { carId: 0, carName: 'Pace car' }]])
    expect(playerCar(s, -1)).toBeNull()
    expect(playerCar(s, 7)).toBeNull()
    expect(playerCar(s, 3)).toBeNull()
  })
})
