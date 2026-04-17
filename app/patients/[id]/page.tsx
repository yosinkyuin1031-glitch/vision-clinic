'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { QRCodeSVG } from 'qrcode.react'
import type { Patient, VisionAIAnalysis } from '@/types'

interface Assessment {
  id: string
  assessed_at: string
  convergence_left_displacement_mm: number | null
  convergence_right_displacement_mm: number | null
  convergence_asymmetry_ratio: number | null
  convergence_near_point_cm: number | null
  focus_hold_at_apex: boolean | null
  pursuit_smoothness: 'good' | 'fair' | 'poor' | null
  saccade_accuracy: 'good' | 'fair' | 'poor' | null
  ai_analysis: VisionAIAnalysis | null
  therapist_note: string | null
  created_at: string
}

interface PlanExercise {
  id: string
  display_order: number
  target_bpm: number | null
  duration_sec: number
  vision_exercises: {
    id: string
    name: string
    category: string
    image_url: string | null
    video_url: string | null
    description: string
    instruction: string
    default_bpm: number | null
  } | null
}

interface Plan {
  id: string
  created_at: string
  therapist_note: string | null
  ai_generated_plan: VisionAIAnalysis | null
  vision_assessments: Assessment | null
  vision_plan_exercises: PlanExercise[]
}

