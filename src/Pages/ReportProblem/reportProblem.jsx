import React, { useState } from 'react'
import './reportProblem.css'

const issues = ['Video not playing', 'Buffering issues', 'Audio problem', 'Wrong content', 'Spam or Scam', 'Hate speech', 'Copyright violation', 'Other']

const ReportProblem = () => {
  const [selected, setSelected] = useState('')
  const [details, setDetails]   = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (!selected) return alert('Please select an issue type.')
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="report_container">
      <h2>✅ Report Submitted!</h2>
      <p>Thank you. Our team will investigate and take action within 48 hours.</p>
      <a href="#/">← Back to Home</a>
    </div>
  )

  return (
    <div className="report_container">
      <h1>Report a Problem</h1>
      <p>Let us know what issue you're experiencing.</p>

      <div className="report_options">
        {issues.map(issue => (
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
        onChange={e => setDetails(e.target.value)}
        rows={4}
      />

      <button className="report_btn" onClick={handleSubmit}>Submit Report</button>
    </div>
  )
}

export default ReportProblem