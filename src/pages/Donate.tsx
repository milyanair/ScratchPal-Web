import { Layout } from '@/components/layout/Layout';
import { Heart, ExternalLink } from 'lucide-react';

const paymentMethods = [
  {
    name: 'Venmo',
    id: '@ATLIS-1',
    url: 'https://account.venmo.com/u/ATLIS-1',
    logo: 'https://cdn-ai.onspace.ai/onspace/files/5HSYSpyAp2AoZo4gzdSq5B/Venmo_Logo.svg.png',
    qr: 'https://cdn-ai.onspace.ai/onspace/files/4sT3k7n5RzMkGbHUqdKGwK/venmo.jpg',
    color: 'from-blue-500 to-blue-600',
  },
  {
    name: 'Cash App',
    id: '$ATLIS2',
    url: 'https://cash.app/$ATLIS2',
    logo: 'https://cdn-ai.onspace.ai/onspace/files/Z9uL2c8DfvMnuRuFQXKdQt/Cashapp_(1).png',
    qr: 'https://cdn-ai.onspace.ai/onspace/files/hn3wGUb52MtunwNzu72GPB/cashapp.png',
    color: 'from-green-500 to-green-600',
  },
  {
    name: 'Zelle',
    id: 'jaebri@voua.com',
    url: 'https://enroll.zellepay.com/qr-codes?data=eyJuYW1lIjoiQlJJREdFVFRFIiwidG9rZW4iOiJqYWVicmlAdm91YS5jb20ifQ==',
    logo: 'https://cdn-ai.onspace.ai/onspace/files/Zkd2i6AqSk5m6v8KewikwX/Zelle_logo.jpg',
    qr: 'https://cdn-ai.onspace.ai/onspace/files/8GSWhqvEE7hh3xJijvkL5N/zelleqr.png',
    color: 'from-purple-600 to-purple-700',
  },
  {
    name: 'Chime',
    id: '$ATLIS',
    url: 'https://app.chime.com/link/qr?u=ATLIS',
    logo: 'https://cdn-ai.onspace.ai/onspace/files/czz86LhDCzUrujJVJoUWsJ/Chime_Bank_logo.png',
    qr: 'https://cdn-ai.onspace.ai/onspace/files/czz86LhDCzUrujJVJoUWsJ/Chime_Bank_logo.png',
    color: 'from-green-600 to-teal-600',
  },
  {
    name: 'PayPal',
    id: 'login@atl.is',
    url: 'https://www.paypal.com/paypalme/atlisonline',
    logo: 'https://cdn-ai.onspace.ai/onspace/files/94bBVxnpcoWVVcq262wzBM/Paypal_Servise.jpg',
    qr: 'https://cdn-ai.onspace.ai/onspace/files/j3T33kUfoVkf32Ci9ivrpN/qrcode.png',
    color: 'from-blue-600 to-blue-700',
  },
];

export function Donate() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="w-10 h-10 text-red-500 fill-red-500 animate-pulse" />
            <h1 className="text-4xl font-bold flex items-center gap-2">
              Support
              <img 
                src="https://cdn-ai.onspace.ai/onspace/files/R25BtUg6LpGmrCRSQEkMCS/008bf7525_scratchpal_icon400.png" 
                alt="Gold Coin"
                className="w-10 h-10"
              />
              ScratchPal
            </h1>
            <Heart className="w-10 h-10 text-red-500 fill-red-500 animate-pulse" />
          </div>
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-6 mb-8">
            <p className="text-lg text-gray-700 leading-relaxed">
              We love developing this app. The considerable time and the resources needed to keep it running comes at a significant cost. Although we rely on advertising revenue, your support means the world to us. If you'd like to lend your direct support feel free to consider one of the options below.
            </p>
          </div>
        </div>

        {/* Payment Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {paymentMethods.map((method) => (
            <div
              key={method.name}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Header with gradient */}
              <div className={`bg-gradient-to-r ${method.color} p-6 text-white`}>
                <div className="flex items-center justify-between mb-4">
                  <img
                    src={method.logo}
                    alt={method.name}
                    className="h-12 object-contain bg-white/10 backdrop-blur px-4 py-2 rounded-lg"
                  />
                  <a
                    href={method.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/20 backdrop-blur hover:bg-white/30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span className="font-semibold text-sm">Open</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <div className="text-center">
                  <div className="text-sm opacity-90 mb-1">Send to</div>
                  <div className="text-2xl font-bold font-mono">{method.id}</div>
                </div>
              </div>

              {/* QR Code */}
              <div className="p-6 bg-gray-50 flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <img
                    src={method.qr}
                    alt={`${method.name} QR Code`}
                    className="w-48 h-48 object-contain"
                  />
                </div>
              </div>

              {/* Copy ID Button */}
              <div className="p-4 bg-white">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(method.id);
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
                >
                  Copy {method.name} ID
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Crypto Section */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg overflow-hidden text-white">
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>💰</span> Cryptocurrency
            </h2>
            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <div className="text-sm opacity-90 mb-2">Donate BNB to</div>
              <div className="font-mono text-lg break-all bg-black/20 p-3 rounded">
                0xd4F05DFc03660c6d08496F31fa3cB188a7A86A9B
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('0xd4F05DFc03660c6d08496F31fa3cB188a7A86A9B');
                }}
                className="mt-4 w-full bg-white/20 hover:bg-white/30 backdrop-blur px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Copy BNB Address
              </button>
            </div>
          </div>
        </div>

        {/* Thank You Message */}
        <div className="mt-8 text-center">
          <div className="bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Thank You! 🎉</h3>
            <p className="text-gray-700">
              Every contribution helps us keep ScratchPal running and improving. We truly appreciate your support!
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
