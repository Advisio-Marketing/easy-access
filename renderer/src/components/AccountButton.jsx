// src/renderer/src/components/AccountButton.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './AccountButton.css';

function AccountButton({ accountName, onClick, disabled }) {
  return (
    <button
        className="account-button"
        onClick={() => !disabled && onClick(accountName)}
        disabled={disabled}
    >
      {disabled ? 'Načítám...' : accountName}
    </button>
  );
}

AccountButton.propTypes = {
  accountName: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

AccountButton.defaultProps = {
  disabled: false,
};

export default AccountButton;