import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import './reportProblem.css'

const issues = [
  'Video not playing',
  'Buffering issues',
  'Audio problem',
  'Wrong content',
  'Spam or Scam',
  'Hate speech',
  'Copyright violation',
  'Other',
]

// content_type in the DB is singular: 'video' | 'reel' | 'post'.
// Accept both singular and plural from the route so links from
// anywhere in the app (VideoDotsMenu, ShortCard, etc.) don't need to
// worry about exact wording.
const normalizeType = (type) => {
  const t = (type || '').toLowerCase()
  if (t === 'videos' || t === 'video') return 'video'
  if (t === 'reels' || t === 'reel') return 'reel'
  if (t === 'posts' || t === 'post') return 'post'
  return null
}

const TABLE_BY_TYPE = {
  video: 'videos',
  reel: 'reels',
  post: 'posts',
}

const ReportProblem = () => {
  const { type: rawType, id } = useParams()
  const navigate = useNavigate()
  const type = normalizeType(rawType)

  const [content, setContent] = useState(null)
  const [loadingContent, setLoadingContent] = useState(true)
  const [selected, setSelected] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Look up the content being reported so we can store a readable
  // title/owner on the report row (matches what AdminPanel.jsx expects:
  // content_title, content_owner) and so deleteContent() in AdminPanel
  // can find the right row later via content_id + content_type.
  useEffect(() => {
    let cancelled = false

    const loadContent = async () => {
      if (!type || !id) {
        setLoadingContent(false)
        return
      }

      const table = TABLE_BY_TYPE[type]
      // Reels use a "db_" prefixed id elsewhere in the app (see
      // /reels/db_<id> routes) — strip it here since the DB row id
      // itself is plain.
      const rawId = String(id).replace(/^db_/, '')

      const { data, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('id', rawId)
        .maybeSingle()

      if (cancelled) return

      if (fetchError || !data) {
        setError('Could not load this content. It may have been removed.')
        setLoadingContent(false)
        return
      }

      setContent({
        id: rawId,
        title: data.title || data.text?.slice(0, 60) || 'Untitled',
        owner: data.channel || data.username || data.uploader || 'unknown',
      })
      setLoadingContent(false)
    }

    loadContent()
    return () => {
      cancelled = true
    }
  }, [type, id])

  const handleSubmit = async () => {
    if (!selected || submitting) return
    if (!type || !id || !content) {
      setError('Missing content information — please go back and try again.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const reporterUsername = localStorage.getItem('username') || 'anonymous'

      const { error: insertError } = await supabase.from('reports').insert({
        content_type: type,
        content_id: content.id,
        content_title: content.title,
        content_owner: content.owner,
        reporter_username: reporterUsername,
        reason: selected,
        details: details.trim() || null,
        status: 'pending',
      })

      if (insertError) throw insertError

      setSubmitted(true)
    } catch (e) {
      console.error('[ReportProblem] Failed to submit report:', e)
      setError('Something went wrong submitting your report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingContent) {
    return (
      <div className="report_container">
        <h1>Report a Problem</h1>
        <p>Loading…</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="report_container">
        <h2>✅ Report Submitted!</h2>
        <p>Thank you. Our team will investigate and take action within 48 hours.</p>
        <a href="#/" onClick={(e) => { e.preventDefault(); navigate('/') }}>← Back to Home</a>
      </div>
    )
  }

  return (
    <div className="report_container">
      <h1>Report a Problem</h1>
      <p>
        {content
          ? <>Let us know what's wrong with <strong>{content.title}</strong>.</>
          : "Let us know what issue you're experiencing."}
      </p>

      <div className="report_options">
        {issues.map((issue) => (
          <div
            key={issue}
            className={`report_option ${selected === issue ? 'selected' : ''}`}
            onClick={() => setSelected(issue)}
          >
            {issue}
          </div>
        ))}
      </div>

      <textarea
        className="report_textarea"
        placeholder="Add more details (optional)..."
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={4}
      />

      {error && <p style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600, marginTop: '-10px' }}>{error}</p>}

      <button className="report_btn" onClick={handleSubmit} disabled={!selected || submitting}>
        {submitting ? 'Submitting…' : 'Submit Report'}
      </button>
    </div>
  )
}

export default ReportProblem