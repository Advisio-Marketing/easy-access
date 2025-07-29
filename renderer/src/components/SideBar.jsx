// src/renderer/src/components/Sidebar.jsx
import React from "react";
import PropTypes from "prop-types";
import "./Sidebar.css";
import { FaHome, FaChevronLeft, FaChevronRight } from "react-icons/fa";

function Sidebar({
  accounts,
  onSelect,
  width,
  isLoading,
  error,
  searchTerm,
  onSearchChange,
  selectedAccountId,
  setViewMode,
  onGoHome,
  isCollapsed,
  onToggleCollapse,
  onStartResize,
  isResizing,
}) {
  if (isCollapsed) {
    return (
      <div className="sidebar sidebar-collapsed" style={{ width: '40px', minWidth: '40px' }}>
        <div className="sidebar-toggle-btn" onClick={onToggleCollapse}>
          <FaChevronRight />
        </div>
        <div className="sidebar-resizer" onMouseDown={onStartResize}></div>
      </div>
    );
  }

  return (
    <div
      className="sidebar"
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      <div className="heading-box">
        <h2 className="sidebar-title">Účty</h2>
        <div className="sidebar-controls">
          <FaHome
            className="home-btn"
            onClick={onGoHome}
          />
          <div className="sidebar-toggle-btn" onClick={onToggleCollapse}>
            <FaChevronLeft />
          </div>
        </div>
      </div>

      {/* --- Vyhledávací pole --- */}
      <div className="sidebar-search-container">
        <input
          type="search"
          placeholder="Hledat účet..."
          className="sidebar-search-input"
          value={searchTerm}
          onChange={onSearchChange}
          disabled={isLoading || !!error} // Deaktivujeme hledání při načítání nebo chybě seznamu
        />
      </div>
      {/* ----------------------- */}

      {/* Zobrazení stavu načítání/chyby seznamu */}
      {isLoading && <p className="sidebar-loading">Načítám seznam...</p>}
      {error && <p className="sidebar-error">{error}</p>}

      {/* Seznam účtů */}
      {!isLoading && !error && (
        <ul className="sidebar-list">
          {accounts.length === 0 && searchTerm && (
            <li className="sidebar-empty">Žádné účty neodpovídají hledání.</li>
          )}
          {accounts.length === 0 && !searchTerm && (
            <li className="sidebar-empty">Nenalezeny žádné účty.</li>
          )}
          {accounts.map((account) => (
            <li
              key={account.id}
              className={`sidebar-item ${
                account.id === selectedAccountId ? "selected-in-sidebar" : ""
              }`}
              onClick={() => onSelect(account)}
              title={`${account.name} - ${account.client_country}`}
            >
              <span className="sidebar-item-name">
                {account.name} - {account.client_country}
              </span>
            </li>
          ))}
        </ul>
      )}
      
      {/* Resizer */}
      <div 
        className={`sidebar-resizer ${isResizing ? 'resizer-active' : ''}`}
        onMouseDown={onStartResize}
      ></div>
    </div>
  );
}

Sidebar.propTypes = {
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  onSelect: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  searchTerm: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  selectedAccountId: PropTypes.string,
  onGoHome: PropTypes.func.isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  onToggleCollapse: PropTypes.func.isRequired,
  onStartResize: PropTypes.func.isRequired,
  isResizing: PropTypes.bool.isRequired,
};

export default Sidebar;
