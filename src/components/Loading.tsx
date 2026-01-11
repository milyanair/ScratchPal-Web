interface LoadingProps {
  message?: string;
}

export function Loading({ message }: LoadingProps) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        {/* Loading Animation */}
        <img
          src="http://scratchpal.com/SPLoop.gif"
          alt="Loading..."
          className="w-36 h-36"
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