export default function PatientDetailPage() {
  const { id } = useParams() as { id: string }
  const [patient, setPatient] = useState<Patient | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [printPlan, setPrintPlan] = useState<Plan | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: p } = await supabase
        .from('vc_patients')
        .select('*')
        .eq('id', id)
        .single()
      setPatient(p as Patient)

      const { data: pl } = await supabase
        .from('vision_plans')
        .select(`
          *,
          vision_assessments(*),
          vision_plan_exercises(*, vision_exercises(*))
        `)
        .eq('patient_id', id)
        .order('created_at', { ascending: false })
      setPlans((pl as Plan[]) || [])
      setLoading(false)
    }
    load()
  }, [id])

  const handlePrint = (plan: Plan) => {
    setPrintPlan(plan)
    setTimeout(() => window.print(), 100)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!patient) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">患者が見つかりません</p>
    </div>
  )

  const verdictLabel = (v: string | null) => v === 'good' ? '良好' : v === 'fair' ? 'やや不安定' : v === 'poor' ? '不良' : '-'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm no-print">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/patients" className="text-gray-500 hover:text-gray-900 text-sm font-medium">← 患者一覧</Link>
          <span className="font-bold text-gray-900">{patient.name}</span>
          <Link href={`/analyze?patient_id=${patient.id}`} className="btn-primary text-sm py-2 px-3">視機能評価</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 no-print">
        {/* 患者情報 */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl">
              {patient.gender === 'male' ? '👨' : '👩'}
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">{patient.name}</h1>
              <p className="text-gray-500">
                {patient.age ? `${patient.age}歳` : '年齢未登録'} /
                {patient.gender === 'male' ? ' 男性' : patient.gender === 'female' ? ' 女性' : ' 未設定'}
                {patient.occupation ? ` / ${patient.occupation}` : ''}
                {patient.wears_glasses ? ' / 眼鏡使用' : ''}
                {patient.phone && ` · ${patient.phone}`}
              </p>
              <p className="text-xs text-gray-400 mt-1">登録日: {new Date(patient.created_at).toLocaleDateString('ja-JP')}</p>
            </div>
          </div>
        </div>

        {/* 診断履歴 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-gray-900">評価履歴（{plans.length}件）</h2>
          </div>

          {plans.length === 0 && (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">👁️</p>
              <p className="font-bold">まだ評価履歴がありません</p>
              <Link href={`/analyze?patient_id=${patient.id}`} className="btn-primary inline-block mt-4 text-sm">
                最初の視機能評価を開始
              </Link>
            </div>
          )}

          <div className="space-y-4">
            {plans.map((plan, i) => {
              const assessment = plan.vision_assessments
              const exercises = plan.vision_plan_exercises || []
              const aiData = assessment?.ai_analysis || plan.ai_generated_plan

              return (
                <div key={plan.id} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-bold text-gray-900">評価 #{plans.length - i}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(plan.created_at).toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' })}
                      </p>
                    </div>
                    <button onClick={() => handlePrint(plan)} className="btn-secondary text-xs !px-3 !py-2">
                      印刷する
                    </button>
                  </div>

                  {/* AI所見 */}
                  {aiData?.summary && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                      <p className="text-xs font-bold text-indigo-700 mb-1">AI総合所見</p>
                      <p className="text-sm text-indigo-900">{aiData.summary}</p>
                    </div>
                  )}

                  {/* 検査結果 */}
                  {assessment && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-gray-500 mb-2">視機能測定結果</p>
                      <div className="grid grid-cols-2 gap-2">
                        {assessment.convergence_left_displacement_mm != null && (
                          <div className="bg-gray-50 rounded-lg p-2 text-sm">
                            <span className="text-gray-500">左目内転量: </span>
                            <span className="font-bold">{assessment.convergence_left_displacement_mm}mm</span>
                          </div>
                        )}
                        {assessment.convergence_right_displacement_mm != null && (
                          <div className="bg-gray-50 rounded-lg p-2 text-sm">
                            <span className="text-gray-500">右目内転量: </span>
                            <span className="font-bold">{assessment.convergence_right_displacement_mm}mm</span>
                          </div>
                        )}
                        {assessment.convergence_asymmetry_ratio != null && (
                          <div className="bg-gray-50 rounded-lg p-2 text-sm">
                            <span className="text-gray-500">左右差: </span>
                            <span className="font-bold">{(assessment.convergence_asymmetry_ratio * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        {assessment.convergence_near_point_cm != null && (
                          <div className="bg-gray-50 rounded-lg p-2 text-sm">
                            <span className="text-gray-500">近点: </span>
                            <span className="font-bold">{assessment.convergence_near_point_cm}cm</span>
                          </div>
                        )}
                        <div className="bg-gray-50 rounded-lg p-2 text-sm">
                          <span className="text-gray-500">追従: </span>
                          <span className="font-bold">{verdictLabel(assessment.pursuit_smoothness)}</span>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-sm">
                          <span className="text-gray-500">跳躍: </span>
                          <span className="font-bold">{verdictLabel(assessment.saccade_accuracy)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 伸びしろポイント */}
                  {aiData?.weak_areas && aiData.weak_areas.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-gray-500 mb-2">伸びしろポイント</p>
                      <div className="space-y-2">
                        {aiData.weak_areas.map((w, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <span className={`badge mt-0.5 ${w.severity === 'severe' ? 'badge-red' : w.severity === 'moderate' ? 'badge-yellow' : 'badge-blue'}`}>
                              {w.severity === 'severe' ? '要注意' : w.severity === 'moderate' ? '注意' : '軽度'}
                            </span>
                            <div>
                              <span className="font-bold text-sm">{w.area}</span>
                              <p className="text-xs text-gray-500">{w.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* トレーニングメニュー */}
                  {exercises.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">処方メニュー（{exercises.length}種）</p>
                      <div className="space-y-2">
                        {exercises.map((pe) => (
                          <div key={pe.id} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-3">
                              {pe.vision_exercises?.image_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={pe.vision_exercises.image_url} alt={pe.vision_exercises.name} className="w-12 h-12 object-contain rounded-lg bg-white flex-shrink-0" />
                              )}
                              <div className="flex-1">
                                <p className="font-bold text-sm">{pe.vision_exercises?.name}</p>
                                <p className="text-xs text-gray-500">
                                  {pe.duration_sec}秒
                                  {pe.target_bpm ? ` · ${pe.target_bpm} BPM` : ''}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* 印刷用レイアウト */}
      {printPlan && (() => {
        const assessment = printPlan.vision_assessments
        const exercises = printPlan.vision_plan_exercises || []
        const aiData = assessment?.ai_analysis || printPlan.ai_generated_plan
        const date = new Date(printPlan.created_at).toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' })

        return (
          <div className="print-only">
            <div className="print-page">
              <div className="print-header">
                <h1>視機能評価レポート</h1>
                <p className="print-patient">{patient.name} 様 ／ {patient.age ? `${patient.age}歳` : ''} ／ {date}</p>
              </div>

              {aiData?.summary && (
                <div className="print-summary-box">
                  <p>{aiData.summary}</p>
                </div>
              )}

              <div className="print-report-body">
                <div className="print-left">
                  <h2>視機能測定</h2>
                  <table className="print-test-table">
                    <tbody>
                      {assessment?.convergence_left_displacement_mm != null && <tr><td>左目内転量</td><td>{assessment.convergence_left_displacement_mm}mm</td></tr>}
                      {assessment?.convergence_right_displacement_mm != null && <tr><td>右目内転量</td><td>{assessment.convergence_right_displacement_mm}mm</td></tr>}
                      {assessment?.convergence_asymmetry_ratio != null && <tr><td>左右差</td><td>{(assessment.convergence_asymmetry_ratio * 100).toFixed(0)}%</td></tr>}
                      {assessment?.convergence_near_point_cm != null && <tr><td>近点</td><td>{assessment.convergence_near_point_cm}cm</td></tr>}
                      <tr><td>追従（滑動性）</td><td>{verdictLabel(assessment?.pursuit_smoothness ?? null)}</td></tr>
                      <tr><td>跳躍（サッケード）</td><td>{verdictLabel(assessment?.saccade_accuracy ?? null)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="print-right">
                  <h2>あなたの伸びしろ</h2>
                  {aiData?.weak_areas?.map((w, i) => (
                    <div key={i} className="print-weak-card">
                      <div className="print-weak-top">
                        <span className={`print-badge-${w.severity}`}>{w.severity === 'severe' ? '要注意' : w.severity === 'moderate' ? '注意' : '軽度'}</span>
                        <strong>{w.area}</strong>
                      </div>
                      <p>{w.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {aiData?.daily_life_advice && aiData.daily_life_advice.length > 0 && (
                <div className="print-daily-life">
                  <h2>日常生活で気をつけること</h2>
                  <div className="print-daily-life-items">
                    {aiData.daily_life_advice.map((a, i) => (
                      <div key={i} className="print-daily-life-item">
                        <span className="print-daily-life-icon">💡</span>
                        <p>{a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="print-page">
              <div className="print-header">
                <h1>今日からやるビジョントレーニング</h1>
                <p className="print-patient">{patient.name} 様専用メニュー</p>
              </div>
              <div className="print-ex-list">
                {exercises.map((pe, i) => {
                  const ex = pe.vision_exercises
                  if (!ex) return null
                  return (
                    <div key={pe.id} className="print-ex-card">
                      {ex.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ex.image_url} className="print-ex-img" alt={ex.name} />
                      )}
                      <div className="print-ex-info">
                        <div className="print-ex-name">
                          <span className="print-ex-num">{i + 1}</span>
                          <h3>{ex.name}</h3>
                          <span className="print-ex-reps">
                            {pe.duration_sec}秒{pe.target_bpm ? ` / ${pe.target_bpm}BPM` : ''}
                          </span>
                        </div>
                        <p className="print-ex-why">{ex.description}</p>
                        <p className="print-ex-muscle">{ex.instruction}</p>
                      </div>
                      {ex.video_url && (
                        <div className="print-ex-qr">
                          <QRCodeSVG value={ex.video_url} size={60} level="M" />
                          <span>動画</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {aiData?.recommendations && aiData.recommendations.length > 0 && (
                <div className="print-advice-bar">
                  {aiData.recommendations.map((r, i) => (
                    <p key={i}>{r}</p>
                  ))}
                </div>
              )}
              <div className="print-bottom-note">
                <p>1日3〜5分でも毎日続けることで眼球運動の質が高まります。20-20-20ルールも忘れずに。</p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
