'use client';

import React, { forwardRef, useState, useId, useRef, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Info, ShieldAlert, X, Check } from 'lucide-react';

// ─── Brand Identity ─────────────────────────────────────────────────────────

export function BrandLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-[#FAFAFA]"
      >
        {/* Monolithic Outer Hairline Octagonal Hex-Prism */}
        <rect
          x="3.5"
          y="3.5"
          width="33"
          height="33"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeOpacity="0.4"
        />
        {/* Geometric Monogram: Interlocking Chiseled K Monolith */}
        <path
          d="M13 10V30M13 20L25 10M17 17L27 30"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        {/* Optical Hairline Crosshair Accents */}
        <circle cx="20" cy="20" r="1.2" fill="currentColor" />
        <line x1="20" y1="2" x2="20" y2="5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.8" />
        <line x1="20" y1="35" x2="20" y2="38" stroke="currentColor" strokeWidth="1" strokeOpacity="0.8" />
        <line x1="2" y1="20" x2="5" y2="20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.8" />
        <line x1="35" y1="20" x2="38" y2="20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.8" />
      </svg>
    </div>
  );
}

export function BrandWordmark({
  size = 'md',
  subtitle = 'SECURITY ARCHITECTURE',
}: {
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}) {
  const sizes = {
    sm: { logo: 'h-6 w-6', title: 'text-sm tracking-[0.25em]', sub: 'text-[9px]' },
    md: { logo: 'h-8 w-8', title: 'text-base tracking-[0.3em]', sub: 'text-[10px]' },
    lg: { logo: 'h-10 w-10', title: 'text-xl tracking-[0.35em]', sub: 'text-[11px]' },
  };

  const current = sizes[size];

  return (
    <div className="flex items-center gap-3 select-none">
      <BrandLogo className={current.logo} />
      <div className="flex flex-col">
        <span className={`font-mono font-bold text-[#FAFAFA] uppercase leading-none ${current.title}`}>
          KRONOS
        </span>
        {subtitle && (
          <span className={`font-mono uppercase text-[#737373] tracking-[0.18em] mt-1 ${current.sub}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, fullWidth, className = '', children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-[var(--radius-sm)] focus-visible:outline-1 focus-visible:outline-[var(--border-focus)] focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.99]';

    const variants = {
      primary: 'bg-[#F5F5F5] text-[#111111] hover:bg-[#E5E5E5] border border-transparent shadow-sm',
      secondary: 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D] hover:border-[#505050] hover:bg-[#1D1D1D]',
      outline: 'bg-transparent text-[#FAFAFA] border border-[#2D2D2D] hover:border-[#505050] hover:bg-[#151515]',
      ghost: 'bg-transparent text-[#A3A3A3] hover:text-[#FAFAFA] hover:bg-[#151515]',
      danger: 'bg-[#181818] text-[#FAFAFA] border border-[#333333] hover:bg-[#222222] hover:border-[#555555]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-xs tracking-wider uppercase font-semibold gap-2',
      lg: 'h-11 px-5 text-sm tracking-wider uppercase font-semibold gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin-slow h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
            <path className="opacity-85" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ─── Input ───────────────────────────────────────────────────────────────────

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  sublabel?: string;
  error?: string;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, sublabel, error, hint, size = 'md', className = '', id: propId, ...props }, ref) => {
    const autoId = useId();
    const id = propId || autoId;

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-3.5 text-sm',
      lg: 'h-11 px-4 text-sm',
    };

    return (
      <div className="space-y-1.5 w-full">
        {(label || sublabel) && (
          <div className="flex items-center justify-between">
            {label && (
              <label htmlFor={id} className="block text-xs font-mono uppercase tracking-wider text-[#A3A3A3]">
                {label}
              </label>
            )}
            {sublabel && (
              <span className="text-[11px] font-mono text-[#737373] tracking-wide">
                {sublabel}
              </span>
            )}
          </div>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            className={`w-full rounded-[var(--radius-sm)] bg-[#101010] border transition-colors duration-150 text-[#FAFAFA] placeholder:text-[#444444] focus:outline-none focus:border-[#FAFAFA] focus:ring-1 focus:ring-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed ${
              error
                ? 'border-[#FAFAFA] text-[#FAFAFA]'
                : 'border-[#2D2D2D] hover:border-[#505050]'
            } ${sizes[size]} ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-[#E5E5E5] pt-0.5" role="alert">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-[#FAFAFA]" />
            <span>{error}</span>
          </p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-[#737373] font-mono leading-relaxed">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ─── Password Input ──────────────────────────────────────────────────────────

interface PasswordInputProps extends Omit<InputProps, 'type'> {}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={`pr-10 ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-[32px] transform text-[#737373] hover:text-[#FAFAFA] transition-colors p-1"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

// ─── Password Strength Meter ────────────────────────────────────────────────

export function PasswordStrengthMeter({ password = '' }: { password?: string }) {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const score = [hasMinLength, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;

  const strengthLabels = ['UNCONFIGURED', 'WEAK', 'MODERATE', 'GOOD', 'MAXIMUM'];
  const label = strengthLabels[score];

  return (
    <div className="space-y-2 pt-1">
      {/* Segmented Monochrome Progress Bar */}
      <div className="flex items-center justify-between text-[11px] font-mono tracking-wider">
        <span className="text-[#737373]">ENTROPY METRIC</span>
        <span className="text-[#FAFAFA] font-semibold">{password ? label : '—'}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 h-1">
        {[1, 2, 3, 4].map((step) => {
          const filled = score >= step;
          return (
            <div
              key={step}
              className={`h-full rounded-[1px] transition-all duration-200 ${
                filled ? 'bg-[#FAFAFA]' : 'bg-[#2D2D2D]'
              }`}
            />
          );
        })}
      </div>

      {/* Requirement Badges */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-mono">
        <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-[#FAFAFA]' : 'text-[#555555]'}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${hasMinLength ? 'bg-[#FAFAFA]' : 'bg-[#333333]'}`} />
          <span>8+ characters</span>
        </div>
        <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-[#FAFAFA]' : 'text-[#555555]'}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${hasUppercase ? 'bg-[#FAFAFA]' : 'bg-[#333333]'}`} />
          <span>Uppercase letter</span>
        </div>
        <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-[#FAFAFA]' : 'text-[#555555]'}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${hasNumber ? 'bg-[#FAFAFA]' : 'bg-[#333333]'}`} />
          <span>Numeric digit</span>
        </div>
        <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-[#FAFAFA]' : 'text-[#555555]'}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${hasSpecial ? 'bg-[#FAFAFA]' : 'bg-[#333333]'}`} />
          <span>Special symbol</span>
        </div>
      </div>
    </div>
  );
}

// ─── 6-Digit OTP Input ───────────────────────────────────────────────────────

interface OtpInputProps {
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  error?: string;
}

export function OtpInput({ value, onChange, onComplete, disabled, error }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleDigitChange = (index: number, char: string) => {
    // Only accept numeric digit
    const cleaned = char.replace(/\D/g, '');
    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      const nextVal = nextDigits.join('');
      onChange(nextVal);
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = cleaned[cleaned.length - 1]; // take last character typed
    const nextVal = nextDigits.join('');
    onChange(nextVal);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (nextVal.length === 6 && onComplete) {
      onComplete(nextVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    onChange(pasteData);
    const focusIndex = Math.min(pasteData.length, 5);
    inputRefs.current[focusIndex]?.focus();

    if (pasteData.length === 6 && onComplete) {
      onComplete(pasteData);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {[0, 1, 2, 3, 4, 5].map((idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={digits[idx] || ''}
            disabled={disabled}
            onChange={(e) => handleDigitChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            className={`w-11 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl font-bold rounded-[var(--radius-sm)] bg-[#101010] text-[#FAFAFA] border transition-colors focus:outline-none focus:border-[#FAFAFA] focus:ring-1 focus:ring-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed ${
              error
                ? 'border-[#FAFAFA]'
                : digits[idx]
                ? 'border-[#FAFAFA]'
                : 'border-[#2D2D2D] hover:border-[#505050]'
            }`}
          />
        ))}
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-[#E5E5E5] pt-1" role="alert">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-[#FAFAFA]" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────

interface AlertProps {
  type?: 'info' | 'error' | 'success' | 'warning';
  title?: string;
  message?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({
  type = 'info',
  title,
  message,
  children,
  onDismiss,
  className = '',
}: AlertProps) {
  const icons = {
    info: <Info className="h-4 w-4 text-[#A3A3A3] flex-shrink-0" />,
    success: <CheckCircle2 className="h-4 w-4 text-[#FAFAFA] flex-shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-[#FAFAFA] flex-shrink-0" />,
    warning: <ShieldAlert className="h-4 w-4 text-[#A3A3A3] flex-shrink-0" />,
  };

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 p-3.5 rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] text-[#FAFAFA] text-xs leading-relaxed animate-fade-in ${className}`}
    >
      <div className="pt-0.5">{icons[type]}</div>
      <div className="flex-1 space-y-0.5">
        {title && <p className="font-mono uppercase font-semibold text-[#FAFAFA]">{title}</p>}
        {message && <p className="text-[#A3A3A3]">{message}</p>}
        {children}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-[#737373] hover:text-[#FAFAFA] transition-colors p-0.5"
          aria-label="Dismiss alert"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Card & Panel ────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle';
}

export function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  const variants = {
    default: 'bg-[#151515] border border-[#2D2D2D]',
    elevated: 'bg-[#1D1D1D] border border-[#333333] shadow-2xl',
    subtle: 'bg-[#101010] border border-[#222222]',
  };

  return (
    <div
      className={`rounded-[var(--radius-sm)] p-6 transition-all duration-200 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

interface CheckboxProps {
  id?: string;
  label?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  id: propId,
  label,
  checked,
  onChange,
  disabled,
  className = '',
}: CheckboxProps) {
  const autoId = useId();
  const id = propId || autoId;

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <button
        type="button"
        role="checkbox"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`h-4 w-4 rounded-[2px] border transition-colors flex items-center justify-center focus-visible:outline-1 focus-visible:outline-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed ${
          checked
            ? 'bg-[#FAFAFA] border-[#FAFAFA] text-[#111111]'
            : 'bg-[#101010] border-[#2D2D2D] hover:border-[#505050]'
        }`}
      >
        {checked && <Check className="h-3 w-3 stroke-[3]" />}
      </button>
      {label && (
        <label
          htmlFor={id}
          className={`text-xs text-[#A3A3A3] cursor-pointer hover:text-[#FAFAFA] transition-colors leading-none ${
            disabled ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          {label}
        </label>
      )}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'active' | 'muted' | 'success' | 'secondary' | 'warning' | 'destructive';
  className?: string;
}) {
  const variants = {
    default: 'bg-[#151515] border border-[#2D2D2D] text-[#FAFAFA]',
    active: 'bg-[#FAFAFA] text-[#111111] font-semibold border border-transparent',
    muted: 'bg-[#101010] border border-[#222222] text-[#737373]',
    secondary: 'bg-[#1F1F1F] border border-[#333333] text-neutral-300',
    success: 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300',
    warning: 'bg-amber-950/40 border border-amber-800/50 text-amber-300',
    destructive: 'bg-red-950/40 border border-red-800/50 text-red-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase rounded-[2px] ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// ─── Modal / Dialog ──────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-[var(--radius-sm)] bg-[#151515] border border-[#2D2D2D] p-6 shadow-2xl space-y-4 animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#FAFAFA] tracking-tight">{title}</h3>
            {description && (
              <p className="text-xs text-[#737373] mt-1 font-mono">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#737373] hover:text-[#FAFAFA] p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
