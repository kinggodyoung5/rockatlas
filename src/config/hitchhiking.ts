import type { MoodId } from '../types/taxonomy'

export interface HitchhikingEntryRule {
  /** Every mood in `all` must meet its threshold. */
  all: Partial<Record<MoodId, number>>
  /** When present, at least one mood in `any` must also meet its threshold. */
  any?: Partial<Record<MoodId, number>>
}

/**
 * 히치하이킹의 방향 후보군은 이 파일 한 곳에서 관리한다.
 * 방향을 추가하거나 분위기 비중을 조정하면 추천 계산·UI·데이터 진단이 함께 갱신된다.
 */
export const HITCHHIKING_DIRECTIONS = [
  {
    id: 'heavier',
    label: '더 무겁게',
    resultLabel: '무게와 타격감을 따라',
    description: '더 강한 리프와 압도적인 에너지 쪽으로',
    iconKey: 'weight',
    accent: '#ff6a4d',
    entryRules: [
      { all: { 'massive-heavy': 3 } },
      { all: { 'aggressive-heavy': 4 }, any: { 'riff-solo-driven': 3, 'fast-driving': 4, 'noisy-wall': 3 } },
    ],
    moodWeights: {
      'aggressive-heavy': 1,
      'massive-heavy': 0.9,
      'riff-solo-driven': 0.5,
      'fast-driving': 0.2,
    },
  },
  {
    id: 'dreamier',
    label: '더 몽환적으로',
    resultLabel: '잔향과 우주감을 따라',
    description: '더 흐릿한 질감과 깊은 몰입감 쪽으로',
    iconKey: 'sparkles',
    accent: '#9d8cff',
    entryRules: [
      { all: { 'dreamy-ethereal': 3 } },
      { all: { 'cosmic-psychedelic': 4 }, any: { 'long-form-immersive': 3, 'slow-calm': 3, 'experimental-weird': 3 } },
    ],
    moodWeights: {
      'dreamy-ethereal': 1,
      'cosmic-psychedelic': 0.85,
      'long-form-immersive': 0.45,
      'noisy-wall': 0.25,
      'slow-calm': 0.2,
    },
  },
  {
    id: 'accessible',
    label: '더 대중적으로',
    resultLabel: '선명한 멜로디를 따라',
    description: '더 쉽게 꽂히는 멜로디와 후렴 쪽으로',
    iconKey: 'radio',
    accent: '#58c9a3',
    entryRules: [
      { all: { 'bright-upbeat': 3 } },
      { all: { 'hopeful-uplifting': 3 } },
      { all: { 'anthemic-live': 4 }, any: { 'romantic-emotional': 3, 'groovy-danceable': 3, 'bright-upbeat': 2 } },
    ],
    moodWeights: {
      'bright-upbeat': 0.9,
      'hopeful-uplifting': 0.8,
      'anthemic-live': 0.75,
      'romantic-emotional': 0.4,
      'groovy-danceable': 0.35,
    },
  },
  {
    id: 'experimental',
    label: '더 실험적으로',
    resultLabel: '낯선 구조와 소리를 따라',
    description: '더 복잡하고 예측하기 어려운 소리 쪽으로',
    iconKey: 'flask',
    accent: '#f0b85a',
    entryRules: [
      { all: { 'experimental-weird': 3 } },
      { all: { 'technical-complex': 4 }, any: { 'long-form-immersive': 3, 'cosmic-psychedelic': 3, 'noisy-wall': 3 } },
    ],
    moodWeights: {
      'experimental-weird': 1,
      'technical-complex': 0.8,
      'long-form-immersive': 0.6,
      'cosmic-psychedelic': 0.4,
      'noisy-wall': 0.35,
    },
  },
  {
    id: 'faster',
    label: '더 빠르게',
    resultLabel: '속도와 추진력을 따라',
    description: '더 빠른 비트와 질주하는 에너지 쪽으로',
    iconKey: 'gauge',
    accent: '#ef7e54',
    entryRules: [{ all: { 'fast-driving': 3 } }],
    moodWeights: {
      'fast-driving': 1,
      'youth-rebellious': 0.45,
      'aggressive-heavy': 0.35,
    },
  },
  {
    id: 'darker',
    label: '더 어둡게',
    resultLabel: '그늘진 정서와 긴장을 따라',
    description: '더 음울하고 차가운 정서의 소리 쪽으로',
    iconKey: 'moon',
    accent: '#7886c8',
    entryRules: [
      { all: { 'dark-gloomy': 3 } },
      { all: { 'cold-urban': 3 } },
      { all: { 'melancholic-lonely': 4 }, any: { 'dark-gloomy': 2, 'cold-urban': 2, 'noisy-wall': 3 } },
    ],
    moodWeights: {
      'dark-gloomy': 1,
      'melancholic-lonely': 0.75,
      'cold-urban': 0.55,
      'noisy-wall': 0.2,
    },
  },
  {
    id: 'warmer',
    label: '더 따뜻하게',
    resultLabel: '온기와 자연스러운 울림을 따라',
    description: '더 포근하고 어쿠스틱한 감촉의 소리 쪽으로',
    iconKey: 'sun',
    accent: '#e9a85f',
    entryRules: [
      { all: { 'warm-comforting': 3 } },
      { all: { 'acoustic-organic': 3 } },
      { all: { 'romantic-emotional': 4 }, any: { 'hopeful-uplifting': 3, 'warm-comforting': 2, 'acoustic-organic': 2 } },
    ],
    moodWeights: {
      'warm-comforting': 1,
      'acoustic-organic': 0.75,
      'romantic-emotional': 0.5,
      'hopeful-uplifting': 0.35,
    },
  },
  {
    id: 'groovier',
    label: '더 그루비하게',
    resultLabel: '리듬과 몸의 움직임을 따라',
    description: '더 리드미컬하고 몸이 반응하는 소리 쪽으로',
    iconKey: 'waves',
    accent: '#55bfb2',
    entryRules: [{ all: { 'groovy-danceable': 3 } }],
    moodWeights: {
      'groovy-danceable': 1,
      'electronic-synth': 0.5,
      'bright-upbeat': 0.35,
      'fast-driving': 0.2,
    },
  },
  {
    id: 'grander',
    label: '더 웅장하게',
    resultLabel: '큰 스케일과 극적인 전개를 따라',
    description: '더 거대하고 영화적인 울림의 소리 쪽으로',
    iconKey: 'mountain',
    accent: '#c79bff',
    entryRules: [
      { all: { 'epic-cinematic': 3 } },
      { all: { 'anthemic-live': 4 }, any: { 'massive-heavy': 3, 'long-form-immersive': 3 } },
    ],
    moodWeights: {
      'epic-cinematic': 1,
      'anthemic-live': 0.75,
      'massive-heavy': 0.55,
      'long-form-immersive': 0.4,
    },
  },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  resultLabel: string
  description: string
  iconKey: string
  accent: string
  entryRules: readonly HitchhikingEntryRule[]
  moodWeights: Partial<Record<MoodId, number>>
}>

export type HitchhikingDirection = (typeof HITCHHIKING_DIRECTIONS)[number]
export type HitchhikingDirectionId = HitchhikingDirection['id']

export const hitchhikingDirectionById = Object.fromEntries(
  HITCHHIKING_DIRECTIONS.map((direction) => [direction.id, direction]),
) as Record<HitchhikingDirectionId, HitchhikingDirection>
