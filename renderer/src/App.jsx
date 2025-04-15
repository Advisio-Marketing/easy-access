import React, { useState, useEffect, useCallback } from "react";
import AccountButton from "./components/AccountButton";
import Sidebar from "./components/SideBar";
import TabBar from "./components/TabBar";
import ContentPlaceholder from "./components/ContentPlaceholder";
import "./assets/App.css";

const DEFAULT_SIDEBAR_WIDTH = 250;
const MIN_SIDEBAR_WIDTH = 150;
const MAX_SIDEBAR_WIDTH = 500;
const TAB_BAR_HEIGHT = 40;

function App() {
  const [viewMode, setViewMode] = useState("initial");
  const [accounts, setAccounts] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [errorLoadingAccounts, setErrorLoadingAccounts] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [prevSidebarWidth, setPrevSidebarWidth] = useState(
    DEFAULT_SIDEBAR_WIDTH
  );

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.min(
        Math.max(e.clientX, MIN_SIDEBAR_WIDTH),
        MAX_SIDEBAR_WIDTH
      );
      setSidebarWidth(newWidth);
    };

    const stopResizing = () => setIsResizing(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

  useEffect(() => {
    const removeStatusListener = window.electronAPI.onTabStatusUpdate(
      ({ accountId, status, error, name }) => {
        setOpenTabs((currentTabs) => {
          const existingTabIndex = currentTabs.findIndex(
            (tab) => tab.id === accountId
          );
          if (existingTabIndex > -1) {
            const newTabs = [...currentTabs];
            newTabs[existingTabIndex] = {
              ...newTabs[existingTabIndex],
              status,
              error: error || null,
            };
            return newTabs;
          } else if (status !== "error" && name) {
            if (!currentTabs.some((tab) => tab.id === accountId)) {
              return [
                ...currentTabs,
                { id: accountId, name: name, status, error: null },
              ];
            }
          }
          return currentTabs;
        });
        if (status === "ready" && !activeTabId) {
          setActiveTabId(accountId);
        }
      }
    );

    const removeActivateListener = window.electronAPI.onActivateTab(
      (accountId) => {
        setActiveTabId(accountId);
      }
    );

    const removeForceCloseListener = window.electronAPI.onForceCloseTab(
      (accountId) => {
        setOpenTabs((currentTabs) =>
          currentTabs.filter((tab) => tab.id !== accountId)
        );
      }
    );

    return () => {
      removeStatusListener();
      removeActivateListener();
      removeForceCloseListener();
    };
  }, [activeTabId]);

  const handleInitialButtonClick = useCallback(async (accountName) => {
    setIsLoadingAccounts(true);
    setErrorLoadingAccounts(null);
    try {
      await window.electronAPI.showMainLayout();
      const list = await window.electronAPI.fetchAccountList();
      if (Array.isArray(list)) {
        const formattedList = list.map((item) => ({
          id: String(item.id),
          name: item.client_name || `Účet ${item.id}`,
          client_country: item?.client_country,
        }));
        setAccounts(formattedList);
        setViewMode("main");
        const clickedAccount = formattedList.find((acc) =>
          acc.name.includes(accountName)
        );
        if (clickedAccount) {
          handleSidebarSelect(clickedAccount);
        }
      } else {
        throw new Error("Neplatná data účtů.");
      }
    } catch (err) {
      setErrorLoadingAccounts(`Chyba: ${err.message}`);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  const handleSidebarSelect = useCallback(
    async (account) => {
      const isAlreadyOpen = openTabs.some((tab) => tab.id === account.id);
      if (isAlreadyOpen) {
        if (activeTabId !== account.id) {
          handleSwitchTab(account.id);
        }
      } else {
        setActiveTabId(account.id);
        setOpenTabs((prev) => [
          ...prev,
          {
            id: account.id,
            name: account.name,
            status: "loading",
            error: null,
          },
        ]);
        const result = await window.electronAPI.selectAccount(account);
        if (!result.success) {
          console.error(
            `Failed to initiate select for ${account.id}:`,
            result.error
          );
        }
      }
    },
    [openTabs, activeTabId]
  );

  const handleSwitchTab = useCallback(
    async (accountId) => {
      if (activeTabId === accountId) return;
      const result = await window.electronAPI.switchTab(accountId);
      if (result.success) {
        setActiveTabId(accountId);
      }
    },
    [activeTabId]
  );

  const handleCloseTab = useCallback(
    async (accountId) => {
      const remainingTabs = openTabs.filter((tab) => tab.id !== accountId);
      setOpenTabs(remainingTabs);
      if (activeTabId === accountId) {
        const newActiveId =
          remainingTabs.length > 0
            ? remainingTabs[remainingTabs.length - 1].id
            : null;
        if (newActiveId) {
          window.electronAPI.switchTab(newActiveId);
        } else {
          window.electronAPI.switchTab(null);
        }
      }
      const result = await window.electronAPI.closeTab(accountId);
      if (!result.success) {
        console.error(
          `Failed to close tab ${accountId} in main process:`,
          result.error
        );
      }
    },
    [activeTabId, openTabs]
  );

  const handleReorderTabs = useCallback(
    (fromId, toId) => {
      const fromIndex = openTabs.findIndex((tab) => tab.id === fromId);
      const toIndex = openTabs.findIndex((tab) => tab.id === toId);
      if (fromIndex === -1 || toIndex === -1) return;

      const updated = [...openTabs];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      setOpenTabs(updated);
    },
    [openTabs]
  );

  const handleGoHome = useCallback(async () => {
    console.log("Navigating back to initial screen...");
    setOpenTabs([]);
    setActiveTabId(null);
    setViewMode("initial");
    // Zavoláme IPC handler pro úklid v main procesu (zavření views)
    try {
      await window.electronAPI.resetToHome();
      console.log("Main process reset successful.");
    } catch (error) {
      console.error("Error calling resetToHome in main process:", error);
    }
    // Není potřeba volat showMainLayout zde, protože přecházíme na 'initial'
  }, []); // Závislosti jsou prázdné, protože funkce nemění své chování

  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  const filteredAccounts = accounts.filter((account) =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDisabled = () => {
    alert("Na této službě se pracuje.");
  };

  if (viewMode === "initial") {
    return (
      <div
        className={`app-container-initial ${
          viewMode === "initial" ? "with-back-img" : null
        }`}
      >
        {errorLoadingAccounts && (
          <div style={{ color: "red", textAlign: "center" }}>
            <p>Chyba při načítání seznamu účtů:</p>
            <p>{errorLoadingAccounts}</p>
            <button
              onClick={() => handleInitialButtonClick("Heureka")}
              style={{ marginTop: "10px" }}
            >
              Zkusit znovu?
            </button>
          </div>
        )}
        {isLoadingAccounts && <p>Načítám...</p>}
        {!isLoadingAccounts && !errorLoadingAccounts && (
          <div className="initial-btn-box">
            <AccountButton
              accountName="Heureka"
              onClick={handleInitialButtonClick}
              disabled={isLoadingAccounts}
            />
            <AccountButton
              accountName="Glami"
              onClick={handleDisabled}
              disabled={isLoadingAccounts}
            />
            <AccountButton
              accountName="Favi"
              onClick={handleDisabled}
              disabled={isLoadingAccounts}
            />
            <AccountButton
              accountName="Biano"
              onClick={handleDisabled}
              disabled={isLoadingAccounts}
            />
            <AccountButton
              accountName="Modio"
              onClick={handleDisabled}
              disabled={isLoadingAccounts}
            />
          </div>
        )}
      </div>
    );
  }

  const activeTabInfo = openTabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="app-container-main">
      <Sidebar
        accounts={filteredAccounts}
        onSelect={handleSidebarSelect}
        width={sidebarWidth}
        isLoading={isLoadingAccounts}
        error={errorLoadingAccounts}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedAccountId={activeTabId}
        setViewMode={setViewMode}
        onGoHome={handleGoHome} // <-- Přidat novou prop
      />
      {/* <div
        className="sidebar-resizer"
        onMouseDown={() => setIsResizing(true)}
      /> */}
      <div className="main-content-wrapper">
        <TabBar
          tabs={openTabs}
          activeTabId={activeTabId}
          onSwitchTab={handleSwitchTab}
          onCloseTab={handleCloseTab}
          height={TAB_BAR_HEIGHT}
          onReorderTabs={handleReorderTabs}
        />
        <ContentPlaceholder activeTab={activeTabInfo} />
      </div>
    </div>
  );
}

export default App;
