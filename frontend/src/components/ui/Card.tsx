import React, { useState } from 'react';
import { cn } from '../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  shadow?: 'soft' | 'medium' | 'raised' | 'hover';
  gradient?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  hover = true,
  shadow = 'soft',
  gradient = false,
  onClick,
}) => {
  const shadowClasses = {
    soft: 'shadow-soft',
    medium: 'shadow-medium',
    raised: 'shadow-raised',
    hover: 'shadow-hover-transition',
  };

  const gradientClasses = gradient ? 'bg-gradient-card' : 'bg-white';

  const baseClasses = 'rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300';
  const shadowClass = shadowClasses[shadow];
  const hoverClass = hover ? 'hover:shadow-hover hover:bg-slate-50/50' : '';

  const cardClasses = cn(
    baseClasses,
    gradientClasses,
    shadowClass,
    hoverClass,
    className
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cardClasses}
        type="button"
      >
        {children}
      </button>
    );
  }

  return (
    <div className={cardClasses}>
      {children}
    </div>
  );
};

export default Card;