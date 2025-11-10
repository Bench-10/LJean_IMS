import api, { notificationApi } from "./utils/api.js";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import ModalForm from "./components/ModalForm";
import ProductInventory from "./Pages/ProductInventory";
import Notification from "./Pages/Notification";
import ProductValidity from "./Pages/ProductValidity";
import Category from "./components/Category";
import ProductTransactionHistory from "./components/ProductTransactionHistory";
import { Routes, Route, useNavigate } from "react-router-dom";
import Login from "./authentication/Login";
import ResetPassword from "./authentication/ResetPassword.jsx";
import PageLayout from "./components/PageLayout";
import Dashboard from "./Pages/Dashboard";
import RouteProtection from "./utils/RouteProtection";
import UserManagement from "./Pages/UserManagement";
import UserModalForm from "./components/UserModalForm";
import UserInformation from "./components/UserInformation";
import Sales from "./Pages/Sales";
import DeliveryMonitoring from "./Pages/DeliveryMonitoring";
import AddSaleModalForm from "./components/AddSaleModalForm";
import { useAuth } from "./authentication/Authentication";
import BranchAnalyticsCards from "./Pages/BranchAnalyticsCards";
import BranchKPI from "./Pages/BranchKPI.jsx";
import AddDeliveryInformation from "./components/AddDeliveryInformation.jsx";
import FormLoading from "./components/common/FormLoading";
import AccountDisabledPopUp from "./components/dialogs/AccountDisabledPopUp";
import ProductExistsDialog from "./components/dialogs/ProductExistsDialog";
import Approvals from "./Pages/Approvals";
import { Toaster, toast } from "react-hot-toast";
import InventoryRequestMonitorDialog from "./components/dialogs/InventoryRequestMonitorDialog.jsx";
import PendingRequestsGuardDialog from "./components/dialogs/PendingRequestsGuardDialog.jsx";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const TAB_HIDDEN_GRACE_MS = 20 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'touchmove'];

const normalizeAlertId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return String(value);
  } catch (error) {
    return null;
  }
};

const dedupeNotifications = (notifications) => {
  if (!Array.isArray(notifications)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  notifications.forEach((notification) => {
    if (!notification || typeof notification !== 'object') {
      return;
    }

    const normalizedId = normalizeAlertId(notification.alert_id ?? notification.alertId ?? null);

    if (normalizedId) {
      if (seen.has(normalizedId)) {
        return;
      }
      seen.add(normalizedId);
    }

    result.push(notification);
  });

  return result;
};

const createDeleteGuardState = () => ({
  open: false,
  message: '',
  targetUserId: null,
  targetUserName: '',
  roleHint: '',
  userPendingDescription: '',
  showReviewButton: false,
  reviewLabel: 'Review requests',
  highlightType: null,
  highlightFocus: null,
  targetPendingIds: []
});

const dedupeUserRequestList = (records, statusFilter = null) => {
  // Purpose: normalize and deduplicate user-creation request records while preserving
  // the most recent/authoritative record per user id. This prevents old rejected
  // records from resurfacing in other filters when a newer pending/approved entry exists.
  // 
  // CRITICAL: Rejected user accounts should ONLY appear when explicitly requested.
  // They should never leak into pending, approved, or unfiltered views.
  
  if (!Array.isArray(records)) return [];

  // 1) Normalize input and filter out non-objects
  const normalized = records
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({ ...r }));

  // Helper to normalize status consistently
  const normalizeStatus = (record) => {
    const raw = String(record?.request_status ?? record?.status ?? '').toLowerCase().trim();
    if (raw === 'active') return 'approved';
    return raw || 'pending';
  };

  // 2) Apply status-based prefiltering to exclude unwanted records early
  const prefiltered = normalized.filter((record) => {
    const status = normalizeStatus(record);
    
    // If filtering for pending, exclude rejected/cancelled/deleted entirely
    if (statusFilter === 'pending') {
      return status === 'pending';
    }
    
    // If filtering for a specific status other than rejected, exclude rejected
    if (statusFilter && statusFilter !== 'rejected') {
      return status === statusFilter;
    }
    
    // If filtering for rejected explicitly, only include rejected
    if (statusFilter === 'rejected') {
      return status === 'rejected';
    }
    
    // If no filter, exclude rejected by default (they must be explicitly requested)
    if (!statusFilter) {
      return status !== 'rejected';
    }
    
    return true;
  });

  // 3) Deduplicate by numeric id, keeping the most authoritative record
  const byId = new Map();

  const toTime = (v) => {
    if (!v) return 0;
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  };

  const getPriority = (record) => {
    const status = normalizeStatus(record);
    // Higher number = higher priority when timestamps are equal
    // Pending has highest priority (active requests should be visible)
    // Approved second (completed successfully)
    // Rejected third (still informative)
    // Cancelled/deleted lowest (least relevant)
    if (status === 'pending') return 100;
    if (status === 'approved' || status === 'active') return 80;
    if (status === 'rejected') return 50;
    if (status === 'cancelled' || status === 'deleted') return 10;
    return 60;
  };

  prefiltered.forEach((rec, index) => {
    const rawId = rec?.pending_user_id ?? rec?.user_id ?? rec?.id ?? null;
    const idNum = Number.isFinite(Number(rawId)) ? String(Number(rawId)) : null;

    if (!idNum) {
      // No usable id: store with a synthetic key to preserve these entries
      byId.set(`__noid__${index}`, rec);
      return;
    }

    const candidateTime = toTime(
      rec?.request_resolved_at ?? 
      rec?.request_decision_at ?? 
      rec?.updated_at ?? 
      rec?.request_created_at ?? 
      rec?.created_at ?? 
      rec?.createdAt
    ) || 0;

    const existing = byId.get(idNum);
    if (!existing) {
      byId.set(idNum, rec);
      return;
    }

    const existingTime = toTime(
      existing?.request_resolved_at ?? 
      existing?.request_decision_at ?? 
      existing?.updated_at ?? 
      existing?.request_created_at ?? 
      existing?.created_at ?? 
      existing?.createdAt
    ) || 0;

    // Strategy: Always prefer the most recent timestamp
    if (candidateTime > existingTime) {
      byId.set(idNum, rec);
      return;
    }

    if (candidateTime < existingTime) {
      return; // Keep existing
    }

    // If timestamps are equal, use priority
    if (getPriority(rec) > getPriority(existing)) {
      byId.set(idNum, rec);
    }
  });

  // 4) Return deduplicated list, preserving insertion order
  return Array.from(byId.values());
};



