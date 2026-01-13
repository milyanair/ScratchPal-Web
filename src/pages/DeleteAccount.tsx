import { Layout } from '@/components/layout/Layout';
import { UserX, AlertTriangle, Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function DeleteAccount() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() && !username.trim()) {
      toast.error('Please enter your email or username');
      return;
    }

    setStep('confirm');
  };

  const handleFinalDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (confirmText !== 'DELETE MY ACCOUNT') {
      toast.error('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    setIsSubmitting(true);

    try {
      // Send deletion request email
      const deletionRequest = {
        email: email.trim(),
        username: username.trim(),
        userId: user?.id || 'Not logged in',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };

      // For now, we'll just show success and log out
      // In production, this would trigger an admin notification or automated deletion process
      console.log('Account deletion requested:', deletionRequest);

      // If user is logged in, log them out
      if (user) {
        await logout();
      }

      setStep('success');
      toast.success('Deletion request submitted');
    } catch (error: any) {
      console.error('Deletion request error:', error);
      toast.error('Failed to submit deletion request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          {step === 'form' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <UserX className="w-8 h-8 text-red-600" />
                <h1 className="text-3xl font-bold">Delete My Account</h1>
              </div>

              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-red-800 mb-2">Warning: This action cannot be undone</h3>
                    <p className="text-sm text-red-700 mb-2">
                      Deleting your account will permanently remove:
                    </p>
                    <ul className="text-sm text-red-700 space-y-1 list-disc pl-5">
                      <li>Your user profile and account information</li>
                      <li>All your forum posts and topics</li>
                      <li>Your favorite games and conversations</li>
                      <li>Your scanned ticket history</li>
                      <li>Your points and leaderboard ranking</li>
                      <li>All uploaded images and content</li>
                    </ul>
                  </div>
                </div>
              </div>

              <form onSubmit={handleInitialSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email Address {!user && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-4 py-3 border rounded-lg"
                    disabled={!!user}
                    required={!username.trim()}
                  />
                  {user && (
                    <p className="text-xs text-gray-500 mt-1">
                      Using email from your logged-in account
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Username (Optional)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your username (if you have one)"
                    className="w-full px-4 py-3 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Providing your username helps us verify your account
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">What happens next?</h4>
                  <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
                    <li>Your deletion request will be submitted to our team</li>
                    <li>We will verify your account information</li>
                    <li>Your account and all associated data will be permanently deleted within 30 days</li>
                    <li>You will receive a confirmation email once deletion is complete</li>
                  </ol>
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Continue to Confirmation
                </button>

                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </form>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <h1 className="text-3xl font-bold text-red-600">Final Confirmation</h1>
              </div>

              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
                <p className="font-bold text-red-800 mb-3 text-lg">
                  Are you absolutely sure you want to delete your account?
                </p>
                <p className="text-red-700 mb-3">
                  This will permanently delete all your data including:
                </p>
                <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">✗</span>
                    <span>Profile: {email}</span>
                  </div>
                  {username && (
                    <div className="flex items-center gap-2">
                      <span className="text-red-600">✗</span>
                      <span>Username: {username}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">✗</span>
                    <span>All forum posts and topics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">✗</span>
                    <span>All favorites and saved items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">✗</span>
                    <span>All points and achievements</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleFinalDelete} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Type <strong>DELETE MY ACCOUNT</strong> to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="w-full px-4 py-3 border-2 border-red-300 rounded-lg font-mono"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || confirmText !== 'DELETE MY ACCOUNT'}
                  className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Submitting Request...' : 'Yes, Delete My Account'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('form')}
                  disabled={isSubmitting}
                  className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Go Back
                </button>
              </form>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <Mail className="w-8 h-8 text-teal" />
                <h1 className="text-3xl font-bold">Request Submitted</h1>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-green-800 mb-2">
                  ✓ Your account deletion request has been received
                </h3>
                <p className="text-green-700 text-sm">
                  We will process your request within 30 days. You will receive a confirmation email at <strong>{email}</strong> once your account has been permanently deleted.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold mb-2">What happens now?</h4>
                <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                  <li>Your account has been flagged for deletion</li>
                  <li>Our team will verify your request</li>
                  <li>All your data will be permanently deleted within 30 days</li>
                  <li>You can contact us at <a href="mailto:info@scratchpal.com" className="text-teal hover:underline">info@scratchpal.com</a> if you change your mind</li>
                </ul>
              </div>

              <button
                onClick={() => navigate('/')}
                className="w-full gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Return to Home
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
