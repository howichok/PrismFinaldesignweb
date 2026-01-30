import Link from "next/link";

import "./terms.css";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <header className="legal-header">
          <div className="legal-badge">
            <span>Last Updated: January 2026</span>
          </div>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-subtitle">
            Please read these terms carefully before using PrismMTR
          </p>
        </header>

        <article className="legal-content">
          <section className="legal-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the PrismMTR launcher ("Service"), you agree
              to be bound by these Terms of Service. If you do not agree to these
              terms, please do not use the Service.
            </p>
            <p>
              PrismMTR is a launcher designed for Minecraft Transit Railway (MTR)
              mod on Fabric 1.20.1. The Service is provided to improve stability,
              performance, and optimization for MTR gameplay.
            </p>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>2. Description of Service</h2>
            <p>PrismMTR provides:</p>
            <ul>
              <li>An optimized launcher for Minecraft with MTR mod support</li>
              <li>Performance improvements and stability enhancements</li>
              <li>Automatic mod management for Fabric 1.20.1</li>
              <li>User account management and settings synchronization</li>
            </ul>
            <p>
              The Service is currently available for Windows platforms, with
              support for additional operating systems planned for future
              releases.
            </p>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>3. User Accounts</h2>
            <h3>3.1 Registration</h3>
            <p>
              To access certain features, you must create an account using a
              supported authentication provider (GitHub, Google, or Discord).
              You are responsible for maintaining the confidentiality of your
              account credentials.
            </p>

            <h3>3.2 Account Requirements</h3>
            <p>
              You must provide a valid Minecraft username for whitelist
              functionality. This username must correspond to a legitimate
              Minecraft account that you own or have authorization to use.
            </p>

            <h3>3.3 Account Termination</h3>
            <p>
              We reserve the right to suspend or terminate accounts that violate
              these terms or engage in harmful behavior.
            </p>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any systems or networks</li>
              <li>Distribute malware or harmful code through the Service</li>
              <li>Interfere with the proper operation of the Service</li>
              <li>Impersonate other users or entities</li>
              <li>Use the Service to harass, abuse, or harm others</li>
            </ul>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>5. Intellectual Property</h2>
            <p>
              PrismMTR and its original content, features, and functionality are
              owned by the PrismMTR team. The Service is designed to work with
              Minecraft (owned by Mojang/Microsoft) and the Minecraft Transit
              Railway mod (owned by its respective developers).
            </p>
            <p>
              We do not claim ownership of Minecraft or any third-party mods. All
              trademarks and registered trademarks are the property of their
              respective owners.
            </p>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>6. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" and "as available" without
              warranties of any kind, either express or implied. We do not
              guarantee that the Service will be uninterrupted, secure, or
              error-free.
            </p>
            <p>
              We are not responsible for any issues arising from the use of
              Minecraft, Fabric, or third-party mods in conjunction with our
              Service.
            </p>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, PrismMTR shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages resulting from your use of the Service.
            </p>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>8. Privacy</h2>
            <p>
              Your privacy is important to us. We collect only the information
              necessary to provide the Service:
            </p>
            <ul>
              <li>Authentication data from your chosen OAuth provider</li>
              <li>Your Minecraft username for whitelist functionality</li>
              <li>Usage data to improve the Service</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>9. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Changes
              will be effective immediately upon posting to the website. Your
              continued use of the Service after any changes constitutes
              acceptance of the new terms.
            </p>
          </section>

          <hr className="legal-divider" />

          <section className="legal-section">
            <h2>10. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please
              contact us through our Help page or Discord server.
            </p>
          </section>
        </article>

        <footer className="legal-footer">
          <p>
            <Link href="/">← Back to Home</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
