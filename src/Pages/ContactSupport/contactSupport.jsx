import React, { useState } from 'react'
import './contactSupport.css'

const ContactSupport = () => {
  const [form, setForm]       = useState({ name: '', email: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.message) return alert('Please fill all fields.')
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="contact_container">
      <h2>✅ Message Sent!</h2>
      <p>Our support team will get back to you within 24 hours.</p>
      <a href="#/">← Back to Home</a>
    </div>
  )

  return (
    <div className="contact_container">
      <h1>Contact Support</h1>
      <p>Fill out the form below and we'll get back to you shortly.</p>

      <input  className="contact_input"    name="name"    placeholder="Your Name"          value={form.name}    onChange={handleChange} />
      <input  className="contact_input"    name="email"   placeholder="Your Email"         value={form.email}   onChange={handleChange} />
      <textarea className="contact_textarea" name="message" placeholder="Describe your issue..." value={form.message} onChange={handleChange} rows={5} />

      <button className="contact_btn" onClick={handleSubmit}>Send Message</button>

      <div className="contact_alt">
        <p>Or reach us directly at <a href="mailto:support@zixplon.com">support@zixplon.com & support.zixplon@gmail.com</a></p>
      </div>
    </div>
  )
}

export default ContactSupport