import React from 'react';
import { render, screen } from '@testing-library/react';
import InputField from './InputField';

describe('InputField', () => {
  const defaultProps = {
    label: 'Test Input',
    placeholder: 'Enter test value',
    value: '',
    onChange: jest.fn(),
  };

  it('renders with label', () => {
    render(<InputField {...defaultProps} />);
    expect(screen.getByLabelText('Test Input')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(<InputField {...defaultProps} />);
    expect(screen.getByPlaceholderText('Enter test value')).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    render(<InputField {...defaultProps} error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('applies error styling when error is present', () => {
    render(<InputField {...defaultProps} error="Error message" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders with left icon when provided', () => {
    const leftIcon = <span data-testid="left-icon">🔍</span>;
    render(<InputField {...defaultProps} leftIcon={leftIcon} />);
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('renders with right icon when provided', () => {
    const rightIcon = <span data-testid="right-icon">✓</span>;
    render(<InputField {...defaultProps} rightIcon={rightIcon} />);
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('forwards ref to input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<InputField {...defaultProps} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className', () => {
    render(<InputField {...defaultProps} className="custom-class" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });
});
