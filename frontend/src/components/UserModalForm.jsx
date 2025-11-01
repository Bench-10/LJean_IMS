import React, { useEffect, useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import { RxCross2 } from "react-icons/rx";
import { FaSpinner } from 'react-icons/fa';
import api from '../utils/api';
import ConfirmationDialog from './dialogs/ConfirmationDialog';
import FormLoading from './common/FormLoading';

function UserModalForm({ branches, openUserModal, onClose, mode, fetchUsersinfo, userDetailes, setUserDetailes, setOpenUsers }) {

  const { user } = useAuth();

  const [first_name, setFirstName] = useState('');
  const [last_name, setLastname] = useState('');
  const [branch, setBranch] = useState(user && user.role && user.role.some(role => ['Branch Manager'].includes(role)) ? user.branch_id : '');
  const [role, setRole] = useState({ isManager: false, isInventoryStaff: false, isSalesAssociate: false });
  const [cell_number, setCellNumber] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [emptyField, setEmptyField] = useState({});
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [usernameExisting, setUsernameExisting] = useState(false);
  const [passwordCheck, setPasswordCheck] = useState('');
  const [cellCheck, setCellCheck] = useState(false);

  const [loading, setLoading] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [openDialog, setDialog] = useState(false);

  const message = mode === 'add' ? "Are you sure you want to add this user?" : "Are you sure you want to update this user?";

  useEffect(() => {
    if (!user || !user.role) return;
    setEmptyField({});

    if (openUserModal && mode === 'add' && user.role.some(role => ['Owner', 'Branch Manager'].includes(role))) {
      setFirstName('');
      setLastname('');
      setBranch(user.role.some(role => ['Branch Manager'].includes(role)) ? user.branch_id : '');
      setRole({ isManager: false, isInventoryStaff: false, isSalesAssociate: false });
      setCellNumber('');
      setAddress('');
      setUsername('');
      setPassword('');
      setPasswordCheck('');
      setUsernameExisting(false);
      setInvalidEmail(false);
      return;
    }

    if (openUserModal && mode === 'edit' && user.role.some(role => ['Owner', 'Branch Manager'].includes(role)) && userDetailes) {
      let setDbUserRoles = { isManager: false, isInventoryStaff: false, isSalesAssociate: false };

      if (userDetailes.role?.some(role => ['Branch Manager'].includes(role))) setDbUserRoles.isManager = true;
      if (userDetailes.role?.some(role => ['Inventory Staff'].includes(role))) setDbUserRoles.isInventoryStaff = true;
      if (userDetailes.role?.some(role => ['Sales Associate'].includes(role))) setDbUserRoles.isSalesAssociate = true;

      setFirstName(userDetailes.first_name);
      setLastname(userDetailes.last_name);
      setBranch(userDetailes.branch_id);
      setRole(setDbUserRoles);
      setCellNumber(userDetailes.cell_number);
      setAddress(userDetailes.address);
      setUsername(userDetailes.username);
      setPassword(userDetailes.password);
      passwordStrength(userDetailes.password);
      setUsernameExisting(false);
      setInvalidEmail(false);
      return;
    }
  }, [openUserModal, user]);

  if (!user || !user.role) return null;

  const passwordStrength = (value) => {
    if (!value || value.length < 8) return setPasswordCheck('Password must be at least 8 characters!');
    if (!(/\d/.test(value))) return setPasswordCheck('Password must have at least one number!');
    if (!(/[^a-zA-Z0-9]/.test(value))) return setPasswordCheck('Password must contain one special character!');
    setPasswordCheck('');
  };

  const validateInputs = async () => {
    const isEmptyField = {};
    setCellCheck(false);

    if (!String(first_name).trim()) isEmptyField.first_name = true;
    if (!String(last_name).trim()) isEmptyField.last_name = true;
    if (!String(branch).trim()) isEmptyField.branch = true;
    if (!Object.values(role).some(Boolean)) isEmptyField.role = true;
    if (!String(cell_number).trim()) isEmptyField.cell_number = true;
    if (!String(address).trim()) isEmptyField.address = true;
    if (!String(username).trim()) isEmptyField.username = true;
    if (!String(password).trim()) isEmptyField.password = true;

    setEmptyField(isEmptyField);

    const firstTwo = cell_number.substring(0, 2);
    if (cell_number.length !== 11 || firstTwo !== "09" || /[a-zA-Z]/.test(cell_number)) {
      setCellCheck(true);
      return;
    }

    if (Object.keys(isEmptyField).length > 0) return;

    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!(re.test(username.trim()))) {
      setInvalidEmail(true);
      return;
    }

    if (passwordCheck && passwordCheck.length !== 0) return;

    if (mode === 'add' || (userDetailes.username !== username)) {
      const response = await api.get(`/api/existing_account`, { params: { username } });
      if (response.data.result) {
        setUsernameExisting(true);
        return;
      } else {
        setUsernameExisting(false);
      }
    }

    setDialog(true);
    setButtonLoading(true);
  };

  const submitUserConfirmation = async () => {
    try {
      setLoading(true);
      const userData = {
        first_name, last_name, branch, role, cell_number, address, username, password,
        created_by_id: user.role.some(role => ['Owner'].includes(role)) ? user.admin_id : user.user_id,
        created_by: user?.full_name,
        creator_roles: user?.role || [],
      };

      if (mode === 'add') await api.post(`/api/create_account`, userData);
      if (mode === 'edit') {
        const response = await api.put(`/api/update_account/${userDetailes.user_id}`, userData);
        await setUserDetailes(response.data);
      }

      onClose();
      setCellCheck(false);
    } catch (error) {
      console.error('Error submitting user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setCellCheck(false);
  };

  const inputDesign = (field) => `
    w-full h-11 px-3 border rounded-lg text-gray-800 bg-white shadow-sm 
    focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-all text-sm sm:text-base
    ${emptyField[field] ||
      (field === 'username' && (usernameExisting || invalidEmail)) ||
      (field === 'password' && passwordCheck) ||
      (field === 'cell_number' && cellCheck)
      ? 'border-red-500 ring-red-200 focus:ring-red-400' : 'border-gray-300'}
  `;

  const errorflag = (field, field_warn) => {
    if (emptyField[field])
      return <div className="italic text-red-500 absolute text-xs mt-1 pl-1">Please enter {field_warn}!</div>
    if (field === 'username' && usernameExisting)
      return <div className="italic text-red-500 absolute text-xs mt-1 pl-1">{field_warn} already exists!</div>
    if (field === 'username' && invalidEmail)
      return <div className="italic text-red-500 absolute text-xs mt-1 pl-1">Not a valid email!</div>
    if (field === 'password' && passwordCheck)
      return <div className="italic text-red-500 absolute text-xs mt-1 pl-1">{passwordCheck}</div>
    if (field === 'cell_number' && cellCheck)
      return <div className="italic text-red-500 absolute text-xs mt-1 pl-1">Incorrect format! Use 09XXXXXXXXX</div>
  };

  return (
    <div>
      {loading && (
        <FormLoading message={mode === 'add' ? "Creating user..." : "Updating user..."} />
      )}

      {openDialog &&
        <ConfirmationDialog
          mode={mode}
          message={message}
          submitFunction={async () => { await submitUserConfirmation(); setOpenUsers(false); }}
          onClose={() => { setDialog(false); setButtonLoading(false); }}
        />
      }

      {openUserModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]" onClick={handleClose} />
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 animate-popup">
            <div
              className="bg-white rounded-lg shadow-2xl border border-green-100 w-full max-w-[700px] max-h-[80vh] overflow-y-auto hide-scrollbar flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-green-700 p-4 rounded-t-lg flex justify-between items-start sm:items-center gap-3 flex-shrink-0 sticky top-0 z-10">
  <h1 className="text-white font-bold text-2xl">
                  {mode === 'add' ? 'ADD NEW USER' : 'Edit User Information'}
                </h1>
                <button
                  onClick={handleClose}
                  className="text-white hover:bg-green-600 p-1.5 rounded-full transition-colors"
                >
                  <RxCross2 className="text-xl" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <form onSubmit={(e) => { e.preventDefault(); validateInputs(); }}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-green-50/30 p-5 rounded-xl shadow-inner">
                    {/* First Name */}
                    <div className="relative">
                      <h2 className="font-medium text-green-900 mb-2">First Name</h2>
                      <input
                        type="text"
                        className={inputDesign('first_name')}
                        value={first_name}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                      {errorflag('first_name', 'First Name')}
                    </div>

                    {/* Last Name */}
                    <div className="relative">
                      <h2 className="font-medium text-green-900 mb-2">Last Name</h2>
                      <input
                        type="text"
                        className={inputDesign('last_name')}
                        value={last_name}
                        onChange={(e) => setLastname(e.target.value)}
                      />
                      {errorflag('last_name', 'Last Name')}
                    </div>

                    {/* Branch */}
                    <div className="relative">
                      <h2 className="font-medium text-green-900 mb-2">Branch</h2>
                      {user.role.some(role => ['Branch Manager'].includes(role)) ? (
                        <input
                          type="text"
                          className={inputDesign('branch')}
                          value={branches.find(b => b.branch_id === branch)?.branch_name || ''}
                          readOnly
                        />
                      ) : (
                        <select
                          className={inputDesign('branch')}
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                        >
                          <option value="">--Select a branch--</option>
                          {branches.map(option => (
                            <option key={option.branch_id} value={option.branch_id}>{option.branch_name}</option>
                          ))}
                        </select>
                      )}
                      {errorflag('branch', 'Branch')}
                    </div>

                    {/* User Role */}
                    <div className="relative">
                      <h2 className="font-medium text-green-900 mb-2">User Role</h2>
                      {user.role.some(role => ['Owner'].includes(role)) && (
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={role.isManager}
                            onChange={(e) => setRole(prev => ({ ...prev, isManager: e.target.checked }))}
                            className="h-5 w-5 accent-green-600 rounded-md border-gray-300 hover:ring-2 hover:ring-green-400"
                          />
                          <label className="text-sm sm:text-base text-gray-700">Branch Manager</label>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={role.isInventoryStaff}
                          onChange={(e) => setRole(prev => ({ ...prev, isInventoryStaff: e.target.checked }))}
                          className="h-5 w-5 accent-green-600 rounded-md border-gray-300 hover:ring-2 hover:ring-green-400"
                        />
                        <label className="text-sm sm:text-base text-gray-700">Inventory Staff</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={role.isSalesAssociate}
                          onChange={(e) => setRole(prev => ({ ...prev, isSalesAssociate: e.target.checked }))}
                          className="h-5 w-5 accent-green-600 rounded-md border-gray-300 hover:ring-2 hover:ring-green-400"
                        />
                        <label className="text-sm sm:text-base text-gray-700">Sales Associate</label>
                      </div>
                      {errorflag('role', 'User Role')}
                    </div>

                    {/* Cell Number */}
                    <div className="relative">
                      <h2 className="font-medium text-green-900 mb-2">Cellphone Number</h2>
                      <input
                        type="text"
                        className={inputDesign('cell_number')}
                        value={cell_number}
                        onChange={(e) => setCellNumber(e.target.value)}
                      />
                      {errorflag('cell_number', 'Cellphone Number')}
                    </div>

                    {/* Address */}
                    <div className="relative">
                      <h2 className="font-medium text-green-900 mb-2">Address</h2>
                      <input
                        type="text"
                        className={inputDesign('address')}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                      {errorflag('address', 'Address')}
                    </div>

                    {/* Email */}
                    <div className="relative">
                      <h2 className="font-medium text-green-900 mb-2">Email</h2>
                      <input
                        type="text"
                        className={inputDesign('username')}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      {errorflag('username', 'Email')}
                    </div>

                    {/* Password */}
                    <div className="relative">
                      <h2 className="font-medium text-green-900 mb-2">Password</h2>
                      <input
                        type="text"
                        className={inputDesign('password')}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); passwordStrength(e.target.value); }}
                      />
                      {errorflag('password', 'Password')}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-center mt-8">
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 px-8 py-2.5 bg-green-700 hover:bg-green-800 text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={buttonLoading}
                    >
                      {buttonLoading ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          <span>{mode === 'add' ? 'Creating...' : 'Updating...'}</span>
                        </>
                      ) : (
                        <span>{mode === 'add' ? 'Register User' : 'Update User'}</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default UserModalForm;
