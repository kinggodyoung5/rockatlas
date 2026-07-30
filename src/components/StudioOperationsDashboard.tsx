import { AlertTriangle, CheckCircle2, CircleDashed, GitBranch, Link2, LoaderCircle, PackageCheck, RefreshCw, Rocket, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { studioFetchJson } from '../lib/studioApiClient'
import { getStudioDiagnostics } from '../lib/studioDiagnostics'
import type { Band, PendingRelation } from '../types/music'
import type { LinkHealthSummary } from './LinkHealthPanel'

interface DeployChange {
  code: string
  file: string
}

interface DeployStatus {
  branch: string
  latestCommit: string
  clean: boolean
  changes: DeployChange[]
  checkedAt: string
}

interface PreflightStep {
  id: string
  label: string
  passed: boolean
  durationMs: number
  summary: string
}

interface PreflightResult {
  passed: boolean
  startedAt: string
  finishedAt: string
  steps: PreflightStep[]
}

interface StudioOperationsDashboardProps {
  bands: Band[]
  pendingRelations: PendingRelation[]
  hasUnsavedChanges: boolean
  linkHealth: LinkHealthSummary
  onSelectBand: (band: Band) => void
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function StudioOperationsDashboard({ bands, pendingRelations, hasUnsavedChanges, linkHealth, onSelectBand }: StudioOperationsDashboardProps) {
  const [deployStatus, setDeployStatus] = useState<DeployStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [preflightRunning, setPreflightRunning] = useState(false)
  const [preflightMessage, setPreflightMessage] = useState('저장 후 검사를 실행하면 공개 가능한 상태인지 한 번에 확인합니다.')
  const diagnostics = useMemo(() => getStudioDiagnostics(bands), [bands])
  const drafts = useMemo(() => bands.filter((band) => band.reviewStatus === 'draft'), [bands])
  const errors = diagnostics.filter((item) => item.severity === 'error').length
  const warnings = diagnostics.length - errors
  const linkProblems = linkHealth.broken + linkHealth.error

  const loadDeployStatus = async () => {
    try {
      setStatusError('')
      setDeployStatus(await studioFetchJson<DeployStatus>('/api/studio/deploy-status', { cache: 'no-store' }))
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Git 변경 상태를 불러오지 못했습니다.')
    }
  }

  useEffect(() => { void loadDeployStatus() }, [])

  const runPreflight = async () => {
    if (hasUnsavedChanges || preflightRunning) return
    setPreflightRunning(true)
    setPreflight(null)
    setPreflightMessage('데이터 검사부터 프로덕션 빌드까지 실행 중입니다. 보통 1분 안에 끝납니다.')
    try {
      const result = await studioFetchJson<PreflightResult>('/api/studio/preflight', { method: 'POST' })
      setPreflight(result)
      setPreflightMessage(result.passed ? '모든 검사가 통과했습니다. 아래 변경 파일을 확인한 뒤 GitHub에 반영할 수 있습니다.' : '통과하지 못한 단계가 있습니다. 결과를 확인하고 수정한 뒤 다시 실행하세요.')
      await loadDeployStatus()
    } catch (error) {
      setPreflightMessage(`검사 실행 실패: ${error instanceof Error ? error.message : '로컬 Studio 서버를 확인하세요.'}`)
    } finally {
      setPreflightRunning(false)
    }
  }

  return (
    <section className="studio-operations-dashboard" aria-labelledby="operations-dashboard-title">
      <div className="studio-operations-heading">
        <div>
          <span>OPERATIONS CONSOLE</span>
          <h2 id="operations-dashboard-title">오늘 처리할 일과 배포 준비</h2>
          <p>흩어진 검수 상태를 먼저 보고, 저장된 파일만 안전하게 검사합니다. 이 화면은 커밋하거나 배포하지 않습니다.</p>
        </div>
        <button type="button" onClick={() => void loadDeployStatus()}><RefreshCw size={15} /> 변경 상태 새로고침</button>
      </div>

      <div className="studio-operations-summary">
        <button type="button" data-state={drafts.length ? 'attention' : 'good'} onClick={() => drafts[0] && onSelectBand(drafts[0])}>
          <CircleDashed size={19} /><span><strong>{drafts.length}</strong><small>검수 대기 초안</small></span>
        </button>
        <button type="button" data-state={errors ? 'danger' : warnings ? 'attention' : 'good'} onClick={() => scrollTo('data-manager')}>
          <AlertTriangle size={19} /><span><strong>{diagnostics.length}</strong><small>자동 진단 · 오류 {errors} / 주의 {warnings}</small></span>
        </button>
        <button type="button" data-state={pendingRelations.length ? 'attention' : 'good'} onClick={() => scrollTo('data-manager')}>
          <Link2 size={19} /><span><strong>{pendingRelations.length}</strong><small>자동 연결 대기 관계</small></span>
        </button>
        <button type="button" data-state={!linkHealth.checked ? 'neutral' : linkProblems ? 'danger' : 'good'} onClick={() => scrollTo('studio-link-health')}>
          <ShieldCheck size={19} /><span><strong>{linkHealth.loading ? '검사 중' : linkHealth.checked ? linkProblems : '—'}</strong><small>{linkHealth.checked ? `링크 문제 · 전체 ${linkHealth.total}` : `링크 상태 미검사 · 전체 ${linkHealth.total}`}</small></span>
        </button>
        <div data-state={hasUnsavedChanges ? 'attention' : 'good'}>
          {hasUnsavedChanges ? <Save size={19} /> : <CheckCircle2 size={19} />}<span><strong>{hasUnsavedChanges ? '저장 필요' : '저장 완료'}</strong><small>브라우저 편집 상태</small></span>
        </div>
      </div>

      <div className="studio-deploy-center">
        <div className="studio-deploy-copy">
          <span><Rocket size={16} /> 배포 준비센터</span>
          <h3>{hasUnsavedChanges ? '먼저 전체 저장을 해주세요' : '저장된 프로젝트를 최종 검사할 수 있습니다'}</h3>
          <p>{preflightMessage}</p>
          <button type="button" className="is-primary" disabled={hasUnsavedChanges || preflightRunning} onClick={() => void runPreflight()}>
            {preflightRunning ? <LoaderCircle className="is-spinning" size={16} /> : <PackageCheck size={16} />}
            {preflightRunning ? '검사·빌드 실행 중' : '배포 전 전체 검사 실행'}
          </button>
          <small>데이터 검사 → 장르 검사 → 분위기 커버리지 → 자동 테스트 → 프로덕션 빌드 순서로 실행합니다.</small>
        </div>

        <div className="studio-deploy-results">
          <div className="studio-git-summary">
            <span><GitBranch size={15} /> 현재 파일 상태</span>
            {deployStatus ? <>
              <strong>{deployStatus.branch}</strong>
              <small>{deployStatus.latestCommit}</small>
              <p>{deployStatus.clean ? 'Git에 반영할 변경 파일이 없습니다.' : `Git에 반영할 변경 파일 ${deployStatus.changes.length}개가 있습니다.`}</p>
              {!deployStatus.clean && <ul>{deployStatus.changes.slice(0, 8).map((change) => <li key={`${change.code}-${change.file}`}><em>{change.code}</em>{change.file}</li>)}{deployStatus.changes.length > 8 && <li>외 {deployStatus.changes.length - 8}개</li>}</ul>}
            </> : <p>{statusError || '변경 상태를 확인하고 있습니다.'}</p>}
          </div>

          <div className="studio-preflight-results" aria-live="polite">
            {preflight ? preflight.steps.map((step) => <div key={step.id} data-state={step.passed ? 'good' : 'danger'}>
              {step.passed ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span><strong>{step.label}</strong><small>{step.summary} · {(step.durationMs / 1000).toFixed(1)}초</small></span>
            </div>) : <p>아직 이번 작업의 전체 검사를 실행하지 않았습니다.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
