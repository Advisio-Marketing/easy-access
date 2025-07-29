import React from 'react';
import PropTypes from 'prop-types';
import './StyledButton.css';

function StyledButton({ 
  children, 
  onClick, 
  disabled = false, 
  loading = false, 
  variant = 'primary',
  ...props 
}) {
  return (
    <button 
      className={`styled-button styled-button--${variant} ${loading ? 'loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {children}
    </button>
  );
}

StyledButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  variant: PropTypes.oneOf(['primary', 'danger']),
};

export default StyledButton;
