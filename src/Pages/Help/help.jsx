import React, { useState } from 'react'
import './help.css'

const faqs = [
  { q: "How do I upload a video?",          a: "Go to your profile and click the Upload button. Supported formats: MP4, AVI, MKV." },
  { q: "How do I report inappropriate content?", a: "Click the three-dot menu on any video and select 'Report'. Our team will review it." },
  { q: "Can I download videos?",            a: "Downloading is currently not supported. You can save videos to Watch Later." },
  { q: "How do I change my password?",      a: "Go to Settings → Account → Change Password." },
  { q: "How do I delete my account?",       a: "Go to Settings → Account → Delete Account. This action is irreversible." },
  { q: "Why is my video not playing?",      a: "Check your internet connection. Try refreshing or clearing your browser cache." },
]

const Help = () => {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <div className="help_container">
      <h1>Help &amp; FAQ</h1>
      <p>Find answers to the most common questions below.</p>

      <div className="faq_list">
        {faqs.map((faq, i) => (
          <div key={i} className="faq_item" onClick={() => setOpenIndex(openIndex === i ? null : i)}>
            <div className="faq_question">
              {faq.q}
              <span>{openIndex === i ? '▲' : '▼'}</span>
            </div>
            {openIndex === i && <div className="faq_answer">{faq.a}</div>}
          </div>
        ))}
      </div>
      <a href="#/">← Back to Home</a>
    </div>
  )
}

export default Help