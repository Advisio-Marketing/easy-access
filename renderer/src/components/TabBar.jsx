// src/renderer/src/components/TabBar.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './TabBar.css';

function TabBar({ tabs, activeTabId, onSwitchTab, onCloseTab, height }) {
  return (
    <div className="tab-bar" style={{ height: `${height}px` }}>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`tab-item ${tab.id === activeTabId ? 'active' : ''} status-${tab.status || 'ready'}`}
          onClick={() => tab.status !== 'loading' && onSwitchTab(tab.id)}
          title={tab.error ? `Chyba: ${tab.error}` : tab.name}
        >
          <span className="tab-item-name">{tab.name}</span>
          {tab.status === 'loading' && <span className="tab-spinner" title="Načítání..."></span>}
          {tab.status === 'error' && <span className="tab-error-icon" title={`Chyba: ${tab.error}`}>⚠️</span>}
          <button
            className="close-tab-btn"
            onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
            title={`Zavřít ${tab.name}`}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

TabBar.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['loading', 'ready', 'error']).isRequired,
    error: PropTypes.string,
  })).isRequired,
  activeTabId: PropTypes.string,
  onSwitchTab: PropTypes.func.isRequired,
  onCloseTab: PropTypes.func.isRequired,
  height: PropTypes.number.isRequired,
};

export default TabBar;