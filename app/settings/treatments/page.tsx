'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { TreatmentRule, FunctionLevel } from '@/types'

const EVAL_LABELS: Record<string, string> = {
  convergence: '輻輳',
  divergence: '開散',
  fixation: '注視',
  pursuit: '追従',
  saccade: 'サッカード',
  blink: '瞬目',
  headCompensation: '頭部代償',
}

const LEVEL_LABELS: Record<string, string> = {
  mild: '軽度低下',
  moderate: '中等度低下',
  impaired: '機能低下',
}

const LEVEL_COLORS: Record<string, string> = {
  mild: 'bg-yellow-100 text-yellow-800',
  moderate: 'bg-orange-100 text-orange-800',
  impaired: 'bg-red-100 text-red-800',
}

type EditingRule = {
  id?: string
  trigger_eval: string
  trigger_level: string
  treatments: string[]
  display_order: number
  is_active: boolean
}

const EMPTY_RULE: EditingRule = {
  trigger_eval: 'convergence',
  trigger_level: 'moderate',
  treatments: [''],
  display_order: 0,
  is_active: true,
}

export default function TreatmentRulesPage() {
  const [rules, setRules] = useState<TreatmentRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadRules = async () => {
    try {
      const res = await fetch('/api/treatment-rules')
      const json = await res.json()
      if (json.data) setRules(json.data)
    } catch {
      setError('ルールの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRules() }, [])

  const save = async () => {
    if (!editing) return
    const treatments = editing.treatments.filter(t => t.trim())
    if (!treatments.length) { setError('施術内容を入力してください'); return }
    setSaving(true); setError('')
    try {
      const method = editing.id ? 'PUT' : 'POST'
      const res = await fetch('/api/treatment-rules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editing, treatments }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || '保存に失敗しました')
      }
      setEditing(null)
      loadRules()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const deleteRule = async (id: string) => {
    if (!confirm('このルールを削除しますか？')) return
    try {
      const res = await fetch(`/api/treatment-rules?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      loadRules()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  const toggleActive = async (rule: TreatmentRule) => {
    try {
      await fetch('/api/treatment-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      })
      loadRules()
    } catch {
      setError('更新に失敗しました')
    }
  }

  // 共通ルール（clinic_id=null）と自院ルールを分離
  const commonRules = rules.filter(r => !(r as TreatmentRule & { clinic_id?: string }).clinic_id)
  const myRules = rules.filter(r => (r as TreatmentRule & { clinic_id?: string }).clinic_id)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="mobile-header">
        <div className="mobile-header-inner">
          <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium min-h-[44px] flex items-center">← 戻る</Link>
          <span className="font-bold text-gray-900 text-sm">施術ルール</span>
          <button onClick={() => setEditing({ ...EMPTY_RULE })} className="text-indigo-600 font-bold text-sm min-h-[44px] flex items-center">+ 追加</button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl p-4 mb-4 text-sm font-medium">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">閉じる</button>
          </div>
        )}

        {/* 編集フォーム */}
        {editing && (
          <div className="card mb-6 border-2 border-indigo-300">
            <h2 className="font-bold text-lg mb-4">{editing.id ? 'ルールを編集' : '新しいルールを追加'}</h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">評価項目</label>
                <select value={editing.trigger_eval}
                  onChange={e => setEditing({ ...editing, trigger_eval: e.target.value })}
                  className="input">
                  {Object.entries(EVAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">発動レベル</label>
                <select value={editing.trigger_level}
                  onChange={e => setEditing({ ...editing, trigger_level: e.target.value })}
                  className="input">
                  {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="label">施術内容</label>
              {editing.treatments.map((t, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="text" value={t}
                    onChange={e => {
                      const arr = [...editing.treatments]
                      arr[i] = e.target.value
                      setEditing({ ...editing, treatments: arr })
                    }}
                    placeholder="例: 後頭下筋調整"
                    className="input flex-1" />
                  {editing.treatments.length > 1 && (
                    <button onClick={() => {
                      const arr = editing.treatments.filter((_, j) => j !== i)
                      setEditing({ ...editing, treatments: arr })
                    }} className="text-red-500 text-sm font-bold px-2">削除</button>
                  )}
                </div>
              ))}
              <button onClick={() => setEditing({ ...editing, treatments: [...editing.treatments, ''] })}
                className="text-indigo-600 text-sm font-bold">+ 施術を追加</button>
            </div>

            <div className="mb-4">
              <label className="label">表示順</label>
              <input type="number" value={editing.display_order}
                onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) })}
                className="input w-24" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="btn-secondary">キャンセル</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1 disabled:opacity-40">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* 自院のカスタムルール */}
        {myRules.length > 0 && (
          <div className="mb-8">
            <h2 className="font-bold text-lg mb-3 text-gray-900">自院のルール</h2>
            <div className="space-y-3">
              {myRules.map(rule => (
                <RuleCard key={rule.id} rule={rule}
                  onEdit={() => setEditing({
                    id: rule.id,
                    trigger_eval: rule.trigger_eval,
                    trigger_level: rule.trigger_level,
                    treatments: [...rule.treatments],
                    display_order: rule.display_order,
                    is_active: rule.is_active,
                  })}
                  onDelete={() => deleteRule(rule.id)}
                  onToggle={() => toggleActive(rule)}
                  editable
                />
              ))}
            </div>
          </div>
        )}

        {/* 共通ルール（二葉先生設計） */}
        {commonRules.length > 0 && (
          <div>
            <h2 className="font-bold text-lg mb-1 text-gray-900">共通ルール（二葉先生設計）</h2>
            <p className="text-xs text-gray-500 mb-3">共通ルールは閲覧のみ。カスタムが必要な場合は「+ 追加」で自院ルールを作成してください。</p>
            <div className="space-y-3">
              {commonRules.map(rule => (
                <RuleCard key={rule.id} rule={rule} />
              ))}
            </div>
          </div>
        )}

        {!loading && rules.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p>施術提案ルールがまだありません</p>
            <button onClick={() => setEditing({ ...EMPTY_RULE })} className="btn-primary mt-4">最初のルールを追加</button>
          </div>
        )}
      </main>
    </div>
  )
}

function RuleCard({ rule, onEdit, onDelete, onToggle, editable }: {
  rule: TreatmentRule
  onEdit?: () => void
  onDelete?: () => void
  onToggle?: () => void
  editable?: boolean
}) {
  return (
    <div className={`card !p-4 ${!rule.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-sm">{EVAL_LABELS[rule.trigger_eval] || rule.trigger_eval}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${LEVEL_COLORS[rule.trigger_level] || 'bg-gray-100'}`}>
          {LEVEL_LABELS[rule.trigger_level] || rule.trigger_level}
        </span>
        {!rule.is_active && <span className="text-xs text-gray-400">（無効）</span>}
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {rule.treatments.map((t, i) => (
          <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5">{t}</span>
        ))}
      </div>
      {editable && (
        <div className="flex gap-3 text-xs pt-1">
          <button onClick={onEdit} className="text-indigo-600 font-bold min-h-[32px]">編集</button>
          <button onClick={onToggle} className="text-gray-500 font-bold min-h-[32px]">{rule.is_active ? '無効化' : '有効化'}</button>
          <button onClick={onDelete} className="text-red-500 font-bold min-h-[32px]">削除</button>
        </div>
      )}
    </div>
  )
}
