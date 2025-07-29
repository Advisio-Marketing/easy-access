import React, { useState } from 'react';
import PropTypes from 'prop-types';
import StyledButton from './StyledButton';
import './LoginScreen.css';

function LoginScreen({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Initiating Google authentication...');
      const result = await window.electronAPI.googleAuth();
      
      if (result.success) {
        console.log('Google authentication successful:', result.userInfo);
        onLogin(result.userInfo);
      } else {
        setError(result.error || 'Přihlášení se nezdařilo');
      }
    } catch (err) {
      console.error('Google authentication error:', err);
      setError('Chyba při přihlašování: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-content">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}
          <StyledButton 
            onClick={handleLogin}
            disabled={isLoading}
            loading={isLoading}
            variant="primary"
          >
            {isLoading ? 'Přihlašuji...' : 'Přihlásit pomocí Google'}
          </StyledButton>
        </div>
      </div>
    </div>
  );
}

LoginScreen.propTypes = {
  onLogin: PropTypes.func.isRequired,
};

export default LoginScreen;
