interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
};

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`
        ${sizes[size]}
        animate-spin rounded-full
        border-slate-200 border-t-indigo-500
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  );
}
