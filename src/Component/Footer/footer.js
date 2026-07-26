import React from 'react'
import { Link } from 'react-router-dom'
import './footer.css'

const Footer = ({ sideNavbar }) => {
  return (
    <div className={`footer ${sideNavbar ? 'footer-sidebar-open' : ''}`}>
      <p>©{new Date().getFullYear()} ZIXPLON&reg; All Rights Reserved.</p>
      <p>Origin: <span className="footer_dev">Made in India</span></p>
      <p>Developer & Owner: <span className="footer_dev">Laxminarayan Rajbhar</span></p>
      <div className="footer_links">
        <Link to="/about" className="footer_link">About</Link>
        <span className="footer_divider">|</span>
        <Link to="/terms-and-conditions" className="footer_link">Terms &amp; Conditions</Link>
        <span className="footer_divider">|</span>
        <Link to="/privacy-policy" className="footer_link">Privacy Policy</Link>
        <span className="footer_divider">|</span>
        <Link to="/dmca" className="footer_link">DMCA</Link>
        <span className="footer_divider">|</span>
        <Link to="/community-guidelines" className="footer_link">Community Guidelines</Link>
        <span className="footer_divider">|</span>
        <Link to="/advertise" className="footer_link">Advertise</Link>
        <span className="footer_divider">|</span>
        <Link to="/feedback" className="footer_link">Feedback</Link>
        <span className="footer_divider">|</span>
        <Link to="/help" className="footer_link">Help &amp; FAQ</Link>
        <span className="footer_divider">|</span>
        <Link to="/contact" className="footer_link">Contact Support</Link>
        <span className="footer_divider">|</span>
        <Link to="/report" className="footer_link">Report a Problem</Link>
      </div>
    </div>
  )
}

export default Footer