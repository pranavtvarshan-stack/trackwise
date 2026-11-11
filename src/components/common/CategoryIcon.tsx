import React from 'react';
import * as Icons from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
  color?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ 
  name, 
  className = "w-5 h-5", 
  color, 
  size = 20 
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (Icons as any)[name] || Icons.Tag;
  
  return (
    <span 
      className={`inline-flex items-center justify-center ${className}`}
      style={{ color: color || 'currentColor' }}
    >
      <IconComponent size={size} />
    </span>
  );
};

