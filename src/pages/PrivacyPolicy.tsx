import { Layout } from '@/components/layout/Layout';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PrivacyPolicy() {
  const navigate = useNavigate();
  
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-teal" />
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
          </div>
          
          <div className="text-sm text-gray-600 mb-6">
            <strong>Effective Date:</strong> January 13, 2026
          </div>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-2xl font-bold mb-3">1. Introduction</h2>
              <p>
                Welcome to ScratchPal ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and mobile application (collectively, the "Service"). Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold mb-2 mt-4">Personal Information</h3>
              <p className="mb-3">
                We may collect personal information that you voluntarily provide to us when you:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Register for an account (email address, username)</li>
                <li>Sign in using third-party authentication (Google OAuth)</li>
                <li>Post content to our forums or discussions</li>
                <li>Report winning tickets or scan scratch-off tickets</li>
                <li>Contact us for support or feedback</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Automatically Collected Information</h3>
              <p className="mb-3">
                When you access the Service, we automatically collect certain information about your device, including:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>IP address and geolocation data</li>
                <li>Browser type and version</li>
                <li>Device type and operating system</li>
                <li>Pages visited and time spent on pages</li>
                <li>Referral source</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">User-Generated Content</h3>
              <p>
                Any content you post to public areas of the Service (forum posts, comments, uploaded images of tickets) may be visible to other users and is stored on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">3. How We Use Your Information</h2>
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, operate, and maintain the Service</li>
                <li>Improve and personalize your experience</li>
                <li>Process your transactions and manage your account</li>
                <li>Send you updates, notifications, and administrative messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze usage patterns and trends</li>
                <li>Detect, prevent, and address technical issues and fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">4. Sharing Your Information</h2>
              <p className="mb-3">We may share your information in the following situations:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>With Other Users:</strong> User-generated content (posts, comments, usernames) is publicly visible</li>
                <li><strong>Service Providers:</strong> We may share data with third-party vendors who perform services on our behalf (hosting, analytics, email delivery)</li>
                <li><strong>Legal Requirements:</strong> We may disclose your information if required by law or in response to valid legal requests</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, sale, or asset transfer, your information may be transferred to the acquiring entity</li>
              </ul>
              <p className="mt-3">
                <strong>We do not sell your personal information to third parties.</strong>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">5. Third-Party Services</h2>
              <p className="mb-3">
                The Service may contain links to third-party websites or integrate with third-party services:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Google OAuth:</strong> For authentication (subject to Google's Privacy Policy)</li>
                <li><strong>Supabase:</strong> For backend services and data storage (subject to Supabase's Privacy Policy)</li>
                <li><strong>Google AdSense:</strong> For displaying advertisements (subject to Google's Privacy Policy)</li>
                <li><strong>Analytics Services:</strong> To monitor and analyze Service usage</li>
              </ul>
              <p className="mt-3">
                We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">6. Data Security</h2>
              <p>
                We implement reasonable security measures to protect your information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">7. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">8. Your Privacy Rights</h2>
              <p className="mb-3">Depending on your location, you may have the following rights:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> Request access to the personal information we hold about you</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Opt-Out:</strong> Opt out of receiving marketing communications</li>
                <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, please contact us at <a href="mailto:info@scratchpal.com" className="text-teal hover:underline">info@scratchpal.com</a>
              </p>
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-bold mb-2">Account Deletion</h3>
                <p className="text-sm mb-3">
                  If you wish to permanently delete your account and all associated data, you can submit a deletion request through our automated system.
                </p>
                <button
                  onClick={() => navigate('/delete-account')}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                >
                  Request Account Deletion
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">9. Children's Privacy</h2>
              <p>
                The Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately so we can delete the information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">10. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Effective Date" at the top. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">11. Contact Us</h2>
              <p className="mb-3">
                If you have questions or concerns about this Privacy Policy, please contact us:
              </p>
              <ul className="list-none space-y-2">
                <li><strong>Email:</strong> <a href="mailto:info@scratchpal.com" className="text-teal hover:underline">info@scratchpal.com</a></li>
                <li><strong>Website:</strong> <a href="https://play.scratchpal.com/hot-topics" className="text-teal hover:underline">https://play.scratchpal.com/hot-topics</a></li>
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
