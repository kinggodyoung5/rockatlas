import { describe, expect, it } from 'vitest'
import { publicBands } from '../data/publicBands'
import { bandImageSources, commonsThumb } from './commonsImage'

describe('Commons 썸네일', () => {
  it('원본 업로드 주소에서 표준 폭 썸네일을 만든다', () => {
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/e/e6/Wintersun_Rockharz_2019_22.jpg', 330))
      .toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Wintersun_Rockharz_2019_22.jpg/330px-Wintersun_Rockharz_2019_22.jpg')
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/a/ab/Logo.svg', 500)).toMatch(/500px-Logo\.svg\.png$/)
  })

  it('Special:Redirect 주소는 width 매개변수로', () => {
    expect(commonsThumb('https://commons.wikimedia.org/wiki/Special:Redirect/file/Bon_Jovi_1.jpg', 960)).toBe('https://commons.wikimedia.org/wiki/Special:Redirect/file/Bon_Jovi_1.jpg?width=960')
  })

  it('카드는 330/500, 상세는 500/960/1280 srcSet과 되돌릴 주소를 준다', () => {
    const image = { originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e6/X.jpg', displayUrl: 'https://example.org/x.jpg' }
    const card = bandImageSources(image, 'card')!
    expect(card.srcSet).toMatch(/330px-X\.jpg 330w, .*500px-X\.jpg 500w$/)
    expect(card.fallback).toBe(image.displayUrl)
    expect(bandImageSources(image, 'detail')!.srcSet!.split(',')).toHaveLength(3)
    expect(bandImageSources({ displayUrl: 'https://example.org/y.jpg' }, 'card')).toEqual({ src: 'https://example.org/y.jpg' })
  })

  it('공개 밴드의 이미지는 전부 썸네일을 만들 수 있다', () => {
    const missing = publicBands.filter((band) => band.image.originalUrl && !bandImageSources(band.image, 'card')?.srcSet).map((band) => band.id)
    expect(missing).toEqual([])
  })
})
