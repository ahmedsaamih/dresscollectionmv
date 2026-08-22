'use client';
import { Star } from 'lucide-react';

export function StarRating({ rating, max = 5, size = 15, className = '' }: {
  rating: number; max?: number; size?: number; className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-[2px] ${className}`} aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} className={i < rating ? 'fill-current' : 'fill-none'} strokeWidth={i < rating ? 0 : 1.5} />
      ))}
    </div>
  );
}