function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openUserModal, setOpenUserModal] = useState(false);
  const [openSaleModal, setOpenSaleModal] = useState(false);
  const [openUsers, setOpenUsers] = useState(false);
  const [userDetailes, setUserDetailes] = useState([]);
  const [isCategoryOpen, setIsCategory] = useState(false);
  const [isProductTransactOpen, setIsProductTransactOpen] = useState(false);
  const [historyFocus, setHistoryFocus] = useState(null);
  const [validityFocus, setValidityFocus] = useState(null);
  const [modalMode, setModalMode] = useState('add');
  const [itemData, setItemData] = useState(null);
  const [productsData, setProductsData] = useState([])
  const [listCategories, setListCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [notify, setNotify] = useState([]);
  const [saleHeader,setSaleHeader ] = useState([]);
  const [openNotif, setOpenNotif] = useState(false);
  const [openAddDelivery, setAddDelivery] = useState(false);
  const [deliveryData, setDeliveryData] = useState([]);
  const [deliveryEditData, setDeliveryEdit] = useState([]);
  const [productValidityList, setProductValidityList] = useState([]);
  const [pendingInventoryRequests, setPendingInventoryRequests] = useState([]);
  const [pendingInventoryLoading, setPendingInventoryLoading] = useState(false);
  const [adminInventoryRequests, setAdminInventoryRequests] = useState([]);
  const [adminInventoryLoading, setAdminInventoryLoading] = useState(false);
  const [isRequestMonitorOpen, setIsRequestMonitorOpen] = useState(false);
  const [userCreationRequests, setUserCreationRequests] = useState([]);
  const [userCreationLoading, setUserCreationLoading] = useState(false);
  const [requestStatusRefreshKey, setRequestStatusRefreshKey] = useState(0);

  const normalizePendingId = (value) => (value === null || value === undefined ? '' : String(value));

  const normalizeComparableName = (value) => {
    if (!value) return '';
    return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
  };

  const normalizeRoleList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    const normalized = String(value).trim();
    return normalized ? [normalized] : [];
  };

  const userRequestHistory = useMemo(() => {
    if (!Array.isArray(userCreationRequests)) {
      return [];
    }

    const toIsoString = (value) => {
      if (!value) return null;
      const direct = new Date(value);
      if (!Number.isNaN(direct.getTime())) {
        return direct.toISOString();
      }
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
      return null;
    };

    return userCreationRequests
      .map((record) => {
        if (!record) {
          return null;
        }

        const normalizedStatusRaw = String(record?.request_status ?? record?.status ?? 'pending').toLowerCase();
        const normalizedStatus = (() => {
          if (normalizedStatusRaw === 'active') return 'approved';
          if (normalizedStatusRaw === 'deleted') return 'cancelled';
          return normalizedStatusRaw;
        })();

        const createdAtIso = toIsoString(
          record?.request_created_at
            ?? record?.created_at
            ?? record?.createdAt
            ?? (typeof record?.formated_hire_date === 'string' ? record.formated_hire_date.trim() : record?.formated_hire_date)
        );
        const resolvedAtIso = toIsoString(record?.request_resolved_at ?? record?.resolved_at ?? record?.request_decision_at);
        const approvedAtIso = toIsoString(record?.request_approved_at ?? record?.approved_at ?? record?.approvedAt ?? resolvedAtIso);

        const createdByName = record?.created_by_name
          ?? (typeof record?.created_by === 'string' ? record.created_by.replace(/\s+/g, ' ').trim() : null)
          ?? null;

        const creatorIdCandidate = Number(record?.created_by_id ?? record?.created_by);
        const createdById = Number.isFinite(creatorIdCandidate) ? creatorIdCandidate : null;

        const normalizedRoles = normalizeRoleList(record?.role);

        const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'cancelled']);
        if (!allowedStatuses.has(normalizedStatus)) {
          return null;
        }

        // Filter out auto-approved users created directly by Owner (no approval process)
        const creatorRoles = normalizeRoleList(record?.creator_roles);
        const isOwnerCreator = creatorRoles.includes('Owner');
        const wasAutoApproved = normalizedStatus === 'approved' && isOwnerCreator && !record?.manager_approver_id;
        
        if (wasAutoApproved) {
          return null;
        }

        return {
          ...record,
          status: normalizedStatus,
          request_status: normalizedStatus,
          normalized_status: normalizedStatus,
          created_by_id: createdById,
          created_by_display: createdByName,
          created_by_name: createdByName,
          request_created_at: createdAtIso,
          request_decision_at: resolvedAtIso,
          request_approved_at: approvedAtIso,
          request_rejection_reason: record?.request_rejection_reason ?? record?.resolution_reason ?? null,
          request_approved_by: record?.request_approved_by ?? record?.owner_resolved_by ?? null,
          branch: record?.branch ?? record?.branch_name ?? null,
          branch_name: record?.branch_name ?? record?.branch ?? null,
          full_name: record?.full_name ?? record?.target_full_name ?? record?.username ?? 'User account',
          role: normalizedRoles
        };
      })
      .filter((record) => {
        if (!record) {
          return false;
        }

        const hasCreatorReference = record.created_by_id !== null
          || (typeof record.created_by_display === 'string' && record.created_by_display.trim() !== '');

        return hasCreatorReference;
      });
  }, [userCreationRequests]);

  const pendingUserRequests = useMemo(
    () => userRequestHistory.filter((record) => String(record?.normalized_status ?? '').toLowerCase() === 'pending'),
    [userRequestHistory]
  );

  // NOTIFICATION QUEUE SYSTEM
  const addToNotificationQueue = useCallback((message, options = {}) => {
    let config = {
      isLocal: false,
      title: undefined,
      dedupeKey: undefined,
      duration: 2200,
      tone: undefined
    };

    if (typeof options === 'boolean') {
      config.isLocal = options;
    } else if (options && typeof options === 'object') {
      config = { ...config, ...options };
    }

    const { dedupeKey, duration, tone } = config;
    const toastContent = (
      <div className="flex flex-col">
        {config.title ? (
          <span className="font-semibold text-sm text-emerald-700">{config.title}</span>
        ) : null}
        <span className="text-sm text-gray-800">{message}</span>
      </div>
    );

    const toastOptions = {
      id: dedupeKey,
      duration: typeof duration === 'number' && duration > 0 ? duration : 5200
    };

    if (tone === 'error') {
      toast.error(toastContent, toastOptions);
      return;
    }

    if (tone === 'success' || config.isLocal) {
      toast.success(toastContent, toastOptions);
      return;
    }

    toast(toastContent, toastOptions);
  }, []);
  const handledInventoryActionsRef = useRef(new Set());
  const handledInventoryCleanupRef = useRef(new Map());
  const userActivityTimeoutRef = useRef(null);
  const lastActivityStateRef = useRef(true);
  const hiddenActivityTimeoutRef = useRef(null);
  const notificationFetchLockRef = useRef(false);

  // ACCOUNT STATUS STATES
  const [showAccountDisabledPopup, setShowAccountDisabledPopup] = useState(false);
  const [accountStatusType, setAccountStatusType] = useState(''); // 'disabled' or 'deleted'
  const [hasLoggedOutDueToStatus, setHasLoggedOutDueToStatus] = useState(false);

  // PRODUCT EXISTS DIALOG STATES
  const [showProductExistsDialog, setShowProductExistsDialog] = useState(false);
  const [productExistsMessage, setProductExistsMessage] = useState('');
  const [deleteGuardDialog, setDeleteGuardDialog] = useState(createDeleteGuardState);
  const [highlightDirective, setHighlightDirective] = useState(null);

  //LOADING STATES
  const [invetoryLoading, setInventoryLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);


  // Socket connection
  const [socket, setSocket] = useState(null);

  const {user, logout} = useAuth();
  const navigate = useNavigate();

  const userRoles = useMemo(() => {
    if (!user) return [];
    if (Array.isArray(user.role)) return user.role;
    return user.role ? [user.role] : [];
  }, [user]);

  const canAccessUserRequestFeed = useMemo(
    () => userRoles.some((role) => ['Owner', 'Branch Manager', 'Inventory Staff'].includes(role)),
    [userRoles]
  );

  const isOwner = useMemo(() => userRoles.includes('Owner'), [userRoles]);
  const isBranchManager = useMemo(() => userRoles.includes('Branch Manager'), [userRoles]);
  const isSalesAssociate = useMemo(() => userRoles.includes('Sales Associate'), [userRoles]);
  const shouldFetchNotifications = useMemo(
    () => userRoles.some(role => ['Branch Manager', 'Inventory Staff', 'Owner'].includes(role)),
    [userRoles]
  );
  const canOpenRequestMonitor = useMemo(
    () => userRoles.some(role => ['Inventory Staff', 'Branch Manager', 'Owner'].includes(role)),
    [userRoles]
  );
  
  useEffect(() => {
    if (!canOpenRequestMonitor && isRequestMonitorOpen) {
      setIsRequestMonitorOpen(false);
    }
  }, [canOpenRequestMonitor, isRequestMonitorOpen]);


  //PREVENTS SCRIPTS ATTACKS ON INPUT FIELDS
  function sanitizeInput(input) {
    return input.replace(/[<>="']/g, '');
  }

  const resolveBeaconUrl = useCallback(() => {
    if (!user || !user.user_id) return null;
    if (typeof window === 'undefined') return null;

    const suffix = `/users/${user.user_id}/activity/beacon`;
    const base = api.defaults?.baseURL;

    if (typeof base === 'string' && base.trim()) {
      const trimmed = base.trim().replace(/\/+$/, '');

      try {
        const targetUrl = new URL(trimmed, window.location.origin);
        targetUrl.pathname = `${targetUrl.pathname.replace(/\/$/, '')}${suffix}`;
        targetUrl.search = '';
        targetUrl.hash = '';
        return targetUrl.toString();
      } catch (error) {
        if (/^https?:\/\//i.test(trimmed)) {
          return `${trimmed}${suffix}`;
        }
      }
    }

    try {
      const fallback = new URL(`/api${suffix}`, window.location.origin);
      return fallback.toString();
    } catch (error) {
      return `/api${suffix}`;
    }
  }, [user]);


  const sendActivityUpdate = useCallback(async (nextState, reason, options = {}) => {
    if (!user || !user.user_id) return;

    const previousState = lastActivityStateRef.current;
    const { force = false, preferBeacon = false, skipFallback = false } = options;

    if (!force && previousState === nextState) {
      return;
    }

    lastActivityStateRef.current = nextState;

    if (preferBeacon) {
      const beaconUrl = resolveBeaconUrl();

      if (beaconUrl) {
        const payload = JSON.stringify({ isActive: nextState, reason });
        let beaconSent = false;

        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          try {
            const blob = typeof Blob !== 'undefined' ? new Blob([payload], { type: 'application/json' }) : payload;
            beaconSent = navigator.sendBeacon(beaconUrl, blob);
          } catch (error) {
            console.error('Beacon activity update failed:', error);
          }
        }

        if (beaconSent) {
          return;
        }

        if (skipFallback) {
          try {
            if (typeof fetch === 'function') {
              fetch(beaconUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
                credentials: 'include'
              });
            }
          } catch (error) {
            console.error('Keepalive activity update failed:', error);
          }
          return;
        }
      }
    }

    try {
      await api.put(`/api/users/${user.user_id}/activity`, { isActive: nextState, reason });
    } catch (error) {
      lastActivityStateRef.current = previousState;
      console.error('Failed to update user activity status:', error);
    }
  }, [user, resolveBeaconUrl]);


  const scheduleInactivityCheck = useCallback(() => {
    if (!user || !user.user_id) return;

    if (userActivityTimeoutRef.current) {
      clearTimeout(userActivityTimeoutRef.current);
    }

    userActivityTimeoutRef.current = setTimeout(() => {
      sendActivityUpdate(false, 'timeout');
    }, INACTIVITY_TIMEOUT_MS);
  }, [user, sendActivityUpdate]);


  const clearHiddenActivityTimeout = useCallback(() => {
    if (hiddenActivityTimeoutRef.current) {
      clearTimeout(hiddenActivityTimeoutRef.current);
      hiddenActivityTimeoutRef.current = null;
    }
  }, []);


  const handleUserInteraction = useCallback(() => {
    if (!user || !user.user_id) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    scheduleInactivityCheck();
    clearHiddenActivityTimeout();
    sendActivityUpdate(true, 'interaction');
  }, [user, scheduleInactivityCheck, sendActivityUpdate, clearHiddenActivityTimeout]);


  const handleVisibilityChange = useCallback(() => {
    if (!user || !user.user_id) return;
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      if (userActivityTimeoutRef.current) {
        clearTimeout(userActivityTimeoutRef.current);
        userActivityTimeoutRef.current = null;
      }
      clearHiddenActivityTimeout();

      hiddenActivityTimeoutRef.current = setTimeout(() => {
        sendActivityUpdate(false, 'hidden', { preferBeacon: true, force: true });
        hiddenActivityTimeoutRef.current = null;
      }, TAB_HIDDEN_GRACE_MS);
    } else {
      clearHiddenActivityTimeout();
      sendActivityUpdate(true, 'visible', { force: true });
      scheduleInactivityCheck();
    }
  }, [user, sendActivityUpdate, scheduleInactivityCheck, clearHiddenActivityTimeout]);


  const handleWindowBlur = useCallback(() => {
    if (!user || !user.user_id) return;

    clearHiddenActivityTimeout();
    if (userActivityTimeoutRef.current) {
      clearTimeout(userActivityTimeoutRef.current);
      userActivityTimeoutRef.current = null;
    }

    hiddenActivityTimeoutRef.current = setTimeout(() => {
      sendActivityUpdate(false, 'blur', { preferBeacon: true, force: true });
      hiddenActivityTimeoutRef.current = null;
    }, TAB_HIDDEN_GRACE_MS);
  }, [user, sendActivityUpdate, clearHiddenActivityTimeout]);


  const handleWindowFocus = useCallback(() => {
    clearHiddenActivityTimeout();
    handleUserInteraction();
  }, [handleUserInteraction, clearHiddenActivityTimeout]);


  const handlePageHide = useCallback((event) => {
    if (!user || !user.user_id) return;
    if (event?.persisted) return;

    clearHiddenActivityTimeout();
    if (userActivityTimeoutRef.current) {
      clearTimeout(userActivityTimeoutRef.current);
      userActivityTimeoutRef.current = null;
    }

    sendActivityUpdate(false, 'pagehide', { preferBeacon: true, force: true, skipFallback: true });
  }, [user, sendActivityUpdate, clearHiddenActivityTimeout]);


  const handleBeforeUnload = useCallback(() => {
    if (!user || !user.user_id) return;

    clearHiddenActivityTimeout();
    if (userActivityTimeoutRef.current) {
      clearTimeout(userActivityTimeoutRef.current);
      userActivityTimeoutRef.current = null;
    }

    sendActivityUpdate(false, 'beforeunload', { preferBeacon: true, force: true, skipFallback: true });
  }, [user, sendActivityUpdate, clearHiddenActivityTimeout]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    if (!user || !user.user_id) {
      if (userActivityTimeoutRef.current) {
        clearTimeout(userActivityTimeoutRef.current);
        userActivityTimeoutRef.current = null;
      }
      clearHiddenActivityTimeout();
      lastActivityStateRef.current = true;
      return undefined;
    }

    lastActivityStateRef.current = true;
    sendActivityUpdate(true, 'page-load', { force: true });
    scheduleInactivityCheck();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleUserInteraction, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserInteraction);
      });
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('blur', handleWindowBlur);
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('beforeunload', handleBeforeUnload);

      if (userActivityTimeoutRef.current) {
        clearTimeout(userActivityTimeoutRef.current);
        userActivityTimeoutRef.current = null;
      }
      clearHiddenActivityTimeout();
    };
  }, [
    user,
    sendActivityUpdate,
    scheduleInactivityCheck,
    handleUserInteraction,
    handleVisibilityChange,
    handleWindowFocus,
    handleWindowBlur,
    handlePageHide,
    handleBeforeUnload,
    clearHiddenActivityTimeout
  ]);

  const handleNotificationPanelOpen = () => {
    toast.dismiss();
    setOpenNotif(true);
  };

  const handleHistoryModalClose = useCallback(() => {
    setIsProductTransactOpen(false);
    setHistoryFocus(null);
  }, []);

  const handleNotificationNavigation = useCallback((notification) => {
    if (!notification) return;

  const rawProductId = notification.product_id;
  const normalizedProductId = rawProductId !== undefined && rawProductId !== null ? Number(rawProductId) : NaN;
  const alertType = (notification.alert_type || '').toLowerCase();
  const message = (notification.message || '').toLowerCase();

  const category = (notification.category || notification.category_tag || notification.categoryType || '').toLowerCase();
  const saleId = notification.sales_information_id ?? notification.sale_id ?? notification.sales_id ?? null;
  const deliveryId = notification.delivery_id ?? null;
  const highlightContext = notification.highlight_context || notification.highlightContext || null;

    const isValidityAlert = alertType === 'expired'
      || alertType === 'near expired'
      || message.includes('shelf life');

    const addStockId = notification.add_stock_id
      ?? notification.add_id
      ?? notification.stock_entry_id
      ?? null;

    const productValidityDate = notification.product_validity
      ?? notification.product_validity_date
      ?? notification.expiry_date
      ?? null;

    if (isValidityAlert) {
      setOpenNotif(false);
      navigate('/product_validity');

      if (!Number.isNaN(normalizedProductId) || addStockId || productValidityDate) {
        setValidityFocus({
          productId: Number.isNaN(normalizedProductId) ? null : normalizedProductId,
          addStockId: addStockId != null ? String(addStockId) : null,
          productValidityDate,
          alertType: notification.alert_type ?? '',
          alertId: notification.alert_id ?? null,
          triggeredAt: Date.now()
        });
      }

      return;
    }

    const looksLikeHistoryUpdate = alertType === 'product update'
      || message.includes('has been added')
      || message.includes('has been updated')
      || message.includes('additional');

    const isLowStockAlert = message.includes('low stock');

    if (looksLikeHistoryUpdate && !isLowStockAlert) {
      setOpenNotif(false);
      navigate('/inventory');

      setHistoryFocus({
        type: 'product-history',
        addStockId: notification.add_stock_id ?? null,
        dateAdded: notification.history_timestamp ?? null,
        historyTimestamp: notification.history_timestamp ?? null,
        alertId: notification.alert_id ?? null,
        alertTimestamp: notification.alert_timestamp ?? notification.alert_date ?? null,
        triggeredAt: Date.now()
      });

      setIsProductTransactOpen(true);
    }

    const looksLikeDeliveryNotification = category === 'delivery'
      || deliveryId !== null
      || alertType.includes('delivery')
      || message.includes('delivery')
      || message.includes('courier');

    const looksLikeSalesNotification = !looksLikeDeliveryNotification && (
      category === 'sales'
        || (deliveryId === null && saleId !== null && message.includes('sale'))
        || (deliveryId === null && alertType.includes('sale'))
    );

    if (looksLikeDeliveryNotification && (saleId || deliveryId)) {
      setOpenNotif(false);
      navigate('/delivery');

      setTimeout(() => {
        const detail = {
          saleId: saleId ? Number(saleId) : null,
          deliveryId: deliveryId ? Number(deliveryId) : null,
          highlightContext: highlightContext ?? null
        };

        // Persist pending navigation so the target page can consume it if it's not mounted yet
        try {
          sessionStorage.setItem('pendingNavigateToDelivery', JSON.stringify(detail));
        } catch (e) { /* ignore non-browser env */ }

        window.dispatchEvent(new CustomEvent('navigate-to-delivery-row', { detail }));
      }, 150);

      return;
    }

    if (looksLikeSalesNotification && saleId) {
      setOpenNotif(false);
      navigate('/sales');

      setTimeout(() => {
        const detail = {
          saleId: Number(saleId),
          highlightContext: highlightContext ?? null
        };

        // Persist pending navigation so the target page can consume it if it's not mounted yet
        try {
          sessionStorage.setItem('pendingNavigateToSale', JSON.stringify(detail));
        } catch (e) { /* ignore non-browser env */ }

        window.dispatchEvent(new CustomEvent('navigate-to-sale-row', { detail }));
      }, 150);

      return;
    }

    if (Number.isNaN(normalizedProductId)) {
      return;
    }
  }, [navigate]);

  useEffect(() => {
    if (!openNotif) {
      return;
    }

    toast.dismiss();
  }, [openNotif]);

  // CHECK IF CURRENT USER IS DISABLED ON PAGE LOAD/REFRESH
  const checkUserStatus = async () => {
    if (!user || !user.user_id || showAccountDisabledPopup || hasLoggedOutDueToStatus) return;

    try {
      const response = await api.get(`/api/user_status/${user.user_id}`);
      const userData = response.data;
      
      if (userData.is_disabled && !showAccountDisabledPopup) {
        console.log('User is disabled on page load, showing popup');
        setAccountStatusType('disabled');
        setShowAccountDisabledPopup(true);
      }
    } catch (error) {
      // IF USER NOT FOUND (DELETED), SHOW DELETED POPUP
      if (error.response && error.response.status === 404 && !showAccountDisabledPopup) {
        console.log('User not found (deleted), showing popup');
        setAccountStatusType('deleted');
        setShowAccountDisabledPopup(true);
      } else {
        console.error('Error checking user status:', error);
      }
    }
  };

  // HANDLE ACCOUNT DISABLED/DELETED ACTION
  const handleAccountStatusAction = async () => {
    if (accountStatusType === 'deleted') {
      // FOR DELETED ACCOUNTS - REDIRECT TO LOGIN WITHOUT LOGOUT API CALL
      setHasLoggedOutDueToStatus(true);
      setShowAccountDisabledPopup(false);
      await logout(true); // SKIP API CALL FOR DELETED USERS
      navigate('/');
    } else if (accountStatusType === 'disabled') {
      // FOR DISABLED ACCOUNTS - LOGOUT NORMALLY
      setHasLoggedOutDueToStatus(true);
      setShowAccountDisabledPopup(false);
      await logout(false); // SEND LOGOUT API CALL FOR DISABLED USERS
      navigate('/');
    }
  };

  // HANDLE CLOSING THE POPUP (FOR WHEN NO USER IS PRESENT)
  const handleClosePopup = () => {
    setShowAccountDisabledPopup(false);
    setHasLoggedOutDueToStatus(true); // PREVENT RE-SHOWING
  };


  // RESET LOGOUT FLAG WHEN USER CHANGES
  useEffect(() => {
    if (user) {
      // RESET THE FLAG WHEN A NEW USER LOGS IN
      setHasLoggedOutDueToStatus(false);
    }
  }, [user]);

  const handleRequestMonitorOpen = useCallback(() => {
    if (!canOpenRequestMonitor) {
      return;
    }
    setIsRequestMonitorOpen(true);
  }, [canOpenRequestMonitor]);

  const handleCloseDeleteGuardDialog = useCallback(() => {
    setDeleteGuardDialog(createDeleteGuardState());
  }, []);

  const handleHighlightConsumed = useCallback((type) => {
    setHighlightDirective(prev => {
      if (!prev || prev.type !== type) {
        return prev;
      }
      return null;
    });
  }, []);

  const handleReviewDeleteGuard = useCallback(() => {
    const {
      targetUserId,
      targetUserName,
      highlightType,
      highlightFocus,
      targetPendingIds
    } = deleteGuardDialog;
    setDeleteGuardDialog(createDeleteGuardState());

    if (!highlightType) {
      return;
    }

    const numericUserId = Number(targetUserId);
    const hasNumericUserId = Number.isFinite(numericUserId);

    const directiveBase = {
      userId: hasNumericUserId ? numericUserId : null,
      userName: targetUserName,
      triggeredAt: Date.now(),
      focusKind: highlightFocus || null,
      targetIds: Array.isArray(targetPendingIds) && targetPendingIds.length > 0 ? targetPendingIds : null
    };

    setHighlightDirective({
      type: highlightType,
      ...directiveBase
    });

    if (highlightType === 'owner-approvals') {
      navigate('/approvals');
      return;
    }

    if (highlightType === 'branch-pending') {
      navigate('/inventory');
    }
  }, [deleteGuardDialog, navigate]);

  // CHECK USER STATUS ON INITIAL LOAD OR USER CHANGE
  useEffect(() => {
    if (user && user.user_id && user.role && !user.role.some(role => ['Owner'].includes(role))) {
      // ONLY CHECK STATUS FOR NON-OWNER USERS
      checkUserStatus();

      // SET UP PERIODIC STATUS CHECK EVERY 2 MINUTES
      const statusCheckInterval = setInterval(() => {
        if (!showAccountDisabledPopup && !hasLoggedOutDueToStatus) { // ONLY CHECK IF POPUP IS NOT ALREADY SHOWING AND HAVEN'T LOGGED OUT DUE TO STATUS
          checkUserStatus();
        }
      }, 120000); // 2 minutes

      return () => clearInterval(statusCheckInterval);
    }
  }, [user, showAccountDisabledPopup, hasLoggedOutDueToStatus]);

  // WEB SOCKET CONNECTION
  useEffect(() => {
    if (!user) {
      // RESET NOTIFICATION STATE WHEN USER LOGS OUT
      setNotify([]);
      return;
    }

    const newSocket = io(`${import.meta.env.VITE_API_URL}`); 
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
     
      const resolvedRoles = Array.isArray(user.role)
        ? user.role
        : user.role
          ? [user.role]
          : [];

      newSocket.emit('join-branch', {
        userId: user.user_id ?? user.admin_id ?? null,
        adminId: user.admin_id ?? null,
        branchId: user.branch_id ?? null,
        roles: resolvedRoles,
        role: resolvedRoles,
        userType: user.admin_id ? 'admin' : 'user'
      });

      // CHECK USER STATUS WHEN WEBSOCKET RECONNECTS
      if (user.user_id && user.role && !user.role.some(role => ['Owner'].includes(role)) && !hasLoggedOutDueToStatus) {
        checkUserStatus();
      }
    });

    // LISTEN FOR NEW NOTIFICATION
    newSocket.on('new-notification', (notification) => {
      console.log('New notification received:', notification);

      const userRolesForFilter = Array.isArray(user?.role)
        ? user.role
        : (user?.role ? [user.role] : []);

      const canAcceptNotification = () => {
        if (notification?.creator_id && user?.user_id === notification.creator_id) {
          return false;
        }

        if (Array.isArray(notification?.target_roles) && notification.target_roles.length > 0) {
          const matchesRole = userRolesForFilter.some(role => notification.target_roles.includes(role));

          if (!matchesRole) {
            return false;
          }
        }

        return true;
      };

      const incomingAlertId = normalizeAlertId(notification?.alert_id);

      setNotify(prevNotify => {
        if (!canAcceptNotification()) {
          return prevNotify;
        }

        const alreadyExists = incomingAlertId
          ? prevNotify.some(existing => normalizeAlertId(existing?.alert_id) === incomingAlertId)
          : false;

        const isSelfNotification = notification?.user_id !== undefined && notification?.user_id !== null
          ? String(notification.user_id) === String(user?.user_id)
          : false;

        if (!alreadyExists && !isSelfNotification) {
          return dedupeNotifications([notification, ...prevNotify]);
        }

        if (!incomingAlertId) {
          return dedupeNotifications([notification, ...prevNotify]);
        }

        return prevNotify;
      });
    });

    // LISTEN FOR INVENTORY UPDATES
    newSocket.on('inventory-update', (inventoryData) => {
      console.log('Inventory update received:', inventoryData);
      
      // ONLY UPDATE IF THE UPDATE WASN'T MADE BY THE CURRENT USER
      if (user.user_id !== inventoryData.user_id) {
        if (inventoryData.action === 'add') {
          setProductsData(prevData => [...prevData, inventoryData.product]);
          // notify UI components to reapply their local filters (e.g. branch filter)
          try {
            window.dispatchEvent(new CustomEvent('inventory-ui-updated', { detail: inventoryData }));
          } catch (e) { /* ignore in non-browser env */ }
          
          // Don't show "added successfully" to other users - that's only for the person who added it
          // This WebSocket event just updates the data silently for other users
          
        } else if (inventoryData.action === 'update') {
          setProductsData(prevData => 
            prevData.map(item => 
              item.product_id === inventoryData.product.product_id  && item.branch_id === inventoryData.product.branch_id
                ? inventoryData.product 
                : item
            )
          );
          // notify UI components to reapply their local filters
          try {
            window.dispatchEvent(new CustomEvent('inventory-ui-updated', { detail: inventoryData }));
          } catch (e) { }
          
          // Don't show "updated successfully" to other users - that's only for the person who updated it
          // This WebSocket event just updates the data silently for other users
          
        } else if (inventoryData.action === 'sale_deduction' || inventoryData.action === 'delivery_stock_change') {
          // HANDLE INVENTORY CHANGES FROM SALES OR DELIVERY STATUS CHANGES
          setProductsData(prevData => 
            prevData.map(item => 
              item.product_id === inventoryData.product.product_id &&
              item.branch_id === inventoryData.product.branch_id
                ? inventoryData.product 
                : item
            )
          );
          // notify UI components to reapply their local filters
          try {
            window.dispatchEvent(new CustomEvent('inventory-ui-updated', { detail: inventoryData }));
          } catch (e) { }
          
          // Stock changes from sales/delivery are handled silently
          // No need to show notifications for these automatic updates
        }
      }
    });

    // LISTEN FOR INVENTORY APPROVAL REQUESTS
    newSocket.on('inventory-approval-request', (payload) => {
      if (!payload || !payload.request) return;

      if (!user) {
        return;
      }

      const isBranchManager = user.role && user.role.some(role => ['Branch Manager'].includes(role));

      if (!isBranchManager) {
        return;
      }

      if (payload.request.branch_id !== user.branch_id) {
        return;
      }

      setPendingInventoryRequests(prev => {
        const exists = prev.some(req => normalizePendingId(req.pending_id) === normalizePendingId(payload.request.pending_id));
        return exists ? prev : [...prev, payload.request];
      });
      setRequestStatusRefreshKey((prev) => prev + 1);
    });

    newSocket.on('inventory-approval-request-admin', (payload) => {
      if (!payload || !payload.request) return;

      if (!user || !user.role || !user.role.some(role => ['Owner'].includes(role))) {
        return;
      }

      setAdminInventoryRequests(prev => {
        const exists = prev.some(req => normalizePendingId(req.pending_id) === normalizePendingId(payload.request.pending_id));
        if (exists) {
          return prev.map(req => normalizePendingId(req.pending_id) === normalizePendingId(payload.request.pending_id) ? payload.request : req);
        }
        return [...prev, payload.request];
      });
      setRequestStatusRefreshKey((prev) => prev + 1);
    });

    // LISTEN FOR INVENTORY APPROVAL RESOLUTIONS
    newSocket.on('inventory-approval-updated', (payload) => {
      if (!payload || !payload.pending_id) return;

      if (!user) {
        return;
      }

      const isBranchManager = user.role && user.role.some(role => ['Branch Manager'].includes(role));
      const isOwner = user.role && user.role.some(role => ['Owner'].includes(role));
      const isInSameBranch = payload.branch_id && payload.branch_id === user.branch_id;

      let affectedMonitor = false;

      if (isBranchManager && isInSameBranch) {
        setPendingInventoryRequests(prev => prev.filter(req => normalizePendingId(req.pending_id) !== normalizePendingId(payload.pending_id)));
        affectedMonitor = true;

        if (payload.status === 'approved' && payload.product) {
          setProductsData(prevData => {
            if (payload.action === 'create') {
              const exists = prevData.some(item => item.product_id === payload.product.product_id && item.branch_id === payload.product.branch_id);
              return exists ? prevData : [...prevData, payload.product];
            }

            if (payload.action === 'update') {
              return prevData.map(item => (
                item.product_id === payload.product.product_id && item.branch_id === payload.product.branch_id
                  ? payload.product
                  : item
              ));
            }

            return prevData;
          });
        }

        if (payload.status === 'rejected') {
          const rejectionKey = `reject-${normalizePendingId(payload.pending_id)}`;
          const existingTimer = handledInventoryCleanupRef.current.get(rejectionKey);

          if (handledInventoryActionsRef.current.has(rejectionKey)) {
            handledInventoryActionsRef.current.delete(rejectionKey);
            if (existingTimer) {
              clearTimeout(existingTimer);
              handledInventoryCleanupRef.current.delete(rejectionKey);
            }
          } else {
            if (existingTimer) {
              clearTimeout(existingTimer);
              handledInventoryCleanupRef.current.delete(rejectionKey);
            }

            const message = payload.reason ? `Inventory request rejected: ${payload.reason}` : 'Inventory request was rejected.';
            addToNotificationQueue(message, {
              isLocal: true,
              title: 'Inventory Rejection',
              dedupeKey: rejectionKey
            });
          }
        }
      }

      if (isOwner) {
        setAdminInventoryRequests(prev => {
          if (['approved', 'rejected', 'deleted'].includes(payload.status)) {
            return prev.filter(req => normalizePendingId(req.pending_id) !== normalizePendingId(payload.pending_id));
          }

          if (payload.status === 'pending_admin') {
            return prev.map(req => (
              normalizePendingId(req.pending_id) === normalizePendingId(payload.pending_id)
                ? { ...req, status: 'pending', current_stage: 'admin_review' }
                : req
            ));
          }

          return prev;
        });
        affectedMonitor = true;
      }

      if (affectedMonitor) {
        console.log('📡 Inventory approval updated via WebSocket - triggering refresh', {
          pendingId: payload.pending_id,
          status: payload.status,
          branchId: payload.branch_id,
          userBranchId: user.branch_id,
          isOwner,
          isBranchManager
        });
        setRequestStatusRefreshKey((prev) => prev + 1);
      }
    });

    newSocket.on('user-approval-request', (payload) => {
      if (!payload || !payload.request) return;
      if (!canAccessUserRequestFeed) return;

      const incoming = payload.request;
      const targetId = Number(incoming?.pending_user_id ?? incoming?.user_id);

      if (!Number.isFinite(targetId)) {
        return;
      }

      const resolvedStatusRaw = incoming?.request_status ?? incoming?.status ?? null;
      const resolvedStatus = typeof resolvedStatusRaw === 'string' ? resolvedStatusRaw.toLowerCase() : null;

      setUserCreationRequests((prev) => {
        if (!Array.isArray(prev)) {
          const normalizedStatus = resolvedStatus ?? 'pending';
          return dedupeUserRequestList([{
            ...incoming,
            status: normalizedStatus,
            request_status: normalizedStatus,
            resolution_status: incoming?.resolution_status ?? normalizedStatus
          }]);
        }

        let matched = false;

        const mapped = prev.map((request) => {
          const candidateId = Number(request?.pending_user_id ?? request?.user_id);
          if (Number.isFinite(candidateId) && candidateId === targetId) {
            matched = true;
            const merged = {
              ...request,
              ...incoming
            };

            if (resolvedStatus) {
              merged.status = resolvedStatus;
              merged.request_status = resolvedStatus;
              merged.resolution_status = incoming?.resolution_status ?? resolvedStatus;
            }

            return merged;
          }
          return request;
        });

        if (matched) {
          return dedupeUserRequestList(mapped);
        }

        const normalizedStatus = resolvedStatus ?? 'pending';
        const enriched = {
          ...incoming,
          status: normalizedStatus,
          request_status: normalizedStatus,
          resolution_status: incoming?.resolution_status ?? normalizedStatus
        };

        return dedupeUserRequestList([enriched, ...mapped]);
      });

      setRequestStatusRefreshKey((prev) => prev + 1);
    });

    newSocket.on('user-approval-updated', (payload) => {
      if (!payload) return;
      if (!canAccessUserRequestFeed) return;

      const incoming = payload.request ?? null;
      const targetId = Number(
        payload.pending_user_id
          ?? payload.user_id
          ?? incoming?.pending_user_id
          ?? incoming?.user_id
      );

      if (!Number.isFinite(targetId)) {
        return;
      }

      const statusRaw = payload.status ?? incoming?.request_status ?? incoming?.status ?? null;
      const nextStatus = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : null;

      // Show real-time notification for status changes
      if (nextStatus && nextStatus !== 'pending') {
        const userName = incoming?.full_name ?? incoming?.target_full_name ?? 'User';
        if (nextStatus === 'approved') {
          addToNotificationQueue(`${userName}'s account has been approved`, {
            title: 'Account Approved',
            tone: 'success',
            duration: 3000
          });
        } else if (nextStatus === 'rejected') {
          addToNotificationQueue(`${userName}'s account request was rejected`, {
            title: 'Account Rejected',
            duration: 3000
          });
        } else if (nextStatus === 'cancelled') {
          addToNotificationQueue(`${userName}'s account request was cancelled`, {
            title: 'Request Cancelled',
            duration: 3000
          });
        }
      }
      // If a request was cancelled, remove it from local state immediately so
      // Owners' approval list doesn't show a cancelled request (prevents
      // approving a request that was cancelled by a manager).
      if (nextStatus === 'cancelled') {
        setUserCreationRequests((prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev.filter((request) => {
            const candidateId = Number(request?.pending_user_id ?? request?.user_id);
            return !(Number.isFinite(candidateId) && candidateId === targetId);
          });
        });

        // bump the refresh key so any dialogs depending on it refresh
        setRequestStatusRefreshKey((prev) => prev + 1);
        // No need to continue with the regular merge logic for cancelled
        // events since we've removed the request locally.
        return;
      }
      const resolvedAt = incoming?.request_resolved_at
        ?? incoming?.resolved_at
        ?? payload.resolved_at
        ?? (nextStatus && nextStatus !== 'pending' ? new Date().toISOString() : null);
      const decisionAt = incoming?.request_decision_at ?? resolvedAt;
      const reasonPayload = payload.reason ?? payload.resolution_reason;

      setUserCreationRequests((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) {
          if (!incoming) {
            return prev;
          }

          const normalizedStatus = nextStatus ?? 'pending';
          return dedupeUserRequestList([{
            ...incoming,
            status: normalizedStatus,
            request_status: normalizedStatus,
            resolution_status: incoming?.resolution_status ?? normalizedStatus,
            request_resolved_at: resolvedAt,
            request_decision_at: decisionAt,
            request_rejection_reason: reasonPayload ?? incoming?.request_rejection_reason ?? incoming?.resolution_reason ?? null,
            resolution_reason: reasonPayload ?? incoming?.resolution_reason ?? null
          }]);
        }

        let matched = false;

        const mapped = prev.map((request) => {
          const candidateId = Number(request?.pending_user_id ?? request?.user_id);
          if (Number.isFinite(candidateId) && candidateId === targetId) {
            matched = true;
            const merged = { ...request };

            if (incoming) {
              Object.assign(merged, incoming);
            }

            if (nextStatus) {
              merged.status = nextStatus;
              merged.request_status = nextStatus;
              merged.resolution_status = incoming?.resolution_status ?? nextStatus;
            }

            if (resolvedAt) {
              merged.request_resolved_at = resolvedAt;
            }

            if (decisionAt) {
              merged.request_decision_at = decisionAt;
            }

            if (reasonPayload !== undefined) {
              merged.request_rejection_reason = reasonPayload || null;
              merged.resolution_reason = reasonPayload || null;
            } else if (incoming?.request_rejection_reason || incoming?.resolution_reason) {
              merged.request_rejection_reason = incoming?.request_rejection_reason ?? incoming?.resolution_reason ?? merged.request_rejection_reason ?? null;
              merged.resolution_reason = incoming?.resolution_reason ?? incoming?.request_rejection_reason ?? merged.resolution_reason ?? null;
            }

            return merged;
          }

          return request;
        });

        // If we matched an existing request, return the updated array
        if (matched) {
          return dedupeUserRequestList(mapped);
        }

        // For status updates (approved/rejected), don't add new entries if no match found
        // Only add new entries for new pending requests
        if (nextStatus && nextStatus !== 'pending') {
          return dedupeUserRequestList(mapped);
        }

        // If no match and no incoming data, return original array
        if (!incoming) {
          return dedupeUserRequestList(mapped);
        }

        // Add new pending request
        const normalizedStatus = nextStatus ?? incoming?.resolution_status ?? incoming?.request_status ?? incoming?.status ?? 'pending';

        const enriched = {
          ...incoming,
          status: normalizedStatus,
          request_status: normalizedStatus,
          resolution_status: incoming?.resolution_status ?? normalizedStatus,
          request_resolved_at: resolvedAt,
          request_decision_at: decisionAt,
          request_rejection_reason: reasonPayload ?? incoming?.request_rejection_reason ?? incoming?.resolution_reason ?? null,
          resolution_reason: reasonPayload ?? incoming?.resolution_reason ?? null
        };

        return dedupeUserRequestList([...mapped, enriched]);
      });

      setRequestStatusRefreshKey((prev) => prev + 1);
    });

    // LISTEN FOR PRODUCT VALIDITY UPDATES
    newSocket.on('validity-update', (validityData) => {
      console.log('Product validity update received:', validityData);
      
      // ONLY UPDATE IF THE UPDATE WASN'T MADE BY THE CURRENT USER
      if (user.user_id !== validityData.user_id) {
        // TRIGGER REFRESH FOR PRODUCT VALIDITY PAGE
        // This will be handled by individual components that need validity data
        window.dispatchEvent(new CustomEvent('validity-update', { 
          detail: validityData 
        }));
      }
    });

    // LISTEN FOR PRODUCT HISTORY UPDATES
    newSocket.on('history-update', (historyData) => {
      console.log('Product history update received:', historyData);
      
      // ONLY UPDATE IF THE UPDATE WASN'T MADE BY THE CURRENT USER
      if (user.user_id !== historyData.user_id) {
        // TRIGGER REFRESH FOR PRODUCT HISTORY COMPONENT
        window.dispatchEvent(new CustomEvent('history-update', { 
          detail: historyData 
        }));
      }
    });

    // LISTEN FOR SALES UPDATES
    newSocket.on('sale-update', (saleData) => {
      console.log('Sale update received:', saleData);
      
      // ONLY UPDATE IF THE UPDATE WASN'T MADE BY THE CURRENT USER
      if (user.user_id !== saleData.user_id) {
        if (saleData.action === 'add') {
          // NEW SALE ADDED - UPDATE SALES LIST
          setSaleHeader(prevSales => [saleData.sale, ...prevSales]);
          
          // Don't show "sale created successfully" to other users
          // This WebSocket event just updates the data silently for other users
          
        } else if (saleData.action === 'delivery_status_change') {
          // DELIVERY STATUS CHANGED - UPDATE SALES LIST
          setSaleHeader(prevSales => 
            prevSales.map(sale => 
              sale.sales_information_id === saleData.sale.sales_information_id 
                ? saleData.sale 
                : sale
            )
          );
          
          // UPDATE DELIVERY DATA IF AVAILABLE
          setDeliveryData(prevDelivery => 
            prevDelivery.map(delivery => 
              delivery.sales_information_id === saleData.sale.sales_information_id
                ? { 
                    ...delivery, 
                    is_delivered: saleData.new_status.is_delivered,
                    is_pending: saleData.new_status.is_pending 
                  }
                : delivery
            )
          );
          
          // Don't show delivery status changes to other users as success notifications
          // This WebSocket event just updates the data silently for other users
          
        } else if (saleData.action === 'add_delivery') {
          // NEW DELIVERY ADDED - UPDATE DELIVERY LIST
          setDeliveryData(prevDelivery => [saleData.delivery, ...prevDelivery]);
          
          // Don't show delivery creation to other users as success notifications
          // This WebSocket event just updates the data silently for other users
          
        } else if (saleData.action === 'delivery_added') {
          // DELIVERY ADDED TO EXISTING SALE - UPDATE SALES LIST
          setSaleHeader(prevSales => 
            prevSales.map(sale => 
              sale.sales_information_id === saleData.sale.sales_information_id 
                ? saleData.sale 
                : sale
            )
          );
          
          // Don't show delivery additions to other users as success notifications
          // This WebSocket event just updates the data silently for other users
        }
      }
    });

    // LISTEN FOR USER MANAGEMENT UPDATES
    newSocket.on('user-update', (userData) => {
      console.log('User management update received:', userData);
      
      if (userData.action === 'add') {
        // NEW USER ADDED - UPDATE USERS LIST
        setUsers(prevUsers => {
          const filtered = prevUsers.filter(existing => existing.user_id !== userData.user.user_id);
          return [userData.user, ...filtered];
        });
        
        // Don't show "user added successfully" to other users
        // This WebSocket event just updates the data silently for other users
        
      } else if (userData.action === 'update') {
        // USER UPDATED - CHECK IF CURRENT USER WAS DISABLED
        if (user && userData.user.user_id === user.user_id && userData.user.is_disabled && !showAccountDisabledPopup) {
          console.log('Current user was disabled, showing popup');
          setAccountStatusType('disabled');
          setShowAccountDisabledPopup(true);
        }
        
        // UPDATE USERS LIST
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.user_id === userData.user.user_id 
              ? userData.user 
              : user
          )
        );
        
        // Don't show "user updated successfully" to other users
        // This WebSocket event just updates the data silently for other users
        
      } else if (userData.action === 'delete') {
        // CHECK IF CURRENT USER WAS DELETED
        if (user && userData.user_id === user.user_id && !showAccountDisabledPopup) {
          console.log('Current user was deleted, showing popup');
          setAccountStatusType('deleted');
          setShowAccountDisabledPopup(true);
        }
        
        // USER DELETED - REMOVE FROM USERS LIST
        setUsers(prevUsers => 
          prevUsers.filter(user => user.user_id !== userData.user_id)
        );
        
        // Also remove any pending user-creation request that corresponds to
        // this deleted/cancelled user so it doesn't remain in the Owner
        // Approvals list. Some server paths emit a `user-update` with
        // action:'delete' for cancellations (reason:'cancelled'), so we
        // defensively remove matching pending requests here.
        setUserCreationRequests((prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev.filter((request) => {
            const candidateId = Number(request?.pending_user_id ?? request?.user_id);
            return !(Number.isFinite(candidateId) && Number(candidateId) === Number(userData.user_id));
          });
        });

        // Bump the refresh key so any open dialogs or monitors refresh
        // their data sources.
        setRequestStatusRefreshKey((prev) => prev + 1);

        // Don't show "user deleted successfully" to other users
        // This WebSocket event just updates the data silently for other users
      }
    });

    // LISTEN FOR USER STATUS UPDATES (LOGIN/LOGOUT)
    newSocket.on('user-status-update', (statusData) => {
      console.log('User status update received:', statusData);
      
      // UPDATE USER STATUS IN THE USERS LIST
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.user_id === statusData.user_id 
            ? { 
                ...user, 
                is_active: statusData.is_active,
                last_login: statusData.last_login || user.last_login
              } 
            : user
        )
      );
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
      toast.dismiss();
    };
  }, [user, addToNotificationQueue, canAccessUserRequestFeed]);



  //DISPLAY THE INVENTORY TABLE
  const fetchProductsData = useCallback(async () => {
    if (!user) {
      setProductsData([]);
      return;
    }

    try {
      setInventoryLoading(true);
      const endpoint = isOwner || isBranchManager
        ? '/api/items/'
        : `/api/items?branch_id=${user.branch_id}`;
      const response = await api.get(endpoint);
      setProductsData(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log(error.message);
    } finally {
      setInventoryLoading(false);
    }
  }, [user, isOwner, isBranchManager]);


  const fetchPendingInventoryRequests = useCallback(async () => {
    if (!user || !isBranchManager) {
      setPendingInventoryRequests([]);
      return;
    }

    try {
      setPendingInventoryLoading(true);
      const response = await api.get(`/api/items/pending?branch_id=${user.branch_id}`);
      setPendingInventoryRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching pending inventory requests:', error);
    } finally {
      setPendingInventoryLoading(false);
    }
  }, [user, isBranchManager]);


  const fetchAdminPendingInventoryRequests = useCallback(async () => {
    if (!user || !isOwner) {
      setAdminInventoryRequests([]);
      return;
    }

    try {
      setAdminInventoryLoading(true);
      const response = await api.get(`/api/items/pending?review_level=admin`);
      const requests = Array.isArray(response.data) ? response.data : [];
      setAdminInventoryRequests(requests);
    } catch (error) {
      console.error('Error fetching owner inventory approvals:', error);
    } finally {
      setAdminInventoryLoading(false);
    }
  }, [user, isOwner]);


  const fetchUserCreationRequests = useCallback(async () => {
    if (!user || !canAccessUserRequestFeed) {
      setUserCreationRequests([]);
      return;
    }

    try {
      setUserCreationLoading(true);
      const response = await api.get('/api/users/pending');
      console.log(response)
  const payload = response.data ?? [];
  const requests = Array.isArray(payload?.requests) ? payload.requests : (Array.isArray(payload) ? payload : []);
  setUserCreationRequests(dedupeUserRequestList(requests));
    } catch (error) {
      console.error('Error fetching user creation requests:', error);
    } finally {
      setUserCreationLoading(false);
    }
  }, [user, canAccessUserRequestFeed]);


  const handleApprovePendingInventory = async (pendingId) => {
    if (!user) return;

    try {
      const response = await api.patch(`/api/items/pending/${pendingId}/approve`, {
        approver_id: user.user_id
      });

      if (response.data?.next_stage === 'admin_review') {
        setPendingInventoryRequests(prev => prev.filter(request => request.pending_id !== pendingId));
        addToNotificationQueue('Inventory request forwarded to the owner for final approval.', {
          isLocal: true,
          title: 'Approval for Admin'
        });
        setRequestStatusRefreshKey((prev) => prev + 1);
        return;
      }

      if (response.data?.product) {
        const { product, action } = response.data;

        if (action === 'create') {
          setProductsData(prevData => {
            const exists = prevData.some(item => item.product_id === product.product_id && item.branch_id === product.branch_id);
            return exists ? prevData : [...prevData, product];
          });
        } else if (action === 'update') {
          setProductsData(prevData => prevData.map(item => (
            item.product_id === product.product_id && item.branch_id === product.branch_id ? product : item
          )));
        }
      }

  setPendingInventoryRequests(prev => prev.filter(request => normalizePendingId(request.pending_id) !== normalizePendingId(pendingId)));
      addToNotificationQueue('Inventory request approved and applied.', true);
      await fetchProductsData();
      setRequestStatusRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error approving inventory request:', error);
    }
  };


  const handleOwnerApprovePendingInventory = async (pendingId) => {
    if (!user) return;

    const adminIdentifier = user.admin_id ?? user.user_id;
    if (!adminIdentifier) return;

    try {
      await api.patch(`/api/items/pending/${pendingId}/approve`, {
        actor_type: 'admin',
        admin_id: adminIdentifier
      });

  setAdminInventoryRequests(prev => prev.filter(request => normalizePendingId(request.pending_id) !== normalizePendingId(pendingId)));
      addToNotificationQueue('Inventory request approved.', true);
      await fetchProductsData();
      await fetchAdminPendingInventoryRequests();
      setRequestStatusRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error approving inventory request as owner:', error);
    }
  };


  const handleRejectPendingInventory = async (pendingId, reason = '') => {
    if (!user) return;

    const normalizedId = normalizePendingId(pendingId);
    const rejectionKey = `reject-${normalizedId}`;
    handledInventoryActionsRef.current.add(rejectionKey);

    try {
      await api.patch(`/api/items/pending/${pendingId}/reject`, {
        approver_id: user.user_id,
        reason
      });

  setPendingInventoryRequests(prev => prev.filter(request => normalizePendingId(request.pending_id) !== normalizePendingId(pendingId)));
      const cleanupTimer = setTimeout(() => {
        handledInventoryActionsRef.current.delete(rejectionKey);
        handledInventoryCleanupRef.current.delete(rejectionKey);
      }, 8000);
      handledInventoryCleanupRef.current.set(rejectionKey, cleanupTimer);

      addToNotificationQueue('Inventory request rejected.', {
        isLocal: true,
        title: 'Inventory Rejection',
        dedupeKey: rejectionKey
      });
      setRequestStatusRefreshKey((prev) => prev + 1);
    } catch (error) {
      handledInventoryActionsRef.current.delete(rejectionKey);
      const existingTimer = handledInventoryCleanupRef.current.get(rejectionKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        handledInventoryCleanupRef.current.delete(rejectionKey);
      }
      console.error('Error rejecting inventory request:', error);
    }
  };


  const handleOwnerRejectPendingInventory = async (pendingId, reason = '') => {
    if (!user) return;

    const adminIdentifier = user.admin_id ?? user.user_id;
    if (!adminIdentifier) return;

    try {
      await api.patch(`/api/items/pending/${pendingId}/reject`, {
        actor_type: 'admin',
        admin_id: adminIdentifier,
        reason
      });

  setAdminInventoryRequests(prev => prev.filter(request => normalizePendingId(request.pending_id) !== normalizePendingId(pendingId)));
      addToNotificationQueue('Inventory request rejected.', true);
      await fetchAdminPendingInventoryRequests();
      setRequestStatusRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error rejecting inventory request as owner:', error);
    }
  };


  const handleCancelInventoryRequest = useCallback(async (pendingId, reason = '') => {
    if (!user) return;

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    const payload = trimmedReason ? { reason: trimmedReason } : {};

    try {
      await api.patch(`/api/items/pending/${pendingId}/cancel`, payload);

      setPendingInventoryRequests((prev) =>
        prev.filter((request) => normalizePendingId(request.pending_id) !== normalizePendingId(pendingId))
      );

      setAdminInventoryRequests((prev) =>
        prev.filter((request) => normalizePendingId(request.pending_id) !== normalizePendingId(pendingId))
      );

      setRequestStatusRefreshKey((prev) => prev + 1);

      addToNotificationQueue('Inventory request cancelled.', {
        isLocal: true,
        title: 'Request cancelled'
      });

      await fetchPendingInventoryRequests();
    } catch (error) {
      console.error('Error cancelling inventory request:', error);
      throw error;
    }
  }, [user, addToNotificationQueue, fetchPendingInventoryRequests]);

  const handleCancelUserCreationRequest = useCallback(async (pendingUserId, reason = '') => {
    if (!user) return;

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    const payload = trimmedReason ? { reason: trimmedReason } : {};
    const targetId = Number(pendingUserId);

    try {
      await api.patch(`/api/users/${pendingUserId}/cancel`, payload);

      const decisionTimestamp = new Date().toISOString();

      setUserCreationRequests((prev) => {
        if (!Array.isArray(prev)) return prev;

        let changed = false;

        const mapped = prev.map((request) => {
          const candidateId = Number(request?.pending_user_id ?? request?.user_id);
          if (Number.isFinite(targetId) && Number.isFinite(candidateId) && candidateId === targetId) {
            changed = true;
            return {
              ...request,
              status: 'cancelled',
              request_status: 'cancelled',
              resolution_status: 'cancelled',
              request_decision_at: decisionTimestamp,
              request_resolved_at: decisionTimestamp,
              request_approved_at: request?.request_approved_at ?? null,
              request_rejection_reason: trimmedReason || request?.request_rejection_reason || null,
              resolution_reason: trimmedReason || request?.resolution_reason || null
            };
          }
          return request;
        });

        return changed ? dedupeUserRequestList(mapped) : prev;
      });

      setRequestStatusRefreshKey((prev) => prev + 1);

      addToNotificationQueue('User request cancelled.', {
        isLocal: true,
        title: 'Request cancelled'
      });

      // Don't fetch - let WebSocket handle the update to avoid conflicts
      // await fetchUserCreationRequests();
    } catch (error) {
      console.error('Error cancelling user request:', error);
      throw error;
    }
  }, [user, addToNotificationQueue]);

  //RENDERS THE TABLE
  useEffect(() =>{
    fetchProductsData();
  }, [fetchProductsData]);


  useEffect(() => {
    fetchPendingInventoryRequests();
  }, [fetchPendingInventoryRequests]);

  useEffect(() => {
    fetchAdminPendingInventoryRequests();
  }, [fetchAdminPendingInventoryRequests]);

  // Initial fetch only - WebSocket handles all subsequent updates in real-time
  useEffect(() => {
    fetchUserCreationRequests();
  }, [fetchUserCreationRequests]);


  //HANDLES OPENING ADD OR EDIT MODAL
  const handleOpen = (mode, items) =>{
    setItemData(items);
    setIsModalOpen(true);
    setModalMode(mode);
  };



  //ADD OR EDIT DATA TO THE DATABASE
  const handleSubmit = async (newItem) =>{
    if (modalMode === 'add'){
      try {
        const response = await api.post(`/api/items/`, newItem);
        if (response.status === 202 || response.data?.status === 'pending') {
          addToNotificationQueue('Inventory request submitted for branch manager approval.', true);
          await fetchPendingInventoryRequests();
          setRequestStatusRefreshKey((prev) => prev + 1);
        } else {
          const addedProduct = response.data?.product || response.data;
          setProductsData((prevData) => [...prevData, addedProduct]);
          console.log('Item Added', addedProduct);

          const message = `${addedProduct.product_name} has been successfully added to the Inventory!`;
          addToNotificationQueue(message, true); // true = local notification for the person who made the change 
        }
        
      } catch (error) {
        
         console.error('Error adding item:', error);

         const serverMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to add item';
         const status = error?.response?.status;

         
         if (status === 409 || /product id already/i.test(serverMessage)) {
           setProductExistsMessage(serverMessage || 'Product already exists in the inventory.');
           setShowProductExistsDialog(true);
         } 
      }

    } else{
      try {
        console.log(itemData)
        const response = await api.put(`/api/items/${itemData.product_id}`, newItem);
        if (response.status === 202 || response.data?.status === 'pending') {
          addToNotificationQueue('Inventory update sent for branch manager approval.', true);
          await fetchPendingInventoryRequests();
          setRequestStatusRefreshKey((prev) => prev + 1);
        } else {
          const updatedProduct = response.data?.product || response.data;
          setProductsData((prevData) => 
            prevData.map((item) => (item.product_id === itemData.product_id && item.branch_id === itemData.branch_id ? updatedProduct : item))
          );
          console.log('Item Updated', updatedProduct);

          const message = `${updatedProduct.product_name} has been successfully updated in the Inventory!`;
          addToNotificationQueue(message, true); 
        }
        
      } catch (error) {
         console.error('Error adding Item', error);
      }
    }
  };



  const fetchSaleRecords = useCallback(async () => {
    if (!user || !isSalesAssociate) {
      setSaleHeader([]);
      return;
    }

    try {
      setSalesLoading(true);
      const saleHeader = await api.get(`/api/sale?branch_id=${user.branch_id}`);
      setSaleHeader(Array.isArray(saleHeader.data) ? saleHeader.data : []);
    } catch (error) {
      console.log(error);
    } finally {
      setSalesLoading(false);
    }
  }, [user, isSalesAssociate]);



  const getDeliveries = useCallback(async () => {
    if (!user || !isSalesAssociate) {
      setDeliveryData([]);
      return;
    }

    try {
      setDeliveryLoading(true);
      const data = await api.get(`/api/delivery?branch_id=${user.branch_id}`);
      setDeliveryData(Array.isArray(data.data) ? data.data : []);

    } catch (error) {
      console.log(error);
    } finally {
      setDeliveryLoading(false);
    }
    

  }, [user, isSalesAssociate]);


  useEffect(() =>{
    fetchSaleRecords();
    getDeliveries();
  },[fetchSaleRecords, getDeliveries]);



  //FOR NOTIFICATION DATA
  const getTime = useCallback(async () =>{
    // Prevent concurrent fetches while mark-as-read is in progress
    if (notificationFetchLockRef.current) {
      return;
    }

    try {
      if (!user || userRoles.length === 0) {
        setNotify([]);
        return;
      }

      notificationFetchLockRef.current = true;

      const params = new URLSearchParams();

      userRoles.forEach((role) => {
        if (role) {
          params.append('role', role);
        }
      });

      if (isOwner) {
        params.append('user_type', 'admin');
        if (user.admin_id) {
          params.append('admin_id', user.admin_id);
        }
      } else {
        if (!user.branch_id || !user.user_id || !user.hire_date) {
          notificationFetchLockRef.current = false;
          return;
        }

        params.append('branch_id', user.branch_id);
        params.append('user_id', user.user_id);
        params.append('hire_date', user.hire_date);
      }

      const queryString = params.toString();
      const endpoint = `notifications${queryString ? `?${queryString}` : ''}`;
      const time = await notificationApi.get(endpoint);
      const fetchedNotifications = Array.isArray(time.data) ? time.data : [];
      setNotify(dedupeNotifications(fetchedNotifications));
    } catch (error) {
      console.log(error.message);
    } finally {
      // Add small delay before allowing next fetch to ensure DB writes complete
      setTimeout(() => {
        notificationFetchLockRef.current = false;
      }, 100);
    }
  }, [user, userRoles, isOwner]);



  //BEST FOR NOW
  useEffect(() => {

    if (!user || !shouldFetchNotifications) {
      setNotify([]);
      return;
    }

    // FETCH NOTIFICATIONS FOR THE CURRENT USER
    getTime();

    const intervalId = setInterval(() => {
      getTime();
    }, 60000);

    return () => clearInterval(intervalId);

  }, [user, shouldFetchNotifications, getTime]);



  //USER CREATION MODAL LOGIC
  const handleUserModalOpen = (mode) =>{
    setOpenUserModal(true);
    setModalMode(mode);
  }



  //FETCHING THE BRANCH GLOBALLY
  const fetchBranch = useCallback(async() =>{
    if (!user) {
        setBranches([]);
        return;
    }
    try {
        const branch = await api.get(`/api/branches`);
        setBranches(Array.isArray(branch.data) ? branch.data : []);
    } catch (error) {
        console.log(error)
    }
  }, [user]);


  //FOR ADDING USER
  const fetchUsersinfo = useCallback(async () =>{

    if (!user || (!isBranchManager && !isOwner)) {
      setUsers([]);
      return;
    }

    try {
       setUsersLoading(true);

       let response;
       if (isBranchManager) {
          response = await api.get(`/api/users?branch_id=${user.branch_id}&user_id=${user.user_id}`);
       } else {
          response = await api.get(`/api/users`);
       }

       setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log(error);
    } finally {
      setUsersLoading(false);
    }

  }, [user, isBranchManager, isOwner]);


  //IMPROVE THIS IN THE FUTURE(IMPORTANT)
  useEffect(() => {
    fetchUsersinfo();
  }, [fetchUsersinfo]);

  useEffect(() => {
    fetchBranch();
  }, [fetchBranch]);



  const deleteUser = async(userID) => {
    try {
      setDeleteLoading(true);
      await api.delete(`/api/delete_account/${userID}`);
      // DON'T MANUALLY REFRESH - LET WEBSOCKET HANDLE REAL-TIME UPDATES
    } catch (error) {
      console.error('Error deleting user:', error);
      const serverMessage = error?.response?.data?.message;
      const status = error?.response?.status;
      const fallbackMessage = 'Unable to delete this user account right now. Please try again later.';

      if (status === 409) {
        const normalizedId = Number(userID);
        const blockingUser = Array.isArray(users) ? users.find(record => Number(record.user_id) === normalizedId) : null;
        const derivedName = blockingUser?.full_name
          || [blockingUser?.first_name, blockingUser?.last_name].filter(Boolean).join(' ').trim()
          || 'This user';

        const resolveCreatedById = (record) => {
          if (!record) return null;
          const candidates = [
            record.created_by,
            record?.payload?.created_by,
            record?.payload?.createdBy,
            record?.payload?.productData?.created_by,
            record?.payload?.productData?.createdBy
          ];

          for (const candidate of candidates) {
            const parsed = Number(candidate);
            if (Number.isFinite(parsed)) {
              return parsed;
            }
          }
          return null;
        };

        const managerPendingForUser = Array.isArray(pendingInventoryRequests)
          ? pendingInventoryRequests.filter(req => (
              String(req?.status ?? '').toLowerCase() === 'pending' && resolveCreatedById(req) === normalizedId
            ))
          : [];

        const ownerPendingForUser = Array.isArray(adminInventoryRequests)
          ? adminInventoryRequests.filter(req => (
              String(req?.status ?? '').toLowerCase() === 'pending' && resolveCreatedById(req) === normalizedId
            ))
          : [];

        const hasManagerStage = managerPendingForUser.length > 0;
        const hasOwnerStage = ownerPendingForUser.length > 0;

        const pendingUserApprovals = Array.isArray(pendingUserRequests)
          ? pendingUserRequests.filter(req => {
              if (!req || String(req.status ?? '').toLowerCase() !== 'pending') {
                return false;
              }

              const createdByMatch = Number(req?.created_by_id) === normalizedId;
              const nameFallback = normalizeComparableName(req?.full_name || req?.created_by_name || '');
              const targetNameComparable = normalizeComparableName(derivedName);

              return createdByMatch || (
                !!nameFallback && !!targetNameComparable && nameFallback === targetNameComparable
              );
            })
          : [];

        const userPendingIds = pendingUserApprovals
          .map(req => Number(req?.user_id))
          .filter(id => Number.isFinite(id));

        const blockingRoles = Array.isArray(blockingUser?.role)
          ? blockingUser.role
          : blockingUser?.role
            ? [blockingUser.role]
            : [];

        const isTargetBranchManager = blockingRoles.some(role => normalizeComparableName(role).includes('branch manager'));
        const ownerHasUserApprovals = isOwner && isTargetBranchManager && pendingUserApprovals.length > 0;

        let showReviewButton = false;
        let highlightType = null;
        let highlightFocus = null;
        let roleHint = '';
        let reviewLabel = 'Review requests';
        let pendingDescription = 'still has pending requests awaiting a decision.';
        let messageText = serverMessage || 'Cannot delete this user while pending requests remain. Please resolve them first.';
        let targetPendingIds = [];

        if (ownerHasUserApprovals) {
          showReviewButton = true;
          highlightType = 'owner-approvals';
          highlightFocus = 'user';
          reviewLabel = 'Review account requests';
          pendingDescription = 'still has user account requests waiting for your approval.';
          roleHint = 'Open the Approval Center to review and resolve their account requests.';
          messageText = serverMessage || 'Resolve their outstanding account requests before deleting this branch manager.';
          targetPendingIds = userPendingIds;
        } else {
          const inventoryPendingIds = [];
          if (hasManagerStage) {
            inventoryPendingIds.push(
              ...managerPendingForUser
                .map(req => Number(req?.pending_id))
                .filter(id => Number.isFinite(id))
            );
          }
          if (hasOwnerStage) {
            inventoryPendingIds.push(
              ...ownerPendingForUser
                .map(req => Number(req?.pending_id))
                .filter(id => Number.isFinite(id))
            );
          }

          if (isBranchManager && hasManagerStage) {
            showReviewButton = true;
            highlightType = 'branch-pending';
            highlightFocus = 'inventory';
            roleHint = 'Open your pending inventory requests to approve or reject their submissions.';
          } else if (isOwner && hasOwnerStage) {
            showReviewButton = true;
            highlightType = 'owner-approvals';
            highlightFocus = 'inventory';
            roleHint = 'Navigate to the Approval Center to finish reviewing their pending inventory requests.';
          } else if (isBranchManager) {
            roleHint = 'These requests are already with the owner for final approval. Coordinate with them before deleting this account.';
          } else if (isOwner && hasManagerStage) {
            roleHint = 'These requests are still waiting for branch manager review. Ask them to resolve the submissions before deleting this account.';
          } else if (isOwner) {
            roleHint = 'Pending requests must be resolved before you can delete this account.';
          }

          if (hasManagerStage || hasOwnerStage) {
            pendingDescription = 'still has inventory requests awaiting a decision.';
          }

          targetPendingIds = inventoryPendingIds;
        }

        setDeleteGuardDialog({
          ...createDeleteGuardState(),
          open: true,
          message: messageText,
          targetUserId: normalizedId,
          targetUserName: derivedName,
          roleHint,
          userPendingDescription: pendingDescription,
          showReviewButton,
          reviewLabel,
          highlightType,
          highlightFocus,
          targetPendingIds
        });
        return;

      }

      toast.error(serverMessage || fallbackMessage);
    } finally {
      setDeleteLoading(false);
    }
  };



  //DISABLE AND ENABLE ACCOUNT
  const disableEnableAccount = async(userToDisable) =>{
    
    //RE-ENABLE ACCOUNT
    if (!user || !user.role || !user.role.some(role => ['Owner', 'Branch Manager'].includes(role))) return;

    if (userToDisable.is_disabled){
        
        await api.put(`/api/disable/${userToDisable.user_id}`, {isDisabled: false})
        // DON'T MANUALLY UPDATE - LET WEBSOCKET HANDLE REAL-TIME UPDATES

    } else {

        await api.put(`/api/disable/${userToDisable.user_id}`, {isDisabled: true})
        // DON'T MANUALLY UPDATE - LET WEBSOCKET HANDLE REAL-TIME UPDATES

    }

  }


  //DELIVERY EDIT
  const deliveryEdit = (mode, data) =>{
    setModalMode(mode);
    setDeliveryEdit(data);
    setAddDelivery(true);

  };


  const approvePendingAccount = async (userId) => {
    if (!user || !user.role || !user.role.some(role => ['Owner'].includes(role))) return;

    try {
      await api.patch(`/api/users/${userId}/approval`, {
        approver_id: user.admin_id ?? null,
        approverName: user.full_name ?? null,
        approver_roles: user.role || []
      });
      // Fetch latest data to ensure UI is in sync (WebSocket updates may have timing delays)
      await fetchUserCreationRequests();
      setRequestStatusRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error approving user:', error);
      throw error;
    }
  };


  const rejectPendingAccount = async (userId, reason = '') => {
    if (!user || !user.role || !user.role.some(role => role === 'Owner')) return;

    try {
      // Update local state immediately for better UX
      const targetId = Number(userId);
      const decisionTimestamp = new Date().toISOString();

      setUserCreationRequests((prev) => {
        if (!Array.isArray(prev)) return prev;

        let changed = false;

        const mapped = prev.map((request) => {
          const candidateId = Number(request?.pending_user_id ?? request?.user_id);
          if (Number.isFinite(targetId) && Number.isFinite(candidateId) && candidateId === targetId) {
            changed = true;
            return {
              ...request,
              status: 'rejected',
              request_status: 'rejected',
              resolution_status: 'rejected',
              request_decision_at: decisionTimestamp,
              request_resolved_at: decisionTimestamp,
              request_approved_at: request?.request_approved_at ?? null,
              request_rejection_reason: reason || request?.request_rejection_reason || null,
              resolution_reason: reason || request?.resolution_reason || null
            };
          }
          return request;
        });

        return changed ? dedupeUserRequestList(mapped) : prev;
      });

      await api.patch(`/api/users/${userId}/rejection`, {
        admin_id: user.admin_id ?? null,
        approver_roles: user.role || [],
        reason
      });

      addToNotificationQueue('User account request rejected.', {
        isLocal: true,
        title: 'Account rejected'
      });

      // WebSocket will update again if needed, but local update provides immediate feedback
      setRequestStatusRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error rejecting user:', error);
      throw error;
    }
  };


  //CANCULATE UNREAD NOTIFICATION
  const unreadCount = notify.filter(notification => !notification.is_read).length;



  return (

    <>

      {deleteLoading && (
        <FormLoading message="Deleting user account..." />
      )}

      {/*ACCOUNT DISABLED/DELETED POPUP*/}
      <AccountDisabledPopUp
        user={user}
        open={showAccountDisabledPopup}
        type={accountStatusType}
        onAction={handleAccountStatusAction}
        onClose={handleClosePopup}
      />

      <Toaster
        position="top-right"
        gutter={14}
        toastOptions={{
          duration: 5200,
          style: {
            background: '#ffffff',
            color: '#14532d',
            borderRadius: '1rem',
            padding: '1rem 1.5rem',
            fontSize: '0.95rem',
            lineHeight: 1.4,
            minWidth: '340px',
            border: '1px solid rgba(187, 247, 208, 0.9)',
            boxShadow: '0 20px 45px rgba(22, 101, 52, 0.16)'
          },
          success: {
            iconTheme: {
              primary: '#16a34a',
              secondary: '#f0fdf4'
            },
            style: {
              background: '#ffffff',
              color: '#14532d',
              border: '1px solid #86efac'
            }
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#fef2f2'
            },
            style: {
              background: '#ffffff',
              color: '#7f1d1d',
              border: '1px solid #fecaca'
            }
          }
        }}
      />

      {/*PRODUCT EXISTS DIALOG*/}
      <ProductExistsDialog
        isOpen={showProductExistsDialog}
        message={productExistsMessage}
        onClose={() => setShowProductExistsDialog(false)}
      />

      <PendingRequestsGuardDialog
        open={deleteGuardDialog.open}
        message={deleteGuardDialog.message}
        userName={deleteGuardDialog.targetUserName}
        roleHint={deleteGuardDialog.roleHint}
        userPendingDescription={deleteGuardDialog.userPendingDescription}
        showReviewButton={deleteGuardDialog.showReviewButton}
        reviewLabel={deleteGuardDialog.reviewLabel}
        onCancel={handleCloseDeleteGuardDialog}
        onReview={handleReviewDeleteGuard}
      />

      {/*COMPONENTS*/}
      <AddSaleModalForm
        openSaleModal={openSaleModal}
        productsData={productsData}
        setOpenSaleModal={setOpenSaleModal}
        setSaleHeader={setSaleHeader}
        fetchProductsData={fetchProductsData}
      
      />


      <AddDeliveryInformation 
        openAddDelivery={openAddDelivery}
        mode={modalMode}
        saleHeader={saleHeader}
        deliveryData={deliveryData}
        deliveryEditData={deliveryEditData}
        getDeliveries={getDeliveries}
        fetchProductsData={fetchProductsData}
        onClose={() => {setAddDelivery(false); setModalMode('add')}}  

      />


      <Category 
         isCategoryOpen={isCategoryOpen} 
         onClose={() => setIsCategory(false)}  
         listCategories={listCategories} 
         setListCategories={setListCategories} 
         fetchProductsData={fetchProductsData}
         sanitizeInput={sanitizeInput}
         
      />


      <UserModalForm 
        openUserModal={openUserModal}
        userDetailes={userDetailes}
        mode={modalMode}
        branches={branches}
        onClose={() => setOpenUserModal(false)}
        fetchUsersinfo ={fetchUsersinfo}
        setUserDetailes={setUserDetailes}
        setOpenUsers={setOpenUsers}
      
      />


      <ModalForm 
        isModalOpen={isModalOpen} 
        OnSubmit={handleSubmit} 
        mode={modalMode} 
        onClose={() => setIsModalOpen(false)} 
        itemData={itemData}  
        listCategories={listCategories}
        sanitizeInput={sanitizeInput}
         
      />

      <UserInformation
        openUsers={openUsers}
        userDetailes={userDetailes}
        onClose={() => setOpenUsers(false)} 
        handleUserModalOpen={handleUserModalOpen}
        deleteUser={deleteUser}
        deleteLoading={deleteLoading}
        
      />


      <ProductTransactionHistory
        isProductTransactOpen={isProductTransactOpen}
        sanitizeInput={sanitizeInput}
        onClose={handleHistoryModalClose}
        listCategories={listCategories}
        focusEntry={historyFocus}
        onClearFocus={() => setHistoryFocus(null)}

      />


      <Notification 
        openNotif={openNotif}
        notify={notify}
        unreadCount={unreadCount}
        setNotify={setNotify}
        onClose={() => setOpenNotif(false)}
        onNotificationNavigate={handleNotificationNavigation}
      />

      <InventoryRequestMonitorDialog
        open={isRequestMonitorOpen && canOpenRequestMonitor}
        onClose={() => setIsRequestMonitorOpen(false)}
        user={user}
        branches={branches}
        userRequests={userRequestHistory}
        userRequestsLoading={userCreationLoading}
        refreshToken={requestStatusRefreshKey}
        onCancelInventoryRequest={canOpenRequestMonitor ? handleCancelInventoryRequest : undefined}
        onCancelUserRequest={canOpenRequestMonitor ? handleCancelUserCreationRequest : undefined}
      />

  

      {/*PAGES */}
      <Routes>

        <Route path="/" exact element={
          <Login/>
        }/>

        <Route path="/reset-password" element={
          <ResetPassword />
        }/>

        
        {/*INVENTORY PAGE*/}
  <Route element={<RouteProtection>  <PageLayout setOpenNotif={handleNotificationPanelOpen} unreadCount={unreadCount} onOpenRequestMonitor={handleRequestMonitorOpen}/>  </RouteProtection>}>
          <Route path="/inventory" exact element={ 
              <RouteProtection allowedRoles={['Owner', 'Inventory Staff', 'Branch Manager']}>

                  <ProductInventory 
                    setIsCategory={setIsCategory} 
                    handleOpen={handleOpen} 
                    setProductsData={setProductsData} 
                    productsData={productsData}
                    setIsProductTransactOpen={setIsProductTransactOpen}
                    sanitizeInput={sanitizeInput}
                    listCategories={listCategories}
                    branches={branches}
                    invetoryLoading={invetoryLoading}
                    pendingRequests={pendingInventoryRequests}
                    pendingRequestsLoading={pendingInventoryLoading}
                    approvePendingRequest={handleApprovePendingInventory}
                    rejectPendingRequest={handleRejectPendingInventory}
                    refreshPendingRequests={fetchPendingInventoryRequests}
                    highlightPendingDirective={highlightDirective?.type === 'branch-pending' ? highlightDirective : null}
                    onHighlightConsumed={handleHighlightConsumed}

                  />

              </RouteProtection>
        
          }/>
         

          {/*PRODUCT VALIDITY/SHELF LIFE PAGE*/}
          <Route path="/product_validity" exact element={
            <RouteProtection allowedRoles={['Inventory Staff', 'Branch Manager']} >

              <ProductValidity 
                sanitizeInput={sanitizeInput}
                productValidityList={productValidityList}
                setProductValidityList={setProductValidityList}
                focusEntry={validityFocus}
                onClearFocus={() => setValidityFocus(null)}
              
              />

            </RouteProtection>
            
            
          }/>


          {/*DASHBOARD PAGE*/}
          <Route path={"/dashboard"} exact element={
            <RouteProtection allowedRoles={['Owner','Branch Manager']} >

               <Dashboard/>


            </RouteProtection>
            
          }/>



          {/*BRANCHES PAGE*/}
          <Route path="/branches" exact element={ 
              <RouteProtection allowedRoles={['Owner']}>

                  <BranchAnalyticsCards/>

              </RouteProtection>
        
          }/>
          <Route path="/branch-analytics/:branchId" exact element={
            <RouteProtection allowedRoles={['Owner']}>
              <BranchKPI />
            </RouteProtection>
          } />


          {/*USER MANAGEMENT PAGE*/}
          <Route path="/user_management" exact element={ 
              <RouteProtection allowedRoles={['Owner', 'Branch Manager']}>

                  <UserManagement
                    handleUserModalOpen={handleUserModalOpen}
                    setOpenUsers={setOpenUsers}
                    setUserDetailes={setUserDetailes}
                    sanitizeInput={sanitizeInput}
                    disableEnableAccount={disableEnableAccount}
                    users={users}
                    user={user}
                    usersLoading={usersLoading}
                  
                  />

              </RouteProtection>
        
          }/>


          {/*APPROVAL CENTER*/}
          <Route path="/approvals" exact element={
            <RouteProtection allowedRoles={['Owner']}>

              <Approvals
                userRequests={pendingUserRequests}
                userRequestsLoading={userCreationLoading}
                approvePendingAccount={approvePendingAccount}
                rejectPendingAccount={rejectPendingAccount}
                sanitizeInput={sanitizeInput}
                inventoryRequests={adminInventoryRequests}
                inventoryRequestsLoading={adminInventoryLoading}
                approveInventoryRequest={handleOwnerApprovePendingInventory}
                rejectInventoryRequest={handleOwnerRejectPendingInventory}
                refreshInventoryRequests={fetchAdminPendingInventoryRequests}
                refreshUserRequests={fetchUserCreationRequests}
                onOpenRequestMonitor={handleRequestMonitorOpen}
                highlightDirective={highlightDirective?.type === 'owner-approvals' ? highlightDirective : null}
                onHighlightConsumed={handleHighlightConsumed}
              />

            </RouteProtection>

          }/>


          {/*SALES TRANSACTION PAGE*/}
          <Route path="/sales" exact element={ 
              <RouteProtection allowedRoles={['Sales Associate']}>

                  <Sales
                    saleHeader={saleHeader}
                    setOpenSaleModal={setOpenSaleModal}
                    sanitizeInput={sanitizeInput}
                    salesLoading={salesLoading}
                  
                  />

              </RouteProtection>
        
          }/>


          {/*DELIVERY PAGE*/}
          <Route path="/delivery" exact element={ 
              <RouteProtection allowedRoles={['Sales Associate']}>

                  <DeliveryMonitoring
                    deliveryData={deliveryData}
                    deliveryLoading={deliveryLoading}
                    getDeliveries={getDeliveries}
                    setAddDelivery={setAddDelivery}
                    sanitizeInput={sanitizeInput}
                    deliveryEdit={deliveryEdit}

                  />

              </RouteProtection>
        
          }/>

          
        </Route>

      </Routes>
  
    </>
   


  );
}

export default App;
