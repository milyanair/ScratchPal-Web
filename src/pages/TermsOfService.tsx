import { Layout } from '@/components/layout/Layout';
import { FileText } from 'lucide-react';

export function TermsOfService() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-teal" />
            <h1 className="text-3xl font-bold">Terms of Service</h1>
          </div>
          
          <div className="text-sm text-gray-600 mb-6">
            <strong>Effective Date:</strong> January 13, 2026
          </div>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-2xl font-bold mb-3">1. Acceptance of Terms</h2>
              <p>
                Welcome to ScratchPal! These Terms of Service ("Terms") govern your access to and use of the ScratchPal website and mobile application (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">2. Description of Service</h2>
              <p>
                ScratchPal is a community platform that provides information, tracking, and discussion features related to scratch-off lottery tickets. The Service allows users to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>View and track scratch-off lottery games across multiple states</li>
                <li>Access rankings, prize information, and game details</li>
                <li>Participate in community forums and discussions</li>
                <li>Report winning tickets and scan ticket boards</li>
                <li>Save favorite games and conversations</li>
                <li>Find lottery retail locations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">3. User Accounts</h2>
              
              <h3 className="text-xl font-semibold mb-2 mt-4">Registration</h3>
              <p className="mb-3">
                To access certain features, you may need to create an account. When registering, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and update your information to keep it accurate</li>
                <li>Keep your password secure and confidential</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Be responsible for all activities that occur under your account</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Account Termination</h3>
              <p>
                We reserve the right to suspend or terminate your account at any time, with or without notice, for violation of these Terms or any illegal or harmful conduct.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">4. User Conduct</h2>
              <p className="mb-3">You agree NOT to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Service for any illegal purpose or in violation of any laws</li>
                <li>Post false, misleading, defamatory, or fraudulent content</li>
                <li>Harass, threaten, or harm other users</li>
                <li>Post spam, advertisements, or promotional content without permission</li>
                <li>Upload viruses, malware, or any malicious code</li>
                <li>Attempt to gain unauthorized access to the Service or other user accounts</li>
                <li>Scrape, crawl, or use bots to access the Service</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Impersonate any person or entity</li>
                <li>Violate the intellectual property rights of others</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">5. User-Generated Content</h2>
              
              <h3 className="text-xl font-semibold mb-2 mt-4">Your Content</h3>
              <p className="mb-3">
                You retain ownership of any content you post to the Service (forum posts, comments, images, etc.). However, by posting content, you grant ScratchPal a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, display, and distribute your content in connection with the Service.
              </p>

              <h3 className="text-xl font-semibold mb-2 mt-4">Content Standards</h3>
              <p className="mb-3">
                All user-generated content must:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Be accurate and truthful to the best of your knowledge</li>
                <li>Not violate any laws or third-party rights</li>
                <li>Not contain offensive, obscene, or inappropriate material</li>
                <li>Not promote illegal gambling or unlawful activities</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Content Removal</h3>
              <p>
                We reserve the right to remove any content that violates these Terms or is otherwise objectionable, with or without notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">6. Lottery Disclaimer</h2>
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <p className="font-semibold mb-2">⚠️ IMPORTANT DISCLAIMER</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>ScratchPal is an <strong>information and community platform only</strong></li>
                  <li>We <strong>do not sell lottery tickets</strong> or facilitate gambling</li>
                  <li>We are <strong>not affiliated with any state lottery organization</strong></li>
                  <li>All game data, rankings, and odds are provided for <strong>informational purposes only</strong></li>
                  <li>We do <strong>not guarantee the accuracy</strong> of lottery data or game information</li>
                  <li>You must be of <strong>legal age</strong> to purchase lottery tickets in your jurisdiction</li>
                  <li>Gambling can be addictive - please play responsibly</li>
                  <li>We are not responsible for any <strong>losses incurred from lottery purchases</strong></li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">7. Intellectual Property</h2>
              <p className="mb-3">
                The Service and its original content (excluding user-generated content), features, and functionality are owned by ScratchPal and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p>
                You may not copy, modify, distribute, sell, or lease any part of the Service without our prior written permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">8. Third-Party Services</h2>
              <p>
                The Service may contain links to third-party websites, services, or content. We are not responsible for the content, privacy policies, or practices of any third-party sites or services. Your use of third-party services is at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">9. Disclaimer of Warranties</h2>
              <p className="mb-3">
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Warranties of merchantability or fitness for a particular purpose</li>
                <li>Warranties that the Service will be uninterrupted, secure, or error-free</li>
                <li>Warranties regarding the accuracy or reliability of any information</li>
                <li>Warranties that defects will be corrected</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">10. Limitation of Liability</h2>
              <p>
                TO THE FULLEST EXTENT PERMITTED BY LAW, SCRATCHPAL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Your use or inability to use the Service</li>
                <li>Any unauthorized access to or use of our servers or any personal information</li>
                <li>Any bugs, viruses, or other harmful code transmitted through the Service</li>
                <li>Any errors or omissions in any content or information</li>
                <li>Any lottery purchases or gambling activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">11. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless ScratchPal and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses (including legal fees) arising out of or related to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any rights of another person or entity</li>
                <li>Your user-generated content</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">12. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved in the courts of competent jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">13. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms on this page and updating the "Effective Date." Your continued use of the Service after changes are posted constitutes your acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">14. Termination</h2>
              <p>
                We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will cease immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">15. Severability</h2>
              <p>
                If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">16. Contact Us</h2>
              <p className="mb-3">
                If you have questions or concerns about these Terms of Service, please contact us:
              </p>
              <ul className="list-none space-y-2">
                <li><strong>Email:</strong> <a href="mailto:info@scratchpal.com" className="text-teal hover:underline">info@scratchpal.com</a></li>
                <li><strong>Ask Us:</strong> <a href="https://play.scratchpal.com/hot-topics" className="text-teal hover:underline">https://play.scratchpal.com/hot-topics</a></li>
              </ul>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
            <p>Last updated: January 13, 2026</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
