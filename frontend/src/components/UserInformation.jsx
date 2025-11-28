import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../authentication/Authentication';
import { FiEdit } from "react-icons/fi";
import { MdDelete } from "react-icons/md";
import { RxCross2 } from "react-icons/rx";
import ConfirmationDialog from './dialogs/ConfirmationDialog';
import FormLoading from './common/FormLoading';
import useModalLock from '../hooks/useModalLock';

function UserInformation({ openUsers, userDetailes, onClose, handleUserModalOpen, deleteUser, deleteLoading }) {
  const { user } = useAuth();
  const [openDialog, setDialog] = useState(false);
  const message = `Are you sure you want to delete the account for ${userDetailes.full_name}?`;

  const getStatusBadge = () => {
    if (userDetailes.status === 'pending')
      return { label: 'For Approval', className: 'bg-amber-100 text-amber-700 border border-amber-300' };
    if (userDetailes.is_disabled)
      return { label: 'Disabled', className: 'bg-red-100 text-red-700 border border-red-300' };
    if (userDetailes.is_active)
      return { label: 'Active', className: 'bg-green-100 text-green-700 border border-green-300' };
    return { label: 'Inactive', className: 'bg-gray-100 text-gray-600 border border-gray-300' };
  };

  // close ONLY the confirmation dialog
  const handleCloseConfirm = useCallback(() => {
    setDialog(false);
  }, []);

  // close ONLY the main user info modal
  const handleCloseModalOnly = useCallback(() => {
    onClose();
  }, [onClose]);

  // unified close for ESC / overlay / Back button
  // - if confirmation is open → close confirmation
  // - else → close the user info modal
  const handleClose = useCallback(() => {
    if (openDialog) {
      handleCloseConfirm();
    } else {
      handleCloseModalOnly();
    }
  }, [openDialog, handleCloseConfirm, handleCloseModalOnly]);

  // Lock for main modal (only when confirm is NOT open)
  useModalLock(openUsers && !openDialog, handleCloseModalOnly);

  //  Lock for confirmation dialog when it is open
  useModalLock(openDialog, handleCloseConfirm);

  // Close on ESC (respect confirm vs main)
  useEffect(() => {
    if (!openUsers) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openUsers, handleClose]);

  return (
    <div>
      {deleteLoading && <FormLoading message="Deleting user account..." />}

      {openDialog && (
        <ConfirmationDialog
          mode="delete"
          message={message}
          submitFunction={() => { deleteUser(userDetailes.user_id); onClose(); }}
          onClose={handleCloseConfirm}  //uses confirm closer
        />
      )}

      {openUsers && (
        <div
          className="fixed inset-0 z-[100] p-4 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={handleClose}  // overlay respects confirm vs main
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-info-title"
        >
          {/* Modal Card (header + scrollable body + fixed footer) */}
          <div
            className="bg-white rounded-lg shadow-2xl border border-green-100 w-full max-w-[900px] max-h-[90vh] flex flex-col overflow-hidden animate-popup"
            onClick={(e) => e.stopPropagation()} // prevent outside-close when clicking inside
          >
            {/* HEADER (non-scrolling) */}
            <div className="bg-green-700 p-4 rounded-t-lg flex justify-between items-center gap-3 flex-shrink-0 sticky top-0 z-10">
              <h1 id="user-info-title" className="text-white font-bold text-2xl">User Information</h1>
              <button
                onClick={handleClose}
                className="text-white hover:bg-green-600 p-1.5 rounded-lg transition-colors"
              >
                <RxCross2 className="text-xl" />
              </button>
            </div>

            {/* BODY (scrolls) */}
            <div className="flex-1 overflow-y-auto p-5 bg-green-50/30 hide-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 auto-rows-fr">
                {[
                  ['First Name', userDetailes.first_name],
                  ['Last Name', userDetailes.last_name],
                  ['Branch', userDetailes.branch],
                  ['Role', Array.isArray(userDetailes.role) ? userDetailes.role.join(', ') : userDetailes.role],
                  ['Cell Number', userDetailes.cell_number],
                  ['Address', userDetailes.address],
                  [
                    'Permissions',
                    Array.isArray(userDetailes.permissions)
                      ? userDetailes.permissions.join(', ')
                      : userDetailes.permissions || '',
                  ],
                  ['Hire Date', userDetailes.formated_hire_date],
                  [
                    'Account Status',
                    (() => {
                      const badge = getStatusBadge();
                      return (
                        <span className={`text-xs font-semibold py-1 px-3 rounded-full inline-block ${badge.className}`}>
                          {badge.label}
                        </span>
                      );
                    })(),
                  ],
                  ['Last Login', userDetailes.last_login],
                ].map(([label, value], i) => (
                  <div
                    key={i}
                    className="bg-white shadow-inner rounded-lg px-3 py-2 border border-gray-200 w-full h-full flex flex-col justify-center"
                  >
                    <h2 className="text-green-800 text-sm font-medium mb-1">{label}</h2>
                    <p className="text-gray-800 text-base font-semibold break-words">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* FOOTER (non-scrolling, always visible) */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 p-3 lg:p-5 bg-white border-t border-green-100 flex-shrink-0">
              <button
                className="py-1 lg:py-2.5 px-4 lg:px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium shadow-md transition-all"
                onClick={(e) => { e.stopPropagation(); handleUserModalOpen('edit'); }}
              >
                <FiEdit className="text-base lg:text-lg" />
                <span>Edit</span>
              </button>

              <button
                className="py-1 lg:py-2.5 px-4 lg:px-6 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium shadow-md transition-all"
                onClick={(e) => { e.stopPropagation(); setDialog(true); }}
              >
                <MdDelete className="text-base lg:text-lg" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserInformation;
