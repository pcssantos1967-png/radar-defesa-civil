import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Custom render function that includes providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, {
      wrapper: ({ children }) => <>{children}</>,
      ...options,
    }),
  };
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
