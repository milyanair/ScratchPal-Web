interface LoadingProps {
  message?: string;
}

export function Loading({ message }: LoadingProps) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        {/* Loading Animation */}
        <img
          src="https://cdn-ai.onspace.ai/onspace/files/BRvymSnwsufTKGwX2WG8JC/SPLoop.gif"
          alt="Loading..."
          className="w-18 h-18"
          style={{ imageRendering: 'crisp-edges' }}
        />
        {/* Optional Message */}
        {message && (
          <p className="text-white font-semibold text-lg drop-shadow-lg">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
