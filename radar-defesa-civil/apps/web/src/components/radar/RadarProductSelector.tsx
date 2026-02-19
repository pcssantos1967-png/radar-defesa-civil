'use client';

import { clsx } from 'clsx';

interface RadarProductSelectorProps {
  selected: string;
  onChange: (product: string) => void;
}

const products = [
  { code: 'PPI', name: 'PPI', description: 'Elevação fixa' },
  { code: 'CAPPI', name: 'CAPPI', description: 'Altitude constante' },
  { code: 'MAX-Z', name: 'MAX-Z', description: 'Máxima vertical' },
  { code: 'QPE', name: 'QPE', description: 'Precipitação' },
];

export function RadarProductSelector({ selected, onChange }: RadarProductSelectorProps) {
  return (
    <div className="bg-background-elevated/95 border border-border rounded-lg p-1 flex gap-1">
      {products.map((product) => (
        <button
          key={product.code}
          onClick={() => onChange(product.code)}
          className={clsx(
            'px-3 py-1.5 rounded text-sm font-medium transition-colors',
            selected === product.code
              ? 'bg-accent text-background'
              : 'text-text-secondary hover:text-text hover:bg-background-tertiary'
          )}
          title={product.description}
        >
          {product.name}
        </button>
      ))}
    </div>
  );
}
