// src/renderer/src/components/Sidebar.jsx
import React from "react";
import PropTypes from "prop-types";
import "./Sidebar.css";
import { FaHome } from "react-icons/fa";

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
}) {
  return (
    <div
      className="sidebar"
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      <div className="heading-box">
        <h2 className="sidebar-title">Účty</h2>
        <FaHome
          className="home-btn"
          onClick={onGoHome} // <-- Použít novou prop onGoHome
        />
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
  isLoading: PropTypes.bool.isRequired, // Zda se načítá *seznam* účtů
  error: PropTypes.string,
  searchTerm: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  selectedAccountId: PropTypes.string, // ID účtu aktivního v tabech
  onGoHome: PropTypes.func.isRequired, // <-- Přidat prop type
};

export default Sidebar;
