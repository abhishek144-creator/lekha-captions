import { describe, expect, it } from 'vitest'
import { DEFAULT_ANIMATION_SPEED, withAnimationChoice } from './animationSpeed'

describe('withAnimationChoice', () => {
  it('starts a new line or word animation at 2x', () => {
    expect(DEFAULT_ANIMATION_SPEED).toBe(2)
    expect(withAnimationChoice({ id: 'c1', text: 'hi' }, 'zoom_in')).toEqual({ id: 'c1', text: 'hi', animation: 'zoom_in', animationSpeed: 2 })
  })

  it('keeps an existing speed, including one saved at 1x', () => {
    expect(withAnimationChoice({ animationSpeed: 1 }, 'fade').animationSpeed).toBe(1)
    expect(withAnimationChoice({ animationSpeed: 3 }, 'fade').animationSpeed).toBe(3)
  })

  it('leaves the speed alone when the animation is removed', () => {
    expect(withAnimationChoice({ animation: 'pop' }, 'none')).toEqual({ animation: 'none' })
  })
})
