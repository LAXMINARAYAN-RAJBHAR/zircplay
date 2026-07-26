import React, { useState } from 'react'
import './feedback.css'

const Feedback = () => {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (rating === 0) return alert('Please select a star rating.')
    if (!message.trim()) return alert('Please enter a message.')
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="feedback_container">
      <h2>✅ Thank you for your feedback!</h2>
      <p>We appreciate you taking the time to share your thoughts.</p>
      <a href="#/">← Back to Home</a>
    </div>
  )

  return (
    <div className="feedback_container">
      <h1>Share Your Feedback</h1>
      <p>How would you rate your experience on ZIXPLON&reg;?</p>

      <div className="star_rating">
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            className={star <= (hover || rating) ? 'star active' : 'star'}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          >★</span>
        ))}
      </div>

      <textarea
        className="feedback_textarea"
        placeholder="Tell us what you think..."
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={5}
      />

      <button className="feedback_btn" onClick={handleSubmit}>Submit Feedback</button>
    </div>
  )
}

export default Feedback