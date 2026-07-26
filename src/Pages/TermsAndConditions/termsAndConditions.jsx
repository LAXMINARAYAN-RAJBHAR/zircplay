import React from 'react'


const TermsAndConditions = () => {
  return (
    <div className="terms_container">
      <h1>Terms &amp; Conditions</h1>
      <p className="terms_updated">Last updated: {new Date().toLocaleDateString()}</p>

      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using ZIXPLON&reg;, you agree to be bound by these Terms &amp; Conditions.
          If you do not agree, please discontinue use of the platform immediately.
        </p>
      </section>

      <section>
        <h2>2. User Accounts</h2>
        <p>
          You must be at least 13 years of age to create an account. You are responsible
          for maintaining the confidentiality of your login credentials and for all
          activities that occur under your account.
        </p>
      </section>

      <section>
        <h2>3. Content Policy</h2>
        <p>Users may not upload or share content that:</p>
        <ul>
          <li>Is hateful, abusive, or discriminatory</li>
          <li>Violates copyright or intellectual property rights</li>
          <li>Contains explicit, adult, or harmful material</li>
          <li>Promotes violence, illegal activity, or misinformation</li>
          <li>Harasses, bullies, or threatens other users</li>
        </ul>
      </section>

      <section>
        <h2>4. Intellectual Property</h2>
        <p>
          All content you upload remains your property. However, by uploading to ZIXPLON&reg;,
          you grant us a non-exclusive, royalty-free license to display, distribute, and
          promote your content on the platform.
        </p>
      </section>

      <section>
        <h2>5. Monetization &amp; Ads</h2>
        <p>
          ZIXPLON&reg; may display advertisements on the platform. Creators may be eligible
          for monetization programs subject to separate eligibility criteria and agreements.
        </p>
      </section>

      <section>
        <h2>6. Termination</h2>
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms,
          without prior notice, at our sole discretion.
        </p>
      </section>

      <section>
        <h2>7. Limitation of Liability</h2>
        <p>
          ZIXPLON&reg; is not liable for any indirect, incidental, or consequential damages
          arising from your use of the platform or content posted by other users.
        </p>
      </section>

      <section>
        <h2>8. Changes to Terms</h2>
        <p>
          We may update these Terms &amp; Conditions at any time. Continued use of ZIXPLON&reg;
          after changes constitutes your acceptance of the new terms.
        </p>
      </section>

      <section>
        <h2>9. Contact Us</h2>
        <p>
          For questions regarding these terms, please contact us at{' '}
          <a href="mailto:support@zixplon.com">support@zixplon.com</a>.
        </p>
      </section>
    </div>
  )
}

export default TermsAndConditions